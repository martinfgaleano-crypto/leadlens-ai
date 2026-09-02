// ─── Entitlements V1 — one server-authoritative capability/usage layer ─────────
//
// Separates three concerns that routes previously conflated (or skipped):
//   BILLING/ACCESS STATE  →  PLAN CONFIG (capabilities+limits)  →  RESOLVED ENTITLEMENT
//   →  capability checks  →  atomic usage consumption  →  product action.
//
// Design rules:
//   - The SERVER resolves entitlement from durable state (profiles.plan, customer_credits,
//     and — when billing lands — a normalized subscription). Routes never interpret provider
//     SKUs and never trust a client-supplied plan/quota.
//   - Numeric limits are internal config, NOT prices. Pricing owns the real numbers; changing
//     a limit is a config edit here, never a route rewrite.
//   - Limited Beta stays open: an authenticated customer with no paid product resolves to the
//     `beta` access source (can_run_intelligence = true). Access is denied ONLY when the server
//     explicitly marks the account blocked — so this adds authority + a denial seam without
//     locking out current beta users or breaking Customer Activation V1.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { resolveProduct } from "@/lib/products/catalog";
import { subscriptionAccess, type SubscriptionRecord } from "@/lib/billing/subscription-lifecycle";

export type AccessSource = "internal" | "subscription" | "one_time" | "beta" | "none";

export interface Capabilities {
  can_run_intelligence: boolean;
  can_create_monitor: boolean;
  can_run_monitor: boolean;
}
export interface Limits {
  /** null = no enforced limit (beta/unlimited). A number caps period usage (finite plans). */
  max_runs_per_period: number | null;
  max_active_monitors: number | null;
}
export interface EffectiveEntitlement {
  userId: string;
  planCode: string;
  tier: string | null;
  accessSource: AccessSource;
  capabilities: Capabilities;
  limits: Limits;
  usage: { credits_remaining: number };
  blocked_reason: string | null;
}

// Capability/limit profiles keyed by the internal plan code. Values reflect current product
// truth (all one-time today; beta open, unlimited). Finite `max_runs_per_period` is the seam
// subscriptions will populate — deliberately null now so no invented limit is enforced.
const BLOCKED_PLANS = new Set(["blocked", "suspended", "disabled"]);
const INTERNAL_PLANS = new Set(["internal", "test"]);
const FREE_PLANS = new Set(["free"]);

const LEGACY_PLAN_TIER: Record<string, string> = { sample: "preview", starter: "starter", standard: "standard", pro: "pro" };

const PROFILE_BY_TIER: Record<string, { limits: Limits }> = {
  preview: { limits: { max_runs_per_period: null, max_active_monitors: 0 } },
  starter: { limits: { max_runs_per_period: null, max_active_monitors: 1 } },
  standard: { limits: { max_runs_per_period: null, max_active_monitors: 3 } },
  pro: { limits: { max_runs_per_period: null, max_active_monitors: 10 } },
};

/** ONE canonical resolver. Reads durable state only; never trusts the client. */
export async function resolveEntitlements(db: any, userId: string): Promise<EffectiveEntitlement> {
  let planCode = "free";
  let credits = 0;
  let subscription: SubscriptionRecord | null = null;
  try {
    const [{ data: profile }, { data: creditRow }] = await Promise.all([
      db.from("profiles").select("plan").eq("id", userId).maybeSingle(),
      db.from("customer_credits").select("credit_balance").eq("user_id", userId).maybeSingle(),
    ]);
    if (profile?.plan) planCode = String(profile.plan);
    if (creditRow?.credit_balance != null) credits = Number(creditRow.credit_balance) || 0;
  } catch { /* fail closed below: unknown state → beta-open is NOT granted to a blocked plan */ }
  // Normalized subscription state (Billing Core V1). Best-effort: absent table (migration 061 not
  // yet applied) or no row → unchanged behavior. The most recently updated row wins.
  try {
    const { data } = await db.from("customer_subscriptions")
      .select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1);
    subscription = (data && data[0]) ? (data[0] as SubscriptionRecord) : null;
  } catch { subscription = null; }

  // profiles.plan holds a legacy plan name (free|sample|starter|standard|pro); product_codes
  // (preview_launch_v0…) may also appear for newer orders. Resolve either.
  const subAccess = subscriptionAccess(subscription);
  const effectivePlanCode = subAccess?.planCode ?? planCode;
  const product = resolveProduct(effectivePlanCode);
  const tier = product?.tier ?? (effectivePlanCode in LEGACY_PLAN_TIER ? LEGACY_PLAN_TIER[effectivePlanCode] : null);
  const isPaidPlan = (product && product.billing_type === "one_time") || (!FREE_PLANS.has(planCode) && !BLOCKED_PLANS.has(planCode) && !INTERNAL_PLANS.has(planCode));

  // Access source provenance (server-authoritative). An access-bearing subscription wins.
  const accessSource: AccessSource =
    BLOCKED_PLANS.has(planCode) ? "none"           // an explicit block overrides everything
    : subAccess ? "subscription"                    // billing → entitlement sync
    : INTERNAL_PLANS.has(planCode) ? "internal"
    : isPaidPlan || credits > 0 ? "one_time"       // a non-free plan or positive credits = active customer
    : "beta";                                       // authenticated free customer → Limited Beta (open)

  const allowed = accessSource !== "none";
  // "Active" = a real access source (paid one-time / subscription / internal). Beta is open for
  // Intelligence runs but — matching pre-existing behavior — NOT for recurring Monitor runs.
  const activeCustomer = (["one_time", "subscription", "internal"] as AccessSource[]).includes(accessSource);
  const limits = (tier ? PROFILE_BY_TIER[tier]?.limits : undefined) ?? { max_runs_per_period: null, max_active_monitors: activeCustomer ? 1 : 0 };

  return {
    userId, planCode: accessSource === "subscription" ? effectivePlanCode : planCode, tier, accessSource,
    capabilities: {
      can_run_intelligence: allowed,       // Limited Beta: open to any authenticated, non-blocked account
      can_create_monitor: allowed,         // creation is cheap/self-serve (unchanged)
      can_run_monitor: activeCustomer, // recurring runs stay active-customer-only (unchanged from v0)
    },
    limits,
    usage: { credits_remaining: credits },
    blocked_reason: allowed ? null : "This account is not currently enabled to run intelligence.",
  };
}

export type DenialCode = "authentication_required" | "access_not_enabled" | "usage_limit_reached" | "feature_unavailable";
export interface EntitlementDenial { status: number; code: DenialCode; message: string }

/** Capability gate for the primary Intelligence run. Returns null when allowed, else a
 *  customer-safe denial (no DB fields, provider data, or internal calc surfaced). */
export function intelligenceRunGate(e: EffectiveEntitlement): EntitlementDenial | null {
  if (!e.capabilities.can_run_intelligence) {
    return { status: 403, code: "access_not_enabled", message: "Your account isn’t enabled to run intelligence yet." };
  }
  if (e.limits.max_runs_per_period !== null && e.usage.credits_remaining <= 0) {
    return { status: 402, code: "usage_limit_reached", message: "You’ve reached your run allowance for this period." };
  }
  return null;
}

export interface ConsumeResult { ok: boolean; remaining: number; reason?: "insufficient" | "no_account" }

/** Atomic, race-safe usage consumption on the existing customer_credits row via optimistic
 *  compare-and-swap: read the balance, then UPDATE …SET credit_balance = balance-cost WHERE
 *  credit_balance = <the value we read>. Postgres serializes the row, so if a concurrent request
 *  moved the balance our predicate misses (0 rows) and we retry with the new value. Two requests
 *  for the final slot therefore consume it at most once — no oversell — using ONLY existing tables
 *  (no migration). Idempotency comes from the CALLER tying consumption to new-run creation (a
 *  replay reuses the run and never reaches here). Only invoked for finite plans. */
export async function consumeRunSlotAtomic(db: any, userId: string, cost = 1, maxRetries = 10): Promise<ConsumeResult> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: row } = await db.from("customer_credits").select("credit_balance").eq("user_id", userId).maybeSingle();
    if (!row) return { ok: false, remaining: 0, reason: "no_account" };
    const balance = Number(row.credit_balance);
    if (balance < cost) return { ok: false, remaining: balance, reason: "insufficient" };
    const { data: updated } = await db.from("customer_credits")
      .update({ credit_balance: balance - cost })
      .eq("user_id", userId).eq("credit_balance", balance)   // CAS: only if unchanged since read
      .select("credit_balance");
    if (updated && updated.length) {
      await db.from("credit_transactions").insert({ user_id: userId, type: "consume", amount: -cost, description: "intelligence_run" }).then(() => {}, () => {});
      return { ok: true, remaining: balance - cost };
    }
    // CAS lost to a concurrent writer — retry with the fresh balance.
  }
  return { ok: false, remaining: 0, reason: "insufficient" };
}

/** Operator/support-safe projection — resolved access, capabilities, usage. No secrets/provider data. */
export function entitlementSupportView(e: EffectiveEntitlement) {
  return {
    plan: e.planCode, tier: e.tier, access_source: e.accessSource,
    can_run_intelligence: e.capabilities.can_run_intelligence,
    can_run_monitor: e.capabilities.can_run_monitor,
    max_runs_per_period: e.limits.max_runs_per_period, max_active_monitors: e.limits.max_active_monitors,
    credits_remaining: e.usage.credits_remaining, blocked_reason: e.blocked_reason,
  };
}
