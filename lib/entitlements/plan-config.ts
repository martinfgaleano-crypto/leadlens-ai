// ─── SaaS V1 subscription plan configuration ──────────────────────────────────
//
// The frozen OPERATIONAL ENTITLEMENT MATRIX V1 (docs/PRICING_OPERATIONAL_ENTITLEMENT_MATRIX_V1.md)
// expressed as server-side config. This is the ONLY place plan economics live in
// code. Webhook, resolver, and checkout consume these values; none of them embed
// plan strategy. Changing a limit is a config edit here, never a route rewrite.
//
// Commercial usage unit (frozen §5/§6): 1 ACCOUNT INTELLIGENCE CREDIT = one account
// receiving a material analysis/re-analysis. `credits_per_period` is that allowance
// per MONTHLY entitlement period (annual plans refresh monthly — same numbers).
// `max_active_monitors` is the independent standing cap. `cadence_min_days` is the
// MAXIMUM review frequency (a ceiling, never a guarantee — canonical eligibility and
// available usage still govern whether a review actually runs).

export type SubscriptionPlanCode = "watch" | "monitor" | "intelligence";
export type BillingInterval = "month" | "year";

export interface PlanConfig {
  plan_code: SubscriptionPlanCode;
  display_name: string;
  /** Account Intelligence Credits per monthly entitlement period (annual refreshes monthly). */
  credits_per_period: number;
  /** Maximum active monitored accounts (standing cap). */
  max_active_monitors: number;
  /** Maximum scheduled review frequency, in days (ceiling only). */
  cadence_min_days: number;
  price_usd: { month: number; year: number };
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanCode, PlanConfig> = {
  watch: {
    plan_code: "watch", display_name: "WATCH",
    credits_per_period: 3, max_active_monitors: 3, cadence_min_days: 30,
    price_usd: { month: 7, year: 69 },
  },
  monitor: {
    plan_code: "monitor", display_name: "MONITOR",
    credits_per_period: 30, max_active_monitors: 20, cadence_min_days: 14,
    price_usd: { month: 49, year: 490 },
  },
  intelligence: {
    plan_code: "intelligence", display_name: "INTELLIGENCE",
    credits_per_period: 100, max_active_monitors: 60, cadence_min_days: 7,
    price_usd: { month: 149, year: 1490 },
  },
};

/** Limited Beta V1 (frozen §12) — metered, server-authorized, revocable. NOT unlimited. */
export const BETA_CONFIG = {
  credits_per_period: 10,
  max_active_monitors: 5,
  cadence_min_days: 14,
} as const;

export function isSubscriptionPlanCode(code: string | null | undefined): code is SubscriptionPlanCode {
  return code === "watch" || code === "monitor" || code === "intelligence";
}

/** Canonical plan config for a subscription plan_code, or null if not a SaaS V1 plan. */
export function subscriptionPlanConfig(code: string | null | undefined): PlanConfig | null {
  return isSubscriptionPlanCode(code) ? SUBSCRIPTION_PLANS[code] : null;
}
