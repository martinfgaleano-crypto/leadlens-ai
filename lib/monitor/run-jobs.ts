// ─── Monitor Run Jobs v0 ──────────────────────────────────────────────────────
// Shared job-creation logic for monitor runs (customer run, admin rerun, and
// the future scheduler). Creates the processing snapshot; NEVER executes the
// pipeline. Route-specific concerns stay in the routes: auth, ownership,
// entitlement, onboarding linkage.
//
// Scope safety: every query here is filtered by search_id. No global lookups.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { OnboardingData } from "@/types";
import { createProcessingSnapshot, processingCutoffIso } from "@/lib/storage/snapshot-store";

export const VALID_RUN_PLANS = ["sample", "starter", "standard", "pro"] as const;
export type RunPlan = typeof VALID_RUN_PLANS[number];

export function normalizeRunPlan(raw: string | null | undefined): RunPlan {
  return (VALID_RUN_PLANS as readonly string[]).includes(raw ?? "")
    ? (raw as RunPlan)
    : "starter";
}

export type CreateJobResult =
  | { ok: true; job_id: string; search_id: string; plan: RunPlan; is_baseline: boolean }
  | { ok: false; code: "duplicate"; inflight_job_id: string }
  | { ok: false; code: "store_error"; message: string };

/**
 * Creates a processing snapshot for a monitor run.
 * - Blocks when a FRESH processing snapshot exists (stale rows ignored —
 *   see snapshot-store.PROCESSING_STALE_MS).
 * - Derives is_baseline from completed runs in the same series.
 * The caller is responsible for having authorized the run beforehand.
 */
export async function createMonitorRunJob(
  db: any,
  input: { searchId: string; plan: RunPlan },
): Promise<CreateJobResult> {
  const { searchId, plan } = input;

  const { data: inflight } = await db
    .from("snapshot_reports")
    .select("job_id")
    .eq("search_id", searchId)
    .eq("status", "processing")
    .gte("created_at", processingCutoffIso())
    .limit(1)
    .maybeSingle();

  if (inflight) {
    return { ok: false, code: "duplicate", inflight_job_id: (inflight as { job_id: string }).job_id };
  }

  const { count: completedCount } = await db
    .from("snapshot_reports")
    .select("id", { count: "exact", head: true })
    .eq("search_id", searchId)
    .eq("status", "completed");

  const isBaseline = (completedCount ?? 0) === 0;

  const jobId = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const created = await createProcessingSnapshot(jobId, plan, searchId);
  if (!created) {
    console.error(`[run-jobs] job_create_failed search=${searchId} plan=${plan}`);
    return { ok: false, code: "store_error", message: "Could not create the run job." };
  }

  console.log(`[run-jobs] job_created job=${jobId} search=${searchId} plan=${plan} baseline=${isBaseline}`);
  return { ok: true, job_id: jobId, search_id: searchId, plan, is_baseline: isBaseline };
}

/**
 * Reconstructs pipeline OnboardingData from the onboarding_request linked to a
 * search. Returns null when no linkage exists (setup incomplete).
 * Mapping matches the original rerun route: what_you_sell backs the three
 * description fields as best-available business context.
 */
export async function fetchOnboardingDataForSearch(
  db: any,
  searchId: string,
): Promise<OnboardingData | null> {
  const { data: row } = await db
    .from("onboarding_requests")
    .select("company_name, email, what_you_sell, ideal_customer")
    .eq("search_id", searchId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return null;

  return {
    company_name:                row.company_name,
    company_description:         row.what_you_sell,
    offer_description:           row.what_you_sell,
    value_proposition:           row.what_you_sell,
    target_customer_description: row.ideal_customer ?? "Target customer not specified",
    tone:                        "direct",
    contact_email:               row.email,
  };
}

/**
 * Fire-and-forget trigger for the internal processor. Errors never propagate —
 * the processing snapshot is the durable state; a lost trigger becomes a stale
 * job recoverable via admin retry (see ASYNC_RUN_EXECUTION.md).
 */
export function triggerProcessor(jobId: string): void {
  const secret = process.env.INTERNAL_RUN_SECRET || process.env.ADMIN_SECRET_TOKEN;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  void fetch(`${appUrl}/api/internal/monitor-runs/${jobId}/process`, {
    method: "POST",
    headers: secret ? { "x-internal-secret": secret } : {},
  }).catch((err: unknown) => {
    console.error(`[run-jobs] processor trigger failed for ${jobId} (job stays processing; recoverable after stale cutoff):`,
      err instanceof Error ? err.message : err);
  });
}
