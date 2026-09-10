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
  bullets: string[];  // 3–4 high-signal, comparable differentiators (breadth/depth/comparison/export)
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

// Plain-language-first descriptions for first-touch surfaces (§7/§20): lead with what the buyer
// decides, in words a new customer understands (companies, attention, evidence, what to confirm),
// before LeadLens ontology. Claim-safe (§19): no "most corroborated", no "defensible strategy",
// no unsupported Timing/quality-by-tier. Every one-time tier is REAL Intelligence (§3/§4); higher
// tiers add breadth/depth/comparison/synthesis/export, never better truth.
const ONE_TIME_COPY: Record<ProductCode, { headline: string; body: string }> = {
  preview_launch_v0: {
    headline: "See which of 2 companies deserves your attention first — and why.",
    body: "LeadLens researches both, weighs how well each fits what you're looking for and whether there's a reason to act now, and gives you a clear, evidence-backed call.",
  },
  brief_launch_v0: {
    headline: "Evaluate a 6-company shortlist and decide where to focus first.",
    body: "LeadLens assesses each in your commercial context, shows what supports the case and what still needs confirming, and points you to where attention is best spent.",
  },
  intelligence_launch_v0: {
    headline: "Prioritize 12 companies and see what the set reveals.",
    body: "A full one-time portfolio: LeadLens ranks where attention should go, compares the companies side by side, and surfaces the patterns across your set.",
  },
  premium_launch_v0: {
    headline: "The deepest one-time evaluation — 18 companies, plus the context around your decisions.",
    body: "Everything in Portfolio, across more markets and segments — plus deeper decision context: how the set fits the wider commercial landscape, the relevant alternatives, what could change each key decision, and additional possibilities to investigate where the evidence supports them.",
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

// Customer-facing display names. The $59 one-time tier is called "Portfolio" so it can never be
// confused with the ongoing "Intelligence" subscription tier or the "Account Opportunity Intelligence"
// category (§39). This is a DISPLAY rename only — the internal identifier stays intelligence_launch_v0
// (→ STANDARD variant → 12 accounts); nothing about billing, entitlement or Delivery changes.
const ONE_TIME_DISPLAY_NAME: Partial<Record<ProductCode, string>> = {
  intelligence_launch_v0: "Portfolio",
};

// High-signal, comparable, customer-facing differentiators. Every bullet corresponds to something the
// product actually delivers: account count (opportunity_target), Delivery dossier depth (mini→standard
// →full), CSV export (intelligence+premium only), and market breadth (regions max 1/1/2/3). No invented
// marketing claims; same Intelligence truth quality across tiers — higher tiers add breadth/depth/export.
// 4–5 comparable bullets per tier along shared dimensions (§22/§39): scope → real evaluation +
// Decision → comparison/prioritization → case depth → delivery. Every bullet maps to something the
// current Delivery System actually produces (tier-composer sections + channel-availability): mini
// depth (Preview) → +context/validation/what-changed (Brief) → +ranking/Compare/full-depth/CSV
// (Portfolio) → +breadth of companies/markets/segments (Premium). No invented capability (§14/§26).
const ONE_TIME_BULLETS: Record<ProductCode, string[]> = {
  preview_launch_v0: [
    "2 companies researched and evaluated",
    "A clear Decision for each — where attention is justified, and why",
    "The evidence behind each call",
    "A recommendation on which to focus on first",
    "Delivered as a web report and PDF",
  ],
  brief_launch_v0: [
    "6 companies researched and evaluated",
    "A clear Decision for each, in your commercial context",
    "What supports each case — and what still needs confirming",
    "Recent developments found for each company",
    "Delivered as a web report and PDF",
  ],
  intelligence_launch_v0: [
    "12 companies evaluated, across up to 2 markets",
    "A ranked view of where to focus first",
    "Side-by-side comparison across the companies",
    "Full case detail — what supports each, what weakens it, what to confirm",
    "What the set reveals, plus a structured CSV portfolio export",
  ],
  premium_launch_v0: [
    "18 companies evaluated, across up to 3 markets and multiple segments",
    "Everything in Portfolio — ranked priorities, side-by-side comparison, full case detail",
    "Decision-critical briefs: what to validate next and what could change each decision",
    "Broader commercial context and relevant alternatives, where the evidence supports it",
    "Delivered as web report, PDF and structured CSV export",
  ],
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
      capacity: `${n} ${n === 1 ? "company" : "companies"} evaluated`,
      bullets: ONE_TIME_BULLETS[code],
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
