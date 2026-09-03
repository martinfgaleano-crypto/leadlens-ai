import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { schedulerEnabled } from "@/lib/monitor/monitor-config";

// Trusted server-side recurring-monitor trigger. Invoked by Vercel Cron (or an
// internal caller) with the shared secret — NEVER by a browser. Finds due
// monitored work across tenants and runs the SAME monitor service the manual
// trigger uses. Gated by MONITOR_SCHEDULER_ENABLED (kill switch).
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const internalSecret = process.env.INTERNAL_RUN_SECRET || process.env.ADMIN_SECRET_TOKEN;
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const providedInternal = req.headers.get("x-internal-secret");
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
  if (cronSecret && bearer === cronSecret) return true;
  if (internalSecret && providedInternal === internalSecret) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!schedulerEnabled()) return NextResponse.json({ status: "disabled", reason: "MONITOR_SCHEDULER_ENABLED is not true" }, { status: 200 });

  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "persistence unavailable" }, { status: 503 });

  const { loadDueMonitoredWork, defaultReobserver, persistMonitorRun } = await import("@/lib/monitor/monitor-store");
  const { runScheduledMonitor } = await import("@/lib/monitor/scheduler");
  const { SupabaseAccountMemoryRepo } = await import("@/lib/deliverable/account-memory-store");

  const tenants = await loadDueMonitoredWork(db);
  const wakeId = new Date().toISOString().slice(0, 13).replace(/[:T]/g, ""); // stable within the hour → idempotent
  // Recurring reviews meter Account Intelligence Credits under the frozen commercial contract:
  // resolve each tenant's entitlement so the scheduled cycle enforces per-account usage.
  const { resolveEntitlements } = await import("@/lib/entitlements/entitlements-v1");
  const summary = await runScheduledMonitor({
    wakeId, tenants, reobserve: defaultReobserver, memoryRepo: new SupabaseAccountMemoryRepo(db), origin: "scheduled",
    resolveUsageMeter: async (scope) => scope.ownerUserId
      ? { db, entitlement: await resolveEntitlements(db, scope.ownerUserId) }
      : undefined,
  });
  // Persist per-tenant run summaries (best-effort observability).
  for (const run of summary.runs) { try { await persistMonitorRun(db, run); } catch { /* best-effort */ } }

  const { runs, ...obs } = summary;
  void runs;
  console.log(`[analytics] ${JSON.stringify({ event: "monitor_scheduler_wake", ...obs })}`);
  return NextResponse.json(obs, { status: 200 });
}

// GET allowed for Vercel Cron (which may issue GET); same behavior.
export const GET = POST;
