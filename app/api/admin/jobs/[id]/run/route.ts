import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getSaasJobById,
  getIntakeByOrderId,
  updateSaasJob,
  createReport,
  addJobEvent,
  updateOrderStatus,
} from "@/lib/storage/saas-store";
import { runLeadLensPipeline } from "@/lib/pipeline";
import { exportToCSV, exportToMarkdown } from "@/lib/utils/export";

/**
 * POST /api/admin/jobs/[id]/run
 * Triggers the LeadLens pipeline for a persisted job.
 * Requires Supabase + intake to be present.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  // ── Supabase guard ─────────────────────────────────────────────────────────
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  // ── Load job ───────────────────────────────────────────────────────────────
  const job = await getSaasJobById(params.id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  if (job.status === "processing") {
    return NextResponse.json({ error: "Job is already running" }, { status: 409 });
  }

  if (job.status === "completed" || job.status === "delivered") {
    return NextResponse.json({ error: `Job already ${job.status}` }, { status: 409 });
  }

  // ── Load intake ────────────────────────────────────────────────────────────
  const intake = await getIntakeByOrderId(job.order_id);
  if (!intake) {
    return NextResponse.json(
      { error: "No intake found for this job. Submit customer intake first." },
      { status: 422 }
    );
  }

  // ── Mark processing ────────────────────────────────────────────────────────
  await updateSaasJob(params.id, {
    status:     "processing",
    started_at: new Date().toISOString(),
    progress:   5,
  });

  await addJobEvent({
    job_id:     params.id,
    order_id:   job.order_id,
    event_type: "pipeline_started",
    message:    `Pipeline started for plan=${job.plan}`,
  });

  // ── Run pipeline ───────────────────────────────────────────────────────────
  let report;
  try {
    report = await runLeadLensPipeline({
      onboardingData: intake.onboarding_data,
      plan:           job.plan,
      jobId:          params.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[admin/run] Pipeline failed for job ${params.id}:`, msg);

    await updateSaasJob(params.id, {
      status:        "error",
      error_message: msg.slice(0, 500),
    });

    await addJobEvent({
      job_id:     params.id,
      order_id:   job.order_id,
      event_type: "error",
      message:    msg.slice(0, 500),
    });

    return NextResponse.json({ error: "Pipeline failed", details: msg.slice(0, 200) }, { status: 500 });
  }

  // ── Generate exports ───────────────────────────────────────────────────────
  const csvContent = exportToCSV(report);
  const mdContent  = exportToMarkdown(report);

  // ── Store report ───────────────────────────────────────────────────────────
  const storedReport = await createReport({
    job_id:           params.id,
    order_id:         job.order_id,
    plan:             job.plan,
    lead_count:       report.total_leads,
    report_json:      report,
    csv_content:      csvContent,
    markdown_content: mdContent,
  });

  // ── Update job to completed ────────────────────────────────────────────────
  await updateSaasJob(params.id, {
    status:       "completed",
    progress:     100,
    report_id:    storedReport?.id ?? null,
    completed_at: new Date().toISOString(),
  });

  await updateOrderStatus(job.order_id, { delivery_status: "in_progress" });

  await addJobEvent({
    job_id:     params.id,
    order_id:   job.order_id,
    event_type: "pipeline_completed",
    message:    `Pipeline completed: ${report.total_leads} leads, hot=${report.hot_count}`,
    metadata:   {
      total_leads:  report.total_leads,
      hot_count:    report.hot_count,
      warm_count:   report.warm_count,
      avg_score:    report.avg_score,
      report_id:    storedReport?.id,
    },
  });

  console.log(`[admin/run] Job ${params.id} completed — ${report.total_leads} leads`);

  return NextResponse.json({
    success:    true,
    job_id:     params.id,
    report_id:  storedReport?.id ?? null,
    total_leads: report.total_leads,
    hot_count:   report.hot_count,
    warm_count:  report.warm_count,
    avg_score:   report.avg_score,
  });
}
