// Read-only: is migration 062 (usage ledger) applied live?
import { loadEnv, has } from "./lib/load-env.mjs";
import { createClient } from "@supabase/supabase-js";
const env = loadEnv();
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
for (const tbl of ["subscription_usage_periods", "account_intelligence_charges"]) {
  const { error } = await db.from(tbl).select("*").limit(0);
  console.log(`${tbl} :: ${error ? "NOT APPLIED (" + error.message + ")" : "APPLIED"}`);
}
