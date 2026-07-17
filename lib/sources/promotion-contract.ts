// ─── Provider-search → Vault promotion contract ──────────────────────────────
// Turns a source-benchmark result into a validated promotion candidate. Weak
// results are gated out (no promotion of ungrounded/undated/low-confidence
// signals). Everything carries provenance; nothing invents company facts.
// Promotions land in the Vault as pending_review (observation mode) so they
// NEVER enter the approved-only selector pool — ranking stays untouched.

export interface BenchmarkResultRow {
  query_id: string;
  region: string;
  signal: string;
  url: string;
  canonical_url: string;
  title: string | null;
  provider_first_seen: string;
  source_type: string | null;
  provider_date: string | null;
  extraction: { ok: boolean; extractor: string; fallback_used: boolean };
  resolved_date: { date: string | null; date_source: string; confidence: string; validation_method: string; conflict: boolean };
  auto_flags: Record<string, boolean | string>;
}

export interface ProviderSearchPromotionCandidate {
  source_result_id: string;         // sha(canonical_url + query_id)
  company: { canonical_name: string; domain: string | null; country: string | null; region: string | null };
  signal: { type: string; claim: string; publication_date: string | null; freshness_bucket: string; confidence: number };
  evidence: { canonical_url: string; source_type: string | null; provider: string; extraction_method: string; grounding_confidence: number; date_method: string; date_confidence: string; conflict: boolean };
  qualification: { relevant: boolean; date_valid: boolean; grounded_claim: boolean; qualified_opportunity: boolean; company_match: boolean };
  provenance: { query_id: string; created_at: string; benchmark_run: string | null };
}

const SIGNAL_MAP: Record<string, string> = {
  expansion: "expansion", hiring: "hiring", partnership: "partnership",
  product_launch: "product_launch", funding: "funding",
};

const REGION_COUNTRY: Record<string, { region: string; country: string }> = {
  US: { region: "north_america", country: "United States" },
  CO: { region: "latam", country: "Colombia" },
  MX: { region: "latam", country: "Mexico" },
};

function sha24(s: string): string {
  // lightweight deterministic id (djb2-ish, hex) — no node crypto needed at edges
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0") + s.length.toString(16);
}

import { resolveCanonicalCompanyFromSignal, isTitleLikeName } from "@/lib/vault/entity-resolution";

function companyName(title: string | null, url?: string | null): string | null {
  if (!title) return null;
  const raw = title.split(/[|]/)[0].trim();
  if (raw.length < 3 || raw.length > 120) return null;
  // Entity resolution: article titles become canonical names; unresolved
  // suspects are kept but will be flagged in review (never invented).
  const res = resolveCanonicalCompanyFromSignal({ currentCompanyName: raw, sourceUrl: url });
  return res.canonical_name.length >= 3 && res.canonical_name.length <= 80 ? res.canonical_name : null;
}

function domainOf(url: string): string | null {
  try { return new URL(url).host.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

function freshnessOf(dateIso: string | null): string {
  if (!dateIso) return "unknown";
  const days = (Date.now() - new Date(dateIso).getTime()) / 86_400_000;
  if (!Number.isFinite(days) || days < 0) return "unknown";
  return days <= 30 ? "fresh" : days <= 90 ? "recent" : "stale";
}

// ─── Promotion gates v2 (promotion-gates-v2) ─────────────────────────────────
// Deterministic pre-Vault precision gates derived from adjudication-taxonomy-v1
// error classes. Pure and observable: every rejection names its reason.
// Never touches ranking/scoring — a rejected row simply never becomes a
// candidate. Fail-closed on missing evidence.
export const PROMOTION_GATES_VERSION = "promotion-gates-v2";

const JOB_PAGE = /\b(jobs?|careers?|vacanc|hiring-now|glassdoor|indeed)\b|\/(jobs?|careers?)(\/|$)/i;
const SEO_LISTICLE = /\b(top|best)[- ]\d+|\bhow[- ]to\b|\bguide\b|\blisticle\b|\btrends\b|\branking(s)?\b|\bdirectory\b/i;
const INDEX_PAGE = /\/(news|newsroom|blog|press|category|tag)\/?$/i;
const CATEGORY_NAME = /\b(compan(y|ies)|agenc(y|ies)|staffing|providers?|vendors?|solutions)\s*$/i;
const NON_TARGET_GEO_TLD = /\.(uk|co\.uk|de|fr|it|es|jp|cn|in|au)(\/|$)/i;
const NON_TARGET_CURRENCY = /[£€¥]/;

export interface PromotionGateVerdict { pass: boolean; reasons: string[] }

export function evaluatePromotionGates(row: BenchmarkResultRow): PromotionGateVerdict {
  const f = row.auto_flags as Record<string, boolean>;
  const date = row.resolved_date?.date ?? null;
  const conf = row.resolved_date?.confidence ?? "none";
  const url = row.canonical_url ?? row.url ?? "";
  const title = row.title ?? "";
  const reasons: string[] = [];
  // Feature flag (safe default ON): PROMOTION_GATES_DISABLE_V2=true reverts to
  // the v1 baseline gates only — an operational escape hatch, never the default.
  const v2 = process.env.PROMOTION_GATES_DISABLE_V2 !== "true";

  // Baseline evidence gates (v1, kept)
  if (!f.relevant) reasons.push("not_relevant");
  if (!f.grounded_claim) reasons.push("ungrounded_claim");
  if (!row.extraction?.ok) reasons.push("extraction_failed");
  if (!date || conf === "low" || conf === "none") reasons.push("no_confident_date");

  // Entity gate: never promote headline/publisher/category-like identities.
  const name = companyName(title, url);
  if (!name) reasons.push("no_company_name");
  else if (v2) {
    if (isTitleLikeName(name)) reasons.push("headline_like_identity");
    if (CATEGORY_NAME.test(name)) reasons.push("category_like_identity");
    const host = domainOf(url) ?? "";
    const nameToken = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const hostCore = host.split(".")[0].replace(/[^a-z0-9]/g, "");
    // Publisher-as-company: name equals the publisher host for news/editorial pages.
    if (nameToken && hostCore && nameToken === hostCore && row.source_type !== "official" && row.source_type !== "company_website") {
      reasons.push("publisher_like_identity");
    }
  }

  if (v2) {
    // Page-type gate: job boards, SEO/listicles, bare index pages.
    if (JOB_PAGE.test(url) || /job posting|now hiring/i.test(title)) reasons.push("job_posting_page");
    if (SEO_LISTICLE.test(url) || SEO_LISTICLE.test(title)) reasons.push("seo_listicle_page");
    if (INDEX_PAGE.test(url)) reasons.push("index_page");

    // Event gate: a dated, non-stale canonical event (fresh90 policy).
    if (date && freshnessOf(date) === "stale") reasons.push("stale_event");
    if (!f.valid_date) reasons.push("invalid_date");

    // Opportunity gate: qualified commercial opportunity required for promotion.
    if (!f.qualified_opportunity) reasons.push("no_qualified_opportunity");
    if (!f.company_match) reasons.push("company_mismatch");

    // Geography gate: evidence must not contradict the query's target region.
    if (NON_TARGET_GEO_TLD.test(url)) reasons.push("geography_mismatch_tld");
    if (NON_TARGET_CURRENCY.test(title)) reasons.push("geography_mismatch_currency");
  }

  return { pass: reasons.length === 0, reasons };
}

/** Quality gate (rule 12: never promote weak). Returns null when the result
 *  fails any promotion-gates-v2 precision gate. */
export function benchmarkRowToPromotionCandidate(row: BenchmarkResultRow, benchmarkRun: string | null): ProviderSearchPromotionCandidate | null {
  const f = row.auto_flags as Record<string, boolean>;
  const date = row.resolved_date?.date ?? null;
  const conf = row.resolved_date?.confidence ?? "none";
  if (!evaluatePromotionGates(row).pass) return null;

  const name = companyName(row.title, row.canonical_url);
  if (!name) return null; // never invent a company name

  const rc = REGION_COUNTRY[row.region] ?? { region: "unknown", country: null as unknown as string };
  // Deterministic confidence 0–100 from date confidence + officiality + freshness.
  let confidence = 45;
  if (conf === "high") confidence += 25; else if (conf === "medium") confidence += 12;
  if (row.source_type === "official" || row.source_type === "regulatory") confidence += 15;
  if (freshnessOf(date) === "fresh") confidence += 15; else if (freshnessOf(date) === "recent") confidence += 8;
  if (row.resolved_date?.conflict) confidence -= 10;
  confidence = Math.max(0, Math.min(100, confidence));

  return {
    source_result_id: sha24(`${row.query_id}|${row.canonical_url}`),
    company: { canonical_name: name, domain: domainOf(row.canonical_url), country: rc.country ?? null, region: rc.region },
    signal: {
      type: SIGNAL_MAP[row.signal] ?? "other",
      claim: (row.title ?? "").slice(0, 300),
      publication_date: date,
      freshness_bucket: freshnessOf(date),
      confidence,
    },
    evidence: {
      canonical_url: row.canonical_url,
      source_type: row.source_type,
      provider: row.provider_first_seen,
      extraction_method: row.extraction.extractor,
      grounding_confidence: f.grounded_claim ? 0.8 : 0.4,
      date_method: row.resolved_date?.validation_method ?? "unknown",
      date_confidence: conf,
      conflict: !!row.resolved_date?.conflict,
    },
    qualification: {
      relevant: !!f.relevant, date_valid: !!f.valid_date, grounded_claim: !!f.grounded_claim,
      qualified_opportunity: !!f.qualified_opportunity, company_match: !!f.company_match,
    },
    provenance: { query_id: row.query_id, created_at: new Date().toISOString(), benchmark_run: benchmarkRun },
  };
}
