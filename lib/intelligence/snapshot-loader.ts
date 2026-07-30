// ─── Snapshot loader (provider-free) ─────────────────────────────────────────
// Gathers REAL project signals from the latest Market-to-Account harness
// artifact on disk and (optionally) growth-index DB counts, then calls the pure
// buildIntelligenceSnapshot. This is the only environment-touching part and is
// deliberately outside the determinism contract. No provider/LLM calls.

import { promises as fs } from "fs";
import path from "path";
import {
  buildIntelligenceSnapshot, type SnapshotInput, type SnapshotArtifactSignals,
} from "./snapshot-engine";
import type { IntelligenceScope, IntelligenceSnapshot, IntelligenceOutcome } from "./os-contracts";
import { assembleArtifactOutputs, type ArtifactOutputSource } from "./output-registry";
import { adaptLearnedPreferences, type LearnedPreferenceSource } from "./pattern-registry";

const PILOT_DIR = "ml/data/pilot-amor-de-gea";
const DEEP_EVIDENCE_DIR = "ml/data/evidence-temporal";
const RESEARCH_QUALITY_DIR = "ml/data/research-quality";
const SIGNAL_TEMPORAL_DIR = "ml/data/signal-temporal";
const SIGNAL_BENCHMARK_DIR = "ml/data/signal-benchmark";
const SIGNAL_MONITORING_OPERATIONS_DIR = "ml/data/signal-monitoring-operations";
const ENTITY_RESOLUTION_DIR = "ml/data/entity-resolution";

export interface EntityResolutionArtifact {
  generated_at: string; methodology_version: string; internal_only: true;
  summary: {
    accounts: number; identity_queries: number; searches: number; extractions: number; results: number;
    confirmed: number; high_confidence: number; probable: number; unresolved: number;
    verified_domains: number; official_properties: number; event_eligible: number;
    dated_event_results: number; directly_attributable_events: number; valid_signals: number;
    provider_health: Record<string,{ state: string; reason?: string; automatic_fallback?: boolean }>;
    cost: { state: string; reason?: string };
  };
}
export async function loadLatestEntityResolution(root = process.cwd()): Promise<EntityResolutionArtifact | null> {
  try {
    const dir=path.join(root,ENTITY_RESOLUTION_DIR);
    const files=(await fs.readdir(dir)).filter(f=>/^amor-de-gea-block10-.*\.json$/.test(f)).sort();
    const latest=files.at(-1); if(!latest) return null;
    return JSON.parse(await fs.readFile(path.join(dir,latest),"utf8")) as EntityResolutionArtifact;
  } catch { return null; }
}

export interface SignalBenchmarkArtifact {
  cutoff: string; run_id: string; methodology_version: string; preliminary: boolean;
  metrics: {
    sample_size: number; positive_labels: number; negative_labels: number; adversarial_cases: number;
    true_positives: number; false_positives: number; true_negatives: number; false_negatives: number;
    precision: { numerator: number; denominator: number; value: number | null; state: string };
    recall: { numerator: number; denominator: number; value: number | null; state: string };
    identity_precision: { numerator: number; denominator: number; value: number | null; state: string };
    date_valid_coverage: { numerator: number; denominator: number; value: number | null; state: string };
    event_normalization_accuracy: { numerator: number; denominator: number; value: number | null; state: string };
  };
  gate_failures: Record<string, number>;
  query_families: Array<{ family: string; accepted_signal: { value: number | null }; false_positive: { value: number | null } }>;
}
export interface SignalMonitoringOperationArtifact {
  cutoff: string; generated_at: string; methodology_version: string;
  summary: {
    accounts: number; searches: number; extracts: number; retries: number; raw_results: number;
    accepted_evidence: number; rejected_evidence: number; correct_entity_results: number;
    date_valid_results: number; event_valid_results: number; signal_candidates: number;
    valid_signals: number; material_changes: number; qualification_transitions: number;
    cost: { state: string; usd?: number; reason?: string };
  };
}

export async function loadLatestSignalBenchmark(root = process.cwd()): Promise<SignalBenchmarkArtifact | null> {
  try {
    const dir = path.join(root, SIGNAL_BENCHMARK_DIR);
    const files = (await fs.readdir(dir)).filter((f) => /^bench_.*\.json$/.test(f)).sort();
    const latest = files.at(-1); if (!latest) return null;
    const artifact = JSON.parse(await fs.readFile(path.join(dir, latest), "utf8")) as Omit<SignalBenchmarkArtifact, "cutoff">;
    return { ...artifact, cutoff: latest };
  } catch { return null; }
}
export async function loadLatestSignalMonitoringOperation(root = process.cwd()): Promise<SignalMonitoringOperationArtifact | null> {
  try {
    const dir = path.join(root, SIGNAL_MONITORING_OPERATIONS_DIR);
    const files = (await fs.readdir(dir)).filter((f) => /^amor-de-gea-block9-.*\.json$/.test(f)).sort();
    const latest = files.at(-1); if (!latest) return null;
    const artifact = JSON.parse(await fs.readFile(path.join(dir, latest), "utf8")) as Omit<SignalMonitoringOperationArtifact, "cutoff">;
    return { ...artifact, cutoff: latest };
  } catch { return null; }
}

export interface SignalTemporalArtifact {
  cutoff: string;
  generated_at: string;
  methodology_version: "signal-temporal-v2";
  migration_043_applied: boolean;
  summary: {
    accounts: number; triggers_checked: number; queries_executed: number; extracts: number;
    retries: number; signal_candidates: number; accepted_signals: number; corroborated_signals: number;
    accounts_with_material_change: number; unchanged_or_no_current_signal: number;
    qualification_transitions: number; measured_cost_usd: number | null; cost_state: string;
  };
  accounts: Array<{
    account: string; domain: string; baseline_cutoff: string;
    accepted_signals: Array<{ category: string; current_status: string; publication_date: string | null }>;
    what_changed: { state: string }; timing: string;
    output: { type: string; internal_only: true; ranking_impact: "off"; report_impact: "off" };
  }>;
}

export async function loadLatestSignalTemporal(root = process.cwd()): Promise<SignalTemporalArtifact | null> {
  try {
    const dir = path.join(root, SIGNAL_TEMPORAL_DIR);
    const files = (await fs.readdir(dir)).filter((f) => /^amor-de-gea-block8-.*\.json$/.test(f)).sort();
    const latest = files.at(-1);
    if (!latest) return null;
    const artifact = JSON.parse(await fs.readFile(path.join(dir, latest), "utf8")) as Omit<SignalTemporalArtifact, "cutoff">;
    return { ...artifact, cutoff: latest };
  } catch { return null; }
}

export interface ResearchQualityArtifact {
  cutoff: string;
  summary: {
    accounts_researched: number; planned_queries: number; rejected_queries: number; executed_queries: number;
    accepted_evidence: number; rejected_evidence: number; wrong_entity_rejections: number;
    dated_evidence: number; dated_evidence_coverage: number; claims: number;
    commercially_relevant_claims: number; corroboration_attempts: number; corroborated_claims: number;
    counterevidence_checks: number; qualification_coverage: number; actionable_accounts: number;
    monitor_accounts: number; excluded_accounts: number; query_efficiency: number;
    decision_distribution: Record<string, number>; source_quality_distribution: Record<string, number>;
    provider_cost: { state: "measured"; usd: number } | { state: "not_measured"; reason: string };
    database_persisted_accounts: number;
  };
  comparison: { quality_changes: string[] };
  accounts: Array<{
    account: string; domain: string;
    claims: Array<{ claim_id: string; statement: string; category: string; corroboration_state: string; publication_date: string | null; confidence: number }>;
    qualification: {
      state: string; passed_gates: string[]; failed_gates: string[]; remaining_uncertainty: string[];
      justified_next_action: string; unjustified_next_action: string;
      monitoring_triggers: Array<{ signal_category: string; why_it_matters: string; review_horizon_days: number }>;
    };
  }>;
}

export async function loadLatestResearchQuality(root = process.cwd()): Promise<ResearchQualityArtifact | null> {
  try {
    const dir = path.join(root, RESEARCH_QUALITY_DIR);
    const files = (await fs.readdir(dir)).filter((f) => /^amor-de-gea-block7-.*\.json$/.test(f)).sort();
    const latest = files.at(-1);
    if (!latest) return null;
    const artifact = JSON.parse(await fs.readFile(path.join(dir, latest), "utf8")) as Omit<ResearchQualityArtifact, "cutoff">;
    return { ...artifact, cutoff: latest };
  } catch { return null; }
}

export interface DeepEvidenceArtifact {
  cutoff: string;
  summary: {
    accounts_researched: number; evidence_items: number; corroborated_claims: number;
    dated_evidence_items: number; source_classes: number;
    contradicted_claims: number; current_opportunities: number; monitor_accounts: number;
    review_candidates: number; provider_calls: number; provider_reported_cost_usd: number | null;
  };
  accounts: Array<{
    account: string; domain: string;
    dossier: {
      evidence: { total: number; independent_sources: number; corroborated_claims: number; contradicted_claims: number };
      temporal: { timing_state: string };
      decision: { state: string; reason: string };
      confidence: number; limitations: string[];
    };
  }>;
}

export async function loadLatestDeepEvidence(root = process.cwd()): Promise<DeepEvidenceArtifact | null> {
  try {
    const dir = path.join(root, DEEP_EVIDENCE_DIR);
    const files = (await fs.readdir(dir)).filter((f) => /^amor-de-gea-.*\.json$/.test(f)).sort();
    const latest = files.at(-1);
    if (!latest) return null;
    const artifact = JSON.parse(await fs.readFile(path.join(dir, latest), "utf8")) as Omit<DeepEvidenceArtifact, "cutoff">;
    return { ...artifact, cutoff: latest };
  } catch { return null; }
}

/** Read the newest segment-universe + staged-pipeline artifact, if any. */
export async function loadLatestArtifactSignals(root = process.cwd()): Promise<{ signals: SnapshotArtifactSignals | null; cutoff: string | null }> {
  try {
    const dir = path.join(root, PILOT_DIR);
    const runs = (await fs.readdir(dir)).filter((d) => /\d{4}-\d{2}-\d{2}T/.test(d)).sort();
    const latest = runs[runs.length - 1];
    if (!latest) return { signals: null, cutoff: null };
    const su = JSON.parse(await fs.readFile(path.join(dir, latest, "segment-universe.json"), "utf8"));
    let staged: Record<string, unknown> = {};
    try { staged = JSON.parse(await fs.readFile(path.join(dir, latest, "staged-pipeline.json"), "utf8")); } catch { /* optional */ }
    const evc = (staged.evidence_coverage ?? {}) as { corroborated?: number; weak?: number; total_shortlist?: number };
    const sig = (staged.signal_coverage ?? {}) as { with_timing?: number };
    const drs = (staged.deep_research_status ?? {}) as { complete?: number };
    const signals: SnapshotArtifactSignals = {
      client_id: "amor-de-gea",
      segments: Object.keys(su.segment_distribution ?? {}).length,
      verified: su.verified_company_count ?? 0,
      probable: su.probable_company_count ?? 0,
      excluded: su.excluded_company_count ?? 0,
      shortlist: Array.isArray(staged.shortlist) ? (staged.shortlist as unknown[]).length : 0,
      dynamic_opportunities: sig.with_timing ?? 0,
      evidence_corroborated: evc.corroborated ?? 0,
      evidence_weak: evc.weak ?? 0,
      evidence_total: evc.total_shortlist ?? 0,
      deep_research_complete: drs.complete ?? 0,
      replayable: true,
    };
    // Cutoff = the run directory name (stable, deterministic identifier).
    return { signals, cutoff: latest };
  } catch { return { signals: null, cutoff: null }; }
}

/** Load the richer, still provider-free projection required by the output
 * registry. Missing fields stay empty; no conclusion is fabricated. */
export async function loadLatestArtifactOutputSource(
  root = process.cwd(),
  scope: IntelligenceScope = { kind: "global" },
): Promise<{ source: ArtifactOutputSource | null; cutoff: string | null }> {
  try {
    const dir = path.join(root, PILOT_DIR);
    const runs = (await fs.readdir(dir)).filter((d) => /\d{4}-\d{2}-\d{2}T/.test(d)).sort();
    const latest = runs[runs.length - 1];
    if (!latest) return { source: null, cutoff: null };
    const su = JSON.parse(await fs.readFile(path.join(dir, latest, "segment-universe.json"), "utf8"));
    const staged = JSON.parse(await fs.readFile(path.join(dir, latest, "staged-pipeline.json"), "utf8"));
    const shortlist = Array.isArray(staged.shortlist) ? staged.shortlist as Array<{ company?: unknown }> : [];
    const versions = [String(staged.version ?? "market-to-account-pipeline-v1"), "segment-universe-v1"];
    return {
      cutoff: latest,
      source: {
        source_id: `artifact:${latest}`,
        scope,
        created_at: latest,
        market: null,
        client_id: "amor-de-gea",
        segment_distribution: su.segment_distribution ?? {},
        raw_candidates: su.raw_candidate_count ?? 0,
        deduplicated_candidates: su.deduped_company_count ?? 0,
        verified: su.verified_company_count ?? 0,
        probable: su.probable_company_count ?? 0,
        excluded: su.excluded_company_count ?? 0,
        shortlist_accounts: shortlist.map((a) => String(a.company ?? "")).filter(Boolean),
        timing_count: staged.signal_coverage?.with_timing ?? 0,
        evidence_corroborated: staged.evidence_coverage?.corroborated ?? 0,
        evidence_total: staged.evidence_coverage?.total_shortlist ?? 0,
        deep_research_complete: staged.deep_research_status?.complete ?? 0,
        capability_versions: versions,
      },
    };
  } catch { return { source: null, cutoff: null }; }
}

/** Assemble a live snapshot from real files. DB-only signals stay honest nulls
 *  when unavailable (⇒ not_measured/not_instrumented, never fabricated). */
export async function loadSnapshotInputs(opts: {
  scope?: IntelligenceScope;
  now?: string;
  root?: string;
  learned_preferences?: LearnedPreferenceSource[];
} = {}): Promise<SnapshotInput> {
  const now = opts.now ?? new Date().toISOString();
  const { signals, cutoff } = await loadLatestArtifactSignals(opts.root);
  const deep = await loadLatestDeepEvidence(opts.root);
  const research = await loadLatestResearchQuality(opts.root);
  const temporal = await loadLatestSignalTemporal(opts.root);
  const benchmark = await loadLatestSignalBenchmark(opts.root);
  const { source } = await loadLatestArtifactOutputSource(opts.root, opts.scope ?? { kind: "global" });
  const outputs = assembleArtifactOutputs(source);
  const patterns = adaptLearnedPreferences(opts.learned_preferences ?? []);
  const outcomes: IntelligenceOutcome[] = []; // 039 outcomes empty in current data
  return {
    scope: opts.scope ?? { kind: "global" },
    now, source_data_cutoff: cutoff ?? now,
    capability_versions: { entity_resolution: "entity-resolution-v3", company_verification: "segment-universe-v1", structural_account_ranking: "market-to-account-pipeline-v1", company_discovery: "segment-universe-v1", signal_monitoring: temporal?.methodology_version ?? "not_available", signal_recovery_benchmark: benchmark?.methodology_version ?? "not_available" },
    artifact: signals ? {
      ...signals,
      deep_research_complete: research?.summary.accounts_researched ?? signals.deep_research_complete,
      evidence_corroborated: research?.summary.corroborated_claims ?? signals.evidence_corroborated,
      evidence_weak: research ? research.summary.accepted_evidence - research.summary.corroborated_claims : signals.evidence_weak,
      evidence_total: research?.summary.accepted_evidence ?? signals.evidence_total,
      dynamic_opportunities: research?.summary.actionable_accounts ?? signals.dynamic_opportunities,
    } : signals,
    distinct_clients: signals ? 1 : 0,
    feedback: { total_events: 0, rated_events: 0, useful_events: 0, corrections: 0, outcomes },
    knowledge: { vault_companies: null, verified_signals: null, sources: null, distinct_regions: 0, distinct_industries: 0, account_memory_records: null },
    evidence: research ? {
      total: research.summary.accepted_evidence,
      dated: research.summary.dated_evidence,
      corroborated: research.summary.corroborated_claims,
      stale: null,
      source_classes: Object.values(research.summary.source_quality_distribution).filter((n) => n > 0).length,
      counterevidence_instrumented: true,
    } : deep ? {
      total: deep.summary.evidence_items, dated: deep.summary.dated_evidence_items,
      corroborated: deep.summary.corroborated_claims, stale: null,
      source_classes: deep.summary.source_classes, counterevidence_instrumented: true,
    } : null,
    learner: {
      preference_count: patterns.length,
      validated_count: 0,
      max_sample_size: patterns.reduce((m, p) => Math.max(m, p.sample_size), 0),
    },
    outputs, patterns,
    validation_lifecycles: [],
    baseline: null,
    snapshots_persisted: false,
    ml_tables_available: false,
    previous: null,
  };
}

export async function assembleLiveSnapshot(opts: Parameters<typeof loadSnapshotInputs>[0] = {}): Promise<IntelligenceSnapshot> {
  return buildIntelligenceSnapshot(await loadSnapshotInputs(opts));
}
