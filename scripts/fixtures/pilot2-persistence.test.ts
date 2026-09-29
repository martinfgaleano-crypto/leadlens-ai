// Pilot 2 persistence: admin routes fail closed for unauthenticated requests, and the store degrades
// gracefully (no crash) when migration 065 is not applied / Supabase unconfigured. Deterministic; no DB.
import { NextRequest } from "next/server";

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } };

async function main() {
  const { POST: ctxPost, GET: ctxGet } = await import("../../app/api/admin/pilot2/context/route");
  const { POST: fbPost, GET: fbGet } = await import("../../app/api/admin/pilot2/feedback/route");
  const req = (body?: unknown) => new NextRequest("http://localhost/api/admin/pilot2/context", body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  const r1 = ctxGet(req());
  const r2 = ctxPost(req({ pilotId: "amor-de-gea", context: { company: { name: "X" } } }));
  const r3 = fbGet(req());
  const r4 = fbPost(req({ pilotId: "amor-de-gea", overall_rating: 5 }));
  for (const [name, res] of [["context GET", r1], ["context POST", r2], ["feedback GET", r3], ["feedback POST", r4]] as const) {
    const resolved = await res;
    t(`${name} denies unauthenticated (>=401)`, resolved instanceof Response && resolved.status >= 401);
  }

  // Store degrades gracefully when Supabase/table is unavailable (no throw).
  const { savePilotContext, loadLatestPilotContext, savePilotFeedback, loadPilotFeedback } = await import("../../lib/pilot/pilot-store");
  const { CUSTOMER_CONTEXT_SCHEMA } = await import("../../lib/pilot/customer-context");
  type Ctx = import("../../lib/pilot/customer-context").CustomerContextIntake;
  const ctx: Ctx = { schema: CUSTOMER_CONTEXT_SCHEMA, version: 1, company: { name: "Amor de Gea" }, offering: "x", objective: "export to US", target_market: "US", ideal_customer: "y", success: "z", provenance: { source: "guided", fact_type: "CUSTOMER_CONFIRMED", confirmed: true } };
  const save = await savePilotContext({ pilotId: "amor-de-gea", context: ctx, confirmed: false });
  t("savePilotContext returns a typed result, never throws", save.ok === true || (save.ok === false && (save.reason === "not_configured" || save.reason === "error")));
  const load = await loadLatestPilotContext("amor-de-gea");
  t("loadLatestPilotContext returns null or a row, never throws", load === null || typeof load === "object");
  const fbSave = await savePilotFeedback({ pilotId: "amor-de-gea", overall_rating: 5 });
  t("savePilotFeedback returns a typed result, never throws", fbSave.ok === true || fbSave.ok === false);
  const fbLoad = await loadPilotFeedback("amor-de-gea");
  t("loadPilotFeedback returns an array, never throws", Array.isArray(fbLoad));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
