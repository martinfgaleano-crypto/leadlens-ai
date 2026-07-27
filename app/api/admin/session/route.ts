import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/auth/admin-authorization";
import {
  ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_SECONDS, signAdminSession, verifyAdminSession,
} from "@/lib/auth/admin-session";

// POST /api/admin/session — exchange a Supabase access token (from email/password
// sign-in) for a signed httpOnly admin-session cookie, IF the user is an active
// admin. Never reveals admin status before valid authentication.
export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return NextResponse.json({ error: "Admin auth not configured." }, { status: 503 });

  let accessToken: string | null = null;
  try { accessToken = (await req.json())?.access_token ?? null; } catch { /* bad body */ }

  const result = await authorizeAdmin(accessToken);
  if (!result.ok) {
    // 401 invalid/expired session · 403 authenticated-but-not-admin · 503 config
    const msg = result.status === 403 ? "This account is not authorized for Admin access."
      : result.status === 503 ? "Admin authorization is temporarily unavailable."
      : "Invalid or expired session.";
    console.warn(`[admin] session denied (${result.status}:${result.reason})`);
    return NextResponse.json({ error: msg, reason: result.reason }, { status: result.status });
  }

  const value = signAdminSession({ sub: result.userId, role: result.role }, secret);
  const res = NextResponse.json({ ok: true, role: result.role, isAdmin: true, redirectTo: "/admin/intelligence" });
  res.cookies.set(ADMIN_COOKIE_NAME, value, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  console.info(`[admin] session granted (role=${result.role})`);
  return res;
}

// GET /api/admin/session — cheap cookie validity check (no DB). Used to redirect
// an already-signed-in admin away from the login page.
export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (secret && cookie) {
    const v = verifyAdminSession(cookie, secret);
    if (v.ok) return NextResponse.json({ ok: true, role: v.payload.role });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}

// DELETE /api/admin/session — logout: clear the admin cookie.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  console.info("[admin] session cleared (logout)");
  return res;
}
