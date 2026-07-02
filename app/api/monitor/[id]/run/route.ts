import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createProcessingSnapshot,
  completeSnapshot,
  failSnapshot,
} from "@/lib/storage/snapshot-store";
import { runLeadLensPipeline } from "@/lib/pipeline";
import { processingCutoffIso } from "@/lib/storage/snapshot-store";

// Pipeline runs take minutes — raise the serverless function limit where the
// hosting plan allows it (ignored/clamped otherwise).
export const maxDuration = 300;

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

  // ── Duplicate-run guard ─────────────────────────────────────────────────────
  // Stale processing rows (killed functions that never reached failSnapshot)
  // are ignored — otherwise one dead run would block the series forever.
  const { data: inflight } = await db
    .from("snapshot_reports")
    .select("job_id")
    .eq("search_id", searchId)
    .eq("status", "processing")
    .gte("created_at", processingCutoffIso())
    .limit(1)
    .maybeSingle();

  if (inflight) {
    return NextResponse.json(
      { error: "A run is already in progress for this monitor. Wait for it to finish." },
      { status: 409 },
    );
  }

  // ── Plan + baseline ─────────────────────────────────────────────────────────
  const validPlans = ["sample", "starter", "standard", "pro"] as const;
  type PlanType = typeof validPlans[number];
  const rawPlan = entitlement.plan_name ?? "starter";
  const plan: PlanType = (validPlans as readonly string[]).includes(rawPlan) ? (rawPlan as PlanType) : "starter";

  const { count: completedCount } = await db
    .from("snapshot_reports")
    .select("id", { count: "exact", head: true })
    .eq("search_id", searchId)
    .eq("status", "completed");

  const isBaseline = (completedCount ?? 0) === 0;

  const onboardingData = {
    company_name:                onboardingReq.company_name,
    company_description:         onboardingReq.what_you_sell,
    offer_description:           onboardingReq.what_you_sell,
    value_proposition:           onboardingReq.what_you_sell,
    target_customer_description: onboardingReq.ideal_customer ?? "Target customer not specified",
    tone:                        "direct" as const,
    contact_email:               onboardingReq.email,
  };

  // ── Run ─────────────────────────────────────────────────────────────────────
  const jobId = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  createProcessingSnapshot(jobId, plan, searchId).catch(() => {});

  try {
    const report = await runLeadLensPipeline({ onboardingData, plan, jobId, searchId });

    completeSnapshot(jobId, plan, report, searchId).catch(() => {});

    return NextResponse.json({
      success:     true,
      job_id:      jobId,
      search_id:   searchId,
      status:      "completed",
      is_baseline: isBaseline,
      readiness:   "report_ready",
      message: isBaseline
        ? "Baseline report ready. Your next run will show what changed."
        : "Report ready — compared against your previous report.",
    });

  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 200) : "Pipeline error";
    console.error("[monitor/run]", searchId, jobId, reason);
    await failSnapshot(jobId, plan, reason, searchId).catch(() => {});
    return NextResponse.json(
      { error: "The run could not be completed. Our team has visibility into failed runs.", job_id: jobId, status: "failed" },
      { status: 500 },
    );
  }
}
