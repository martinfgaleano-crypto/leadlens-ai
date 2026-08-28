// Commercially Useful Opportunity Rate (INTELLIGENCE ACCELERATION V2 §5–7, §21, §41, §50).
//
// This is a QA / ACCEPTANCE metric, NOT a runtime score (§58): it never becomes a
// product-facing account score, buying-intent probability, or HOT/WARM/COLD, and it
// never drives a capability dimension. It answers one question:
//
//   Of completed researched Cases, how often does LeadLens produce a Decision that
//   would genuinely help the customer decide where to allocate attention?
//
// A Case is commercially useful only if it satisfies the canonical quality contract
// (§6). It reuses validatePositiveCommercialCase as the authority — it does not
// re-implement the contract. Prioritize/Validate are POSITIVE cases; a defensible
// Monitor/Hold is DECISION-USEFUL (it prevents wasted attention, §21). A human QA
// label never mutates a runtime Decision.

import type { DecisionState } from "@/lib/deliverable/deliverable-view-model";
import { validatePositiveCommercialCase, type PositiveCommercialCaseReview } from "@/lib/intelligence/positive-commercial-case-validation";

export const COMMERCIAL_USEFULNESS_VERSION = "commercial-usefulness-v1";

// Blockers that require HUMAN confirmation — excluded from the AUTOMATED (system-
// predicted) layer so we never conflate "system predicts safe" with "human confirmed".
const HUMAN_ONLY_BLOCKERS = new Set(["human_confirmation_required", "human_judgment_not_positive"]);

export type UsefulnessClass = "positive_case" | "decision_useful" | "not_useful";

export interface CaseUsefulnessReview {
  case_id: string;
  account: string;
  decision: DecisionState;
  // System-predicted (automated) customer-safe — the canonical contract minus the
  // human-confirmation gate. Human confirmation is tracked separately (§41).
  system_predicted_useful: boolean;
  system_predicted_safe: boolean;
  human_reviewed: boolean;
  human_confirmed_positive: boolean;
  identity_valid: boolean;
  timing_claimed: boolean;
  timing_supported: boolean;
  evidence_sufficient: boolean;
  actionable: boolean;
  usefulness_class: UsefulnessClass;
  reason_codes: string[];
}

const POSITIVE_DECISIONS: DecisionState[] = ["prioritize", "validate"];
const NONPOSITIVE_DECISIONS: DecisionState[] = ["monitor", "hold"];

function classify(review: PositiveCommercialCaseReview): CaseUsefulnessReview {
  const full = validatePositiveCommercialCase(review);
  const systemBlockers = full.blockers.filter((b) => !HUMAN_ONLY_BLOCKERS.has(b));
  const system_predicted_safe = systemBlockers.length === 0;
  const identity_valid = review.identity_confirmed && review.target_organization_confirmed;
  const timing_supported = !review.timing_claimed || (review.event_observed && Boolean(review.event_date) && review.timing_grounded);
  const evidence_sufficient = review.evidence_traceable;
  const actionable = review.next_action_explicit;

  // A defensible non-positive Decision (Monitor/Hold): the customer is helped to NOT
  // waste attention. It needs correct identity, supported-or-absent timing, explicit
  // evidence handling, a next action, and no unsupported buying-intent claim.
  const defensibleNonPositive =
    NONPOSITIVE_DECISIONS.includes(review.decision)
    && identity_valid && review.commercial_context_confirmed
    && timing_supported && review.counterevidence_explicit
    && review.weakening_factors_explicit && actionable && !review.buying_intent_claimed;

  const system_positive = POSITIVE_DECISIONS.includes(review.decision) && system_predicted_safe;

  const usefulness_class: UsefulnessClass = system_positive
    ? "positive_case"
    : defensibleNonPositive ? "decision_useful" : "not_useful";

  return {
    case_id: review.case_id, account: review.account, decision: review.decision,
    system_predicted_useful: usefulness_class !== "not_useful",
    system_predicted_safe,
    human_reviewed: review.human_confirmation.state !== "pending",
    human_confirmed_positive: full.customer_safe_human_positive,
    identity_valid,
    timing_claimed: review.timing_claimed,
    timing_supported,
    evidence_sufficient,
    actionable,
    usefulness_class,
    reason_codes: usefulness_class === "not_useful" ? systemBlockers : [],
  };
}

export interface CommercialUsefulnessSummary {
  version: typeof COMMERCIAL_USEFULNESS_VERSION;
  reviews: CaseUsefulnessReview[];
  counts: {
    completed_cases: number;
    researched_candidates: number | null;   // null when not supplied → completion NOT_MEASURED
    customer_safe_cases: number;             // system-predicted safe
    positive_cases: number;                  // system-predicted Prioritize/Validate
    decision_useful_cases: number;           // positive + defensible Monitor/Hold
    human_reviewed_cases: number;
    human_confirmed_positive_cases: number;
    wrong_entity_cases: number;
    timing_claimed_cases: number;
    unsupported_timing_cases: number;
    evidence_sufficient_cases: number;
  };
  // Every rate is null when its denominator is 0 (NOT_MEASURED, never 0%). §50.
  rates: {
    case_completion_rate: number | null;
    customer_safe_case_rate: number | null;
    positive_case_rate: number | null;
    decision_useful_case_rate: number | null;
    human_confirmed_positive_rate: number | null;   // over human-reviewed only
    wrong_entity_rate: number | null;
    unsupported_timing_rate: number | null;          // over timing-claimed only
    evidence_sufficient_rate: number | null;
  };
  provenance: "controlled" | "live";
}

const rate = (n: number, d: number): number | null => (d > 0 ? n / d : null);

export function summarizeCommercialUsefulness(
  reviews: PositiveCommercialCaseReview[],
  options: { provenance?: "controlled" | "live"; researched_candidates?: number } = {},
): CommercialUsefulnessSummary {
  const classified = reviews.map(classify);
  const completed = classified.length;
  const humanReviewed = classified.filter((c) => c.human_reviewed).length;
  const timingClaimed = classified.filter((c) => c.timing_claimed).length;

  const counts = {
    completed_cases: completed,
    researched_candidates: options.researched_candidates ?? null,
    customer_safe_cases: classified.filter((c) => c.system_predicted_safe).length,
    positive_cases: classified.filter((c) => c.usefulness_class === "positive_case").length,
    decision_useful_cases: classified.filter((c) => c.usefulness_class !== "not_useful").length,
    human_reviewed_cases: humanReviewed,
    human_confirmed_positive_cases: classified.filter((c) => c.human_confirmed_positive).length,
    wrong_entity_cases: classified.filter((c) => !c.identity_valid).length,
    timing_claimed_cases: timingClaimed,
    unsupported_timing_cases: classified.filter((c) => c.timing_claimed && !c.timing_supported).length,
    evidence_sufficient_cases: classified.filter((c) => c.evidence_sufficient).length,
  };

  return {
    version: COMMERCIAL_USEFULNESS_VERSION,
    reviews: classified,
    counts,
    rates: {
      case_completion_rate: counts.researched_candidates !== null ? rate(completed, counts.researched_candidates) : null,
      customer_safe_case_rate: rate(counts.customer_safe_cases, completed),
      positive_case_rate: rate(counts.positive_cases, completed),
      decision_useful_case_rate: rate(counts.decision_useful_cases, completed),
      human_confirmed_positive_rate: rate(counts.human_confirmed_positive_cases, humanReviewed),
      wrong_entity_rate: rate(counts.wrong_entity_cases, completed),
      unsupported_timing_rate: rate(counts.unsupported_timing_cases, timingClaimed),
      evidence_sufficient_rate: rate(counts.evidence_sufficient_cases, completed),
    },
    provenance: options.provenance ?? "controlled",
  };
}
