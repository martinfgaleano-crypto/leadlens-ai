import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isProcessingFresh } from "@/lib/storage/snapshot-store";

// ── GET /api/admin/monitor-runs/overview ──────────────────────────────────────
// Operational health across all monitor series. Admin-only. Bounded queries:
// head-counts by status plus the most recent N job rows (no report_json —
// counts and identifiers only, no account or personal data).

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

const RECENT_LIMIT = 25;
const PROCESSING_SCAN_LIMIT = 50;

interface JobRow {
  job_id: string;
  search_id: string | null;
  plan: string;
  status: "processing" | "completed" | "failed";
  lead_count: number | null;
  hot_count: number | null;
  created_at: string;
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const [processingRes, completedRes, failedRes, recentRes, processingRowsRes] = await Promise.all([
    db.from("snapshot_reports").select("id", { count: "exact", head: true }).eq("status", "processing"),
    db.from("snapshot_reports").select("id", { count: "exact", head: true }).eq("status", "completed"),
    db.from("snapshot_reports").select("id", { count: "exact", head: true }).eq("status", "failed"),
    db.from("snapshot_reports")
      .select("job_id, search_id, plan, status, lead_count, hot_count, created_at")
      .order("created_at", { ascending: false })
      .limit(RECENT_LIMIT),
    // Bounded scan of processing rows to derive stale/unscoped counts.
    db.from("snapshot_reports")
      .select("job_id, search_id, created_at")
      .eq("status", "processing")
      .order("created_at", { ascending: true })
      .limit(PROCESSING_SCAN_LIMIT),
  ]);

  const processingRows = (processingRowsRes.data ?? []) as { job_id: string; search_id: string | null; created_at: string }[];
  const staleCount = processingRows.filter(r => r.search_id && !isProcessingFresh(r.created_at)).length;
  const unscopedProcessing = processingRows.filter(r => !r.search_id).length;

  const recent = ((recentRes.data ?? []) as JobRow[]).map(r => ({
    job_id:     r.job_id,
    search_id:  r.search_id,
    plan:       r.plan,
    status:     r.status,
    lead_count: r.lead_count,
    hot_count:  r.hot_count,
    created_at: r.created_at,
    is_stale:   r.status === "processing" && !!r.search_id && !isProcessingFresh(r.created_at),
    is_unscoped: !r.search_id,
  }));

  // Search names for usability — one batched lookup, admin-only surface.
  const searchIds = Array.from(new Set(recent.map(r => r.search_id).filter(Boolean))) as string[];
  let nameMap: Record<string, string> = {};
  if (searchIds.length > 0) {
    const { data: searches } = await db
      .from("lead_searches")
      .select("id, name")
      .in("id", searchIds);
    nameMap = Object.fromEntries(((searches ?? []) as { id: string; name: string }[]).map(s => [s.id, s.name]));
  }

  return NextResponse.json({
    totals: {
      processing:           processingRes.count ?? 0,
      stale_processing:     staleCount,
      failed:               failedRes.count ?? 0,
      completed:            completedRes.count ?? 0,
      unscoped_processing:  unscopedProcessing,
    },
    recent: recent.map(r => ({ ...r, search_name: r.search_id ? nameMap[r.search_id] ?? null : null })),
  });
}
