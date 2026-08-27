// ─── Browser client for the Stage A interpretation API ───────────────────────
// Thin fetch wrapper. Imports the PublicInterpretation TYPE only (erased at
// runtime) — no server code, no model keys reach the browser bundle.
import type { PublicInterpretation } from "./public-projection";
import { getSupabaseClient } from "@/lib/supabase/client";

export type { PublicInterpretation } from "./public-projection";

export type InterpretRequestResult =
  | { ok: true; interpretation: PublicInterpretation; confirmationToken: string | null }
  | { ok: false; status: number; rateLimited: boolean };

export async function requestInterpretation(
  input: string,
  clarification: string | undefined,
  locale: "en" | "es" | "pt" | "ja",
  signal?: AbortSignal,
): Promise<InterpretRequestResult> {
  try {
    const supabase = getSupabaseClient();
    const accessToken = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
    const res = await fetch("/api/interpret", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ input, clarification: clarification || undefined, locale }),
      signal,
    });
    if (!res.ok) return { ok: false, status: res.status, rateLimited: res.status === 429 };
    const data = (await res.json()) as { interpretation?: PublicInterpretation; confirmation_token?: string };
    if (!data.interpretation) return { ok: false, status: 502, rateLimited: false };
    return { ok: true, interpretation: data.interpretation, confirmationToken: data.confirmation_token ?? null };
  } catch {
    return { ok: false, status: 0, rateLimited: false };
  }
}

export type StartConfirmedIntelligenceResult =
  | { ok: true; runId: string; status: string }
  | { ok: false; reason: "signin_required" | "confirmation_failed" | "run_failed" };

/** Productive browser seam: an authenticated user explicitly confirms the exact
 * signed Stage-A interpretation, then starts Intelligence using references only.
 * No candidate, evidence or decision payload crosses this boundary. */
export async function confirmAndStartIntelligence(
  confirmationToken: string,
  contextId: string,
): Promise<StartConfirmedIntelligenceResult> {
  const supabase = getSupabaseClient();
  const accessToken = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
  if (!accessToken) return { ok: false, reason: "signin_required" };
  const headers = { "content-type": "application/json", Authorization: `Bearer ${accessToken}` };
  const confirmed = await fetch("/api/customer/contexts/confirm", {
    method: "POST", headers,
    body: JSON.stringify({ confirmation_token: confirmationToken, context_id: contextId }),
  });
  if (!confirmed.ok) return { ok: false, reason: "confirmation_failed" };
  const context = (await confirmed.json()) as { context?: { context_id: string; version: number } };
  if (!context.context) return { ok: false, reason: "confirmation_failed" };
  const started = await fetch("/api/customer/intelligence-runs", {
    method: "POST", headers,
    body: JSON.stringify({
      context_id: context.context.context_id,
      version: context.context.version,
      plan: "sample",
      idempotency_key: contextId,
      delivery_limit: 2,
    }),
  });
  if (!started.ok) return { ok: false, reason: "run_failed" };
  const run = (await started.json()) as { run_id?: string; status?: string };
  if (!run.run_id) return { ok: false, reason: "run_failed" };
  return { ok: true, runId: run.run_id, status: run.status ?? "processing" };
}
