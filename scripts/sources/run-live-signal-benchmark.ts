import { loadEnvConfig } from "@next/env";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertLiveBenchmarkFlag, replayBenchmarkCase, type BenchmarkCase, type BenchmarkDataset,
} from "@/lib/intelligence/signal-benchmark";
import { braveProvider, serperProvider, tavilyProvider } from "@/lib/sources/access/providers";
import type { SearchProvider } from "@/lib/sources/access/provider-contract";

loadEnvConfig(process.cwd());
assertLiveBenchmarkFlag(process.env.LEADLENS_LIVE_BENCHMARK);
const MAX_QUERIES = 24, MAX_RESULTS = 5;

const queryFor = (c: BenchmarkCase) => {
  const year = c.event_date?.slice(0, 4) ?? c.window_end.slice(0, 4);
  const terms: Record<string, string> = {
    store_opening: "abrió nueva tienda", facility_opening: "opened new facility",
    product_launch: "announced new product", partnership: "announced partnership agreement",
    leadership_change: "leadership appointment CEO", acquisition: "completed acquisition",
  };
  return `"${c.account}" ${terms[c.category ?? ""] ?? "expansion"} ${year}`;
};

async function main() {
  const dataset = JSON.parse(readFileSync("benchmarks/signal-recovery-v1.json", "utf8")) as BenchmarkDataset;
  const selected = [
    ...dataset.cases.filter((c) => c.class === "positive").slice(0, 6),
    ...dataset.cases.filter((c) => ["adv-bioplaza-nigeria", "adv-generic-hiring-page"].includes(c.id)),
  ];
  const providers = [braveProvider, serperProvider, tavilyProvider];
  const health = await Promise.all(providers.map(async (provider) => ({ provider, health: await provider.health() })));
  const available = health.filter((x) => x.health.status === "available").map((x) => x.provider);
  const ledger: Array<Record<string, unknown>> = [];
  let calls = 0, measuredCost = 0, costCalls = 0;
  for (const c of selected) for (const provider of available) {
    if (calls >= MAX_QUERIES) break;
    const query = queryFor(c); const started = Date.now();
    const response = await provider.search({ query, region: c.country === "Colombia" ? "co" : null, language: c.country === "Colombia" ? "es" : "en", max_results: MAX_RESULTS, query_type: "signal_specific", freshness_days: null });
    calls++;
    if (response.cost_estimate_usd != null) { measuredCost += response.cost_estimate_usd; costCalls++; }
    const observations = response.results.map((result) => replayBenchmarkCase({
      ...c, source_url: result.canonical_url, title: result.title ?? "", text: result.snippet ?? "",
      event_date: result.published_date?.slice(0, 10) ?? null,
      expected_date_state: result.published_date ? "inferred" : "retrieved_only",
      provider: provider.id, source_owner: (() => { try { return new URL(result.canonical_url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } })(),
      source_type: result.source_type ?? "unknown",
    }));
    ledger.push({
      case_id: c.id, class: c.class, provider: provider.id, query, ok: response.ok,
      error: response.error, latency_ms: Date.now() - started, raw_results: response.results.length,
      expected_url_found: response.results.some((r) => r.canonical_url.replace(/\/$/, "") === c.source_url.replace(/\/$/, "")),
      valid_identity_results: observations.filter((o) => o.predicted_entity !== "wrong_entity").length,
      date_valid_results: observations.filter((o) => !!o.predicted_date).length,
      event_valid_results: observations.filter((o) => !!o.predicted_category).length,
      accepted_results: observations.filter((o) => o.predicted_signal).length,
      sanitized_results: response.results.map((r, index) => ({ url: r.canonical_url, title: r.title, published_date: r.published_date, predicted_signal: observations[index].predicted_signal })),
    });
  }
  const provider_results = available.map((provider: SearchProvider) => {
    const rows = ledger.filter((x) => x.provider === provider.id);
    const sum = (key: string) => rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
    return {
      provider: provider.id, queries: rows.length, successful_queries: rows.filter((r) => r.ok).length,
      raw_results: sum("raw_results"), expected_url_recovery: rows.filter((r) => r.expected_url_found).length,
      valid_identity_results: sum("valid_identity_results"), date_valid_results: sum("date_valid_results"),
      event_valid_results: sum("event_valid_results"), accepted_results: sum("accepted_results"),
      median_latency_ms: rows.length ? rows.map((r) => Number(r.latency_ms)).sort((a, b) => a - b)[Math.floor(rows.length / 2)] : null,
      cost_state: "not_measured",
    };
  });
  const sourceCutoff = new Date().toISOString();
  const artifact = {
    run_id: `live-benchmark-${sourceCutoff.replace(/[:.]/g, "-")}`, methodology_version: "signal-recovery-benchmark-v1",
    mode: "live", source_cutoff: sourceCutoff, selected_cases: selected.map((c) => c.id),
    limits: { max_queries: MAX_QUERIES, max_results: MAX_RESULTS, explicit_flag: true },
    calls, cost: costCalls ? { state: "measured", usd: Number(measuredCost.toFixed(6)) } : { state: "not_measured", reason: "Providers returned no cost estimate." },
    provider_health: health.map((x) => ({ provider: x.provider.id, status: x.health.status, reason: x.health.reason })),
    provider_results, ledger,
  };
  const dir = join(process.cwd(), "ml/data/signal-benchmark"); mkdirSync(dir, { recursive: true });
  const path = join(dir, `${artifact.run_id}.json`); writeFileSync(path, JSON.stringify(artifact, null, 2));
  console.log(JSON.stringify({ artifact: path, calls, cost: artifact.cost, provider_results }, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
