// ─── Lead Hunter policy engine v0 ─────────────────────────────────────────────
// Every source and candidate passes through here before storage or Vault
// promotion. Restricted categories are BLOCKED (never promotable); unknown
// usage rights force needs_review (promotable only after an admin resolves
// rights). Public company websites / news / job posts are allowed by default.
// See LEADLENS_DATA_SOURCING_COMPLIANCE.md.

import type {
  LeadHunterCandidate,
  LeadHunterSafetyDecision,
  LeadHunterSignalType,
  LeadHunterSourceCategory,
} from "./lead-hunter-types";

export const ALLOWED_SOURCE_CATEGORIES: LeadHunterSourceCategory[] = [
  "company_website",
  "public_job_post",
  "public_news",
  "public_directory_permitted",
  "event_conference_page",
  "marketplace_listing",
  "public_registry",
  "customer_provided",
  "other_permitted_public_source",
];

export const RESTRICTED_SOURCE_CATEGORIES: LeadHunterSourceCategory[] = [
  "apollo_without_license",
  "zoominfo_without_license",
  "linkedin_scraping",
  "paywalled_source",
  "private_database",
  "personal_social_profile",
  "unknown_rights",
];

export const SIGNAL_TYPES: LeadHunterSignalType[] = [
  "hiring", "expansion", "new_office", "funding", "product_launch",
  "partnership", "event_participation", "new_pricing_or_product_page",
  "marketplace_listing", "public_case_study", "growth_announcement",
  "regulatory_or_registry_update", "b2b_buying_trigger", "other",
];

export function isSourceCategoryAllowed(category: string): boolean {
  return (ALLOWED_SOURCE_CATEGORIES as string[]).includes(category);
}

export function getSourceCategoryRisk(category: string): "low" | "medium" | "high" {
  if ((RESTRICTED_SOURCE_CATEGORIES as string[]).includes(category)) return "high";
  if (category === "public_directory_permitted" || category === "marketplace_listing" || category === "other_permitted_public_source") return "medium";
  return "low";
}

/** Heuristic classification from a URL when the admin didn't pick a category.
 *  Conservative: anything unrecognized → unknown_rights (needs review). */
export function classifySourceCategory(url: string): LeadHunterSourceCategory {
  const u = url.toLowerCase();
  if (u.includes("linkedin.com")) return "linkedin_scraping"; // reference-only elsewhere; as a SOURCE it is blocked
  if (u.includes("apollo.io")) return "apollo_without_license";
  if (u.includes("zoominfo.com")) return "zoominfo_without_license";
  if (/(news|prensa|noticia|press|forbes|bloomberg|reuters|techcrunch|portafolio|larepublica|eleconomista)/.test(u)) return "public_news";
  if (/(jobs|careers|empleo|vacante|greenhouse|lever\.co|workable)/.test(u)) return "public_job_post";
  if (/(event|conference|expo|summit|feria|congreso)/.test(u)) return "event_conference_page";
  if (/(registro|registry|camara|rues|gov\.|\.gov)/.test(u)) return "public_registry";
  return "unknown_rights";
}

export interface SourceValidation {
  ok: boolean;
  safety_status: LeadHunterSafetyDecision;
  reason: string | null;
}

export function validateLeadHunterSource(input: {
  source_url?: string | null;
  source_category?: string | null;
  usage_rights_status?: string | null;
}): SourceValidation {
  if (!input.source_url?.trim()) {
    return { ok: false, safety_status: "blocked", reason: "source_url is required — provenance is mandatory." };
  }
  const category = input.source_category?.trim() || classifySourceCategory(input.source_url);
  if (!isSourceCategoryAllowed(category)) {
    return { ok: false, safety_status: "blocked", reason: `Source category "${category}" is restricted — see LEADLENS_DATA_SOURCING_COMPLIANCE.md.` };
  }
  const rights = input.usage_rights_status ?? "unverified";
  if (rights === "unverified" || rights === "unknown") {
    return { ok: true, safety_status: "needs_review", reason: "Usage rights unverified — resolve before Vault promotion." };
  }
  if (rights === "restricted") {
    return { ok: true, safety_status: "needs_review", reason: "Usage rights restricted — admin must confirm permitted use." };
  }
  return { ok: true, safety_status: "ok", reason: null };
}

export function validateCandidateSafety(candidate: Partial<LeadHunterCandidate>): SourceValidation {
  return validateLeadHunterSource({
    source_url: candidate.source_url,
    source_category: candidate.source_category,
    usage_rights_status: candidate.usage_rights_status,
  });
}

export function normalizeSignalType(input: string | null | undefined): LeadHunterSignalType {
  const v = (input ?? "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  if ((SIGNAL_TYPES as string[]).includes(v)) return v as LeadHunterSignalType;
  if (/hir|recruit|vacan|empleo/.test(v)) return "hiring";
  if (/fund|inversion|investment|series_/.test(v)) return "funding";
  if (/expan|grow|crecim/.test(v)) return "expansion";
  if (/launch|lanzamiento|product/.test(v)) return "product_launch";
  if (/partner|alianza/.test(v)) return "partnership";
  if (/event|conference|feria/.test(v)) return "event_participation";
  return "other";
}

/** Same conservative rule as Signal Date v0: date-driven, never invented. */
export function computeFreshnessStatus(signalDate: string | null | undefined): "fresh" | "recent" | "stale" | "unknown" {
  if (!signalDate) return "unknown";
  const t = new Date(signalDate).getTime();
  if (!Number.isFinite(t)) return "unknown";
  const days = (Date.now() - t) / 86_400_000;
  if (days < 0) return "unknown"; // future dates are suspect — never "fresh"
  if (days <= 30) return "fresh";
  if (days <= 90) return "recent";
  return "stale";
}

/** Evidence quality from what actually exists: snippet length + structured date. */
export function computeEvidenceQuality(input: { evidence_snippet?: string | null; signal_date?: string | null; source_category?: string | null }): "high" | "medium" | "low" {
  const snippetLen = input.evidence_snippet?.trim().length ?? 0;
  const hasDate = !!input.signal_date;
  const lowRisk = input.source_category ? getSourceCategoryRisk(input.source_category) === "low" : false;
  if (snippetLen >= 80 && hasDate && lowRisk) return "high";
  if (snippetLen >= 40 || hasDate) return "medium";
  return "low";
}

/** 0–100 confidence from evidence + freshness + category risk. Deterministic,
 *  explainable, and never higher than its inputs justify. */
export function computeCandidateConfidence(input: {
  evidence_snippet?: string | null;
  signal_date?: string | null;
  source_category?: string | null;
  signal_type?: string | null;
}): number {
  let score = 30; // base: named company + mandatory source
  const quality = computeEvidenceQuality(input);
  if (quality === "high") score += 30;
  else if (quality === "medium") score += 15;
  const freshness = computeFreshnessStatus(input.signal_date);
  if (freshness === "fresh") score += 25;
  else if (freshness === "recent") score += 15;
  else if (freshness === "stale") score += 5;
  if (input.signal_type && input.signal_type !== "other") score += 10;
  if (input.source_category && getSourceCategoryRisk(input.source_category) === "low") score += 5;
  return Math.min(100, score);
}
