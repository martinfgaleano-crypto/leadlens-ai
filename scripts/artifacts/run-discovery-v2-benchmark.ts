// Generates the deterministic Discovery Engine V2 benchmark artifact.
// 0 provider calls; fixture-based. Run: npm run pilot:discovery-v2-benchmark
import { writeFileSync, mkdirSync } from "node:fs";
import { runBenchmark } from "../../lib/discovery/source-intelligence/benchmark";

const artifact = runBenchmark();
mkdirSync("output", { recursive: true });
const out = "output/discovery-v2-colombia-hospitality-001.json";
writeFileSync(out, JSON.stringify(artifact, null, 2));
const s = Object.fromEntries(artifact.strategies.map((f) => [f.strategy, `raw ${f.raw_candidates} → resolved ${f.entity_resolved} → ctx ${f.context_compatible} → evid ${f.evidence_sufficient} → new-qual ${f.genuinely_new_qualified} · dom ${f.official_domains} · cost ${f.cost} · mc/qual ${f.marginal_cost_per_incremental_qualified}`]));
console.log(`wrote ${out} · provider_calls=${artifact.provider_calls}`);
for (const [k, v] of Object.entries(s)) console.log(`  ${k}: ${v}`);
console.log("  top rejection:", artifact.rejection_analysis[0]);

// Live validation artifact (V2.1)
import { buildLiveBenchmark } from "../../lib/discovery/source-intelligence/live";
const live = buildLiveBenchmark();
writeFileSync("output/discovery-v2-colombia-hospitality-live-001.json", JSON.stringify(live, null, 2));
console.log(`wrote live artifact · data_basis=${live.data_basis} · live=${live.live_execution} · provider_calls=${live.total_provider_calls} · sample=${live.entities_company_level.length} · cohorts executed=${live.cohorts.filter(c=>c.status==="executed").length}/3`);

// Retail benchmark (V2.4)
import { buildRetailBenchmark } from "../../lib/discovery/source-intelligence/retail-live";
const retail = buildRetailBenchmark();
writeFileSync("output/discovery-v2-colombia-retail-controlled-001.json", JSON.stringify(retail, null, 2));
console.log(`wrote retail · basis=${retail.data_basis} · raw ${retail.raw_listings} → canonical ${retail.canonical_accounts} · LIR ${retail.location_inflation_ratio} · assortment_yield ${retail.assortment_evidence_yield} · bias ${retail.source_bias.join("; ")}`);
