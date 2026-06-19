import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

/**
 * GET /api/admin/settings
 * Returns configuration status as booleans — never exposes secret values.
 * dev_bypass_active: true when ADMIN_SECRET_TOKEN is absent in dev mode
 * (all admin routes still allow access, but the token is not protecting them).
 */
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const hasAdminToken = !!process.env.ADMIN_SECRET_TOKEN;
  const isDev = process.env.NODE_ENV !== "production";

  return NextResponse.json({
    // Core
    supabase_configured:
      !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    admin_token_configured: hasAdminToken,
    dev_bypass_active: !hasAdminToken && isDev,
    demo_mode: process.env.DEMO_MODE === "true",
    anthropic_configured: !!process.env.ANTHROPIC_API_KEY,

    // Lemon Squeezy
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

    // Optional integrations
    resend_configured:  !!process.env.RESEND_API_KEY,
    apollo_configured:  !!process.env.APOLLO_API_KEY,
    pdl_configured:     !!process.env.PEOPLE_DATA_LABS_API_KEY,
    hunter_configured:  !!process.env.HUNTER_API_KEY,
    tavily_configured:  !!process.env.TAVILY_API_KEY,
  });
}
