import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { resolveEntitlements } from "@/lib/entitlements/entitlements-v1";
import { subscriptionGrantsAccess, type SubscriptionRecord } from "@/lib/billing/subscription-lifecycle";
import { SUBSCRIPTION_PLANS } from "@/lib/entitlements/plan-config";

// ── GET /api/billing/state ────────────────────────────────────────────────────
// Customer-facing billing truth: current plan, status, interval, renew/cancel state, and the
// remaining analysis allowance — derived server-side from the same resolver the run path uses.
// No secrets, no provider payloads. Read-only.
export async function GET(req: NextRequest) {
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable" }, { status: 503 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const entitlement = await resolveEntitlements(db, user.id);

  let subscription: { status: string; billing_interval: string; current_period_end: string | null; cancel_at_period_end: boolean; grants_access: boolean } | null = null;
  try {
    const { data } = await db.from("customer_subscriptions").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1);
    const s = (data && data[0]) as SubscriptionRecord | undefined;
    if (s) subscription = { status: s.status, billing_interval: s.billing_interval, current_period_end: s.current_period_end, cancel_at_period_end: s.cancel_at_period_end, grants_access: subscriptionGrantsAccess(s) };
  } catch { subscription = null; }

  return NextResponse.json({
    access_source: entitlement.accessSource,
    plan: entitlement.planCode,
    can_run_intelligence: entitlement.capabilities.can_run_intelligence,
    credits_remaining: entitlement.usage.credits_remaining,
    usage_metering: entitlement.usage.metering,
    max_active_monitors: entitlement.limits.max_active_monitors,
    subscription,
    can_subscribe: entitlement.accessSource !== "subscription",
    available_plans: Object.values(SUBSCRIPTION_PLANS).map((p) => ({
      plan_code: p.plan_code, display_name: p.display_name,
      price_monthly: p.price_usd.month, price_annual: p.price_usd.year,
      credits_per_period: p.credits_per_period, max_active_monitors: p.max_active_monitors,
    })),
  });
}
