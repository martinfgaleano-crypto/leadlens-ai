// ─── Admin session cookie (server-signed, stateless) ─────────────────────────
// After email/password sign-in + allowlist authorization succeed, the server
// issues a signed httpOnly cookie carrying only {sub, role, exp}. Every later
// request is authorized by verifying this cookie server-side (sync HMAC, no DB
// round-trip) — the browser never holds a bearer secret and localStorage is not
// trusted. Node crypto here powers requireAdmin (Node runtime); middleware
// re-implements the identical verify with Web Crypto for the edge.

import crypto from "crypto";
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_SECONDS, ADMIN_SESSION_VERSION } from "./admin-cookie";

export { ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_SECONDS, ADMIN_SESSION_VERSION };

export interface AdminSessionPayload { sub: string; role: string; iat: number; exp: number; v: number; }

const b64url = (buf: Buffer): string => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string): Buffer => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** Sign a payload → `<payloadB64>.<hmacB64>`. */
export function signAdminSession(input: { sub: string; role: string }, secret: string, ttlSeconds = ADMIN_SESSION_TTL_SECONDS, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const payload: AdminSessionPayload = { sub: input.sub, role: input.role, iat, exp: iat + ttlSeconds, v: ADMIN_SESSION_VERSION };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  return `${payloadB64}.${sig}`;
}

export type AdminSessionVerdict =
  | { ok: true; payload: AdminSessionPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

/** Verify signature (timing-safe) + expiry. Pure, no I/O. */
export function verifyAdminSession(cookie: string | undefined | null, secret: string, now = Date.now()): AdminSessionVerdict {
  if (!cookie || !secret) return { ok: false, reason: "malformed" };
  const dot = cookie.indexOf(".");
  if (dot <= 0) return { ok: false, reason: "malformed" };
  const payloadB64 = cookie.slice(0, dot), sig = cookie.slice(dot + 1);
  const expected = b64url(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };
  let payload: AdminSessionPayload;
  try { payload = JSON.parse(fromB64url(payloadB64).toString("utf8")); } catch { return { ok: false, reason: "malformed" }; }
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= now) return { ok: false, reason: "expired" };
  if (!payload.sub) return { ok: false, reason: "malformed" };
  return { ok: true, payload };
}

/** Open-redirect guard: only same-origin `/admin/...` paths may be a `next`
 *  target. Rejects absolute URLs, protocol-relative `//host`, and backslashes. */
export function isSafeAdminNext(next: string | null | undefined): boolean {
  if (!next) return false;
  if (!next.startsWith("/")) return false;          // must be a path
  if (next.startsWith("//") || next.startsWith("/\\")) return false; // protocol-relative
  if (/[\\]/.test(next)) return false;
  if (/^\/admin(\/|$)/.test(next) === false) return false; // admin paths only
  if (/^\/admin\/login(\/|$|\?)/.test(next)) return false; // never loop to login
  return true;
}

export function sanitizeAdminNext(next: string | null | undefined, fallback = "/admin/intelligence"): string {
  return isSafeAdminNext(next) ? (next as string) : fallback;
}

/** Whether the dev shared-secret path (x-admin-token) may authorize here.
 *  NEVER in production — the shared token cannot grant production access. */
export function sharedSecretAllowed(env = process.env.NODE_ENV): boolean {
  return env !== "production";
}
