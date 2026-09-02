import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { dispatchIntelligenceRun } from "@/lib/intelligence/intelligence-run-dispatch";
import { recoverStaleRuns, type StaleRunCandidate } from "@/lib/intelligence/run-recovery";

// ── POST|GET /api/internal/intelligence-runs/recover ──────────────────────────
// Server-owned recovery of stranded customer Intelligence runs. A run whose executor
// died mid-flight sits in "processing"; this finds those (stale by last write) and
// re-dispatches them (the processor reclaims via the execution_generation CAS, so a
// still-live executor is never stolen and two wakes reclaim at most once), failing
// terminally only after the reclaim bound. Vercel Cron invokes this with GET.
// Auth: Bearer <CRON_SECRET>, x-internal-secret <INTERNAL_RUN_SECRET>, or admin.

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

function checkAuth(req: NextRequest): NextResponse | null {
  const internalSecret = process.env.INTERNAL_RUN_SECRET || process.env.ADMIN_SECRET_TOKEN;
  const cronSecret = process.env.CRON_SECRET;
  if (internalSecret && req.headers.get("x-internal-secret") === internalSecret) return null;
  const bearer = (req.headers.get("authorization") ?? "").startsWith("Bearer ") ? (req.headers.get("authorization") ?? "").slice(7) : null;
  if (cronSecret && bearer === cronSecret) return null;
  if (req.headers.get("x-admin-token") && requireAdmin(req) === null) return null;
  if (!internalSecret && !cronSecret) {
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Recovery not configured." }, { status: 403 });
    return null; // dev only
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handle(req: NextRequest) {
  const deny = checkAuth(req);
  if (deny) return deny;
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Persistence unavailable" }, { status: 503 });
  const dryRun = req.nextUrl.searchParams.get("dry_run") === "true";
  const origin = req.nextUrl.origin;

  // Candidates: non-terminal customer Intelligence runs. Staleness is decided in policy.
  const { data, error } = await db.from("snapshot_reports")
    .select("job_id,user_id,status,created_at,execution_generation,report_json")
    .eq("status", "processing").order("created_at", { ascending: true }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const candidates: StaleRunCandidate[] = (data ?? [])
    .filter((r: { job_id: string }) => /^intel_[a-f0-9]{32}$/.test(r.job_id))
    .map((r: { job_id: string; user_id: string; status: string; created_at: string; execution_generation: number | null; report_json: { _intelligence_run?: { updatedAt?: string } } | null }) => ({
      // Last authoritative write lives at report_json._intelligence_run.updatedAt (the store's
      // canonical location); created_at is the durable column fallback for a never-updated run.
      runId: r.job_id, userId: r.user_id, status: r.status, createdAt: r.created_at,
      updatedAt: r.report_json?._intelligence_run?.updatedAt ?? null, executionGeneration: r.execution_generation ?? 0,
    }));

  if (dryRun) {
    const { planRecoveries } = await import("@/lib/intelligence/run-recovery");
    const plan = planRecoveries(candidates, Date.now());
    return NextResponse.json({ dry_run: true, considered: candidates.length, plan: plan.map((p) => ({ run: p.candidate.runId.slice(0, 14), action: p.action, generation: p.candidate.executionGeneration })) });
  }

  const summary = await recoverStaleRuns({
    listRecoverable: async () => candidates,
    redispatch: async (runId, userId) => { dispatchIntelligenceRun(origin, runId, userId); },
    failTerminal: async (c, reason) => {
      const prior = (data ?? []).find((r: { job_id: string }) => r.job_id === c.runId)?.report_json ?? {};
      const next = { ...(prior as Record<string, unknown>), status: "failed", failureCode: reason, updatedAt: new Date().toISOString() };
      // Fenced terminal write: only lands if this run is still the same processing generation
      // (a concurrent reclaim/complete advances generation → safe no-op).
      const { data: upd } = await db.from("snapshot_reports")
        .update({ status: "failed", report_json: next })
        .eq("job_id", c.runId).eq("user_id", c.userId).eq("status", "processing")
        .eq("execution_generation", c.executionGeneration).select("job_id");
      return Boolean(upd?.length);
    },
  });
  console.log(`[analytics] ${JSON.stringify({ event: "intelligence_run_recovery_wake", ...summary })}`);
  return NextResponse.json(summary, { status: 200 });
}

export async function POST(req: NextRequest) { return handle(req); }
export async function GET(req: NextRequest) { return handle(req); }
