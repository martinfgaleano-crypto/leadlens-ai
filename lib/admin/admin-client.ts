// Admin client helpers — browser only (localStorage).
// Import only in "use client" components.

const TOKEN_KEY = "leadlens_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Fetch wrapper that automatically injects x-admin-token.
 * Callers check response.ok / response.status for 401/403.
 */
export async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAdminToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> ?? {}),
    ...(token ? { "x-admin-token": token } : {}),
  };
  return fetch(path, { ...init, headers });
}
