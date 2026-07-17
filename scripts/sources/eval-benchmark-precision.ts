// ─── Benchmark precision evaluation (promotion-gates-v2) ─────────────────────
// Applies the pre-Vault promotion gates to a benchmark run and computes the
// discovery funnel + precision among review-ready rows. Labels (correct /
// incorrect per review-ready row) come from a benchmark-only adjudication file
// — AI-labeled over stored evidence, NEVER persisted to the Vault and NEVER
// auto-promoted. Output: ml/data/source-benchmark/precision-<run>.json
// Usage: npx tsx scripts/sources/eval-benchmark-precision.ts <results.jsonl> [labels.json]

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { evaluatePromotionGates, PROMOTION_GATES_VERSION, type BenchmarkResultRow } from "@/lib/sources/promotion-contract";

const resultsPath = process.argv[2];
const labelsPath = process.argv[3];
if (!resultsPath) { console.error("usage: eval-benchmark-precision.ts <results.jsonl> [labels.json]"); process.exit(1); }

const rows = readFileSync(resultsPath, "utf8").trim().split("\n").map((l) => JSON.parse(l)) as (BenchmarkResultRow & { provider_first_seen: string })[];
const labels: Record<string, { correct: boolean; note: string }> = labelsPath ? JSON.parse(readFileSync(labelsPath, "utf8")).labels : {};

const funnel = { adjudicated: rows.length, review_ready: 0, gated_out: 0 };
const reasonCounts: Record<string, number> = {};
const reviewReady: Record<string, unknown>[] = [];
const gatedOut: Record<string, unknown>[] = [];

for (const row of rows) {
  const verdict = evaluatePromotionGates(row);
  const entry = {
    query_id: row.query_id, region: row.region, provider: row.provider_first_seen,
    url: row.canonical_url, title: row.title, date: row.resolved_date?.date ?? null,
    gate_reasons: verdict.reasons,
  };
  if (verdict.pass) { funnel.review_ready++; reviewReady.push(entry); }
  else {
    funnel.gated_out++;
    gatedOut.push(entry);
    for (const r of verdict.reasons) reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
  }
}

// Precision among review-ready (labeled rows only; unlabeled = not yet judged).
const judged = reviewReady.filter((r) => labels[r.url as string]);
const correct = judged.filter((r) => labels[r.url as string].correct);
const precision = judged.length ? Number((correct.length / judged.length).toFixed(3)) : null;

const by = (key: "provider" | "region") => {
  const groups: Record<string, { review_ready: number; judged: number; correct: number; precision: number | null }> = {};
  for (const r of reviewReady) {
    const k = r[key] as string;
    groups[k] ??= { review_ready: 0, judged: 0, correct: 0, precision: null };
    groups[k].review_ready++;
    const label = labels[r.url as string];
    if (label) { groups[k].judged++; if (label.correct) groups[k].correct++; }
  }
  for (const g of Object.values(groups)) g.precision = g.judged ? Number((g.correct / g.judged).toFixed(3)) : null;
  return groups;
};

const out = {
  run: basename(resultsPath),
  gates_version: PROMOTION_GATES_VERSION,
  labels_note: "labels are benchmark-only AI adjudication over stored evidence — never persisted to the Vault, never auto-promoted, not human review",
  funnel,
  top_rejection_reasons: Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).map(([reason, n]) => ({ reason, n })),
  precision: { overall: precision, target: 0.7, met: precision !== null ? precision >= 0.7 : null, judged: judged.length, correct: correct.length },
  by_provider: by("provider"),
  by_region: by("region"),
  review_ready: reviewReady.map((r) => ({ ...r, label: labels[r.url as string] ?? null })),
  gated_out: gatedOut,
};
const outPath = resultsPath.replace(/results-/, "precision-").replace(/\.jsonl$/, ".json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ funnel, precision: out.precision, top_rejection_reasons: out.top_rejection_reasons.slice(0, 6) }, null, 2));
console.log(`written: ${outPath}`);
