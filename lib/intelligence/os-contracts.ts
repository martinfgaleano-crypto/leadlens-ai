// ─── LeadLens Intelligence OS — canonical domain contracts (os-contracts-v1) ──
// Reusable, tenant-aware, vertical-agnostic types + runtime honesty guards for
// the Intelligence Operating System. NO UI, NO persistence, NO ranking impact.
//
// Design law: the type system and the guards below must make dishonest states
// unrepresentable OR explicitly detectable —
//   · a score cannot exist unless measurement state is "measured";
//   · a recommendation is not structurally interchangeable with a fact;
//   · production maturity cannot be claimed from schema existence or passing
//     tests alone; shadow ≠ production; generation ≠ validation;
//   · a pattern below the sample floor cannot be promoted;
//   · Outcome Performance is not_measured without outcomes; Intelligence Lift is
//     not_measured without a baseline; premium readiness is invalid with an
//     unresolved critical blocker.
// Reuses FeedbackDimension / CommercialOutcomeValue from the feedback taxonomy.

import type { FeedbackDimension } from "./feedback-taxonomy";

export const OS_CONTRACTS_VERSION = "os-contracts-v1";

// ── 1. Measurement state ─────────────────────────────────────────────────────
export const MEASUREMENT_STATES = [
  "measured", "not_measured", "insufficient_evidence", "not_instrumented",
  "no_observations", "blocked", "shadow_only", "frozen", "expired",
] as const;
export type IntelligenceMeasurementState = (typeof MEASUREMENT_STATES)[number];

// ── 2. Maturity level (ordered) ──────────────────────────────────────────────
export const MATURITY_LEVELS = [
  "retrieval", "structured_knowledge", "analytical_intelligence",
  "strategic_intelligence", "adaptive_intelligence",
] as const;
export type IntelligenceMaturityLevel = (typeof MATURITY_LEVELS)[number];
export const maturityRank = (l: IntelligenceMaturityLevel): number => MATURITY_LEVELS.indexOf(l);

// ── Operational mode ─────────────────────────────────────────────────────────
export const OPERATIONAL_MODES = [
  "inactive", "foundation", "observation", "shadow", "human_reviewed",
  "production", "frozen", "revoked", "not_measured",
] as const;
export type OperationalMode = (typeof OPERATIONAL_MODES)[number];
/** Modes that must never be treated as production-grade. */
export const NON_PRODUCTION_MODES: OperationalMode[] = ["inactive", "foundation", "observation", "shadow", "not_measured", "revoked"];

// ── Scope (tenant / client / global always explicit) ─────────────────────────
export type IntelligenceScope =
  | { kind: "global" }
  | { kind: "tenant"; tenant_id: string }
  | { kind: "client"; tenant_id: string; client_id: string };
export const isTenantScoped = (s: IntelligenceScope): boolean => s.kind !== "global";

export type ReviewState = "unreviewed" | "human_reviewed" | "human_corrected" | "rejected";

// ── Measurement result: score EXISTS ONLY when state === "measured" ───────────
// Enforced at the type level (score?: never on the unmeasured branch) and at
// runtime by validateMeasurement.
export interface MeasuredValue {
  state: "measured";
  score: number;            // supported by data only
  confidence: number;       // 0–1
  sample_size: number;      // > 0 required
}
export interface UnmeasuredValue {
  state: Exclude<IntelligenceMeasurementState, "measured">;
  reason: string;
  sample_size?: number;
  score?: never;            // a score is structurally impossible here
  confidence?: never;
}
export type MeasurementResult = MeasuredValue | UnmeasuredValue;

export const measured = (score: number, confidence: number, sample_size: number): MeasuredValue =>
  ({ state: "measured", score, confidence, sample_size });
export const unmeasured = (state: UnmeasuredValue["state"], reason: string, sample_size?: number): UnmeasuredValue =>
  ({ state, reason, ...(sample_size !== undefined ? { sample_size } : {}) });

export const isMeasured = (m: MeasurementResult): m is MeasuredValue => m.state === "measured";

// ── 7. Evidence reference (typed provenance) ─────────────────────────────────
export const EVIDENCE_KINDS = [
  "fact", "signal", "artifact", "feedback", "source", "human_review",
  "outcome", "exercised_run", "replay_consistency", "schema_exists", "unit_test_passing",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
/** Evidence kinds that, ALONE, can never justify production maturity. */
export const NON_OPERATIONAL_EVIDENCE: EvidenceKind[] = ["schema_exists", "unit_test_passing"];

export interface IntelligenceEvidenceReference {
  id: string;
  kind: EvidenceKind;
  ref: string;                       // artifact path, table:id, run id, url key…
  source_class?: string | null;
  dated?: boolean;
  date?: string | null;
  corroborated?: boolean;
  freshness_bucket?: "fresh" | "recent" | "stale" | null;
}

// ── Semantic separation: fact / signal / inference / hypothesis / recommendation
//    / validated_conclusion. Discriminated by `kind` — a recommendation object
//    can never satisfy the fact shape. ──────────────────────────────────────
interface ClaimBase { id: string; statement: string; evidence: IntelligenceEvidenceReference[]; }
export type IntelligenceClaim =
  | (ClaimBase & { kind: "fact"; corroborated: boolean })
  | (ClaimBase & { kind: "signal"; observed_at: string | null })
  | (ClaimBase & { kind: "inference"; basis: IntelligenceEvidenceReference[]; confidence: number })
  | (ClaimBase & { kind: "hypothesis"; testable: boolean; confidence: number })
  | (ClaimBase & { kind: "recommendation"; action: string; rationale: string; requires_validation: true })
  | (ClaimBase & { kind: "validated_conclusion"; validation_ref: string; confidence: number });
export const CLAIM_KINDS = ["fact", "signal", "inference", "hypothesis", "recommendation", "validated_conclusion"] as const;
export const isFact = (c: IntelligenceClaim): boolean => c.kind === "fact";
export const isRecommendation = (c: IntelligenceClaim): boolean => c.kind === "recommendation";

// ── 3. Capability ────────────────────────────────────────────────────────────
export interface IntelligenceCapability {
  id: string;
  display_name: string;
  description: string;
  intended_value: string;
  dependencies: string[];
}

// ── 4. Capability assessment ─────────────────────────────────────────────────
export type ImpactLevel = "none" | "low" | "medium" | "high";
export interface IntelligenceCapabilityAssessment {
  capability_id: string;
  capability_version: string;
  scope: IntelligenceScope;
  methodology_version: string;
  mode: OperationalMode;
  maturity_level: IntelligenceMaturityLevel | null;
  maturity_confidence: number | null;
  measurement_state: IntelligenceMeasurementState;
  evidence: IntelligenceEvidenceReference[];
  sample_size: number;
  last_exercised: string | null;
  success_metric: string;
  success_rate: MeasurementResult;
  known_failure_modes: string[];
  limitations: string[];
  blocked_reason: string | null;
  ranking_impact: ImpactLevel;
  report_impact: ImpactLevel;
  next_milestone: string | null;
  promotion_criteria: string[];
  human_review_state: ReviewState;
  assessed_at: string;
  source_data_cutoff: string;
}

// ── 5. Maturity dimension (the 8 index dimensions) ───────────────────────────
export const MATURITY_DIMENSIONS = [
  "analytical_depth", "differentiation", "evidence_integrity", "commercial_relevance",
  "client_specificity", "temporal_intelligence", "learning_maturity", "outcome_performance",
] as const;
export type MaturityDimensionId = (typeof MATURITY_DIMENSIONS)[number];

export interface IntelligenceMaturityDimension {
  id: MaturityDimensionId;
  measurement: MeasurementResult;
  methodology_version: string;
  evidence: IntelligenceEvidenceReference[];
  limitations: string[];
  trend: "up" | "down" | "flat" | "not_instrumented";
  next_improvement: string | null;
  assessed_at: string;
  source_data_cutoff: string;
  valid_until?: string | null;
}

// ── 6. Maturity index ────────────────────────────────────────────────────────
export interface IntelligenceMaturityIndex {
  version: string;
  methodology_version: string;
  scope: IntelligenceScope;
  overall: MeasurementResult;
  level: IntelligenceMaturityLevel | null;
  level_confidence: number | null;
  dimensions: IntelligenceMaturityDimension[];
  weights: Partial<Record<MaturityDimensionId, number>>;
  anti_inflation_notes: string[];
  calculated_at: string;
  source_data_cutoff: string;
}

// ── Intelligence Lift ────────────────────────────────────────────────────────
export const BASELINE_TYPES = [
  "raw_provider", "keyword_search", "generic_search_summary", "generic_llm",
  "leadlens_knowledge", "leadlens_intelligence",
] as const;
export type BaselineType = (typeof BASELINE_TYPES)[number];
export interface IntelligenceLiftAssessment {
  baseline_type: BaselineType | null;
  measurement: MeasurementResult;
  methodology_version: string;
  limitations: string[];
  assessed_at: string;
}

// ── 8. Intelligence output ───────────────────────────────────────────────────
export const OUTPUT_TYPES = [
  "cross_account_pattern", "cross_segment_pattern", "cross_market_pattern", "market_pattern",
  "segment_insight", "market_shift", "anomaly", "non_obvious_opportunity", "false_positive_avoidance",
  "account_prioritization_insight", "timing_interpretation", "counterevidence_finding",
  "strategic_hypothesis", "client_specific_recommendation", "portfolio_recommendation",
  "risk_finding", "learning_from_outcome",
] as const;
export type IntelligenceOutputType = (typeof OUTPUT_TYPES)[number];

export const VALIDATION_STATES = [
  "unreviewed", "human_approved", "human_corrected", "client_relevant", "client_rejected",
  "acted_upon", "confirmed", "partially_confirmed", "refuted", "no_outcome", "expired",
] as const;
export type ValidationState = (typeof VALIDATION_STATES)[number];
/** States that count as genuinely validated (never true on generation alone). */
export const VALIDATED_STATES: ValidationState[] = ["confirmed", "partially_confirmed"];

export interface IntelligenceOutput {
  id: string;
  scope: IntelligenceScope;
  type: IntelligenceOutputType;
  claim: IntelligenceClaim;
  summary: string;
  affected_market: string | null;
  affected_segments: string[];
  affected_accounts: string[];
  client_id: string | null;
  reasoning_summary: string;
  supporting_facts: IntelligenceClaim[];
  supporting_signals: IntelligenceClaim[];
  supporting_evidence: IntelligenceEvidenceReference[];
  counterevidence: IntelligenceEvidenceReference[];
  alternative_explanations: string[];
  unresolved_questions: string[];
  confidence: number;
  confidence_method: string;
  novelty: MeasurementResult;
  actionability: MeasurementResult;
  commercial_relevance: MeasurementResult;
  validation_state: ValidationState;
  human_review_state: ReviewState;
  outcome_state: "none" | "progressed" | "terminal_positive" | "terminal_negative";
  ranking_impact: ImpactLevel;
  report_eligibility: "eligible" | "not_eligible" | "not_assessed";
  capability_versions: string[];
  model_version?: string | null;
  rule_version?: string | null;
  methodology_version: string;
  created_at: string;
  valid_from: string;
  valid_until: string | null;
  last_reviewed: string | null;
}

// ── 9. Pattern ───────────────────────────────────────────────────────────────
export const PATTERN_STATES = [
  "candidate", "insufficient_sample", "observation", "shadow", "human_approved",
  "production", "rejected", "expired", "frozen",
] as const;
export type PatternState = (typeof PATTERN_STATES)[number];
/** Minimum distinct observations before a pattern may leave insufficient_sample. */
export const MIN_PATTERN_SAMPLE = 5;
/** Pattern states that assert real credibility — gated by MIN_PATTERN_SAMPLE. */
export const PROMOTED_PATTERN_STATES: PatternState[] = ["human_approved", "production"];

export const PATTERN_TYPES = [
  "cross_account", "cross_segment", "cross_market", "source_quality", "rejection", "timing",
  "buying_path", "evidence", "conversion", "false_positive", "client_specific",
  "vertical_specific", "outcome", "portfolio",
] as const;
export type PatternType = (typeof PATTERN_TYPES)[number];

export interface IntelligencePattern {
  id: string;
  scope: IntelligenceScope;
  type: PatternType;
  statement: string;
  explanation: string;
  sample_size: number;
  state: PatternState;
  confidence: MeasurementResult;
  evidence: IntelligenceEvidenceReference[];
  counterexamples: string[];
  exceptions: string[];
  alternative_explanations: string[];
  commercial_meaning: string;
  recommended_response: string;
  ranking_impact: "off";           // observation/shadow patterns never affect ranking
  report_impact: "off";            // Block 3 patterns are never customer-facing automatically
  mode: OperationalMode;
  markets: string[];
  segments: string[];
  accounts: string[];
  time_range: { from: string | null; to: string | null };
  basis: string;
  created_at: string;
  last_observed: string | null;
  review_by: string | null;
  version: string;
}

// ── 11. Outcome (aligned to migration 039) ───────────────────────────────────
export interface IntelligenceOutcome {
  id: string;
  kind: "progressed" | "terminal_positive" | "terminal_negative" | "no_outcome";
  dimension: FeedbackDimension;
  observed_at: string | null;
  evidence: IntelligenceEvidenceReference[];
  note?: string | null;
}

// ── 10. Validation ───────────────────────────────────────────────────────────
export interface IntelligenceValidation {
  id: string;
  output_id: string;
  scope: IntelligenceScope;
  original_statement: string;
  reviewer: string | null;
  review_decision: ValidationState;
  correction: string | null;
  correction_reason: string | null;
  client_relevance: "relevant" | "rejected" | "unknown";
  action_taken: string | null;
  action_date: string | null;
  response: string | null;
  meeting: boolean;
  proposal: boolean;
  outcome: IntelligenceOutcome | null;
  learning_implication: string | null;
  affected_capability: string | null;
  affected_pattern: string | null;
  should_update_model: boolean;
  report_eligible: boolean;
  created_at: string;
}

// ── 12. Gap ──────────────────────────────────────────────────────────────────
export type GapCategory = "knowledge" | "evidence" | "reasoning" | "learning" | "capability";
export type GapSeverity = "critical" | "high" | "medium" | "low";
export const GAP_STATES = ["open", "accepted", "in_progress", "blocked", "resolved", "dismissed", "recurring"] as const;
export type GapStatus = (typeof GAP_STATES)[number];

export interface IntelligenceGap {
  id: string;
  type: string;                    // e.g. missing_official_domain, no_dated_evidence…
  category: GapCategory;
  severity: GapSeverity;
  priority: number;
  scope: IntelligenceScope;
  affected_capability: string | null;
  affected_outputs: string[];
  affected_scope: string | null;
  report_readiness_impact: ImpactLevel;
  impact: string;
  evidence: IntelligenceEvidenceReference[];
  recommended_action: string;
  owner_type: "engineering" | "research" | "human_review" | "commercial" | "unassigned";
  dependency: string | null;
  expected_lift: MeasurementResult;
  effort: "xs" | "s" | "m" | "l" | "xl";
  confidence: number;
  status: GapStatus;
  created_at: string;
  resolved_at: string | null;
  resolution_evidence: IntelligenceEvidenceReference[];
}

// ── 13. Next best action ─────────────────────────────────────────────────────
export const ACTION_TYPES = [
  "resolve_identities", "verify_domains", "corroborate_evidence", "recover_dates",
  "search_counterevidence", "investigate_buying_structure", "expand_market_sample",
  "compare_segments", "add_client_context", "request_human_review", "collect_client_feedback",
  "observe_commercial_outcome", "implement_missing_capability", "instrument_capability",
  "recalibrate_score", "freeze_unreliable_capability", "promote_shadow_capability",
  "run_baseline_evaluation", "create_vertical_taxonomy", "add_account_memory", "improve_anti_repetition",
] as const;
export type IntelligenceActionType = (typeof ACTION_TYPES)[number];

export interface NextBestIntelligenceAction {
  id: string;
  action_type: IntelligenceActionType;
  rationale: string;
  evidence: IntelligenceEvidenceReference[];
  affected_dimensions: MaturityDimensionId[];
  affected_capabilities: string[];
  affected_gaps: string[];
  expected_lift: MeasurementResult;
  effort: "xs" | "s" | "m" | "l" | "xl";
  dependency: string | null;
  confidence: number;
  priority: number;
  success_metric: string;
  owner: "engineering" | "research" | "human_review" | "commercial" | "unassigned";
  status: GapStatus;
  created_at: string;
  due: string | null;
}

// ── 14. Report readiness ─────────────────────────────────────────────────────
export const READINESS_LEVELS = [
  "not_ready", "snapshot_ready", "brief_ready", "intelligence_report_ready", "premium_report_ready",
] as const;
export type ReadinessLevel = (typeof READINESS_LEVELS)[number];

export interface ReadinessBlocker { gap_id: string | null; severity: GapSeverity; description: string; resolved: boolean; }

export interface ReportReadinessAssessment {
  scope: IntelligenceScope;
  readiness_level: ReadinessLevel;
  confidence: number;
  reason: string;
  blockers: ReadinessBlocker[];
  customer_safe_outputs: string[];
  unsafe_outputs: string[];
  capabilities_available: string[];
  missing_capabilities: string[];
  recommended_next_action: string | null;
  supportable_sections: string[];
  superficial_sections: string[];
  methodology_version: string;
  assessed_at: string;
  source_data_cutoff: string;
}

// ── 16. System diagnosis ─────────────────────────────────────────────────────
export interface IntelligenceSystemDiagnosis {
  headline: string;
  maturity_level: IntelligenceMaturityLevel | null;
  strongest_capability: string | null;
  weakest_capability: string | null;
  top_bottleneck: string | null;
  highest_leverage_action: string | null;
  report_readiness_summary: string;
  statements: string[];
  generated_from: "rules";
}

// ── 15. Snapshot ─────────────────────────────────────────────────────────────
export interface IntelligenceSnapshot {
  id: string;
  scope: IntelligenceScope;
  methodology_version: string;
  calculated_at: string;
  source_data_cutoff: string;
  index: IntelligenceMaturityIndex;
  capability_assessments: IntelligenceCapabilityAssessment[];
  outputs: IntelligenceOutput[];
  patterns: IntelligencePattern[];
  registry_summary: IntelligenceRegistrySummary;
  validations: IntelligenceValidation[];
  validation_summary: IntelligenceValidationSummary;
  learning_implications: IntelligenceLearningImplicationProjection[];
  gaps: IntelligenceGap[];
  actions: NextBestIntelligenceAction[];
  readiness: ReportReadinessAssessment;
  lift: IntelligenceLiftAssessment;
  diagnosis: IntelligenceSystemDiagnosis;
  previous_snapshot_id: string | null;
}

export interface IntelligenceValidationSummary {
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
  implications_by_type: Partial<Record<"reinforce" | "correct" | "investigate" | "exception" | "no_learning", number>>;
  most_common_state: ValidationState | null;
  lifecycle_bottleneck: string | null;
}

export interface IntelligenceLearningImplicationProjection {
  id: string;
  output_id: string;
  outcome_id: string;
  type: "reinforce" | "correct" | "investigate" | "exception" | "no_learning";
  statement: string;
  mode: "observation" | "shadow" | "human_reviewed";
  human_approved: boolean;
  ranking_impact: "off";
  affected_capability: string | null;
  affected_pattern: string | null;
  created_at: string;
}

export interface IntelligenceRegistrySummary {
  output_count: number;
  outputs_by_type: Partial<Record<IntelligenceOutputType, number>>;
  outputs_by_validation_state: Partial<Record<ValidationState, number>>;
  outputs_by_report_eligibility: Partial<Record<IntelligenceOutput["report_eligibility"], number>>;
  pattern_count: number;
  patterns_by_state: Partial<Record<PatternState, number>>;
  strongest_supported_output_id: string | null;
  primary_pattern_limitation: string | null;
}

// ═══ Honesty guards (runtime-detectable invariants) ══════════════════════════

export interface Violation { code: string; message: string; }

/** score exists iff state === "measured"; measured requires sample_size > 0. */
export function validateMeasurement(m: MeasurementResult): Violation[] {
  const v: Violation[] = [];
  if (m.state === "measured") {
    if (typeof m.score !== "number" || Number.isNaN(m.score)) v.push({ code: "measured_without_score", message: "measured result must carry a numeric score" });
    if (!(m.sample_size > 0)) v.push({ code: "measured_without_sample", message: "measured result must have sample_size > 0" });
  } else if ((m as { score?: unknown }).score !== undefined) {
    v.push({ code: "score_without_measurement", message: `score present but state is ${m.state}` });
  }
  return v;
}

/** Production maturity requires operational evidence — never schema/tests alone,
 *  never a non-production mode, never zero sample. */
export function assessProductionEligibility(a: Pick<IntelligenceCapabilityAssessment, "mode" | "evidence" | "sample_size" | "success_rate">): { eligible: boolean; violations: Violation[] } {
  const violations: Violation[] = [];
  const operational = a.evidence.filter((e) => !NON_OPERATIONAL_EVIDENCE.includes(e.kind));
  if (operational.length === 0) violations.push({ code: "no_operational_evidence", message: "only schema/test evidence — cannot be production" });
  if (!(a.sample_size > 0)) violations.push({ code: "no_sample", message: "production maturity needs a real sample" });
  if (!isMeasured(a.success_rate)) violations.push({ code: "unmeasured_success", message: "production maturity needs a measured success rate" });
  return { eligible: violations.length === 0, violations };
}

/** A capability may only be in `production` mode when production-eligible. */
export function validateCapabilityAssessment(a: IntelligenceCapabilityAssessment): Violation[] {
  const v: Violation[] = [...validateMeasurement(a.success_rate)];
  if (a.mode === "production") {
    const { eligible, violations } = assessProductionEligibility(a);
    if (!eligible) v.push({ code: "shadow_marked_production", message: "capability claims production without operational evidence/sample/success" }, ...violations);
  }
  if (a.maturity_level && maturityRank(a.maturity_level) >= maturityRank("analytical_intelligence") && a.evidence.every((e) => NON_OPERATIONAL_EVIDENCE.includes(e.kind))) {
    v.push({ code: "maturity_from_schema_or_tests", message: "analytical+ maturity claimed from schema/tests only" });
  }
  return v;
}

/** True only for genuinely validated outputs — never on generation alone. */
export function isValidated(o: Pick<IntelligenceOutput, "validation_state">): boolean {
  return VALIDATED_STATES.includes(o.validation_state);
}

/** A freshly generated output must not present itself as validated. */
export function validateOutputHonesty(o: IntelligenceOutput): Violation[] {
  const v: Violation[] = [];
  if (o.claim.kind === "fact" && o.claim.evidence.length === 0) {
    v.push({ code: "fact_without_evidence", message: "fact requires direct evidence" });
  }
  if (o.claim.kind === "validated_conclusion" && (!o.claim.validation_ref || !isValidated(o))) {
    v.push({ code: "validated_conclusion_without_validation", message: "validated conclusion requires an actual validation state and reference" });
  }
  if (o.supporting_facts.some((c) => c.kind !== "fact") || o.supporting_signals.some((c) => c.kind !== "signal")) {
    v.push({ code: "claim_kind_collapsed", message: "supporting facts/signals must preserve their semantic kinds" });
  }
  if (o.type === "timing_interpretation" && !o.supporting_evidence.some((e) => e.dated && (e.kind === "signal" || e.kind === "fact"))) {
    v.push({ code: "timing_without_dated_evidence", message: "timing interpretation requires dated fact/signal evidence" });
  }
  if (o.report_eligibility === "eligible" && o.human_review_state === "unreviewed") {
    v.push({ code: "unreviewed_output_eligible", message: "unreviewed output cannot be customer-facing" });
  }
  if (o.claim.kind === "recommendation" && o.report_eligibility === "eligible" && !isValidated(o)) {
    v.push({ code: "unvalidated_recommendation_eligible", message: "recommendation marked report-eligible without validation" });
  }
  if (isValidated(o) && o.human_review_state === "unreviewed" && o.outcome_state === "none") {
    v.push({ code: "validated_without_evidence", message: "validated state without review or outcome evidence" });
  }
  return v;
}

/** Enforce the sample floor: promoted states require MIN_PATTERN_SAMPLE. */
export function normalizePatternState(p: Pick<IntelligencePattern, "state" | "sample_size">): PatternState {
  if (PROMOTED_PATTERN_STATES.includes(p.state) && p.sample_size < MIN_PATTERN_SAMPLE) return "insufficient_sample";
  return p.state;
}

export const MIN_OUTCOME_PERFORMANCE_SAMPLE = 5;
/** Outcome Performance stays unmeasured below the minimum real-outcome sample. */
export function deriveOutcomePerformance(outcomes: IntelligenceOutcome[], methodology_version: string, now: string, cutoff: string): IntelligenceMaturityDimension {
  const real = outcomes.filter((o) => o.kind !== "no_outcome");
  const base = { id: "outcome_performance" as const, methodology_version, evidence: [] as IntelligenceEvidenceReference[], limitations: [] as string[], trend: "not_instrumented" as const, next_improvement: "Observe commercial outcomes on delivered recommendations.", assessed_at: now, source_data_cutoff: cutoff };
  if (real.length === 0) return { ...base, measurement: unmeasured("not_measured", "no commercial outcomes recorded") };
  if (real.length < MIN_OUTCOME_PERFORMANCE_SAMPLE) return {
    ...base,
    measurement: unmeasured("insufficient_evidence", `need at least ${MIN_OUTCOME_PERFORMANCE_SAMPLE} attributable outcomes`, real.length),
    limitations: [`only ${real.length} attributable outcome(s); minimum is ${MIN_OUTCOME_PERFORMANCE_SAMPLE}`],
  };
  const wins = real.filter((o) => o.kind === "terminal_positive").length;
  return { ...base, measurement: measured(Math.round((wins / real.length) * 100), Math.min(1, real.length / 20), real.length), trend: "flat" };
}

/** Intelligence Lift: not_measured without a real baseline. */
export function deriveIntelligenceLift(baseline: BaselineType | null, methodology_version: string, now: string): IntelligenceLiftAssessment {
  if (!baseline) return { baseline_type: null, measurement: unmeasured("not_measured", "no baseline evaluation has been run"), methodology_version, limitations: ["no baseline comparison exists"], assessed_at: now };
  return { baseline_type: baseline, measurement: unmeasured("insufficient_evidence", "baseline set but no scored comparison yet"), methodology_version, limitations: [], assessed_at: now };
}

/** Readiness cannot be premium with an unresolved critical blocker. */
export function validateReadiness(r: ReportReadinessAssessment): Violation[] {
  const v: Violation[] = [];
  const criticalOpen = r.blockers.some((b) => b.severity === "critical" && !b.resolved);
  if (r.readiness_level === "premium_report_ready" && criticalOpen) {
    v.push({ code: "premium_with_critical_blocker", message: "premium readiness asserted with an unresolved critical blocker" });
  }
  if ((r.readiness_level === "intelligence_report_ready" || r.readiness_level === "premium_report_ready") && r.customer_safe_outputs.length === 0) {
    v.push({ code: "report_ready_without_safe_outputs", message: "report-ready with zero customer-safe outputs" });
  }
  return v;
}

/** Deterministic serialization: recursively key-sorted JSON (stable across
 *  key insertion order) for snapshot replay/idempotency comparisons. */
export function serializeIntelligence(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === "object") {
      return Object.keys(v as Record<string, unknown>).sort().reduce((acc, k) => {
        acc[k] = sort((v as Record<string, unknown>)[k]);
        return acc;
      }, {} as Record<string, unknown>);
    }
    return v;
  };
  return JSON.stringify(sort(value));
}
