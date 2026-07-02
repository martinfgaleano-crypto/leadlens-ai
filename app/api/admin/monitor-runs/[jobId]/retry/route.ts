import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getSnapshot, isProcessingFresh } from "@/lib/storage/snapshot-store";
import { createMonitorRunJob, normalizeRunPlan, triggerProcessor } from "@/lib/monitor/run-jobs";

// ── POST /api/admin/monitor-runs/[jobId]/retry ────────────────────────────────
// Admin recovery for failed or stale monitor runs.
//
//   processing + fresh → 409 (still running — nothing to recover)
//   processing + stale → re-trigger the internal processor on the SAME job
//                        (the worker died or the trigger was lost; the job is
//                        still in a processable state)
//   failed             → create a NEW job for the same search_id via the shared
//                        creator (dedup applies) and trigger it
//   completed          → 409 (never re-executed)
//
// Scope safety: only jobs with search_id are recoverable — unscoped legacy
// jobs are rejected, same rule as the processor itself.

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const jobId = params.jobId;
  if (!jobId || jobId.length > 200) {
    return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
  }

  const snapshot = await getSnapshot(jobId);
  if (!snapshot) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  if (!snapshot.search_id) {
    return NextResponse.json(
      { error: "Job has no search scope — unscoped legacy jobs are not recoverable." },
      { status: 422 },
    );
  }

  if (snapshot.status === "completed") {
    return NextResponse.json({ error: "Job already completed — nothing to retry." }, { status: 409 });
  }

  if (snapshot.status === "processing") {
    if (isProcessingFresh(snapshot.created_at)) {
      return NextResponse.json({ error: "Job is still running — retry is available after the stale cutoff." }, { status: 409 });
    }
    // Never reprocess a stale job while a FRESH run is in flight for the same
    // series — two concurrent pipelines for one search must not race.
    const dbCheck = await getDb();
    if (!dbCheck) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
    const { processingCutoffIso } = await import("@/lib/storage/snapshot-store");
    const { data: freshRun } = await dbCheck
      .from("snapshot_reports")
      .select("job_id")
      .eq("search_id", snapshot.search_id)
      .eq("status", "processing")
      .gte("created_at", processingCutoffIso())
      .limit(1)
      .maybeSingle();
    if (freshRun) {
      return NextResponse.json(
        { error: `A newer run is already in progress (job_id: ${(freshRun as { job_id: string }).job_id}).` },
        { status: 409 },
      );
    }
    // Stale: re-process the same job. The processor accepts processing rows of
    // any age; completeSnapshot/failSnapshot upsert on job_id.
    triggerProcessor(jobId);
    return NextResponse.json(
      { job_id: jobId, search_id: snapshot.search_id, action: "reprocessing", status: "processing", message: "Stale job re-sent to the processor." },
      { status: 202 },
    );
  }

  // Failed → new job for the same series.
  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const job = await createMonitorRunJob(db, {
    searchId: snapshot.search_id,
    plan: normalizeRunPlan(snapshot.plan),
  });

  if (!job.ok) {
    if (job.code === "duplicate") {
      return NextResponse.json(
        { error: `Another run is already in progress (job_id: ${job.inflight_job_id}).` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "The retry could not be started." }, { status: 500 });
  }

  triggerProcessor(job.job_id);
  return NextResponse.json(
    { job_id: job.job_id, search_id: snapshot.search_id, action: "new_run", status: "processing", is_baseline: job.is_baseline, message: "New run started for this monitor." },
    { status: 202 },
  );
}
