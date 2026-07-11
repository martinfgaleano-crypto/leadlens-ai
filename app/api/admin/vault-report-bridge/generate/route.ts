import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { selectVaultOpportunities } from "@/lib/vault/vault-opportunity-selector";
import { convertVaultOpportunitiesToLeadCandidates } from "@/lib/vault/vault-to-lead-candidate";
import type { VaultOpportunitySelectionCriteria } from "@/lib/vault/vault-opportunity-types";
import {
  recordVaultOpportunitiesUsed,
  releaseVaultReservationsForFailedRun,
  reserveVaultOpportunitiesForRun,
} from "@/lib/storage/vault-store";
import { completeSnapshot, createProcessingSnapshot, failSnapshot } from "@/lib/storage/snapshot-store";
import type { OnboardingData, PlanType } from "@/types";

// POST /api/admin/vault-report-bridge/generate — the real thing.
// Lifecycle: select → reserve → pipeline (candidatesOverride, no provider
// discovery) → persist snapshot → record usage. On any failure: fail the
// snapshot and release this run's reservations. Preview/dry-run never enter
// this file. Account-level only — the adapter carries no contacts or emails.

export const maxDuration = 300;

const PLANS: PlanType[] = ["sample", "starter", "standard", "pro"];

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const body = (await req.json().catch(() => null)) as
    | (VaultOpportunitySelectionCriteria & {
        plan?: string;
        search_id?: string;
        reserve_ttl_hours?: number;
      })
    | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON criteria body required" }, { status: 400 });
  }

  const customerEmail = body.customer_email?.trim().toLowerCase() || null;
  if (!customerEmail) {
    return NextResponse.json(
      { error: "customer_email is required to generate a customer report — usage history and ownership need an owner." },
      { status: 400 },
    );
  }
  const plan: PlanType = PLANS.includes(body.plan as PlanType) ? (body.plan as PlanType) : "starter";

  // 1. Select (exclusion-first; already-used for this customer excluded by default).
  const selection = await selectVaultOpportunities({ ...body, customer_email: customerEmail });
  if (selection.selected.length === 0) {
    return NextResponse.json(
      {
        error: "Not enough approved Vault opportunities for this ICP.",
        message: selection.message,
        rejected_counts: selection.rejected_counts,
        total_considered: selection.total_considered,
        unavailable_reason: selection.unavailable_reason ?? null,
      },
      { status: 422 },
    );
  }

  // 2. Adapt to report-pipeline candidates (account-level, source "vault").
  const adapted = convertVaultOpportunitiesToLeadCandidates(selection.selected, {
    customer_email: customerEmail,
    monitor_id: body.monitor_id ?? null,
    order_id: body.order_id ?? null,
  });
  if (!adapted.ok) {
    return NextResponse.json({ error: "Selection could not be converted to report candidates.", notes: adapted.notes }, { status: 422 });
  }

  const jobId = `vault-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const companyIds = Array.from(new Set(selection.selected.map((o) => o.vault_company_id)));
  const runContext = { customer_email: customerEmail, order_id: body.order_id ?? null, job_id: jobId };

  // 3. Reserve before generating.
  const reservations = await reserveVaultOpportunitiesForRun(companyIds, runContext, body.reserve_ttl_hours ?? 24);

  // 4. Durable job row first — /results/[jobId] shows "processing" from here on.
  await createProcessingSnapshot(jobId, plan, body.search_id ?? null);

  // The customer's commercial context, derived from the admin's criteria.
  // Used by the research/qualification/report agents — never shown as customer copy.
  const onboardingData: OnboardingData = {
    company_name: "LeadLens Vault Report",
    company_description: body.target_market ?? "B2B account intelligence",
    offer_description: body.target_market ?? "B2B services",
    value_proposition: body.icp_notes ?? "Account-level opportunity intelligence from verified public signals.",
    target_customer_description: [body.icp_notes, body.industry, body.region, body.country].filter(Boolean).join(" · ") || "B2B accounts with recent buying signals",
    tone: "consultative",
    contact_email: customerEmail,
  };

  try {
    const { runLeadLensPipeline } = await import("@/lib/pipeline");
    const report = await runLeadLensPipeline({
      onboardingData,
      plan,
      jobId,
      searchId: body.search_id ?? undefined,
      candidatesOverride: adapted.candidates,
    });

    const snapshotId = await completeSnapshot(jobId, plan, report, body.search_id ?? null);
    if (!snapshotId) {
      throw new Error("Report persistence failed — snapshot could not be saved.");
    }

    // 5. Usage only after the report actually exists.
    const usageRecorded = await recordVaultOpportunitiesUsed(companyIds, runContext);

    return NextResponse.json({
      ok: true,
      job_id: jobId,
      snapshot_id: snapshotId,
      report_url: `/results/${jobId}`,
      selected: selection.selected.length,
      lead_count: report.total_leads,
      customer_email: customerEmail,
      reservations_created: reservations.length,
      usage_recorded: usageRecorded,
      selection_summary: selection.message,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 200) : "Vault report generation failed";
    console.error(`[vault-bridge] generate_failed job=${jobId}:`, reason);
    await failSnapshot(jobId, plan, "Vault report generation failed").catch(() => null);
    const released = await releaseVaultReservationsForFailedRun(runContext).catch(() => 0);
    return NextResponse.json(
      { error: "Report generation failed — reservations released, no usage recorded.", reason, job_id: jobId, reservations_released: released },
      { status: 500 },
    );
  }
}
