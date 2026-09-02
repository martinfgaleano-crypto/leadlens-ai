// ─── Monitor eligibility + priority + review queue (deterministic) ─────────────
//
// Eligibility answers "should this account be considered for a review?"; priority
// answers "if more are due than budget allows, which first?". Both are pure and
// inspectable — reasons, never an opaque numeric monitor score. No LLM decides
// scheduling.

import type { DecisionState } from "@/lib/deliverable/deliverable-view-model";
import type { AccountReviewSnapshot, MonitorableAccountIdentity } from "@/lib/deliverable/account-memory";
import { REVIEW_CADENCE_DAYS, type MonitorBudget, DEFAULT_MONITOR_BUDGET } from "./monitor-config";

const DAY_MS = 86_400_000;

/** Durable per-account monitoring state, derived from the latest ACCEPTED review
 *  snapshot + its scope. Not a CRM object — only what recurring review needs. */
export interface MonitoredAccountState {
  ownerUserId: string | null;
  clientKey: string;
  accountId: string;
  identity: MonitorableAccountIdentity;
  contextVersion: string;
  currentDecision: DecisionState;
  lastReviewId: string;
  lastReviewedAt: string;
  hasRevisitTrigger: boolean;
  unresolvedDecisionCritical: string[];
  evidenceOrigins: string[];
  changeKeys: string[];
  revisitTrigger: AccountReviewSnapshot["revisitTrigger"];
  /** Set only by a trusted explicit customer/admin refresh request. A stored
   * revisit condition describes what to watch for; it is not itself proof that
   * the condition has occurred. */
  refreshRequested?: boolean;
}

export function monitoredStateFromSnapshot(
  snap: AccountReviewSnapshot,
  scope: { ownerUserId: string | null; clientKey: string },
): MonitoredAccountState {
  const identity = snap.accountIdentity ?? legacyIdentity(snap.accountId);
  return {
    ownerUserId: scope.ownerUserId,
    clientKey: scope.clientKey,
    accountId: snap.accountId,
    identity,
    contextVersion: snap.contextVersion,
    currentDecision: snap.decision,
    lastReviewId: snap.reviewId,
    lastReviewedAt: snap.reviewedAt,
    hasRevisitTrigger: snap.hasRevisitTrigger,
    unresolvedDecisionCritical: snap.decisionCriticalThemeKeys,
    evidenceOrigins: snap.evidenceOrigins,
    changeKeys: snap.changeKeys,
    revisitTrigger: snap.revisitTrigger ?? null,
  };
}

const OPAQUE_ID = /^(?:acct|account|lead|case|dossier|opp)[_-]|^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
function legacyIdentity(accountId: string): MonitorableAccountIdentity {
  const ambiguous = OPAQUE_ID.test(accountId) || !/[a-zA-ZÀ-ÿ]{2}/.test(accountId);
  return {
    stableAccountKey: accountId,
    canonicalName: ambiguous ? "" : accountId,
    domain: null,
    aliases: [],
    country: null,
    organizationType: null,
    confidence: ambiguous ? "ambiguous" : "plausible",
    fromUniverse: false,
    lineage: "legacy_snapshot",
  };
}

export type EligibilityReason =
  | "decision_monitor"
  | "validate_unresolved_decision_critical"
  | "prioritize_freshness_protection"
  | "revisit_trigger_present"
  | "user_requested_refresh"
  | "review_by_reached"
  | "hold_no_recurring_research";

export interface Eligibility {
  eligible: boolean;
  reasons: EligibilityReason[];
  /** The earliest the account is due by cadence (null = trigger-only, e.g. Hold). */
  nextEligibleAt: string | null;
}

export function nextEligibleAt(state: MonitoredAccountState): string | null {
  const days = REVIEW_CADENCE_DAYS[state.currentDecision];
  if (days === null) return null;
  return new Date(new Date(state.lastReviewedAt).getTime() + days * DAY_MS).toISOString();
}

/**
 * Deterministic eligibility. Hold consumes NO recurring research unless it carries
 * an explicit revisit trigger. Everything else is eligible when its cadence is due
 * OR it has an unresolved decision-critical validation OR an explicit revisit
 * trigger OR it is a Prioritize/Monitor case (freshness protection) that is due.
 */
export function evaluateEligibility(state: MonitoredAccountState, now: Date, _budget: MonitorBudget = DEFAULT_MONITOR_BUDGET): Eligibility {
  const reasons: EligibilityReason[] = [];
  const due = (() => { const t = nextEligibleAt(state); return t !== null && now.getTime() >= new Date(t).getTime(); })();

  if (state.currentDecision === "hold") {
    if (state.refreshRequested) { reasons.push("user_requested_refresh"); return { eligible: true, reasons, nextEligibleAt: null }; }
    if (state.hasRevisitTrigger) reasons.push("revisit_trigger_present");
    // Frozen Intelligence Option B: a HOLD is scheduler-reviewable ONLY when it carries an
    // UNRESOLVED decision-critical validation requirement — a stable canonical theme key derived
    // from structured validationDetails (`decisionCritical`), never customer prose. This path is
    // trigger-based, not cadence: nextEligibleAt stays null so a HOLD never acquires a fixed review
    // clock, and the Decision itself remains HOLD (eligibility ≠ decision). When the requirement
    // later resolves, the latest accepted snapshot's decisionCriticalThemeKeys shrink and this path
    // stops matching — so a stale historical key cannot create a permanent review loop. Generic
    // HOLD uncertainty (no decision-critical key) stays not eligible / trigger-only.
    if (state.unresolvedDecisionCritical.length > 0) {
      reasons.push("validate_unresolved_decision_critical");
      return { eligible: true, reasons, nextEligibleAt: null };
    }
    reasons.push("hold_no_recurring_research");
    return { eligible: false, reasons, nextEligibleAt: null };
  }

  if (state.hasRevisitTrigger) reasons.push("revisit_trigger_present");
  if (state.unresolvedDecisionCritical.length > 0) reasons.push("validate_unresolved_decision_critical");
  if (state.currentDecision === "prioritize") reasons.push("prioritize_freshness_protection");
  if (state.currentDecision === "monitor") reasons.push("decision_monitor");
  if (due) reasons.push("review_by_reached");
  if (state.refreshRequested) reasons.push("user_requested_refresh");

  // Eligible when due by cadence, OR an unresolved decision-critical exists, OR a
  // revisit trigger is present. A not-yet-due case with none of these is not eligible.
  const eligible = due || state.unresolvedDecisionCritical.length > 0 || state.refreshRequested === true;
  return { eligible, reasons, nextEligibleAt: nextEligibleAt(state) };
}

// ─── Priority (inspectable, no opaque score) ──────────────────────────────────

export type PriorityReason =
  | "decision_critical_unresolved"
  | "revisit_trigger_due"
  | "prioritize_freshness"
  | "monitor_review_due"
  | "time_since_last_review";

export interface PrioritizedAccount {
  state: MonitoredAccountState;
  eligibility: Eligibility;
  reasons: PriorityReason[];
  /** Ordered tier (lower = higher priority). Derived from the reason factors in a
   *  fixed order — the tier is a readout OF the reasons, not a hidden score. */
  tier: number;
}

const PRIORITY_FACTORS: Array<{ reason: PriorityReason; test: (s: MonitoredAccountState, e: Eligibility) => boolean }> = [
  { reason: "decision_critical_unresolved", test: (s) => s.unresolvedDecisionCritical.length > 0 },
  { reason: "revisit_trigger_due", test: (s) => s.hasRevisitTrigger },
  { reason: "prioritize_freshness", test: (s) => s.currentDecision === "prioritize" },
  { reason: "monitor_review_due", test: (s, e) => s.currentDecision === "monitor" && e.reasons.includes("review_by_reached") },
];

export function prioritize(states: Array<{ state: MonitoredAccountState; eligibility: Eligibility }>, now: Date): PrioritizedAccount[] {
  const scored = states.map(({ state, eligibility }) => {
    const reasons: PriorityReason[] = PRIORITY_FACTORS.filter((f) => f.test(state, eligibility)).map((f) => f.reason);
    // tier = index of the highest-priority matched factor (0 best); no matches = last.
    const firstIdx = PRIORITY_FACTORS.findIndex((f) => reasons.includes(f.reason));
    const tier = firstIdx === -1 ? PRIORITY_FACTORS.length : firstIdx;
    reasons.push("time_since_last_review");
    return { state, eligibility, reasons, tier };
  });
  // Deterministic sort: tier asc, then oldest last-review first, then accountId.
  scored.sort((a, b) =>
    a.tier - b.tier
    || new Date(a.state.lastReviewedAt).getTime() - new Date(b.state.lastReviewedAt).getTime()
    || a.state.accountId.localeCompare(b.state.accountId));
  return scored;
}

// ─── Review queue (bounded; explicit deferral) ────────────────────────────────

export type QueueDisposition = "selected" | "deferred_due_to_budget";

export interface QueuedAccount {
  account: PrioritizedAccount;
  disposition: QueueDisposition;
}

export interface MonitorReviewQueue {
  runContext: { ownerUserId: string | null; clientKey: string };
  budget: MonitorBudget;
  eligibleCount: number;
  selected: PrioritizedAccount[];
  deferred: PrioritizedAccount[];
  entries: QueuedAccount[];
}

/**
 * Build a bounded queue: keep only eligible accounts, prioritize deterministically,
 * select up to maxAccountsPerRun, and mark the rest deferred_due_to_budget (never
 * silently dropped).
 */
export function buildReviewQueue(
  states: MonitoredAccountState[],
  now: Date,
  budget: MonitorBudget = DEFAULT_MONITOR_BUDGET,
  runContext: { ownerUserId: string | null; clientKey: string } = { ownerUserId: null, clientKey: "" },
): MonitorReviewQueue {
  const withElig = states.map((state) => ({ state, eligibility: evaluateEligibility(state, now, budget) }));
  const eligible = withElig.filter((x) => x.eligibility.eligible);
  const ranked = prioritize(eligible, now);
  const selected = ranked.slice(0, budget.maxAccountsPerRun);
  const deferred = ranked.slice(budget.maxAccountsPerRun);
  return {
    runContext, budget, eligibleCount: eligible.length,
    selected, deferred,
    entries: [
      ...selected.map((account) => ({ account, disposition: "selected" as const })),
      ...deferred.map((account) => ({ account, disposition: "deferred_due_to_budget" as const })),
    ],
  };
}
