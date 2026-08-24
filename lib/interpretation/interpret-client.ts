// ─── Browser client for the Stage A interpretation API ───────────────────────
// Thin fetch wrapper. Imports the PublicInterpretation TYPE only (erased at
// runtime) — no server code, no model keys reach the browser bundle.
import type { PublicInterpretation } from "./public-projection";

export type { PublicInterpretation } from "./public-projection";

export type InterpretRequestResult =
  | { ok: true; interpretation: PublicInterpretation }
  | { ok: false; status: number; rateLimited: boolean };

export async function requestInterpretation(
  input: string,
  clarification: string | undefined,
  locale: "en" | "es" | "pt" | "ja",
  signal?: AbortSignal,
): Promise<InterpretRequestResult> {
  try {
    const res = await fetch("/api/interpret", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input, clarification: clarification || undefined, locale }),
      signal,
    });
    if (!res.ok) return { ok: false, status: res.status, rateLimited: res.status === 429 };
    const data = (await res.json()) as { interpretation?: PublicInterpretation };
    if (!data.interpretation) return { ok: false, status: 502, rateLimited: false };
    return { ok: true, interpretation: data.interpretation };
  } catch {
    return { ok: false, status: 0, rateLimited: false };
  }
}
