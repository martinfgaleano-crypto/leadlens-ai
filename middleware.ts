import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/auth/admin-cookie";
import { localBypassAllowed } from "@/lib/auth/admin-access";

// Centralized Admin boundary for BOTH pages (/admin/*) and APIs (/api/admin/*,
// except the login/bootstrap routes). The session endpoint has already verified
// the Supabase token AND the live admin_users allowlist before issuing this
// HMAC-signed, httpOnly cookie. Middleware verifies that signed grant locally.
//
// Do not repeat a remote Supabase lookup from Edge here. That created a second,
// failure-prone authorization hop after a successful login and could bounce a
// freshly authorized owner back to /admin/login when Edge networking/config
// differed from the Node session function.

const b64urlToBytes = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const bytesToB64url = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** Edge cookie verify → { ok, sub }. Mirrors lib/auth/admin-session (Node). */
async function verifyEdge(cookie: string | undefined, secret: string | undefined, now = Date.now()): Promise<{ ok: boolean; sub?: string }> {
  if (!cookie || !secret) return { ok: false };
  const dot = cookie.indexOf(".");
  if (dot <= 0) return { ok: false };
  const payloadB64 = cookie.slice(0, dot), sig = cookie.slice(dot + 1);
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
    if (bytesToB64url(mac) !== sig) return { ok: false };
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= now || !payload.sub) return { ok: false };
    return { ok: true, sub: String(payload.sub) };
  } catch { return { ok: false }; }
}

const noindex = (res: NextResponse): NextResponse => { res.headers.set("X-Robots-Tag", "noindex, nofollow"); return res; };
const noStore = (res: NextResponse): NextResponse => {
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
};
const clearCookie = (res: NextResponse): NextResponse => {
  res.cookies.set(ADMIN_COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return res;
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");
  // Trusted hostname only — req.nextUrl.hostname derives from the real Host,
  // NOT the spoofable x-forwarded-host header.
  const host = req.nextUrl.hostname;

  // Auth entry pages are always reachable and explicitly uncacheable. This
  // prevents a browser/CDN from retaining a retired verification-only bundle.
  if (!isApi && (pathname === "/login" || pathname.startsWith("/login/"))) return noStore(NextResponse.next());
  if (!isApi && (pathname === "/admin/login" || pathname.startsWith("/admin/login/"))) return noStore(noindex(NextResponse.next()));

  // Restricted local-dev bypass: not production + explicit flag + literal local host.
  if (localBypassAllowed({ nodeEnv: process.env.NODE_ENV, hostname: host, bypassEnabled: process.env.ADMIN_LOCAL_BYPASS === "true" })) {
    return isApi ? NextResponse.next() : noindex(NextResponse.next());
  }

  // The signed cookie is the grant. It can only be minted by
  // POST /api/admin/session after live Supabase + allowlist authorization.
  const secret = process.env.ADMIN_SESSION_SECRET;
  const { ok: sigOk, sub } = await verifyEdge(req.cookies.get(ADMIN_COOKIE_NAME)?.value, secret);
  if (sigOk && sub) {
    if (!isApi && pathname === "/admin") { const u = req.nextUrl.clone(); u.pathname = "/admin/intelligence"; u.search = ""; return noindex(NextResponse.redirect(u)); }
    return isApi ? NextResponse.next() : noindex(NextResponse.next());
  }

  // Invalid, missing or expired grant: clear it and require a fresh login.
  if (isApi) return clearCookie(NextResponse.json({ error: "Unauthorized" }, { status: 403 }));
  const u = req.nextUrl.clone();
  u.pathname = "/admin/login";
  u.search = "?reason=unauthorized";
  return clearCookie(noindex(NextResponse.redirect(u)));
}

// Admin pages + admin APIs, EXCLUDING /admin/login (must be reachable) and the
// login/bootstrap APIs /api/admin/session and /api/admin/auth-check (used to
// obtain/validate a session before a cookie exists).
export const config = { matcher: ["/login", "/admin", "/admin/((?!login).*)", "/admin/login", "/api/admin/((?!session|auth-check).*)"] };
