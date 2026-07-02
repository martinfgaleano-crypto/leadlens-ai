import { NextRequest, NextResponse } from "next/server";

// ── GET /api/monitor/overview ─────────────────────────────────────────────────
// Monitor center summary for ALL of the authenticated user's searches.
//
// Auth: Bearer <supabase JWT> (same pattern as /api/credits and /api/monitor/[id]/runs).
// Scope: lead_searches filtered by user_id; snapshots filtered by those search
// IDs only. No cross-user data possible.
//
// Two batched queries (no N+1): one for the user's searches, one for all
// snapshot rows belonging to those searches. Baseline/latest state is derived
// in memory per series.

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

interface SnapRow {
  search_id: string;
  job_id: string;
  status: "processing" | "completed" | "failed";
  created_at: string;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  const { data: searches, error: sErr } = await db
    .from("lead_searches")
    .select("id, name, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (sErr) return NextResponse.json({ error: "Database error." }, { status: 500 });

  const searchIds = (searches ?? []).map(s => s.id as string);
  if (searchIds.length === 0) {
    return NextResponse.json({ monitors: [] });
  }

  const { data: snaps } = await db
    .from("snapshot_reports")
    .select("search_id, job_id, status, created_at")
    .in("search_id", searchIds)
    .order("created_at", { ascending: true })
    .limit(1000);

  const bySearch = new Map<string, SnapRow[]>();
  for (const row of (snaps ?? []) as SnapRow[]) {
    if (!row.search_id) continue;
    const list = bySearch.get(row.search_id) ?? [];
    list.push(row);
    bySearch.set(row.search_id, list);
  }

  const monitors = (searches ?? []).map(s => {
    const runs = bySearch.get(s.id as string) ?? [];
    const completed = runs.filter(r => r.status === "completed");
    const latest = runs[runs.length - 1] ?? null;
    const latestCompleted = completed[completed.length - 1] ?? null;
    return {
      search_id:            s.id,
      name:                 s.name,
      search_status:        s.status,
      created_at:           s.created_at,
      total_runs:           runs.length,
      latest_run_status:    latest?.status ?? null,
      latest_completed_at:  latestCompleted?.created_at ?? null,
      latest_report_job_id: latestCompleted?.job_id ?? null,
      has_processing_run:   runs.some(r => r.status === "processing"),
      is_baseline_only:     completed.length === 1,
      has_comparison:       completed.length >= 2,
    };
  });

  return NextResponse.json({ monitors });
}
