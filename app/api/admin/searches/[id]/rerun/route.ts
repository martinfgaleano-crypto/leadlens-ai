import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createMonitorRunJob, normalizeRunPlan, triggerProcessor } from "@/lib/monitor/run-jobs";

// ── POST /api/admin/searches/[id]/rerun ───────────────────────────────────────
// Manually triggers an AI pipeline run for an existing lead_searches.id as a
// Monthly Monitor run, scoped via search_id so snapshot history stays separated
// per series and previous-snapshot comparison is safe.
//
// Guards:
//   - Admin token required
//   - Dedup: rejects if status=processing snapshot already exists for search_id
//   - Onboarding data required: returns 422 if no onboarding_request found
//
// Returns: { success, job_id, search_id, is_baseline, message, stats }
//
// is_baseline = true when this is the first completed run for the series.
// Future runs will use this snapshot as the "previous" for change classification.

async function getDb() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

const uuidSchema = z.string().uuid();

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  if (!uuidSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid search ID." }, { status: 400 });
  }
  const searchId = params.id;

  const client = await getDb();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  // ── 1. Fetch lead_search ──────────────────────────────────────────────────

  const { data: search, error: searchErr } = await client
    .from("lead_searches")
    .select("id, user_id, name")
    .eq("id", searchId)
    .single();

  if (searchErr || !search) {
    return NextResponse.json({ error: "Search not found." }, { status: 404 });
  }

  // ── 2. Fetch plan from profile ────────────────────────────────────────────

  const { data: profile } = await client
    .from("profiles")
    .select("plan")
    .eq("id", search.user_id)
    .single();

  const plan = normalizeRunPlan(profile?.plan);

  // ── 3. Onboarding linkage guard (pipeline input is reconstructed by the
  //       internal processor at execution time) ────────────────────────────────

  const { count: onboardingCount } = await client
    .from("onboarding_requests")
    .select("id", { count: "exact", head: true })
    .eq("search_id", searchId);

  if ((onboardingCount ?? 0) === 0) {
    return NextResponse.json(
      { error: "No onboarding data found for this search. Cannot reconstruct pipeline input." },
      { status: 422 },
    );
  }

  // ── 4. Create job + return fast (async v0 — see ASYNC_RUN_EXECUTION.md) ────

  const job = await createMonitorRunJob(client, { searchId, plan });

  if (!job.ok) {
    if (job.code === "duplicate") {
      return NextResponse.json(
        { error: `A run is already in progress (job_id: ${job.inflight_job_id}). Wait for it to complete before starting another.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "The run could not be started." }, { status: 500 });
  }

  triggerProcessor(job.job_id);

  return NextResponse.json(
    {
      success:     true,
      job_id:      job.job_id,
      search_id:   searchId,
      status:      "processing",
      is_baseline: job.is_baseline,
      message: job.is_baseline
        ? "Baseline run started — processing. Run history will show completion."
        : "Run started — processing. Change classification will compare against the previous snapshot.",
    },
    { status: 202 },
  );
}
