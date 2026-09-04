import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { createOneTimeCheckout } from "@/lib/billing/lemon-checkout";

// ── POST /api/billing/checkout-one-time ───────────────────────────────────────
// Authenticated customer buys a one-time product (frozen §9 — one-time must use Lemon, not
// Stripe/mock). The client supplies ONLY a catalog product code; the server resolves it, maps it
// to the configured Lemon one-time variant, and binds the trusted owner id + product code into
// checkout custom_data. Never trusts a client-supplied variant/price/user.
const schema = z.object({
  product_code: z.enum([
    "preview_launch_v0", "brief_launch_v0", "intelligence_launch_v0", "premium_launch_v0",
  ]),
});

export async function POST(req: NextRequest) {
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable" }, { status: 503 });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid product." }, { status: 400 });

  const result = await createOneTimeCheckout({
    userId: user.id, email: user.email ?? "", productCode: parsed.data.product_code,
  });

  if (!result.configured) {
    // Provider/variant not configured for this environment — customer-safe, diagnostic reason.
    return NextResponse.json({ error: "Checkout isn’t available yet.", code: "billing_unavailable", reason: result.reason }, { status: 503 });
  }
  if (!result.url) {
    return NextResponse.json({ error: "Could not start checkout. Please try again.", code: "checkout_failed", reason: result.reason }, { status: 502 });
  }
  return NextResponse.json({ checkout_url: result.url });
}
