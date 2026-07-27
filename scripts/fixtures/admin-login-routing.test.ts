// Unit tests: unified post-login Admin routing bridge (client helper).
// Server-authoritative; the client only forwards the access token and follows.
import {
  safeInternal, decidePostLoginRoute, establishAdminSession,
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
  t("normal login renders no Admin CTA / role-picker", noAdminCta(readFileSync("app/login/page.tsx", "utf8")));

  console.log(`\n${p} passed, ${f} failed`); if (f) process.exit(1);
})();
