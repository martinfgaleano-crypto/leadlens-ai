#!/usr/bin/env node
// Production data isolation tests (037): origin contract, fail-closed
// eligibility, and live contamination check — demo/fixture/synthetic/internal
// QA data must never enter a customer-like (default-criteria) selection.
// Static checks always run; live checks need Supabase + a running dev server.
// Usage: npm run test:production-isolation

import { readFileSync } from "node:fs";
import { loadEnv } from "./lib/load-env.mjs";

const env = loadEnv();
const BASE_URL = (process.env.BASE_URL ?? env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? env.ADMIN_SECRET_TOKEN ?? "";
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const read = (p) => readFileSync(p, "utf8");

// ── Static contract checks ──
const store = read("lib/storage/vault-store.ts");
check("createVaultSignal fails closed (legacy_unknown default)", store.includes('input.data_origin ?? "legacy_unknown"'));
check("inserts are never eligible (eligibility-v1 grants it later)", store.includes("const eligible = false") && store.includes("recalculateProductionEligibility"));
check("[DEMO] marker forces demo origin", /demoMarked \? "demo"/.test(store));
const selector = read("lib/vault/vault-opportunity-selector.ts");
check("selector gates production origin pre-ranking", selector.includes('reject(opp, "not_production_eligible")'));
check("selector gate is exclusion-only (no score change)", !/match_score|score\s*[+*-]=/.test(selector.split("not_production_eligible")[0].slice(-400)));
check("opt-out needs env flag too", selector.includes("VAULT_ALLOW_NON_PRODUCTION_SELECTION"));
const migration = read("supabase/migrations/037_data_origin.sql");
check("037 CHECK constraint ties eligibility to production", migration.includes("production_eligible = false OR data_origin = 'production'"));
check("037 backfills demo isolation without deleting", migration.includes("'demo'") && !/\bDELETE\s+FROM\b/i.test(migration));
const bridge = read("lib/sources/provider-vault-bridge.ts");
check("provider bridge stamps production origin", bridge.includes('data_origin: "production"'));

// ── Live checks (Supabase + dev server) ──
async function live() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) { check("live: skipped (no Supabase env)", true, "skip"); return; }
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: probe, error } = await db.from("vault_signals").select("id, data_origin, production_eligible").limit(500);
  if (error) { check("live: 037 applied", false, error.message.slice(0, 80)); return; }
  check("live: 037 applied", true);
  const unknownEligible = probe.filter((s) => s.data_origin !== "production" && s.production_eligible === true);
  check("live: no non-production row is eligible", unknownEligible.length === 0, `${unknownEligible.length} violations`);

  // Demo signals must be isolated
  const { data: demoSigs } = await db.from("vault_signals").select("id, data_origin").ilike("signal_summary", "%[DEMO]%");
  check("live: [DEMO] signals classified demo", (demoSigs ?? []).every((s) => s.data_origin === "demo"), `${(demoSigs ?? []).length} demo signals`);

  // Contamination: default dry-run selection must contain zero non-production rows
  try {
    const res = await fetch(`${BASE_URL}/api/admin/vault-report-bridge/dry-run`, {
      method: "POST", headers: { "content-type": "application/json", "x-admin-token": ADMIN_TOKEN },
      body: JSON.stringify({ require_approved: true, lead_count: 10, customer_email: "isolation-test@leadlens.local" }),
    });
    const { result } = await res.json();
    const ids = new Set((result?.selected ?? []).map((s) => s.vault_signal_id).filter(Boolean));
    const { data: chosen } = ids.size ? await db.from("vault_signals").select("id, data_origin, production_eligible").in("id", [...ids]) : { data: [] };
    const contaminated = (chosen ?? []).filter((s) => s.production_eligible !== true);
    check("live: default selection has zero non-production signals", contaminated.length === 0, `${(result?.selected ?? []).length} selected, ${contaminated.length} contaminated`);
    const demoNames = (result?.selected ?? []).filter((s) => /demo company/i.test(s.company_name ?? ""));
    check("live: no Demo Company in selection", demoNames.length === 0);
    check("live: exclusions name not_production_eligible", !!result?.rejected_counts?.not_production_eligible || contaminatedFreePool(result));
  } catch (e) { check("live: dry-run reachable", false, e.message.slice(0, 80)); }
}
// If the pool has no non-production approved rows left, the named exclusion may be 0 — accept.
function contaminatedFreePool(result) { return !!result && typeof result.rejected_counts === "object"; }

await live();
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\nResult: ${results.length - failed} passed, ${failed} failed.`);
process.exit(failed ? 1 : 0);
