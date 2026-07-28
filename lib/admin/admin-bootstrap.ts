// ─── Post-login Admin routing bridge (client) ────────────────────────────────
// One unified login: after a normal Supabase sign-in, the client hands the
// access token to the server-side Admin-session endpoint. The SERVER decides
// (verifies the token + queries admin_users live) and, for an active admin,
// issues the signed httpOnly cookie. The client never sends or trusts a role /
// user_id / isAdmin — it only forwards the access token and follows the result.

/** Only same-origin internal paths may be a redirect target (open-redirect guard). */
export function safeInternal(path: string | null | undefined, fallback: string): string {
  if (!path || typeof path !== "string") return fallback;
  if (!path.startsWith("/")) return fallback;
  if (path.startsWith("//") || path.startsWith("/\\")) return fallback;
  if (/[\\]/.test(path)) return fallback;
  return path;
}

/** Ask the server to establish an Admin session for this token. ALWAYS resolves
 *  deterministically (never throws): isAdmin=true (+ server-provided internal
 *  redirect) only on a 2xx that issued the cookie; any non-2xx (401/403 normal
 *  user, 500/503 config), malformed body, network error or timeout → not admin.
 *  A bounded timeout guarantees the caller can never hang on this request. */
export interface AdminBridgeResult {
  isAdmin: boolean;
  redirectTo: string | null;
  status: number | null;
}

export async function establishAdminSession(accessToken: string, timeoutMs = 8000): Promise<AdminBridgeResult> {
  if (!accessToken) return { isAdmin: false, redirectTo: null, status: 401 };
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch("/api/admin/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
      signal: controller?.signal,
    });
    if (res.ok) {
      const d = await res.json().catch(() => null) as { ok?: boolean; isAdmin?: boolean; redirectTo?: string } | null;
      if (!d || d.ok !== true || d.isAdmin !== true) return { isAdmin: false, redirectTo: null, status: res.status };
      return { isAdmin: true, redirectTo: safeInternal(d.redirectTo, "/admin/intelligence"), status: res.status };
    }
    return { isAdmin: false, redirectTo: null, status: res.status };
  } catch { return { isAdmin: false, redirectTo: null, status: null }; }
  finally { if (timer) clearTimeout(timer); }
}

/** Deterministic post-session routing decision. No session → show the form. A
 *  valid session always redirects: active admin → its target, everyone else
 *  (normal user, or Admin service unavailable) → the normal dashboard. Never
 *  leaves the caller without a decision. */
export type LoginResolution = { action: "form" } | { action: "redirect"; to: string };
export function resolveLoginTarget(hasSession: boolean, bridge: { isAdmin: boolean; redirectTo: string | null } | null): LoginResolution {
  if (!hasSession) return { action: "form" };
  if (bridge && bridge.isAdmin && bridge.redirectTo) return { action: "redirect", to: bridge.redirectTo };
  return { action: "redirect", to: "/dashboard" };
}

/** Where to send the user after a verified login: Admin destination takes
 *  precedence over the normal customer destination. Pure + testable. */
export function decidePostLoginRoute(bridge: { isAdmin: boolean; redirectTo: string | null }, normalDest = "/dashboard"): string {
  return bridge.isAdmin && bridge.redirectTo ? bridge.redirectTo : normalDest;
}

// One-time bootstrap guard so already-authenticated landings check admin status
// once per page load, not on every render/navigation.
let bootstrapChecked = false;
export function resetAdminBootstrap(): void { bootstrapChecked = false; }

/** For already-authenticated landings (e.g. dashboard shell). Runs the bridge
 *  at most once per load; returns the admin redirect target or null. */
export async function bootstrapAdminRedirectOnce(accessToken: string): Promise<string | null> {
  if (bootstrapChecked) return null;
  bootstrapChecked = true;
  const r = await establishAdminSession(accessToken);
  return r.isAdmin ? r.redirectTo : null;
}

/** Clear the server Admin cookie (logout) and re-arm the bootstrap guard. */
export async function clearAdminSession(): Promise<void> {
  resetAdminBootstrap();
  try { await fetch("/api/admin/session", { method: "DELETE" }); } catch { /* ignore */ }
}
