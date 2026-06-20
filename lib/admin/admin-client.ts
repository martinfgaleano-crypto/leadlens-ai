// Admin client helpers — browser only (localStorage).
// Import only in "use client" components.

const TOKEN_KEY = "leadlens_admin_token";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getAdminToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Fetch wrapper that automatically injects x-admin-token.
 * Always resolves — never throws on network errors (returns a synthetic 503 Response).
 * Callers check response.ok / response.status for 401/403/503.
 */
export async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> ?? {}),
    ...(token ? { "x-admin-token": token } : {}),
  };
  try {
    return await fetch(path, { ...init, headers });
  } catch {
    // Network error — return a synthetic failed response so callers don't crash
    return new Response(JSON.stringify({ error: "Network error — server unreachable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Parse a Response as JSON safely.
 * Returns null instead of throwing if the body is empty or not valid JSON.
 */
export async function parseJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
