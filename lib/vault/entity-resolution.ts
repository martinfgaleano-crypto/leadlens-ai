// ─── Entity resolution: canonical company name from a promoted signal ─────────
// Fixes article-titles-as-company-names ("Target launches new facility" →
// "Target"). Deterministic, honest: returns a confidence and NEVER invents —
// when no confident name can be derived, keeps the original flagged as suspect.

const ACTION_VERBS = /\b(launches?|announces?|opens?|expands?|boosts?|unveils?|introduces?|hires?|hiring|partners?|signs?|acquires?|invests?|reports?|plans?|starts?|begins?|lanza|anuncia|abre|expande|firma|contrata|invierte|inaugura|presenta|planea)\b/i;
const NEWS_DOMAINS = /(news|prnewswire|businesswire|globenewswire|reuters|bloomberg|forbes|techcrunch|yahoo|msn|prensa|portafolio|larepublica|eleconomista|milenio|expansion\.mx|elfinanciero|dcvelocity|supplychaindive|freightwaves|logisticsmgmt|ttnews|wsj|cnbc)/i;

export interface EntityResolution {
  canonical_name: string;
  confidence: "high" | "medium" | "low";
  method: "already_clean" | "title_prefix" | "corporate_domain" | "unresolved_suspect";
  identity_suspect: boolean;
  original_name: string;
}

export function isTitleLikeName(name: string): boolean {
  return name.split(/\s+/).length > 5 || ACTION_VERBS.test(name);
}

function titleCase(s: string): string {
  return s.split(/[\s_-]+/).map((w) => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
}

export function resolveCanonicalCompanyFromSignal(input: {
  currentCompanyName: string;
  sourceUrl?: string | null;
  sourceDomain?: string | null;
}): EntityResolution {
  const original = input.currentCompanyName.trim();
  if (!isTitleLikeName(original)) {
    return { canonical_name: original, confidence: "high", method: "already_clean", identity_suspect: false, original_name: original };
  }

  // Candidate 1: title prefix before the first action verb ("Target launches…" → "Target").
  const verbMatch = original.match(ACTION_VERBS);
  if (verbMatch && verbMatch.index !== undefined && verbMatch.index > 0) {
    const prefix = original.slice(0, verbMatch.index).replace(/['’]s\s*$/i, "").trim().replace(/[,:;–—-]+$/, "").trim();
    const words = prefix.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 4 && prefix.length >= 3 && prefix.length <= 60) {
      return { canonical_name: prefix, confidence: "medium", method: "title_prefix", identity_suspect: false, original_name: original };
    }
  }

  // Candidate 2: corporate domain base (never news/media domains).
  const domain = (input.sourceDomain ?? (() => { try { return new URL(input.sourceUrl ?? "").host; } catch { return null; } })())?.replace(/^www\./, "") ?? null;
  if (domain && !NEWS_DOMAINS.test(domain)) {
    const base = domain.split(".")[0];
    if (base && base.length >= 3 && base.length <= 30 && !/^\d+$/.test(base)) {
      return { canonical_name: titleCase(base), confidence: "medium", method: "corporate_domain", identity_suspect: false, original_name: original };
    }
  }

  // Unresolved: keep original, flagged — human review must fix identity.
  return { canonical_name: original, confidence: "low", method: "unresolved_suspect", identity_suspect: true, original_name: original };
}
