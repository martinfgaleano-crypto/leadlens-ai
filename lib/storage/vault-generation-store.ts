// ─── Vault generation job store v0 ────────────────────────────────────────────
// Async lifecycle for Vault-powered report generation, built on the EXISTING
// snapshot_reports rows (no new table): the processing snapshot is the durable
// job, and its report_json carries a _vault_generation metadata block while the
// job is processing/failed. On completion the metadata is reduced to a minimal
// marker — report_json becomes the customer-visible report, and criteria/vault
// ids must never ship to the customer.

import type { LeadCandidate, LeadLensReport } from "@/types";
import { isProcessingFresh } from "@/lib/storage/snapshot-store";

export interface VaultGenerationMeta {
  source_mode: "vault";
  generated_by: "admin";
  customer_email: string;
  order_id?: string | null;
  search_id?: string | null;
  plan: string;
  criteria: Record<string, unknown>;
  vault_company_ids: string[];
  candidates: LeadCandidate[];
  reservation_count: number;
  /** Aggregate selection funnel (counts + reason keys only — no company names).
   *  Merged into report_intelligence on completion so the customer sees the
   *  real "considered → rejected → selected" numbers. */
  selection_stats?: {
    total_considered: number;
    selected: number;
    rejection_reasons: Record<string, number>;
  };
  started_at: string;
  processor_started_at?: string | null;
  completed_at?: string | null;
  failed_at?: string | null;
  error?: string | null;
  usage_recorded?: number;
  reservations_released?: number;
  retried_from?: string | null;
  retried_by?: string | null;
}

export interface VaultGenerationJob {
  job_id: string;
  status: "processing" | "completed" | "failed";
  plan: string;
  created_at: string;
  meta: VaultGenerationMeta | null;
}

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

/** Create the durable processing row with full generation metadata. */
export async function createVaultGenerationJob(
  jobId: string,
  meta: VaultGenerationMeta,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const { error } = await db.from("snapshot_reports").insert({
    job_id: jobId,
    plan: meta.plan,
    status: "processing",
    report_json: { _status: "processing", job_id: jobId, _vault_generation: meta },
    ...(meta.search_id ? { search_id: meta.search_id } : {}),
  });
  if (error) { console.error("[vault-generation-store] create:", error.message); return false; }
  return true;
}

export async function getVaultGenerationJob(jobId: string): Promise<VaultGenerationJob | null> {
  const db = await getDb();
  if (!db) return null;
  const { data } = await db.from("snapshot_reports")
    .select("job_id, status, plan, created_at, report_json")
    .eq("job_id", jobId)
    .maybeSingle();
  if (!data) return null;
  const json = (data.report_json ?? {}) as Record<string, unknown>;
  return {
    job_id: data.job_id,
    status: data.status as VaultGenerationJob["status"],
    plan: data.plan,
    created_at: data.created_at,
    meta: (json._vault_generation as VaultGenerationMeta | undefined) ?? null,
  };
}

/** Merge-update the metadata block without touching status. */
export async function updateVaultGenerationMeta(
  jobId: string,
  patch: Partial<VaultGenerationMeta>,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const job = await getVaultGenerationJob(jobId);
  if (!job?.meta) return false;
  const { error } = await db.from("snapshot_reports")
    .update({ report_json: { _status: job.status, job_id: jobId, _vault_generation: { ...job.meta, ...patch } } })
    .eq("job_id", jobId)
    .eq("status", "processing"); // never rewrite a completed report
  if (error) { console.error("[vault-generation-store] updateMeta:", error.message); return false; }
  return true;
}

/** Atomically claim a processing job for one processor invocation.
 *  Returns false when the job is not processing or a fresh claim exists. */
export async function claimVaultGenerationJob(jobId: string): Promise<{ ok: boolean; job: VaultGenerationJob | null; reason?: string }> {
  const job = await getVaultGenerationJob(jobId);
  if (!job) return { ok: false, job: null, reason: "Job not found." };
  if (job.status === "completed") return { ok: false, job, reason: "Job already completed — nothing to do (usage already recorded)." };
  if (job.status === "failed") return { ok: false, job, reason: "Job is failed — use the admin retry control, which re-validates the selection." };
  if (!job.meta) return { ok: false, job, reason: "Job has no generation metadata — not a Vault generation job." };
  if (job.meta.processor_started_at && isProcessingFresh(job.meta.processor_started_at)) {
    return { ok: false, job, reason: "A fresh processor run already claimed this job." };
  }
  const claimed = await updateVaultGenerationMeta(jobId, { processor_started_at: new Date().toISOString() });
  return claimed ? { ok: true, job } : { ok: false, job, reason: "Could not persist processor claim." };
}

/** Persist the finished report. Customer-visible report_json keeps only a
 *  minimal provenance marker — criteria/vault ids/candidates never ship. */
export async function completeVaultGenerationJob(
  jobId: string,
  report: LeadLensReport,
  meta: VaultGenerationMeta,
  usageRecorded: number,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const { error } = await db.from("snapshot_reports").upsert({
    job_id: jobId,
    plan: meta.plan,
    status: "completed",
    lead_count: report.total_leads,
    hot_count: report.hot_count,
    warm_count: report.warm_count,
    avg_score: report.avg_score,
    // Minimal marker only: recipient email (their own), never criteria/vault ids.
    report_json: { ...report, _vault_generation: { source_mode: "vault", generated_by: "admin", completed_at: new Date().toISOString(), usage_recorded: usageRecorded, customer_email: meta.customer_email } },
    ...(meta.search_id ? { search_id: meta.search_id } : {}),
  }, { onConflict: "job_id" });
  if (error) { console.error("[vault-generation-store] complete:", error.message); return false; }
  return true;
}

/** Mark failed while PRESERVING metadata so admin retry/release still work. */
export async function failVaultGenerationJob(
  jobId: string,
  meta: VaultGenerationMeta,
  reason: string,
  reservationsReleased: number,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const safeReason = reason.slice(0, 200);
  const { error } = await db.from("snapshot_reports").upsert({
    job_id: jobId,
    plan: meta.plan,
    status: "failed",
    report_json: {
      _status: "failed",
      job_id: jobId,
      _reason: safeReason,
      _vault_generation: { ...meta, failed_at: new Date().toISOString(), error: safeReason, reservations_released: reservationsReleased },
    },
    ...(meta.search_id ? { search_id: meta.search_id } : {}),
  }, { onConflict: "job_id" });
  if (error) { console.error("[vault-generation-store] fail:", error.message); return false; }
  return true;
}

export interface VaultGenerationRunSummary {
  job_id: string;
  status: string;
  plan: string;
  created_at: string;
  customer_email: string | null;
  selected_count: number;
  lead_count: number | null;
  error: string | null;
  usage_recorded: number | null;
  reservations_released: number | null;
  stale_processing: boolean;
  retried_from: string | null;
  search_id: string | null;
  /** "workspace" when linked to a monitor (search_id), else "link_only". */
  delivery: "workspace" | "link_only";
}

/** Recent Vault generation runs (jobIds prefixed "vault-"), admin ops view. */
export async function listVaultGenerationRuns(limit = 20): Promise<VaultGenerationRunSummary[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await db.from("snapshot_reports")
    .select("job_id, status, plan, created_at, lead_count, search_id, report_json")
    .like("job_id", "vault-%")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => {
    const json = (row.report_json ?? {}) as Record<string, unknown>;
    const meta = (json._vault_generation as Partial<VaultGenerationMeta> | undefined) ?? {};
    return {
      job_id: row.job_id,
      status: row.status,
      plan: row.plan,
      created_at: row.created_at,
      customer_email: meta.customer_email ?? null,
      selected_count: meta.vault_company_ids?.length ?? 0,
      lead_count: row.lead_count ?? null,
      error: (meta.error as string | undefined) ?? (json._reason as string | undefined) ?? null,
      usage_recorded: meta.usage_recorded ?? null,
      reservations_released: meta.reservations_released ?? null,
      stale_processing: row.status === "processing" && !isProcessingFresh(row.created_at),
      retried_from: meta.retried_from ?? null,
      // search_id survives completion as a column even though meta is reduced
      search_id: (row.search_id as string | null) ?? meta.search_id ?? null,
      delivery: (row.search_id ?? meta.search_id) ? "workspace" : "link_only",
    };
  });
}
