import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import type { PlanType } from "@/types";
import {
  createOrder,
  createSaasJob,
  addJobEvent,
  getOrderByExternalId,
} from "@/lib/storage/saas-store";
import { addCredits } from "@/lib/credits/add-credits";
import { createNotification } from "@/lib/notifications/create-notification";

// Credits granted per plan on confirmed payment.
const PLAN_CREDITS: Record<PlanType, number> = {
  sample:   5,
  starter:  25,
  standard: 50,
  pro:      100,
};

// ─── Lemon Squeezy variant → PlanType mapping ─────────────────────────────────
// Set LEMONSQUEEZY_VARIANT_* in env after LS store is approved.
// Value is the numeric variant ID from LS dashboard.

function variantToPlan(variantId: string | number | undefined): PlanType | null {
  const id = String(variantId ?? "");
  const map: Record<string, PlanType> = {
    [process.env.LEMONSQUEEZY_VARIANT_SAMPLE   ?? "__unset_sample__"]:   "sample",
    [process.env.LEMONSQUEEZY_VARIANT_STARTER  ?? "__unset_starter__"]:  "starter",
    [process.env.LEMONSQUEEZY_VARIANT_STANDARD ?? "__unset_standard__"]: "standard",
    [process.env.LEMONSQUEEZY_VARIANT_PRO      ?? "__unset_pro__"]:      "pro",
  };
  return map[id] ?? null;
}

const PLAN_CENTS: Record<PlanType, number> = {
  sample:   700,
  starter:  2900,
  standard: 7900,
  pro:      14900,
};

// ─── HMAC-SHA256 signature verification ───────────────────────────────────────

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

// ─── POST /api/lemon-webhook ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody  = await req.text();
  const secret   = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const sigHeader = req.headers.get("x-signature") ?? req.headers.get("X-Signature") ?? "";

  // ── Signature verification ─────────────────────────────────────────────────
  if (secret) {
    if (!sigHeader) {
      return NextResponse.json({ error: "Missing X-Signature header" }, { status: 400 });
    }
    if (!verifySignature(rawBody, sigHeader, secret)) {
      console.warn("[lemon-webhook] Invalid signature — rejecting");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    // No secret configured: allow in development, reject in production
    if (process.env.NODE_ENV === "production") {
      console.error("[lemon-webhook] LEMONSQUEEZY_WEBHOOK_SECRET not set — rejecting in production");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }
    console.warn("[lemon-webhook] LEMONSQUEEZY_WEBHOOK_SECRET not set — skipping verification (dev only)");
  }

  // ── Parse payload ──────────────────────────────────────────────────────────
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const meta       = (payload.meta  ?? {}) as Record<string, unknown>;
  const data       = (payload.data  ?? {}) as Record<string, unknown>;
  const attrs      = (data.attributes ?? {}) as Record<string, unknown>;
  const eventName  = String(meta.event_name ?? "");
  const lsOrderId  = String(data.id ?? "");
  const eventId    = String((meta as Record<string,unknown>).webhook_id ?? lsOrderId);

  console.log(`[lemon-webhook] received event=${eventName} ls_order_id=${lsOrderId}`);

  // ── Only handle order events ───────────────────────────────────────────────
  if (!eventName.startsWith("order_")) {
    console.log(`[lemon-webhook] ignoring non-order event: ${eventName}`);
    return NextResponse.json({ received: true, note: `Event ${eventName} ignored` });
  }

  // ── Supabase guard ─────────────────────────────────────────────────────────
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.warn("[lemon-webhook] Supabase not configured — order NOT persisted");
    // Return 200 so LS doesn't retry forever; the webhook is acknowledged but not stored.
    return NextResponse.json({
      received: true,
      warning: "Supabase not configured — order not persisted. Configure SUPABASE env vars.",
    });
  }

  // ── Deduplication: skip if order already exists ────────────────────────────
  if (lsOrderId) {
    const existing = await getOrderByExternalId(lsOrderId);
    if (existing) {
      console.log(`[lemon-webhook] duplicate order ${lsOrderId} — already stored as ${existing.id}`);
      return NextResponse.json({ received: true, note: "Duplicate — already processed" });
    }
  }

  // ── Extract order attributes ───────────────────────────────────────────────
  const customerEmail = String(attrs.user_email ?? attrs.customer_email ?? (attrs as Record<string,unknown>).email ?? "");
  const customerName  = String(attrs.user_name  ?? attrs.customer_name  ?? "");
  const currency      = String(attrs.currency   ?? "USD").toUpperCase();
  const totalCents    = Number(attrs.total       ?? attrs.subtotal_usd ?? 0);
  const checkoutId    = String(attrs.identifier  ?? attrs.order_number ?? "");

  // Extract variant from first_order_item
  const firstItem    = (attrs.first_order_item ?? {}) as Record<string, unknown>;
  const variantId    = firstItem.variant_id;
  const plan         = variantToPlan(variantId as string | number | undefined);

  // If variant not mapped, log but still record the order
  if (!plan) {
    console.warn(
      `[lemon-webhook] Unknown variant_id=${variantId}. ` +
      "Set LEMONSQUEEZY_VARIANT_SAMPLE/STARTER/STANDARD/PRO env vars."
    );
  }

  const resolvedPlan: PlanType = plan ?? "starter";
  const resolvedCents = totalCents > 0 ? totalCents : PLAN_CENTS[resolvedPlan];

  // ── Create order ───────────────────────────────────────────────────────────
  const order = await createOrder({
    external_order_id: lsOrderId || null,
    payment_provider:  "lemon_squeezy",
    provider_event_id: eventId,
    customer_email:    customerEmail,
    customer_name:     customerName || null,
    plan:              resolvedPlan,
    amount_cents:      resolvedCents,
    currency,
    checkout_id:       checkoutId || null,
    raw_payload:       payload,
    intake_status:     "pending",
    delivery_status:   "pending",
  });

  if (!order) {
    console.error("[lemon-webhook] Failed to create order in Supabase");
    // Return 500 so LS will retry
    return NextResponse.json({ error: "Failed to persist order" }, { status: 500 });
  }

  console.log(`[lemon-webhook] order created: ${order.id} plan=${resolvedPlan} email=${customerEmail}`);

  // ── Create initial job ─────────────────────────────────────────────────────
  const job = await createSaasJob({
    order_id: order.id,
    plan:     resolvedPlan,
    status:   "awaiting_intake",
  });

  if (job) {
    await addJobEvent({
      job_id:     job.id,
      order_id:   order.id,
      event_type: "created",
      message:    `Order ${lsOrderId} received via ${eventName}`,
      metadata:   { ls_order_id: lsOrderId, plan: resolvedPlan, customer_email: customerEmail },
    });
    console.log(`[lemon-webhook] job created: ${job.id} status=awaiting_intake`);
  }

  // ── Grant credits to the matching customer ─────────────────────────────────
  // Look up the profile by email, grant plan credits, notify customer.
  // Best-effort — never block webhook response over a credit failure.

  let creditsGranted = 0;
  let customerUserId: string | null = null;

  if (customerEmail && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createServerClient } = await import("@/lib/supabase/server");
      const client = createServerClient();

      if (client) {
        const { data: profile } = await client
          .from("profiles")
          .select("id")
          .eq("email", customerEmail.trim().toLowerCase())
          .maybeSingle();

        if (profile?.id) {
          customerUserId   = profile.id as string;
          const amount     = PLAN_CREDITS[resolvedPlan];
          const result     = await addCredits(
            client,
            customerUserId,
            amount,
            `${resolvedPlan} plan — order ${lsOrderId}`,
            "grant",
          );
          creditsGranted = amount;
          console.log(`[lemon-webhook] granted ${amount} credits to ${customerUserId}, new balance=${result.credit_balance}`);

          // Notify customer their credits are ready
          await createNotification(client, {
            userId:  customerUserId,
            type:    "credits_added",
            title:   "Your leads are being prepared",
            message: `Payment confirmed — ${amount} lead credit${amount !== 1 ? "s" : ""} have been added. Your search will begin shortly.`,
            metadata: { amount, plan: resolvedPlan, order_id: order.id },
          });
        } else {
          console.warn(`[lemon-webhook] no profile found for email=${customerEmail} — credits not granted (customer may not have submitted the form yet)`);
        }
      }
    } catch (creditErr) {
      console.error("[lemon-webhook] credit grant failed (non-blocking):", creditErr instanceof Error ? creditErr.message : creditErr);
    }
  }

  return NextResponse.json({
    received:       true,
    order_id:       order.id,
    job_id:         job?.id ?? null,
    plan:           resolvedPlan,
    credits_granted: creditsGranted,
    customer_user_id: customerUserId,
  });
}
