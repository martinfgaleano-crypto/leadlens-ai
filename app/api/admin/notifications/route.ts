import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// GET /api/admin/notifications?type=&user_id=&is_read=&page=1&per_page=25

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const typeFilter    = searchParams.get("type")    ?? "";
  const userIdFilter  = searchParams.get("user_id") ?? "";
  const isReadFilter  = searchParams.get("is_read") ?? "";
  const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
  const per_page = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10)));
  const offset   = (page - 1) * per_page;

  // ── 1. Global stats (lightweight pass) ────────────────────────────────────────

  const statsRes = await client
    .from("notifications")
    .select("type, is_read")
    .limit(10000);

  const statsRows = (statsRes.data ?? []) as { type: string; is_read: boolean }[];
  const stats = {
    total:            statsRows.length,
    unread:           statsRows.filter(r => !r.is_read).length,
    search_completed: statsRows.filter(r => r.type === "search_completed").length,
    search_failed:    statsRows.filter(r => r.type === "search_failed").length,
    credits_low:      statsRows.filter(r => r.type === "credits_low").length,
    credits_added:    statsRows.filter(r => r.type === "credits_added").length,
  };

  // ── 2. Paginated table ─────────────────────────────────────────────────────────

  let query = client
    .from("notifications")
    .select("id, user_id, type, title, message, is_read, created_at, profiles(email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + per_page - 1);

  if (typeFilter)   query = query.eq("type", typeFilter);
  if (userIdFilter) query = query.eq("user_id", userIdFilter);
  if (isReadFilter === "true")  query = query.eq("is_read", true);
  if (isReadFilter === "false") query = query.eq("is_read", false);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    stats,
    notifications: (data ?? []) as unknown as object[],
    total:         count ?? 0,
    page,
    per_page,
  });
}
