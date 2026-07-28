import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/auth/admin-cookie";
import { activeAdminDecision, checkActiveAdminViaRest, localBypassAllowed } from "@/lib/auth/admin-access";

// Centralized, authoritative Admin boundary for BOTH pages (/admin/*) and APIs
// (/api/admin/*, except the login/bootstrap routes). On every protected request:
//   1. verify the signed cookie (HMAC, edge Web Crypto) → user_id;
//   2. query admin_users live (service-role REST) for is_active && !revoked_at;
//   3. allow / deny / fail-closed accordingly.
// Revocation is therefore immediate — never waits for the 8h cookie TTL. Denied
// requests get the cookie cleared; pages redirect to /admin/login?reason=
// unauthorized, APIs get 403. All /admin/* responses are noindex.

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

  // 1. Signature.
  const secret = process.env.ADMIN_SESSION_SECRET;
  const { ok: sigOk, sub } = await verifyEdge(req.cookies.get(ADMIN_COOKIE_NAME)?.value, secret);

  // 2. Live allowlist (authoritative — immediate revocation).
  let decision: "allow" | "deny" | "fail_closed";
  if (!sigOk || !sub) decision = "deny";
  else {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) decision = "fail_closed";
    else {
      const { lookupError, row } = await checkActiveAdminViaRest(fetch, { url, serviceKey: key }, sub);
      decision = activeAdminDecision({ signatureValid: true, lookupError, row });
    }
  }

  if (decision === "allow") {
    if (!isApi && pathname === "/admin") { const u = req.nextUrl.clone(); u.pathname = "/admin/intelligence"; u.search = ""; return noindex(NextResponse.redirect(u)); }
    return isApi ? NextResponse.next() : noindex(NextResponse.next());
  }

  // Deny / fail-closed: clear cookie; 403 for APIs, redirect for pages.
  if (isApi) return clearCookie(NextResponse.json({ error: decision === "fail_closed" ? "Admin authorization unavailable." : "Unauthorized" }, { status: decision === "fail_closed" ? 503 : 403 }));
  const u = req.nextUrl.clone();
  u.pathname = "/admin/login";
  u.search = "?reason=unauthorized";
  return clearCookie(noindex(NextResponse.redirect(u)));
}

// Admin pages + admin APIs, EXCLUDING /admin/login (must be reachable) and the
// login/bootstrap APIs /api/admin/session and /api/admin/auth-check (used to
// obtain/validate a session before a cookie exists).
export const config = { matcher: ["/login", "/admin", "/admin/((?!login).*)", "/admin/login", "/api/admin/((?!session|auth-check).*)"] };
