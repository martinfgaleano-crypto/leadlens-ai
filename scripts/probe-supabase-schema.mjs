#!/usr/bin/env node
// Probes the live Supabase project for the tables the app expects, and maps
// missing tables to the migration that creates them. Server-side only, reads
// env from .env.local without printing values. Graceful without Supabase.
// Usage: npm run probe:supabase

import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();

// table → { migration, area }
const EXPECTED = {
  // Core report/job flow
  lead_searches: { migration: "003", area: "customer searches / report ownership" },
  jobs: { migration: "001", area: "legacy job flow" },
  batch_jobs: { migration: "001", area: "batch runs" },
  reports: { migration: "001", area: "legacy reports" },
  snapshot_reports: { migration: "024 (+027 scope)", area: "async monitor runs / results page" },
  onboarding_requests: { migration: "016 (+018/028)", area: "onboarding + setup completion" },
  // Vault Foundation (029)
  vault_companies: { migration: "029", area: "Vault Foundation / Bridge selection" },
  vault_contacts: { migration: "029", area: "Vault Foundation (never customer-facing)" },
  vault_sources: { migration: "029", area: "provenance for Vault records" },
  vault_signals: { migration: "029", area: "opportunity signals / Bridge selection" },
  vault_usage_history: { migration: "029", area: "already-used exclusions / usage recording" },
  vault_reservations: { migration: "029", area: "reservation gates in Bridge" },
  vault_suppression_list: { migration: "029", area: "suppression exclusions" },
  // Lead Hunter (030)
  lead_hunter_briefs: { migration: "030", area: "Lead Hunter briefs" },
  lead_hunter_runs: { migration: "030", area: "Lead Hunter runs" },
  lead_hunter_candidates: { migration: "030", area: "review queue / Vault promotion" },
  lead_hunter_source_inputs: { migration: "030", area: "manual source intake" },
  // Intelligence Foundation (031)
  learned_preferences: { migration: "031", area: "observation-only learned patterns (admin Intelligence)" },
  // ML Foundation (032)
  ml_training_examples: { migration: "032", area: "real training examples (shadow ML)" },
  ml_labels: { migration: "032", area: "label provenance" },
  ml_dataset_versions: { migration: "032", area: "dataset manifests" },
  ml_models: { migration: "032", area: "model registry (no auto-champion)" },
  ml_predictions: { migration: "032", area: "shadow predictions" },
  ml_jobs: { migration: "032", area: "async ML jobs" },
  // Source Review (033)
  source_benchmark_reviews: { migration: "033", area: "human calibration of source auto-flags" },
};

if (!has(env, "NEXT_PUBLIC_SUPABASE_URL") || !has(env, "SUPABASE_SERVICE_ROLE_KEY")) {
  console.log("⚠️  Supabase env vars not set (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  console.log("    Cannot probe the live schema. Run `npm run check:supabase` for the env checklist,");
  console.log("    then apply migrations per docs/strategy/MIGRATION_READINESS_SUMMARY.md.");
  process.exit(0);
}

const { createClient } = await import("@supabase/supabase-js");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const missingByMigration = new Map();
let present = 0, missing = 0, unknown = 0;

for (const [table, meta] of Object.entries(EXPECTED)) {
  // GET with limit 0 (NOT head:true — PostgREST answers HEAD requests for
  // unknown tables with 200/count=null, which false-positives as "present").
  const { error } = await db.from(table).select("id").limit(0);
  if (!error) {
    present++;
    console.log(`✅ ${table}  (${meta.area})`);
  } else if (/does not exist|schema cache|not find the table/i.test(error.message) || error.code === "42P01") {
    missing++;
    console.log(`❌ ${table}  MISSING → apply migration ${meta.migration}  (${meta.area})`);
    const list = missingByMigration.get(meta.migration) ?? [];
    list.push(table);
    missingByMigration.set(meta.migration, list);
  } else {
    unknown++;
    console.log(`⚠️  ${table}  probe error (${error.code ?? "?"}): ${error.message}`);
  }
}

console.log(`\nResult: ${present} present, ${missing} missing, ${unknown} inconclusive.`);
if (missing > 0) {
  console.log("\nApply these migrations (in numeric order) via Supabase SQL Editor:");
  for (const [migration, tables] of [...missingByMigration.entries()].sort()) {
    console.log(`  • supabase/migrations/${migration.split(" ")[0]}*.sql → creates ${tables.join(", ")}`);
  }
  console.log("Full order + SQL: docs/strategy/MIGRATION_READINESS_SUMMARY.md");
} else if (unknown === 0) {
  console.log("Schema ready: Vault Foundation, Lead Hunter, and the Vault Bridge can all run.");
}
process.exit(missing > 0 ? 1 : 0);
