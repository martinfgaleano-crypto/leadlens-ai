import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createOrder, createSaasJob, addJobEvent } from "@/lib/storage/saas-store";

/**
 * POST /api/admin/dev/seed-order
 *
 * Creates a fake order + job for local dashboard testing.
 * NEVER available in production — returns 404 if NODE_ENV === "production".
 * Requires admin token (same as all other admin routes).
 * Requires Supabase to be configured.
 */
export async function POST(req: NextRequest) {
  // Hard block in production — not a configuration flag, not an env var
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const deny = requireAdmin(req);
  if (deny) return deny;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local to seed test data." },
      { status: 503 }
    );
  }

  const PLANS = ["sample", "starter", "standard", "pro"] as const;
  const PRICES: Record<string, number> = { sample: 700, starter: 2900, standard: 7900, pro: 14900 };
  const plan = PLANS[Math.floor(Math.random() * PLANS.length)];

  const fakeEmail = `test-${Date.now()}@example-dev.com`;

  const order = await createOrder({
    external_order_id: `DEV-${Date.now()}`,
    payment_provider:  "dev_seed",
    provider_event_id: null,
    customer_email:    fakeEmail,
    customer_name:     "Dev Test Customer",
    plan,
    amount_cents:      PRICES[plan],
    currency:          "USD",
    checkout_id:       null,
    raw_payload:       { seeded_at: new Date().toISOString(), dev: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Failed to create order — check Supabase connection." }, { status: 500 });
  }

  const job = await createSaasJob({
    order_id: order.id,
    plan:     order.plan,
  });

  if (!job) {
    return NextResponse.json({ error: "Order created but job creation failed.", order }, { status: 500 });
  }

  await addJobEvent({
    job_id:     job.id,
    order_id:   order.id,
    event_type: "created",
    message:    "Seeded via /api/admin/dev/seed-order (dev only)",
  });

  return NextResponse.json({
    ok: true,
    message: "Dev seed order created.",
    order_id: order.id,
    job_id:   job.id,
    plan,
    customer_email: fakeEmail,
  });
}
