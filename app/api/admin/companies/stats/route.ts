import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { computeCompanyStats } from "@/lib/company/company-stats";

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

  const { count } = await client
    .from("company_profiles")
    .select("*", { count: "exact", head: true });

  const total = count ?? 0;

  const { data: rows } = await client
    .from("company_profiles")
    .select("industry, average_score, top_score, times_seen")
    .order("created_at", { ascending: false })
    .limit(5000);

  const stats = computeCompanyStats(rows ?? [], total);

  return NextResponse.json(stats);
}
