import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createMonitorRunJob, normalizeRunPlan, triggerProcessor } from "@/lib/monitor/run-jobs";

// ── POST /api/monitor/[id]/run ────────────────────────────────────────────────
// Customer-triggered monitor run for THEIR OWN search series.
//
// Guards, in order:
//   1. Bearer <supabase JWT> required (same pattern as /api/credits).
//   2. Ownership: lead_searches.id = [id] AND user_id = caller. Foreign or
//      unknown searches → 404 (existence never confirmed).
//   3. Entitlement: caller must be an active customer (non-free plan or
//      positive credit balance). Blocked → 403 with upgrade copy.
//   4. Setup: onboarding_requests.search_id linkage required → 422 otherwise.
//   5. Dedup: an in-flight processing snapshot for this search_id → 409.
//
// The pipeline runs with searchId scope; snapshots carry search_id; the
// admin rerun route and one-off /api/process are untouched.

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
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!uuidSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: "Invalid monitor ID." }, { status: 400 });
  }
  const searchId = params.id;

  const db = await getDb();
  if (!db) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  // ── Ownership ───────────────────────────────────────────────────────────────
  const { data: search } = await db
    .from("lead_searches")
    .select("id, user_id, name")
    .eq("id", searchId)
    .eq("user_id", user.id)
    .single();

  if (!search) {
    return NextResponse.json({ error: "Monitor not found." }, { status: 404 });
  }

  // ── Entitlement (usage gate — no billing integration) ──────────────────────
  const { getEntitlements } = await import("@/lib/usage/entitlements");
  const entitlement = await getEntitlements(db, user.id);
  if (!entitlement.can_run_monitor) {
    return NextResponse.json(
      { error: entitlement.blocked_reason ?? "Your plan does not include monitor runs.", entitlement },
      { status: 403 },
    );
  }

  // ── Setup completeness ──────────────────────────────────────────────────────
  const { data: onboardingReq } = await db
    .from("onboarding_requests")
    .select("company_name, email, what_you_sell, ideal_customer")
    .eq("search_id", searchId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!onboardingReq) {
    return NextResponse.json(
      { error: "Monitor setup is incomplete — this search has no business context linked. Contact support to complete setup." },
      { status: 422 },
    );
  }

  // ── Create job + return fast (async v0 — see ASYNC_RUN_EXECUTION.md) ───────
  // The pipeline runs in the internal processor, not in this request. The UI
  // polls the runs endpoint / report status for completion.
  const plan = normalizeRunPlan(entitlement.plan_name);

  const job = await createMonitorRunJob(db, { searchId, plan });

  if (!job.ok) {
    if (job.code === "duplicate") {
      return NextResponse.json(
        { error: "A run is already in progress for this monitor. Wait for it to finish." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "The run could not be started. Please try again." },
      { status: 500 },
    );
  }

  triggerProcessor(job.job_id);

  return NextResponse.json(
    {
      success:     true,
      job_id:      job.job_id,
      search_id:   searchId,
      status:      "processing",
      is_baseline: job.is_baseline,
      readiness:   "processing",
      message: job.is_baseline
        ? "Your baseline report is being generated. This page will update when it's ready."
        : "Your report is being generated and will be compared against the previous one.",
    },
    { status: 202 },
  );
}
