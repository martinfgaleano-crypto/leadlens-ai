import { NextRequest, NextResponse } from "next/server";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// GET /api/notifications?filter=all|unread&page=1&per_page=20
// Returns the authenticated customer's notifications.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: { user }, error: authErr } = await client.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter   = searchParams.get("filter") ?? "all";
  const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
  const per_page = Math.min(50,  Math.max(1, parseInt(searchParams.get("per_page") ?? "20", 10)));
  const offset   = (page - 1) * per_page;

  let query = client
    .from("notifications")
    .select("id, type, title, message, is_read, metadata, created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + per_page - 1);

  if (filter === "unread") {
    query = query.eq("is_read", false);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Unread count (always across all notifications, not just current filter)
  const { count: unreadCount } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return NextResponse.json({
    notifications: data ?? [],
    total:         count ?? 0,
    unread_count:  unreadCount ?? 0,
    page,
    per_page,
  });
}
