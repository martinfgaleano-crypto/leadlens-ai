import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServerClient } from "@/lib/supabase/server";
import { resolveEntitlements, entitlementSupportView } from "@/lib/entitlements/entitlements-v1";
import { planRecoveries, type StaleRunCandidate } from "@/lib/intelligence/run-recovery";
import { subscriptionGrantsAccess, type SubscriptionRecord } from "@/lib/billing/subscription-lifecycle";

// ── GET /api/admin/customer-lookup?email=…  |  ?user_id=… ─────────────────────
// One read-only operational truth surface so support can answer the normal questions —
// access source, entitlement, usage, recent runs + recovery state, subscription/billing
// state — WITHOUT raw-database archaeology. Admin-only; owner-scoped; no secrets, no
// provider payloads, no service-role data. Read-only (no write actions).
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable" }, { status: 503 });

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const userIdParam = req.nextUrl.searchParams.get("user_id")?.trim();
  let profile: { id: string; email: string | null; plan: string | null; onboarding_completed: boolean | null } | null = null;
  if (userIdParam) {
    profile = (await db.from("profiles").select("id,email,plan,onboarding_completed").eq("id", userIdParam).maybeSingle()).data as any;
  } else if (email) {
    profile = (await db.from("profiles").select("id,email,plan,onboarding_completed").ilike("email", email).limit(1).maybeSingle()).data as any;
  } else {
    return NextResponse.json({ error: "Provide ?email= or ?user_id=" }, { status: 400 });
  }
  if (!profile) return NextResponse.json({ found: false });

  const userId = profile.id;
  // Resolved entitlement (support-safe projection).
  const entitlement = entitlementSupportView(await resolveEntitlements(db, userId));

  // Recent Intelligence runs + recovery state (which are stuck / would be recovered).
  const runsRes = await db.from("snapshot_reports")
    .select("job_id,status,created_at,execution_generation,report_json")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
  const runRows = (runsRes.data ?? []).filter((r: { job_id: string }) => /^intel_[a-f0-9]{32}$/.test(r.job_id));
  const candidates: StaleRunCandidate[] = runRows.map((r: any) => ({
    runId: r.job_id, userId, status: r.status, createdAt: r.created_at,
    updatedAt: r.report_json?._intelligence_run?.updatedAt ?? null, executionGeneration: r.execution_generation ?? 0,
  }));
  const staleNow = new Set(planRecoveries(candidates, Date.now()).map((p) => p.candidate.runId));
  const runs = candidates.map((c) => ({
    run: c.runId.slice(0, 16), status: c.status, generation: c.executionGeneration,
    stale_recoverable: staleNow.has(c.runId),
  }));

  // Monitored work + subscription (best-effort; subscription table may be pending migration 061).
  const monitoredCount = ((await db.from("account_review_snapshots").select("account_id").eq("owner_user_id", userId)).data ?? [])
    .reduce((s: Set<string>, r: { account_id: string }) => s.add(r.account_id), new Set<string>()).size;
  let subscription: { status: string; plan_code: string; billing_interval: string; grants_access: boolean; cancel_at_period_end: boolean; current_period_end: string | null } | null = null;
  try {
    const { data } = await db.from("customer_subscriptions").select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1);
    const s = (data && data[0]) as SubscriptionRecord | undefined;
    if (s) subscription = { status: s.status, plan_code: s.plan_code, billing_interval: s.billing_interval, grants_access: subscriptionGrantsAccess(s), cancel_at_period_end: s.cancel_at_period_end, current_period_end: s.current_period_end };
  } catch { subscription = null; }

  // Billing/entitlement mismatch flags (support signal only — never auto-mutated).
  const flags: string[] = [];
  if (subscription && subscription.grants_access && !entitlement.can_run_intelligence) flags.push("subscription_active_but_entitlement_absent");
  if (subscription && !subscription.grants_access && entitlement.access_source === "subscription") flags.push("subscription_ended_but_entitlement_active");

  return NextResponse.json({
    found: true,
    customer: { user_id: userId, email: profile.email, activation_completed: profile.onboarding_completed ?? false },
    entitlement, usage: { credits_remaining: entitlement.credits_remaining },
    intelligence: { recent_runs: runs, stuck_recoverable: runs.filter((r) => r.stale_recoverable).length },
    monitor: { monitored_accounts: monitoredCount },
    billing: subscription,
    flags,
  });
}
