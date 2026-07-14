import { NextRequest, NextResponse } from "next/server";
import {
  claimVaultGenerationJob,
  completeVaultGenerationJob,
  failVaultGenerationJob,
} from "@/lib/storage/vault-generation-store";
import { recordVaultOpportunitiesUsed, releaseVaultReservationsForFailedRun } from "@/lib/storage/vault-store";
import type { OnboardingData, PlanType } from "@/types";

// ── POST /api/internal/vault-report-bridge/process ────────────────────────────
// Internal processor for queued Vault report generation. Same auth convention
// as the monitor-run processor: x-internal-secret = INTERNAL_RUN_SECRET
// (fallback ADMIN_SECRET_TOKEN), fail-closed in production. Idempotency:
// completed jobs are never reprocessed (so usage is never double-recorded),
// and a fresh processor claim blocks concurrent duplicate runs.

export const maxDuration = 300;

function checkInternalAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.INTERNAL_RUN_SECRET || process.env.ADMIN_SECRET_TOKEN;
  const provided = req.headers.get("x-internal-secret");
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[vault-bridge/process] no internal secret set — rejecting in production");
      return NextResponse.json({ error: "Internal processing not configured." }, { status: 403 });
    }
    console.warn("[vault-bridge/process] no internal secret configured — allowing in development");
    return null;
  }
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const deny = checkInternalAuth(req);
  if (deny) return deny;

  const body = await req.json().catch(() => null);
  const jobId = body?.job_id;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json({ error: "job_id is required" }, { status: 400 });
  }

  const claim = await claimVaultGenerationJob(jobId);
  if (!claim.ok || !claim.job?.meta) {
    // Not an error state — already completed / fresh claim / not ours.
    return NextResponse.json({ ok: false, skipped: true, reason: claim.reason }, { status: 200 });
  }
  const meta = claim.job.meta;
  const runContext = { customer_email: meta.customer_email, order_id: meta.order_id ?? null, job_id: jobId };
  console.log(`[vault-bridge/process] started job=${jobId} candidates=${meta.candidates.length}`);

  const onboardingData: OnboardingData = {
    company_name: "LeadLens Vault Report",
    company_description: (meta.criteria.target_market as string | null) ?? "B2B account intelligence",
    offer_description: (meta.criteria.target_market as string | null) ?? "B2B services",
    value_proposition: (meta.criteria.icp_notes as string | null) ?? "Account-level opportunity intelligence from verified public signals.",
    target_customer_description: [meta.criteria.icp_notes, meta.criteria.industry, meta.criteria.region, meta.criteria.country].filter(Boolean).join(" · ") || "B2B accounts with recent buying signals",
    tone: "consultative",
    contact_email: meta.customer_email,
  };

  try {
    const { runLeadLensPipeline } = await import("@/lib/pipeline");
    const report = await runLeadLensPipeline({
      onboardingData,
      plan: meta.plan as PlanType,
      jobId,
      searchId: meta.search_id ?? undefined,
      candidatesOverride: meta.candidates,
    });

    // Vault selection funnel → executive report intelligence (aggregates only —
    // reason keys and counts; rejected company names never reach the report).
    if (meta.selection_stats) {
      report.report_intelligence = {
        ...(report.report_intelligence ?? { companies_considered: 0, companies_selected: 0, companies_rejected: 0, rejection_reasons: {} }),
        companies_considered: meta.selection_stats.total_considered,
        companies_selected: report.total_leads,
        companies_rejected: Math.max(meta.selection_stats.total_considered - meta.selection_stats.selected, 0),
        rejection_reasons: meta.selection_stats.rejection_reasons,
        signals_analyzed: meta.selection_stats.total_considered,
        source_mode: "vault",
      };
    }

    // Usage first would risk usage-without-report; persist the report, then
    // record usage. If usage write fails we log loudly but keep the report.
    const persisted = await completeVaultGenerationJob(jobId, report, meta, 0);
    if (!persisted) throw new Error("Report persistence failed — snapshot could not be saved.");

    const usageRecorded = await recordVaultOpportunitiesUsed(meta.vault_company_ids, runContext);
    if (usageRecorded < meta.vault_company_ids.length) {
      console.error(`[vault-bridge/process] usage under-recorded job=${jobId}: ${usageRecorded}/${meta.vault_company_ids.length}`);
    }
    await completeVaultGenerationJob(jobId, report, meta, usageRecorded); // refresh marker with final count

    // Workspace notification — best-effort, only when the report is linked to
    // a monitor (search_id → owner). Customer-safe copy, no internal details.
    if (meta.search_id) {
      try {
        const { createServerClient } = await import("@/lib/supabase/server");
        const db = createServerClient();
        const { data: search } = db
          ? await db.from("lead_searches").select("user_id, name").eq("id", meta.search_id).maybeSingle()
          : { data: null };
        if (db && search?.user_id) {
          const { createNotification } = await import("@/lib/notifications/create-notification");
          await createNotification(db, {
            userId: search.user_id,
            type: "search_completed",
            title: "Your report is ready",
            message: `A new opportunity report for “${search.name ?? "your monitor"}” is ready to review.`,
            metadata: { job_id: jobId, report_url: `/results/${jobId}` },
          });
        }
      } catch { /* notifications never block delivery */ }
    }

    console.log(`[vault-bridge/process] completed job=${jobId} leads=${report.total_leads} usage=${usageRecorded}`);
    return NextResponse.json({ ok: true, job_id: jobId, lead_count: report.total_leads, usage_recorded: usageRecorded });
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 200) : "Vault report generation failed";
    console.error(`[vault-bridge/process] failed job=${jobId}:`, reason);
    const released = await releaseVaultReservationsForFailedRun(runContext).catch(() => 0);
    await failVaultGenerationJob(jobId, meta, reason, released);
    return NextResponse.json({ ok: false, job_id: jobId, error: reason, reservations_released: released }, { status: 500 });
  }
}
