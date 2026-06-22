import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function GET(req: NextRequest) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const q          = searchParams.get("q")?.trim()        ?? "";
  const industry   = searchParams.get("industry")?.trim() ?? "";
  const page       = Math.max(1, parseInt(searchParams.get("page")       ?? "1",  10));
  const per_page   = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10)));
  const offset     = (page - 1) * per_page;

  let query = client
    .from("company_profiles")
    .select("*", { count: "exact" });

  if (q) {
    query = query.or(`company_name.ilike.%${q}%,normalized_company.ilike.%${q}%,domain.ilike.%${q}%`);
  }
  if (industry) {
    query = query.eq("industry", industry);
  }

  const { data, count, error } = await query
    .order("top_score", { ascending: false })
    .range(offset, offset + per_page - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const total       = count ?? 0;
  const total_pages = Math.ceil(total / per_page);

  return NextResponse.json({ companies: data ?? [], total, page, per_page, total_pages });
}
