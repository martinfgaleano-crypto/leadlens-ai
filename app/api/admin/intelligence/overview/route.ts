import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

// GET /api/admin/intelligence/overview — feedback observability metrics +
// learned preferences list. Admin-only, server-side aggregation; free-text
// notes are never included. Graceful when migration 031 is missing.

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: events, error } = await db.from("opportunity_feedback")
    .select("id, user_id, search_id, feedback_signal, reason_codes, normalized_sentiment, feature_snapshot, versions, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error && /column|schema cache/i.test(error.message)) {
    return NextResponse.json({ migration_missing: true, message: "Migration 031 not applied — intelligence columns unavailable." });
  }
  if (error) return NextResponse.json({ error: "Query failed." }, { status: 500 });

  const rows = events ?? [];
  const withReasons = rows.filter((r) => Array.isArray(r.reason_codes) && r.reason_codes.length > 0);
  const reasonCounts: Record<string, number> = {};
  for (const r of withReasons) for (const code of r.reason_codes as string[]) reasonCounts[code] = (reasonCounts[code] ?? 0) + 1;
  const sentimentDist = { positive: 0, neutral: 0, negative: 0, none: 0 };
  for (const r of rows) {
    if (r.normalized_sentiment === 1) sentimentDist.positive++;
    else if (r.normalized_sentiment === 0) sentimentDist.neutral++;
    else if (r.normalized_sentiment === -1) sentimentDist.negative++;
    else sentimentDist.none++;
  }

  const { data: prefs } = await db.from("learned_preferences")
    .select("id, tenant_user_id, scope, monitor_id, feature_key, direction, status, strength, confidence, effective_confidence, observations, positive_obs, neutral_obs, negative_obs, distinct_report_count, last_observed_at, explanation, version, updated_at")
    .order("effective_confidence", { ascending: false, nullsFirst: false })
    .limit(200);

  return NextResponse.json({
    metrics: {
      total_events: rows.length,
      with_reason_codes: withReasons.length,
      with_snapshot: rows.filter((r) => !!r.feature_snapshot).length,
      with_versions: rows.filter((r) => !!r.versions).length,
      sentiment: sentimentDist,
      top_reason_codes: Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 8),
      already_known_pct: rows.length ? Math.round((reasonCounts["already_known"] ?? 0) / rows.length * 100) : 0,
      bad_explanation_pct: rows.length ? Math.round((reasonCounts["bad_explanation"] ?? 0) / rows.length * 100) : 0,
      incorrect_information_pct: rows.length ? Math.round((reasonCounts["incorrect_information"] ?? 0) / rows.length * 100) : 0,
    },
    preferences: prefs ?? [],
  });
}
