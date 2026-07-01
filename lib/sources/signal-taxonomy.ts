/**
 * Signal Taxonomy — single source of truth for source type classification,
 * reliability, freshness expectations, and region confidence for the
 * Source Access & Freshness Layer v0.
 *
 * This file does NOT manage SourceProviders (Apollo, Google Maps, etc.)
 * — that's lib/sources/source-registry.ts.
 *
 * All thresholds are PROVISIONAL ASSUMPTIONS. Calibrate once real
 * signal_date data is available from production pipeline runs.
 * See SOURCE_STRATEGY.md §C for calibration plan.
 */

import type {
  SourceType,
  SourceReliability,
  FreshnessExpectation,
  RegionConfidence,
} from "@/types";

// ─── Source definition ────────────────────────────────────────────────────────

export interface SourceTaxonomyEntry {
  reliability: SourceReliability;
  freshness_expectation: FreshnessExpectation;
  /** True when this source can indicate a buying-window timing signal */
  is_timing_source: boolean;
  /** True when this source only provides company context (no timing) */
  is_context_source: boolean;
  /** PROVISIONAL: days until signal is no longer "fresh". null = not applicable */
  fresh_threshold_days: number | null;
  /** PROVISIONAL: days until signal is "stale". null = not applicable */
  stale_threshold_days: number | null;
}

// ─── Taxonomy table ───────────────────────────────────────────────────────────
// PROVISIONAL: all threshold values are design assumptions.
// Context-only sources get freshness_expectation: "not_applicable" and null thresholds.

const TAXONOMY: Record<SourceType, SourceTaxonomyEntry> = {
  news: {
    reliability: "medium",
    freshness_expectation: "high",
    is_timing_source: true,
    is_context_source: false,
    fresh_threshold_days: 45,   // PROVISIONAL
    stale_threshold_days: 60,   // PROVISIONAL — general timing signal stale threshold
  },
  job_posting: {
    reliability: "high",
    freshness_expectation: "high",
    is_timing_source: true,
    is_context_source: false,
    fresh_threshold_days: 30,   // PROVISIONAL
    stale_threshold_days: 60,   // PROVISIONAL
  },
  press_release: {
    reliability: "high",
    freshness_expectation: "high",
    is_timing_source: true,
    is_context_source: false,
    fresh_threshold_days: 30,   // PROVISIONAL
    stale_threshold_days: 60,   // PROVISIONAL
  },
  funding: {
    reliability: "high",
    freshness_expectation: "high",
    is_timing_source: true,
    is_context_source: false,
    fresh_threshold_days: 90,   // PROVISIONAL — rounds stay relevant longer
    stale_threshold_days: 180,  // PROVISIONAL
  },
  social: {
    reliability: "medium",
    freshness_expectation: "medium",
    is_timing_source: true,
    is_context_source: false,
    fresh_threshold_days: 30,   // PROVISIONAL
    stale_threshold_days: 60,   // PROVISIONAL
  },
  company_website: {
    reliability: "medium",
    freshness_expectation: "not_applicable",
    is_timing_source: false,
    is_context_source: true,
    fresh_threshold_days: null,
    stale_threshold_days: null,
  },
  directory: {
    reliability: "medium",
    freshness_expectation: "not_applicable",
    is_timing_source: false,
    is_context_source: true,
    fresh_threshold_days: null,
    stale_threshold_days: null,
  },
  public_registry: {
    reliability: "high",
    freshness_expectation: "not_applicable",
    is_timing_source: false,
    is_context_source: true,
    fresh_threshold_days: null,
    stale_threshold_days: null,
  },
  trade_association: {
    reliability: "medium",
    freshness_expectation: "not_applicable",
    is_timing_source: false,
    is_context_source: true,
    fresh_threshold_days: null,
    stale_threshold_days: null,
  },
  chamber_of_commerce: {
    reliability: "medium",
    freshness_expectation: "not_applicable",
    is_timing_source: false,
    is_context_source: true,
    fresh_threshold_days: null,
    stale_threshold_days: null,
  },
  export_import_resource: {
    reliability: "medium",
    freshness_expectation: "not_applicable",
    is_timing_source: false,
    is_context_source: true,
    fresh_threshold_days: null,
    stale_threshold_days: null,
  },
  customer_memory: {
    reliability: "high",
    freshness_expectation: "high",
    is_timing_source: true,
    is_context_source: false,
    fresh_threshold_days: 30,   // PROVISIONAL
    stale_threshold_days: 90,   // PROVISIONAL
  },
  demo: {
    reliability: "low",
    freshness_expectation: "not_applicable",
    is_timing_source: false,
    is_context_source: true,
    fresh_threshold_days: null,
    stale_threshold_days: null,
  },
  unknown: {
    reliability: "unknown",
    freshness_expectation: "not_applicable",
    is_timing_source: false,
    is_context_source: false,
    fresh_threshold_days: null,
    stale_threshold_days: null,
  },
};

// ─── Region confidence ────────────────────────────────────────────────────────
// Based on known public source availability per region (SOURCE_STRATEGY.md §B).
// "high"    = US/Canada/UK — demonstrably better public data coverage.
// "medium"  = Colombia/México — priority regions, partial public coverage.
// "low"     = all other regions — limited or unknown public source availability.
// "unknown" = no location data at all (conservative default).
// PROVISIONAL: no Source Access Layer yet; calibrate once real data shows coverage gaps.

const REGION_HIGH: RegExp[] = [
  /\b(united states|u\.s\.a?\.?|usa|us)\b/i,
  /\b(canada|canadian)\b/i,
  /\b(united kingdom|u\.k\.?|uk|england|scotland|wales|northern ireland)\b/i,
  /\b(new york|california|texas|florida|illinois|washington|georgia|massachusetts|colorado|ohio)\b/i,
  /\b(chicago|los angeles|san francisco|seattle|boston|austin|miami|denver|atlanta|portland)\b/i,
  /\b(toronto|vancouver|montreal|calgary|ottawa|winnipeg)\b/i,
  /\b(london|manchester|birmingham|edinburgh|glasgow|bristol|leeds)\b/i,
];

const REGION_MEDIUM: RegExp[] = [
  /\b(colombia|colombian)\b/i,
  /\b(bogot[aá]|medell[ií]n|cali|barranquilla|cartagena)\b/i,
  /\b(m[eé]xico|mexico|mexican)\b/i,
  /\b(ciudad de m[eé]xico|guadalajara|monterrey|puebla|tijuana)\b/i,
];

export function getRegionConfidence(location?: string | null): RegionConfidence {
  if (!location?.trim()) return "unknown";
  if (REGION_HIGH.some(re => re.test(location)))   return "high";
  if (REGION_MEDIUM.some(re => re.test(location)))  return "medium";
  return "low";
}

// ─── URL and text patterns for source type inference ─────────────────────────

const URL_PATTERNS: Array<{ regex: RegExp; type: SourceType }> = [
  { regex: /\b(indeed\.com|glassdoor\.com|linkedin\.com\/jobs|ziprecruiter\.com|monster\.com|simplyhired)\b/i, type: "job_posting" },
  { regex: /linkedin\.com\/company/i, type: "social" },
  { regex: /\b(businesswire\.com|prnewswire\.com|globenewswire\.com|accesswire\.com|einpresswire\.com)\b/i, type: "press_release" },
  { regex: /\b(crunchbase\.com|pitchbook\.com|techcrunch\.com\/fundings)\b/i, type: "funding" },
  { regex: /\b(reuters\.com|bloomberg\.com|techcrunch\.com|wsj\.com|ft\.com|bbc\.co\.uk|cnbc\.com|forbes\.com|entrepreneur\.com|businessinsider\.com|venturebeat\.com)\b/i, type: "news" },
  { regex: /\b(apollo\.io|zoominfo\.com|clearbit\.com|hunter\.io|peopledatalabs\.com)\b/i, type: "directory" },
  { regex: /\b\.gov\b|\bregistro\b|\bcámara\b|\bcamara\b|\bchamber\b/i, type: "public_registry" },
  { regex: /\btrade\.gov\b|\bexportgov\b|\bcomercio\b|\bexport\b.*\bassociation\b/i, type: "export_import_resource" },
];

const CLAIM_PATTERNS: Array<{ regex: RegExp; type: SourceType }> = [
  { regex: /\b(hiring|job opening|new position|recruiting|open role|posted a job|job posting)\b/i, type: "job_posting" },
  { regex: /\b(press release|announced|announcement|breaking news|newswire)\b/i, type: "press_release" },
  { regex: /\b(raised \$|series [a-z]|seed round|venture|backed by|investment round|funding round)\b/i, type: "funding" },
  { regex: /\b(news article|news coverage|reported by|according to .{0,40} news)\b/i, type: "news" },
  { regex: /\b(company website|official site|about us page|our company)\b/i, type: "company_website" },
  { regex: /\b(linkedin company page|linkedin profile)\b/i, type: "social" },
];

// Map LeadSource values to default SourceType
const LEAD_SOURCE_DEFAULTS: Record<string, SourceType> = {
  apollo:           "directory",
  hunter:           "directory",
  people_data_labs: "directory",
  tavily:           "unknown",  // tavily is a search engine — infer type from URL
  manual:           "unknown",
  mock:             "demo",
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function getSourceTaxonomy(sourceType: SourceType): SourceTaxonomyEntry {
  return TAXONOMY[sourceType] ?? TAXONOMY.unknown;
}

export function isTimingSource(sourceType: SourceType): boolean {
  return TAXONOMY[sourceType]?.is_timing_source ?? false;
}

export function isContextSource(sourceType: SourceType): boolean {
  return TAXONOMY[sourceType]?.is_context_source ?? true; // default conservative
}

/** PROVISIONAL thresholds */
export function getFreshThresholdDays(sourceType: SourceType): number {
  return TAXONOMY[sourceType]?.fresh_threshold_days ?? 45;
}

/** PROVISIONAL thresholds */
export function getStaleThresholdDays(sourceType: SourceType): number {
  return TAXONOMY[sourceType]?.stale_threshold_days ?? 60;
}

/**
 * Infer SourceType from a URL string.
 * Returns "unknown" if no pattern matches — never invents a type.
 */
export function inferSourceTypeFromUrl(url?: string | null): SourceType {
  if (!url) return "unknown";
  for (const { regex, type } of URL_PATTERNS) {
    if (regex.test(url)) return type;
  }
  return "unknown";
}

/**
 * Infer SourceType from a claim text string.
 * Returns "unknown" if no pattern matches — never invents a type.
 */
export function inferSourceTypeFromClaim(claim: string): SourceType {
  for (const { regex, type } of CLAIM_PATTERNS) {
    if (regex.test(claim)) return type;
  }
  return "unknown";
}

/**
 * Get default SourceType for a LeadSource value.
 * "tavily" returns "unknown" — its actual type depends on source_url.
 */
export function getDefaultSourceTypeForLeadSource(leadSource: string): SourceType {
  return LEAD_SOURCE_DEFAULTS[leadSource] ?? "unknown";
}
