import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getVaultGenerationJob } from "@/lib/storage/vault-generation-store";
import { releaseVaultReservationsForFailedRun } from "@/lib/storage/vault-store";
import { isProcessingFresh } from "@/lib/storage/snapshot-store";

// POST /api/admin/vault-report-bridge/runs/[jobId]/release-reservations
// Manual reservation release for failed/stuck jobs. Refuses fresh processing
// jobs (the processor may still be running) — completed jobs are allowed
// (their 24h reservations are redundant with recorded usage).
export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const job = await getVaultGenerationJob(params.jobId);
  if (!job) return NextResponse.json({ error: "Generation job not found." }, { status: 404 });
  if (job.status === "processing" && isProcessingFresh(job.created_at)) {
    return NextResponse.json({ error: "Job is fresh and processing — releasing now could free companies mid-generation." }, { status: 409 });
  }

  const released = await releaseVaultReservationsForFailedRun({
    customer_email: job.meta?.customer_email ?? null, order_id: job.meta?.order_id ?? null, job_id: params.jobId,
  }).catch(() => 0);
  return NextResponse.json({ ok: true, job_id: params.jobId, reservations_released: released });
}
