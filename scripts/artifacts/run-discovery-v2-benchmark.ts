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
