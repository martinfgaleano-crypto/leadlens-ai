// ─── Real snapshot → ML lab contract adapter ─────────────────────────────────
// Maps the Intelligence Foundation OpportunityFeatureSnapshot (frozen in
// report_json since sprint ff75cd2) into the vendored lab's feature schema
// (ml/src/leadlens_ml/contracts.py). One authoritative mapping — documented
// per-feature in LEADLENS_ML_INTEGRATION_MAP.md.
//
// Classification per feature (schema reconciliation):
//   available now      → mapped below
//   derivable safely   → evidence_quality string→float, soft counts
//   missing            → None/0 defaults (contract allows) — NEVER fabricated
//   prohibited         → tenant/user ids, company names, emails (excluded);
//                        baseline fit_score/category → baseline_meta ONLY
//                        (excluded from independent model features by the
//                        lab's EXCLUDE list; never sent as model features)

import { createHash } from "node:crypto";

export interface RealFeatureSnapshot {
  schema_version?: number;
  company_key?: string;
  primary_signal_type?: string | null;
  signal_types?: string[];
  signal_date?: string | null;
  signal_age_days?: number | null;
  freshness_bucket?: string | null;
  industry?: string | null;
  region?: string | null;
  country?: string | null;
  company_size?: string | null;
  size_bucket?: string | null;
  source_types?: string[];
  source_count?: number;
  evidence_grounded?: boolean | null;
  evidence_quality?: string | null;
  confidence?: number | null;
  fit_score?: number | null;
  category?: string | null;
  combo_key?: string | null;
  coverage_limited?: boolean;
  exploration?: boolean;
  generated_at?: string;
}

const EVIDENCE_QUALITY_TO_FLOAT: Record<string, number> = {
  high: 0.9, medium: 0.6, low: 0.3, insufficient: 0.1,
};

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Lab-contract record (subset of ml contracts.OpportunityFeatureSnapshot). */
export interface LabRecord {
  schema_version: number;
  company_key_hash: string;
  monitor_key: string;
  snapshot_at: string;
  primary_signal_type: string | null;
  signal_types: string[];
  signal_age_days: number | null;
  dated_signal_ratio: number | null;
  fresh_signal_count: number;
  recent_signal_count: number;
  stale_signal_count: number;
  source_count: number;
  independent_source_count: number;
  official_source_present: boolean | null;
  evidence_grounded: boolean | null;
  evidence_quality: number | null;
  contradiction_count: number;
  claim_count: number;
  coverage_limited: boolean | null;
  unsupported_claim_count: number;
  normalized_industry: string | null;
  region: string | null;
  company_size_bucket: string | null;
  hard_gate_violation_count: number;
  /** Run lineage group (job id) — excluded from model features; used for splits. */
  candidate_group: string;
  soft_fit_score: number | null; // deliberately null on real data: qualification fit is baseline-derived
  // passthrough (excluded from features by the lab EXCLUDE list):
  demo_only: boolean;
  customer_label?: 0 | 1 | null;
  customer_label_source?: string | null;
  job_id?: string;
  example_key?: string;
  baseline_rank?: number | null;
  baseline_score?: number | null;
}

export function adaptRealSnapshot(
  snap: RealFeatureSnapshot,
  ctx: { search_id: string | null; job_id: string; baseline_rank?: number | null },
): LabRecord | null {
  if (!snap?.company_key) return null;
  const bucket = snap.freshness_bucket ?? null;
  return {
    schema_version: 1,
    company_key_hash: sha256(snap.company_key),
    monitor_key: ctx.search_id ? sha256(ctx.search_id) : "unscoped",
    snapshot_at: snap.generated_at ?? new Date().toISOString(),
    primary_signal_type: snap.primary_signal_type ?? null,
    signal_types: snap.signal_types ?? [],
    signal_age_days: snap.signal_age_days ?? null,
    dated_signal_ratio: snap.signal_date ? 1 : (snap.signal_types?.length ? 0 : null),
    fresh_signal_count: bucket === "fresh" ? 1 : 0,
    recent_signal_count: bucket === "recent" ? 1 : 0,
    stale_signal_count: bucket === "stale" ? 1 : 0,
    source_count: snap.source_count ?? 0,
    independent_source_count: snap.source_count ?? 0, // v0: one primary source captured per opportunity
    official_source_present: snap.source_types?.some((s) => s === "official" || s === "company_website") ?? null,
    evidence_grounded: snap.evidence_grounded ?? null,
    evidence_quality: snap.evidence_quality ? EVIDENCE_QUALITY_TO_FLOAT[snap.evidence_quality] ?? null : null,
    contradiction_count: 0,          // not yet measured — honest zero-default documented in map
    claim_count: 0,
    coverage_limited: snap.coverage_limited ?? null,
    unsupported_claim_count: 0,
    normalized_industry: snap.industry ?? null,
    region: snap.region ?? snap.country ?? null,
    company_size_bucket: snap.size_bucket ?? null,
    hard_gate_violation_count: 0,    // gated candidates never reach reports; pools pending (documented gap)
    candidate_group: ctx.job_id,
    soft_fit_score: null,            // baseline-derived (qualification) → prohibited as independent feature
    demo_only: false,
    job_id: ctx.job_id,
    baseline_rank: ctx.baseline_rank ?? null,
    baseline_score: typeof snap.fit_score === "number" ? snap.fit_score : null,
  };
}
