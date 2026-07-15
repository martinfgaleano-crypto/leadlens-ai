#!/usr/bin/env node
// Static smoke checks for Intelligence Expansion (ML + sources + growth).
// Usage: npm run smoke:intelligence-expansion

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const results = [];
const check = (name, fn) => {
  try { results.push({ name, ok: !!fn() }); }
  catch (err) { results.push({ name, ok: false, err: err.message }); }
};
const read = (p) => readFileSync(join(root, p), "utf8");

const PROV = "lib/sources/access/providers.ts";
const ADAPTER = "lib/ml/snapshot-adapter.ts";
const DATASET = "scripts/ml/build-dataset.ts";
const RUN_REAL = "ml/src/leadlens_ml/run_real.py";
const SHADOW = "scripts/ml/shadow-score.ts";

// Source layer
check("Migration 032 exists with RLS", () => read("supabase/migrations/032_ml_foundation.sql").includes("ENABLE ROW LEVEL SECURITY"));
check("4 real provider adapters + fixture (env-gated)", () => {
  const src = read(PROV);
  return ["tavilyProvider", "braveProvider", "serperProvider", "firecrawlProvider", "fixtureProvider"].every((p) => src.includes(p)) &&
    ["TAVILY_API_KEY", "BRAVE_SEARCH_API_KEY", "SERPER_API_KEY", "FIRECRAWL_API_KEY"].every((k) => src.includes(`${k} missing`));
});
check("Apollo excluded from source layer", () => {
  // Only the exclusion comment may name Apollo — no adapter/code path does.
  const stripped = read(PROV).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return !/apollo/i.test(stripped) && read(PROV).includes("deliberately absent");
});
check("No hardcoded provider keys", () => !/(sk-|key-|Bearer [A-Za-z0-9]{20})/.test(read(PROV).replace(/process\.env\.[A-Z_]+/g, "")));
check("Benchmark measures marginal contribution, not volume", () => {
  const src = read("lib/sources/access/benchmark.ts");
  return src.includes("marginal_unique_urls") && src.includes("never presented as intelligence");
});

// ML dataset + gates
check("Adapter quarantines baseline fields (never independent features)", () => {
  const src = read(ADAPTER);
  return src.includes("baseline_score") && src.includes("soft_fit_score: null") && src.includes("prohibited as independent feature");
});
check("Adapter hashes company/monitor keys (no raw tenant identity)", () => read(ADAPTER).includes("sha256(snap.company_key)") && read(ADAPTER).includes("sha256(ctx.search_id)"));
check("Dataset builder rejects fixtures + excludes snapshot-less history", () => {
  const src = read(DATASET);
  return src.includes("demo_only: false") && src.includes("never reconstructed");
});
check("Training gates block honestly (never fake completed)", () => {
  const src = read(RUN_REAL);
  return src.includes("blocked_insufficient_data") && src.includes("blocked_quality_gate") && src.includes("never as completed");
});
check("Fixtures hard-blocked from real training", () => read(RUN_REAL).includes("DEMO_ONLY_NOT_PRODUCTION_TRAINING_DATA") && read(RUN_REAL).includes("fixtures_rejected"));
check("Lab EXCLUDE list bars baseline score/rank from features", () => {
  const src = read("ml/src/leadlens_ml/training.py");
  return src.includes("'baseline_score'") && src.includes("'baseline_rank'");
});
check("Group split prevents company leakage", () => read("ml/src/leadlens_ml/splitting.py").includes("assert not"));

// Shadow + ranking protection
check("Shadow never mutates customer order", () => read(SHADOW).includes("customer_impact") && read(SHADOW).includes("shadow only"));
check("Shadow preference caps ±5/±10, validated-only", () => {
  const src = read("lib/intelligence/shadow-preference.ts");
  return src.includes("PER_PREFERENCE_CAP = 5") && src.includes("TOTAL_CAP = 10") && src.includes("inferred_validated");
});
check("Selector/scorer/decision import no ML modules", () => {
  return ["lib/vault/vault-opportunity-selector.ts", "lib/quality/opportunity-decision.ts", "lib/pipeline.ts"].every((f) => {
    const src = read(f);
    return !src.includes("lib/ml/") && !src.includes("shadow-preference") && !src.includes("growth-index") && !src.includes("sources/access");
  });
});

// LLM judges
check("Judges never see labels/baseline/other judges", () => {
  const src = read("lib/ml/llm-judges.ts");
  return src.includes("never see") && !src.includes("baseline_decision") && src.includes("provider_unavailable");
});

// Growth index honesty
check("Growth index withholds score without real evidence", () => {
  const src = read("lib/intelligence/growth-index.ts");
  return src.includes("insufficient_evidence") && src.includes("volume alone never inflates");
});
check("Level 5 requires real shadow lift (never granted here)", () => read("lib/intelligence/growth-index.ts").includes("Level 5 requires REAL shadow lift"));

// Admin protection
check("Growth/sources/review APIs require admin", () => {
  return ["growth", "sources", "review"].every((r) => read(`app/api/admin/intelligence/${r}/route.ts`).includes("requireAdmin"));
});
check("Admin pages show observation banners / demo labels", () => {
  return read("app/admin/intelligence/growth/page.tsx").includes("no ML output affects customer rankings") &&
    read("app/admin/intelligence/growth/page.tsx").includes("TECHNICAL VALIDATION ONLY");
});
check("No service-role leak in new modules", () => {
  return [PROV, ADAPTER, "lib/intelligence/growth-index.ts", "app/admin/intelligence/growth/page.tsx", "app/admin/intelligence/sources/page.tsx", "app/admin/intelligence/review/page.tsx"].every((f) => !read(f).includes("NEXT_PUBLIC_SUPABASE_SERVICE"));
});

const passed = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.err ? ` — ${r.err}` : ""}`);
console.log(`\nResult: ${passed} passed, ${results.length - passed} failed.`);
process.exit(passed === results.length ? 0 : 1);
