// ─── Admin access: active-allowlist + local-bypass policy (edge-safe) ────────
// Pure, dependency-free helpers used by BOTH the edge middleware and Node code.
// No node:crypto, no service-role import — safe to bundle on the edge. The
// service-role key is only ever *passed in* to checkActiveAdminViaRest by a
// server caller; it is never read from here.

export type ActiveAdminRow = { is_active?: boolean | null; revoked_at?: string | null } | null;
export type AdminAccessDecision = "allow" | "deny" | "fail_closed";

/** True only for a literal local hostname (port stripped, IPv6 brackets removed). */
export function isLocalHostname(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0].trim().toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || host.trim().toLowerCase() === "::1";
}

/** Dev bypass is allowed ONLY when: not production, explicit flag on, AND the
 *  request's own (trusted) hostname is literally local. Never on Vercel Preview,
 *  *.vercel.app, or the production domain. */
export function localBypassAllowed(o: { nodeEnv: string | undefined; hostname: string | null | undefined; bypassEnabled: boolean }): boolean {
  return o.nodeEnv !== "production" && o.bypassEnabled === true && isLocalHostname(o.hostname);
}

/** Authoritative access decision from signature validity + the live allowlist
 *  row. Missing/inactive/revoked ⇒ deny; lookup failure ⇒ fail closed. */
export function activeAdminDecision(i: { signatureValid: boolean; lookupError?: boolean; row: ActiveAdminRow }): AdminAccessDecision {
  if (!i.signatureValid) return "deny";
  if (i.lookupError) return "fail_closed";
  const r = i.row;
  if (!r) return "deny";
  if (r.is_active !== true) return "deny";
  if (r.revoked_at) return "deny";
  return "allow";
}

/** Parse only the trusted request URL's hostname (never x-forwarded-host). */
export function hostnameFromUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try { return new URL(u).hostname; } catch { return null; }
}

/** Query admin_users via Supabase REST with the service-role key (bypasses RLS).
 *  Edge-compatible (fetch only). Any transport/HTTP error ⇒ lookupError (fail
 *  closed). Injectable fetch for tests. */
export async function checkActiveAdminViaRest(
  fetchImpl: typeof fetch,
  cfg: { url: string; serviceKey: string },
  userId: string,
): Promise<{ lookupError: boolean; row: ActiveAdminRow }> {
  try {
    const res = await fetchImpl(
      `${cfg.url}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(userId)}&select=is_active,revoked_at&limit=1`,
      { headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` }, cache: "no-store" },
    );
    if (!res.ok) return { lookupError: true, row: null };
    const rows = await res.json();
    return { lookupError: false, row: Array.isArray(rows) && rows.length > 0 ? rows[0] : null };
  } catch { return { lookupError: true, row: null }; }
}
