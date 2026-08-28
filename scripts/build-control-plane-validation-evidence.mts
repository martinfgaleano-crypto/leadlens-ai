import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import evidenceModule from "@/lib/intelligence/control-plane-validation-evidence";
const { createControlPlaneValidationEvidence } = evidenceModule;

const read = (path: string) => ({ body: readFileSync(path, "utf8"), json: JSON.parse(readFileSync(path, "utf8")) });
const positivePath = "ml/data/acceptance/account-deep-research-positive-control-v1.json";
const humanPath = "ml/data/acceptance/account-deep-research-human-review-v1.json";
const positive = read(positivePath);
const human = read(humanPath);
if (positive.json.summary?.references !== 8 || positive.json.summary?.captured_defensibly !== 6) throw new Error("unexpected positive-control summary");
if (human.json.summary?.n !== 8 || human.json.summary?.true_positives !== 6 || human.json.summary?.false_negatives !== 2) throw new Error("unexpected human-review summary");
const sha = (body: string) => createHash("sha256").update(body).digest("hex");

const evidence = createControlPlaneValidationEvidence({
  version: "control-plane-validation-evidence-v1",
  evidence_id: "intelligence-quality-acceleration-2026-08-28",
  source_type: "controlled_acceptance",
  observed_at: positive.json.generated_at,
  artifact_version: "intelligence-quality-acceleration-v1",
  evaluator_compatibility: ["capability-control-plane-v1", "launch-readiness-v1"],
  capability_ids: ["dynamic_universe_discovery", "initial_research", "event_extraction", "opportunity_case", "decision", "human_calibration", "tenant_isolation", "customer_run_lifecycle", "production_soak", "portfolio_intelligence", "launch_readiness", "candidate_universe", "pre_research_relevance", "runtime_latency", "provider_cooldown", "provider_routing", "exception_handling"],
  provenance: [
    { ref: positivePath, kind: "controlled_acceptance", sha256: sha(positive.body) },
    { ref: humanPath, kind: "human_review", sha256: sha(human.body) },
    { ref: "controlled:customer-e2e-1787875820660", kind: "controlled_acceptance" },
    { ref: "scripts/fixtures/report-delivery-gate.test.ts", kind: "controlled_acceptance" },
    { ref: "scripts/fixtures/control-plane-evidence-ingestion.test.ts", kind: "controlled_acceptance" },
  ],
  metrics: {
    positive_capture: { captured: positive.json.summary.captured_defensibly, controls: positive.json.summary.references },
    human_validation: { true_positives: human.json.summary.true_positives, false_positives: human.json.summary.false_positives, false_negatives: human.json.summary.false_negatives, true_negatives: human.json.summary.true_negatives, customer_safe_cases: human.json.summary.commercial_cases_confirmed },
    tenant_isolation: { passed: 15, controls: 15, real_acceptance_runs: 1 },
    report_safety: { passed: 16, controls: 16, false_successes: 0, real_acceptance_runs: 1 },
    runtime: { recent_ms: positive.json.summary.duration_ms, historical_p95_ms: 304912, historical_sample: 7 },
    candidate_hygiene: { rejected_non_accounts: 7, controls: 7, leaks: 0 },
    provider_degradation: { passed: 7, controls: 7, observed_failures: 1, provider_state: "exhausted" },
  },
});
console.log(JSON.stringify(evidence, null, 2));
