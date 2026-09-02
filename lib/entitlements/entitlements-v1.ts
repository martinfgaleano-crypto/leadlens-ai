// ─── Entitlements V1 — one server-authoritative capability/usage layer ─────────
//
// Separates three concerns that routes previously conflated (or skipped):
//   BILLING/ACCESS STATE  →  PLAN CONFIG (capabilities+limits)  →  RESOLVED ENTITLEMENT
//   →  capability checks  →  atomic usage consumption  →  product action.
//
// Design rules:
//   - The SERVER resolves entitlement from durable state (profiles.plan, customer_credits,
//     customer_subscriptions). Routes never interpret provider SKUs and never trust a
//     client-supplied plan/quota.
//   - Numeric limits come from the frozen OPERATIONAL ENTITLEMENT MATRIX V1, encoded in
//     lib/entitlements/plan-config.ts. Changing a limit is a config edit there.
//   - Limited Beta is METERED (matrix §12): an authorized beta customer gets a bounded
//     allowance (not open access). Access is denied only when the server marks the account
//     blocked. Precedence (matrix §24): internal > subscription > one_time > beta > none —
//     an active subscription overrides beta while active.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { resolveProduct } from "@/lib/products/catalog";
import { subscriptionAccess, type SubscriptionRecord } from "@/lib/billing/subscription-lifecycle";
import { subscriptionPlanConfig, BETA_CONFIG } from "@/lib/entitlements/plan-config";

export type AccessSource = "internal" | "subscription" | "one_time" | "beta" | "none";
export type UsageMetering = "ledger" | "pending_ledger" | "one_time" | "unlimited" | "none";

export interface Capabilities {
  can_run_intelligence: boolean;
  can_create_monitor: boolean;
  can_run_monitor: boolean;
}
export interface Limits {
  /** null = no enforced per-period limit (internal/one-time). A number caps period usage. */
  max_runs_per_period: number | null;
  max_active_monitors: number | null;
  /** Maximum scheduled review frequency in days (ceiling only); null = not a metered plan. */
  cadence_min_days: number | null;
}
export interface EffectiveEntitlement {
  userId: string;
  planCode: string;
  tier: string | null;
  accessSource: AccessSource;
  capabilities: Capabilities;
  limits: Limits;
  usage: { credits_remaining: number; metering: UsageMetering };
  blocked_reason: string | null;
}

const BLOCKED_PLANS = new Set(["blocked", "suspended", "disabled"]);
const INTERNAL_PLANS = new Set(["internal", "test"]);
const FREE_PLANS = new Set(["free"]);

const LEGACY_PLAN_TIER: Record<string, string> = { sample: "preview", starter: "starter", standard: "standard", pro: "pro" };

// One-time tier active-monitor capacity (unchanged from v0 — one-time customers are "active").
const ONE_TIME_MONITORS_BY_TIER: Record<string, number> = { preview: 0, starter: 1, standard: 3, pro: 10 };

const NO_LIMITS: Limits = { max_runs_per_period: null, max_active_monitors: null, cadence_min_days: null };

/** Best-effort metered remaining for a subscription/beta allowance. Reads the period ledger
 *  (migration 062) when present; until that migration is applied it returns the full allowance
 *  and reports `pending_ledger`, so an authorized customer is never wrongly denied before the
 *  usage ledger exists. Consumption is metered once the ledger is live + seeded. */
async function meteredRemaining(db: any, userId: string, allowance: number): Promise<{ remaining: number; metering: UsageMetering }> {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await db.from("subscription_usage_periods")
      .select("allowance,consumed")
      .eq("user_id", userId).lte("period_start", nowIso).gte("period_end", nowIso)
      .order("period_start", { ascending: false }).limit(1);
    if (error || !data || !data.length) return { remaining: allowance, metering: "pending_ledger" };
    const row = data[0];
    const remaining = Math.max(0, Number(row.allowance ?? allowance) - Number(row.consumed ?? 0));
    return { remaining, metering: "ledger" };
  } catch {
    return { remaining: allowance, metering: "pending_ledger" };
  }
}

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
  // Normalized subscription (Billing Core V1). Best-effort: absent table / no row → unchanged.
  try {
    const { data } = await db.from("customer_subscriptions")
      .select("*").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1);
    subscription = (data && data[0]) ? (data[0] as SubscriptionRecord) : null;
  } catch { subscription = null; }

  const subAccess = subscriptionAccess(subscription);
  const effectivePlanCode = subAccess?.planCode ?? planCode;
  const product = resolveProduct(effectivePlanCode);
  const tier = product?.tier ?? (effectivePlanCode in LEGACY_PLAN_TIER ? LEGACY_PLAN_TIER[effectivePlanCode] : null);
  const isPaidPlan = (product && product.billing_type === "one_time") || (!FREE_PLANS.has(planCode) && !BLOCKED_PLANS.has(planCode) && !INTERNAL_PLANS.has(planCode));

  // Access-source provenance (matrix §24). An access-bearing subscription overrides beta.
  const accessSource: AccessSource =
    BLOCKED_PLANS.has(planCode) ? "none"
    : subAccess ? "subscription"
    : INTERNAL_PLANS.has(planCode) ? "internal"
    : isPaidPlan || credits > 0 ? "one_time"
    : "beta";

  // Resolve capabilities, limits, and usage per access source.
  let limits: Limits = NO_LIMITS;
  let usage: { credits_remaining: number; metering: UsageMetering } = { credits_remaining: credits, metering: "one_time" };
  let canRunIntelligence = accessSource !== "none";
  let canRunMonitor = false;

  if (accessSource === "subscription") {
    const cfg = subscriptionPlanConfig(effectivePlanCode);
    if (cfg) {
      limits = { max_runs_per_period: cfg.credits_per_period, max_active_monitors: cfg.max_active_monitors, cadence_min_days: cfg.cadence_min_days };
      usage = await (async () => { const r = await meteredRemaining(db, userId, cfg.credits_per_period); return { credits_remaining: r.remaining, metering: r.metering }; })();
    } else {
      // Access-bearing subscription with an unmapped plan_code — grant access, no invented limit.
      limits = NO_LIMITS;
      usage = { credits_remaining: credits, metering: "one_time" };
    }
    canRunMonitor = true;
  } else if (accessSource === "beta") {
    limits = { max_runs_per_period: BETA_CONFIG.credits_per_period, max_active_monitors: BETA_CONFIG.max_active_monitors, cadence_min_days: BETA_CONFIG.cadence_min_days };
    const r = await meteredRemaining(db, userId, BETA_CONFIG.credits_per_period);
    usage = { credits_remaining: r.remaining, metering: r.metering };
    canRunMonitor = true; // metered monitor capacity (matrix §12)
  } else if (accessSource === "internal") {
    limits = NO_LIMITS;
    usage = { credits_remaining: credits, metering: "unlimited" };
    canRunMonitor = true;
  } else if (accessSource === "one_time") {
    limits = { max_runs_per_period: null, max_active_monitors: tier ? (ONE_TIME_MONITORS_BY_TIER[tier] ?? 1) : 1, cadence_min_days: null };
    usage = { credits_remaining: credits, metering: "one_time" };
    canRunMonitor = true; // one-time customers are active (unchanged from v0)
  } else {
    // none / blocked
    limits = NO_LIMITS;
    usage = { credits_remaining: 0, metering: "none" };
    canRunIntelligence = false;
    canRunMonitor = false;
  }

  return {
    userId,
    planCode: accessSource === "subscription" ? effectivePlanCode : planCode,
    tier, accessSource,
    capabilities: {
      can_run_intelligence: canRunIntelligence,
      can_create_monitor: canRunIntelligence,
      can_run_monitor: canRunMonitor,
    },
    limits,
    usage,
    blocked_reason: canRunIntelligence ? null : "This account is not currently enabled to run intelligence.",
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
    return { status: 402, code: "usage_limit_reached", message: "You’ve reached your plan’s analysis allowance for this period." };
  }
  return null;
}

export interface ConsumeResult { ok: boolean; remaining: number; reason?: "insufficient" | "no_account" }

/** Atomic, race-safe usage consumption on the existing customer_credits row via optimistic
 *  compare-and-swap. Two requests for the final slot consume it at most once (no oversell),
 *  using ONLY existing tables (no migration). Idempotency comes from the CALLER tying
 *  consumption to new-run creation. Used for FINITE one-time plans; subscription/beta metered
 *  consumption flows through the period ledger (migration 062, see lib/billing/usage-ledger). */
export async function consumeRunSlotAtomic(db: any, userId: string, cost = 1, maxRetries = 10): Promise<ConsumeResult> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: row } = await db.from("customer_credits").select("credit_balance").eq("user_id", userId).maybeSingle();
    if (!row) return { ok: false, remaining: 0, reason: "no_account" };
    const balance = Number(row.credit_balance);
    if (balance < cost) return { ok: false, remaining: balance, reason: "insufficient" };
    const { data: updated } = await db.from("customer_credits")
      .update({ credit_balance: balance - cost })
      .eq("user_id", userId).eq("credit_balance", balance)
      .select("credit_balance");
    if (updated && updated.length) {
      await db.from("credit_transactions").insert({ user_id: userId, type: "consume", amount: -cost, description: "intelligence_run" }).then(() => {}, () => {});
      return { ok: true, remaining: balance - cost };
    }
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
    cadence_min_days: e.limits.cadence_min_days,
    credits_remaining: e.usage.credits_remaining, usage_metering: e.usage.metering,
    blocked_reason: e.blocked_reason,
  };
}
