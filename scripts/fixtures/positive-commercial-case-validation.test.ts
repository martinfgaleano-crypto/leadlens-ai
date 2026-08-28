import { strict as assert } from "node:assert";
import { summarizePositiveCommercialCases, validatePositiveCommercialCase, type PositiveCommercialCaseReview } from "@/lib/intelligence/positive-commercial-case-validation";

let passed = 0;
const test = (name: string, condition: boolean) => { assert.equal(condition, true, name); passed++; console.log(`ok - ${name}`); };
const base: PositiveCommercialCaseReview = {
  case_id: "case:conagra", account: "Conagra Brands", decision: "validate", decision_source: "canonical_opportunity_test",
  identity_confirmed: true, target_organization_confirmed: true, commercial_context_confirmed: true,
  client_fit_confirmed: true, evidence_traceable: true, event_observed: true, event_date: "2026-03-06",
  timing_claimed: true, timing_grounded: true, counterevidence_explicit: true,
  weakening_factors_explicit: true, next_action_explicit: true, buying_intent_claimed: false,
  independent_review: { reviewer_id: "independent-review", reviewer_kind: "independent_technical_review", judgment: "commercially_defensible", rationale: "Grounded Validate Case.", reviewed_at: "2026-08-28T12:00:00.000Z" },
  human_confirmation: { state: "confirmed", reviewer_id: "human-reviewer", reviewer_role: "commercial reviewer", judgment: "commercially_defensible", rationale: "Commercial attention is justified.", reviewed_at: "2026-08-28T13:00:00.000Z", attestation: true },
};

test("1 a complete human-confirmed Validate Case is positive", validatePositiveCommercialCase(base).customer_safe_human_positive);
test("2 Prioritize is not required", validatePositiveCommercialCase({ ...base, decision: "validate" }).customer_safe_human_positive);
test("3 Monitor is not a positive commercial Case", validatePositiveCommercialCase({ ...base, decision: "monitor" }).blockers.includes("decision_not_commercially_positive"));
test("4 independent model review cannot substitute for human confirmation", validatePositiveCommercialCase({ ...base, human_confirmation: { state: "pending", reviewer_id: null, reviewer_role: null, judgment: null, rationale: null, reviewed_at: null, attestation: false } }).blockers.includes("human_confirmation_required"));
test("5 identity is fail closed", validatePositiveCommercialCase({ ...base, identity_confirmed: false }).blockers.includes("identity_not_confirmed"));
test("6 target organization is fail closed", validatePositiveCommercialCase({ ...base, target_organization_confirmed: false }).blockers.includes("target_organization_not_confirmed"));
test("7 client fit is required independently from event validity", validatePositiveCommercialCase({ ...base, client_fit_confirmed: false }).blockers.includes("client_fit_not_confirmed"));
test("8 untraceable evidence is rejected", validatePositiveCommercialCase({ ...base, evidence_traceable: false }).blockers.includes("evidence_not_traceable"));
test("9 Timing requires observed dated evidence", validatePositiveCommercialCase({ ...base, event_date: null }).blockers.includes("timing_not_grounded"));
test("10 no Timing claim can remain honest without an event", !validatePositiveCommercialCase({ ...base, timing_claimed: false, timing_grounded: false, event_observed: false, event_date: null }).blockers.includes("timing_not_grounded"));
test("11 counterevidence and weakening factors are required", ["counterevidence_not_explicit", "weakening_factors_not_explicit"].every((x) => validatePositiveCommercialCase({ ...base, counterevidence_explicit: false, weakening_factors_explicit: false }).blockers.includes(x)));
test("12 buying intent cannot be inferred", validatePositiveCommercialCase({ ...base, buying_intent_claimed: true }).blockers.includes("unsupported_buying_intent"));
test("13 next action is required", validatePositiveCommercialCase({ ...base, next_action_explicit: false }).blockers.includes("next_action_not_explicit"));
test("14 non-positive independent review blocks promotion", validatePositiveCommercialCase({ ...base, independent_review: { ...base.independent_review, judgment: "monitor" } }).blockers.includes("independent_review_not_positive"));
test("15 fallback decisions cannot be promoted by review", validatePositiveCommercialCase({ ...base, decision_source: "fallback_conservative" }).blockers.includes("noncanonical_decision_source"));
const summary = summarizePositiveCommercialCases([base, { ...base, case_id: "case:pending", human_confirmation: { state: "pending", reviewer_id: null, reviewer_role: null, judgment: null, rationale: null, reviewed_at: null, attestation: false } }]);
test("16 summary preserves n and does not count pending review", summary.n === 2 && summary.customer_safe_human_positive_cases === 1 && summary.pending_human_confirmation === 1);
console.log(`\n${passed} passed, 0 failed`);
