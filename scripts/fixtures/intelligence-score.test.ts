import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  buildCapabilityControlPlane,
  intelligenceScoreComponents,
  type CapabilityControlPlaneInput,
} from "@/lib/intelligence/capability-control-plane";
import type { ControlPlaneValidationEvidenceV1 } from "@/lib/intelligence/control-plane-validation-evidence";
import { buildControlPlaneMemoryRecord } from "@/lib/intelligence/control-plane-store";
import { buildIntelligenceScoreView } from "@/lib/intelligence/intelligence-score";
import { buildLaunchReadiness } from "@/lib/intelligence/launch-readiness";
import { measured, type IntelligenceCapabilityAssessment } from "@/lib/intelligence/os-contracts";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`ok - ${passed} ${name}`); };
const now = "2026-08-28T03:00:00.000Z";

function assessment(id: string, score: number): IntelligenceCapabilityAssessment {
  return {
    capability_id: id, capability_version: "fixture-v1", scope: { kind: "global" }, methodology_version: "fixture-v1",
    mode: "production", maturity_level: "structured_knowledge", maturity_confidence: 0.8,
    measurement_state: "measured", evidence: [{ id: `${id}:fixture`, kind: "exercised_run", ref: `${id}:fixture`, date: now }],
    sample_size: 20, last_exercised: now, success_metric: `${id}_success`, success_rate: measured(score, 0.8, 20),
    known_failure_modes: [], limitations: [], blocked_reason: null, ranking_impact: "low", report_impact: "medium",
    next_milestone: null, promotion_criteria: [], human_review_state: "human_reviewed", assessed_at: now, source_data_cutoff: now,
  };
}

const baseScores: Record<string, number> = {
  market_interpretation: 78, company_discovery: 76, company_verification: 82, entity_resolution: 84,
  structural_account_ranking: 74, deep_account_research: 68, signal_detection: 66, counterevidence_analysis: 70,
  temporal_reasoning: 72, client_specific_opportunity_assessment: 69, recommendation_generation: 64,
  account_memory: 88, anti_repetition: 90,
};
function plane(overrides: Record<string, number> = {}, evidence: ControlPlaneValidationEvidenceV1[] = []) {
  const input: CapabilityControlPlaneInput = {
    now, snapshot_capabilities: Object.entries({ ...baseScores, ...overrides }).map(([id, score]) => assessment(id, score)),
    dynamic_recall: null, soak: null, monitor_sample: 21, monitor_false_novelty: 0, account_memory_records: 21,
    controlled_validation_evidence: evidence,
  };
  return buildCapabilityControlPlane(input);
}
const score = (value: ReturnType<typeof plane>) => value.overall.state === "measured" ? value.overall.score : null;
const component = (value: ReturnType<typeof plane>, id: string) => intelligenceScoreComponents(value.capabilities).find((item) => item.id === id)!;
const componentScore = (value: ReturnType<typeof plane>, id: string) => {
  const result = component(value, id).score;
  return result.state === "measured" ? result.score : null;
};

const base = plane();
test("score is canonical and bounded 0-100", () => assert(score(base) !== null && score(base)! >= 0 && score(base)! <= 100));
test("current capability telemetry computes eight components", () => assert.equal(intelligenceScoreComponents(base.capabilities).length, 8));
test("better Research evidence raises Research and overall", () => { const better = plane({ deep_account_research: 96, signal_detection: 96 }); assert(componentScore(better, "research")! > componentScore(base, "research")! && score(better)! > score(base)!); });
test("better event capture raises Research", () => { const poor = plane({ signal_detection: 20 }); const better = plane({ signal_detection: 95 }); assert(componentScore(better, "research")! > componentScore(poor, "research")!); });

const bundled = JSON.parse(readFileSync("ml/data/acceptance/control-plane-validation-evidence-v1.json", "utf8")) as ControlPlaneValidationEvidenceV1;
const commerciallyValidated = structuredClone(bundled);
commerciallyValidated.source_fingerprint = "fixture-commercial-validation";
commerciallyValidated.metrics.human_validation.customer_safe_cases = 4;
commerciallyValidated.metrics.human_validation.true_positives = 8;
commerciallyValidated.metrics.human_validation.false_negatives = 0;
test("positive commercial validation raises Commercial Validation", () => assert(componentScore(plane({}, [commerciallyValidated]), "commercial_validation")! > componentScore(plane({}, [bundled]), "commercial_validation")!));
test("wrong-entity incident lowers Discovery and score", () => { const incident = plane({ entity_resolution: 15, company_verification: 25 }); assert(componentScore(incident, "discovery")! < componentScore(base, "discovery")! && score(incident)! < score(base)!); });
test("false What Changed lowers Temporal and score", () => { const incident = plane({ temporal_reasoning: 10 }); assert(componentScore(incident, "temporal")! < componentScore(base, "temporal")! && score(incident)! < score(base)!); });
test("missing commercial sample lowers confidence instead of becoming success", () => { const result = component(base, "commercial_validation").score; assert.notEqual(result.state, "measured"); assert(!intelligenceScoreComponents(base.capabilities).some((item) => item.id === "commercial_validation" && item.score.state === "measured" && item.score.score === 100)); });
test("0/0 is not interpreted as successful validation", () => assert.notEqual(component(base, "commercial_validation").score.state, "measured"));
test("same telemetry produces the same score", () => assert.deepEqual(buildIntelligenceScoreView(base), buildIntelligenceScoreView(plane())));

const configFail = { supabase: false, admin_auth: true, app_url: true, demo_off: true, internal_run_auth: true };
const launchA = buildLaunchReadiness({ now, control_plane: base, database_available: false, production_config: configFail });
const stronger = plane({ deep_account_research: 98, signal_detection: 98 });
const launchB = buildLaunchReadiness({ now, control_plane: stronger, database_available: false, production_config: configFail });
const historicalBase = { ...base, generated_at: "2026-08-27T03:00:00.000Z" };
const recordA = buildControlPlaneMemoryRecord({ control_plane: historicalBase, launch_readiness: launchA });
const recordB = buildControlPlaneMemoryRecord({ control_plane: stronger, launch_readiness: launchB });
test("score history persists in existing Control Plane snapshots", () => assert.equal(recordB.capability_score, score(stronger)));
test("history exposes previous, delta and deterministic movement reasons", () => { const view = buildIntelligenceScoreView(stronger, [recordB, recordA]); assert.equal(view.previous, score(base)); assert.equal(view.delta, score(stronger)! - score(base)!); assert(view.movement_reasons.length > 0); });
test("there is one score authority: view equals control-plane overall", () => assert.equal(buildIntelligenceScoreView(stronger).score, score(stronger)));
test("Launch Readiness remains independently capped by production config", () => assert.equal(launchA.score, launchB.score));
test("Intelligence can rise while Launch Readiness remains capped", () => assert(score(stronger)! > score(base)! && launchA.score === launchB.score));

console.log(`\n${passed} passed, 0 failed`);
