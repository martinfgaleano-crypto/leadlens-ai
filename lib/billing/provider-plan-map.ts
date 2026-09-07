// ─── Lemon Squeezy variant ⇄ canonical plan mapping (config boundary) ──────────
//
// Provider variant IDs are CONFIGURATION, not pricing semantics. This is the only
// place a Lemon variant becomes a canonical (plan_code, billing_interval). No
// display names, no price parsing, no client authority. Missing config fails safe:
// an unmapped variant resolves to null and the webhook records it as an unmapped-
// variant condition rather than granting arbitrary access.
//
// Env vars (numeric Lemon variant IDs; set per environment — sandbox vs production):
//   LEMONSQUEEZY_VARIANT_WATCH_MONTH / _WATCH_YEAR
//   LEMONSQUEEZY_VARIANT_MONITOR_MONTH / _MONITOR_YEAR
//   LEMONSQUEEZY_VARIANT_INTELLIGENCE_MONTH / _INTELLIGENCE_YEAR

import type { SubscriptionPlanCode, BillingInterval } from "@/lib/entitlements/plan-config";
import { isSubscriptionPlanCode } from "@/lib/entitlements/plan-config";

export interface CanonicalPlanRef { planCode: SubscriptionPlanCode; billingInterval: BillingInterval }

const ENV_KEYS: Array<{ env: string; plan: SubscriptionPlanCode; interval: BillingInterval }> = [
  { env: "LEMONSQUEEZY_VARIANT_WATCH_MONTH", plan: "watch", interval: "month" },
  { env: "LEMONSQUEEZY_VARIANT_WATCH_YEAR", plan: "watch", interval: "year" },
  { env: "LEMONSQUEEZY_VARIANT_MONITOR_MONTH", plan: "monitor", interval: "month" },
  { env: "LEMONSQUEEZY_VARIANT_MONITOR_YEAR", plan: "monitor", interval: "year" },
  { env: "LEMONSQUEEZY_VARIANT_INTELLIGENCE_MONTH", plan: "intelligence", interval: "month" },
  { env: "LEMONSQUEEZY_VARIANT_INTELLIGENCE_YEAR", plan: "intelligence", interval: "year" },
];

/** Build the variant→canonical map from env at call time (never cached across config changes). */
function variantIndex(env: NodeJS.ProcessEnv = process.env): Map<string, CanonicalPlanRef> {
  const idx = new Map<string, CanonicalPlanRef>();
  for (const { env: key, plan, interval } of ENV_KEYS) {
    const id = env[key]?.trim();
    if (id) idx.set(id, { planCode: plan, billingInterval: interval });
  }
  return idx;
}

/** Provider variant ID → canonical plan, or null when unmapped/unconfigured (fail safe). */
export function variantToCanonicalPlan(variantId: string | number | undefined | null, env?: NodeJS.ProcessEnv): CanonicalPlanRef | null {
  const id = variantId == null ? "" : String(variantId).trim();
  if (!id) return null;
  return variantIndex(env).get(id) ?? null;
}

/** Canonical plan + interval → configured provider variant ID, for checkout. Null when unconfigured. */
export function canonicalPlanToVariant(planCode: string, billingInterval: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!isSubscriptionPlanCode(planCode) || (billingInterval !== "month" && billingInterval !== "year")) return null;
  const key = `LEMONSQUEEZY_VARIANT_${planCode.toUpperCase()}_${billingInterval.toUpperCase()}`;
  return env[key]?.trim() || null;
}

// ─── One-time product ⇄ Lemon variant ─────────────────────────────────────────
// One-time products are keyed by the catalog's legacy plan slug (sample|starter|standard|pro)
// so a SINGLE set of variant IDs — LEMONSQUEEZY_VARIANT_{SAMPLE|STARTER|STANDARD|PRO}, the same
// env the order webhook (app/api/lemon-webhook) already reads for fulfillment — drives BOTH
// checkout creation and fulfillment. No new env surface, no duplicate mapping.
const ONE_TIME_LEGACY_SLUGS = ["sample", "starter", "standard", "pro"] as const;

/** One-time product (legacy plan slug) → configured Lemon variant ID, or null when unconfigured. */
export function oneTimeLegacyPlanToVariant(legacyPlan: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const slug = String(legacyPlan ?? "").trim().toLowerCase();
  if (!(ONE_TIME_LEGACY_SLUGS as readonly string[]).includes(slug)) return null;
  return env[`LEMONSQUEEZY_VARIANT_${slug.toUpperCase()}`]?.trim() || null;
}

/** Lemon variant ID → one-time legacy plan slug (server-owned authority for fulfillment), or null.
 *  The webhook uses THIS (not client-declared product_code) to decide what a paid order grants. */
export function variantToOneTimeLegacyPlan(variantId: string | number | undefined | null, env: NodeJS.ProcessEnv = process.env): string | null {
  const id = variantId == null ? "" : String(variantId).trim();
  if (!id) return null;
  for (const slug of ONE_TIME_LEGACY_SLUGS) {
    if (env[`LEMONSQUEEZY_VARIANT_${slug.toUpperCase()}`]?.trim() === id) return slug;
  }
  return null;
}

/** Which one-time products have a configured variant. Diagnostics only — no values. */
export function configuredOneTimeCombinations(env: NodeJS.ProcessEnv = process.env): Array<{ legacyPlan: string; configured: boolean }> {
  return ONE_TIME_LEGACY_SLUGS.map((slug) => ({ legacyPlan: slug, configured: Boolean(env[`LEMONSQUEEZY_VARIANT_${slug.toUpperCase()}`]?.trim()) }));
}

/** Which canonical (plan, interval) combinations have a configured variant. Diagnostics only — no values. */
export function configuredCombinations(env: NodeJS.ProcessEnv = process.env): Array<{ plan: SubscriptionPlanCode; interval: BillingInterval; configured: boolean }> {
  return ENV_KEYS.map(({ plan, interval, env: key }) => ({ plan, interval, configured: Boolean(env[key]?.trim()) }));
}
