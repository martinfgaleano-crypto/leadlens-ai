import { NextRequest, NextResponse } from "next/server";

/**
 * requireAdmin — checks x-admin-token header against ADMIN_SECRET_TOKEN env var.
 *
 * Returns a NextResponse (401/403) if the request is not authorized.
 * Returns null if the request is authorized — caller continues normally.
 *
 * Production: ADMIN_SECRET_TOKEN must be set or all requests are rejected.
 * Development: if token is missing from env, allows access with a console warning.
 */
export function requireAdmin(req: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_SECRET_TOKEN;
  const token  = req.headers.get("x-admin-token");

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[admin] ADMIN_SECRET_TOKEN not set — rejecting all admin requests in production");
      return NextResponse.json(
        { error: "Admin not configured. Set ADMIN_SECRET_TOKEN env var." },
        { status: 403 }
      );
    }
    // Development: warn and allow (so local testing doesn't require the token)
    console.warn("[admin] ADMIN_SECRET_TOKEN not set — allowing in development mode");
    return null;
  }

  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null; // authorized
}

/**
 * isSupabaseConfigured — quick check for admin routes that need the DB.
 */
export function isSupabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
