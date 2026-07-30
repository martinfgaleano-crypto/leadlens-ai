import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !serviceKey || !anonKey) throw new Error("supabase_configuration_missing");

async function main() {
  const service = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const anon = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const pilotColumns = "id,tenant_user_id,client_id,slug,canonical_name,status,pilot_json,methodology_version,idempotency_key,updated_at,created_at";
  const activityColumns = "id,tenant_user_id,pilot_id,client_id,event_type,actor_id,object_type,object_id,before_summary,after_summary,provenance,methodology_version,occurred_at,idempotency_key,created_at";
  const [pilotService, activityService, pilotAnon, activityAnon] = await Promise.all([
    service.from("intelligence_pilots").select(pilotColumns, { head: true, count: "exact" }),
    service.from("intelligence_pilot_activity").select(activityColumns, { head: true, count: "exact" }),
    anon.from("intelligence_pilots").select("id", { head: true, count: "exact" }),
    anon.from("intelligence_pilot_activity").select("id", { head: true, count: "exact" }),
  ]);
  const serviceErrors = [pilotService.error, activityService.error].filter(Boolean);
  const anonymousDenied = [pilotAnon, activityAnon].every(result =>
    result.error != null || (result.count ?? 0) === 0);
  const verdict = serviceErrors.length === 0 && anonymousDenied ? "partially_verified" : "incompatible";
  console.log(JSON.stringify({
    verdict,
    tables: {
      intelligence_pilots: pilotService.error ? "missing_or_incompatible" : "verified",
      intelligence_pilot_activity: activityService.error ? "missing_or_incompatible" : "verified",
    },
    expected_columns: serviceErrors.length === 0 ? "verified_through_service_role_select" : "incompatible",
    service_role_access: serviceErrors.length === 0 ? "verified" : "failed",
    anonymous_access: anonymousDenied ? "denied_or_empty_under_rls" : "unexpected_rows_visible",
    tenant_columns: serviceErrors.length === 0 ? "present" : "unverified",
    indexes_constraints_rls_grants: "partially verified empirically; direct pg_catalog access is unavailable through PostgREST",
    errors: serviceErrors.map(error => ({ code: error?.code, message: error?.message })),
    writes: 0,
  }, null, 2));
  if (verdict === "incompatible") process.exit(1);
}

main().catch(error => {
  console.error(JSON.stringify({ verdict: "incompatible", error: error instanceof Error ? error.message : String(error), writes: 0 }));
  process.exit(1);
});
