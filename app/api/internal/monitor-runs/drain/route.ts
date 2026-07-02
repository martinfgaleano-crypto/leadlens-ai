import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { drainMonitorJobs, DRAIN_DEFAULT_LIMIT, DRAIN_MAX_LIMIT } from "@/lib/monitor/job-drainer";

// ── POST|GET /api/internal/monitor-runs/drain ─────────────────────────────────
// Runs the job drainer: recovers stale processing jobs, supersedes duplicates,
// abandons jobs past the recovery ceiling. Bounded per invocation.
// See docs/strategy/SELF_HEALING_MONITOR_INFRASTRUCTURE.md.
//
// Auth — any of (fail closed in production when nothing is configured):
//   - x-internal-secret == INTERNAL_RUN_SECRET (fallback ADMIN_SECRET_TOKEN)
//   - Authorization: Bearer <CRON_SECRET>  (Vercel Cron sends this header
//     automatically when the CRON_SECRET env var exists on the project)
//   - x-admin-token (requireAdmin) — for the admin ops "Run drainer" button
//
// GET is supported because Vercel Cron invokes paths with GET.
//
// Query params: ?dry_run=true  ?limit=N (default 10, max 25)

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

function checkDrainAuth(req: NextRequest): NextResponse | null {
  const internalSecret = process.env.INTERNAL_RUN_SECRET || process.env.ADMIN_SECRET_TOKEN;
  const cronSecret = process.env.CRON_SECRET;

  const providedInternal = req.headers.get("x-internal-secret");
  if (internalSecret && providedInternal === internalSecret) return null;

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (cronSecret && bearer === cronSecret) return null;

  // Admin token path (explicit header only — requireAdmin's dev-mode is
  // handled below so a bare unauthenticated request never sneaks through it).
  if (req.headers.get("x-admin-token") && requireAdmin(req) === null) return null;

  if (!internalSecret && !cronSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[drainer] no INTERNAL_RUN_SECRET/ADMIN_SECRET_TOKEN/CRON_SECRET set — rejecting in production");
      return NextResponse.json({ error: "Drainer not configured." }, { status: 403 });
    }
    console.warn("[drainer] no secrets configured — allowing in development");
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function handle(req: NextRequest) {
  const deny = checkDrainAuth(req);
  if (deny) return deny;

  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dry_run") === "true";
  const rawLimit = parseInt(searchParams.get("limit") ?? String(DRAIN_DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), DRAIN_MAX_LIMIT) : DRAIN_DEFAULT_LIMIT;

  const summary = await drainMonitorJobs(db, { limit, dryRun });

  console.log(`[drainer] done dry_run=${summary.dry_run} scanned=${summary.scanned} retriggered=${summary.retriggered} superseded=${summary.superseded} abandoned=${summary.abandoned} skipped_fresh=${summary.skipped_fresh} errors=${summary.errors.length}`);

  return NextResponse.json(summary);
}

export async function POST(req: NextRequest) { return handle(req); }
export async function GET(req: NextRequest)  { return handle(req); }
