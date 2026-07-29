// LeadLens Intelligence OS Block 4 — pure validation and learning lifecycle.
// No I/O, no ranking mutation, no automatic customer publication.

import {
  unmeasured,
  type IntelligenceOutput,
  type IntelligenceScope,
  type MeasurementResult,
  type ValidationState,
} from "./os-contracts";

export const REVIEW_ACTIONS = [
  "approve", "correct", "reject", "request_more_evidence", "mark_not_relevant", "expire",
] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

export type EvidenceQualityJudgment = "sufficient" | "limited" | "insufficient" | "unknown";
export type CustomerSafetyJudgment = "internal_only" | "review_required" | "safe_with_limitations" | "safe";
export type ClientRelevanceState = "relevant" | "not_relevant" | "uncertain";
export type CommercialActionKind = "research" | "save" | "contact" | "response" | "meeting" | "proposal" | "other";
export type CommercialOutcomeKind = "progressed" | "terminal_positive" | "terminal_negative" | "no_outcome";
export type LearningImplicationType = "reinforce" | "correct" | "investigate" | "exception" | "no_learning";
export type OutputReportEligibility = "internal_only" | "review_required" | "customer_safe_with_limitations" | "customer_safe" | "expired";

export interface HumanReview {
  id: string;
  output_id: string;
  reviewer_id: string;
  reviewer_role: string;
  action: ReviewAction;
  resulting_state: ValidationState;
  original_statement: string;
  reviewed_statement: string;
  corrected_statement: string | null;
  correction_reason: string | null;
  confidence_adjustment: number | null;
  evidence_quality: EvidenceQualityJudgment;
  commercial_relevance_judgment: ClientRelevanceState;
  customer_safety: CustomerSafetyJudgment;
  notes: string | null;
  created_at: string;
  reviewed_at: string;
  methodology_version: string;
}

export interface ClientRelevanceAssessment {
  client_id: string;
  state: ClientRelevanceState;
  rationale: string;
  offer_fit: "yes" | "partial" | "no" | "unknown";
  geographic_fit: "yes" | "partial" | "no" | "unknown";
  strategic_fit: "yes" | "partial" | "no" | "unknown";
  constraints: string[];
  actionability: "actionable" | "not_actionable" | "not_yet_timely" | "unknown";
  confidence: number;
  assessed_at: string;
}

export interface CommercialAction {
  id: string;
  output_id: string;
  kind: CommercialActionKind;
  description: string;
  actor_id: string;
  occurred_at: string;
  evidence_refs: string[];
}

export interface AttributedCommercialOutcome {
  id: string;
  output_id: string;
  action_id: string;
  kind: CommercialOutcomeKind;
  observed_at: string;
  attribution_confidence: number;
  attribution_limitations: string[];
  evidence_refs: string[];
  note: string | null;
}

export interface LearningImplication {
  id: string;
  output_id: string;
  outcome_id: string;
  type: LearningImplicationType;
  statement: string;
  mode: "observation" | "shadow" | "human_reviewed";
  human_approved: boolean;
  ranking_impact: "off";
  affected_capability: string | null;
  affected_pattern: string | null;
  created_at: string;
}

export interface OutputValidationLifecycle {
  id: string;
  output_id: string;
  scope: IntelligenceScope;
  original_output: IntelligenceOutput;
  state: ValidationState;
  reviews: HumanReview[];
  relevance: ClientRelevanceAssessment | null;
  actions: CommercialAction[];
  outcomes: AttributedCommercialOutcome[];
  learning_implications: LearningImplication[];
  report_eligibility: OutputReportEligibility;
  created_at: string;
  updated_at: string;
}

export const VALID_TRANSITIONS: Readonly<Record<ValidationState, readonly ValidationState[]>> = {
  unreviewed: ["human_approved", "human_corrected", "client_rejected", "expired"],
  human_corrected: ["human_corrected", "human_approved", "client_rejected", "expired"],
  human_approved: ["human_corrected", "client_relevant", "client_rejected", "expired"],
  client_relevant: ["human_corrected", "client_rejected", "acted_upon", "expired"],
  client_rejected: [],
  acted_upon: ["confirmed", "partially_confirmed", "refuted", "no_outcome"],
  confirmed: [],
  partially_confirmed: [],
  refuted: [],
  no_outcome: ["acted_upon", "expired"],
  expired: [],
};

export function canTransition(from: ValidationState, to: ValidationState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function transitionValidation(from: ValidationState, to: ValidationState): ValidationState {
  if (!canTransition(from, to)) throw new Error(`invalid_validation_transition:${from}->${to}`);
  return to;
}

export function createLifecycle(output: IntelligenceOutput, now: string): OutputValidationLifecycle {
  return {
    id: `validation:${output.id}`,
    output_id: output.id,
    scope: output.scope,
    original_output: structuredClone(output),
    state: "unreviewed",
    reviews: [],
    relevance: null,
    actions: [],
    outcomes: [],
    learning_implications: [],
    report_eligibility: "internal_only",
    created_at: now,
    updated_at: now,
  };
}

function stateForReview(action: ReviewAction): ValidationState | null {
  if (action === "approve") return "human_approved";
  if (action === "correct") return "human_corrected";
  if (action === "reject" || action === "mark_not_relevant") return "client_rejected";
  if (action === "expire") return "expired";
  return null;
}

export function applyHumanReview(
  lifecycle: OutputValidationLifecycle,
  review: Omit<HumanReview, "output_id" | "original_statement" | "reviewed_statement" | "resulting_state">,
): OutputValidationLifecycle {
  if (!review.reviewer_id.trim()) throw new Error("reviewer_identity_required");
  const target = stateForReview(review.action);
  if (review.action === "request_more_evidence") {
    return { ...lifecycle, reviews: [...lifecycle.reviews, {
      ...review, output_id: lifecycle.output_id, original_statement: lifecycle.original_output.claim.statement,
      reviewed_statement: currentStatement(lifecycle), resulting_state: lifecycle.state,
    }], updated_at: review.reviewed_at, report_eligibility: "internal_only" };
  }
  if (!target) throw new Error("unsupported_review_action");
  if (review.action === "correct" && (!review.corrected_statement?.trim() || !review.correction_reason?.trim()))
    throw new Error("correction_requires_statement_and_reason");
  const next = transitionValidation(lifecycle.state, target);
  const row: HumanReview = {
    ...review,
    output_id: lifecycle.output_id,
    original_statement: lifecycle.original_output.claim.statement,
    reviewed_statement: review.corrected_statement?.trim() || currentStatement(lifecycle),
    resulting_state: next,
  };
  const result = { ...lifecycle, state: next, reviews: [...lifecycle.reviews, row], updated_at: review.reviewed_at };
  return { ...result, report_eligibility: deriveReportEligibility(result) };
}

export function currentStatement(lifecycle: OutputValidationLifecycle): string {
  return [...lifecycle.reviews].reverse().find((r) => r.corrected_statement)?.corrected_statement
    ?? lifecycle.original_output.claim.statement;
}

export function assessClientRelevance(
  lifecycle: OutputValidationLifecycle,
  assessment: ClientRelevanceAssessment,
): OutputValidationLifecycle {
  if (lifecycle.scope.kind === "client" && lifecycle.scope.client_id !== assessment.client_id)
    throw new Error("cross_client_relevance_forbidden");
  if (assessment.confidence < 0 || assessment.confidence > 1) throw new Error("invalid_relevance_confidence");
  const target: ValidationState = assessment.state === "relevant" ? "client_relevant" : assessment.state === "not_relevant" ? "client_rejected" : lifecycle.state;
  const next = target === lifecycle.state ? lifecycle.state : transitionValidation(lifecycle.state, target);
  const result = { ...lifecycle, state: next, relevance: structuredClone(assessment), updated_at: assessment.assessed_at };
  return { ...result, report_eligibility: deriveReportEligibility(result) };
}

export function recordCommercialAction(lifecycle: OutputValidationLifecycle, action: CommercialAction): OutputValidationLifecycle {
  if (action.output_id !== lifecycle.output_id) throw new Error("action_output_mismatch");
  if (lifecycle.actions.some((a) => a.id === action.id)) return lifecycle;
  const next = lifecycle.state === "acted_upon" ? "acted_upon" : transitionValidation(lifecycle.state, "acted_upon");
  const result = { ...lifecycle, state: next, actions: [...lifecycle.actions, structuredClone(action)], updated_at: action.occurred_at };
  return { ...result, report_eligibility: deriveReportEligibility(result) };
}

export function recordCommercialOutcome(
  lifecycle: OutputValidationLifecycle,
  outcome: AttributedCommercialOutcome,
): OutputValidationLifecycle {
  if (outcome.output_id !== lifecycle.output_id) throw new Error("outcome_output_mismatch");
  if (!lifecycle.actions.some((a) => a.id === outcome.action_id)) throw new Error("outcome_action_required");
  if (outcome.attribution_confidence < 0 || outcome.attribution_confidence > 1) throw new Error("invalid_attribution_confidence");
  if (outcome.attribution_limitations.length === 0) throw new Error("attribution_limitations_required");
  if (lifecycle.outcomes.some((o) => o.id === outcome.id)) return lifecycle;
  const state: ValidationState =
    outcome.kind === "terminal_positive" ? "confirmed"
      : outcome.kind === "terminal_negative" ? "refuted"
        : outcome.kind === "progressed" ? "partially_confirmed" : "no_outcome";
  const next = transitionValidation(lifecycle.state, state);
  const result = { ...lifecycle, state: next, outcomes: [...lifecycle.outcomes, structuredClone(outcome)], updated_at: outcome.observed_at };
  return { ...result, report_eligibility: deriveReportEligibility(result) };
}

export function addLearningImplication(
  lifecycle: OutputValidationLifecycle,
  implication: LearningImplication,
): OutputValidationLifecycle {
  if (implication.output_id !== lifecycle.output_id) throw new Error("implication_output_mismatch");
  if (!lifecycle.outcomes.some((o) => o.id === implication.outcome_id)) throw new Error("implication_outcome_required");
  if (implication.ranking_impact !== "off") throw new Error("learning_ranking_impact_forbidden");
  if (implication.mode === "human_reviewed" && !implication.human_approved) throw new Error("human_reviewed_requires_approval");
  if (lifecycle.learning_implications.some((i) => i.id === implication.id)) return lifecycle;
  return { ...lifecycle, learning_implications: [...lifecycle.learning_implications, structuredClone(implication)], updated_at: implication.created_at };
}

export function deriveReportEligibility(lifecycle: OutputValidationLifecycle): OutputReportEligibility {
  if (lifecycle.state === "expired") return "expired";
  const latest = lifecycle.reviews.at(-1);
  if (!latest || lifecycle.state === "unreviewed" || lifecycle.state === "human_corrected") return "internal_only";
  if (lifecycle.state === "client_rejected" || lifecycle.relevance?.state === "not_relevant") return "internal_only";
  if (!lifecycle.relevance || lifecycle.relevance.state !== "relevant") return "review_required";
  if (latest.evidence_quality === "insufficient" || latest.customer_safety === "internal_only") return "internal_only";
  if (latest.customer_safety === "review_required") return "review_required";
  if (latest.customer_safety === "safe_with_limitations" || latest.evidence_quality === "limited") return "customer_safe_with_limitations";
  return latest.customer_safety === "safe" && latest.evidence_quality === "sufficient" ? "customer_safe" : "review_required";
}

export interface ValidationLearningSummary {
  output_count: number;
  reviewed_count: number;
  corrected_count: number;
  client_relevant_count: number;
  client_rejected_count: number;
  acted_upon_count: number;
  confirmed_count: number;
  partially_confirmed_count: number;
  refuted_count: number;
  no_outcome_count: number;
  expired_count: number;
  validation_coverage: MeasurementResult;
  outcome_coverage: MeasurementResult;
  implications_by_type: Partial<Record<LearningImplicationType, number>>;
  most_common_state: ValidationState | null;
  lifecycle_bottleneck: string | null;
}

export function summarizeValidationLearning(outputs: IntelligenceOutput[], lifecycles: OutputValidationLifecycle[]): ValidationLearningSummary {
  const linked = lifecycles.filter((v) => outputs.some((o) => o.id === v.output_id));
  const countState = (s: ValidationState) => linked.filter((v) => v.state === s).length;
  const reviewed = linked.filter((v) => v.reviews.length > 0).length;
  const acted = linked.filter((v) => v.actions.length > 0).length;
  const withOutcome = linked.filter((v) => v.outcomes.some((o) => o.kind !== "no_outcome")).length;
  const states = linked.reduce<Partial<Record<ValidationState, number>>>((a, v) => ({ ...a, [v.state]: (a[v.state] ?? 0) + 1 }), {});
  const mostCommon = Object.entries(states).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] as ValidationState | undefined;
  const implications = linked.flatMap((v) => v.learning_implications).reduce<Partial<Record<LearningImplicationType, number>>>((a, v) => ({ ...a, [v.type]: (a[v.type] ?? 0) + 1 }), {});
  return {
    output_count: outputs.length, reviewed_count: reviewed,
    corrected_count: linked.filter((v) => v.reviews.some((r) => r.action === "correct")).length,
    client_relevant_count: linked.filter((v) => v.relevance?.state === "relevant").length,
    client_rejected_count: linked.filter((v) => v.relevance?.state === "not_relevant").length,
    acted_upon_count: acted, confirmed_count: countState("confirmed"),
    partially_confirmed_count: countState("partially_confirmed"), refuted_count: countState("refuted"),
    no_outcome_count: countState("no_outcome"), expired_count: countState("expired"),
    validation_coverage: outputs.length === 0 ? unmeasured("no_observations", "no outputs to validate") : reviewed === 0 ? unmeasured("not_measured", "no outputs reviewed", 0) : { state: "measured", score: Math.round(reviewed / outputs.length * 100), confidence: Math.min(1, outputs.length / 20), sample_size: outputs.length },
    outcome_coverage: acted === 0 ? unmeasured("not_measured", "no commercial actions recorded") : withOutcome === 0 ? unmeasured("insufficient_evidence", "actions exist but no attributable outcomes", acted) : { state: "measured", score: Math.round(withOutcome / acted * 100), confidence: Math.min(1, acted / 20), sample_size: acted },
    implications_by_type: implications, most_common_state: mostCommon ?? null,
    lifecycle_bottleneck: outputs.length === 0 ? "no_outputs" : reviewed === 0 ? "human_review" : linked.filter((v) => v.relevance?.state === "relevant").length === 0 ? "client_relevance" : acted === 0 ? "commercial_action" : withOutcome === 0 ? "commercial_outcome" : null,
  };
}

export interface LegacyFeedbackRow { id: string; output_id?: string | null; feedback_signal: string; commercial_outcome?: string | null }
export function partitionLegacyFeedback(rows: LegacyFeedbackRow[], knownOutputIds: Set<string>): { linked: LegacyFeedbackRow[]; unlinked: LegacyFeedbackRow[] } {
  const linked: LegacyFeedbackRow[] = [], unlinked: LegacyFeedbackRow[] = [];
  for (const row of rows) (row.output_id && knownOutputIds.has(row.output_id) ? linked : unlinked).push(row);
  return { linked, unlinked };
}
