// ─── Admin authorization (server-only) ───────────────────────────────────────
// Answers: does this Supabase access token belong to an ACTIVE administrator?
// Two independent checks, both fail-closed:
//   1. Authentication — the JWT is a valid Supabase session (anon client).
//   2. Authorization — that user_id is present + active in admin_users
//      (service-role read; the allowlist is invisible to normal clients).
// A normal authenticated user therefore fails at step 2. Never import this into
// client code (it reads the service-role key).

import { createClient } from "@supabase/supabase-js";

export type AdminAuthResult =
  | { ok: true; userId: string; role: string; email: string | null }
  | { ok: false; status: 401 | 403 | 503; reason: string };

export async function authorizeAdmin(accessToken: string | null | undefined): Promise<AdminAuthResult> {
  if (!accessToken) return { ok: false, status: 401, reason: "no_session" };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) return { ok: false, status: 503, reason: "not_configured" };

  // 1. Authenticate the session token.
  let userId: string, email: string | null;
  try {
    const anonClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anonClient.auth.getUser(accessToken);
    if (error || !data?.user) return { ok: false, status: 401, reason: "invalid_session" };
    userId = data.user.id; email = data.user.email ?? null;
  } catch { return { ok: false, status: 503, reason: "auth_unavailable" }; }

  // 2. Authorize against the allowlist (fail closed on any error).
  try {
    const svc = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: row, error } = await svc.from("admin_users")
      .select("user_id, role, is_active, revoked_at").eq("user_id", userId).maybeSingle();
    if (error) return { ok: false, status: 503, reason: "lookup_failed" };
    if (!row || row.is_active !== true || row.revoked_at) return { ok: false, status: 403, reason: "not_authorized" };
    return { ok: true, userId, role: String(row.role ?? "admin"), email };
  } catch { return { ok: false, status: 503, reason: "lookup_unavailable" }; }
}
