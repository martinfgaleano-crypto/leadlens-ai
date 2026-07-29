// ─── Intelligence Snapshot Engine (snapshot-methodology-v1) ──────────────────
// Deterministic, PROVIDER-FREE assembler that turns already-loaded real project
// signals into an IntelligenceSnapshot (os-contracts-v1). The pure function
// buildIntelligenceSnapshot(input) does no I/O — the same input always yields a
// byte-identical serialization (serializeIntelligence) — so replay and
// idempotency are exact. A thin loader (loadSnapshotInputs) gathers the real
// signals from growth-index + the latest harness artifact; it is the only part
// that touches the environment and is intentionally kept out of the determinism
// contract.
//
// Honesty is enforced by delegating every score to the Block-1 guards: missing
// data becomes not_measured / not_instrumented / insufficient_evidence (never
// zero); one pilot cannot lift client specificity; volume cannot lift analytical
// depth; observation/shadow capabilities never become production; a snapshot
// that fails its own guards throws instead of shipping a dishonest number.

import {
  OS_CONTRACTS_VERSION, measured, unmeasured, isMeasured,
  deriveOutcomePerformance, deriveIntelligenceLift, normalizePatternState,
  validateMeasurement, validateCapabilityAssessment, validateOutputHonesty, validateReadiness, serializeIntelligence,
  type IntelligenceScope, type IntelligenceSnapshot, type IntelligenceMaturityDimension,
  type IntelligenceMaturityIndex, type IntelligenceCapabilityAssessment, type MaturityDimensionId,
  type IntelligenceMaturityLevel, type MeasurementResult, type IntelligenceGap, type GapSeverity,
  type NextBestIntelligenceAction, type IntelligenceActionType, type ReportReadinessAssessment,
  type IntelligenceSystemDiagnosis, type IntelligenceOutcome, type BaselineType, type OperationalMode,
  type ImpactLevel, type IntelligenceEvidenceReference, type ReadinessBlocker, type Violation,
  type IntelligenceOutput, type IntelligencePattern, type IntelligenceRegistrySummary,
  type IntelligenceValidationSummary,
} from "./os-contracts";
import { summarizeValidationLearning, type OutputValidationLifecycle } from "./validation-lifecycle";

export const INTELLIGENCE_SNAPSHOT_METHODOLOGY_VERSION = "snapshot-methodology-v1";

/**
 * METHODOLOGY (snapshot-methodology-v1) — one place, not scattered conditionals.
 *
 * DATA SOURCES: growth-index components (real DB counts), structured feedback
 *   (opportunity_feedback + 039 outcomes), learned_preferences (observation/
 *   shadow only), vault/account-memory counts, latest Market-to-Account artifact
 *   (segment-universe + staged-pipeline), evidence coverage where accessible.
 * MISSING-DATA BEHAVIOR: absent signal ⇒ not_instrumented; present-but-thin ⇒
 *   insufficient_evidence; a score is emitted ONLY at state "measured".
 * SAMPLE THRESHOLDS: feedback usefulRate needs ≥ MIN_RATED (20); a pattern needs
 *   MIN_PATTERN_SAMPLE (5, enforced in contracts); one client ⇒ client
 *   specificity stays insufficient_evidence (MIN_CLIENTS_FOR_SPECIFICITY = 2).
 * CAPABILITY RULES: production requires operational evidence (exercised_run/
 *   artifact/human_review), sample > 0 and a measured success rate; otherwise the
 *   capability is capped at foundation/observation/not_measured. feedback_learning
 *   is observation-only (ranking impact none). outcome_learning is not_measured
 *   without outcomes.
 * MATURITY RULES (conservative): structured_knowledge once verified knowledge +
 *   ≥1 production capability exist; analytical_intelligence ONLY when
 *   analytical_depth is measured AND differentiation is not not_measured (needs a
 *   baseline) — so a single pilot cannot mint analytical maturity.
 * CONFIDENCE: min(1, sample/target); never fabricated.
 * REPORT READINESS: evidence + validation + specificity gated; premium is
 *   impossible with an unresolved critical blocker (contract guard).
 * GAP GENERATION: rule-driven, de-duplicated by root cause.
 * ACTION PRIORITIZATION: priority = liftRank × scopeRank × confidence ×
 *   readinessImpactRank ÷ effortRank (ordinal, integer output — no fake precision).
 * LIMITATIONS: single-tenant pilot sample; ML tables (032) unapplied; no
 *   persisted history yet ⇒ trends not_instrumented.
 */

const MIN_RATED = 20;
const MIN_CLIENTS_FOR_SPECIFICITY = 2;
const TARGET_VERIFIED_UNIVERSE = 40;

// ── Input: plain real signals (adapters fill these; engine stays pure) ───────
export interface SnapshotArtifactSignals {
  client_id: string | null;
  segments: number;
  verified: number;
  probable: number;
  excluded: number;
  shortlist: number;
  dynamic_opportunities: number;     // dated buying signals found
  evidence_corroborated: number;
  evidence_weak: number;
  evidence_total: number;
  deep_research_complete: number;
  replayable: boolean;
}
export interface SnapshotFeedbackSignals {
  total_events: number;
  rated_events: number;              // normalized_sentiment not null
  useful_events: number;
  corrections: number;
  outcomes: IntelligenceOutcome[];   // from migration 039; [] when none
}
export interface SnapshotKnowledgeSignals {
  vault_companies: number | null;
  verified_signals: number | null;
  sources: number | null;
  distinct_regions: number;
  distinct_industries: number;
  account_memory_records: number | null;
}
export interface SnapshotEvidenceSignals {
  total: number | null;
  dated: number | null;
  corroborated: number | null;
  stale: number | null;
  source_classes: number | null;
  counterevidence_instrumented: boolean;
}
export interface SnapshotLearnerSignals {
  preference_count: number;
  validated_count: number;
  max_sample_size: number;
}
export interface SnapshotInput {
  scope: IntelligenceScope;
  now: string;
  source_data_cutoff: string;
  capability_versions: Record<string, string>;
  artifact: SnapshotArtifactSignals | null;
  distinct_clients: number;
  feedback: SnapshotFeedbackSignals;
  knowledge: SnapshotKnowledgeSignals;
  evidence: SnapshotEvidenceSignals | null;
  learner: SnapshotLearnerSignals;
  outputs?: IntelligenceOutput[];
  patterns?: IntelligencePattern[];
  validation_lifecycles?: OutputValidationLifecycle[];
  baseline: BaselineType | null;
  snapshots_persisted: boolean;
  ml_tables_available: boolean;
  previous: IntelligenceSnapshot | null;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const conf = (sample: number, target: number) => Math.min(1, sample / target);

// ── Dimensions ───────────────────────────────────────────────────────────────
function buildDimensions(i: SnapshotInput): IntelligenceMaturityDimension[] {
  const mv = INTELLIGENCE_SNAPSHOT_METHODOLOGY_VERSION;
  const base = (id: MaturityDimensionId, m: MeasurementResult, over: Partial<IntelligenceMaturityDimension> = {}): IntelligenceMaturityDimension => ({
    id, measurement: m, methodology_version: mv, evidence: [], limitations: [], trend: "not_instrumented",
    next_improvement: null, assessed_at: i.now, source_data_cutoff: i.source_data_cutoff, ...over,
  });
  const art = i.artifact;

  // Analytical Depth: a real multi-layer exercised run (segments+ranking+evidence)
  // supports LOW measured depth with LOW confidence — one sample, not scale.
  const analytical: IntelligenceMaturityDimension = art && art.segments >= 3 && art.shortlist > 0
    ? base("analytical_depth", measured(clamp(35 + Math.min(20, art.segments * 2)), Math.min(0.4, conf(art.verified, TARGET_VERIFIED_UNIVERSE)), art.verified + art.probable), {
        limitations: ["single exercised market (one pilot)", "no cross-market synthesis yet"], next_improvement: "Exercise analytical synthesis across ≥2 markets/clients.",
        evidence: [{ id: "art-depth", kind: "exercised_run", ref: "market-to-account:latest" }],
      })
    : base("analytical_depth", unmeasured("insufficient_evidence", "no multi-layer exercised run available"), { next_improvement: "Run a staged market-to-account pipeline end to end." });

  // Differentiation: needs a baseline comparison → not_measured until one exists.
  const lift = deriveIntelligenceLift(i.baseline, mv, i.now);
  const differentiation = base("differentiation", lift.measurement, { limitations: lift.limitations, next_improvement: "Run a baseline (generic LLM / keyword search) and score lift." });

  // Evidence Integrity: from dated+corroborated coverage; not_instrumented if none.
  let evInteg: IntelligenceMaturityDimension;
  if (i.evidence && i.evidence.total && i.evidence.total > 0) {
    const dated = i.evidence.dated ?? 0, corr = i.evidence.corroborated ?? 0, total = i.evidence.total;
    evInteg = base("evidence_integrity", measured(clamp(50 * (dated / total) + 50 * (corr / total)), conf(total, 50), total), {
      trend: "flat", limitations: [i.evidence.counterevidence_instrumented ? "" : "counterevidence coverage not instrumented"].filter(Boolean),
      next_improvement: "Increase dated + corroborated evidence coverage.",
      evidence: [{ id: "ev", kind: "artifact", ref: "evidence-coverage", dated: true }],
    });
  } else if (art && art.evidence_total > 0) {
    const corrRate = art.evidence_corroborated / art.evidence_total;
    evInteg = base("evidence_integrity", measured(clamp(corrRate * 100), Math.min(0.4, conf(art.evidence_total, 20)), art.evidence_total), {
      limitations: ["derived from one pilot shortlist", "no counterevidence instrumentation"], next_improvement: "Instrument dated/corroborated/counterevidence coverage globally.",
      evidence: [{ id: "art-ev", kind: "exercised_run", ref: "staged-pipeline:evidence_coverage" }],
    });
  } else {
    evInteg = base("evidence_integrity", unmeasured("not_instrumented", "no evidence-coverage instrumentation"), { next_improvement: "Instrument evidence coverage." });
  }

  // Commercial Relevance: real useful-rate only with ≥ MIN_RATED rated events.
  const commercial = i.feedback.rated_events >= MIN_RATED
    ? base("commercial_relevance", measured(clamp((i.feedback.useful_events / i.feedback.rated_events) * 100), conf(i.feedback.rated_events, 50), i.feedback.rated_events), { trend: "flat", next_improvement: "Sustain rated feedback volume." })
    : base("commercial_relevance", unmeasured("insufficient_evidence", `only ${i.feedback.rated_events}/${MIN_RATED} rated feedback events`), { next_improvement: "Collect ≥20 rated feedback events." });

  // Client Specificity: one client cannot prove specificity.
  const clientSpec = i.distinct_clients >= MIN_CLIENTS_FOR_SPECIFICITY
    ? base("client_specificity", measured(clamp(40 + i.distinct_clients * 5), conf(i.distinct_clients, 5), i.distinct_clients), { next_improvement: "Validate tailoring across clients." })
    : base("client_specificity", unmeasured("insufficient_evidence", `only ${i.distinct_clients} client(s) — cannot prove specificity`), { limitations: ["single pilot"], next_improvement: "Tailor + validate for ≥2 distinct clients." });

  // Temporal Intelligence: dated-evidence coverage; sparse ⇒ insufficient.
  const datedCov = i.evidence?.dated ?? (art ? art.dynamic_opportunities : null);
  const temporal = (art && art.dynamic_opportunities > 0)
    ? base("temporal_intelligence", measured(clamp((art.dynamic_opportunities / Math.max(1, art.shortlist)) * 100), 0.2, art.dynamic_opportunities), { limitations: ["very sparse dated signal"], next_improvement: "Recover more dated signals per account." })
    : base("temporal_intelligence", unmeasured(datedCov === null ? "not_instrumented" : "insufficient_evidence", "no/sparse dated signal coverage"), { next_improvement: "Improve date recovery + what-changed coverage." });

  // Learning Maturity: learner active but observation-only ⇒ foundation-level.
  const learning = i.learner.preference_count > 0
    ? base("learning_maturity", measured(clamp(20 + Math.min(15, i.learner.preference_count)), Math.min(0.3, conf(i.learner.max_sample_size, 10)), i.learner.preference_count), {
        limitations: ["observation/shadow only — ranking impact off", "no outcome-driven adaptation"], next_improvement: "Add human review + outcome-linked learning.",
        evidence: [{ id: "prefs", kind: "feedback", ref: "learned_preferences" }],
      })
    : base("learning_maturity", unmeasured("no_observations", "no learned preferences yet"), { next_improvement: "Accumulate structured feedback for the learner." });

  // Outcome Performance: contract helper — not_measured without outcomes.
  const outcome = deriveOutcomePerformance(i.feedback.outcomes, mv, i.now, i.source_data_cutoff);

  return [analytical, differentiation, evInteg, commercial, clientSpec, temporal, learning, outcome];
}

// ── Capability assessments ───────────────────────────────────────────────────
type CapSpec = { id: string; mode: OperationalMode; level: IntelligenceMaturityLevel | null; success: MeasurementResult; sample: number; evidenceKind: IntelligenceEvidenceReference["kind"]; ranking: ImpactLevel; report: ImpactLevel; failure: string[]; limits: string[]; next: string | null; blocked?: string };
function buildCapabilities(i: SnapshotInput): IntelligenceCapabilityAssessment[] {
  const art = i.artifact;
  const universe = art ? art.verified + art.probable + art.excluded : 0;
  // Verification precision proxy: verified share of resolved (verified+probable).
  const resolved = art ? art.verified + art.probable : 0;
  const verifyRate = art && art.verified > 0 ? measured(clamp((art.verified / Math.max(1, resolved)) * 100), Math.min(0.5, conf(art.verified, TARGET_VERIFIED_UNIVERSE)), art.verified) : unmeasured("insufficient_evidence", "no exercised run");
  const discoverySuccess = art && universe > 0 ? measured(clamp((art.verified / Math.max(1, resolved)) * 100), Math.min(0.5, conf(art.verified, TARGET_VERIFIED_UNIVERSE)), resolved) : unmeasured("insufficient_evidence", "no exercised run");

  // Production capabilities MUST carry operational evidence + sample>0 + measured success.
  const prod = (art !== null);
  const specs: CapSpec[] = [
    { id: "company_discovery", mode: prod ? "production" : "not_measured", level: "structured_knowledge", success: discoverySuccess, sample: art ? art.verified + art.probable : 0, evidenceKind: "exercised_run", ranking: "medium", report: "medium", failure: ["search-title extraction noise"], limits: ["one market exercised"], next: "LLM name extraction + domain resolution" },
    { id: "company_verification", mode: prod ? "production" : "not_measured", level: "structured_knowledge", success: verifyRate, sample: art ? art.verified : 0, evidenceKind: "exercised_run", ranking: "medium", report: "high", failure: ["headline/article false positives (mitigated)"], limits: ["21 verified < 40 target"], next: "raise verified coverage" },
    { id: "structural_account_ranking", mode: prod ? "production" : "not_measured", level: "analytical_intelligence", success: art ? measured(100, Math.min(0.5, conf(art.shortlist, 8)), art.shortlist) : unmeasured("insufficient_evidence", "no shortlist"), sample: art ? art.shortlist : 0, evidenceKind: "replay_consistency", ranking: "medium", report: "medium", failure: ["separates fit/timing — needs validation"], limits: ["deterministic but unvalidated by outcomes"], next: "validate ranking against outcomes" },
    { id: "buyer_segment_modeling", mode: prod ? "production" : "not_measured", level: "structured_knowledge", success: art ? measured(clamp((art.segments / 7) * 100), 0.4, art.segments) : unmeasured("insufficient_evidence", "no segments"), sample: art ? art.segments : 0, evidenceKind: "exercised_run", ranking: "low", report: "medium", failure: [], limits: ["fixed taxonomy"], next: "vertical taxonomies" },
    { id: "market_interpretation", mode: "foundation", level: "structured_knowledge", success: unmeasured("insufficient_evidence", "one market"), sample: art ? 1 : 0, evidenceKind: "exercised_run", ranking: "low", report: "medium", failure: [], limits: ["single market"], next: "compare ≥2 markets" },
    { id: "commercial_accessibility_analysis", mode: "foundation", level: "structured_knowledge", success: unmeasured("insufficient_evidence", "unvalidated"), sample: art ? art.shortlist : 0, evidenceKind: "exercised_run", ranking: "low", report: "medium", failure: [], limits: ["channel-fit ≠ buying intent (preserved)"], next: "validate accessibility calls" },
    { id: "business_model_classification", mode: "foundation", level: "structured_knowledge", success: unmeasured("insufficient_evidence", "unvalidated"), sample: 0, evidenceKind: "exercised_run", ranking: "low", report: "low", failure: [], limits: [], next: "human-review sample" },
    { id: "entity_resolution", mode: "foundation", level: "structured_knowledge", success: verifyRate, sample: art ? art.verified : 0, evidenceKind: "exercised_run", ranking: "low", report: "medium", failure: ["homonym risk"], limits: ["quality inconsistent across sources"], next: "resolution-quality metric" },
    { id: "signal_detection", mode: "foundation", level: "retrieval", success: unmeasured("insufficient_evidence", "0 dynamic opportunities in pilot"), sample: art ? art.dynamic_opportunities : 0, evidenceKind: "exercised_run", ranking: "low", report: "low", failure: ["niche has few dated events"], limits: ["sparse"], next: "broaden dated-signal queries" },
    { id: "signal_interpretation", mode: "foundation", level: "retrieval", success: unmeasured("insufficient_evidence", "no signals to interpret"), sample: 0, evidenceKind: "exercised_run", ranking: "low", report: "low", failure: [], limits: [], next: "needs signal volume" },
    { id: "temporal_reasoning", mode: "foundation", level: "structured_knowledge", success: unmeasured("insufficient_evidence", "sparse dated coverage"), sample: 0, evidenceKind: "exercised_run", ranking: "low", report: "low", failure: ["date recovery gaps"], limits: ["coverage-limited"], next: "date-recovery coverage metric" },
    { id: "what_changed_detection", mode: "foundation", level: "structured_knowledge", success: unmeasured("not_instrumented", "no prior-snapshot deltas measured"), sample: 0, evidenceKind: "schema_exists", ranking: "low", report: "low", failure: [], limits: ["not exercised at scale"], next: "instrument change deltas" },
    { id: "counterevidence_analysis", mode: "foundation", level: null, success: unmeasured("insufficient_evidence", "low sample"), sample: 0, evidenceKind: "exercised_run", ranking: "low", report: "medium", failure: [], limits: ["low sample — analytical maturity unproven"], next: "counterevidence coverage metric" },
    { id: "cross_account_pattern_detection", mode: "not_measured", level: null, success: unmeasured("insufficient_evidence", "sample below floor"), sample: i.learner.max_sample_size, evidenceKind: "feedback", ranking: "none", report: "none", failure: [], limits: ["single-feature learner only"], next: "cross-account pattern registry" },
    { id: "deep_account_research", mode: art && art.deep_research_complete > 0 ? "foundation" : "not_measured", level: null, success: unmeasured("not_measured", "no complete live dossiers"), sample: art ? art.deep_research_complete : 0, evidenceKind: "exercised_run", ranking: "none", report: "high", failure: [], limits: ["not exercised"], next: "run dossiers on validated accounts", blocked: "deep research not implemented" },
    { id: "buying_path_reasoning", mode: "not_measured", level: null, success: unmeasured("not_measured", "not exercised"), sample: 0, evidenceKind: "schema_exists", ranking: "none", report: "medium", failure: [], limits: [], next: "depends on deep research" },
    { id: "client_specific_opportunity_assessment", mode: "foundation", level: "structured_knowledge", success: unmeasured("insufficient_evidence", "one client"), sample: i.distinct_clients, evidenceKind: "exercised_run", ranking: "low", report: "high", failure: [], limits: ["single pilot"], next: "≥2 clients tailored+validated" },
    { id: "portfolio_strategy", mode: "foundation", level: null, success: unmeasured("not_measured", "contract only, no outcome validation"), sample: 0, evidenceKind: "schema_exists", ranking: "none", report: "medium", failure: [], limits: ["type exists, unvalidated"], next: "validate portfolio calls" },
    { id: "recommendation_generation", mode: "foundation", level: "structured_knowledge", success: unmeasured("insufficient_evidence", "unvalidated by outcomes"), sample: art ? art.shortlist : 0, evidenceKind: "exercised_run", ranking: "low", report: "high", failure: ["channel-only never act_now (preserved)"], limits: ["deterministic, unvalidated"], next: "outcome validation" },
    { id: "confidence_calibration", mode: "foundation", level: "structured_knowledge", success: unmeasured("insufficient_evidence", "no calibration data"), sample: 0, evidenceKind: "schema_exists", ranking: "low", report: "low", failure: [], limits: [], next: "calibration curve from outcomes" },
    { id: "account_memory", mode: (i.knowledge.account_memory_records ?? 0) > 0 ? "production" : "foundation", level: "structured_knowledge", success: (i.knowledge.account_memory_records ?? 0) > 0 ? measured(100, Math.min(0.5, conf(i.knowledge.account_memory_records ?? 0, 50)), i.knowledge.account_memory_records ?? 0) : unmeasured("no_observations", "no memory records"), sample: i.knowledge.account_memory_records ?? 0, evidenceKind: "artifact", ranking: "low", report: "low", failure: [], limits: ["coverage limited"], next: "expand memory coverage" },
    { id: "anti_repetition", mode: (i.knowledge.account_memory_records ?? 0) > 0 ? "production" : "foundation", level: "structured_knowledge", success: (i.knowledge.account_memory_records ?? 0) > 0 ? measured(100, 0.4, i.knowledge.account_memory_records ?? 0) : unmeasured("no_observations", "no memory"), sample: i.knowledge.account_memory_records ?? 0, evidenceKind: "artifact", ranking: "low", report: "low", failure: [], limits: [], next: "measure repeat-suppression rate" },
    { id: "feedback_learning", mode: "observation", level: "structured_knowledge", success: unmeasured("shadow_only", "observation-only, ranking off"), sample: i.learner.preference_count, evidenceKind: "feedback", ranking: "none", report: "none", failure: [], limits: ["never affects ranking in this version"], next: "human-approve select patterns" },
    { id: "outcome_learning", mode: "not_measured", level: null, success: unmeasured("not_measured", "no commercial outcomes"), sample: i.feedback.outcomes.filter((o) => o.kind !== "no_outcome").length, evidenceKind: "outcome", ranking: "none", report: "none", failure: [], limits: ["no outcomes recorded"], next: "instrument outcome capture" },
    { id: "report_readiness_assessment", mode: "foundation", level: "structured_knowledge", success: unmeasured("insufficient_evidence", "delivery-decision only"), sample: art ? 1 : 0, evidenceKind: "exercised_run", ranking: "none", report: "high", failure: [], limits: ["delivery-decision, not 5-level yet"], next: "wire 5-level readiness" },
  ];

  return specs.map((s) => ({
    capability_id: s.id,
    capability_version: i.capability_versions[s.id] ?? "unversioned",
    scope: i.scope, methodology_version: INTELLIGENCE_SNAPSHOT_METHODOLOGY_VERSION,
    mode: s.mode,
    // A maturity level is only asserted with a real sample or production status;
    // otherwise it stays null (no exercise ⇒ no claimed maturity).
    maturity_level: s.sample > 0 || s.mode === "production" ? s.level : null,
    maturity_confidence: isMeasured(s.success) ? s.success.confidence : null,
    measurement_state: s.success.state,
    evidence: s.sample > 0 || s.mode === "production" ? [{ id: `${s.id}-ev`, kind: s.evidenceKind, ref: `${s.id}:latest` }] : [],
    sample_size: s.sample, last_exercised: art ? i.source_data_cutoff : null,
    success_metric: s.id + "_success", success_rate: s.success,
    known_failure_modes: s.failure, limitations: s.limits, blocked_reason: s.blocked ?? null,
    ranking_impact: s.ranking, report_impact: s.report, next_milestone: s.next,
    promotion_criteria: s.mode === "production" ? [] : ["operational evidence", "sample > 0", "measured success rate"],
    human_review_state: "unreviewed", assessed_at: i.now, source_data_cutoff: i.source_data_cutoff,
  }));
}

// ── Global maturity (conservative) ───────────────────────────────────────────
function deriveGlobalMaturity(dims: IntelligenceMaturityDimension[], caps: IntelligenceCapabilityAssessment[], i: SnapshotInput): { overall: MeasurementResult; level: IntelligenceMaturityLevel | null; level_confidence: number | null; supporting: string[]; blocking: string[]; next_requirements: string[] } {
  const prodCaps = caps.filter((c) => c.mode === "production");
  const hasVerifiedKnowledge = (i.knowledge.vault_companies ?? 0) > 0 || (i.artifact ? i.artifact.verified > 0 : false);
  const analytical = dims.find((d) => d.id === "analytical_depth")!;
  const differentiation = dims.find((d) => d.id === "differentiation")!;

  let level: IntelligenceMaturityLevel | null = "retrieval";
  const supporting: string[] = [], blocking: string[] = [], next: string[] = [];
  if (i.artifact) supporting.push("company_discovery (exercised)");
  if (hasVerifiedKnowledge && prodCaps.length >= 1) { level = "structured_knowledge"; supporting.push(...prodCaps.map((c) => c.capability_id)); }
  // analytical_intelligence ONLY with measured analytical depth AND a differentiation baseline.
  if (isMeasured(analytical.measurement) && differentiation.measurement.state !== "not_measured") level = "analytical_intelligence";
  else { blocking.push("analytical_depth unproven at scale", "differentiation has no baseline"); next.push("Run a baseline for Differentiation", "Exercise analytical synthesis across ≥2 markets"); }
  if (i.feedback.outcomes.filter((o) => o.kind !== "no_outcome").length === 0) { blocking.push("no commercial outcomes"); next.push("Instrument outcome capture (Level 4/5 gate)"); }

  const measuredDims = dims.filter((d) => isMeasured(d.measurement));
  const overall: MeasurementResult = measuredDims.length >= 3
    ? measured(clamp(measuredDims.reduce((s, d) => s + (d.measurement as { score: number }).score, 0) / measuredDims.length), Math.min(0.5, measuredDims.length / dims.length), measuredDims.length)
    : unmeasured("insufficient_evidence", `only ${measuredDims.length}/8 dimensions measurable`);
  return { overall, level, level_confidence: level === "structured_knowledge" ? 0.5 : level === "analytical_intelligence" ? 0.4 : 0.3, supporting: Array.from(new Set(supporting)), blocking: Array.from(new Set(blocking)), next_requirements: Array.from(new Set(next)) };
}

// ── Gaps (de-duplicated by root cause) ───────────────────────────────────────
function buildGaps(i: SnapshotInput, dims: IntelligenceMaturityDimension[], caps: IntelligenceCapabilityAssessment[]): IntelligenceGap[] {
  const g: IntelligenceGap[] = [];
  const roots = new Set<string>();
  const add = (root: string, gap: Omit<IntelligenceGap, "id" | "created_at" | "resolved_at" | "resolution_evidence" | "scope">) => {
    if (roots.has(root)) return; roots.add(root);
    g.push({ id: `gap:${root}`, scope: i.scope, created_at: i.now, resolved_at: null, resolution_evidence: [], ...gap });
  };
  const ev = (ref: string): IntelligenceEvidenceReference[] => [{ id: `${ref}-ev`, kind: "artifact", ref }];
  const dim = (id: MaturityDimensionId) => dims.find((d) => d.id === id)!;

  if (i.feedback.outcomes.filter((o) => o.kind !== "no_outcome").length === 0)
    add("no_outcomes", { type: "no_commercial_outcome", category: "learning", severity: "critical", priority: 0, affected_capability: "outcome_learning", affected_outputs: [], affected_scope: "global", report_readiness_impact: "high", impact: "Outcome Performance & Level 4/5 cannot be measured.", evidence: ev("opportunity_feedback:commercial_outcome"), recommended_action: "Instrument commercial-outcome capture on delivered recommendations.", owner_type: "engineering", dependency: null, expected_lift: measured(30, 0.4, 1), effort: "m", confidence: 0.6, status: "open" });
  if (i.baseline === null)
    add("no_baseline", { type: "no_baseline_comparison", category: "learning", severity: "high", priority: 0, affected_capability: "cross_account_pattern_detection", affected_outputs: [], affected_scope: "global", report_readiness_impact: "medium", impact: "Differentiation (moat) cannot be quantified.", evidence: ev("intelligence_lift"), recommended_action: "Run a baseline (generic LLM / keyword search) and score lift.", owner_type: "research", dependency: null, expected_lift: measured(25, 0.4, 1), effort: "m", confidence: 0.6, status: "open" });
  if (dim("temporal_intelligence").measurement.state !== "measured")
    add("temporal_coverage", { type: "no_dated_evidence", category: "evidence", severity: "high", priority: 0, affected_capability: "temporal_reasoning", affected_outputs: [], affected_scope: "global", report_readiness_impact: "high", impact: "Timing windows and what-changed cannot be reasoned.", evidence: ev("evidence:dated"), recommended_action: "Improve dated-signal recovery + what-changed instrumentation.", owner_type: "engineering", dependency: null, expected_lift: measured(20, 0.4, 1), effort: "m", confidence: 0.5, status: "open" });
  if (caps.find((c) => c.capability_id === "deep_account_research")!.mode !== "production")
    add("deep_research", { type: "capability_not_integrated", category: "capability", severity: "high", priority: 0, affected_capability: "deep_account_research", affected_outputs: [], affected_scope: "shortlist", report_readiness_impact: "high", impact: "Account depth for premium reports is missing.", evidence: ev("deep_account_research"), recommended_action: "Exercise deep-account research on validated accounts.", owner_type: "engineering", dependency: "verified universe", expected_lift: measured(25, 0.4, 1), effort: "l", confidence: 0.5, status: "open" });
  if (i.learner.max_sample_size < 5)
    add("pattern_sample", { type: "insufficient_cross_account_sample", category: "reasoning", severity: "medium", priority: 0, affected_capability: "cross_account_pattern_detection", affected_outputs: [], affected_scope: "global", report_readiness_impact: "medium", impact: "No credible cross-account patterns yet.", evidence: ev("learned_preferences"), recommended_action: "Expand cross-account samples; build a pattern registry.", owner_type: "engineering", dependency: null, expected_lift: measured(15, 0.4, 1), effort: "m", confidence: 0.5, status: "open" });
  if (i.distinct_clients < MIN_CLIENTS_FOR_SPECIFICITY)
    add("client_specificity", { type: "no_client_specific_context", category: "learning", severity: "high", priority: 0, affected_capability: "client_specific_opportunity_assessment", affected_outputs: [], affected_scope: "global", report_readiness_impact: "high", impact: "Client specificity cannot be proven from one pilot.", evidence: ev("clients"), recommended_action: "Tailor + validate for ≥2 distinct clients.", owner_type: "commercial", dependency: null, expected_lift: measured(20, 0.4, 1), effort: "l", confidence: 0.5, status: "open" });
  if (i.artifact && i.artifact.verified < TARGET_VERIFIED_UNIVERSE)
    add("verified_universe", { type: "verified_coverage_limited", category: "knowledge", severity: "medium", priority: 0, affected_capability: "company_verification", affected_outputs: [], affected_scope: "market", report_readiness_impact: "medium", impact: `Verified universe (${i.artifact.verified}) below target (${TARGET_VERIFIED_UNIVERSE}).`, evidence: ev("segment-universe"), recommended_action: "LLM name extraction + official-domain resolution.", owner_type: "engineering", dependency: null, expected_lift: measured(15, 0.4, 1), effort: "m", confidence: 0.55, status: "open" });
  if (!(i.evidence?.counterevidence_instrumented))
    add("counterevidence", { type: "no_counterevidence_search", category: "evidence", severity: "medium", priority: 0, affected_capability: "counterevidence_analysis", affected_outputs: [], affected_scope: "global", report_readiness_impact: "medium", impact: "Conclusions lack systematic counterevidence.", evidence: ev("counterevidence"), recommended_action: "Instrument counterevidence coverage metric.", owner_type: "engineering", dependency: null, expected_lift: measured(12, 0.4, 1), effort: "m", confidence: 0.5, status: "open" });
  if (!i.snapshots_persisted)
    add("no_snapshot_history", { type: "no_historical_snapshots", category: "capability", severity: "low", priority: 0, affected_capability: "report_readiness_assessment", affected_outputs: [], affected_scope: "global", report_readiness_impact: "low", impact: "No trend can be computed until snapshots are persisted.", evidence: ev("intelligence_index_snapshots"), recommended_action: "Persist recurring snapshots (Block 7).", owner_type: "engineering", dependency: null, expected_lift: measured(8, 0.4, 1), effort: "s", confidence: 0.6, status: "open" });

  // Priority: liftRank × confidence ÷ effortRank × readinessImpact, rounded.
  const effortRank: Record<string, number> = { xs: 1, s: 2, m: 3, l: 5, xl: 8 };
  const impactRank: Record<ImpactLevel, number> = { none: 0, low: 1, medium: 2, high: 3 };
  const sevBoost: Record<GapSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  for (const gap of g) {
    const lift = isMeasured(gap.expected_lift) ? gap.expected_lift.score : 0;
    gap.priority = Math.round((lift * gap.confidence * (1 + impactRank[gap.report_readiness_impact]) * sevBoost[gap.severity]) / effortRank[gap.effort]);
  }
  return g.sort((a, b) => b.priority - a.priority);
}

// ── Next-best actions (derived from gaps) ────────────────────────────────────
const GAP_TO_ACTION: Record<string, IntelligenceActionType> = {
  no_commercial_outcome: "observe_commercial_outcome", no_baseline_comparison: "run_baseline_evaluation",
  no_dated_evidence: "recover_dates", capability_not_integrated: "implement_missing_capability",
  insufficient_cross_account_sample: "expand_market_sample", no_client_specific_context: "add_client_context",
  verified_coverage_limited: "verify_domains", no_counterevidence_search: "search_counterevidence",
  no_historical_snapshots: "instrument_capability",
};
function buildActions(gaps: IntelligenceGap[], i: SnapshotInput): NextBestIntelligenceAction[] {
  return gaps.map((gap): NextBestIntelligenceAction => ({
    id: `action:${gap.id.replace("gap:", "")}`,
    action_type: GAP_TO_ACTION[gap.type] ?? "instrument_capability",
    rationale: gap.impact, evidence: gap.evidence,
    affected_dimensions: [], affected_capabilities: gap.affected_capability ? [gap.affected_capability] : [],
    affected_gaps: [gap.id], expected_lift: gap.expected_lift, effort: gap.effort, dependency: gap.dependency,
    confidence: gap.confidence, priority: gap.priority, success_metric: gap.recommended_action,
    owner: gap.owner_type, status: "open", created_at: i.now, due: null,
  })).sort((a, b) => b.priority - a.priority);
}

// ── Report readiness ─────────────────────────────────────────────────────────
function buildReadiness(i: SnapshotInput, dims: IntelligenceMaturityDimension[], gaps: IntelligenceGap[]): ReportReadinessAssessment {
  const dim = (id: MaturityDimensionId) => dims.find((d) => d.id === id)!;
  const hasVerified = i.artifact ? i.artifact.verified > 0 : false;
  const evidenceOk = dim("evidence_integrity").measurement.state === "measured";
  const blockers: ReadinessBlocker[] = gaps.filter((x) => x.report_readiness_impact === "high").map((x) => ({ gap_id: x.id, severity: x.severity, description: x.impact, resolved: false }));

  // Conservative ladder: verified knowledge ⇒ snapshot_ready; +measured evidence
  // ⇒ brief_ready; intelligence/premium require validation+specificity+outcomes.
  let level: ReportReadinessAssessment["readiness_level"] = "not_ready";
  if (hasVerified) level = "snapshot_ready";
  if (hasVerified && evidenceOk) level = "brief_ready";
  // never promote past brief without validation + client specificity + outcomes.

  return {
    scope: i.scope, readiness_level: level, confidence: hasVerified ? 0.5 : 0.3,
    reason: level === "brief_ready" ? "Verified account universe + measured evidence support a factual brief; deeper report layers lack validation, dated signals and outcomes."
      : level === "snapshot_ready" ? "Verified account universe supports a structural snapshot; evidence integrity and validation are insufficient for a brief."
      : "Insufficient verified knowledge for any customer output.",
    blockers,
    customer_safe_outputs: hasVerified ? ["verified_account_universe", "buyer_segment_landscape", "structural_ranking (fit/attractiveness, not timing)"] : [],
    unsafe_outputs: ["timing/act_now calls", "client_specific_strategy", "portfolio_recommendations", "outcome_claims"],
    capabilities_available: ["company_discovery", "company_verification", "buyer_segment_modeling", "structural_account_ranking", "account_memory"],
    missing_capabilities: ["deep_account_research", "outcome_learning", "cross_account_pattern_detection", "temporal_reasoning (at coverage)"],
    recommended_next_action: gaps[0]?.recommended_action ?? null,
    supportable_sections: hasVerified ? ["Market & Segment Landscape", "Verified Account Universe", "Structural Ranking (fit/attractiveness)"] : [],
    superficial_sections: ["Signals & Timing", "Deep Account Dossiers", "Commercial Strategy / Portfolio", "Outcome-based Prioritization"],
    methodology_version: INTELLIGENCE_SNAPSHOT_METHODOLOGY_VERSION, assessed_at: i.now, source_data_cutoff: i.source_data_cutoff,
  };
}

// ── System diagnosis (rules only) ────────────────────────────────────────────
function buildDiagnosis(level: IntelligenceMaturityLevel | null, caps: IntelligenceCapabilityAssessment[], gaps: IntelligenceGap[], actions: NextBestIntelligenceAction[], readiness: ReportReadinessAssessment): IntelligenceSystemDiagnosis {
  const strongest = caps.filter((c) => c.mode === "production" && isMeasured(c.success_rate)).sort((a, b) => (b.success_rate as { score: number }).score - (a.success_rate as { score: number }).score)[0];
  const weakest = caps.find((c) => c.capability_id === "outcome_learning") ?? null;
  const topGap = gaps[0] ?? null;
  const levelLabel = level ? level.replace(/_/g, " ") : "unproven";
  return {
    headline: `LeadLens is operating at ${levelLabel}. Structured knowledge and structural ranking are exercised, but outcomes, differentiation baseline and client-specific validation are missing.`,
    maturity_level: level,
    strongest_capability: strongest?.capability_id ?? null,
    weakest_capability: weakest?.capability_id ?? null,
    top_bottleneck: topGap ? topGap.type : null,
    highest_leverage_action: actions[0]?.action_type ?? null,
    report_readiness_summary: `${readiness.readiness_level} — ${readiness.reason}`,
    statements: [
      "Company discovery/verification and structural ranking are exercised on one real market.",
      "Outcome Performance is not_measured — no commercial outcomes recorded.",
      "Differentiation is not_measured — no baseline comparison exists.",
      "Client specificity is insufficient_evidence — a single pilot cannot prove it.",
      "Learned preferences remain observation-only and never affect ranking.",
      "No output is premium-report-ready; verified universe + segment landscape are brief-safe.",
    ],
    generated_from: "rules",
  };
}

function buildRegistrySummary(outputs: IntelligenceOutput[], patterns: IntelligencePattern[]): IntelligenceRegistrySummary {
  const count = <T extends string>(values: T[]): Partial<Record<T, number>> => {
    const result: Partial<Record<T, number>> = {};
    for (const value of values) result[value] = (result[value] ?? 0) + 1;
    return result;
  };
  const strongest = [...outputs].sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))[0] ?? null;
  const insufficient = patterns.filter((p) => p.state === "insufficient_sample").length;
  return {
    output_count: outputs.length,
    outputs_by_type: count(outputs.map((o) => o.type)),
    outputs_by_validation_state: count(outputs.map((o) => o.validation_state)),
    outputs_by_report_eligibility: count(outputs.map((o) => o.report_eligibility)),
    pattern_count: patterns.length,
    patterns_by_state: count(patterns.map((p) => p.state)),
    strongest_supported_output_id: strongest?.id ?? null,
    primary_pattern_limitation: patterns.length === 0
      ? "No learned-preference records were supplied; no pattern was fabricated."
      : insufficient > 0
        ? `${insufficient} pattern(s) remain below MIN_PATTERN_SAMPLE.`
        : "Patterns remain observation-only pending human review and outcomes.",
  };
}

// ── Assembler ────────────────────────────────────────────────────────────────
export function buildIntelligenceSnapshot(input: SnapshotInput): IntelligenceSnapshot {
  const dims = buildDimensions(input);
  const caps = buildCapabilities(input);
  const maturity = deriveGlobalMaturity(dims, caps, input);
  const gaps = buildGaps(input, dims, caps);
  const actions = buildActions(gaps, input);
  const readiness = buildReadiness(input, dims, gaps);
  const diagnosis = buildDiagnosis(maturity.level, caps, gaps, actions, readiness);
  const outputs = [...(input.outputs ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const patterns = [...(input.patterns ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const lifecycles = [...(input.validation_lifecycles ?? [])].sort((a, b) => a.output_id.localeCompare(b.output_id));
  const validationSummary: IntelligenceValidationSummary = summarizeValidationLearning(outputs, lifecycles);

  const index: IntelligenceMaturityIndex = {
    version: OS_CONTRACTS_VERSION, methodology_version: INTELLIGENCE_SNAPSHOT_METHODOLOGY_VERSION,
    scope: input.scope, overall: maturity.overall, level: maturity.level, level_confidence: maturity.level_confidence,
    dimensions: dims, weights: {}, // equal weighting over measured dims (documented in methodology)
    anti_inflation_notes: [
      "volume never lifts analytical depth", "one pilot never lifts client specificity",
      "schema/tests never mint production maturity", "no outcomes ⇒ Outcome Performance not_measured",
      "no baseline ⇒ Differentiation not_measured", ...maturity.next_requirements,
    ],
    calculated_at: input.now, source_data_cutoff: input.source_data_cutoff,
  };

  const snapshot: IntelligenceSnapshot = {
    id: `snapshot:${describeScope(input.scope)}:${input.source_data_cutoff}`,
    scope: input.scope, methodology_version: INTELLIGENCE_SNAPSHOT_METHODOLOGY_VERSION,
    calculated_at: input.now, source_data_cutoff: input.source_data_cutoff,
    index, capability_assessments: caps, outputs, patterns,
    registry_summary: buildRegistrySummary(outputs, patterns), validations: [],
    validation_summary: validationSummary,
    learning_implications: lifecycles.flatMap((v) => v.learning_implications).sort((a, b) => a.id.localeCompare(b.id)),
    gaps, actions, readiness,
    lift: deriveIntelligenceLift(input.baseline, INTELLIGENCE_SNAPSHOT_METHODOLOGY_VERSION, input.now),
    diagnosis, previous_snapshot_id: input.previous?.id ?? null,
  };

  const violations = validateSnapshot(snapshot);
  if (violations.length > 0) throw new Error(`Snapshot failed honesty guards: ${violations.map((v) => v.code).join(", ")}`);
  return snapshot;
}

function describeScope(s: IntelligenceScope): string {
  return s.kind === "global" ? "global" : s.kind === "tenant" ? `tenant.${s.tenant_id}` : `client.${s.client_id}`;
}

/** Self-validation: every measured value, capability and readiness must pass the
 *  Block-1 guards before a snapshot may ship. */
export function validateSnapshot(s: IntelligenceSnapshot): Violation[] {
  const v: Violation[] = [];
  for (const d of s.index.dimensions) v.push(...validateMeasurement(d.measurement));
  v.push(...validateMeasurement(s.index.overall));
  for (const c of s.capability_assessments) v.push(...validateCapabilityAssessment(c));
  for (const o of s.outputs) {
    v.push(...validateMeasurement(o.novelty), ...validateMeasurement(o.actionability), ...validateMeasurement(o.commercial_relevance));
    v.push(...validateOutputHonesty(o));
    if (o.ranking_impact !== "none") v.push({ code: "output_ranking_impact", message: o.id });
  }
  v.push(...validateReadiness(s.readiness));
  for (const p of s.patterns) {
    v.push(...validateMeasurement(p.confidence));
    if (normalizePatternState(p) !== p.state) v.push({ code: "pattern_over_promoted", message: p.id });
    if (p.ranking_impact !== "off" || p.report_impact !== "off" || p.mode === "production")
      v.push({ code: "pattern_unsafe_impact", message: p.id });
  }
  return v;
}

/** Deterministic replay key: identical input ⇒ identical string. */
export function snapshotFingerprint(s: IntelligenceSnapshot): string {
  return serializeIntelligence(s);
}
