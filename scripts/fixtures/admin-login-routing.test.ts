// Unit tests: unified post-login Admin routing bridge (client helper).
// Server-authoritative; the client only forwards the access token and follows.
import {
  safeInternal, decidePostLoginRoute, establishAdminSession, resolveLoginTarget,
  bootstrapAdminRedirectOnce, resetAdminBootstrap, clearAdminSession,
} from "@/lib/admin/admin-bootstrap";
import { readFileSync } from "fs";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

// Mock global.fetch; capture the last request.
type Call = { url: string; init?: RequestInit };
let calls: Call[] = [];
const setFetch = (impl: (url: string, init?: RequestInit) => { status: number; body?: unknown }) => {
  (globalThis as { fetch: unknown }).fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = impl(url, init);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body ?? {} } as Response;
  };
};

// ── safeInternal (open-redirect guard) ───────────────────────────────────────
t("safeInternal keeps /admin/intelligence", safeInternal("/admin/intelligence", "/dashboard") === "/admin/intelligence");
t("safeInternal rejects //evil", safeInternal("//evil.com", "/dashboard") === "/dashboard");
t("safeInternal rejects https://evil", safeInternal("https://evil.com/x", "/dashboard") === "/dashboard");
t("safeInternal rejects backslash", safeInternal("/admin\\x", "/dashboard") === "/dashboard");
t("safeInternal rejects non-slash", safeInternal("evil", "/dashboard") === "/dashboard");

// ── decidePostLoginRoute (Admin precedence) ──────────────────────────────────
t("admin destination takes precedence", decidePostLoginRoute({ isAdmin: true, redirectTo: "/admin/intelligence" }, "/dashboard") === "/admin/intelligence");
t("normal user → dashboard", decidePostLoginRoute({ isAdmin: false, redirectTo: null }, "/dashboard") === "/dashboard");
t("admin without redirectTo falls back to normal", decidePostLoginRoute({ isAdmin: true, redirectTo: null }, "/dashboard") === "/dashboard");

// ── resolveLoginTarget (terminal decision — never leaves caller hanging) ─────
t("no session → show form", resolveLoginTarget(false, null).action === "form");
const rAdmin = resolveLoginTarget(true, { isAdmin: true, redirectTo: "/admin/intelligence" });
t("session + admin → redirect Portal", rAdmin.action === "redirect" && rAdmin.action === "redirect" && rAdmin.to === "/admin/intelligence");
const rNorm = resolveLoginTarget(true, { isAdmin: false, redirectTo: null });
t("session + normal user → /dashboard", rNorm.action === "redirect" && rNorm.to === "/dashboard");
const rFail = resolveLoginTarget(true, null);
t("session + bridge unavailable → /dashboard (not trapped)", rFail.action === "redirect" && rFail.to === "/dashboard");

// ── establishAdminSession ────────────────────────────────────────────────────
(async () => {
  setFetch(() => ({ status: 200, body: { ok: true, isAdmin: true, redirectTo: "/admin/intelligence" } }));
  calls = [];
  const admin = await establishAdminSession("tok-abc");
  t("active admin → isAdmin + redirect", admin.isAdmin && admin.redirectTo === "/admin/intelligence");
  t("client sends ONLY access_token (no role/user_id/isAdmin)", (() => {
    const body = JSON.parse((calls[0]?.init?.body as string) ?? "{}");
    return Object.keys(body).length === 1 && body.access_token === "tok-abc";
  })());

  setFetch(() => ({ status: 200, body: { ok: true, redirectTo: "https://evil.com/x" } }));
  const sanitized = await establishAdminSession("tok");
  t("server redirect sanitized to internal", sanitized.isAdmin && sanitized.redirectTo === "/admin/intelligence");

  // malformed 2xx body (json throws) → deterministic admin default, no crash.
  (globalThis as { fetch: unknown }).fetch = async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } } as unknown as Response);
  const malformed = await establishAdminSession("tok");
  t("malformed 2xx → deterministic (admin default target)", malformed.isAdmin && malformed.redirectTo === "/admin/intelligence");

  setFetch(() => ({ status: 500, body: {} }));
  t("500 → not admin (deterministic)", (await establishAdminSession("tok")).isAdmin === false);
  setFetch(() => ({ status: 403, body: { error: "not authorized" } }));
  t("normal user (403) → not admin", (await establishAdminSession("tok")).isAdmin === false);
  setFetch(() => ({ status: 401, body: {} }));
  t("invalid token (401) → not admin", (await establishAdminSession("tok")).isAdmin === false);
  setFetch(() => ({ status: 503, body: {} }));
  t("config error (503) → not admin (login not blocked)", (await establishAdminSession("tok")).isAdmin === false);
  t("empty token → not admin, no request", (await establishAdminSession("")).isAdmin === false);

  (globalThis as { fetch: unknown }).fetch = async () => { throw new Error("net"); };
  t("network error → not admin", (await establishAdminSession("tok")).isAdmin === false);

  // ── one-time bootstrap guard ───────────────────────────────────────────────
  resetAdminBootstrap();
  setFetch(() => ({ status: 200, body: { isAdmin: true, redirectTo: "/admin/intelligence" } }));
  const first = await bootstrapAdminRedirectOnce("tok");
  const second = await bootstrapAdminRedirectOnce("tok");
  t("bootstrap runs once (2nd returns null)", first === "/admin/intelligence" && second === null);
  resetAdminBootstrap();
  t("reset re-arms bootstrap", (await bootstrapAdminRedirectOnce("tok")) === "/admin/intelligence");

  // ── logout clears cookie (DELETE) + re-arms guard ──────────────────────────
  calls = [];
  setFetch(() => ({ status: 200, body: { ok: true } }));
  await clearAdminSession();
  t("logout calls DELETE /api/admin/session", calls[0]?.url === "/api/admin/session" && calls[0]?.init?.method === "DELETE");
  t("logout re-arms bootstrap guard", (await bootstrapAdminRedirectOnce("tok")) === "/admin/intelligence");

  // ── No Admin button / nav entry RENDERED (assert on code with comments
  //    stripped, so documentation mentioning "Admin" doesn't false-positive) ──
  const stripComments = (s: string) => s.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const noAdminCta = (src: string) => {
    const c = stripComments(src);
    return !/admin control panel/i.test(c) && !/control panel/i.test(c) && !/href=["'`]\/admin/i.test(c) && !/>\s*Admin\b[^<]*</i.test(c) && !/role.?picker/i.test(c);
  };
  t("dashboard shell renders no Admin CTA", noAdminCta(readFileSync("app/dashboard/_components/DashboardShell.tsx", "utf8")));
  const loginSrc = readFileSync("app/login/page.tsx", "utf8");
  t("normal login renders no Admin CTA / role-picker", noAdminCta(loginSrc));

  // ── Form-first structural guarantees across the WHOLE auth stack (no RTL) ──
  // These fail if any future edit reintroduces a blocking "Verifying session"
  // state on /login, /admin/login or /signup.
  const adminLoginSrc = readFileSync("app/admin/login/page.tsx", "utf8");
  const signupSrc = readFileSync("app/signup/page.tsx", "utf8");
  const rendersVerifying = (s: string) => /return\s*<div[^>]*>\s*Verifying session/.test(stripComments(s)) || /\bVerifying session…?<\/div>/.test(stripComments(s));
  const blocksOnChecking = (s: string) => /if\s*\(\s*(checking|phase\s*===\s*["']verifying)/.test(stripComments(s));

  t("NO 'Verifying session' rendered on /login", !rendersVerifying(loginSrc) && !blocksOnChecking(loginSrc));
  t("NO 'Verifying session' rendered on /admin/login", !rendersVerifying(adminLoginSrc) && !blocksOnChecking(adminLoginSrc));
  t("NO 'Verifying session' rendered on /signup", !rendersVerifying(signupSrc) && !blocksOnChecking(signupSrc));

  t("login form fields are rendered unconditionally", /onSubmit=\{handleSubmit\}/.test(loginSrc) && /type="email"/.test(loginSrc) && /type="password"/.test(loginSrc));
  t("admin/login form fields are rendered unconditionally", /onSubmit=\{handleSubmit\}/.test(adminLoginSrc) && /type="email"/.test(adminLoginSrc) && /type="password"/.test(adminLoginSrc));

  t("login build marker is form-always-visible-v3", /LOGIN_BUILD\s*=\s*"form-always-visible-v3"/.test(loginSrc) && /data-login-build=\{LOGIN_BUILD\}/.test(loginSrc));
  t("admin/login build marker is form-always-visible-v3", /LOGIN_BUILD\s*=\s*"form-always-visible-v3"/.test(adminLoginSrc) && /data-login-build=\{LOGIN_BUILD\}/.test(adminLoginSrc));
  t("marker is NOT the superseded form-first-v2", !/form-first-v2/.test(loginSrc) && !/form-first-v2/.test(adminLoginSrc));

  t("getSession is time-bounded on /login and /admin/login", /Promise\.race/.test(loginSrc) && /Promise\.race/.test(adminLoginSrc));
  t("getSession bounded/caught on /signup (no unbounded await)", /Promise\.race/.test(signupSrc) && /catch/.test(signupSrc) && !/if\s*\(\s*checking/.test(signupSrc));
  t("stale/rejected token → local signOut, form kept (/login)", /signOut\(\{\s*scope:\s*["']local["']/.test(loginSrc) && /rejected/.test(loginSrc));
  t("supabase init failure keeps form (authUnavailable, no blank)", /authUnavailable/.test(loginSrc) && /Authentication is temporarily unavailable/.test(loginSrc));
  t("background effects are cancellable (no state update after unmount)", /cancelled/.test(loginSrc) && /cancelled/.test(adminLoginSrc) && /cancelled/.test(signupSrc));

  console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
})();
