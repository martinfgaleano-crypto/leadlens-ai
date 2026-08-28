import {
  INTELLIGENCE_CAPABILITY_REGISTRY,
  buildCapabilityControlPlane,
  type CapabilityControlPlaneInput,
  type DynamicRecallSignals,
  type PositiveCaptureSignals,
} from "@/lib/intelligence/capability-control-plane";
import { measured, type IntelligenceCapabilityAssessment } from "@/lib/intelligence/os-contracts";

let passed = 0, failed = 0;
function test(name: string, condition: boolean) {
  if (condition) { passed++; console.log(`ok - ${name}`); }
  else { failed++; console.error(`FAIL - ${name}`); }
}

const now = "2026-08-27T12:00:00.000Z";
function assessment(id: string, score = 95, sample = 20): IntelligenceCapabilityAssessment {
  return {
    capability_id: id, capability_version: "test-v1", scope: { kind: "global" }, methodology_version: "test",
    mode: "production", maturity_level: "structured_knowledge", maturity_confidence: 0.8,
    measurement_state: "measured", evidence: [{ id: `${id}:run`, kind: "exercised_run", ref: `${id}:real`, date: now }],
    sample_size: sample, last_exercised: now, success_metric: `${id}_success`, success_rate: measured(score, 0.8, sample),
    known_failure_modes: [], limitations: [], blocked_reason: null, ranking_impact: "low", report_impact: "medium",
    next_milestone: null, promotion_criteria: [], human_review_state: "human_reviewed", assessed_at: now, source_data_cutoff: now,
  };
}

function recall(captured: number, p95 = 280_000): DynamicRecallSignals {
  return {
    generated_at: now,
    metrics: {
      researched_accounts: 10, delivered_cases: captured, structural_reasonable_including_borderline: 9,
      structural_reasonable_rate: 0.9, wrong_target_accounts: 1, wrong_target_rate: 0.1,
      human_positive_outcomes: captured, bounded_positive_controls: 8,
      bounded_positive_controls_captured_defensibly: captured, bounded_capture_rate: captured / 8,
      provider_calls: 150, observed_cost_usd: 0.66, duration_ms: p95 * 6, average_calls_per_run: 25,
    },
    runs: Array.from({ length: 6 }, (_, index) => ({ run_id: `r${index}`, universe: 8, researched: 2, delivered: index < captured ? 1 : 0, duration_ms: index === 5 ? p95 : 180_000 })),
  };
}

const snapshot = [
  assessment("company_discovery"), assessment("company_verification"), assessment("structural_account_ranking"),
  assessment("deep_account_research"), assessment("recommendation_generation"), assessment("temporal_reasoning"),
  assessment("account_memory"), assessment("anti_repetition"), assessment("report_readiness_assessment"),
];
const input = (dynamic_recall: DynamicRecallSignals | null): CapabilityControlPlaneInput => ({
  now, snapshot_capabilities: snapshot, dynamic_recall, soak: null,
  monitor_sample: 10, monitor_false_novelty: 0, account_memory_records: 10,
});

const poor = buildCapabilityControlPlane(input(recall(0, 304_900)));
const better = buildCapabilityControlPlane(input(recall(4, 180_000)));
const runtimeOnlyBetter = buildCapabilityControlPlane(input(recall(0, 180_000)));
const diagnosticPositive: PositiveCaptureSignals = {
  generated_at: now,
  diagnostic_only: true,
  production_seeded: false,
  summary: {
    references: 8,
    captured_defensibly: 3,
    bounded_capture_rate: 3 / 8,
    duration_ms: 151_008,
    provider_calls: 70,
    extractions: 14,
    observed_cost_usd: null,
  },
};
const positiveRetrievalOnly = buildCapabilityControlPlane({
  ...input(recall(0, 304_900)),
  positive_capture: diagnosticPositive,
});
const providerObserved = buildCapabilityControlPlane({ ...input(recall(0)), provider_usage: {
  brave: { calls_today: 10, errors_today: 2, calculated_cost_usd_today: 0, last_failure: now, last_error: "rate_limited" },
  anthropic: { calls_today: 10, errors_today: 0, calculated_cost_usd_today: 0.12, last_success: now },
} });
const byId = (plane: typeof poor, id: string) => plane.capabilities.find((item) => item.capability.id === id)!;
const scoreOf = (plane: typeof poor, id: string) => {
  const score = byId(plane, id).score;
  return score.state === "measured" ? score.score : null;
};

test("registry: canonical ids are unique", new Set(INTELLIGENCE_CAPABILITY_REGISTRY.map((item) => item.id)).size === INTELLIGENCE_CAPABILITY_REGISTRY.length);
test("registry: all requested capability areas are represented without UI duplication", INTELLIGENCE_CAPABILITY_REGISTRY.length === 47);
test("registry: metadata contains no manually maintained score", INTELLIGENCE_CAPABILITY_REGISTRY.every((item) => !("score" in item)));
test("evidence hierarchy: 0/8 live capture degrades dynamic discovery despite passing implementation/tests", byId(poor, "dynamic_universe_discovery").state === "degraded");
test("sample truth: 0 captured is a poor measured validation, not 100% precision", byId(poor, "dynamic_universe_discovery").dimensions.quality.state === "measured" && byId(poor, "dynamic_universe_discovery").dimensions.quality.score === 0 && byId(poor, "dynamic_universe_discovery").dimensions.quality.sample_size === 8);
test("positive-control artifact overrides stale retrieval proxy with measured 3/8", byId(positiveRetrievalOnly, "dynamic_universe_discovery").dimensions.quality.state === "measured" && byId(positiveRetrievalOnly, "dynamic_universe_discovery").dimensions.quality.score === 38 && byId(positiveRetrievalOnly, "dynamic_universe_discovery").dimensions.quality.sample_size === 8 && byId(positiveRetrievalOnly, "dynamic_universe_discovery").supporting_metrics.positive_controls_captured === 3);
test("diagnostic event capture does not invent a human-confirmed customer-safe Case", byId(positiveRetrievalOnly, "opportunity_case").supporting_metrics.human_positive_cases === 0 && byId(positiveRetrievalOnly, "opportunity_case").blockers.some((blocker) => blocker.includes("3/8 diagnostic events") && blocker.includes("no customer-safe Case")));
test("positive-control evidence is an exercised run, not invented human review", byId(positiveRetrievalOnly, "dynamic_universe_discovery").evidence.some((item) => item.ref.endsWith("account-deep-research-positive-control-v1.json") && item.kind === "exercised_run") && recall(0).metrics.bounded_positive_controls_captured_defensibly === 0);
test("score moves up: improved real capture raises dynamic discovery score", scoreOf(better, "dynamic_universe_discovery") !== null && scoreOf(poor, "dynamic_universe_discovery") !== null && scoreOf(better, "dynamic_universe_discovery")! > scoreOf(poor, "dynamic_universe_discovery")!);
test("score moves down: live truth overrides a high deterministic success assessment", scoreOf(poor, "dynamic_universe_discovery") !== null && scoreOf(poor, "dynamic_universe_discovery")! < 80);
test("overall anti-inflation: no human positive caps overall maturity", poor.overall.state === "measured" && poor.overall.score <= 59);
test("runtime: ceiling breach is visible and degrades reliability", byId(poor, "runtime_latency").dimensions.reliability.state === "measured" && byId(poor, "runtime_latency").dimensions.reliability.score === 45 && byId(poor, "runtime_latency").blockers.length > 0);
test("runtime: lower p95 improves the same capability automatically", scoreOf(better, "runtime_latency") !== null && scoreOf(poor, "runtime_latency") !== null && scoreOf(better, "runtime_latency")! > scoreOf(poor, "runtime_latency")!);
test("runtime improvement does not directly inflate Intelligence Score", runtimeOnlyBetter.overall.state === "measured" && poor.overall.state === "measured" && runtimeOnlyBetter.overall.score === poor.overall.score);
test("monitor: repeated zero false novelty produces high quality with explicit n", byId(poor, "monitor").dimensions.quality.state === "measured" && byId(poor, "monitor").dimensions.quality.score === 95 && byId(poor, "monitor").dimensions.quality.sample_size === 10);
test("scheduler: implemented infrastructure is not represented as validated production", ["implemented", "domain_proven"].includes(byId(poor, "scheduler").state));
test("ML: shadow learning never becomes production validated from implementation presence", !["production_wired", "live_validated", "soak_validated"].includes(byId(poor, "ml_shadow_learning").state));
test("economics: observed calls and cost are supporting metrics, not invented estimates", byId(poor, "cogs_instrumentation").supporting_metrics.observed_cost_usd === 0.66 && byId(poor, "cogs_instrumentation").supporting_metrics.average_calls_per_run === 25);
test("confidence: live small-sample recall does not claim high confidence", byId(poor, "dynamic_universe_discovery").confidence !== "high");
test("provider telemetry: observed failures and cost automatically affect routing metrics", byId(providerObserved, "provider_routing").supporting_metrics.errors_today === 2 && byId(providerObserved, "provider_routing").dimensions.reliability.state === "measured" && byId(providerObserved, "provider_routing").dimensions.reliability.score === 90 && byId(providerObserved, "cogs_instrumentation").supporting_metrics.observed_cost_today_usd === 0.12);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
