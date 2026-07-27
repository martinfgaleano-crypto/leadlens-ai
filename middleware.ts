import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/auth/admin-cookie";

// Server-side protection for Admin PAGES (data APIs self-protect via
// requireAdmin). Unauthenticated /admin/* → /admin/login?next=<path>. The
// admin-session cookie is HMAC-verified at the edge with Web Crypto (identical
// scheme to lib/auth/admin-session). All /admin/* responses get X-Robots-Tag:
// noindex. /admin/login and /api are excluded (login must be reachable; APIs
// return JSON 401/403 themselves).

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

async function verifyEdge(cookie: string | undefined, secret: string | undefined, now = Date.now()): Promise<boolean> {
  if (!cookie || !secret) return false;
  const dot = cookie.indexOf(".");
  if (dot <= 0) return false;
  const payloadB64 = cookie.slice(0, dot), sig = cookie.slice(dot + 1);
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
    if (bytesToB64url(mac) !== sig) return false;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
    return typeof payload.exp === "number" && payload.exp * 1000 > now && !!payload.sub;
  } catch { return false; }
}

const isSafeNext = (p: string): string => (/^\/admin(\/|$)/.test(p) && !/^\/admin\/login/.test(p) ? p : "/admin/intelligence");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const noindex = (res: NextResponse) => { res.headers.set("X-Robots-Tag", "noindex, nofollow"); return res; };

  // Login page is always reachable; still noindex it.
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) return noindex(NextResponse.next());

  // Local-dev convenience: outside production, do not redirect (the API layer
  // still enforces requireAdmin on all data). Production is always enforced.
  if (process.env.NODE_ENV !== "production" && !process.env.ADMIN_SESSION_SECRET) return noindex(NextResponse.next());

  const ok = await verifyEdge(req.cookies.get(ADMIN_COOKIE_NAME)?.value, process.env.ADMIN_SESSION_SECRET);
  if (ok) {
    // Authorized admin landing on /admin → send to the Command Center.
    if (pathname === "/admin") { const u = req.nextUrl.clone(); u.pathname = "/admin/intelligence"; u.search = ""; return noindex(NextResponse.redirect(u)); }
    return noindex(NextResponse.next());
  }

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = `?next=${encodeURIComponent(isSafeNext(pathname))}`;
  return noindex(NextResponse.redirect(url));
}

// Match Admin PAGES only. API routes (/api/admin/*) enforce requireAdmin
// themselves and must stay reachable to return JSON 401/403.
export const config = { matcher: ["/admin", "/admin/((?!login).*)"] };
