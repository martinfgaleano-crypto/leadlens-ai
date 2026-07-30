import { loadEnvConfig } from "@next/env";
import { buildPilotWorkspace } from "@/lib/intelligence/pilot-workspace";

loadEnvConfig(process.cwd());

const workspace = buildPilotWorkspace();
const families = [
  { data_type: "opportunity theses", table: "intelligence_account_opportunity_syntheses", expected: 6 },
  { data_type: "context intakes", table: "intelligence_client_intakes", expected: 0 },
  { data_type: "accepted context versions", table: "intelligence_client_context_versions", expected: 0 },
  { data_type: "safety reviews", table: "intelligence_customer_safety_reviews", expected: 0 },
  { data_type: "canonical pilot", table: "intelligence_pilots", expected: 1, migration: "047 (not applied)" },
] as const;

async function main() {
  const { createServerClient } = await import("@/lib/supabase/server");
  const db = createServerClient();
  if (!db) throw new Error("database_unavailable");
  const rows = [];
  for (const family of families) {
    const result = await db.from(family.table).select("id", { count: "exact", head: true }).eq("client_id", workspace.pilot.client_id);
    rows.push({
      ...family,
      supabase_records: result.error ? null : result.count,
      query_state: result.error ? "unavailable" : "available",
      error_code: result.error?.code ?? null,
      artifact_records: family.data_type === "opportunity theses" ? 6 : family.data_type === "canonical pilot" ? 1 : 0,
      write_performed: false,
    });
  }
  console.log(JSON.stringify({
    mode: "read_only_reconciliation",
    pilot_id: workspace.pilot.pilot_id,
    synthetic_answers: 0,
    writes: 0,
    rows,
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error), writes: 0 }));
  process.exit(1);
});
