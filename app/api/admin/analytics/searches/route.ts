import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  computeAverageCompletionTime,
  computeFailureRate,
  computeCreditUsage,
  computeAverageLeadsDelivered,
} from "@/lib/search-analytics/stats";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// GET /api/admin/analytics/searches?page=1&per_page=20&status=&q=

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
  const per_page = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "20", 10)));
  const statusFilter = searchParams.get("status") ?? "";
  const q            = searchParams.get("q")      ?? "";
  const offset       = (page - 1) * per_page;

  // ── 1. Fetch lightweight rows for global stats ────────────────────────────────

  const statsRes = await client
    .from("lead_searches")
    .select("status, process_duration_ms, process_generated_count, credits_consumed")
    .limit(5000);

  const statsRows = (statsRes.data ?? []) as {
    status:                  string;
    process_duration_ms:     number | null;
    process_generated_count: number | null;
    credits_consumed:        number | null;
  }[];

  const totalSearches      = statsRows.length;
  const completed          = statsRows.filter(r => r.status === "completed").length;
  const failed             = statsRows.filter(r => r.status === "failed").length;
  const successRate        = totalSearches > 0 ? Math.round((completed / totalSearches) * 100) : 0;
  const avgDurationMs      = computeAverageCompletionTime(statsRows);
  const creditsConsumed    = computeCreditUsage(statsRows);
  const avgLeadsDelivered  = computeAverageLeadsDelivered(statsRows);

  // ── 2. Fetch recent failures ──────────────────────────────────────────────────

  const failuresRes = await client
    .from("lead_searches")
    .select("id, name, status, credits_consumed, process_duration_ms, process_error_message, error_message, created_at, profiles(email)")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(10);

  const recentFailures = (failuresRes.data ?? []) as unknown as {
    id:                   string;
    name:                 string;
    status:               string;
    credits_consumed:     number;
    process_duration_ms:  number | null;
    process_error_message: string | null;
    error_message:        string | null;
    created_at:           string;
    profiles:             { email: string | null } | null;
  }[];

  // ── 3. Fetch paginated table ──────────────────────────────────────────────────

  let tableQuery = client
    .from("lead_searches")
    .select("id, name, status, requested_lead_count, process_generated_count, credits_consumed, process_duration_ms, process_error_message, created_at, profiles(email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + per_page - 1);

  if (statusFilter) {
    tableQuery = tableQuery.eq("status", statusFilter);
  }
  if (q) {
    tableQuery = tableQuery.ilike("name", `%${q}%`);
  }

  const tableRes = await tableQuery;
  const tableRows = (tableRes.data ?? []) as unknown as {
    id:                      string;
    name:                    string;
    status:                  string;
    requested_lead_count:    number;
    process_generated_count: number | null;
    credits_consumed:        number;
    process_duration_ms:     number | null;
    process_error_message:   string | null;
    created_at:              string;
    profiles:                { email: string | null } | null;
  }[];
  const tableTotal = tableRes.count ?? 0;

  return NextResponse.json({
    stats: {
      total:               totalSearches,
      completed,
      failed,
      success_rate:        successRate,
      avg_duration_ms:     avgDurationMs,
      credits_consumed:    creditsConsumed,
      avg_leads_delivered: avgLeadsDelivered,
    },
    recent_failures: recentFailures,
    searches:        tableRows,
    total:           tableTotal,
    page,
    per_page,
  });
}
