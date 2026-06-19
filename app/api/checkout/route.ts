import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStripe, isCheckoutReady, PLAN_PRICE_IDS, PLAN_PRICE_DATA } from "@/lib/stripe";
import { createJob } from "@/lib/storage/job-store";
import type { PlanType, OnboardingData } from "@/types";
import { PLAN_PRICE, PLAN_LEAD_COUNT } from "@/types";

const checkoutSchema = z.object({
  plan: z.enum(["sample", "starter", "standard", "pro"]),
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

  const { plan, onboarding } = parsed.data as { plan: PlanType; onboarding: OnboardingData };

  // Create a pending job in the store (works in-memory without Supabase)
  const job = await createJob({ plan, onboarding, customer_email: onboarding.contact_email });

  // DEMO_MODE or no Stripe secret key → return mock checkout URL
  if (process.env.DEMO_MODE === "true" || !isCheckoutReady()) {
    return NextResponse.json({
      checkout_url: null,
      job_id: job.id,
      demo: true,
      message: "Stripe not configured — job created. Use /api/demo to run the pipeline directly.",
      plan,
      price: PLAN_PRICE[plan],
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/=$/, "") || "http://localhost:3000";

  // Use Price ID if configured, otherwise fall back to inline price_data (no Stripe dashboard required)
  const priceId = PLAN_PRICE_IDS[plan];
  const lineItems = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [{ price_data: PLAN_PRICE_DATA[plan], quantity: 1 }];

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
        lead_count: String(PLAN_LEAD_COUNT[plan]),
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
