import Stripe from "stripe";
import type { PlanType } from "@/types";
import { PLAN_PRICE, PLAN_LEAD_COUNT } from "@/types";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });
  }
  return _stripe;
}

/** Full Stripe config: key + webhook + at least one Price ID. */
export function isStripeConfigured(): boolean {
  return (
    !!process.env.STRIPE_SECRET_KEY &&
    !!process.env.STRIPE_WEBHOOK_SECRET &&
    !!process.env.STRIPE_PRICE_STARTER
  );
}

/** Checkout sessions can be created whenever the secret key is present.
 *  Price IDs are optional — we fall back to inline price_data. */
export function isCheckoutReady(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  starter:  process.env.STRIPE_PRICE_STARTER,
  standard: process.env.STRIPE_PRICE_STANDARD,
  pro:      process.env.STRIPE_PRICE_PRO,
};

/** Inline price_data for plans — used when Price IDs are not configured yet. */
export const PLAN_PRICE_DATA: Record<PlanType, { unit_amount: number; currency: string; product_data: { name: string; description: string } }> = {
  sample: {
    unit_amount: PLAN_PRICE.sample * 100,
    currency: "usd",
    product_data: {
      name: "LeadLens Beta Sample Pack",
      description: `${PLAN_LEAD_COUNT.sample} qualified leads + outreach drafts — human-reviewed`,
    },
  },
  starter:  {
    unit_amount: PLAN_PRICE.starter * 100,
    currency: "usd",
    product_data: {
      name: "LeadLens Beta Starter",
      description: `${PLAN_LEAD_COUNT.starter} qualified leads + full outreach sequences`,
    },
  },
  standard: {
    unit_amount: PLAN_PRICE.standard * 100,
    currency: "usd",
    product_data: {
      name: "LeadLens Beta Standard",
      description: `${PLAN_LEAD_COUNT.standard} qualified leads + full outreach sequences`,
    },
  },
  pro: {
    unit_amount: PLAN_PRICE.pro * 100,
    currency: "usd",
    product_data: {
      name: "LeadLens Beta Pro",
      description: `${PLAN_LEAD_COUNT.pro} qualified leads + full outreach sequences`,
    },
  },
};
