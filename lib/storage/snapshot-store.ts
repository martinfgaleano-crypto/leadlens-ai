import type { LeadLensReport } from "@/types";

// ─── snapshot-store ───────────────────────────────────────────────────────────
// Lightweight persistence for AI pipeline runs (opportunity snapshots).
// All operations are best-effort — they never throw and never block the caller.
// report_json stores a minimal placeholder for processing/failed rows so the
// NOT NULL constraint is satisfied without exposing real data prematurely.

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
  report_json: LeadLensReport | Record<string, unknown>;
  created_at:  string;
}

// ─── createProcessingSnapshot ─────────────────────────────────────────────────
// Inserts a minimal row at pipeline start so the job is visible immediately.
// report_json gets a safe placeholder — never contains real leads or PII.

export async function createProcessingSnapshot(
  jobId: string,
  plan:  string,
): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("snapshot_reports")
      .insert({
        job_id:      jobId,
        plan,
        status:      "processing",
        report_json: { _status: "processing", job_id: jobId },
      })
      .select("id")
      .single();

    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

// ─── completeSnapshot ─────────────────────────────────────────────────────────
// Upserts full report data once the pipeline finishes successfully.

export async function completeSnapshot(
  jobId:  string,
  plan:   string,
  report: LeadLensReport,
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
          status:      "completed",
          lead_count:  report.total_leads,
          hot_count:   report.hot_count,
          warm_count:  report.warm_count,
          avg_score:   report.avg_score,
          report_json: report,
        },
        { onConflict: "job_id" },
      )
      .select("id")
      .single();

    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

// ─── failSnapshot ─────────────────────────────────────────────────────────────
// Upserts a failed status when the pipeline throws.
// reason must be a sanitized internal message — never a raw error with secrets.

export async function failSnapshot(
  jobId:  string,
  plan:   string,
  reason: string,
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
          status:      "failed",
          report_json: { _status: "failed", job_id: jobId, _reason: reason },
        },
        { onConflict: "job_id" },
      )
      .select("id")
      .single();

    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch {
    return null;
  }
}

// ─── saveSnapshot (legacy / generic upsert) ───────────────────────────────────
// Kept for callers that don't need the lifecycle helpers.

export async function saveSnapshot(
  jobId:   string,
  plan:    string,
  report:  LeadLensReport,
  options: { userId?: string; status?: "processing" | "completed" | "failed" } = {},
): Promise<string | null> {
  return completeSnapshot(jobId, plan, report);
}

// ─── getSnapshot ─────────────────────────────────────────────────────────────

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
