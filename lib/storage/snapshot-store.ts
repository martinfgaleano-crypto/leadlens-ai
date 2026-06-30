import type { LeadLensReport } from "@/types";

// ─── snapshot-store ───────────────────────────────────────────────────────────
// Lightweight persistence for AI pipeline runs (opportunity snapshots).
// All operations are best-effort — they never throw and never block the caller.

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export interface SnapshotRecord {
  id:          string;
  job_id:      string;
  plan:        string;
  user_id:     string | null;
  status:      "processing" | "completed" | "failed";
  lead_count:  number | null;
  hot_count:   number | null;
  warm_count:  number | null;
  avg_score:   number | null;
  report_json: LeadLensReport;
  created_at:  string;
}

// ─── saveSnapshot ─────────────────────────────────────────────────────────────
// Upserts a snapshot_reports row. Returns the row id on success, null on failure.

export async function saveSnapshot(
  jobId:   string,
  plan:    string,
  report:  LeadLensReport,
  options: { userId?: string; status?: SnapshotRecord["status"] } = {},
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("snapshot_reports")
      .upsert(
        {
          job_id:      jobId,
          plan,
          user_id:     options.userId ?? null,
          status:      options.status ?? "completed",
          lead_count:  report.total_leads,
          hot_count:   report.hot_count,
          warm_count:  report.warm_count,
          avg_score:   report.avg_score,
          report_json: report,
        },
        { onConflict: "job_id" }
      )
      .select("id")
      .single();

    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

// ─── getSnapshot ─────────────────────────────────────────────────────────────
// Reads a snapshot by job_id. Returns null if not found or Supabase unavailable.

export async function getSnapshot(jobId: string): Promise<SnapshotRecord | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("snapshot_reports")
      .select("id, job_id, plan, user_id, status, lead_count, hot_count, warm_count, avg_score, report_json, created_at")
      .eq("job_id", jobId)
      .single();

    if (error || !data) return null;
    return data as SnapshotRecord;
  } catch {
    return null;
  }
}

// ─── listSnapshots ────────────────────────────────────────────────────────────
// Lists recent snapshots (admin use). Returns [] on failure.

export async function listSnapshots(limit = 20): Promise<Omit<SnapshotRecord, "report_json">[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const { data } = await db
      .from("snapshot_reports")
      .select("id, job_id, plan, user_id, status, lead_count, hot_count, warm_count, avg_score, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []) as Omit<SnapshotRecord, "report_json">[];
  } catch {
    return [];
  }
}
