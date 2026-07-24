import { timingSafeEqual } from "crypto";

export type ProcessingAuthResult =
  | { ok: true; actor: "internal" | "admin" | "owner"; userId?: string }
  | { ok: false; status: 401 | 404 | 503; error: string };

type AuthClient = {
  auth: {
    getUser(token: string): Promise<{ data: { user: { id: string } | null } }>;
  };
};

function safeEqual(actual: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function bearer(headers: Headers): string | null {
  const value = headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : null;
}

export function hasProcessingCredential(headers: Headers): boolean {
  return !!bearer(headers) || !!headers.get("x-admin-token");
}

/**
 * Authorizes the expensive legacy search processor.
 *
 * Accepted actors:
 * - server jobs carrying INTERNAL_RUN_SECRET as Bearer token;
 * - admin callers carrying x-admin-token;
 * - the owning customer carrying a valid Supabase access token.
 *
 * This intentionally does not inherit requireAdmin's development bypass: an
 * expensive provider-triggering route must always have explicit credentials.
 */
export async function authorizeSearchProcessing(
  headers: Headers,
  client: AuthClient,
  searchOwnerId: string,
): Promise<ProcessingAuthResult> {
  const token = bearer(headers);
  const adminToken = headers.get("x-admin-token") ?? "";

  if (safeEqual(adminToken, process.env.ADMIN_SECRET_TOKEN)) {
    return { ok: true, actor: "admin" };
  }
  if (token && safeEqual(token, process.env.INTERNAL_RUN_SECRET)) {
    return { ok: true, actor: "internal" };
  }
  if (!token) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  try {
    const { data: { user } } = await client.auth.getUser(token);
    if (!user) return { ok: false, status: 401, error: "Unauthorized" };
    // Hide the existence of searches owned by another customer.
    if (user.id !== searchOwnerId) {
      return { ok: false, status: 404, error: "Search not found" };
    }
    return { ok: true, actor: "owner", userId: user.id };
  } catch {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
}

export function internalProcessingHeaders(): Record<string, string> | null {
  const secret = process.env.INTERNAL_RUN_SECRET;
  if (!secret) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  };
}
