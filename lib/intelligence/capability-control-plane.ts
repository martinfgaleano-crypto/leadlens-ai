import {
  isMeasured, measured, unmeasured,
  type IntelligenceCapabilityAssessment, type IntelligenceEvidenceReference, type MeasurementResult,
} from "./os-contracts";
import { dedupeValidationEvidence, type ControlPlaneValidationEvidenceV1 } from "./control-plane-validation-evidence";

export const CAPABILITY_CONTROL_PLANE_VERSION = "capability-control-plane-v1";

export const CAPABILITY_STATES = [
  "not_started", "implemented", "domain_proven", "production_wired",
  "live_validated", "soak_validated", "degraded", "blocked",
] as const;
export type CapabilityState = (typeof CAPABILITY_STATES)[number];
export type CapabilityConfidence = "low" | "medium" | "high";
export type CapabilityDimensionId =
  | "implementation" | "integration" | "correctness" | "real_world_validation"
  | "reliability" | "quality" | "observability" | "economics" | "autonomy";

export interface CapabilityDefinition {
  id: string;
  name: string;
  domain: "context" | "discovery" | "research" | "reasoning" | "monitor" | "operations" | "coverage" | "learning" | "readiness";
  description: string;
  dependencies: string[];
  snapshot_aliases: string[];
  implementation_evidence: string[];
}

const registry: CapabilityDefinition[] = [];
export function registerIntelligenceCapability(definition: CapabilityDefinition): CapabilityDefinition {
  if (registry.some((item) => item.id === definition.id)) throw new Error(`duplicate_intelligence_capability:${definition.id}`);
  registry.push(Object.freeze({ ...definition, dependencies: [...definition.dependencies], snapshot_aliases: [...definition.snapshot_aliases], implementation_evidence: [...definition.implementation_evidence] }));
  return definition;
}

const D = (id: string, name: string, domain: CapabilityDefinition["domain"], aliases: string[], evidence: string[], dependencies: string[] = []) =>
  registerIntelligenceCapability({ id, name, domain, description: name, dependencies, snapshot_aliases: aliases, implementation_evidence: evidence });

// One canonical inventory. The UI and API iterate this registry; adding a future
// capability does not require a second card list or a manually maintained score.
D("stage_a_interpretation", "Stage A Interpretation", "context", ["market_interpretation"], ["lib/interpretation/interpret-service.ts"]);
D("confirmed_commercial_context", "Confirmed Commercial Context", "context", [], ["lib/interpretation/confirmed-context-store.ts"], ["stage_a_interpretation"]);
D("context_execution_handoff", "Context → Execution", "context", [], ["lib/interpretation/discovery-context-adapter.ts"], ["confirmed_commercial_context"]);
D("lead_hunter", "Lead Hunter", "discovery", ["company_discovery"], ["lib/lead-hunter/candidate-universe.ts"], ["context_execution_handoff"]);
D("candidate_universe", "Candidate Universe", "discovery", ["company_discovery"], ["lib/lead-hunter/candidate-universe.ts"], ["lead_hunter"]);
D("corporate_identity", "Corporate Identity", "discovery", ["company_verification", "entity_resolution"], ["lib/discovery/corporate-identity.ts"], ["candidate_universe"]);
D("dynamic_universe_discovery", "Dynamic Universe Discovery", "discovery", ["company_discovery"], ["lib/discovery/company-universe.ts"], ["candidate_universe"]);
D("pre_research_relevance", "Pre-Research Relevance Gate", "discovery", ["structural_account_ranking"], ["lib/lead-hunter/candidate-universe.ts"], ["corporate_identity"]);
D("initial_research", "Initial Research", "research", ["deep_account_research"], ["lib/intelligence/productive-spine.ts", "lib/intelligence/account-deep-research.ts"], ["pre_research_relevance"]);
D("provider_routing", "Provider Routing", "operations", [], ["lib/monitor/provider-routing.ts"], ["initial_research"]);
D("source_quality", "Source Quality", "research", [], ["lib/discovery/source-intelligence-store.ts"], ["provider_routing"]);
D("source_association", "Source Association", "research", [], ["lib/discovery/company-first-discovery.ts"], ["corporate_identity", "source_quality"]);
D("full_text_extraction", "Full-Text Extraction", "research", [], ["lib/monitor/full-text-extraction.ts"], ["source_association"]);
D("structured_claim_extraction", "Structured Claim Extraction", "research", [], ["lib/monitor/claim-event-extractor.ts"], ["full_text_extraction"]);
D("event_extraction", "Event Extraction", "research", ["signal_detection"], ["lib/monitor/event-extraction.ts"], ["structured_claim_extraction"]);
D("event_dating", "Event Dating", "reasoning", ["temporal_reasoning"], ["lib/intelligence/evidence-temporal.ts"], ["event_extraction"]);
D("temporal_what_changed", "Temporal / What Changed", "reasoning", ["temporal_reasoning", "what_changed_detection"], ["lib/monitor/case-resynthesis.ts"], ["event_dating", "account_memory"]);
D("materiality", "Materiality", "reasoning", [], ["lib/discovery/materiality.ts"], ["event_extraction"]);
D("corroboration", "Corroboration", "reasoning", [], ["lib/discovery/quality-rubric.ts"], ["source_association"]);
D("counterevidence", "Counterevidence", "reasoning", ["counterevidence_analysis"], ["lib/discovery/counterevidence.ts"], ["initial_research"]);
D("fit", "Fit", "reasoning", ["client_specific_opportunity_assessment"], ["lib/discovery/commercial-fit.ts"], ["confirmed_commercial_context", "corporate_identity"]);
D("timing", "Timing", "reasoning", ["temporal_reasoning"], ["lib/discovery/opportunity-test.ts"], ["event_dating", "materiality"]);
D("evidence", "Evidence", "reasoning", [], ["lib/intelligence/evidence-store.ts"], ["source_association"]);
D("opportunity_case", "Opportunity Case Synthesis", "reasoning", ["recommendation_generation"], ["lib/monitor/canonical-case.ts"], ["fit", "timing", "evidence"]);
D("decision", "Decision", "reasoning", ["recommendation_generation"], ["lib/monitor/canonical-case.ts"], ["opportunity_case"]);
D("portfolio_intelligence", "Portfolio Intelligence", "reasoning", ["portfolio_strategy"], ["lib/deliverable/portfolio-intelligence.ts"], ["decision"]);
D("account_memory", "Account Memory", "monitor", ["account_memory", "anti_repetition"], ["lib/account-memory/store.ts"], ["opportunity_case"]);
D("monitor", "Monitor", "monitor", [], ["lib/monitor/canonical-monitor-service.ts"], ["account_memory"]);
D("monitor_identity", "Monitor Identity", "monitor", ["entity_resolution"], ["lib/monitor/canonical-monitor-service.ts"], ["monitor", "corporate_identity"]);
D("monitor_full_text", "Monitor Full-Text", "monitor", [], ["lib/monitor/full-text-extraction.ts"], ["monitor"]);
D("scheduler", "Scheduler", "monitor", [], ["lib/monitor/scheduler.ts"], ["monitor"]);
D("customer_run_lifecycle", "Customer Run Lifecycle", "operations", [], ["lib/intelligence/productive-spine-store.ts"], ["context_execution_handoff"]);
D("async_execution", "Async Execution", "operations", [], ["lib/intelligence/intelligence-run-dispatch.ts"], ["customer_run_lifecycle"]);
D("provider_budget", "Provider Budget Enforcement", "operations", [], ["lib/monitor/provider-routing.ts"], ["provider_routing"]);
D("provider_cooldown", "Provider Cooldown", "operations", [], ["lib/discovery/company-first-discovery.ts"], ["provider_routing"]);
D("cogs_instrumentation", "COGS Instrumentation", "operations", [], ["lib/ops/usage-ledger.ts"], ["provider_routing"]);
D("runtime_latency", "Runtime / Latency", "operations", [], ["lib/intelligence/productive-spine.ts"], ["async_execution"]);
D("exception_handling", "Exception Handling", "operations", [], ["lib/intelligence/productive-spine.ts"], ["async_execution"]);
D("tenant_isolation", "Tenant Isolation", "operations", [], ["lib/intelligence/productive-spine-store.ts"], ["customer_run_lifecycle"]);
D("autonomy", "Autonomy", "operations", [], ["lib/intelligence/productive-spine.ts"], ["async_execution", "provider_routing"]);
D("us_coverage", "US Coverage", "coverage", ["company_discovery"], ["lib/discovery/company-universe.ts"], ["dynamic_universe_discovery"]);
D("colombia_coverage", "Colombia Coverage", "coverage", ["company_discovery"], ["lib/discovery/source-intelligence/multi-country.ts"], ["dynamic_universe_discovery"]);
D("private_company_coverage", "Private-Company Coverage", "coverage", ["company_verification"], ["lib/discovery/company-universe.ts"], ["corporate_identity"]);
D("human_calibration", "Human Calibration", "learning", [], ["lib/intelligence/validation-lifecycle.ts"], ["opportunity_case"]);
D("ml_shadow_learning", "ML / Shadow Learning", "learning", ["feedback_learning", "outcome_learning"], ["lib/intelligence/shadow-preference.ts"], ["human_calibration"]);
D("production_soak", "Production Soak", "readiness", [], ["scripts/run-intelligence-soak-v1.mts"], ["async_execution", "opportunity_case"]);
D("launch_readiness", "Launch Readiness", "readiness", ["report_readiness_assessment"], ["lib/monitor/readiness.ts"], ["production_soak", "human_calibration"]);

export const INTELLIGENCE_CAPABILITY_REGISTRY = Object.freeze([...registry]);

export interface DynamicRecallSignals {
  generated_at: string;
  metrics: {
    researched_accounts: number;
    delivered_cases: number;
    structural_reasonable_including_borderline: number;
    structural_reasonable_rate: number;
    wrong_target_accounts: number;
    wrong_target_rate: number;
    human_positive_outcomes: number;
    bounded_positive_controls: number;
    bounded_positive_controls_captured_defensibly: number;
    bounded_capture_rate: number;
    provider_calls: number;
    observed_cost_usd: number;
    duration_ms: number;
    average_calls_per_run: number;
  };
  runs: Array<{ run_id: string; universe: number; researched: number; delivered: number; duration_ms: number }>;
}

export interface SoakSignals {
  generated_at?: string;
  summary?: Record<string, unknown>;
  runs?: unknown[];
}

export interface PositiveCaptureSignals {
  generated_at: string;
  diagnostic_only: true;
  production_seeded: false;
  summary: {
    references: number;
    captured_defensibly: number;
    bounded_capture_rate: number;
    duration_ms: number;
    provider_calls: number;
    extractions: number;
    observed_cost_usd: number | null;
  };
}

export interface CapabilityControlPlaneInput {
  now: string;
  snapshot_capabilities: IntelligenceCapabilityAssessment[];
  dynamic_recall: DynamicRecallSignals | null;
  positive_capture?: PositiveCaptureSignals | null;
  soak: SoakSignals | null;
  monitor_sample: number;
  monitor_false_novelty: number | null;
  account_memory_records: number | null;
  provider_usage?: Record<string, {
    calls_today?: number; errors_today?: number; last_success?: string | null;
    last_failure?: string | null; last_error?: string | null;
    calculated_cost_usd_today?: number | null;
  }>;
  controlled_validation_evidence?: ControlPlaneValidationEvidenceV1[];
}

export interface CapabilityMaturityEvaluation {
  capability: CapabilityDefinition;
  score: MeasurementResult;
  confidence: CapabilityConfidence;
  state: CapabilityState;
  dimensions: Record<CapabilityDimensionId, MeasurementResult>;
  supporting_metrics: Record<string, number | string | null>;
  evidence: IntelligenceEvidenceReference[];
  blockers: string[];
  evidence_freshness_days: number | null;
  last_evaluated_at: string;
}

export interface IntelligenceControlPlane {
  version: string;
  generated_at: string;
  overall: MeasurementResult;
  overall_confidence: CapabilityConfidence;
  state_counts: Record<CapabilityState, number>;
  capabilities: CapabilityMaturityEvaluation[];
  critical_blockers: string[];
  evidence_policy: string[];
  validation_evidence?: ControlPlaneValidationEvidenceV1[];
}

const DIMENSION_WEIGHTS: Record<CapabilityDimensionId, number> = {
  implementation: 0.08, integration: 0.14, correctness: 0.15,
  real_world_validation: 0.17, reliability: 0.11, quality: 0.16,
  observability: 0.08, economics: 0.05, autonomy: 0.06,
};
const dimensionIds = Object.keys(DIMENSION_WEIGHTS) as CapabilityDimensionId[];
const missing = (reason: string, sample = 0) => unmeasured("insufficient_evidence", reason, sample);
const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function confidenceLabel(value: number): CapabilityConfidence {
  return value >= 0.72 ? "high" : value >= 0.42 ? "medium" : "low";
}

function freshnessDays(date: string | null | undefined, now: string): number | null {
  if (!date) return null;
  const days = Math.floor((new Date(now).getTime() - new Date(date).getTime()) / 86_400_000);
  return Number.isFinite(days) && days >= 0 ? days : null;
}

function baseDimensions(def: CapabilityDefinition, source: IntelligenceCapabilityAssessment | null): Record<CapabilityDimensionId, MeasurementResult> {
  const dimensions = Object.fromEntries(dimensionIds.map((id) => [id, missing(`${id} not instrumented`)])) as Record<CapabilityDimensionId, MeasurementResult>;
  if (def.implementation_evidence.length) dimensions.implementation = measured(100, 0.35, def.implementation_evidence.length);
  if (source) {
    if (source.mode === "production") dimensions.integration = measured(92, Math.max(0.45, source.maturity_confidence ?? 0.45), Math.max(1, source.sample_size));
    else if (["foundation", "observation", "human_reviewed"].includes(source.mode)) dimensions.integration = measured(58, 0.4, Math.max(1, source.sample_size));
    if (isMeasured(source.success_rate)) dimensions.correctness = source.success_rate;
    if (source.evidence.length) dimensions.observability = measured(75, 0.45, source.evidence.length);
  }
  return dimensions;
}

function scoreDimensions(dimensions: Record<CapabilityDimensionId, MeasurementResult>): MeasurementResult {
  const measuredDimensions = dimensionIds.filter((id) => isMeasured(dimensions[id]));
  if (measuredDimensions.length < 3) return unmeasured("insufficient_evidence", `only ${measuredDimensions.length}/9 dimensions measured`, measuredDimensions.length);
  const weight = measuredDimensions.reduce((sum, id) => sum + DIMENSION_WEIGHTS[id], 0);
  const score = measuredDimensions.reduce((sum, id) => sum + (dimensions[id] as { score: number }).score * DIMENSION_WEIGHTS[id], 0) / weight;
  const confidence = measuredDimensions.reduce((sum, id) => sum + (dimensions[id] as { confidence: number }).confidence * DIMENSION_WEIGHTS[id], 0) / weight;
  const sample = Math.max(...measuredDimensions.map((id) => (dimensions[id] as { sample_size: number }).sample_size));
  return measured(clamp(score), Math.min(0.9, confidence), sample);
}

function stateFor(dimensions: Record<CapabilityDimensionId, MeasurementResult>, score: MeasurementResult, blockers: string[]): CapabilityState {
  if (blockers.some((b) => b.startsWith("BLOCKED:"))) return "blocked";
  const q = dimensions.quality, r = dimensions.reliability, live = dimensions.real_world_validation;
  if ((isMeasured(q) && q.score < 50) || (isMeasured(r) && r.score < 50)) return "degraded";
  if (isMeasured(live) && live.sample_size >= 5 && live.score >= 80 && isMeasured(q) && q.score >= 75) return "soak_validated";
  if (isMeasured(live) && live.sample_size > 0 && live.score >= 70 && isMeasured(q) && q.score >= 70) return "live_validated";
  if (isMeasured(dimensions.integration) && dimensions.integration.score >= 80) return "production_wired";
  if (isMeasured(dimensions.correctness) && dimensions.correctness.score >= 75) return "domain_proven";
  if (isMeasured(dimensions.implementation)) return "implemented";
  return "not_started";
}

function stateWithSemanticBlockers(def: CapabilityDefinition, dimensions: Record<CapabilityDimensionId, MeasurementResult>, score: MeasurementResult, blockers: string[]): CapabilityState {
  const state = stateFor(dimensions, score, blockers);
  if (["opportunity_case", "decision", "human_calibration", "launch_readiness"].includes(def.id) && blockers.some((blocker) => /no customer-safe Case has been human-confirmed/i.test(blocker))) return "degraded";
  return state;
}

function dynamicOverrides(def: CapabilityDefinition, dimensions: Record<CapabilityDimensionId, MeasurementResult>, input: CapabilityControlPlaneInput, metrics: Record<string, number | string | null>, blockers: string[], evidence: IntelligenceEvidenceReference[]) {
  const recall = input.dynamic_recall;
  if (!recall) return;
  const m = recall.metrics;
  const runCount = recall.runs.length;
  if (["dynamic_universe_discovery", "lead_hunter", "candidate_universe", "us_coverage", "pre_research_relevance"].includes(def.id)) {
    dimensions.integration = measured(92, 0.75, runCount);
    dimensions.real_world_validation = measured(clamp(m.structural_reasonable_rate * 100), 0.62, m.researched_accounts);
    dimensions.quality = measured(clamp(m.structural_reasonable_rate * 100), 0.62, m.researched_accounts);
    dimensions.reliability = measured(clamp((recall.runs.filter((r) => r.universe > 0).length / Math.max(1, runCount)) * 100), 0.58, runCount);
    dimensions.observability = measured(90, 0.8, runCount);
    dimensions.economics = measured(m.average_calls_per_run <= 35 ? 88 : clamp(100 - (m.average_calls_per_run - 35) * 4), 0.7, runCount);
    dimensions.autonomy = measured(90, 0.6, runCount);
    metrics.structural_reasonable_rate = m.structural_reasonable_rate;
    metrics.wrong_target_rate = m.wrong_target_rate;
    metrics.capture_proxy = m.bounded_capture_rate;
    metrics.runs = runCount;
    metrics.researched_accounts = m.researched_accounts;
    evidence.push({ id: `${def.id}:recall-v1`, kind: "human_review", ref: "ml/data/acceptance/dynamic-universe-recall-v1.json", dated: true, date: recall.generated_at });
  }
  if (["dynamic_universe_discovery", "us_coverage", "initial_research", "opportunity_case", "decision", "human_calibration", "launch_readiness"].includes(def.id)) {
    // Real outcome truth overrides implementation/tests. Zero captured positives
    // is a measured poor result, never an unearned 100% precision.
    const positive = input.positive_capture?.summary;
    const controls = positive?.references ?? m.bounded_positive_controls;
    const captured = positive?.captured_defensibly ?? m.bounded_positive_controls_captured_defensibly;
    const rate = positive?.bounded_capture_rate ?? m.bounded_capture_rate;
    dimensions.real_world_validation = measured(clamp(rate * 100), 0.58, controls);
    dimensions.quality = measured(clamp(rate * 100), 0.58, controls);
    metrics.positive_controls = controls;
    metrics.positive_controls_captured = captured;
    metrics.positive_capture_rate = rate;
    metrics.human_positive_cases = m.human_positive_outcomes;
    if (input.positive_capture) evidence.push({ id: `${def.id}:positive-capture-v1`, kind: "exercised_run", ref: "ml/data/acceptance/account-deep-research-positive-control-v1.json", dated: true, date: input.positive_capture.generated_at });
    if (captured === 0) blockers.push(`No defensibly captured event in the latest positive-control sample (0/${controls}).`);
    else if (m.human_positive_outcomes === 0) blockers.push(`${captured}/${controls} diagnostic events were captured, but no customer-safe Case has been human-confirmed.`);
  }
  if (["cogs_instrumentation", "provider_budget"].includes(def.id)) {
    dimensions.integration = measured(90, 0.75, runCount);
    dimensions.observability = measured(92, 0.8, runCount);
    dimensions.economics = measured(m.average_calls_per_run <= 35 ? 88 : 45, 0.75, runCount);
    metrics.provider_calls = m.provider_calls;
    metrics.average_calls_per_run = m.average_calls_per_run;
    metrics.observed_cost_usd = m.observed_cost_usd;
  }
  if (def.id === "runtime_latency") {
    const p95 = Math.max(...recall.runs.map((r) => r.duration_ms));
    const latencyScore = p95 <= 180_000 ? 90 : p95 <= 300_000 ? 65 : p95 <= 360_000 ? 45 : 20;
    dimensions.integration = measured(90, 0.75, runCount);
    dimensions.reliability = measured(latencyScore, 0.7, runCount);
    dimensions.observability = measured(90, 0.8, runCount);
    metrics.p95_runtime_ms = p95;
    if (p95 > 300_000) blockers.push(`Runtime p95/max ${p95}ms exceeds the 300000ms operating ceiling.`);
  }
}

function controlledAcceptanceOverrides(def: CapabilityDefinition, dimensions: Record<CapabilityDimensionId, MeasurementResult>, input: CapabilityControlPlaneInput, metrics: Record<string, number | string | null>, blockers: string[], evidence: IntelligenceEvidenceReference[]) {
  const rows = dedupeValidationEvidence(input.controlled_validation_evidence ?? []);
  if (!rows.length) return;
  const sum = (pick: (row: ControlPlaneValidationEvidenceV1) => number) => rows.reduce((total, row) => total + pick(row), 0);
  const latest = [...rows].sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at))[0];
  const ref = { id: `${def.id}:controlled-validation:${latest.source_fingerprint.slice(0, 12)}`, kind: "exercised_run" as const, ref: `controlled_acceptance:${latest.evidence_id}`, dated: true, date: latest.observed_at };
  const positiveControls = sum((r) => r.metrics.positive_capture.controls);
  const positiveCaptured = sum((r) => r.metrics.positive_capture.captured);
  const positiveRate = positiveControls ? positiveCaptured / positiveControls : 0;
  const customerSafeCases = sum((r) => r.metrics.human_validation.customer_safe_cases);

  if (["dynamic_universe_discovery", "initial_research", "event_extraction", "opportunity_case", "decision", "human_calibration", "launch_readiness"].includes(def.id)) {
    dimensions.real_world_validation = measured(clamp(positiveRate * 100), 0.68, positiveControls);
    dimensions.quality = measured(clamp(positiveRate * 100), 0.68, positiveControls);
    metrics.positive_controls = positiveControls;
    metrics.positive_controls_captured = positiveCaptured;
    metrics.positive_capture_rate = positiveRate;
    metrics.human_positive_cases = customerSafeCases;
    evidence.push(ref);
    if (customerSafeCases === 0) blockers.push(`${positiveCaptured}/${positiveControls} diagnostic events were captured, but no customer-safe Case has been human-confirmed.`);
  }

  if (def.id === "human_calibration") {
    const tp = sum((r) => r.metrics.human_validation.true_positives);
    const fp = sum((r) => r.metrics.human_validation.false_positives);
    const fn = sum((r) => r.metrics.human_validation.false_negatives);
    const tn = sum((r) => r.metrics.human_validation.true_negatives);
    const precisionN = tp + fp;
    const recallN = tp + fn;
    if (precisionN) dimensions.correctness = measured(clamp(tp / precisionN * 100), 0.72, precisionN);
    if (recallN) dimensions.quality = measured(clamp(tp / recallN * 100), 0.7, recallN);
    metrics.true_positives = tp; metrics.false_positives = fp; metrics.false_negatives = fn; metrics.true_negatives = tn;
  }

  if (["tenant_isolation", "customer_run_lifecycle"].includes(def.id)) {
    const controls = sum((r) => r.metrics.tenant_isolation.controls);
    const passed = sum((r) => r.metrics.tenant_isolation.passed);
    const realRuns = sum((r) => r.metrics.tenant_isolation.real_acceptance_runs);
    const rate = controls ? passed / controls : 0;
    dimensions.integration = measured(92, 0.76, controls);
    dimensions.correctness = measured(clamp(rate * 100), 0.78, controls);
    dimensions.real_world_validation = measured(clamp(rate * 100), 0.7, Math.max(1, realRuns));
    dimensions.reliability = measured(clamp(rate * 100), 0.72, controls);
    dimensions.quality = measured(clamp(rate * 100), 0.72, controls);
    metrics.controlled_acceptance_passed = passed; metrics.controlled_acceptance_controls = controls; metrics.real_acceptance_runs = realRuns;
    evidence.push(ref);
  }

  if (["production_soak", "portfolio_intelligence", "launch_readiness"].includes(def.id)) {
    const controls = sum((r) => r.metrics.report_safety.controls);
    const passed = sum((r) => r.metrics.report_safety.passed);
    const falseSuccesses = sum((r) => r.metrics.report_safety.false_successes);
    const realRuns = sum((r) => r.metrics.report_safety.real_acceptance_runs);
    const rate = controls ? passed / controls : 0;
    dimensions.correctness = measured(clamp(rate * 100), 0.75, controls);
    dimensions.reliability = measured(clamp((1 - falseSuccesses / Math.max(1, controls)) * 100), 0.72, controls);
    if (realRuns) dimensions.real_world_validation = measured(clamp(rate * 100), 0.62, realRuns);
    metrics.report_safety_passed = passed; metrics.report_safety_controls = controls; metrics.false_successes = falseSuccesses;
    evidence.push(ref);
  }

  if (["candidate_universe", "pre_research_relevance"].includes(def.id)) {
    const controls = sum((r) => r.metrics.candidate_hygiene.controls);
    const rejected = sum((r) => r.metrics.candidate_hygiene.rejected_non_accounts);
    const leaks = sum((r) => r.metrics.candidate_hygiene.leaks);
    dimensions.correctness = measured(clamp(rejected / Math.max(1, controls) * 100), 0.7, controls);
    dimensions.quality = measured(clamp((1 - leaks / Math.max(1, controls)) * 100), 0.7, controls);
    metrics.non_account_controls = controls; metrics.non_accounts_rejected = rejected; metrics.candidate_leaks = leaks;
    evidence.push(ref);
  }

  if (def.id === "runtime_latency") {
    const historicalP95 = Math.max(...rows.map((r) => r.metrics.runtime.historical_p95_ms));
    const recent = latest.metrics.runtime.recent_ms;
    const sample = sum((r) => r.metrics.runtime.historical_sample);
    const latencyScore = historicalP95 <= 180_000 ? 90 : historicalP95 <= 300_000 ? 65 : historicalP95 <= 360_000 ? 45 : 20;
    dimensions.reliability = measured(latencyScore, 0.74, sample);
    dimensions.observability = measured(92, 0.8, sample);
    metrics.recent_runtime_ms = recent; metrics.p95_runtime_ms = historicalP95;
    evidence.push(ref);
    if (historicalP95 > 300_000) blockers.push(`Runtime p95/max ${historicalP95}ms exceeds the 300000ms operating ceiling.`);
  }

  if (["provider_cooldown", "provider_routing", "exception_handling"].includes(def.id)) {
    const controls = sum((r) => r.metrics.provider_degradation.controls);
    const passed = sum((r) => r.metrics.provider_degradation.passed);
    const failures = sum((r) => r.metrics.provider_degradation.observed_failures);
    dimensions.integration = measured(92, 0.75, controls);
    dimensions.reliability = measured(clamp(passed / Math.max(1, controls) * 100), 0.72, controls);
    dimensions.observability = measured(92, 0.8, controls);
    metrics.degradation_controls = controls; metrics.degradation_passed = passed; metrics.observed_provider_failures = failures; metrics.provider_state = latest.metrics.provider_degradation.provider_state;
    evidence.push(ref);
  }
}

export function applyControlPlaneValidationEvidence(
  plane: IntelligenceControlPlane,
  incoming: ControlPlaneValidationEvidenceV1[],
  now = new Date().toISOString(),
): IntelligenceControlPlane {
  const existing = dedupeValidationEvidence(plane.validation_evidence ?? []);
  const rows = dedupeValidationEvidence([...existing, ...incoming]);
  if (rows.length === existing.length) return plane;
  const input: CapabilityControlPlaneInput = {
    now, snapshot_capabilities: [], dynamic_recall: null, soak: null,
    monitor_sample: 0, monitor_false_novelty: null, account_memory_records: null,
    controlled_validation_evidence: rows,
  };
  const replaceableBlocker = /(?:No defensibly captured event|No human-defensible positive Case|diagnostic events were captured, but no customer-safe Case|Runtime p95\/max .* operating ceiling)/i;
  const capabilities = plane.capabilities.map((item) => {
    const dimensions = { ...item.dimensions };
    const supporting_metrics = { ...item.supporting_metrics };
    const evidence = [...item.evidence];
    const blockers = item.blockers.filter((blocker) => !replaceableBlocker.test(blocker));
    controlledAcceptanceOverrides(item.capability, dimensions, input, supporting_metrics, blockers, evidence);
    const score = scoreDimensions(dimensions);
    const state = stateWithSemanticBlockers(item.capability, dimensions, score, blockers);
    const dates = evidence.map((entry) => entry.date).filter((date): date is string => Boolean(date)).sort();
    return {
      ...item, dimensions, supporting_metrics, evidence, blockers, score, state,
      confidence: confidenceLabel(isMeasured(score) ? score.confidence : 0.2),
      evidence_freshness_days: freshnessDays(dates.at(-1), now), last_evaluated_at: now,
    };
  });
  const scored = capabilities.filter((item) => isMeasured(item.score));
  let overall: MeasurementResult = scored.length >= 10
    ? measured(
        clamp(scored.reduce((sum, item) => sum + (item.score as { score: number }).score, 0) / scored.length),
        Math.min(0.85, scored.reduce((sum, item) => sum + (item.score as { confidence: number }).confidence, 0) / scored.length),
        scored.length,
      )
    : unmeasured("insufficient_evidence", `only ${scored.length}/${capabilities.length} capabilities have multidimensional evidence`, scored.length);
  const humanCases = rows.reduce((sum, row) => sum + row.metrics.human_validation.customer_safe_cases, 0);
  if (isMeasured(overall) && humanCases === 0) overall = measured(Math.min(overall.score, 59), Math.min(overall.confidence, 0.62), overall.sample_size);
  const state_counts = Object.fromEntries(CAPABILITY_STATES.map((state) => [state, capabilities.filter((item) => item.state === state).length])) as Record<CapabilityState, number>;
  const critical_blockers = Array.from(new Set(capabilities.filter((item) => ["blocked", "degraded"].includes(item.state) || item.capability.id === "launch_readiness").flatMap((item) => item.blockers))).slice(0, 12);
  return { ...plane, generated_at: now, overall, overall_confidence: confidenceLabel(isMeasured(overall) ? overall.confidence : 0.2), state_counts, capabilities, critical_blockers, validation_evidence: rows };
}

export function buildCapabilityControlPlane(input: CapabilityControlPlaneInput): IntelligenceControlPlane {
  const sourceByAlias = new Map<string, IntelligenceCapabilityAssessment>();
  for (const source of input.snapshot_capabilities) sourceByAlias.set(source.capability_id, source);

  const capabilities = INTELLIGENCE_CAPABILITY_REGISTRY.map((def): CapabilityMaturityEvaluation => {
    const source = def.snapshot_aliases.map((id) => sourceByAlias.get(id)).find(Boolean) ?? null;
    const dimensions = baseDimensions(def, source);
    const evidence: IntelligenceEvidenceReference[] = source ? [...source.evidence] : def.implementation_evidence.map((ref, index) => ({ id: `${def.id}:implementation:${index}`, kind: "schema_exists" as const, ref }));
    const supporting_metrics: Record<string, number | string | null> = {};
    const blockers: string[] = [];
    dynamicOverrides(def, dimensions, input, supporting_metrics, blockers, evidence);
    controlledAcceptanceOverrides(def, dimensions, input, supporting_metrics, blockers, evidence);

    if (["provider_routing", "provider_cooldown", "cogs_instrumentation"].includes(def.id) && input.provider_usage) {
      const usageRows = Object.entries(input.provider_usage);
      const calls = usageRows.reduce((sum, [, value]) => sum + (value.calls_today ?? 0), 0);
      const errors = usageRows.reduce((sum, [, value]) => sum + (value.errors_today ?? 0), 0);
      const cost = usageRows.reduce((sum, [, value]) => sum + (value.calculated_cost_usd_today ?? 0), 0);
      const nowMs = new Date(input.now).getTime();
      const recentFailures = usageRows.filter(([, value]) => value.last_failure && nowMs - new Date(value.last_failure).getTime() < 86_400_000).length;
      supporting_metrics.calls_today = calls;
      supporting_metrics.errors_today = errors;
      supporting_metrics.observed_cost_today_usd = Number(cost.toFixed(6));
      supporting_metrics.providers_with_recent_failure = recentFailures;
      if (calls > 0) {
        dimensions.reliability = measured(clamp((1 - errors / calls) * 100), Math.min(0.8, calls / 50), calls);
        dimensions.observability = measured(92, 0.8, calls);
      }
      if (def.id === "provider_cooldown" && recentFailures > 0) dimensions.integration = measured(90, 0.7, recentFailures);
    }

    if (["monitor", "monitor_identity", "monitor_full_text", "temporal_what_changed"].includes(def.id) && input.monitor_sample > 0) {
      dimensions.integration = measured(90, 0.7, input.monitor_sample);
      dimensions.real_world_validation = measured(88, 0.65, input.monitor_sample);
      if (input.monitor_false_novelty !== null) dimensions.quality = measured(input.monitor_false_novelty === 0 ? 95 : clamp(100 - input.monitor_false_novelty * 20), 0.7, input.monitor_sample);
      dimensions.observability = measured(85, 0.7, input.monitor_sample);
      supporting_metrics.monitor_sample = input.monitor_sample;
      supporting_metrics.false_novelty = input.monitor_false_novelty;
    }
    if (def.id === "account_memory" && (input.account_memory_records ?? 0) > 0) {
      dimensions.integration = measured(92, 0.65, input.account_memory_records!);
      dimensions.reliability = measured(90, 0.55, input.account_memory_records!);
      dimensions.observability = measured(80, 0.55, input.account_memory_records!);
      supporting_metrics.records = input.account_memory_records;
    }
    if (def.id === "scheduler") {
      dimensions.integration = measured(45, 0.7, 1);
      blockers.push("Scheduler infrastructure exists but cron remains OFF.");
    }
    if (def.id === "ml_shadow_learning") blockers.push("Shadow/observation only; ranking impact remains OFF.");

    const score = scoreDimensions(dimensions);
    const state = stateWithSemanticBlockers(def, dimensions, score, blockers);
    const confidenceValue = isMeasured(score) ? score.confidence : 0.2;
    const dates = evidence.map((item) => item.date).filter((date): date is string => Boolean(date));
    const latest = dates.sort().at(-1) ?? source?.last_exercised ?? null;
    return {
      capability: def, score, confidence: confidenceLabel(confidenceValue), state, dimensions,
      supporting_metrics, evidence, blockers,
      evidence_freshness_days: freshnessDays(latest, input.now), last_evaluated_at: input.now,
    };
  });

  const scored = capabilities.filter((item) => isMeasured(item.score));
  let overall: MeasurementResult = scored.length >= 10
    ? measured(
        clamp(scored.reduce((sum, item) => sum + (item.score as { score: number }).score, 0) / scored.length),
        Math.min(0.85, scored.reduce((sum, item) => sum + (item.score as { confidence: number }).confidence, 0) / scored.length),
        scored.length,
      )
    : unmeasured("insufficient_evidence", `only ${scored.length}/${capabilities.length} capabilities have multidimensional evidence`, scored.length);
  // A control-plane score cannot outrun its latest real commercial validation.
  const controlledHumanCases = dedupeValidationEvidence(input.controlled_validation_evidence ?? []).reduce((sum, row) => sum + row.metrics.human_validation.customer_safe_cases, 0);
  if (isMeasured(overall) && (input.dynamic_recall?.metrics.human_positive_outcomes === 0 || ((input.controlled_validation_evidence?.length ?? 0) > 0 && controlledHumanCases === 0))) overall = measured(Math.min(overall.score, 59), Math.min(overall.confidence, 0.62), overall.sample_size);

  const state_counts = Object.fromEntries(CAPABILITY_STATES.map((state) => [state, capabilities.filter((item) => item.state === state).length])) as Record<CapabilityState, number>;
  const critical_blockers = Array.from(new Set(capabilities.filter((item) => ["blocked", "degraded"].includes(item.state) || item.capability.id === "launch_readiness").flatMap((item) => item.blockers))).slice(0, 12);
  return {
    version: CAPABILITY_CONTROL_PLANE_VERSION, generated_at: input.now, overall,
    overall_confidence: confidenceLabel(isMeasured(overall) ? overall.confidence : 0.2),
    state_counts, capabilities, critical_blockers,
    evidence_policy: [
      "Real live and production observations override tests and implementation presence.",
      "Repeated controlled soak overrides one-off acceptance.",
      "Unit tests and code presence can establish implementation/correctness only, never live validation.",
      "A rate with denominator zero is not measured.",
      "Scores may decrease when runtime, failure, quality, or human validation worsens.",
    ],
    validation_evidence: dedupeValidationEvidence(input.controlled_validation_evidence ?? []),
  };
}
