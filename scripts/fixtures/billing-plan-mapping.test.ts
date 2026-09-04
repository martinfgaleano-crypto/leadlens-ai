// Billing V1 — canonical plan config (frozen matrix) + provider variant⇄plan mapping.
// Deterministic; no network. Env is injected explicitly (never reads real secrets).

import { SUBSCRIPTION_PLANS, BETA_CONFIG, subscriptionPlanConfig, isSubscriptionPlanCode } from "../../lib/entitlements/plan-config";
import { variantToCanonicalPlan, canonicalPlanToVariant, configuredCombinations } from "../../lib/billing/provider-plan-map";
import { createSubscriptionCheckout } from "../../lib/billing/lemon-checkout";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

// ── Frozen matrix values (must match docs/PRICING_OPERATIONAL_ENTITLEMENT_MATRIX_V1.md) ──
t("WATCH: 3 credits / 3 monitors / 30d / $7·$69", SUBSCRIPTION_PLANS.watch.credits_per_period === 3 && SUBSCRIPTION_PLANS.watch.max_active_monitors === 3 && SUBSCRIPTION_PLANS.watch.cadence_min_days === 30 && SUBSCRIPTION_PLANS.watch.price_usd.month === 7 && SUBSCRIPTION_PLANS.watch.price_usd.year === 69);
t("MONITOR: 30 credits / 20 monitors / 14d / $49·$490", SUBSCRIPTION_PLANS.monitor.credits_per_period === 30 && SUBSCRIPTION_PLANS.monitor.max_active_monitors === 20 && SUBSCRIPTION_PLANS.monitor.cadence_min_days === 14 && SUBSCRIPTION_PLANS.monitor.price_usd.month === 49 && SUBSCRIPTION_PLANS.monitor.price_usd.year === 490);
t("INTELLIGENCE: 100 credits / 60 monitors / 7d / $149·$1490", SUBSCRIPTION_PLANS.intelligence.credits_per_period === 100 && SUBSCRIPTION_PLANS.intelligence.max_active_monitors === 60 && SUBSCRIPTION_PLANS.intelligence.cadence_min_days === 7 && SUBSCRIPTION_PLANS.intelligence.price_usd.month === 149 && SUBSCRIPTION_PLANS.intelligence.price_usd.year === 1490);
t("BETA: 10 credits / 5 monitors / 14d", BETA_CONFIG.credits_per_period === 10 && BETA_CONFIG.max_active_monitors === 5 && BETA_CONFIG.cadence_min_days === 14);

t("isSubscriptionPlanCode true for canonical", isSubscriptionPlanCode("watch") && isSubscriptionPlanCode("monitor") && isSubscriptionPlanCode("intelligence"));
t("isSubscriptionPlanCode false for junk/legacy", !isSubscriptionPlanCode("starter") && !isSubscriptionPlanCode("premium_launch_v0") && !isSubscriptionPlanCode(null));
t("subscriptionPlanConfig maps / rejects", subscriptionPlanConfig("intelligence")?.max_active_monitors === 60 && subscriptionPlanConfig("nope") === null);

// ── Provider variant mapping (env is config, not pricing) ──
const env = {
  LEMONSQUEEZY_VARIANT_WATCH_MONTH: "111",
  LEMONSQUEEZY_VARIANT_WATCH_YEAR: "112",
  LEMONSQUEEZY_VARIANT_MONITOR_MONTH: "221",
  LEMONSQUEEZY_VARIANT_INTELLIGENCE_MONTH: "331",
} as any;

t("variant→plan: watch month", variantToCanonicalPlan("111", env)?.planCode === "watch" && variantToCanonicalPlan("111", env)?.billingInterval === "month");
t("variant→plan: watch year", variantToCanonicalPlan("112", env)?.planCode === "watch" && variantToCanonicalPlan("112", env)?.billingInterval === "year");
t("variant→plan: monitor month", variantToCanonicalPlan("221", env)?.planCode === "monitor");
t("variant→plan: numeric input coerced", variantToCanonicalPlan(331 as any, env)?.planCode === "intelligence");
t("variant→plan: unmapped → null (fail safe)", variantToCanonicalPlan("999", env) === null);
t("variant→plan: empty/null → null", variantToCanonicalPlan("", env) === null && variantToCanonicalPlan(null, env) === null);
t("variant→plan: unconfigured env → null (no accidental grant)", variantToCanonicalPlan("111", {} as any) === null);

t("plan→variant: reverse lookup", canonicalPlanToVariant("watch", "month", env) === "111" && canonicalPlanToVariant("monitor", "month", env) === "221");
t("plan→variant: unconfigured combo → null", canonicalPlanToVariant("intelligence", "year", env) === null);
t("plan→variant: invalid plan/interval → null", canonicalPlanToVariant("starter", "month", env) === null && canonicalPlanToVariant("watch", "week", env) === null);

const combos = configuredCombinations(env);
t("configuredCombinations: 6 combos, 4 configured", combos.length === 6 && combos.filter((c) => c.configured).length === 4);

// Checkout config boundary (no network): fails safe + diagnostic when provider/variant absent.
async function checkoutBoundary() {
  const noProvider = await createSubscriptionCheckout({ userId: "u", email: "a@b.c", planCode: "watch", interval: "month" }, {} as any);
  t("checkout: no provider config → configured:false provider_not_configured", noProvider.configured === false && noProvider.reason === "provider_not_configured");
  const noVariant = await createSubscriptionCheckout({ userId: "u", email: "a@b.c", planCode: "monitor", interval: "year" }, { LEMONSQUEEZY_API_KEY: "k", LEMONSQUEEZY_STORE_ID: "1", ...env } as any);
  t("checkout: provider set but variant missing → variant_not_configured", noVariant.configured === false && noVariant.reason === "variant_not_configured");
}

checkoutBoundary().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
});
