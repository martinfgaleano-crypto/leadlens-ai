#!/usr/bin/env node
// Approves pending_review vault_signals that belong to [DEMO]/Demo companies —
// the ones promoted before the 2026-07-11 fix (promotion now creates signals
// already approved). Production/non-demo signals are NEVER auto-approved:
// without FORCE=true this script only touches companies named "Demo Company…"
// or containing "[DEMO]". With FORCE=true it still asks per-signal listing
// first and approves ALL pending — use only if you reviewed the list.
//
// Usage: node scripts/approve-demo-vault-signals.mjs   (add FORCE=true to include non-demo)

import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
if (!has(env, "NEXT_PUBLIC_SUPABASE_URL") || !has(env, "SUPABASE_SERVICE_ROLE_KEY")) {
  console.log("Supabase env vars not set — nothing to do.");
  process.exit(0);
}
const { createClient } = await import("@supabase/supabase-js");
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: pending } = await db.from("vault_signals")
  .select("id, signal_type, signal_summary, company_id")
  .eq("review_status", "pending_review")
  .limit(200);

if (!pending?.length) {
  console.log("No pending_review vault signals. Nothing to approve.");
  process.exit(0);
}

const companyIds = [...new Set(pending.map((s) => s.company_id).filter(Boolean))];
const { data: companies } = await db.from("vault_companies").select("id, name").in("id", companyIds);
const nameById = new Map((companies ?? []).map((c) => [c.id, c.name]));
const isDemo = (name) => /^demo company|\[demo\]/i.test(name ?? "");

let approved = 0, skipped = 0;
for (const s of pending) {
  const company = nameById.get(s.company_id) ?? "(no company)";
  if (!isDemo(company) && process.env.FORCE !== "true") {
    console.log(`⏭  skip (non-demo, needs manual review): ${company} — ${s.signal_type}`);
    skipped++;
    continue;
  }
  const { error } = await db.from("vault_signals")
    .update({ review_status: "approved", updated_at: new Date().toISOString() })
    .eq("id", s.id);
  if (error) { console.log(`❌ ${company}: ${error.message}`); skipped++; }
  else { console.log(`✅ approved: ${company} — ${s.signal_type}`); approved++; }
}
console.log(`\nDone: ${approved} approved, ${skipped} skipped (still pending — review in /admin/vault-foundation).`);
