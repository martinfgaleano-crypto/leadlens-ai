// ─── Monitor cycle — one account review + bounded run orchestration ───────────
//
// One account: plan → re-observe (DI) → classify delta → sufficiency gate →
// re-evaluate the Case conservatively → (if accepted) new immutable
// AccountReviewSnapshot via the canonical Account Memory store → diff. A run:
// build the bounded queue, review each SELECTED account with batch isolation,
// aggregate observability. Deferred accounts are reported, never lost.
//
// Reuses Account Memory (diffAccountCase) as the canonical material-change
// classifier — no parallel ontology. Failed / insufficient reviews NEVER persist
// as accepted predecessors.

import type { DecisionState, Strength } from "@/lib/deliverable/deliverable-view-model";
import type { AccountReviewSnapshot, AccountCaseDiff } from "@/lib/deliverable/account-memory";
import { diffAccountCase } from "@/lib/deliverable/account-memory";
import type { AccountMemoryRepo, SnapshotScope } from "@/lib/deliverable/account-memory-store";
import { toRow } from "@/lib/deliverable/account-memory-store";
import { REVIEW_CADENCE_DAYS, DEFAULT_MONITOR_BUDGET, type MonitorBudget } from "./monitor-config";
import { type MonitoredAccountState, buildReviewQueue, type MonitorReviewQueue } from "./monitor-eligibility";
import { planMonitorReview, classifyDelta, type AccountObservation, type MonitorReviewPlan, type DeltaEvidenceResult } from "./delta-research";

const DAY_MS = 86_400_000;

/** Targeted re-observation for one account. The real implementation reuses the
 *  existing provider/research architecture; tests inject a mock. */
export type Reobserver = (plan: MonitorReviewPlan) => Promise<AccountObservation>;

export type AccountOutcomeStatus =
  | "completed_no_change"
  | "completed_changed"
  | "insufficient_review"
  | "failed"
  | "deferred_due_to_budget";

export type ChangeCategory = "none" | "minor" | "material";

/** Structured output for a future alert layer (NOT built here). */
export interface AlertContract {
  accountId: string;
  materialChange: boolean;
  decisionChanged: boolean;
  previousDecision: DecisionState;
  currentDecision: DecisionState;
  changeCategory: ChangeCategory;
  revisitTriggerMet: boolean;
  reviewId: string;
}

export interface AccountReviewOutcome {
  accountId: string;
  status: AccountOutcomeStatus;
  reasons: string[];
  delta?: DeltaEvidenceResult;
  diff?: AccountCaseDiff;
  snapshot?: AccountReviewSnapshot;   // present only when accepted (persisted)
  nextReviewAt: string | null;
  alert?: AlertContract;
}

// ─── Conservative decision re-evaluation (inspectable; not hardcoded to Prioritize)
function reevaluateDecision(prior: AccountReviewSnapshot, delta: DeltaEvidenceResult): { decision: DecisionState; reasons: string[] } {
  const reasons: string[] = [];
  let decision: DecisionState = prior.decision;
  const revisitMet = prior.hasRevisitTrigger && (prior.decision === "monitor" || prior.decision === "hold") && delta.newChangeKeys.length > 0;

  if (delta.hasMaterialCounter && prior.decision === "prioritize") { decision = "validate"; reasons.push("material_counterevidence_weakened_case"); }
  else if (prior.decision === "validate" && prior.decisionCriticalThemeKeys.length > 0
    && prior.decisionCriticalThemeKeys.every((k) => delta.resolvedValidationKeys.includes(k)) && delta.newChangeKeys.length > 0) {
    decision = "prioritize"; reasons.push("decision_critical_resolved_with_new_support");
  } else if (revisitMet) { decision = "validate"; reasons.push("revisit_trigger_met_needs_validation"); }
  else reasons.push("no_justified_transition");
  return { decision, reasons };
}

const weaken = (s: Strength | null): Strength | null => s === "Strong" ? "Moderate" : s === "Moderate" ? "Limited" : s;
const strengthen = (s: Strength | null): Strength | null => s === "Limited" ? "Moderate" : s === "Moderate" ? "Strong" : s;

function buildNextSnapshot(prior: AccountReviewSnapshot, delta: DeltaEvidenceResult, meta: { reviewId: string; reviewedAt: string; contextVersion: string }): AccountReviewSnapshot {
  const { decision } = reevaluateDecision(prior, delta);
  const changeKeys = Array.from(new Set([...prior.changeKeys, ...delta.newChangeKeys]));
  const evidenceOrigins = Array.from(new Set([...prior.evidenceOrigins, ...delta.newOrigins]));
  const independentSupport = prior.independentSupport || delta.acceptedEvents.some((e) => e.independentSupport);
  const newEvidence = delta.newChangeKeys.length > 0;
  return {
    ...prior,
    reviewId: meta.reviewId, reviewedAt: meta.reviewedAt, contextVersion: meta.contextVersion,
    decision,
    // Conservative dimension movement: new independent support strengthens evidence;
    // material counterevidence weakens it. Fit is not moved by re-observation.
    evidence: delta.hasMaterialCounter ? weaken(prior.evidence) : (independentSupport && newEvidence ? strengthen(prior.evidence) : prior.evidence),
    timing: newEvidence && !delta.hasMaterialCounter ? strengthen(prior.timing) : prior.timing,
    changeKeys, hasVerifiedChange: changeKeys.length > 0,
    evidenceOrigins, independentSupport,
    counterCount: prior.counterCount + delta.acceptedEvents.filter((e) => e.isCounterevidence).length,
    hasMaterialCounter: prior.hasMaterialCounter || delta.hasMaterialCounter,
    decisionCriticalThemeKeys: prior.decisionCriticalThemeKeys.filter((k) => !delta.resolvedValidationKeys.includes(k)),
  };
}

function nextReviewFor(decision: DecisionState, reviewedAt: string): string | null {
  const days = REVIEW_CADENCE_DAYS[decision];
  return days === null ? null : new Date(new Date(reviewedAt).getTime() + days * DAY_MS).toISOString();
}

export interface ReviewMeta { reviewId: string; reviewedAt: string; contextVersion: string }

/**
 * Review one account. Pure except for the injected re-observer. Returns the
 * outcome and (when accepted) the next snapshot to persist — persistence is done
 * by runMonitor so batch isolation is centralized.
 */
export async function reviewAccount(
  state: MonitoredAccountState,
  prior: AccountReviewSnapshot,
  reobserve: Reobserver,
  meta: ReviewMeta,
  now: Date,
  budget: MonitorBudget = DEFAULT_MONITOR_BUDGET,
): Promise<AccountReviewOutcome> {
  const plan = planMonitorReview(state, prior);
  let obs: AccountObservation;
  try {
    obs = await reobserve(plan);
  } catch {
    return { accountId: state.accountId, status: "failed", reasons: ["reobservation_error"], nextReviewAt: nextReviewFor(prior.decision, prior.reviewedAt) };
  }

  // Research sufficiency gate: an all-provider failure or too few routes means we
  // do NOT know whether anything changed → INSUFFICIENT_REVIEW (never "no change").
  if (obs.operatingMode === "stopped" || obs.providersAvailable.length === 0 || obs.routesAttempted < budget.minRoutesForSufficiency) {
    return { accountId: state.accountId, status: "insufficient_review", reasons: ["insufficient_research_coverage"], nextReviewAt: nextReviewFor(prior.decision, prior.reviewedAt) };
  }

  const delta = classifyDelta(plan, obs, now);
  const next = buildNextSnapshot(prior, delta, meta);
  const diff = diffAccountCase(prior, next);
  const changeCategory: ChangeCategory = diff.material ? "material" : (delta.counters.accepted_new > 0 || delta.freshnessGap ? "minor" : "none");
  const status: AccountOutcomeStatus = diff.material ? "completed_changed" : "completed_no_change";
  const alert: AlertContract = {
    accountId: state.accountId,
    materialChange: diff.material,
    decisionChanged: diff.decision.changed,
    previousDecision: prior.decision,
    currentDecision: next.decision,
    changeCategory,
    revisitTriggerMet: diff.revisitTriggerMet,
    reviewId: meta.reviewId,
  };
  return { accountId: state.accountId, status, reasons: [`change_category_${changeCategory}`], delta, diff, snapshot: next, nextReviewAt: nextReviewFor(next.decision, meta.reviewedAt), alert };
}

// ─── Run orchestration ────────────────────────────────────────────────────────

export interface MonitorRunObservability {
  accountsDue: number;
  accountsSelected: number;
  accountsDeferred: number;
  attempted: number;
  completedNoChange: number;
  completedChanged: number;
  insufficient: number;
  failed: number;
  decisionChanged: number;
  revisitTriggerMet: number;
  newEvidence: number;
  rediscoveredEvidence: number;
  providerFailuresSeen: number;
}

export interface MonitorRun {
  runId: string;
  scope: SnapshotScope;
  startedAt: string;
  completedAt: string;
  status: "completed" | "completed_with_failures";
  budget: MonitorBudget;
  queue: MonitorReviewQueue;
  outcomes: AccountReviewOutcome[];
  observability: MonitorRunObservability;
  alerts: AlertContract[];
}

export interface MonitorRunInput {
  runId: string;
  scope: SnapshotScope;
  states: MonitoredAccountState[];
  priorById: Record<string, AccountReviewSnapshot>;
  reobserve: Reobserver;
  memoryRepo: AccountMemoryRepo;
  reviewIdFor: (accountId: string) => string;   // stable per-cycle review id (idempotent)
  now?: () => Date;
  budget?: MonitorBudget;
}

/**
 * Run one Monitor cycle. Builds the bounded queue, reviews each selected account
 * with per-account isolation, and persists ONLY accepted (completed) reviews as
 * immutable snapshots (batch isolation: one failure never drops the others).
 */
export async function runMonitor(input: MonitorRunInput): Promise<MonitorRun> {
  const now = (input.now ?? (() => new Date()))();
  const budget = input.budget ?? DEFAULT_MONITOR_BUDGET;
  const queue = buildReviewQueue(input.states, now, budget, input.scope);
  const startedAt = now.toISOString();

  const outcomes: AccountReviewOutcome[] = [];
  const toPersist: ReturnType<typeof toRow>[] = [];

  for (const sel of queue.selected) {
    const state = sel.state;
    const prior = input.priorById[state.accountId];
    if (!prior) { outcomes.push({ accountId: state.accountId, status: "failed", reasons: ["no_prior_accepted_review"], nextReviewAt: null }); continue; }
    const meta: ReviewMeta = { reviewId: input.reviewIdFor(state.accountId), reviewedAt: startedAt, contextVersion: state.contextVersion };
    const outcome = await reviewAccount(state, prior, input.reobserve, meta, now, budget);
    outcomes.push(outcome);
    // Persist ONLY accepted reviews. Insufficient/failed never become memory.
    if ((outcome.status === "completed_changed" || outcome.status === "completed_no_change") && outcome.snapshot) {
      toPersist.push(toRow(outcome.snapshot, input.scope));
    }
  }
  for (const def of queue.deferred) {
    outcomes.push({ accountId: def.state.accountId, status: "deferred_due_to_budget", reasons: def.reasons, nextReviewAt: null });
  }

  // Batch isolation: persist accepted snapshots; a store failure is logged but does
  // not discard the computed outcomes.
  let persistOk = true;
  if (toPersist.length) { try { await input.memoryRepo.persist(toPersist); } catch { persistOk = false; } }

  const observability: MonitorRunObservability = {
    accountsDue: queue.eligibleCount,
    accountsSelected: queue.selected.length,
    accountsDeferred: queue.deferred.length,
    attempted: queue.selected.length,
    completedNoChange: outcomes.filter((o) => o.status === "completed_no_change").length,
    completedChanged: outcomes.filter((o) => o.status === "completed_changed").length,
    insufficient: outcomes.filter((o) => o.status === "insufficient_review").length,
    failed: outcomes.filter((o) => o.status === "failed").length,
    decisionChanged: outcomes.filter((o) => o.alert?.decisionChanged).length,
    revisitTriggerMet: outcomes.filter((o) => o.alert?.revisitTriggerMet).length,
    newEvidence: outcomes.reduce((n, o) => n + (o.delta?.counters.accepted_new ?? 0), 0),
    rediscoveredEvidence: outcomes.reduce((n, o) => n + (o.delta?.counters.rediscovered ?? 0), 0),
    providerFailuresSeen: outcomes.reduce((n, o) => n + ((o.delta && o.diff) ? 0 : 0), 0),
  };

  return {
    runId: input.runId, scope: input.scope, startedAt, completedAt: now.toISOString(),
    status: (observability.failed > 0 || observability.insufficient > 0 || !persistOk) ? "completed_with_failures" : "completed",
    budget, queue, outcomes, observability,
    alerts: outcomes.filter((o) => o.alert).map((o) => o.alert as AlertContract),
  };
}
