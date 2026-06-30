import type { VaultPattern } from "@/types";

// Thresholds — conservative by design
const POSITIVE_THRESHOLD_MEDIUM = 3;  // ≥3 positive signals → medium confidence
const POSITIVE_THRESHOLD_HIGH   = 6;  // ≥6 → high confidence
const NEGATIVE_THRESHOLD_MEDIUM = 2;  // ≥2 negative signals → caution (lower bar for warnings)
const NEGATIVE_THRESHOLD_HIGH   = 4;

const REUSABLE = new Set([
  "meeting_booked", "replied", "add_to_vault", "useful",
]);
const NEGATIVE = new Set([
  "wrong_fit", "not_useful", "generic", "exclude_similar", "irrelevant",
]);

// ─── loadVaultPatterns ────────────────────────────────────────────────────────
// Reads opportunity_feedback from Supabase and returns aggregated VaultPatterns.
// Always resolves — returns [] if Supabase is unavailable or unconfigured.
// No personal data: only industry, segment, feedback_signal, buying_window.

export async function loadVaultPatterns(): Promise<VaultPattern[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [];
  }

  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    const db = createServerClient();
    if (!db) return [];

    const { data, error } = await db
      .from("opportunity_feedback")
      .select("industry, feedback_signal, buying_window")
      .limit(2000);

    if (error || !data) return [];

    // Aggregate by industry for each direction
    const posMap: Record<string, { signals: string[]; windows: string[] }> = {};
    const negMap: Record<string, { signals: string[]; windows: string[] }> = {};

    for (const r of data as { industry: string | null; feedback_signal: string; buying_window: string | null }[]) {
      const ind = r.industry ?? "unknown";
      const sig = r.feedback_signal;
      const win = r.buying_window;

      if (REUSABLE.has(sig)) {
        if (!posMap[ind]) posMap[ind] = { signals: [], windows: [] };
        posMap[ind].signals.push(sig);
        if (win) posMap[ind].windows.push(win);
      }
      if (NEGATIVE.has(sig)) {
        if (!negMap[ind]) negMap[ind] = { signals: [], windows: [] };
        negMap[ind].signals.push(sig);
        if (win) negMap[ind].windows.push(win);
      }
    }

    const patterns: VaultPattern[] = [];

    for (const [industry, { signals, windows }] of Object.entries(posMap)) {
      const count = signals.length;
      const confidence: VaultPattern["confidence"] =
        count >= POSITIVE_THRESHOLD_HIGH   ? "high"   :
        count >= POSITIVE_THRESHOLD_MEDIUM ? "medium" :
        "low";
      patterns.push({
        industry,
        direction: "strengthen",
        signal_count: count,
        top_signals: Array.from(new Set(signals)).slice(0, 3),
        confidence,
        vault_ready: count >= POSITIVE_THRESHOLD_MEDIUM,
        example_buying_windows: Array.from(new Set(windows)).slice(0, 2),
      });
    }

    for (const [industry, { signals, windows }] of Object.entries(negMap)) {
      const count = signals.length;
      const confidence: VaultPattern["confidence"] =
        count >= NEGATIVE_THRESHOLD_HIGH   ? "high"   :
        count >= NEGATIVE_THRESHOLD_MEDIUM ? "medium" :
        "low";
      patterns.push({
        industry,
        direction: "weaken",
        signal_count: count,
        top_signals: Array.from(new Set(signals)).slice(0, 3),
        confidence,
        vault_ready: count >= NEGATIVE_THRESHOLD_MEDIUM,
        example_buying_windows: Array.from(new Set(windows)).slice(0, 2),
      });
    }

    return patterns;
  } catch {
    return [];
  }
}

// ─── matchVaultPatterns ───────────────────────────────────────────────────────
// Finds patterns that match a candidate's industry via substring (case-insensitive).

export function matchVaultPatterns(
  industry: string,
  patterns: VaultPattern[],
): { positive: VaultPattern | undefined; negative: VaultPattern | undefined } {
  const norm = industry.toLowerCase();
  const positive = patterns.find(
    p => p.direction === "strengthen" &&
         (norm.includes(p.industry.toLowerCase()) || p.industry.toLowerCase().includes(norm))
  );
  const negative = patterns.find(
    p => p.direction === "weaken" &&
         (norm.includes(p.industry.toLowerCase()) || p.industry.toLowerCase().includes(norm))
  );
  return { positive, negative };
}
