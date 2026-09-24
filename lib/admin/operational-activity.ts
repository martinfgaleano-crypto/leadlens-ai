// ─── Admin Operational Activity — LIVE product state from canonical persisted tables ────────────
//
// The Intelligence Observatory's capability scores are computed from curated ML acceptance artifacts
// (capability MATURITY), which do not move with day-to-day production. This module is the complement:
// the actual OPERATIONAL activity read live from the canonical tables the productive pipeline writes —
//   • intelligence runs        → snapshot_reports rows whose job_id is a productive run (intel_*)
//   • delivered evaluations    → account_intelligence_charges (one row per charged company evaluation)
//   • new Vault companies      → vault_companies.first_seen_at
// Pure aggregation (deterministic, testable) over already-persisted rows — no new research, no writes.
// Idempotency-safe: distinct_runs de-duplicates recovery retries of the same logical run/analysis.

export interface IntelRunRow { job_id?: string | null; created_at?: string | null }
export interface ChargeRow { created_at?: string | null; analysis_key?: string | null }
export interface VaultRow { first_seen_at?: string | null }

export interface WindowCounts { total: number; last24h: number; last7d: number; last30d: number; last_activity_at: string | null }
export interface OperationalActivity {
  intelligence_runs: WindowCounts & { distinct_runs: number };
  delivered_evaluations: WindowCounts & { distinct_analyses: number };
  vault_new_companies: WindowCounts;
  generated_at: string;
}

function windows(dates: Array<string | null | undefined>, now: number): WindowCounts {
  const H = 3600_000, d1 = 24 * H, d7 = 7 * d1, d30 = 30 * d1;
  let last = -Infinity, lastIso: string | null = null, l24 = 0, l7 = 0, l30 = 0, total = 0;
  for (const d of dates) {
    const t = Date.parse(String(d ?? ""));
    if (!Number.isFinite(t)) continue;
    total++;
    const age = now - t;
    if (age <= d1) l24++;
    if (age <= d7) l7++;
    if (age <= d30) l30++;
    if (t > last) { last = t; lastIso = new Date(t).toISOString(); }
  }
  return { total, last24h: l24, last7d: l7, last30d: l30, last_activity_at: lastIso };
}

/** Aggregate live operational activity. Pure: caller supplies already-fetched canonical rows. */
export function buildOperationalActivity(input: { intelRuns: IntelRunRow[]; charges: ChargeRow[]; vault: VaultRow[]; now?: number }): OperationalActivity {
  const now = input.now ?? Date.now();
  const runs = input.intelRuns.filter((r) => /^intel_/.test(String(r.job_id ?? "")));
  return {
    intelligence_runs: { ...windows(runs.map((r) => r.created_at), now), distinct_runs: new Set(runs.map((r) => r.job_id)).size },
    delivered_evaluations: { ...windows(input.charges.map((c) => c.created_at), now), distinct_analyses: new Set(input.charges.map((c) => c.analysis_key).filter(Boolean)).size },
    vault_new_companies: windows(input.vault.map((v) => v.first_seen_at), now),
    generated_at: new Date(now).toISOString(),
  };
}
