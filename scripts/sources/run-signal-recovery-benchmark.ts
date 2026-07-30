import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertLiveBenchmarkFlag, benchmarkDoesNotAffectProduction, queryFamilyMetrics,
  runFixtureBenchmark, type BenchmarkDataset,
} from "@/lib/intelligence/signal-benchmark";

const mode = process.argv.includes("--live") ? "live" : "fixture";
if (mode === "live") {
  assertLiveBenchmarkFlag(process.env.LEADLENS_LIVE_BENCHMARK);
  throw new Error("Live provider evaluation must select a provider explicitly with the Block 9 live runner; fixture runner will not infer one.");
}

const root = process.cwd();
const datasetPath = join(root, "benchmarks/signal-recovery-v1.json");
const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as BenchmarkDataset;
const run = runFixtureBenchmark(dataset);
const query_families = queryFamilyMetrics(dataset, run.observations);
const gate_failures = run.observations.flatMap((o) => o.gate_trace).filter((g) => g.state === "fail")
  .reduce<Record<string, number>>((acc, gate) => { acc[gate.gate] = (acc[gate.gate] ?? 0) + 1; return acc; }, {});
const artifact = {
  ...run, safety: benchmarkDoesNotAffectProduction(), dataset_path: "benchmarks/signal-recovery-v1.json",
  preliminary: run.metrics.sample_size < 30, query_families, gate_failures,
  false_negatives: run.observations.filter((o) => o.false_negative_code),
  false_positives: run.observations.filter((o) => o.false_positive_code),
  provider_results: [{ provider: "fixture", calls: 0, cost_state: "not_measured", note: "No provider conclusion is inferred from fixture replay." }],
};
const outDir = join(root, "ml/data/signal-benchmark"); mkdirSync(outDir, { recursive: true });
const output = join(outDir, `${run.run_id}.json`); writeFileSync(output, JSON.stringify(artifact, null, 2));
console.log(JSON.stringify({ artifact: output, metrics: run.metrics, gate_failures, preliminary: artifact.preliminary }, null, 2));
