import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSession, sharedSecretAllowed } from "./admin-session";
import { localBypassAllowed, hostnameFromUrl } from "./admin-access";

/**
 * requireAdmin — server-side Admin gate for every /admin API route.
 *
 * PRIMARY (all environments): a valid signed admin-session cookie
 * (ll_admin_session), issued only after Supabase email/password sign-in +
 * admin_users allowlist authorization succeed. Verified sync via HMAC.
 *
 * DEV/TEST ONLY: the legacy shared secret (x-admin-token === ADMIN_SECRET_TOKEN)
 * still works so local tooling and existing dev flows keep functioning. This
 * path is HARD-DISABLED in production — the shared/test token can never grant
 * production access.
 *
 * Fail closed: returns 401/403/503 (NextResponse) when not authorized; returns
 * null when authorized.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;

  // Primary path — signed admin-session cookie.
  if (sessionSecret && cookie) {
    if (verifyAdminSession(cookie, sessionSecret).ok) return null;
  }

  // Dev/test-only shared-secret fallback (never in production; on Vercel Preview
  // NODE_ENV is "production", so this whole block is skipped there too).
  if (sharedSecretAllowed()) {
    const shared = process.env.ADMIN_SECRET_TOKEN;
    const token = req.headers.get("x-admin-token");
    if (shared && token === shared) return null;
    if (shared) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // No shared secret: allow ONLY under the restricted local bypass — literal
    // localhost + explicit ADMIN_LOCAL_BYPASS. Never on any remote hostname.
    if (localBypassAllowed({ nodeEnv: process.env.NODE_ENV, hostname: hostnameFromUrl(req.url), bypassEnabled: process.env.ADMIN_LOCAL_BYPASS === "true" })) {
      console.warn("[admin] ADMIN_LOCAL_BYPASS active on local host — dev-only access");
      return null;
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Production without a valid admin cookie.
  if (!sessionSecret) {
    console.error("[admin] ADMIN_SESSION_SECRET not set — rejecting all admin requests in production");
    return NextResponse.json({ error: "Admin not configured." }, { status: 503 });
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** isSupabaseConfigured — quick check for admin routes that need the DB. */
export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
