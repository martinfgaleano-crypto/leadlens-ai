import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isProcessingFresh } from "@/lib/storage/snapshot-store";

// ── GET /api/monitor/[id]/runs ────────────────────────────────────────────────
// Customer-facing monitor run history for one of THEIR searches.
//
// Auth: Bearer <supabase JWT> (same pattern as /api/credits).
// Ownership: lead_searches.id must belong to the authenticated user — checked
// with the service-role client BEFORE any snapshot query. A search owned by
// someone else returns 404 (not 403) so search IDs are not confirmable.
//
// Scope safety: snapshot rows come exclusively from .eq("search_id", id).
// No global fallback, no cross-search data, ever.
//
// Response is a customer-safe subset of the admin runs endpoint: run counts,
// status, baseline/comparison, visible-change counts. job_id is included so
// the client can open its own report at /results/[job_id].

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

const uuidSchema = z.string().uuid();

interface RunRow {
  job_id: string;
  status: "processing" | "completed" | "failed";
  lead_count: number | null;
  hot_count: number | null;
  warm_count: number | null;
  avg_score: number | null;
  created_at: string;
  change_summary: { client_visible_count?: number } | null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!uuidSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid search ID." }, { status: 400 });
  }
  const searchId = params.id;

  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  // Ownership check — must pass before any snapshot data is touched.
  const { data: search } = await db
    .from("lead_searches")
    .select("id")
    .eq("id", searchId)
    .eq("user_id", user.id)
    .single();

  if (!search) {
    return NextResponse.json({ error: "Search not found." }, { status: 404 });
  }

  // Setup completeness — the run CTA disables itself when the linkage is missing.
  const { count: onboardingCount } = await db
    .from("onboarding_requests")
    .select("id", { count: "exact", head: true })
    .eq("search_id", searchId);
  const hasOnboardingLink = (onboardingCount ?? 0) > 0;

  const { data, error } = await db
    .from("snapshot_reports")
    .select("job_id, status, lead_count, hot_count, warm_count, avg_score, created_at, change_summary:report_json->change_summary")
    .eq("search_id", searchId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[monitor/runs] query error:", error.message);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as RunRow[];

  let completedSeen = 0;
  const enriched = rows.map((r) => {
    const isCompleted = r.status === "completed";
    if (isCompleted) completedSeen++;
    return {
      job_id:      r.job_id,
      status:      r.status,
      created_at:  r.created_at,
      lead_count:  r.lead_count,
      hot_count:   r.hot_count,
      warm_count:  r.warm_count,
      avg_score:   r.avg_score,
      is_baseline: isCompleted && completedSeen === 1,
      // processing row past the stale cutoff — worker died or trigger was lost
      is_stale:    r.status === "processing" && !isProcessingFresh(r.created_at),
      visible_changes: r.change_summary && typeof r.change_summary === "object"
        ? r.change_summary.client_visible_count ?? null
        : null,
    };
  });

  const newestFirst = [...enriched].reverse();
  const latestCompleted = newestFirst.find((r) => r.status === "completed");

  return NextResponse.json({
    search_id:           searchId,
    total_runs:          enriched.length,
    latest_status:       newestFirst[0]?.status ?? null,
    latest_completed_at: latestCompleted?.created_at ?? null,
    latest_report_job_id: latestCompleted?.job_id ?? null,
    has_processing_run:  enriched.some((r) => r.status === "processing" && isProcessingFresh(r.created_at)),
    has_onboarding_link: hasOnboardingLink,
    runs:                newestFirst,
  });
}
