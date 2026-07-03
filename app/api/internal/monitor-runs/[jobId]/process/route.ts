import { NextRequest, NextResponse } from "next/server";
import { runLeadLensPipeline } from "@/lib/pipeline";
import { completeSnapshot, failSnapshot, getSnapshot } from "@/lib/storage/snapshot-store";
import { fetchOnboardingDataForSearch, normalizeRunPlan } from "@/lib/monitor/run-jobs";
import { recordMonitorRunUsage } from "@/lib/usage/usage-events";

// ── POST /api/internal/monitor-runs/[jobId]/process ───────────────────────────
// Internal processor: executes the pipeline for an EXISTING processing
// snapshot. Called fire-and-forget by the run routes, by admin retry, and by
// the future scheduler. Never exposed to customers.
//
// Auth (fail closed in production):
//   x-internal-secret must equal INTERNAL_RUN_SECRET, falling back to
//   ADMIN_SECRET_TOKEN when INTERNAL_RUN_SECRET is unset. If neither env var
//   exists: production rejects everything; development allows with a warning
//   (same convention as requireAdmin). The jobId is never the protection.
//
// Job preconditions:
//   - snapshot exists and status === "processing" (any age — retrying a stale
//     job is exactly this route's purpose)
//   - snapshot.search_id present (unscoped legacy jobs are never processed)
//   - onboarding_requests linkage present (else the job is failed, not stuck)
//
// Authorization model: the processing snapshot IS the authorization token —
// it only exists because a route already ran auth/ownership/entitlement.
// This route re-validates job integrity, not customer entitlement.

export const maxDuration = 300;

function checkInternalAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.INTERNAL_RUN_SECRET || process.env.ADMIN_SECRET_TOKEN;
  const provided = req.headers.get("x-internal-secret");

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[internal/process] no INTERNAL_RUN_SECRET or ADMIN_SECRET_TOKEN set — rejecting in production");
      return NextResponse.json({ error: "Internal processing not configured." }, { status: 403 });
    }
    console.warn("[internal/process] no internal secret configured — allowing in development");
    return null;
  }

  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function POST(
  req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const deny = checkInternalAuth(req);
  if (deny) return deny;

  const jobId = params.jobId;
  if (!jobId || jobId.length > 200) {
    return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
  }

  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  // ── Job integrity checks ────────────────────────────────────────────────────
  const snapshot = await getSnapshot(jobId);
  if (!snapshot) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }
  if (snapshot.status !== "processing") {
    // Completed/failed jobs are never re-executed here — retry of a failed job
    // creates a NEW job (see admin retry route).
    return NextResponse.json(
      { job_id: jobId, status: snapshot.status, error: "Job is not in processing state." },
      { status: 409 },
    );
  }
  if (!snapshot.search_id) {
    return NextResponse.json(
      { job_id: jobId, error: "Job has no search scope — unscoped jobs are not processable." },
      { status: 422 },
    );
  }

  const searchId = snapshot.search_id;
  const plan = normalizeRunPlan(snapshot.plan);

  const { data: search } = await db
    .from("lead_searches")
    .select("id")
    .eq("id", searchId)
    .single();

  if (!search) {
    await failSnapshot(jobId, plan, "Linked search no longer exists", searchId).catch(() => {});
    return NextResponse.json({ job_id: jobId, search_id: searchId, status: "failed", error: "Linked search not found." }, { status: 422 });
  }

  const onboardingData = await fetchOnboardingDataForSearch(db, searchId);
  if (!onboardingData) {
    await failSnapshot(jobId, plan, "Onboarding linkage missing at processing time", searchId).catch(() => {});
    return NextResponse.json({ job_id: jobId, search_id: searchId, status: "failed", error: "Setup incomplete." }, { status: 422 });
  }

  // ── Execute ─────────────────────────────────────────────────────────────────
  console.log(`[internal/process] starting job=${jobId} search=${searchId} plan=${plan}`);
  try {
    const report = await runLeadLensPipeline({ onboardingData, plan, jobId, searchId });
    await completeSnapshot(jobId, plan, report, searchId);
    console.log(`[internal/process] completed job=${jobId} hot=${report.hot_count} total=${report.total_leads}`);
    // Soft usage tracking — no deduction (see lib/usage/usage-events.ts).
    // initiated_by is unknown at processor level in v0; recorded as "customer"
    // until jobs carry an initiator field.
    recordMonitorRunUsage({ job_id: jobId, search_id: searchId, plan, initiated_by: "customer", outcome: "completed" });
    return NextResponse.json({
      job_id: jobId,
      search_id: searchId,
      status: "completed",
      hot_count: report.hot_count,
      total_leads: report.total_leads,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 200) : "Pipeline error";
    console.error(`[internal/process] failed job=${jobId}:`, reason);
    await failSnapshot(jobId, plan, reason, searchId).catch(() => {});
    recordMonitorRunUsage({ job_id: jobId, search_id: searchId, plan, initiated_by: "customer", outcome: "failed" });
    return NextResponse.json({ job_id: jobId, search_id: searchId, status: "failed", error: reason }, { status: 500 });
  }
}
