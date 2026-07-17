import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, isCheckoutReady } from "@/lib/stripe";
import { createJob } from "@/lib/storage/job-store";
import type { PlanType, OnboardingData } from "@/types";

const checkoutSchema = z.object({
  // Accepts versioned product codes (launch_tier_architecture_v0) and legacy
  // plan names. Price, entitlements and limits resolve SERVER-SIDE from the
  // catalog — any amount or entitlement sent by the browser is ignored.
  plan: z.enum([
    "preview_launch_v0", "brief_launch_v0", "intelligence_launch_v0", "premium_launch_v0",
    "sample", "starter", "standard", "pro",
  ]),
  onboarding: z.object({
    company_name: z.string().min(1),
    company_description: z.string().min(5),
    offer_description: z.string().min(5),
    value_proposition: z.string().min(5),
    target_customer_description: z.string().min(5),
    average_ticket: z.string().optional(),
    tone: z.enum(["direct", "consultative", "casual"]),
    contact_email: z.string().email(),
    output_language: z.enum(["en", "es", "pt", "ja"]).optional(),
    target_market_region: z.enum(["north_america", "latin_america", "europe", "asia", "global"]).optional(),
    // Tier-adaptive onboarding (progressive disclosure) — optional everywhere.
    campaign_objective: z.string().max(600).optional(),
    opportunity_preferences: z.string().max(600).optional(),
    restrictions: z.string().max(600).optional(),
    sales_capacity: z.string().max(300).optional(),
    prioritization_preferences: z.string().max(600).optional(),
    risk_tolerance: z.string().max(300).optional(),
    strategic_priorities: z.string().max(600).optional(),
    known_objections: z.string().max(600).optional(),
    decision_stakeholders: z.string().max(600).optional(),
  }),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Server-side product resolution: the catalog is the only pricing authority.
  const { resolveProduct } = await import("@/lib/products/catalog");
  const product = resolveProduct(parsed.data.plan);
  if (!product) return NextResponse.json({ error: "Unknown product" }, { status: 400 });

  const plan: PlanType = product.legacy_plan; // pipeline compatibility
  const onboarding: OnboardingData = {
    ...(parsed.data.onboarding as OnboardingData),
    product_code: product.product_code,
    product_version: "launch_v0",
  };

  // Create a pending job in the store (works in-memory without Supabase)
  const job = await createJob({ plan, onboarding, customer_email: onboarding.contact_email });

  // DEMO_MODE or no payment provider → return mock checkout URL
  if (process.env.DEMO_MODE === "true" || !isCheckoutReady()) {
    return NextResponse.json({
      checkout_url: null,
      job_id: job.id,
      demo: true,
      message: "Payment provider not configured — job created. Use /api/demo to run the pipeline directly.",
      plan,
      product_code: product.product_code,
      launch_price: product.launch_price,
      price: product.price_amount,
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/=$/, "") || "http://localhost:3000";

  // Price resolves from the versioned catalog (server-side), never from the
  // browser and never from legacy PLAN_PRICE_DATA (pre-tier prices).
  const lineItems = [{
    price_data: {
      currency: product.currency.toLowerCase(),
      unit_amount: product.price_amount * 100,
      product_data: { name: `LeadLens ${product.display_name} (launch pricing)`, description: product.one_liner },
    },
    quantity: 1,
  }];

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}&job_id=${job.id}`,
      cancel_url: `${appUrl}/cancel?job_id=${job.id}`,
      customer_email: onboarding.contact_email,
      metadata: {
        job_id: job.id,
        plan,
        product_code: product.product_code,
        product_version: "launch_v0",
        launch_price: "true",
        amount_usd: String(product.price_amount),
        opportunity_target: String(product.entitlements.opportunity_target),
        output_language: onboarding.output_language ?? "en",
        target_market_region: onboarding.target_market_region ?? "global",
      },
    });

    return NextResponse.json({ checkout_url: session.url, job_id: job.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Stripe error: ${msg}` }, { status: 500 });
  }
}
