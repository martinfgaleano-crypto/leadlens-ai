import { loadEnvConfig } from "@next/env";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractWithFallback } from "@/lib/sources/access/extractors";
import { resolvePublicationDate } from "@/lib/sources/access/date-resolver";
import type { BenchmarkDataset } from "@/lib/intelligence/signal-benchmark";

loadEnvConfig(process.cwd());
const MAX_EXTRACTS = 8;

async function main() {
  const dataset = JSON.parse(readFileSync("benchmarks/signal-recovery-v1.json", "utf8")) as BenchmarkDataset;
  const cases = dataset.cases.filter((c) => c.class === "positive").slice(0, MAX_EXTRACTS);
  const observations = [];
  for (const c of cases) {
    const extracted = await extractWithFallback(c.source_url);
    const resolved = resolvePublicationDate({ html: extracted.content, url: c.source_url });
    observations.push({
      case_id: c.id, url: c.source_url, expected_date: c.event_date, extraction_ok: extracted.ok,
      extractor: extracted.extractor, fallback_used: extracted.fallback_used, latency_ms: extracted.latency_ms,
      error: extracted.error, content_length: extracted.content?.length ?? 0,
      resolved_date: resolved.date, date_source: resolved.date_source, confidence: resolved.confidence,
      conflict: resolved.conflict, correct: resolved.date === c.event_date,
    });
  }
  const summary = {
    cases: observations.length, extraction_success: observations.filter((x) => x.extraction_ok).length,
    exact_date_recovery: observations.filter((x) => x.correct).length,
    missing_date: observations.filter((x) => !x.resolved_date).length,
    conflicting_date: observations.filter((x) => x.conflict).length,
    extractor_distribution: observations.reduce<Record<string, number>>((a, x) => { a[x.extractor] = (a[x.extractor] ?? 0) + 1; return a; }, {}),
  };
  const generated = new Date().toISOString();
  const artifact = { run_id: `date-calibration-${generated.replace(/[:.]/g, "-")}`, methodology_version: "signal-recovery-benchmark-v1", generated_at: generated, limits: { max_extracts: MAX_EXTRACTS }, summary, observations };
  const dir = join(process.cwd(), "ml/data/signal-benchmark"); mkdirSync(dir, { recursive: true });
  const path = join(dir, `${artifact.run_id}.json`); writeFileSync(path, JSON.stringify(artifact, null, 2));
  console.log(JSON.stringify({ artifact: path, summary }, null, 2));
}
main().catch((error) => { console.error(error); process.exit(1); });
