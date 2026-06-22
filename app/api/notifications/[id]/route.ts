import { NextRequest, NextResponse } from "next/server";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// PATCH /api/notifications/[id]
// Marks a single notification as read. Only the owning user may update it.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: { user }, error: authErr } = await client.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });

  const { data, error } = await client
    .from("notifications")
    .update({ is_read: true })
    .eq("id", params.id)
    .eq("user_id", user.id)   // ownership guard: service role bypasses RLS, so enforce manually
    .select("id, is_read")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "Notification not found." }, { status: 404 });

  return NextResponse.json({ notification: data });
}
