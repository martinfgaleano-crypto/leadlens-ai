// ─── Balanced human-review sample from source-benchmark artifacts ─────────────
// Picks ~20 results spanning regions, providers, and quality outcomes so the
// admin can calibrate the auto-flags. Reads local artifacts (server-side);
// honest empty state when none exist. No customer data; admin-only callers.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

export interface BenchmarkRow {
  query_id: string;
  region: string;
  signal: string;
  url: string;
  canonical_url: string;
  title: string | null;
  provider_first_seen: string;
  in_brave: boolean;
  in_serper: boolean;
  source_type: string | null;
  provider_date: string | null;
  extraction: { ok: boolean; extractor: string; fallback_used: boolean; error: string | null; latency_ms: number };
  resolved_date: { date: string | null; date_source: string; confidence: string; validation_method: string; is_modification_date: boolean; conflict: boolean };
  auto_flags: Record<string, boolean | string>;
}

export interface ReviewSampleItem extends BenchmarkRow {
  result_key: string;
  company_guess: string;
  bucket: string;
}

export function resultKey(row: { canonical_url: string; query_id: string }): string {
  return createHash("sha256").update(`${row.query_id}|${row.canonical_url}`).digest("hex").slice(0, 24);
}

function companyGuess(title: string | null): string {
  if (!title) return "Unknown";
  return title.split(/[|\-–—:]/)[0].trim().slice(0, 60) || "Unknown";
}

function readLatestWideResults(): BenchmarkRow[] {
  const dir = "ml/data/source-benchmark";
  if (!existsSync(dir)) return [];
  // Prefer the wide (no-freshness) run; fall back to any results file.
  const files = readdirSync(dir).filter((f) => f.startsWith("results-") && f.endsWith(".jsonl"));
  const wide = files.find((f) => !f.includes("fresh")) ?? files.sort().reverse()[0];
  if (!wide) return [];
  return readFileSync(`${dir}/${wide}`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as BenchmarkRow);
}

/** Balanced ~20-row sample across region × provider × outcome × date certainty. */
export function buildReviewSample(target = 20): { items: ReviewSampleItem[]; source_file: string | null; total_available: number } {
  const rows = readLatestWideResults();
  if (rows.length === 0) return { items: [], source_file: null, total_available: 0 };

  const withMeta: ReviewSampleItem[] = rows.map((r) => {
    const f = r.auto_flags as Record<string, boolean>;
    const bucket = f.qualified_opportunity ? "qualified"
      : (f.grounded_claim && f.valid_date) ? "valid_not_qualified"
      : (r.resolved_date.confidence === "low" || r.resolved_date.date === null) ? "uncertain_date"
      : "rejected";
    return { ...r, result_key: resultKey(r), company_guess: companyGuess(r.title), bucket };
  });

  // Stratify: aim for coverage across region, provider, bucket, source officiality.
  const picked: ReviewSampleItem[] = [];
  const seen = new Set<string>();
  const want = (pred: (x: ReviewSampleItem) => boolean, n: number) => {
    for (const x of withMeta) {
      if (picked.length >= target) break;
      if (seen.has(x.result_key) || !pred(x)) continue;
      picked.push(x); seen.add(x.result_key);
      if (picked.filter(pred).length >= n) break;
    }
  };
  // guarantees across the requested axes
  for (const region of ["US", "CO", "MX"]) want((x) => x.region === region, 3);
  for (const provider of ["brave", "serper"]) want((x) => x.provider_first_seen === provider, 2);
  for (const bucket of ["qualified", "valid_not_qualified", "uncertain_date", "rejected"]) want((x) => x.bucket === bucket, 2);
  want((x) => x.source_type === "official", 1);
  want((x) => x.source_type !== "official", 1);
  // fill remainder
  want(() => true, target);

  return { items: picked.slice(0, target), source_file: "latest wide run", total_available: rows.length };
}
