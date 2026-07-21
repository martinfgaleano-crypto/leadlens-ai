// ─── Search-provider ROI measurement (search-provider-roi-v1) ────────────────
// Decision support for whether paying for a search provider (Serper $50 min,
// Tavily plan, Brave) is justified. Computes marginal value of search vs the
// no-search baseline (targeted_discovery/provider_limited) from REAL run
// metrics — never a projection. The recommendation stays "do not buy" until
// real data shows search materially improves recall / confirmed opportunities /
// cost-per-useful-opportunity. Feeds the Provider Health console.

import type { DiscoveryMetrics } from "@/lib/discovery/company-first-discovery";

export const SEARCH_PROVIDER_ROI_VERSION = "search-provider-roi-v1";

export interface RunSummary {
  operating_mode: DiscoveryMetrics["operating_mode"];
  provider_cost_usd: number;        // spend attributable to search this run (0 in no-search modes)
  queries: number;
  urls_useful: number;              // urls that passed the junk prefilter
  companies_identified: number;
  material_signals: number;         // signals that were triggers (not metrics/PR)
  finalists: number;
  confirmed_opportunities: number;  // human-confirmed true positives
  duration_ms: number;
}

export interface RoiVerdict {
  search_runs: number; baseline_runs: number;
  cost_per_confirmed_search: number | null;
  cost_per_confirmed_baseline: number | null;
  recall_uplift_pct: number | null;         // confirmed/run search vs baseline
  marginal_confirmed_per_run: number | null;
  recommendation: "insufficient_data" | "do_not_buy" | "consider_buy";
  reason: string;
  n_note: string;
}

/** From a set of REAL run summaries, decide if search provides enough marginal
 *  value to justify its cost. Conservative: needs several confirmed
 *  opportunities on BOTH sides before it ever says "consider_buy". */
export function assessSearchRoi(runs: RunSummary[]): RoiVerdict {
  const search = runs.filter((r) => r.operating_mode === "full_discovery");
  const baseline = runs.filter((r) => r.operating_mode === "targeted_discovery" || r.operating_mode === "provider_limited");
  const sum = (rs: RunSummary[], k: keyof RunSummary) => rs.reduce((a, r) => a + (r[k] as number), 0);

  const sConf = sum(search, "confirmed_opportunities"), bConf = sum(baseline, "confirmed_opportunities");
  const sCost = sum(search, "provider_cost_usd");
  const cps = sConf > 0 ? sCost / sConf : null;
  const cpb = bConf > 0 ? 0 : null; // baseline search cost is 0 by construction
  const sPerRun = search.length ? sConf / search.length : null;
  const bPerRun = baseline.length ? bConf / baseline.length : null;
  const marginal = sPerRun !== null && bPerRun !== null ? sPerRun - bPerRun : null;
  const uplift = sPerRun !== null && bPerRun !== null && bPerRun > 0 ? Math.round(((sPerRun - bPerRun) / bPerRun) * 100) : null;

  // Need enough n on both sides AND a real gap to ever recommend buying.
  let recommendation: RoiVerdict["recommendation"] = "insufficient_data";
  let reason = "";
  if (search.length < 3 || baseline.length < 3) {
    recommendation = "insufficient_data";
    reason = `n insuficiente (search=${search.length}, baseline=${baseline.length}). Se requieren ≥3 corridas confirmadas de cada modo antes de decidir.`;
  } else if (marginal !== null && marginal >= 1 && sConf >= 3) {
    recommendation = "consider_buy";
    reason = `El search añade ~${marginal.toFixed(1)} oportunidades confirmadas por corrida sobre el baseline sin search — evaluar compra.`;
  } else {
    recommendation = "do_not_buy";
    reason = `El search NO mejora suficientemente los resultados confirmados (marginal=${marginal?.toFixed(2) ?? "?"}/run). El modo sin search cubre la necesidad actual.`;
  }

  return {
    search_runs: search.length, baseline_runs: baseline.length,
    cost_per_confirmed_search: cps, cost_per_confirmed_baseline: cpb,
    recall_uplift_pct: uplift, marginal_confirmed_per_run: marginal,
    recommendation, reason,
    n_note: "Métricas derivadas SOLO de corridas reales; sin proyección. cost_per_confirmed_baseline=0 porque el modo sin search no paga búsqueda.",
  };
}
