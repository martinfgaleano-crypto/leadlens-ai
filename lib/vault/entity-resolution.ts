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

// ─── Entity classification v3 (entity-resolution-v3) ─────────────────────────
// Classifies a resolved name BEFORE it can become an account. Deterministic and
// fail-closed: composites are split (primary+secondary, never one merged
// account), facilities resolve to their operating company, publishers and
// categories are never accounts, ambiguity means no customer candidate.
// Never applied over human corrections — promotion-time only.

export const ENTITY_RESOLUTION_VERSION = "entity-resolution-v3";

export type EntityClass =
  | "single_company" | "multiple_companies" | "publisher" | "facility"
  | "product" | "category" | "generic_phrase" | "ambiguous" | "unresolved";

export interface EntityClassification {
  entity_class: EntityClass;
  /** The account a candidate may target. null → no customer candidate. */
  primary_account: string | null;
  secondary_participants: string[];
  relationship: "partnership" | "vendor_selection" | "acquisition" | null;
  target_confidence: "high" | "medium" | "low";
  method: string;
  resolver_version: typeof ENTITY_RESOLUTION_VERSION;
  original_value: string;
}

const COMPOSITE_JOIN = /\s+(?:and|y|e|\+|&)\s+/i;
const FACILITY_WORDS = /\b(receive center|distribution center|fulfillment center|centro de distribuci[oó]n|center|centre|facility|plant|planta|warehouse|bodega|hub|campus|terminal)\b/i;
const CATEGORY_PHRASES = /^(b2b\s+companies|companies\s+hiring|logistics\s+trends|news\s+and\s+trends|top\s+.*companies|best\s+.*companies)$/i;
const CATEGORY_TAIL = /\b(compan(y|ies)|agenc(y|ies)|staffing|providers?|vendors?|solutions|trends|news(room)?)\s*$/i;
const PRODUCT_HINT = /\b(platform|app|software|tool|suite|api)\s*$/i;
const capitalizedToken = /^[A-Z0-9][\w.+-]*$/;

function looksLikeCompanyToken(part: string): boolean {
  const words = part.trim().split(/\s+/);
  return words.length >= 1 && words.length <= 4 && words.every((w) => capitalizedToken.test(w)) && !CATEGORY_TAIL.test(part);
}

export function classifyEntity(input: {
  name: string;
  sourceUrl?: string | null;
  sourceType?: string | null;
  signalType?: string | null;
}): EntityClassification {
  const original = input.name.trim();
  const base = {
    secondary_participants: [] as string[], relationship: null as EntityClassification["relationship"],
    resolver_version: ENTITY_RESOLUTION_VERSION as typeof ENTITY_RESOLUTION_VERSION, original_value: original,
  };
  const host = (() => { try { return new URL(input.sourceUrl ?? "").host.replace(/^www\./, ""); } catch { return null; } })();

  if (!original || original.length < 2) {
    return { ...base, entity_class: "unresolved", primary_account: null, target_confidence: "low", method: "empty" };
  }
  if (CATEGORY_PHRASES.test(original) || CATEGORY_TAIL.test(original)) {
    return { ...base, entity_class: "category", primary_account: null, target_confidence: "low", method: "category_pattern" };
  }
  // Publisher-as-company: name equals the publisher host core on editorial pages.
  const nameToken = original.toLowerCase().replace(/[^a-z0-9]/g, "");
  const hostCore = host?.split(".")[0].replace(/[^a-z0-9]/g, "") ?? "";
  if (nameToken && hostCore && nameToken === hostCore && input.sourceType !== "official" && input.sourceType !== "company_website" && NEWS_DOMAINS.test(host ?? "")) {
    return { ...base, entity_class: "publisher", primary_account: null, target_confidence: "low", method: "publisher_host_match" };
  }
  // Composite: two company-like tokens joined by and/y/&/+ — split, never merge.
  const parts = original.split(COMPOSITE_JOIN);
  if (parts.length === 2 && looksLikeCompanyToken(parts[0]) && looksLikeCompanyToken(parts[1])) {
    const relationship = input.signalType === "partnership" ? "partnership" : null;
    return {
      ...base, entity_class: "multiple_companies",
      // Without deal-direction evidence we cannot pick the target account —
      // primary stays null (monitor/quarantine, never a merged customer account).
      primary_account: null,
      secondary_participants: [parts[0].trim(), parts[1].trim()],
      relationship, target_confidence: "low", method: "composite_split",
    };
  }
  // Facility: "<Company> <facility words>" — company is the account, facility is the event object.
  const facMatch = original.match(FACILITY_WORDS);
  if (facMatch && facMatch.index !== undefined && facMatch.index > 0) {
    const prefixWords = original.slice(0, facMatch.index).trim().split(/\s+/).filter(Boolean);
    const company = prefixWords.slice(0, 2).join(" ").replace(/['’]s$/i, "");
    if (company && looksLikeCompanyToken(company)) {
      return {
        ...base, entity_class: "facility", primary_account: company,
        secondary_participants: [original], target_confidence: "medium", method: "facility_prefix",
      };
    }
    return { ...base, entity_class: "facility", primary_account: null, target_confidence: "low", method: "facility_unresolved" };
  }
  if (isTitleLikeName(original)) {
    return { ...base, entity_class: "generic_phrase", primary_account: null, target_confidence: "low", method: "headline_like" };
  }
  if (PRODUCT_HINT.test(original)) {
    return { ...base, entity_class: "product", primary_account: null, target_confidence: "low", method: "product_pattern" };
  }
  if (!looksLikeCompanyToken(original) && original.split(/\s+/).length > 4) {
    return { ...base, entity_class: "ambiguous", primary_account: null, target_confidence: "low", method: "no_clear_token" };
  }
  return { ...base, entity_class: "single_company", primary_account: original, target_confidence: "high", method: "single_canonical" };
}
