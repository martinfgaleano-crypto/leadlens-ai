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

  setFetch(() => ({ status: 200, body: { ok: true, isAdmin: true, redirectTo: "https://evil.com/x" } }));
  const sanitized = await establishAdminSession("tok");
  t("server redirect sanitized to internal", sanitized.isAdmin && sanitized.redirectTo === "/admin/intelligence");

  // Malformed 2xx cannot be trusted as proof that the bridge established Admin.
  (globalThis as { fetch: unknown }).fetch = async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } } as unknown as Response);
  const malformed = await establishAdminSession("tok");
  t("malformed 2xx → dashboard-safe non-admin result", !malformed.isAdmin && malformed.redirectTo === null);

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
  setFetch(() => ({ status: 200, body: { ok: true, isAdmin: true, redirectTo: "/admin/intelligence" } }));
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
  setFetch(() => ({ status: 200, body: { ok: true, isAdmin: true, redirectTo: "/admin/intelligence" } }));
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
  const adminLayoutSrc = readFileSync("app/admin/_components/AdminLayout.tsx", "utf8");
  t("normal login renders no Admin CTA / role-picker", noAdminCta(loginSrc));
  t("Admin layout validates the signed server session", /fetch\(["']\/api\/admin\/session["']/.test(adminLayoutSrc) && /credentials:\s*["']same-origin["']/.test(adminLayoutSrc));
  t("Admin layout does NOT require the retired localStorage token", !/getAdminToken/.test(adminLayoutSrc) && !/leadlens_admin_token/.test(adminLayoutSrc));
  t("Admin layout logout clears the server session", /adminLogout/.test(adminLayoutSrc));

  // ── PURE STATIC FORM guarantees across the WHOLE auth stack.
  // These fail if any future edit reintroduces mount-time session discovery or a
  // loading/verifying state on /login, /admin/login or /signup.
  const adminLoginSrc = readFileSync("app/admin/login/page.tsx", "utf8");
  const signupSrc = readFileSync("app/signup/page.tsx", "utf8");
  const pages: Array<[string, string]> = [["/login", loginSrc], ["/admin/login", adminLoginSrc], ["/signup", signupSrc]];
  const LOADING_TEXT = /Checking existing session|Verifying session|Signing you in|Redirecting/;
  const SESSION_GATE = /if\s*\(\s*(checking|isChecking|sessionLoading|authLoading)|phase\s*===\s*["']verifying|sessionNote\s*===/;

  for (const [name, src] of pages) {
    const code = stripComments(src);
    t(`${name}: NO loading/verifying text in render path`, !LOADING_TEXT.test(code));
    t(`${name}: NO session-loading gate before the form`, !SESSION_GATE.test(code));
    // The single most important structural fact: the auth page never calls
    // getSession/onAuthStateChange on mount — nothing async precedes the form.
    t(`${name}: NO getSession/onAuthStateChange (pure static form)`, !/\.auth\.getSession\s*\(/.test(code) && !/onAuthStateChange/.test(code));
    t(`${name}: form fields rendered unconditionally`, /onSubmit=\{handleSubmit\}/.test(code) && /type="email"/.test(code) && /type="password"/.test(code));
    t(`${name}: NO Suspense loading-only fallback`, !/<Suspense/.test(code) && !/fallback=/.test(code));
    const expectedMarker = name === "/signup" ? "auth-nonblocking-v4" : "auth-nonblocking-v6";
    t(`${name}: current build marker`, new RegExp(`LOGIN_BUILD\\s*=\\s*["']${expectedMarker}["']`).test(code) && /data-login-build=\{LOGIN_BUILD\}/.test(code));
    t(`${name}: NOT the superseded v2/v3 markers`, !/form-first-v2|form-always-visible-v3/.test(code));
  }
  t("login: supabase init failure keeps form (authUnavailable inline note)", /authUnavailable/.test(loginSrc) && /Authentication is temporarily unavailable/.test(loginSrc));
  t("login: explicit sign-in still routes via bridge", /signInWithPassword/.test(loginSrc) && /establishAdminSession/.test(loginSrc) && /resolveLoginTarget/.test(loginSrc));
  t("admin login: explicit sign-in uses the same bounded bridge", /establishAdminSession/.test(adminLoginSrc) && /resolveLoginTarget/.test(adminLoginSrc));
  t("login: successful routing is a hard navigation", /window\.location\.replace/.test(loginSrc));
  t("admin login: successful routing is a hard navigation", /window\.location\.replace/.test(adminLoginSrc));

  console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
})();
