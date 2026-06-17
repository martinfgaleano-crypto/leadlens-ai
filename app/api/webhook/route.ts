import { NextRequest, NextResponse } from "next/server";
import { updateJob } from "@/lib/storage/job-store";

/**
 * POST /api/webhook
 * Stripe webhook — confirms payment and updates job payment_status.
 * Works without Supabase; uses in-memory job-store as fallback.
 */
export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey) {
    return NextResponse.json({ received: true, note: "Stripe not configured" });
  }

  if (!webhookSecret) {
    // In development, acknowledge without verifying signature
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ received: true, note: "Webhook secret not set — skipping verification (dev only)" });
    }
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not configured" }, { status: 500 });
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as import("stripe").Stripe.Checkout.Session;
    const jobId = session.metadata?.job_id;
    const stripeSessionId = session.id;

    console.log(`[webhook] checkout.session.completed | job_id=${jobId ?? "none"} | session=${stripeSessionId}`);

    if (jobId) {
      await updateJob(jobId, {
        payment_status: "paid",
        stripe_session_id: stripeSessionId,
      });
    }
  }

  return NextResponse.json({ received: true });
}
