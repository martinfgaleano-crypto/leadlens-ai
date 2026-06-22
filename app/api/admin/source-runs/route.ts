import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// GET /api/admin/source-runs
// Returns paginated source_runs with optional filters.

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const source_name = searchParams.get("source_name")?.trim() ?? "";
  const status      = searchParams.get("status")?.trim()      ?? "";
  const page        = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
  const per_page    = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10)));
  const offset      = (page - 1) * per_page;

  let query = client
    .from("source_runs")
    .select("*", { count: "exact" });

  if (source_name) query = query.eq("source_name", source_name);
  if (status)      query = query.eq("status", status);

  const { data, count, error } = await query
    .order("started_at", { ascending: false })
    .range(offset, offset + per_page - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total       = count ?? 0;
  const total_pages = Math.ceil(total / per_page);

  return NextResponse.json({ runs: data ?? [], total, page, per_page, total_pages });
}
