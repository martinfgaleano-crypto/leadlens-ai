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

/** Ask the server to establish an Admin session for this token. Returns
 *  isAdmin=true (+ server-provided internal redirect) only when the server
 *  issued the cookie; any non-2xx (401/403 normal user, 503 config) → not admin. */
export async function establishAdminSession(accessToken: string): Promise<{ isAdmin: boolean; redirectTo: string | null }> {
  if (!accessToken) return { isAdmin: false, redirectTo: null };
  try {
    const res = await fetch("/api/admin/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    });
    if (res.ok) {
      const d = await res.json().catch(() => ({}));
      return { isAdmin: true, redirectTo: safeInternal(d?.redirectTo, "/admin/intelligence") };
    }
    return { isAdmin: false, redirectTo: null };
  } catch { return { isAdmin: false, redirectTo: null }; }
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
