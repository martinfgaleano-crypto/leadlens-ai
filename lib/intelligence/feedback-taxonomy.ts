// ─── Feedback taxonomy v2 (shared: API + UI + learner) ───────────────────────
// Separates FOUR things the old taxonomy mixed: opportunity-quality sentiment,
// structured reasons, commercial/operational actions, and explanation quality.
// Backwards compatible: legacy signals keep working; new posts may add
// sentiment signals and optional reason codes.

export const SENTIMENT_SIGNALS = ["useful", "partially_useful", "not_useful"] as const;

/** Structured reason codes — closed enum, validated server-side. */
export const REASON_CODES = [
  // positive
  "strong_fit", "good_timing", "useful_evidence", "relevant_industry_region",
  // negative (opportunity quality)
  "wrong_fit", "too_small", "too_large", "weak_or_old_signal",
  "not_now", "insufficient_evidence",
  // negative but NOT opportunity quality (excluded from preference learning)
  "already_known", "already_contacted", "incorrect_information",
  // explanation quality — never opportunity quality
  "bad_explanation",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export const MAX_REASON_CODES_PER_EVENT = 6;

/** Reason codes the preference learner must NEVER interpret as fit signal:
 *  the account was fine — the customer already had it, the info was wrong,
 *  or the explanation (not the opportunity) was weak. */
export const LEARNING_EXCLUDED_REASONS: ReasonCode[] = [
  "already_known", "already_contacted", "bad_explanation", "incorrect_information",
];

/** Reason codes that scope the negative signal to freshness/timing ONLY —
 *  they say nothing about industry/region/signal-type fit. */
export const FRESHNESS_ONLY_REASONS: ReasonCode[] = ["not_now", "weak_or_old_signal"];

/** Reason codes that scope the signal to company size ONLY. */
export const SIZE_ONLY_REASONS: ReasonCode[] = ["too_small", "too_large"];

/** Normalize any feedback signal (new or legacy) to a fit sentiment.
 *  Returns null for operational/commercial events — contacted, replied,
 *  meeting_booked, add_to_vault, exclude_similar carry no fit sentiment and
 *  must not feed preference learning (documented compatibility policy). */
export function normalizeSentiment(signal: string): -1 | 0 | 1 | null {
  switch (signal) {
    case "useful": return 1;
    case "partially_useful": return 0;
    case "not_useful": return -1;
    // Legacy compatibility policy (documented in LEADLENS_INTELLIGENCE_FOUNDATION.md):
    case "irrelevant": return -1;   // legacy "Not relevant"
    case "wrong_fit": return -1;    // legacy explicit bad fit
    case "generic": return -1;      // legacy "Weak evidence"
    // Operational / commercial — never a fit sentiment:
    case "contacted": case "replied": case "meeting_booked":
    case "add_to_vault": case "exclude_similar":
    default:
      return null;
  }
}

export function validateReasonCodes(input: unknown): { ok: true; codes: ReasonCode[] } | { ok: false; error: string } {
  if (input === undefined || input === null) return { ok: true, codes: [] };
  if (!Array.isArray(input)) return { ok: false, error: "reason_codes must be an array" };
  if (input.length > MAX_REASON_CODES_PER_EVENT) return { ok: false, error: `reason_codes: max ${MAX_REASON_CODES_PER_EVENT}` };
  const codes: ReasonCode[] = [];
  for (const raw of input) {
    if (typeof raw !== "string" || !(REASON_CODES as readonly string[]).includes(raw)) {
      return { ok: false, error: `Unknown reason code: ${String(raw).slice(0, 40)}` };
    }
    if (!codes.includes(raw as ReasonCode)) codes.push(raw as ReasonCode); // unique, stable order
  }
  return { ok: true, codes };
}

/** Customer-facing labels (never show internal codes). */
export const REASON_LABELS: Record<ReasonCode, string> = {
  strong_fit: "Strong fit",
  good_timing: "Good timing",
  useful_evidence: "Useful evidence",
  relevant_industry_region: "Relevant industry / region",
  wrong_fit: "Wrong fit",
  too_small: "Company too small",
  too_large: "Company too large",
  weak_or_old_signal: "Weak or old signal",
  not_now: "Interesting, but not now",
  insufficient_evidence: "Insufficient evidence",
  already_known: "Already knew this company",
  already_contacted: "Already contacted",
  incorrect_information: "Incorrect information",
  bad_explanation: "Analysis or explanation was weak",
};
