// ─── Bridge source-benchmark results → Vault (observation mode) ───────────────
// Reads a benchmark artifact, applies the promotion quality gate, and writes
// qualified+dated signals to the Vault as pending_review with provenance.
// Idempotent. Never touches ranking (pending_review ≠ approved selector pool).
// Run: npm run sources:bridge   (SET BENCHMARK_FILE=... to pick an artifact)

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { benchmarkRowToPromotionCandidate, type BenchmarkResultRow } from "@/lib/sources/promotion-contract";
import { promoteToVault } from "@/lib/sources/provider-vault-bridge";

for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const dir = "ml/data/source-benchmark";
  const explicit = process.env.BENCHMARK_FILE;
  const file = explicit ?? (existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith("results-") && f.endsWith(".jsonl")).sort().reverse()[0] : null);
  if (!file) { console.log(JSON.stringify({ status: "no_artifact", note: "run npm run sources:benchmark first" })); process.exit(2); }
  const path = explicit ? file : `${dir}/${file}`;

  const rows = readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as BenchmarkResultRow);
  const runId = file.replace(/^results-|\.jsonl$/g, "");
  const candidates = rows.map((r) => benchmarkRowToPromotionCandidate(r, runId)).filter((c): c is NonNullable<typeof c> => c !== null);
  console.log(`artifact: ${path} · rows ${rows.length} · passed quality gate ${candidates.length}`);

  const result = await promoteToVault(candidates);
  console.log(JSON.stringify({ banner: "PROVIDER-SEARCH → VAULT (observation mode; pending_review; never enters approved selector)", run: runId, ...result }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
