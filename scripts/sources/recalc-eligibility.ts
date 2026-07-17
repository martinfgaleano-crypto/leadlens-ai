// Recalculates production_eligible for EVERY vault signal via the central
// eligibility-v1 function (single writer). Idempotent; run after governance
// or semantic changes. Usage: npm run sources:recalc-eligibility

import { readFileSync, existsSync } from "node:fs";
for (const f of [".env", ".env.local"]) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
import { recalculateProductionEligibility } from "@/lib/vault/production-eligibility";

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: sigs } = await db.from("vault_signals").select("id");
  let eligible = 0, ineligible = 0;
  const reasonCounts: Record<string, number> = {};
  for (const s of sigs ?? []) {
    const v = await recalculateProductionEligibility(s.id);
    if (!v) continue;
    if (v.eligible) eligible++;
    else { ineligible++; for (const r of v.reasons) reasonCounts[r] = (reasonCounts[r] ?? 0) + 1; }
  }
  console.log(JSON.stringify({ total: (sigs ?? []).length, eligible, ineligible, ineligibility_reasons: reasonCounts }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
