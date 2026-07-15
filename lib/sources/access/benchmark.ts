// ─── Source benchmark harness + marginal contribution ────────────────────────
// Runs the same query against multiple providers and measures quality/overlap.
// An API call is never presented as intelligence: the metrics that matter are
// unique grounded contribution, freshness and downstream yield — volume alone
// scores nothing here.

import type { SearchProvider, SearchProviderResponse, SearchQuery } from "./provider-contract";

export interface ProviderBenchmarkRow {
  provider: string;
  ok: boolean;
  error: string | null;
  results_returned: number;
  unique_urls: number;
  unique_domains: number;
  canonical_duplicates: number;
  dated_result_ratio: number | null;
  official_source_ratio: number | null;
  latency_ms: number;
  cost_estimate_usd: number | null;
  /** URLs no other benchmarked provider returned (marginal uniqueness). */
  marginal_unique_urls: number;
  overlap_with_others_ratio: number | null;
}

export interface BenchmarkResult {
  query: SearchQuery;
  ran_at: string;
  rows: ProviderBenchmarkRow[];
  notes: string[];
}

export async function runSourceBenchmark(providers: SearchProvider[], query: SearchQuery): Promise<BenchmarkResult> {
  const responses: SearchProviderResponse[] = await Promise.all(providers.map((p) => p.search(query)));
  const notes: string[] = [];

  const canonicalByProvider = new Map<string, Set<string>>();
  for (const r of responses) {
    canonicalByProvider.set(r.provider, new Set(r.results.map((x) => x.canonical_url)));
    if (!r.ok && r.error) notes.push(`${r.provider}: ${r.error}`);
  }

  const rows: ProviderBenchmarkRow[] = responses.map((r) => {
    const canon = Array.from(canonicalByProvider.get(r.provider) ?? []);
    const domains = new Set(canon.map((u) => { try { return new URL(u).host; } catch { return u; } }));
    const others = new Set<string>();
    for (const [pid, set] of Array.from(canonicalByProvider.entries())) {
      if (pid !== r.provider) for (const u of Array.from(set)) others.add(u);
    }
    const marginal = canon.filter((u) => !others.has(u)).length;
    const overlap = canon.length > 0 ? Number(((canon.length - marginal) / canon.length).toFixed(3)) : null;
    const dated = r.results.filter((x) => !!x.published_date).length;
    const official = r.results.filter((x) => x.source_type === "official" || x.source_type === "regulatory").length;
    return {
      provider: r.provider,
      ok: r.ok,
      error: r.error,
      results_returned: r.results.length,
      unique_urls: canon.length,
      unique_domains: domains.size,
      canonical_duplicates: r.results.length - canon.length,
      dated_result_ratio: r.results.length ? Number((dated / r.results.length).toFixed(3)) : null,
      official_source_ratio: r.results.length ? Number((official / r.results.length).toFixed(3)) : null,
      latency_ms: r.latency_ms,
      cost_estimate_usd: r.cost_estimate_usd,
      marginal_unique_urls: marginal,
      overlap_with_others_ratio: overlap,
    };
  });

  // Grounded-signal yield and downstream opportunity yield require the
  // extraction + review pipeline to run on these results — reported honestly
  // as not-yet-measured instead of estimated.
  notes.push("evidence_grounded_rate and downstream_opportunity_yield: not yet measured — requires extraction + review of these results (never estimated).");

  return { query, ran_at: new Date().toISOString(), rows, notes };
}
