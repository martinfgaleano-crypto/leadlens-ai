import { isMeasured, type MeasurementResult } from "./os-contracts";
import type { CapabilityMaturityEvaluation, IntelligenceControlPlane } from "./capability-control-plane";

export const LAUNCH_READINESS_VERSION = "launch-readiness-v1";

export type LaunchGateState = "pass" | "degraded" | "fail" | "unmeasured";
export type LaunchReadinessLevel = "not_ready" | "internal_pilot" | "guided_beta" | "limited_launch" | "launch_ready";

export interface LaunchReadinessGate {
  id: string;
  label: string;
  weight: number;
  state: LaunchGateState;
  score: number | null;
  sample_size: number;
  reason: string;
  evidence: string[];
  capability_ids: string[];
  next_action: string | null;
}

export interface LaunchReadinessAssessment {
  version: string;
  evaluated_at: string;
  score: number;
  level: LaunchReadinessLevel;
  confidence: "low" | "medium" | "high";
  sample_size: number;
  gates: LaunchReadinessGate[];
  blockers: string[];
  limitations: string[];
  source_data_cutoff: string | null;
  automatic: true;
  policy: string[];
}

export interface LaunchReadinessInput {
  now: string;
  control_plane: IntelligenceControlPlane;
  production_config: {
    supabase: boolean;
    admin_auth: boolean;
    internal_run_auth: boolean;
    app_url: boolean;
    demo_off: boolean;
  };
  database_available: boolean;
}

type GateDefinition = {
  id: string; label: string; weight: number; capabilities: string[]; next: string;
};

const DEFINITIONS: GateDefinition[] = [
  { id: "customer_context", label: "Confirmed customer context", weight: 8, capabilities: ["stage_a_interpretation", "confirmed_commercial_context", "context_execution_handoff"], next: "Complete and exercise the confirmed-context handoff." },
  { id: "account_discovery", label: "Account discovery quality", weight: 15, capabilities: ["candidate_universe", "corporate_identity", "dynamic_universe_discovery", "pre_research_relevance"], next: "Capture defensible positive controls without relaxing identity gates." },
  { id: "research_evidence", label: "Research and evidence integrity", weight: 12, capabilities: ["initial_research", "source_association", "full_text_extraction", "structured_claim_extraction", "event_extraction"], next: "Increase dated, attributable and corroborated evidence." },
  { id: "opportunity_reasoning", label: "Opportunity reasoning", weight: 15, capabilities: ["event_dating", "materiality", "corroboration", "counterevidence", "fit", "timing", "opportunity_case", "decision"], next: "Validate complete Cases with human-reviewed commercial outcomes." },
  { id: "human_validation", label: "Human validation", weight: 12, capabilities: ["human_calibration"], next: "Persist a representative reviewed sample with true positives and false negatives." },
  { id: "runtime_reliability", label: "Runtime and failure recovery", weight: 10, capabilities: ["runtime_latency", "exception_handling", "async_execution"], next: "Bring p95 execution below the operating ceiling and repeat the soak." },
  { id: "tenant_security", label: "Tenant isolation and admin safety", weight: 8, capabilities: ["tenant_isolation", "customer_run_lifecycle"], next: "Exercise authenticated tenant isolation in production." },
  { id: "provider_economics", label: "Provider resilience and COGS", weight: 7, capabilities: ["provider_routing", "provider_budget", "provider_cooldown", "cogs_instrumentation"], next: "Observe provider success, failure and cost over real runs." },
  { id: "monitor_memory", label: "Monitor and Account Memory", weight: 6, capabilities: ["account_memory", "monitor", "monitor_identity", "temporal_what_changed"], next: "Validate repeated monitor cycles without false novelty." },
  { id: "report_safety", label: "Customer-safe report delivery", weight: 7, capabilities: ["portfolio_intelligence", "production_soak", "launch_readiness"], next: "Complete a customer-safe, human-approved production soak." },
];

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function measuredScore(capability: CapabilityMaturityEvaluation): number | null {
  return isMeasured(capability.score) ? capability.score.score : null;
}

function gateFrom(def: GateDefinition, byId: Map<string, CapabilityMaturityEvaluation>): LaunchReadinessGate {
  const capabilities = def.capabilities.map((id) => byId.get(id)).filter((item): item is CapabilityMaturityEvaluation => Boolean(item));
  const scores = capabilities.map(measuredScore).filter((score): score is number => score !== null);
  const sample = Math.max(0, ...capabilities.flatMap((item) => isMeasured(item.score) ? [item.score.sample_size] : []));
  const hardFailure = capabilities.some((item) => item.state === "blocked");
  const degraded = capabilities.some((item) => item.state === "degraded");
  const score = scores.length ? clamp(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
  const state: LaunchGateState = hardFailure ? "fail" : degraded || (score !== null && score < 60) ? "degraded" : score === null ? "unmeasured" : score >= 75 ? "pass" : "degraded";
  const blockers = capabilities.flatMap((item) => item.blockers);
  return {
    id: def.id, label: def.label, weight: def.weight, state, score, sample_size: sample,
    reason: blockers[0] ?? (score === null ? "No multidimensional production evidence is available." : `${scores.length}/${def.capabilities.length} capabilities provide measurable evidence.`),
    evidence: Array.from(new Set(capabilities.flatMap((item) => item.evidence.map((e) => e.ref)))).slice(0, 8),
    capability_ids: def.capabilities,
    next_action: state === "pass" ? null : def.next,
  };
}

export function buildLaunchReadiness(input: LaunchReadinessInput): LaunchReadinessAssessment {
  const byId = new Map(input.control_plane.capabilities.map((item) => [item.capability.id, item]));
  const gates = DEFINITIONS.map((def) => gateFrom(def, byId));
  const configChecks = Object.values(input.production_config);
  const coreConfigReady = input.production_config.supabase && input.production_config.admin_auth &&
    input.production_config.app_url && input.production_config.demo_off && input.database_available;
  const fullConfigReady = coreConfigReady && input.production_config.internal_run_auth;
  gates.push({
    id: "production_configuration", label: "Production configuration", weight: 10,
    state: !coreConfigReady ? "fail" : fullConfigReady ? "pass" : "degraded",
    score: Math.round((configChecks.filter(Boolean).length + Number(input.database_available)) / (configChecks.length + 1) * 100),
    sample_size: configChecks.length + 1,
    reason: !coreConfigReady
      ? "A core database, Admin-auth, application URL, or demo-isolation control is unavailable."
      : fullConfigReady
        ? "Required runtime configuration and database access are present."
        : "Internal guided pilots remain available, but the authenticated asynchronous customer worker is unavailable without INTERNAL_RUN_SECRET.",
    evidence: ["runtime environment presence checks", "database-backed Admin loader"], capability_ids: [],
    next_action: fullConfigReady ? null : !coreConfigReady ? "Restore missing core runtime controls or database access." : "Configure INTERNAL_RUN_SECRET before closed-alpha or self-serve asynchronous execution.",
  });

  const totalWeight = gates.reduce((sum, gate) => sum + gate.weight, 0);
  const value = (gate: LaunchReadinessGate) => gate.state === "pass" ? 100 : gate.state === "degraded" ? 50 : 0;
  let score = clamp(gates.reduce((sum, gate) => sum + value(gate) * gate.weight, 0) / totalWeight);
  const positiveCase = byId.get("opportunity_case")?.supporting_metrics.human_positive_cases;
  if (positiveCase === 0) score = Math.min(score, 49);
  if (gates.find((gate) => gate.id === "production_configuration")?.state === "fail") score = Math.min(score, 39);
  if (gates.find((gate) => gate.id === "tenant_security")?.state === "fail") score = Math.min(score, 24);
  const measuredGates = gates.filter((gate) => gate.score !== null);
  const sampleSize = Math.max(0, ...gates.map((gate) => gate.sample_size));
  const confidence = measuredGates.length >= gates.length * 0.8 && sampleSize >= 8 ? "high" : measuredGates.length >= gates.length * 0.5 ? "medium" : "low";
  const level: LaunchReadinessLevel = score >= 90 ? "launch_ready" : score >= 75 ? "limited_launch" : score >= 55 ? "guided_beta" : score >= 30 ? "internal_pilot" : "not_ready";
  const materialEvidenceDates = input.control_plane.capabilities
    .flatMap((item) => item.evidence.map((e) => e.date).filter((date): date is string => Boolean(date)))
    .filter((date) => Number.isFinite(new Date(date).getTime()))
    .sort();
  return {
    version: LAUNCH_READINESS_VERSION, evaluated_at: input.now, score, level, confidence, sample_size: sampleSize, gates,
    blockers: gates.filter((gate) => gate.state === "fail").map((gate) => `${gate.label}: ${gate.reason}`),
    limitations: gates.filter((gate) => gate.state === "degraded" || gate.state === "unmeasured").map((gate) => `${gate.label}: ${gate.reason}`),
    // Evaluation time is not evidence time. A page refresh must not create a
    // material-history snapshot when the underlying evidence did not change.
    source_data_cutoff: materialEvidenceDates.at(-1) ?? null, automatic: true,
    policy: [
      "Readiness is recomputed from current evidence; no browser checkbox or manually edited percentage contributes.",
      "Real production and human evidence overrides implementation and unit-test presence.",
      "Zero defensible positive Cases caps readiness below guided beta regardless of code completeness.",
      "Missing production controls, tenant isolation failures and quality regressions can lower readiness.",
      "Payments are not an Intelligence launch-quality gate and are evaluated separately.",
    ],
  };
}

export function launchReadinessFingerprint(assessment: LaunchReadinessAssessment): string {
  return [assessment.version, assessment.source_data_cutoff, assessment.score, assessment.level, ...assessment.gates.map((g) => `${g.id}:${g.state}:${g.score}:${g.sample_size}`)].join("|");
}
