import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import type { ChangeType } from "@/types";
import { isProcessingFresh } from "@/lib/storage/snapshot-store";

// ── GET /api/admin/searches/[id]/runs ─────────────────────────────────────────
// Monitor run history for one search series (lead_searches.id = series ID).
//
// Scope safety: every row comes from .eq("search_id", searchId) — snapshots from
// other searches or customers can never appear in the response. There is no
// global fallback when searchId is missing; an invalid id is a 400.
//
// change_summary is extracted server-side via a JSON-path select so the full
// report_json (which contains commercial intelligence) never leaves the DB for
// this listing. Counts only — no account names, no personal data.
//
// is_baseline: the earliest COMPLETED run in the series. Processing/failed runs
// are never a baseline. run_index counts completed runs only (1 = baseline).

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

const uuidSchema = z.string().uuid();

interface RunRow {
  job_id: string;
  plan: string;
  status: "processing" | "completed" | "failed";
  lead_count: number | null;
  hot_count: number | null;
  warm_count: number | null;
  avg_score: number | null;
  created_at: string;
  change_summary: {
    new_count?: number;
    by_type?: Partial<Record<ChangeType, number>>;
    client_visible_count?: number;
  } | null;
  evidence_quality_counts: { high?: number; medium?: number; low?: number; insufficient?: number } | null;
}

// ── QA flags (admin review aid) ───────────────────────────────────────────────
// Derived from aggregates the pipeline already writes into report_json.
// No freshness-dominance flag yet: the report has no freshness aggregate and
// computing one here would require shipping full ranked_opportunities per run.

function deriveQaFlags(r: RunRow): { qa_flags: string[]; needs_review: boolean } {
  const flags: string[] = [];

  if (r.status === "failed") flags.push("Run failed");

  const eq = r.evidence_quality_counts;
  if (r.status === "completed" && eq && typeof eq === "object") {
    const weak = (eq.low ?? 0) + (eq.insufficient ?? 0);
    const total = weak + (eq.high ?? 0) + (eq.medium ?? 0);
    if (total > 0 && weak / total > 0.5) flags.push("Low/insufficient evidence dominates");
  }

  const byType = r.change_summary?.by_type;
  if (r.status === "completed" && byType && r.lead_count && r.lead_count > 0) {
    const noise = (byType.no_meaningful_change ?? 0) + (byType.repeated_no_change ?? 0);
    if (noise / r.lead_count > 0.5) flags.push("Mostly repeated / no meaningful change");
  }

  return { qa_flags: flags, needs_review: flags.length > 0 };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  if (!uuidSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid search ID." }, { status: 400 });
  }
  const searchId = params.id;

  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: search, error: searchErr } = await db
    .from("lead_searches")
    .select("id")
    .eq("id", searchId)
    .single();

  if (searchErr || !search) {
    return NextResponse.json({ error: "Search not found." }, { status: 404 });
  }

  const { data, error } = await db
    .from("snapshot_reports")
    .select("job_id, plan, status, lead_count, hot_count, warm_count, avg_score, created_at, change_summary:report_json->change_summary, evidence_quality_counts:report_json->evidence_quality_counts")
    .eq("search_id", searchId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[admin/searches/runs] query error:", error.message);
    return NextResponse.json({ error: "Database error." }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as RunRow[];

  // Oldest → newest walk: the first completed run is the series baseline.
  let completedSeen = 0;
  const enriched = rows.map((r) => {
    const isCompleted = r.status === "completed";
    if (isCompleted) completedSeen++;
    const { qa_flags, needs_review } = deriveQaFlags(r);
    return {
      job_id:      r.job_id,
      plan:        r.plan,
      status:      r.status,
      created_at:  r.created_at,
      lead_count:  r.lead_count,
      hot_count:   r.hot_count,
      warm_count:  r.warm_count,
      avg_score:   r.avg_score,
      has_report:  isCompleted,   // processing/failed rows only hold a placeholder
      is_baseline: isCompleted && completedSeen === 1,
      run_index:   isCompleted ? completedSeen : null,
      qa_flags,
      needs_review,
      change_summary: r.change_summary && typeof r.change_summary === "object"
        ? {
            by_type:              r.change_summary.by_type ?? {},
            client_visible_count: r.change_summary.client_visible_count ?? 0,
          }
        : null,
    };
  });

  const newestFirst = [...enriched].reverse();
  const latestCompleted = newestFirst.find((r) => r.status === "completed");

  return NextResponse.json({
    search_id:          searchId,
    total_runs:         enriched.length,
    latest_status:      newestFirst[0]?.status ?? null,
    latest_completed_at: latestCompleted?.created_at ?? null,
    has_processing_run: enriched.some((r) => r.status === "processing" && isProcessingFresh(r.created_at)),
    runs:               newestFirst,
  });
}
