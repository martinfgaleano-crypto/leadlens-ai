// Unit tests: Intelligence OS domain contracts (os-contracts-v1).
// Covers the 15 required Block-1 invariants: required fields, honest unmeasured
// states, no-score-when-unmeasured, and the anti-inflation guards.
import {
  measured, unmeasured, isMeasured, validateMeasurement,
  assessProductionEligibility, validateCapabilityAssessment,
  isFact, isRecommendation, isValidated, validateOutputHonesty,
  normalizePatternState, deriveOutcomePerformance, deriveIntelligenceLift,
  validateReadiness, serializeIntelligence, maturityRank,
  type IntelligenceCapabilityAssessment, type IntelligenceClaim, type IntelligenceOutput,
  type IntelligenceOutcome, type ReportReadinessAssessment, type IntelligenceScope,
} from "@/lib/intelligence/os-contracts";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

const NOW = "2026-07-27T00:00:00.000Z", CUT = "2026-07-26T00:00:00.000Z", MV = "os-test-v1";

// 1. Required fields — a measured value carries score+confidence+sample_size.
const m = measured(72, 0.6, 30);
t("1 required fields on measured value", isMeasured(m) && m.score === 72 && m.sample_size === 30);

// 2. Explicit unmeasured states.
const um = unmeasured("not_measured", "no data");
t("2 explicit unmeasured state", um.state === "not_measured" && um.reason === "no data");

// 3. No score when not measured (runtime guard catches a smuggled score).
const smuggled = { state: "insufficient_evidence", reason: "x", score: 5 } as unknown as ReturnType<typeof unmeasured>;
t("3 no score when not measured", validateMeasurement(smuggled).some((v) => v.code === "score_without_measurement"));
t("3b measured without sample is a violation", validateMeasurement({ state: "measured", score: 1, confidence: 1, sample_size: 0 }).some((v) => v.code === "measured_without_sample"));

const baseAssessment = (over: Partial<IntelligenceCapabilityAssessment> = {}): IntelligenceCapabilityAssessment => ({
  capability_id: "entity_resolution", capability_version: "entity-resolution-v3",
  scope: { kind: "global" }, methodology_version: MV, mode: "production",
  maturity_level: "analytical_intelligence", maturity_confidence: 0.5, measurement_state: "measured",
  evidence: [{ id: "e1", kind: "exercised_run", ref: "run:1" }], sample_size: 12,
  last_exercised: NOW, success_metric: "domain match rate", success_rate: measured(80, 0.5, 12),
  known_failure_modes: [], limitations: [], blocked_reason: null, ranking_impact: "medium",
  report_impact: "medium", next_milestone: null, promotion_criteria: [], human_review_state: "unreviewed",
  assessed_at: NOW, source_data_cutoff: CUT, ...over,
});

// 4. Knowledge volume cannot create intelligence maturity (huge sample of the
//    wrong evidence kind: only schema_exists → analytical+ maturity flagged).
t("4 volume≠maturity (schema-only high sample flagged)", validateCapabilityAssessment(baseAssessment({
  evidence: [{ id: "e", kind: "schema_exists", ref: "table:vault_companies" }], sample_size: 100000,
  success_rate: measured(90, 0.9, 100000),
})).some((v) => v.code === "maturity_from_schema_or_tests" || v.code === "shadow_marked_production"));

// 5. Schema existence cannot create operational maturity.
t("5 schema existence ≠ production", !assessProductionEligibility({
  mode: "production", evidence: [{ id: "e", kind: "schema_exists", ref: "t" }], sample_size: 3, success_rate: measured(1, 1, 3),
}).eligible);

// 6. Passing tests cannot create production maturity.
t("6 passing tests ≠ production", !assessProductionEligibility({
  mode: "production", evidence: [{ id: "e", kind: "unit_test_passing", ref: "test:x" }], sample_size: 3, success_rate: measured(1, 1, 3),
}).eligible);

// 7. Shadow is not production.
t("7 shadow marked production is a violation", validateCapabilityAssessment(baseAssessment({
  mode: "production", evidence: [{ id: "e", kind: "schema_exists", ref: "t" }], sample_size: 0, success_rate: unmeasured("shadow_only", "shadow"),
})).some((v) => v.code === "shadow_marked_production"));
t("7b clean production passes", validateCapabilityAssessment(baseAssessment()).length === 0);

// 8. Generation is not validation.
const rec: IntelligenceClaim = { id: "c1", kind: "recommendation", statement: "Prioritize segment X", action: "outreach", rationale: "fit", requires_validation: true, evidence: [] };
const genOutput = (over: Partial<IntelligenceOutput> = {}): IntelligenceOutput => ({
  id: "o1", scope: { kind: "tenant", tenant_id: "t1" }, type: "client_specific_recommendation", claim: rec,
  summary: "s", reasoning_summary: "r", supporting_evidence: [], counterevidence: [], alternative_explanations: [],
  unresolved_questions: [], confidence: 0.5, confidence_method: "heuristic", novelty: unmeasured("not_measured", "x"),
  actionability: unmeasured("not_measured", "x"), commercial_relevance: unmeasured("not_measured", "x"),
  validation_state: "unreviewed", human_review_state: "unreviewed", outcome_state: "none", ranking_impact: "none",
  report_eligibility: "eligible", capability_versions: [], methodology_version: MV, created_at: NOW, valid_from: NOW,
  valid_until: null, last_reviewed: null, ...over,
});
t("8 generated recommendation is not validated", !isValidated(genOutput()));
t("8b eligible unvalidated recommendation flagged", validateOutputHonesty(genOutput()).some((v) => v.code === "unvalidated_recommendation_eligible"));

// 9. Recommendation is distinct from fact.
const fact: IntelligenceClaim = { id: "c2", kind: "fact", statement: "Domain resolves", corroborated: true, evidence: [] };
t("9 recommendation ≠ fact", isRecommendation(rec) && !isFact(rec) && isFact(fact) && !isRecommendation(fact));

// 10. Pattern without sufficient sample stays insufficient.
t("10 promoted pattern below floor → insufficient_sample", normalizePatternState({ state: "production", sample_size: 2 }) === "insufficient_sample");
t("10b pattern at floor keeps its state", normalizePatternState({ state: "production", sample_size: 5 }) === "production");

// 11. No outcomes → Outcome Performance not_measured.
const noOut = deriveOutcomePerformance([], MV, NOW, CUT);
t("11 no outcomes ⇒ outcome_performance not_measured", noOut.measurement.state === "not_measured" && !isMeasured(noOut.measurement));
const outs: IntelligenceOutcome[] = [
  { id: "x1", kind: "terminal_positive", dimension: "commercial_outcome", observed_at: NOW, evidence: [] },
  { id: "x2", kind: "terminal_negative", dimension: "commercial_outcome", observed_at: NOW, evidence: [] },
];
t("11b real outcomes ⇒ measured", isMeasured(deriveOutcomePerformance(outs, MV, NOW, CUT).measurement));

// 12. No baseline ⇒ Intelligence Lift not_measured.
t("12 no baseline ⇒ lift not_measured", deriveIntelligenceLift(null, MV, NOW).measurement.state === "not_measured");
t("12b baseline set ⇒ still not scored", deriveIntelligenceLift("generic_llm", MV, NOW).measurement.state === "insufficient_evidence");

// 13. Critical unresolved gap blocks premium readiness.
const readiness = (over: Partial<ReportReadinessAssessment> = {}): ReportReadinessAssessment => ({
  scope: { kind: "tenant", tenant_id: "t1" }, readiness_level: "premium_report_ready", confidence: 0.5, reason: "x",
  blockers: [{ gap_id: "g1", severity: "critical", description: "no counterevidence", resolved: false }],
  customer_safe_outputs: ["o1"], unsafe_outputs: [], capabilities_available: [], missing_capabilities: [],
  recommended_next_action: null, supportable_sections: [], superficial_sections: [], methodology_version: MV,
  assessed_at: NOW, source_data_cutoff: CUT, ...over,
});
t("13 premium + unresolved critical blocker is invalid", validateReadiness(readiness()).some((v) => v.code === "premium_with_critical_blocker"));
t("13b premium with resolved blockers + safe outputs passes", validateReadiness(readiness({ blockers: [{ gap_id: "g1", severity: "critical", description: "x", resolved: true }] })).length === 0);
t("13c report-ready without safe outputs flagged", validateReadiness(readiness({ readiness_level: "intelligence_report_ready", customer_safe_outputs: [], blockers: [] })).some((v) => v.code === "report_ready_without_safe_outputs"));

// 14. Tenant and global scopes remain explicit.
const g: IntelligenceScope = { kind: "global" };
const tn: IntelligenceScope = { kind: "tenant", tenant_id: "acme" };
t("14 scopes explicit (global vs tenant)", g.kind === "global" && tn.kind === "tenant" && tn.tenant_id === "acme");

// 15. Serialization is deterministic regardless of key insertion order.
const a = serializeIntelligence({ b: 1, a: { d: 4, c: 3 }, list: [{ y: 2, x: 1 }] });
const b = serializeIntelligence({ list: [{ x: 1, y: 2 }], a: { c: 3, d: 4 }, b: 1 });
t("15 deterministic serialization", a === b && a === '{"a":{"c":3,"d":4},"b":1,"list":[{"x":1,"y":2}]}');

// Sanity: maturity order.
t("+ maturity order retrieval < adaptive", maturityRank("retrieval") < maturityRank("adaptive_intelligence"));

console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
