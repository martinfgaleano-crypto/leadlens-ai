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
import { resynthesizeCase, type DecisionSource } from "./case-resynthesis";

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
  /** Where the current Decision came from (canonical engine vs retained vs fallback). */
  decisionSource?: DecisionSource;
  providerFailures: number;
  durationMs: number;
  researchMetrics?: AccountObservation["metrics"];
}

/**
 * Build the next snapshot by rebuilding the CURRENT Case through the canonical
 * engine (resynthesizeCase → opportunityTest). changeKeys (What Changed) come ONLY
 * from true post-review external events — never from newly discovered historical
 * evidence (which strengthens Evidence without claiming an external change).
 */
function buildNextSnapshot(prior: AccountReviewSnapshot, delta: DeltaEvidenceResult, meta: { reviewId: string; reviewedAt: string; contextVersion: string }, now: Date): { snapshot: AccountReviewSnapshot; decisionSource: DecisionSource } {
  const rc = resynthesizeCase(prior, delta, now);
  const changeKeys = Array.from(new Set([...prior.changeKeys, ...delta.newChangeKeys])); // post-review only
  const evidenceOrigins = Array.from(new Set([...prior.evidenceOrigins, ...delta.newOrigins]));
  const independentSupport = prior.independentSupport || [...delta.acceptedEvents, ...delta.historicalEvidence].some((e) => e.independentSupport);
  const snapshot: AccountReviewSnapshot = {
    ...prior,
    reviewId: meta.reviewId, reviewedAt: meta.reviewedAt, contextVersion: meta.contextVersion,
    decision: rc.decision,
    fit: rc.fit, timing: rc.timing, evidence: rc.evidence,
    changeKeys, hasVerifiedChange: changeKeys.length > 0,
    evidenceOrigins, independentSupport,
    counterCount: prior.counterCount + delta.acceptedEvents.filter((e) => e.isCounterevidence).length,
    hasMaterialCounter: prior.hasMaterialCounter || delta.hasMaterialCounter,
    decisionCriticalThemeKeys: rc.remainingDecisionCritical,
  };
  return { snapshot, decisionSource: rc.decisionSource };
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
  const accountStarted = Date.now();
  if (plan.identityRequiresValidation) {
    return { accountId: state.accountId, status: "insufficient_review", reasons: ["identity_requires_validation"], nextReviewAt: nextReviewFor(prior.decision, prior.reviewedAt), providerFailures: 0, durationMs: Date.now() - accountStarted };
  }
  let obs: AccountObservation;
  try {
    obs = await reobserve(plan);
  } catch {
    return { accountId: state.accountId, status: "failed", reasons: ["reobservation_error"], nextReviewAt: nextReviewFor(prior.decision, prior.reviewedAt), providerFailures: 1, durationMs: Date.now() - accountStarted };
  }

  // Research sufficiency gate: an all-provider failure or too few routes means we
  // do NOT know whether anything changed → INSUFFICIENT_REVIEW (never "no change").
  if (obs.operatingMode === "stopped" || obs.providersAvailable.length === 0 || obs.routesAttempted < budget.minRoutesForSufficiency) {
    return { accountId: state.accountId, status: "insufficient_review", reasons: ["insufficient_research_coverage"], nextReviewAt: nextReviewFor(prior.decision, prior.reviewedAt), providerFailures: obs.providersFailed.length, durationMs: Date.now() - accountStarted, researchMetrics: obs.metrics };
  }

  const delta = classifyDelta(plan, obs, now);
  const { snapshot: next, decisionSource } = buildNextSnapshot(prior, delta, meta, now);
  const diff = diffAccountCase(prior, next);
  const changeCategory: ChangeCategory = diff.material ? "material" : (delta.counters.accepted_new > 0 || delta.counters.newly_discovered_historical > 0 || delta.freshnessGap ? "minor" : "none");
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
  return { accountId: state.accountId, status, reasons: [`change_category_${changeCategory}`, `decision_source_${decisionSource}`], delta, diff, snapshot: next, nextReviewAt: nextReviewFor(next.decision, meta.reviewedAt), alert, decisionSource, providerFailures: obs.providersFailed.length, durationMs: Date.now() - accountStarted, researchMetrics: obs.metrics };
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
  newHistoricalEvidence: number;
  caseResynthesisCanonical: number;
  caseResynthesisFallback: number;
  providerFailuresSeen: number;
  durationMs: number;
  searchResultsConsidered: number;
  pagesEscalated: number;
  pagesFetched: number;
  fetchFailures: number;
  llmExtractionCalls: number;
  claimsProposed: number;
  eventsProposed: number;
  eventsAccepted: number;
  temporalRejects: number;
  materialityRejects: number;
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
  const clock = input.now ?? (() => new Date());
  const now = clock();
  const budget = input.budget ?? DEFAULT_MONITOR_BUDGET;
  const queue = buildReviewQueue(input.states, now, budget, input.scope);
  const startedAt = now.toISOString();

  const outcomes: AccountReviewOutcome[] = [];
  const toPersist: ReturnType<typeof toRow>[] = [];

  for (const sel of queue.selected) {
    const state = sel.state;
    const prior = input.priorById[state.accountId];
    if (!prior) { outcomes.push({ accountId: state.accountId, status: "failed", reasons: ["no_prior_accepted_review"], nextReviewAt: null, providerFailures: 0, durationMs: 0 }); continue; }
    const meta: ReviewMeta = { reviewId: input.reviewIdFor(state.accountId), reviewedAt: startedAt, contextVersion: state.contextVersion };
    const outcome = await reviewAccount(state, prior, input.reobserve, meta, now, budget);
    outcomes.push(outcome);
    // Persist ONLY accepted reviews. Insufficient/failed never become memory.
    if ((outcome.status === "completed_changed" || outcome.status === "completed_no_change") && outcome.snapshot) {
      toPersist.push(toRow(outcome.snapshot, input.scope));
    }
  }
  for (const def of queue.deferred) {
    outcomes.push({ accountId: def.state.accountId, status: "deferred_due_to_budget", reasons: def.reasons, nextReviewAt: null, providerFailures: 0, durationMs: 0 });
  }

  // Batch isolation: persist accepted snapshots; a store failure is logged but does
  // not discard the computed outcomes.
  let persistOk = true;
  if (toPersist.length) { try { await input.memoryRepo.persist(toPersist); } catch { persistOk = false; } }

  const completedAt = clock();
  const metric = (key: keyof NonNullable<AccountObservation["metrics"]>) => outcomes.reduce((n, o) => n + (o.researchMetrics?.[key] ?? 0), 0);
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
    newHistoricalEvidence: outcomes.reduce((n, o) => n + (o.delta?.counters.newly_discovered_historical ?? 0), 0),
    caseResynthesisCanonical: outcomes.filter((o) => o.decisionSource === "canonical_opportunity_test").length,
    caseResynthesisFallback: outcomes.filter((o) => o.decisionSource === "fallback_conservative").length,
    providerFailuresSeen: outcomes.reduce((n, o) => n + o.providerFailures, 0),
    durationMs: Math.max(0, completedAt.getTime() - now.getTime()),
    searchResultsConsidered: metric("searchResultsConsidered"), pagesEscalated: metric("pagesEscalated"), pagesFetched: metric("pagesFetched"),
    fetchFailures: metric("fetchFailures"), llmExtractionCalls: metric("llmExtractionCalls"), claimsProposed: metric("claimsProposed"),
    eventsProposed: metric("eventsProposed"), eventsAccepted: metric("eventsAccepted"), temporalRejects: metric("temporalRejects"), materialityRejects: metric("materialityRejects"),
  };

  return {
    runId: input.runId, scope: input.scope, startedAt, completedAt: completedAt.toISOString(),
    status: (observability.failed > 0 || observability.insufficient > 0 || !persistOk) ? "completed_with_failures" : "completed",
    budget, queue, outcomes, observability,
    alerts: outcomes.filter((o) => o.alert).map((o) => o.alert as AlertContract),
  };
}
