import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { createSubscriptionCheckout } from "@/lib/billing/lemon-checkout";

// ── POST /api/billing/subscribe ───────────────────────────────────────────────
// Authenticated customer starts a subscription. The client may choose ONLY a canonical
// (plan_code, interval); the server maps it to the configured provider variant and binds the
// trusted owner id into checkout custom_data. Never trusts a client-supplied variant/price/user.
const schema = z.object({
  plan_code: z.enum(["watch", "monitor", "intelligence"]),
  interval: z.enum(["month", "year"]),
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
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid plan and billing interval." }, { status: 400 });

  const result = await createSubscriptionCheckout({
    userId: user.id, email: user.email ?? "", planCode: parsed.data.plan_code, interval: parsed.data.interval,
  });

  if (!result.configured) {
    // Provider/variant not configured for this environment — customer-safe, diagnostic reason.
    return NextResponse.json({ error: "Subscriptions aren’t available yet.", code: "billing_unavailable", reason: result.reason }, { status: 503 });
  }
  if (!result.url) {
    return NextResponse.json({ error: "Could not start checkout. Please try again.", code: "checkout_failed", reason: result.reason }, { status: 502 });
  }
  return NextResponse.json({ checkout_url: result.url });
}
