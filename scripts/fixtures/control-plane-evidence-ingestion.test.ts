import assert from "node:assert/strict";
import { buildCapabilityControlPlane, applyControlPlaneValidationEvidence, type DynamicRecallSignals } from "@/lib/intelligence/capability-control-plane";
import { buildLaunchReadiness } from "@/lib/intelligence/launch-readiness";
import { buildControlPlaneMemoryRecord } from "@/lib/intelligence/control-plane-store";
import { createControlPlaneValidationEvidence, dedupeValidationEvidence, validateControlPlaneValidationEvidence } from "@/lib/intelligence/control-plane-validation-evidence";

let passed = 0;
const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`ok - ${name}`); };
const at = "2026-08-28T00:10:24.294Z";
const evidence = createControlPlaneValidationEvidence({
  version: "control-plane-validation-evidence-v1", evidence_id: "intelligence-super-sprint-2026-08-28",
  source_type: "controlled_acceptance", observed_at: at, artifact_version: "intelligence-quality-acceleration-v1",
  evaluator_compatibility: ["capability-control-plane-v1", "launch-readiness-v1"],
  capability_ids: ["dynamic_universe_discovery", "human_calibration", "tenant_isolation", "production_soak", "runtime_latency", "candidate_universe", "provider_cooldown"],
  provenance: [{ ref: "ml/data/acceptance/account-deep-research-positive-control-v1.json", kind: "controlled_acceptance" }, { ref: "ml/data/acceptance/account-deep-research-human-review-v1.json", kind: "human_review" }],
  metrics: {
    positive_capture: { captured: 6, controls: 8 },
    human_validation: { true_positives: 6, false_positives: 0, false_negatives: 2, true_negatives: 0, customer_safe_cases: 0 },
    tenant_isolation: { passed: 15, controls: 15, real_acceptance_runs: 1 },
    report_safety: { passed: 16, controls: 16, false_successes: 0, real_acceptance_runs: 1 },
    runtime: { recent_ms: 137481, historical_p95_ms: 304912, historical_sample: 7 },
    candidate_hygiene: { rejected_non_accounts: 7, controls: 7, leaks: 0 },
    provider_degradation: { passed: 7, controls: 7, observed_failures: 1, provider_state: "exhausted" },
  },
});

const oldRecall: DynamicRecallSignals = { generated_at: "2026-08-27T19:16:18.441Z", metrics: { researched_accounts: 10, delivered_cases: 0, structural_reasonable_including_borderline: 9, structural_reasonable_rate: .9, wrong_target_accounts: 1, wrong_target_rate: .1, human_positive_outcomes: 0, bounded_positive_controls: 8, bounded_positive_controls_captured_defensibly: 0, bounded_capture_rate: 0, provider_calls: 210, observed_cost_usd: 0, duration_ms: 304912, average_calls_per_run: 35 }, runs: Array.from({ length: 6 }, (_, i) => ({ run_id: `r${i}`, universe: 10, researched: 2, delivered: 0, duration_ms: i === 5 ? 304912 : 180000 })) };
const baseline = buildCapabilityControlPlane({ now: "2026-08-27T20:00:00Z", snapshot_capabilities: [], dynamic_recall: oldRecall, soak: null, monitor_sample: 0, monitor_false_novelty: null, account_memory_records: 0 });
const applied = applyControlPlaneValidationEvidence(baseline, [evidence], at);
const readiness = buildLaunchReadiness({ now: at, control_plane: applied, database_available: true, production_config: { supabase: true, admin_auth: true, internal_run_auth: false, app_url: true, demo_off: true } });

t("1 valid artifact accepted", () => assert.equal(validateControlPlaneValidationEvidence(evidence).ok, true));
t("2 invalid artifact rejected", () => assert.equal(validateControlPlaneValidationEvidence({ ...evidence, metrics: { ...evidence.metrics, positive_capture: { captured: 9, controls: 8 } } }).ok, false));
t("3 idempotent fingerprint dedupes", () => assert.equal(dedupeValidationEvidence([evidence, evidence]).length, 1));
t("4 new material artifact has a new fingerprint", () => { const { source_fingerprint: _old, ...next } = evidence; assert.notEqual(createControlPlaneValidationEvidence({ ...next, observed_at: "2026-08-29T00:00:00Z" }).source_fingerprint, evidence.source_fingerprint); });
t("5 numerator and denominator survive ingestion", () => { const c = applied.capabilities.find(x => x.capability.id === "dynamic_universe_discovery")!; assert.equal(c.supporting_metrics.positive_controls_captured, 6); assert.equal(c.supporting_metrics.positive_controls, 8); });
t("6 direct readiness score ingestion is rejected", () => assert.equal(validateControlPlaneValidationEvidence({ ...evidence, readiness_score: 59 }).ok, false));
t("7 negative commercial evidence is preserved", () => { const c = applied.capabilities.find(x => x.capability.id === "opportunity_case")!; assert.equal(c.supporting_metrics.human_positive_cases, 0); assert.match(c.blockers.join(" "), /no customer-safe Case/i); });
t("8 provenance is retained", () => assert.ok(applied.validation_evidence?.[0].provenance.some(p => p.kind === "human_review")));
t("9 6/8 capture affects retrieval", () => assert.equal(applied.capabilities.find(x => x.capability.id === "dynamic_universe_discovery")?.supporting_metrics.positive_capture_rate, .75));
t("10 zero customer-safe Cases caps readiness", () => assert.ok(readiness.score <= 49));
t("11 tenant acceptance measures security capability", () => assert.equal(applied.capabilities.find(x => x.capability.id === "tenant_isolation")?.supporting_metrics.controlled_acceptance_passed, 15));
t("12 report safety acceptance affects report capability", () => assert.equal(applied.capabilities.find(x => x.capability.id === "production_soak")?.supporting_metrics.false_successes, 0));
t("13 recent runtime does not erase historical p95", () => assert.equal(applied.capabilities.find(x => x.capability.id === "runtime_latency")?.supporting_metrics.p95_runtime_ms, 304912));
t("14 provider degradation is retained", () => assert.equal(applied.capabilities.find(x => x.capability.id === "provider_cooldown")?.supporting_metrics.provider_state, "exhausted"));
t("15 no manual readiness constant is carried by evidence", () => assert.equal("readiness_score" in evidence, false));
t("16 material evidence changes snapshot fingerprint", () => { const before = buildLaunchReadiness({ now: at, control_plane: baseline, database_available: true, production_config: { supabase: true, admin_auth: true, internal_run_auth: false, app_url: true, demo_off: true } }); assert.notEqual(buildControlPlaneMemoryRecord({ control_plane: baseline, launch_readiness: before }).snapshot_key, buildControlPlaneMemoryRecord({ control_plane: applied, launch_readiness: readiness }).snapshot_key); });
t("17 repeated evidence creates no new material plane", () => assert.equal(applyControlPlaneValidationEvidence(applied, [evidence], "2026-08-29T00:00:00Z"), applied));
t("18 source cutoff advances to controlled evidence", () => assert.equal(readiness.source_data_cutoff, at));
t("19 runtime blocker remains visible", () => assert.match(applied.capabilities.find(x => x.capability.id === "runtime_latency")!.blockers.join(" "), /304912ms/));
t("20 controlled acceptance is not labeled production observation", () => assert.equal(evidence.source_type, "controlled_acceptance"));
const { source_fingerprint: _fingerprint, ...replacementInput } = evidence;
const replacement = createControlPlaneValidationEvidence({
  ...replacementInput,
  evidence_id: "intelligence-super-sprint-commercial-review-2026-08-28",
  supersedes_source_fingerprint: evidence.source_fingerprint,
  observed_at: "2026-08-28T14:00:00.000Z",
  metrics: { ...evidence.metrics, human_validation: { ...evidence.metrics.human_validation, customer_safe_cases: 3 } },
});
const replaced = applyControlPlaneValidationEvidence(applied, [replacement], replacement.observed_at);
t("21 a reviewed update supersedes rather than duplicates the same controlled sample", () => { assert.equal(replaced.validation_evidence?.length, 1); assert.equal(replaced.validation_evidence?.[0].source_fingerprint, replacement.source_fingerprint); });
t("22 supersession updates human-positive Cases without doubling retrieval n", () => { const c = replaced.capabilities.find(x => x.capability.id === "opportunity_case")!; assert.equal(c.supporting_metrics.human_positive_cases, 3); assert.equal(c.supporting_metrics.positive_controls, 8); });
t("23 invalid or self-referential supersession fails closed", () => assert.equal(validateControlPlaneValidationEvidence({ ...replacement, supersedes_source_fingerprint: replacement.source_fingerprint }).ok, false));

console.log(`\n${passed} passed, 0 failed`);
