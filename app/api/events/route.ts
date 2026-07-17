import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ─── Product analytics intake (launch_tier_architecture_v0) ──────────────────
// Foundation: validates and structured-logs tier/product events server-side so
// they are observable in deployment logs today and can be pointed at a real
// sink later without changing call sites. No PII beyond what the caller sends;
// no cookies; fire-and-forget from the client.

const EVENT_NAMES = [
  "pricing_page_viewed", "pricing_tier_viewed", "pricing_comparison_opened",
  "tier_selected", "checkout_started", "purchase_completed",
  "onboarding_started", "onboarding_completed",
  "processing_started", "processing_completed",
  "report_viewed", "opportunity_opened", "source_opened",
  "account_useful", "account_not_useful", "action_selected",
  "upgrade_viewed", "upgrade_started", "upgrade_completed",
  "monitor_interest", "strategic_interest", "agency_interest",
  "refund_requested", "redelivery_requested",
] as const;

const eventSchema = z.object({
  event: z.enum(EVENT_NAMES),
  product_code: z.string().max(60).optional(),
  product_version: z.string().max(30).optional(),
  launch_price: z.boolean().optional(),
  amount_paid: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  tier: z.string().max(30).optional(),
  job_id: z.string().max(80).optional(),
  region_count: z.number().int().min(0).max(10).optional(),
  icp_count: z.number().int().min(0).max(10).optional(),
  opportunity_count: z.number().int().min(0).max(100).optional(),
  meta: z.record(z.string().max(200)).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = eventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  // Structured log — the analytics sink of record until a warehouse exists.
  console.log(`[analytics] ${JSON.stringify({ ts: new Date().toISOString(), ...parsed.data })}`);
  return NextResponse.json({ ok: true });
}
