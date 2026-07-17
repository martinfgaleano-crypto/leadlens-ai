// ─── Benchmark precision & yield evaluation (promotion-gates-v3) ─────────────
// Applies gates v3 (4 states) to a benchmark run and computes the discovery
// funnel, precision among review-ready, useful yield, and a v2-vs-v3
// comparison. Labels come from a benchmark-only AI adjudication file — never
// persisted to the Vault, never auto-promoted, NOT human review.
// Output: ml/data/source-benchmark/precision-<run>.json
// Usage: npx tsx scripts/sources/eval-benchmark-precision.ts <results.jsonl> [labels.json]

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { evaluatePromotionGates, evaluatePromotionGatesV3, PROMOTION_GATES_V3_VERSION, type BenchmarkResultRow } from "@/lib/sources/promotion-contract";

const resultsPath = process.argv[2];
const labelsPath = process.argv[3];
if (!resultsPath) { console.error("usage: eval-benchmark-precision.ts <results.jsonl> [labels.json]"); process.exit(1); }

const rows = readFileSync(resultsPath, "utf8").trim().split("\n").map((l) => JSON.parse(l)) as (BenchmarkResultRow & { provider_first_seen: string })[];
const labels: Record<string, { verdict: string; note: string }> = labelsPath ? JSON.parse(readFileSync(labelsPath, "utf8")).labels : {};

const funnel: Record<string, number> = { adjudicated: rows.length, review_ready: 0, monitor_only: 0, quarantine: 0, reject: 0 };
const reasonCounts: Record<string, number> = {};
const entityClasses: Record<string, number> = {};
const byStatus: Record<string, Record<string, unknown>[]> = { review_ready: [], monitor_only: [], quarantine: [], reject: [] };
let v2Pass = 0;

for (const row of rows) {
  const v3 = evaluatePromotionGatesV3(row);
  if (evaluatePromotionGates(row).pass) v2Pass++;
  funnel[v3.status]++;
  entityClasses[v3.entity_class] = (entityClasses[v3.entity_class] ?? 0) + 1;
  for (const r of v3.reasons) reasonCounts[r] = (reasonCounts[r] ?? 0) + 1;
  byStatus[v3.status].push({
    query_id: row.query_id, region: row.region, signal_type: row.signal, provider: row.provider_first_seen,
    url: row.canonical_url, title: row.title, date: row.resolved_date?.date ?? null,
    entity_class: v3.entity_class, primary_account: v3.primary_account, reasons: v3.reasons,
    label: labels[row.canonical_url] ?? null,
  });
}

// Precision among review-ready; useful yield counts likely-good rows anywhere
// (approve among review-ready + genuinely useful monitor/quarantine per labels).
const judged = byStatus.review_ready.filter((r) => r.label);
const approve = judged.filter((r) => (r.label as { verdict: string }).verdict === "likely_approve");
const nearPassJudged = [...byStatus.monitor_only, ...byStatus.quarantine].filter((r) => r.label);
const usefulNearPass = nearPassJudged.filter((r) => ["likely_approve", "useful_monitor"].includes((r.label as { verdict: string }).verdict));
const precision = judged.length ? Number((approve.length / judged.length).toFixed(3)) : null;

const groupMetric = (key: "provider" | "region" | "signal_type") => {
  const g: Record<string, { review_ready: number; judged: number; approve: number; precision: number | null }> = {};
  for (const r of byStatus.review_ready) {
    const k = r[key] as string;
    g[k] ??= { review_ready: 0, judged: 0, approve: 0, precision: null };
    g[k].review_ready++;
    if (r.label) { g[k].judged++; if ((r.label as { verdict: string }).verdict === "likely_approve") g[k].approve++; }
  }
  for (const v of Object.values(g)) v.precision = v.judged ? Number((v.approve / v.judged).toFixed(3)) : null;
  return g;
};
const queries = new Set(rows.map((r) => r.query_id)).size;

const out = {
  run: basename(resultsPath),
  gates_version: PROMOTION_GATES_V3_VERSION,
  labels_note: "labels are benchmark-only AI adjudication over stored evidence — never persisted to the Vault, never auto-promoted, not human review",
  funnel,
  v2_vs_v3: { v2_pass: v2Pass, v3_review_ready: funnel.review_ready, v3_near_pass: funnel.monitor_only + funnel.quarantine },
  entity_class_distribution: entityClasses,
  top_rejection_reasons: Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).map(([reason, n]) => ({ reason, n })),
  precision: {
    overall: precision, target: 0.7, met: precision !== null && judged.length >= 7 ? precision >= 0.7 : null,
    judged: judged.length, approve: approve.length,
    sample_note: judged.length < 7 ? "sample below n=7 — target NOT validated, treat as directional" : `n=${judged.length}`,
  },
  useful_yield: {
    queries,
    likely_good_total: approve.length + usefulNearPass.length,
    per_10_queries: queries ? Number(((approve.length + usefulNearPass.length) / queries * 10).toFixed(2)) : null,
    near_pass_judged: nearPassJudged.length, near_pass_useful: usefulNearPass.length,
  },
  by_provider: groupMetric("provider"), by_region: groupMetric("region"), by_signal_type: groupMetric("signal_type"),
  review_ready: byStatus.review_ready, monitor_only: byStatus.monitor_only, quarantine: byStatus.quarantine,
  reject: byStatus.reject.map((r) => ({ query_id: r.query_id, url: r.url, entity_class: r.entity_class, reasons: r.reasons })),
};
const outPath = resultsPath.replace(/results-/, "precision-").replace(/\.jsonl$/, ".json");
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ funnel, v2_vs_v3: out.v2_vs_v3, precision: out.precision, useful_yield: out.useful_yield, entity_classes: entityClasses }, null, 1));
console.log(`written: ${outPath}`);
