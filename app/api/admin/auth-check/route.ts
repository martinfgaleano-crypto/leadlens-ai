import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

/**
 * GET /api/admin/auth-check
 *
 * Lightweight token validation — no Supabase, no external services.
 * Used by the login page to validate a token before storing it.
 * Always returns JSON.
 */
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const hasToken   = !!process.env.ADMIN_SECRET_TOKEN;
  const isDev      = process.env.NODE_ENV !== "production";
  const devBypass  = !hasToken && isDev;

  return NextResponse.json({
    ok: true,
    dev_bypass: devBypass,
    ...(devBypass ? { note: "ADMIN_SECRET_TOKEN not set — dev bypass active" } : {}),
  });
}
