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

// A `processing` row older than this is considered abandoned (the serverless
// function was killed before failSnapshot could run). Duplicate-run guards and
// "run in progress" displays must ignore stale rows, or a single killed run
// would block the series forever.
export const PROCESSING_STALE_MS = 15 * 60 * 1000;

export function processingCutoffIso(): string {
  return new Date(Date.now() - PROCESSING_STALE_MS).toISOString();
}

export function isProcessingFresh(createdAt: string): boolean {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && t > Date.now() - PROCESSING_STALE_MS;
}

export interface SnapshotRecord {
  id:          string;
  job_id:      string;
  plan:        string;
  user_id:     string | null;
  search_id:   string | null;   // lead_searches.id — safe scope for previous-snapshot lookup
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
  jobId:    string,
  plan:     string,
  searchId?: string | null,
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
        ...(searchId ? { search_id: searchId } : {}),
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
  jobId:    string,
  plan:     string,
  report:   LeadLensReport,
  searchId?: string | null,
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
          ...(searchId ? { search_id: searchId } : {}),
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
  jobId:    string,
  plan:     string,
  reason:   string,
  searchId?: string | null,
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
          ...(searchId ? { search_id: searchId } : {}),
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
      .select("id, job_id, plan, user_id, search_id, status, lead_count, hot_count, warm_count, avg_score, report_json, created_at")
      .eq("job_id", jobId)
      .single();

    if (error || !data) return null;
    return data as SnapshotRecord;
  } catch {
    return null;
  }
}

// ─── getPreviousCompletedSnapshot ─────────────────────────────────────────────
// Returns the most recent completed snapshot for the same search series, for
// "What Changed Since Last Report" true-delta comparison.
//
// Safe scope: requires searchId (lead_searches.id). Without it, returns null
// immediately — never falls back to a global "most recent" query, which would
// risk cross-customer or cross-search comparisons (unsafe for SaaS).
//
// Typical flow:
//   1. Monthly Monitor trigger calls /api/process with { jobId, searchId }.
//   2. pipeline.ts passes searchId to this function.
//   3. Query: search_id = searchId AND status = completed AND job_id != currentJobId,
//      ordered newest first, limit 1.
//   4. Returns report_json cast to LeadLensReport, or null on any failure.
//
// When null is returned, applyChangeSinceLastReportToReport uses Phase 1B proxy
// classification — safe and correct as a fallback.

export async function getPreviousCompletedSnapshot(
  currentJobId: string,
  searchId?: string | null,
): Promise<LeadLensReport | null> {
  // Hard requirement: scope must be established before any query runs.
  if (!searchId) return null;

  const db = await getDb();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("snapshot_reports")
      .select("report_json")
      .eq("search_id", searchId)
      .eq("status", "completed")
      .neq("job_id", currentJobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    const rec = data as { report_json: unknown };
    if (!rec.report_json || typeof rec.report_json !== "object") return null;
    return rec.report_json as LeadLensReport;
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
      .select("id, job_id, plan, user_id, search_id, status, lead_count, hot_count, warm_count, avg_score, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []) as Omit<SnapshotRecord, "report_json">[];
  } catch {
    return [];
  }
}

// ─── listSnapshotsForSearch ───────────────────────────────────────────────────
// Run history for a single Monthly Monitor series (scoped to search_id).

export async function listSnapshotsForSearch(
  searchId: string,
  limit = 20,
): Promise<Omit<SnapshotRecord, "report_json">[]> {
  if (!searchId) return [];
  const db = await getDb();
  if (!db) return [];

  try {
    const { data } = await db
      .from("snapshot_reports")
      .select("id, job_id, plan, user_id, search_id, status, lead_count, hot_count, warm_count, avg_score, created_at")
      .eq("search_id", searchId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []) as Omit<SnapshotRecord, "report_json">[];
  } catch {
    return [];
  }
}
