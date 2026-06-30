import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// ── GET /api/admin/snapshots ──────────────────────────────────────────────────
// Lists snapshot_reports rows for admin visibility.
// Never returns report_json (full report) or user_id.
// Supports optional query params: ?status=completed&plan=starter&limit=50

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const planFilter   = searchParams.get("plan");
  const limit        = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

  let query = db
    .from("snapshot_reports")
    .select("id, job_id, plan, status, lead_count, hot_count, warm_count, avg_score, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusFilter) query = query.eq("status", statusFilter);
  if (planFilter)   query = query.eq("plan",   planFilter);

  const { data, error } = await query;

  if (error) {
    console.error("[admin/snapshots] query error:", error.message);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }

  const rows = (data ?? []) as {
    id: string;
    job_id: string;
    plan: string;
    status: string;
    lead_count: number | null;
    hot_count: number | null;
    warm_count: number | null;
    avg_score: number | null;
    created_at: string;
  }[];

  // Summary stats
  const total        = rows.length;
  const completed    = rows.filter(r => r.status === "completed").length;
  const failed       = rows.filter(r => r.status === "failed").length;
  const processing   = rows.filter(r => r.status === "processing").length;
  const avgLeads     = total ? Math.round(rows.reduce((s, r) => s + (r.lead_count ?? 0), 0) / total) : 0;
  const avgScore     = total
    ? parseFloat((rows.reduce((s, r) => s + (Number(r.avg_score) ?? 0), 0) / total).toFixed(1))
    : 0;

  return NextResponse.json({
    summary: { total, completed, failed, processing, avg_leads: avgLeads, avg_score: avgScore },
    snapshots: rows,
    // report_json intentionally excluded — use GET /api/results/[jobId] for full report
    // user_id intentionally excluded
  });
}
