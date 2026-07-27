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

const PILOT_DIR = "ml/data/pilot-amor-de-gea";

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

/** Assemble a live snapshot from real files. DB-only signals stay honest nulls
 *  when unavailable (⇒ not_measured/not_instrumented, never fabricated). */
export async function loadSnapshotInputs(opts: { scope?: IntelligenceScope; now?: string; root?: string } = {}): Promise<SnapshotInput> {
  const now = opts.now ?? new Date().toISOString();
  const { signals, cutoff } = await loadLatestArtifactSignals(opts.root);
  const outcomes: IntelligenceOutcome[] = []; // 039 outcomes empty in current data
  return {
    scope: opts.scope ?? { kind: "global" },
    now, source_data_cutoff: cutoff ?? now,
    capability_versions: { entity_resolution: "entity-resolution-v3", company_verification: "segment-universe-v1", structural_account_ranking: "market-to-account-pipeline-v1", company_discovery: "segment-universe-v1" },
    artifact: signals,
    distinct_clients: signals ? 1 : 0,
    feedback: { total_events: 0, rated_events: 0, useful_events: 0, corrections: 0, outcomes },
    knowledge: { vault_companies: null, verified_signals: null, sources: null, distinct_regions: 0, distinct_industries: 0, account_memory_records: null },
    evidence: null,
    learner: { preference_count: 0, validated_count: 0, max_sample_size: 0 },
    baseline: null,
    snapshots_persisted: false,
    ml_tables_available: false,
    previous: null,
  };
}

export async function assembleLiveSnapshot(opts: Parameters<typeof loadSnapshotInputs>[0] = {}): Promise<IntelligenceSnapshot> {
  return buildIntelligenceSnapshot(await loadSnapshotInputs(opts));
}
