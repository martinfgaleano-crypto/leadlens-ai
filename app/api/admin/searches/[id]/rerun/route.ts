import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  createProcessingSnapshot,
  completeSnapshot,
  failSnapshot,
} from "@/lib/storage/snapshot-store";
import { runLeadLensPipeline } from "@/lib/pipeline";

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

  const validPlans = ["sample", "starter", "standard", "pro"] as const;
  type PlanType = typeof validPlans[number];
  const rawPlan = profile?.plan ?? "starter";
  const plan: PlanType = validPlans.includes(rawPlan as PlanType) ? (rawPlan as PlanType) : "starter";

  // ── 3. Fetch onboarding data (required for pipeline input) ────────────────

  const { data: onboardingReq } = await client
    .from("onboarding_requests")
    .select("company_name, email, what_you_sell, ideal_customer")
    .eq("search_id", searchId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!onboardingReq) {
    return NextResponse.json(
      { error: "No onboarding data found for this search. Cannot reconstruct pipeline input." },
      { status: 422 },
    );
  }

  // ── 4. Dedup guard ────────────────────────────────────────────────────────

  const { data: inflight } = await client
    .from("snapshot_reports")
    .select("job_id, created_at")
    .eq("search_id", searchId)
    .eq("status", "processing")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (inflight) {
    return NextResponse.json(
      {
        error: `A run is already in progress (job_id: ${inflight.job_id}). Wait for it to complete before starting another.`,
      },
      { status: 409 },
    );
  }

  // ── 5. Baseline check ─────────────────────────────────────────────────────

  const { count: completedCount } = await client
    .from("snapshot_reports")
    .select("id", { count: "exact", head: true })
    .eq("search_id", searchId)
    .eq("status", "completed");

  const isBaseline = (completedCount ?? 0) === 0;

  // ── 6. Reconstruct OnboardingData from onboarding_request ─────────────────
  // onboarding_requests stores what_you_sell / ideal_customer as free-text
  // description fields. They map cleanly to the pipeline's offer/customer inputs.
  // company_description, value_proposition default to what_you_sell as best available.

  const onboardingData = {
    company_name:                onboardingReq.company_name,
    company_description:         onboardingReq.what_you_sell,
    offer_description:           onboardingReq.what_you_sell,
    value_proposition:           onboardingReq.what_you_sell,
    target_customer_description: onboardingReq.ideal_customer ?? "Target customer not specified",
    tone:                        "direct" as const,
    contact_email:               onboardingReq.email,
  };

  // ── 7. Generate jobId + kick off pipeline ─────────────────────────────────

  const jobId = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  createProcessingSnapshot(jobId, plan, searchId).catch(() => {});

  try {
    const report = await runLeadLensPipeline({ onboardingData, plan, jobId, searchId });

    completeSnapshot(jobId, plan, report, searchId).catch(() => {});

    return NextResponse.json({
      success: true,
      job_id:     jobId,
      search_id:  searchId,
      is_baseline: isBaseline,
      message: isBaseline
        ? "Baseline run complete. Future runs will compare against this snapshot."
        : "Run complete. Change classification active — compared against previous snapshot.",
      stats: {
        hot_count:   report.hot_count,
        warm_count:  report.warm_count,
        total_leads: report.total_leads,
        avg_score:   report.avg_score,
      },
    });

  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 200) : "Pipeline error";
    console.error("[rerun]", searchId, jobId, reason);
    await failSnapshot(jobId, plan, reason, searchId).catch(() => {});
    return NextResponse.json({ error: reason, job_id: jobId }, { status: 500 });
  }
}
