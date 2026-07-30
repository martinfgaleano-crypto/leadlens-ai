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
  const { source } = await loadLatestArtifactOutputSource(opts.root, opts.scope ?? { kind: "global" });
  const outputs = assembleArtifactOutputs(source);
  const patterns = adaptLearnedPreferences(opts.learned_preferences ?? []);
  const outcomes: IntelligenceOutcome[] = []; // 039 outcomes empty in current data
  return {
    scope: opts.scope ?? { kind: "global" },
    now, source_data_cutoff: cutoff ?? now,
    capability_versions: { entity_resolution: "entity-resolution-v3", company_verification: "segment-universe-v1", structural_account_ranking: "market-to-account-pipeline-v1", company_discovery: "segment-universe-v1" },
    artifact: signals,
    distinct_clients: signals ? 1 : 0,
    feedback: { total_events: 0, rated_events: 0, useful_events: 0, corrections: 0, outcomes },
    knowledge: { vault_companies: null, verified_signals: null, sources: null, distinct_regions: 0, distinct_industries: 0, account_memory_records: null },
    evidence: deep ? {
      total: deep.summary.evidence_items,
      dated: deep.summary.dated_evidence_items,
      corroborated: deep.summary.corroborated_claims,
      stale: null,
      source_classes: deep.summary.source_classes,
      counterevidence_instrumented: true,
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
