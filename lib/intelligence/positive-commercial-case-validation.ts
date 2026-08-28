import type { DecisionState } from "@/lib/deliverable/deliverable-view-model";

export const POSITIVE_COMMERCIAL_CASE_VALIDATION_VERSION = "positive-commercial-case-validation-v1";

export type ReviewJudgment = "commercially_defensible" | "monitor" | "reject";

export interface PositiveCommercialCaseReview {
  case_id: string;
  account: string;
  decision: DecisionState;
  decision_source: "canonical_opportunity_test" | "fallback_conservative";
  identity_confirmed: boolean;
  target_organization_confirmed: boolean;
  commercial_context_confirmed: boolean;
  client_fit_confirmed: boolean;
  evidence_traceable: boolean;
  event_observed: boolean;
  event_date: string | null;
  timing_claimed: boolean;
  timing_grounded: boolean;
  counterevidence_explicit: boolean;
  weakening_factors_explicit: boolean;
  next_action_explicit: boolean;
  buying_intent_claimed: boolean;
  independent_review: {
    reviewer_id: string;
    reviewer_kind: "independent_technical_review";
    judgment: ReviewJudgment;
    rationale: string;
    reviewed_at: string;
  };
  human_confirmation: {
    state: "pending" | "confirmed" | "rejected";
    reviewer_id: string | null;
    reviewer_role: string | null;
    judgment: ReviewJudgment | null;
    rationale: string | null;
    reviewed_at: string | null;
    attestation: boolean;
  };
}

export interface CommercialCaseValidationResult {
  case_id: string;
  customer_safe_human_positive: boolean;
  blockers: string[];
}

/**
 * Validation-only authority. It does not synthesize or rank a Case. A model,
 * test or independent technical review can prepare a record, but only an
 * explicit human attestation can create a customer-safe human-positive Case.
 */
export function validatePositiveCommercialCase(review: PositiveCommercialCaseReview): CommercialCaseValidationResult {
  const blockers: string[] = [];
  if (!review.identity_confirmed) blockers.push("identity_not_confirmed");
  if (!review.target_organization_confirmed) blockers.push("target_organization_not_confirmed");
  if (!review.commercial_context_confirmed) blockers.push("commercial_context_not_confirmed");
  if (!review.client_fit_confirmed) blockers.push("client_fit_not_confirmed");
  if (!review.evidence_traceable) blockers.push("evidence_not_traceable");
  if (review.timing_claimed && (!review.event_observed || !review.event_date || !review.timing_grounded)) blockers.push("timing_not_grounded");
  if (!review.counterevidence_explicit) blockers.push("counterevidence_not_explicit");
  if (!review.weakening_factors_explicit) blockers.push("weakening_factors_not_explicit");
  if (!review.next_action_explicit) blockers.push("next_action_not_explicit");
  if (review.buying_intent_claimed) blockers.push("unsupported_buying_intent");
  if (review.decision_source !== "canonical_opportunity_test") blockers.push("noncanonical_decision_source");
  if (!(["prioritize", "validate"] as DecisionState[]).includes(review.decision)) blockers.push("decision_not_commercially_positive");
  if (review.independent_review.judgment !== "commercially_defensible") blockers.push("independent_review_not_positive");
  if (review.human_confirmation.state !== "confirmed" || !review.human_confirmation.attestation || !review.human_confirmation.reviewer_id?.trim()) blockers.push("human_confirmation_required");
  if (review.human_confirmation.judgment !== "commercially_defensible") blockers.push("human_judgment_not_positive");
  return { case_id: review.case_id, customer_safe_human_positive: blockers.length === 0, blockers };
}

export function summarizePositiveCommercialCases(reviews: PositiveCommercialCaseReview[]) {
  const results = reviews.map(validatePositiveCommercialCase);
  return {
    n: reviews.length,
    customer_safe_human_positive_cases: results.filter((result) => result.customer_safe_human_positive).length,
    pending_human_confirmation: results.filter((result) => result.blockers.includes("human_confirmation_required")).length,
    independently_defensible: reviews.filter((review) => review.independent_review.judgment === "commercially_defensible").length,
    monitor: reviews.filter((review) => review.independent_review.judgment === "monitor").length,
    reject: reviews.filter((review) => review.independent_review.judgment === "reject").length,
    results,
  };
}
