// Read-only verification that migration 061 (customer_subscriptions) is applied live.
// No writes, no head:true schema probing — a bounded select that returns 0 rows either
// succeeds (table exists, columns selectable) or fails (table/columns absent).
import { loadEnv, has } from "./lib/load-env.mjs";
import { createClient } from "@supabase/supabase-js";

const env = loadEnv();
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
  if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const cols = "id,user_id,payment_provider,provider_customer_id,provider_subscription_id,plan_code,billing_interval,status,current_period_start,current_period_end,cancel_at_period_end,ended_at,last_event_id,last_event_at,created_at,updated_at";
const { data, error } = await db.from("customer_subscriptions").select(cols).limit(0);
if (error) {
  console.log(`customer_subscriptions :: NOT APPLIED / column mismatch :: ${error.message}`);
  process.exit(1);
}
console.log(`customer_subscriptions :: APPLIED — all ${cols.split(",").length} expected columns selectable (rows returned: ${data.length})`);
process.exit(0);
