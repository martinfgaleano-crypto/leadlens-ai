import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

/**
 * GET /api/admin/settings
 * Returns configuration status as booleans — never exposes secret values.
 */
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  return NextResponse.json({
    supabase_configured:
      !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    admin_token_configured: !!process.env.ADMIN_SECRET_TOKEN,
    demo_mode: process.env.DEMO_MODE === "true",
    anthropic_configured: !!process.env.ANTHROPIC_API_KEY,
    allow_mock_leads: process.env.ALLOW_MOCK_LEADS_WITH_REAL_AI === "true",
    resend_configured: !!process.env.RESEND_API_KEY,
    apollo_configured: !!process.env.APOLLO_API_KEY,
    lemonsqueezy_webhook_secret_configured: !!process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
    lemonsqueezy_checkout_urls: {
      sample:   !!process.env.NEXT_PUBLIC_LEMONSQUEEZY_SAMPLE_URL,
      starter:  !!process.env.NEXT_PUBLIC_LEMONSQUEEZY_STARTER_URL,
      standard: !!process.env.NEXT_PUBLIC_LEMONSQUEEZY_STANDARD_URL,
      pro:      !!process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRO_URL,
    },
    lemonsqueezy_variants_configured: {
      sample:   !!process.env.LEMONSQUEEZY_VARIANT_SAMPLE,
      starter:  !!process.env.LEMONSQUEEZY_VARIANT_STARTER,
      standard: !!process.env.LEMONSQUEEZY_VARIANT_STANDARD,
      pro:      !!process.env.LEMONSQUEEZY_VARIANT_PRO,
    },
  });
}
