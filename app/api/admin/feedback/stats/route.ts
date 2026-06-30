import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

const REUSABLE = new Set(["meeting_booked", "replied", "add_to_vault", "useful"]);
const NEGATIVE  = new Set(["wrong_fit", "not_useful", "generic", "exclude_similar", "irrelevant"]);

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// ── GET /api/admin/feedback/stats ────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await getDb();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  // Fetch aggregate columns only — no personal data
  const { data, error } = await client
    .from("opportunity_feedback")
    .select("company, industry, segment, category, feedback_signal, opportunity_score, buying_window, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const all = (data ?? []) as {
    company:          string;
    industry:         string | null;
    segment:          string | null;
    category:         string | null;
    feedback_signal:  string;
    opportunity_score: number | null;
    buying_window:    string | null;
    created_at:       string;
  }[];

  const total_feedback = all.length;

  const signalMap:   Record<string, number> = {};
  const industryMap: Record<string, number> = {};
  const categoryMap: Record<string, number> = {};
  const posMap:      Record<string, number> = {};
  const negMap:      Record<string, number> = {};
  let reusable_feedback_count = 0;
  let negative_feedback_count = 0;

  for (const r of all) {
    const sig = r.feedback_signal;
    const ind = r.industry ?? "unknown";
    const cat = r.category ?? "unknown";

    signalMap[sig]   = (signalMap[sig]   ?? 0) + 1;
    industryMap[ind] = (industryMap[ind] ?? 0) + 1;
    categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;

    if (REUSABLE.has(sig)) { reusable_feedback_count++; posMap[ind] = (posMap[ind] ?? 0) + 1; }
    if (NEGATIVE.has(sig))  { negative_feedback_count++; negMap[ind] = (negMap[ind] ?? 0) + 1; }
  }

  const byCount = (map: Record<string, number>) =>
    Object.entries(map).sort((a, b) => b[1] - a[1]);

  const feedback_by_signal = byCount(signalMap).map(([signal, count]) => ({ signal, count }));

  const feedback_by_industry = byCount(industryMap)
    .slice(0, 10)
    .map(([industry, count]) => ({ industry, count }));

  const feedback_by_category = byCount(categoryMap).map(([category, count]) => ({ category, count }));

  const top_positive_segments = byCount(posMap)
    .slice(0, 5)
    .map(([industry, count]) => ({ industry, count }));

  const top_negative_segments = byCount(negMap)
    .slice(0, 5)
    .map(([industry, count]) => ({ industry, count }));

  // Recent rows — company names are company-level (not personal)
  const recent_feedback = all.slice(0, 20).map(r => ({
    company:         r.company,
    industry:        r.industry,
    segment:         r.segment,
    category:        r.category,
    feedback_signal: r.feedback_signal,
    buying_window:   r.buying_window,
    created_at:      r.created_at,
  }));

  return NextResponse.json({
    total_feedback,
    feedback_by_signal,
    feedback_by_industry,
    feedback_by_category,
    reusable_feedback_count,
    negative_feedback_count,
    top_positive_segments,
    top_negative_segments,
    recent_feedback,
  });
}
