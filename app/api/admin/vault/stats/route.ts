import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// ── GET /api/admin/vault/stats ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  // Fetch lightweight columns from all vault leads (capped at 5000 for perf)
  const { data, error, count } = await client
    .from("vault_leads")
    .select("country, industry, opportunity_score, times_seen", { count: "exact" })
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as {
    country: string | null;
    industry: string | null;
    opportunity_score: number | null;
    times_seen: number;
  }[];

  const total        = count ?? rows.length;
  const countries    = new Set(rows.map(r => r.country).filter(Boolean)).size;
  const industries   = new Set(rows.map(r => r.industry).filter(Boolean)).size;
  const scoredRows   = rows.filter(r => r.opportunity_score != null);
  const avgOpp       = scoredRows.length > 0
    ? Math.round(scoredRows.reduce((s, r) => s + (r.opportunity_score ?? 0), 0) / scoredRows.length)
    : 0;
  const topScore     = scoredRows.length > 0
    ? Math.max(...scoredRows.map(r => r.opportunity_score ?? 0))
    : 0;
  const repeatCount  = rows.filter(r => r.times_seen > 1).length;
  const repeatRate   = total > 0 ? Math.round((repeatCount / total) * 100) : 0;

  return NextResponse.json({
    total,
    countries,
    industries,
    avg_opportunity: avgOpp,
    top_score:       topScore,
    repeat_rate:     repeatRate,
    repeat_count:    repeatCount,
  });
}
