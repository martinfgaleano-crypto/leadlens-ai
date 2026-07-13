import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getVaultGenerationJob } from "@/lib/storage/vault-generation-store";
import { releaseVaultReservationsForFailedRun } from "@/lib/storage/vault-store";
import { isProcessingFresh } from "@/lib/storage/snapshot-store";
import { queueVaultGeneration } from "@/lib/vault/vault-generation";

// POST /api/admin/vault-report-bridge/runs/[jobId]/retry
// Safe retry: never touches completed jobs; releases the failed/stale job's
// reservations, then queues a NEW generation from the stored criteria — a
// fresh selection re-validates approval/rights/suppression/usage from scratch
// (a retry must not resurrect opportunities that were blocked meanwhile).
export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const job = await getVaultGenerationJob(params.jobId);
  if (!job) return NextResponse.json({ error: "Generation job not found." }, { status: 404 });
  if (job.status === "completed") {
    return NextResponse.json({ error: "Job already completed — retrying would double-deliver and double-record usage." }, { status: 409 });
  }
  if (job.status === "processing" && isProcessingFresh(job.created_at)) {
    return NextResponse.json({ error: "Job is still fresh and processing — wait for it or for the stale cutoff." }, { status: 409 });
  }
  if (!job.meta) {
    return NextResponse.json({ error: "Job has no stored generation criteria — cannot retry safely." }, { status: 422 });
  }

  const released = await releaseVaultReservationsForFailedRun({
    customer_email: job.meta.customer_email, order_id: job.meta.order_id ?? null, job_id: params.jobId,
  }).catch(() => 0);

  const result = await queueVaultGeneration({
    ...(job.meta.criteria as Record<string, unknown>),
    customer_email: job.meta.customer_email,
    order_id: job.meta.order_id ?? undefined,
    search_id: job.meta.search_id ?? undefined,
    plan: job.meta.plan,
    retried_from: params.jobId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: `Retry selection failed: ${result.error}`, ...(result.details ?? {}), reservations_released: released }, { status: result.status });
  }
  return NextResponse.json({ ...result, retried_from: params.jobId, previous_reservations_released: released }, { status: 202 });
}
