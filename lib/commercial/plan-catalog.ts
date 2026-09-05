// ─── Commercial display catalog (outcome-first copy over the FROZEN price/capacity source) ──────
//
// Prices and capacity come ONLY from the frozen catalog (lib/products/catalog) and entitlement
// config (lib/entitlements/plan-config). This module adds customer-facing, outcome-first copy —
// it never invents a price, a discount, or a capacity. Reused by /pricing, /checkout/continue and
// /success so the customer sees one consistent commercial vocabulary. Sells the outcome; capacity
// and credits are secondary metadata (never the hero).

import { PRODUCTS, type ProductCode } from "@/lib/products/catalog";
import { SUBSCRIPTION_PLANS, type SubscriptionPlanCode } from "@/lib/entitlements/plan-config";

export interface OneTimeCard {
  productCode: ProductCode;
  name: string;
  price: number;
  headline: string;   // the outcome
  body: string;
  capacity: string;   // secondary metadata
}

export interface SubscriptionCard {
  planCode: SubscriptionPlanCode;
  name: string;
  priceMonth: number;
  priceYear: number;
  headline: string;
  body: string;
  capacity: string;   // primary metadata: monitored accounts
  creditsNote: string;// muted secondary: monthly analysis credits
  featured?: boolean;
}

const ONE_TIME_COPY: Record<ProductCode, { headline: string; body: string }> = {
  preview_launch_v0: {
    headline: "See where attention is justified — on a small, defined set of accounts.",
    body: "A bounded, point-in-time read: Fit, Timing and the Evidence behind each Decision.",
  },
  brief_launch_v0: {
    headline: "A focused, comparable opportunity set for a real commercial decision.",
    body: "Account and market intelligence across a compact portfolio, with Decisions you can act on.",
  },
  intelligence_launch_v0: {
    headline: "A deeper, prioritized study of where to spend commercial effort now.",
    body: "Reinforced Evidence and portfolio prioritization across a broader set of accounts.",
  },
  premium_launch_v0: {
    headline: "The most comprehensive one-time study in the catalog.",
    body: "Maximum depth and corroboration, built toward a defensible commercial strategy.",
  },
};

const SUBSCRIPTION_COPY: Record<SubscriptionPlanCode, { name: string; headline: string; body: string; featured?: boolean }> = {
  watch: {
    name: "Watch",
    headline: "Keep a few known accounts quietly under watch.",
    body: "Persistent observation with Account Memory and What Changed as things move.",
  },
  monitor: {
    name: "Monitor",
    headline: "Keep an active account portfolio continuously prioritized.",
    body: "Recurring reassessment across your accounts — market context, Evidence, Account Memory, What Changed and Compare.",
    featured: true,
  },
  intelligence: {
    name: "Intelligence",
    headline: "Run Account Opportunity Intelligence as an ongoing system.",
    body: "Recurring discovery, deeper Evidence, Compare and portfolio reprioritization across a broader portfolio and multiple markets.",
  },
};

const ONE_TIME_ORDER: ProductCode[] = ["preview_launch_v0", "brief_launch_v0", "intelligence_launch_v0", "premium_launch_v0"];
const SUB_ORDER: SubscriptionPlanCode[] = ["watch", "monitor", "intelligence"];

// Customer-facing display names. The one-time "Intelligence" is explicitly qualified so it can never
// be confused with the ongoing "Intelligence" subscription (§39). Never renames the catalog itself.
const ONE_TIME_DISPLAY_NAME: Partial<Record<ProductCode, string>> = {
  intelligence_launch_v0: "Intelligence — One-time",
};

export function oneTimeCards(): OneTimeCard[] {
  return ONE_TIME_ORDER.map((code) => {
    const p = PRODUCTS[code];
    const n = p.entitlements.opportunity_target;
    return {
      productCode: code,
      name: ONE_TIME_DISPLAY_NAME[code] ?? p.display_name,
      price: p.price_amount,
      headline: ONE_TIME_COPY[code].headline,
      body: ONE_TIME_COPY[code].body,
      capacity: `${n} account evaluation${n === 1 ? "" : "s"}`,
    };
  });
}

export function subscriptionCards(): SubscriptionCard[] {
  return SUB_ORDER.map((code) => {
    const plan = SUBSCRIPTION_PLANS[code];
    const copy = SUBSCRIPTION_COPY[code];
    return {
      planCode: code,
      name: copy.name,
      priceMonth: plan.price_usd.month,
      priceYear: plan.price_usd.year,
      headline: copy.headline,
      body: copy.body,
      capacity: `Up to ${plan.max_active_monitors} monitored accounts`,
      creditsNote: `${plan.credits_per_period} monthly analysis credits`,
      featured: copy.featured,
    };
  });
}

/** Annual saving as a truthful "about N months free" phrase (never a fabricated %). */
export function annualSavingLabel(priceMonth: number, priceYear: number): string {
  const monthsFree = Math.round((priceMonth * 12 - priceYear) / priceMonth);
  return monthsFree > 0 ? `Save about ${monthsFree} months with annual billing` : "";
}

/** Resolve a single card's display for continuation/success surfaces. */
export function oneTimeCardFor(productCode: string): OneTimeCard | null {
  return oneTimeCards().find((c) => c.productCode === productCode) ?? null;
}
export function subscriptionCardFor(planCode: string): SubscriptionCard | null {
  return subscriptionCards().find((c) => c.planCode === planCode) ?? null;
}
