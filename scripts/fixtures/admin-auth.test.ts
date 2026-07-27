// Unit tests: production Admin authentication/authorization core.
// Pure signing/verify + next-path guard + requireAdmin env policy (no live
// Supabase needed). Covers the unit-testable slice of the 25 required cases.
import { NextRequest } from "next/server";
import {
  signAdminSession, verifyAdminSession, isSafeAdminNext, sanitizeAdminNext,
  sharedSecretAllowed, ADMIN_COOKIE_NAME,
} from "@/lib/auth/admin-session";
import { requireAdmin } from "@/lib/auth/require-admin";
import { authorizeAdmin } from "@/lib/auth/admin-authorization";
import { activeAdminDecision, localBypassAllowed, isLocalHostname, checkActiveAdminViaRest, hostnameFromUrl } from "@/lib/auth/admin-access";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

const SECRET = "test-session-secret-value";

// Build a minimal NextRequest-like object requireAdmin understands.
const fakeReq = (opts: { cookie?: string; token?: string; url?: string } = {}) => ({
  url: opts.url ?? "http://localhost:3000/api/admin/test",
  cookies: { get: (n: string) => (n === ADMIN_COOKIE_NAME && opts.cookie ? { value: opts.cookie } : undefined) },
  headers: new Headers(opts.token ? { "x-admin-token": opts.token } : {}),
}) as unknown as NextRequest;

const withEnv = (env: Record<string, string | undefined>, fn: () => void) => {
  const keys = ["NODE_ENV", "ADMIN_SESSION_SECRET", "ADMIN_SECRET_TOKEN", "ADMIN_LOCAL_BYPASS"];
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) saved[k] = process.env[k];
  for (const k of keys) { if (k in env) (process.env as Record<string, string | undefined>)[k] = env[k]; else delete (process.env as Record<string, string | undefined>)[k]; }
  try { fn(); } finally { for (const k of keys) (process.env as Record<string, string | undefined>)[k] = saved[k]; }
};

// ── Signing / verification ───────────────────────────────────────────────────
const cookie = signAdminSession({ sub: "user-1", role: "admin" }, SECRET);
const v = verifyAdminSession(cookie, SECRET);
t("sign/verify roundtrip", v.ok && v.ok === true && (v as { payload: { sub: string } }).payload.sub === "user-1");
t("wrong secret ⇒ bad_signature", verifyAdminSession(cookie, "other-secret").ok === false);
t("tampered payload ⇒ rejected", verifyAdminSession("x" + cookie, SECRET).ok === false);
t("expired ⇒ rejected", verifyAdminSession(signAdminSession({ sub: "u", role: "admin" }, SECRET, -10), SECRET).ok === false);
t("empty cookie ⇒ malformed", verifyAdminSession("", SECRET).ok === false);

// ── Open-redirect guard ──────────────────────────────────────────────────────
t("next /admin/intelligence allowed", isSafeAdminNext("/admin/intelligence"));
t("next /admin/pilot/artifact allowed", isSafeAdminNext("/admin/pilot/artifact"));
t("next /admin/login rejected (loop)", !isSafeAdminNext("/admin/login"));
t("next //evil.com rejected", !isSafeAdminNext("//evil.com"));
t("next https://evil rejected", !isSafeAdminNext("https://evil.com/admin"));
t("next /dashboard rejected (non-admin)", !isSafeAdminNext("/dashboard"));
t("next backslash rejected", !isSafeAdminNext("/admin\\evil"));
t("sanitize falls back to intelligence", sanitizeAdminNext("//evil") === "/admin/intelligence");

// ── Shared-secret env policy ─────────────────────────────────────────────────
t("shared secret NOT allowed in production", sharedSecretAllowed("production") === false);
t("shared secret allowed in development", sharedSecretAllowed("development") === true);
t("shared secret allowed in test", sharedSecretAllowed("test") === true);

// ── requireAdmin behavior ────────────────────────────────────────────────────
withEnv({ NODE_ENV: "production", ADMIN_SESSION_SECRET: SECRET }, () => {
  t("prod: valid admin cookie ⇒ authorized", requireAdmin(fakeReq({ cookie })) === null);
  t("prod: no cookie (normal user) ⇒ 401", requireAdmin(fakeReq())?.status === 401);
  t("prod: shared/test token REJECTED", requireAdmin(fakeReq({ token: "leadlens_test_admin_123" }))?.status === 401);
});
withEnv({ NODE_ENV: "production", ADMIN_SECRET_TOKEN: "leadlens_test_admin_123" }, () => {
  // ADMIN_SESSION_SECRET missing in production ⇒ fail closed even WITH the token.
  t("prod: no session secret ⇒ 503 fail-closed", requireAdmin(fakeReq({ token: "leadlens_test_admin_123" }))?.status === 503);
});
withEnv({ NODE_ENV: "development", ADMIN_SECRET_TOKEN: "leadlens_test_admin_123" }, () => {
  t("dev: matching shared token ⇒ authorized", requireAdmin(fakeReq({ token: "leadlens_test_admin_123" })) === null);
  t("dev: wrong shared token ⇒ 401", requireAdmin(fakeReq({ token: "nope" }))?.status === 401);
});
withEnv({ NODE_ENV: "development" }, () => {
  t("dev: no secrets, no bypass flag ⇒ 401", requireAdmin(fakeReq())?.status === 401);
});
withEnv({ NODE_ENV: "development", ADMIN_LOCAL_BYPASS: "true" }, () => {
  t("dev: bypass flag + localhost ⇒ authorized", requireAdmin(fakeReq({ url: "http://localhost:3000/api/admin/x" })) === null);
  t("dev: bypass flag + remote host ⇒ 401", requireAdmin(fakeReq({ url: "https://leadlensintel.com/api/admin/x" }))?.status === 401);
});

// ── Active-allowlist decision (immediate revocation) ─────────────────────────
t("active row ⇒ allow", activeAdminDecision({ signatureValid: true, row: { is_active: true, revoked_at: null } }) === "allow");
t("is_active=false ⇒ deny", activeAdminDecision({ signatureValid: true, row: { is_active: false, revoked_at: null } }) === "deny");
t("revoked_at set ⇒ deny", activeAdminDecision({ signatureValid: true, row: { is_active: true, revoked_at: "2026-01-01T00:00:00Z" } }) === "deny");
t("row deleted/missing ⇒ deny", activeAdminDecision({ signatureValid: true, row: null }) === "deny");
t("invalid signature ⇒ deny", activeAdminDecision({ signatureValid: false, row: { is_active: true, revoked_at: null } }) === "deny");
t("lookup error ⇒ fail_closed", activeAdminDecision({ signatureValid: true, lookupError: true, row: null }) === "fail_closed");

// ── checkActiveAdminViaRest with mocked fetch ────────────────────────────────
async function restTests() {
  const ok = (rows: unknown) => (async () => ({ ok: true, json: async () => rows })) as unknown as typeof fetch;
  const httpErr = (async () => ({ ok: false, json: async () => [] })) as unknown as typeof fetch;
  const thrower = (async () => { throw new Error("net"); }) as unknown as typeof fetch;
  const cfg = { url: "https://x.supabase.co", serviceKey: "svc" };
  const active = await checkActiveAdminViaRest(ok([{ is_active: true, revoked_at: null }]), cfg, "u1");
  t("REST active row", !active.lookupError && activeAdminDecision({ signatureValid: true, ...active }) === "allow");
  const revoked = await checkActiveAdminViaRest(ok([{ is_active: true, revoked_at: "2026-01-01" }]), cfg, "u1");
  t("REST revoked row ⇒ deny", activeAdminDecision({ signatureValid: true, ...revoked }) === "deny");
  const empty = await checkActiveAdminViaRest(ok([]), cfg, "u1");
  t("REST empty ⇒ deny", activeAdminDecision({ signatureValid: true, ...empty }) === "deny");
  const errResp = await checkActiveAdminViaRest(httpErr, cfg, "u1");
  t("REST http error ⇒ fail_closed", errResp.lookupError && activeAdminDecision({ signatureValid: true, ...errResp }) === "fail_closed");
  const threw = await checkActiveAdminViaRest(thrower, cfg, "u1");
  t("REST throw ⇒ fail_closed", threw.lookupError);
}

// ── Local-bypass hostname policy ─────────────────────────────────────────────
const bypass = (nodeEnv: string, hostname: string, flag: boolean) => localBypassAllowed({ nodeEnv, hostname, bypassEnabled: flag });
t("localhost + flag ⇒ bypass", bypass("development", "localhost", true) === true);
t("127.0.0.1 + flag ⇒ bypass", bypass("development", "127.0.0.1", true) === true);
t("::1 + flag ⇒ bypass", isLocalHostname("::1") && bypass("development", "::1", true) === true);
t("localhost, NO flag ⇒ no bypass", bypass("development", "localhost", false) === false);
t("Vercel preview host ⇒ never bypass", bypass("development", "leadlens-git-main.vercel.app", true) === false);
t("*.vercel.app ⇒ never bypass", bypass("development", "my-app.vercel.app", true) === false);
t("leadlensintel.com ⇒ never bypass", bypass("development", "leadlensintel.com", true) === false);
t("www.leadlensintel.com ⇒ never bypass", bypass("development", "www.leadlensintel.com", true) === false);
t("production + localhost ⇒ never bypass", bypass("production", "localhost", true) === false);
t("spoofed forwarded host not usable (only trusted host parsed)", hostnameFromUrl("https://leadlensintel.com/admin") === "leadlensintel.com" && bypass("development", "leadlensintel.com", true) === false);

// ── authorizeAdmin fail-closed on missing config ─────────────────────────────
(async () => {
  await withEnvAsync({ NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined, SUPABASE_SERVICE_ROLE_KEY: undefined }, async () => {
    const r = await authorizeAdmin("some-token");
    t("authorizeAdmin: missing config ⇒ 503", !r.ok && r.status === 503);
  });
  t("authorizeAdmin: no token ⇒ 401", !(await authorizeAdmin(null)).ok);
  await restTests();
  console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
})();

async function withEnvAsync(env: Record<string, string | undefined>, fn: () => Promise<void>) {
  const keys = Object.keys(env);
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) saved[k] = process.env[k];
  for (const k of keys) { if (env[k] === undefined) delete (process.env as Record<string, string | undefined>)[k]; else (process.env as Record<string, string | undefined>)[k] = env[k]; }
  try { await fn(); } finally { for (const k of keys) (process.env as Record<string, string | undefined>)[k] = saved[k]; }
}
