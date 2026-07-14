// ─── Vault generation queue (shared by generate + retry) ─────────────────────
// select → adapt → reserve → durable processing job → fire-and-forget trigger.
// The processing snapshot is the durable state: a lost trigger becomes a stale
// job recoverable from the admin runs view (same convention as monitor runs).

import type { PlanType } from "@/types";
import { selectVaultOpportunities } from "./vault-opportunity-selector";
import { convertVaultOpportunitiesToLeadCandidates } from "./vault-to-lead-candidate";
import type { VaultOpportunitySelectionCriteria } from "./vault-opportunity-types";
import { reserveVaultOpportunitiesForRun } from "@/lib/storage/vault-store";
import { createVaultGenerationJob, type VaultGenerationMeta } from "@/lib/storage/vault-generation-store";

const PLANS: PlanType[] = ["sample", "starter", "standard", "pro"];

export interface QueueVaultGenerationInput extends VaultOpportunitySelectionCriteria {
  plan?: string;
  search_id?: string;
  reserve_ttl_hours?: number;
  retried_from?: string;
}

export type QueueVaultGenerationResult =
  | { ok: true; status: 202; job_id: string; report_url: string; selected_count: number; reservation_count: number; selection_summary: string }
  | { ok: false; status: number; error: string; details?: Record<string, unknown> };

export function internalProcessorConfigured(): boolean {
  return !!(process.env.INTERNAL_RUN_SECRET || process.env.ADMIN_SECRET_TOKEN);
}

/** Fire-and-forget trigger for the Vault generation processor. */
export function triggerVaultGenerationProcessor(jobId: string): void {
  const secret = process.env.INTERNAL_RUN_SECRET || process.env.ADMIN_SECRET_TOKEN;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  void fetch(`${appUrl}/api/internal/vault-report-bridge/process`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(secret ? { "x-internal-secret": secret } : {}) },
    body: JSON.stringify({ job_id: jobId }),
  }).catch((err: unknown) => {
    console.error(`[vault-generation] processor trigger failed for ${jobId} (job stays processing; recoverable via admin retry):`,
      err instanceof Error ? err.message : err);
  });
}

export async function queueVaultGeneration(input: QueueVaultGenerationInput): Promise<QueueVaultGenerationResult> {
  const customerEmail = input.customer_email?.trim().toLowerCase() || null;
  if (!customerEmail) {
    return { ok: false, status: 400, error: "customer_email is required to generate a customer report — usage history and ownership need an owner." };
  }
  const plan: PlanType = PLANS.includes(input.plan as PlanType) ? (input.plan as PlanType) : "starter";

  const selection = await selectVaultOpportunities({ ...input, customer_email: customerEmail });
  if (selection.selected.length === 0) {
    return {
      ok: false, status: 422, error: "Not enough approved Vault opportunities for this ICP.",
      details: {
        message: selection.message,
        rejected_counts: selection.rejected_counts,
        total_considered: selection.total_considered,
        unavailable_reason: selection.unavailable_reason ?? null,
      },
    };
  }

  const adapted = convertVaultOpportunitiesToLeadCandidates(selection.selected, {
    customer_email: customerEmail, monitor_id: input.monitor_id ?? null, order_id: input.order_id ?? null,
  });
  if (!adapted.ok) {
    return { ok: false, status: 422, error: "Selection could not be converted to report candidates.", details: { notes: adapted.notes } };
  }

  const jobId = `vault-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const companyIds = Array.from(new Set(selection.selected.map((o) => o.vault_company_id)));
  const reservations = await reserveVaultOpportunitiesForRun(
    companyIds,
    { customer_email: customerEmail, order_id: input.order_id ?? null, job_id: jobId },
    input.reserve_ttl_hours ?? 24,
  );

  const meta: VaultGenerationMeta = {
    source_mode: "vault",
    generated_by: "admin",
    customer_email: customerEmail,
    order_id: input.order_id ?? null,
    search_id: input.search_id ?? null,
    plan,
    // Criteria persisted for retry — candidates payload persisted so the
    // processor runs exactly what was selected and reserved.
    criteria: {
      target_market: input.target_market ?? null, icp_notes: input.icp_notes ?? null,
      region: input.region ?? null, country: input.country ?? null, industry: input.industry ?? null,
      max_candidates: input.max_candidates ?? null, min_confidence: input.min_confidence ?? null,
      freshness_preference: input.freshness_preference ?? null,
    },
    vault_company_ids: companyIds,
    candidates: adapted.candidates,
    reservation_count: reservations.length,
    selection_stats: {
      total_considered: selection.total_considered,
      selected: selection.selected.length,
      rejection_reasons: Object.fromEntries(
        Object.entries(selection.rejected_counts).filter(([, v]) => typeof v === "number" && v > 0),
      ) as Record<string, number>,
    },
    started_at: new Date().toISOString(),
    retried_from: input.retried_from ?? null,
  };

  const created = await createVaultGenerationJob(jobId, meta);
  if (!created) {
    // No durable job → release what we just reserved; nothing else happened yet.
    const { releaseVaultReservationsForFailedRun } = await import("@/lib/storage/vault-store");
    await releaseVaultReservationsForFailedRun({ customer_email: customerEmail, order_id: input.order_id ?? null, job_id: jobId }).catch(() => 0);
    return { ok: false, status: 503, error: "Could not persist the generation job — Supabase unavailable. Reservations released." };
  }

  triggerVaultGenerationProcessor(jobId);

  return {
    ok: true, status: 202,
    job_id: jobId,
    report_url: `/results/${jobId}`,
    selected_count: selection.selected.length,
    reservation_count: reservations.length,
    selection_summary: selection.message,
  };
}
