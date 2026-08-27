// ─── Company-first discovery orchestrator (company-first-v1) ──────────────────
// The full replacement flow for news-first discovery:
//   needs map → company universe → per-company signal search → extract/validate
//   → Opportunity Test (fail-closed) → corroboration → LeadCandidate
// Adaptive: if a company's first signal round is all noise, one reformulated
// round runs (company + official-domain / stronger event verb). Investigates
// many companies, emits few — nothing is filled to hit a target.

import type { ICP, LeadSearchCriteria, LeadCandidate } from "@/types";
import { buildNeedsMap, type NeedsMap } from "./needs-map";
import { buildCompanyUniverse, type UniverseCompany } from "./company-universe";
import { opportunityTest, type OppStatus } from "./opportunity-test";
import { classifyMateriality } from "./materiality";
import { resolveCorporateIdentity, signalMatchesIdentity, type CorporateIdentity } from "./corporate-identity";
import { scoreOpportunityV2, corroborationTier } from "./quality-rubric";
import { classifyOrganization } from "./organization-type";
import { classifySignalKind } from "./event-vs-metric";
import { assessCommercialFit, requiredOperationTerms } from "./commercial-fit";
import { assessEntityRole } from "./entity-role";
import { classifyDirection } from "./sentiment";
import { assessCounterevidence, applyCounterevidence } from "./counterevidence";
import { adversarialReview } from "./adversarial-review";
import { noteUrl, noteOutcome, sourceUtilityScore, type DomainStats } from "./source-utility";
import { classifyProviderError } from "@/lib/ops/provider-health";
import { computeRunSourceDeltas, loadSourcePriors, persistSourceStats } from "./source-intelligence-store";
import { sanitizePublicContent } from "@/lib/security/public-content-sanitizer";
import { assessCatalogChannel, assessChannelAccess, buildChannelAccessQuery, channelAccessRelevant, channelAccessSearchHint, channelPageContentUsable, prioritizeChannelProofUrls } from "./channel-access";
import { buildAccountThesis } from "./account-thesis";
import { evaluateUniverseQuality, type UniverseQuality } from "./universe-quality";
import { applyObservedChannelDirection, evaluateChannelEvidence } from "./channel-evidence-contract";
import type { AccountCommercialRole } from "./account-role";

export const DISCOVERY_VERSION = "company-first-v1";

export interface DiscoveryBudget { maxCompanies: number; queriesPerCompany: number; maxExtractions: number; }
// Stage-1 org rejection + the 5-min wall-clock cap protect runtime, so we can
// afford more per-company event queries to recover recall (the lean budgets
// alone drove recall too low: only 1 opportunity across 3 ICPs in the
// 2026-07-20 benchmark). More queries on ELIGIBLE companies = better event
// coverage without spending on public/ineligible ones.
export const TIER_BUDGET: Record<string, DiscoveryBudget> = {
  preview: { maxCompanies: 15, queriesPerCompany: 1, maxExtractions: 18 },
  brief: { maxCompanies: 24, queriesPerCompany: 4, maxExtractions: 40 },
  intelligence: { maxCompanies: 36, queriesPerCompany: 4, maxExtractions: 64 },
  premium: { maxCompanies: 48, queriesPerCompany: 5, maxExtractions: 96 },
};
// Wall-clock cap so a pilot never runs unbounded (network latency/retries).
const MAX_DISCOVERY_MS = 5 * 60 * 1000;

export interface DiscoveryMetrics {
  needs_map_families: string[];
  companies_discovered: number; companies_verified: number;
  universe_rejected: Record<string, number>;
  universe_origin_counts: Record<string, number>;
  universe_visibility_counts: Record<string, number>;
  universe_role_counts: Record<string, number>;
  universe_accounts: Array<{
    company: string; domain: string | null; sector: string | null; country: string | null;
    origin: string; visibility: string; role: string; score: number | null;
  }>;
  dynamic_companies_with_verified_domain: number;
  universe_quality: UniverseQuality;
  company_signal_queries: number; urls: number; extractions: number; junk_urls_skipped: number;
  candidates_with_valid_date: number; candidates_company_matched: number;
  opp_status_counts: Record<OppStatus, number>;
  materiality_counts: Record<string, number>;
  signal_kind_counts: Record<string, number>;
  role_counts: Record<string, number>;
  direction_counts: Record<string, number>;
  channel_evidence_grades: Record<string, number>;
  org_rejected: Record<string, number>;
  rubric_verdicts: Record<string, number>;
  homonyms_rejected: number;
  adversarial_verdicts: Record<string, number>; adversarial_disagreements: number;
  source_stats: Record<string, DomainStats>;
  emitted: number; defensible_emitted: number; preliminary_emitted: number;
  dynamic_emitted: number; dynamic_defensible_emitted: number; error_taxonomy: Record<string, number>;
  // Operating-mode honesty: how this run actually obtained evidence.
  operating_mode: "full_discovery" | "targeted_discovery" | "provider_limited" | "analysis_only" | "stopped";
  providers_available: string[]; providers_missing: string[]; provider_status: Record<string, string>;
  coverage_limitation: string | null;
  fresh_search_count: number; fresh_extraction_count: number; reused_evidence_count: number;
  confidence_impact: string | null;
  // Per-candidate trace of everything that reaches deep validation (passed the
  // Opportunity Test). Lets a human see WHY real dated events were confirmed or
  // rejected downstream — the substrate for calibration/human review.
  deep_trace: Array<{ company: string; title: string; sigKind: string; role: string; direction: string; materiality: string; operational_fit: boolean; fit_score: number; fit_blockers: string[]; score: number | null; verdict: string; date: string | null; outcome: string; adversarial_objections?: string[] }>;
  // Recall audit: public search results considered but not necessarily paid for
  // via extraction. Bounded to keep artifacts small and safe.
  search_trace: Array<{ company: string; round: number; query_kind: "event" | "channel_access"; freshness_days: number | null; query: string; result_count: number; results: Array<{ title: string; url: string; provider: string; selected_for_extraction: boolean; event_hint: boolean; access_hint: number; utility: number }> }>;
  duration_ms: number; est_cost_usd: number;
}

export function calculateDiscoveryCost(queries: number, extractions: number, enumerationQueries: number): number {
  return Number((queries * 0.002 + extractions * 0.008 + enumerationQueries * 0.004).toFixed(6));
}

const EVENT_VERBS_ES: Record<string, string[]> = {
  expansion: ['"amplió su operación"', '"expansión"', '"abrió una nueva sede"'],
  new_facility: ['"nuevo centro de distribución"', '"nueva bodega"', '"inauguró planta"'],
  fleet_growth: ['"amplió su flota"', '"incorporó vehículos"', '"renovó su flota"'],
  infrastructure: ['"nueva infraestructura"', '"centro logístico"'],
  investment: ['"invierte"', '"inversión"', '"anunció inversión"'],
  acquisition: ['"adquirió"', '"compró"', '"adquisición"'],
  partnership: ['"firma alianza"', '"anunció acuerdo"', '"alianza estratégica"'],
  operational_transformation: ['"moderniza operación"', '"transformación digital"'],
  capacity: ['"amplió capacidad"', '"aumentó capacidad"'],
  contract_award: ['"nuevo contrato"', '"adjudicó contrato"', '"ganó contrato"'],
  new_market: ['"entra a nuevo mercado"', '"llega a"', '"expansión regional"'],
  technology_change: ['"implementa tecnología"', '"automatización"', '"nuevo sistema"'],
  regulatory: ['"cumplimiento normativo"', '"regulación"'],
};
const EVENT_VERBS_EN: Record<string, string[]> = {
  expansion: ['"expanded operations"', '"opened a new"'], new_facility: ['"new distribution center"', '"opened a new facility"'],
  fleet_growth: ['"expanded its fleet"'], infrastructure: ['"new logistics center"'], investment: ['"invests in"', '"announced investment"'],
  acquisition: ['"acquired"'], partnership: ['"announced a strategic partnership"'], operational_transformation: ['"digital transformation"'],
  capacity: ['"expanded capacity"'], contract_award: ['"awarded a contract"', '"won a contract"'], new_market: ['"enters new market"'],
  technology_change: ['"implements"', '"automation"'], regulatory: ['"compliance"'],
};

// Guaranteed non-event pages (social, encyclopedias, stores, directories) and
// foreign-Spanish domains. Filtering these BEFORE extraction spends the scarce
// extraction budget on real candidate pages instead of pages a hard blocker
// would reject anyway — this raises effective recall without touching any gate.
const JUNK_URL = /(facebook\.com|instagram\.com|youtube\.com|tiktok\.com|twitter\.com|x\.com\/|linkedin\.com|wikipedia\.org|\.wiki(?:\/|$|\.)|\.fandom\.|play\.google\.|apps\.apple\.|tracxn\.com|crunchbase\.com|trustpilot\.|glassdoor\.|tripadvisor\.|booking\.com|expedia\.com|hotels\.com|hoteltonight\.com|planetofhotels\.com|mapquest\.com|indeed\.com|naukri\.com|expertini\.com|foundit\.|levels\.fyi|coursehero\.com|amazon\.com|ebay\.com|deviantart\.com|zoominfo\.com|owler\.com|\/directorio|\/directory|paginasamarillas|pinterest\.)/i;
// Foreign country TLDs for a Colombia run — a .cl/.ar/.mx/.es domain is almost
// always a same-language homonym, not the Colombian account (the geography hard
// blocker would reject it later; skip it before we pay to extract).
const FOREIGN_CO_TLD = /\.(cl|ar|mx|pe|es|ec|uy|py|bo|ve|gt|cr|pa)(\/|$|\.)/i;
function isJunkUrl(url: string, spanish: boolean): boolean {
  if (JUNK_URL.test(url)) return true;
  if (spanish) { try { const h = new URL(url).host; if (FOREIGN_CO_TLD.test(h)) return true; } catch { /* ignore */ } }
  return false;
}

// Word-boundary company-name match. Substring matching caused the "Inter"/
// Nu-bank false positive ("inter" ⊂ "internacional"): a company token must
// appear as a complete word. For names longer than 18 chars the tail may be
// truncated mid-word, so the trailing boundary only applies to full names.
export function companyNameInText(name: string, text: string): boolean {
  const full = name.toLowerCase();
  const frag = full.slice(0, Math.min(18, full.length));
  const esc = frag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tail = full.length <= 18 ? "(?=$|[^\\p{L}\\p{N}])" : "";
  try { return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}${tail}`, "iu").test(text.toLowerCase()); }
  catch { return text.toLowerCase().includes(frag); }
}

// A needs-family EVENT verb must appear in the page for it to be a material
// event (not just a page that mentions the company).
export function eventVerbPresent(hay: string, needs: NeedsMap, spanish: boolean): boolean {
  const verbs = spanish ? EVENT_VERBS_ES : EVENT_VERBS_EN;
  for (const fam of needs.relevant_signal_families) {
    for (const v of (verbs[fam] ?? [])) {
      const core = v.replace(/"/g, "").toLowerCase().split(" ")[0]; // first word of the phrase
      if (core.length >= 4 && hay.includes(core)) return true;
    }
  }
  // Vertical-specific queries and validation must share a vocabulary contract.
  // These are concrete changes, not static sector keywords.
  const wellnessContext = /bienestar|wellness|bebidas? funcional|functional beverage|productos? naturales|spa|hotel|retail/i.test(`${needs.buyer_problem} ${needs.expected_need} ${needs.target_company_profile}`);
  if (wellnessContext && /\b(nueva tienda|abre nueva|abrir[aá]|ampli[oó] su surtido|nueva categor[ií]a|programa de bienestar|alianza wellness|nuevo spa|apertura de hotel|nuevo hotel|abre hotel|ampli[oó] su spa|nuevo men[uú]|nueva experiencia wellness|alianza de bienestar)\b/i.test(hay)) return true;
  return false;
}

export function buildCompanyQueries(company: string, domain: string | null, needs: NeedsMap, spanish: boolean, n: number, round2 = false, enableChannelAccess = false, accountRole?: AccountCommercialRole): string[] {
  const verbs = spanish ? EVENT_VERBS_ES : EVENT_VERBS_EN;
  const phrases: string[] = [];
  for (const fam of needs.relevant_signal_families) for (const v of (verbs[fam] ?? [])) phrases.push(v);
  const wellnessContext = spanish && /bienestar|bebidas? funcional|productos? naturales|spa|hotel|retail/i.test(`${needs.buyer_problem} ${needs.expected_need}`);
  // Event-first families for physical/retail/hospitality/wellness ICPs: prioritise
  // DATED events (openings, new programs, supplier onboarding, partnerships,
  // gifting, renovation) over static portfolio/catalog pages — the diagnosed
  // Amor de Gea bottleneck (fit estático → channel_access → investigate).
  const wellnessSpecific = wellnessContext
    ? accountRole === "hospitality_operator"
      ? [
          '("apertura de hotel" OR "nuevo hotel" OR "abre hotel" OR "inauguró" OR "nueva sede")',
          '("nuevo spa" OR "renovación de spa" OR "programa de bienestar" OR "wellness amenities" OR "nueva experiencia de bienestar")',
          '("nuevo menú" OR "nueva carta" OR "alianza de bienestar" OR "productos locales" OR "marca invitada")',
          '("convocatoria de proveedores" OR "abastecimiento local" OR "compras sostenibles" OR "nuevos aliados")',
        ]
      : [
          '("nueva tienda" OR "abre nueva" OR "abrirá" OR "inauguró" OR "nueva sede" OR "expansión")',
          '("amplió su surtido" OR "nueva categoría" OR "nueva línea" OR "bebidas funcionales" OR "productos naturales")',
          '("programa de bienestar" OR "alianza wellness" OR "convenio" OR "partnership" OR "marca invitada")',
          '("registro de proveedores" OR "convocatoria de proveedores" OR "proveedores locales" OR "sourcing")',
          '("regalos corporativos" OR "kits de bienestar" OR "employee gifting" OR "renovación" OR "relanzamiento")',
        ]
    : [];
  const uniq = Array.from(new Set([...wellnessSpecific, ...phrases]));
  const excl = spanish ? "-tendencias -empleo -directorio -ranking" : "-trends -jobs -directory -ranking";
  const year = new Date().getFullYear();
  const yearWindow = `(${year} OR ${year - 1})`;
  // Geo-bias: gl=co alone lets Serper return .cl/.ar/.es homonyms; naming the
  // country in the query strongly biases toward the Colombian entity. Foreign
  // exclusions further suppress same-language homonyms.
  const geo = spanish ? " Colombia -site:cl -site:ar -site:es -site:mx" : "";
  const specificQueries = uniq.map((p) => `"${company}" ${p} ${yearWindow}${geo} ${excl}`);
  // Product/channel searches maximize account breadth: commercial access is
  // the first lane, while the second round becomes the event rescue lane.
  if (round2) {
    const generic = `"${company}" ${spanish ? "anuncio comunicado" : "announcement press release"} ${yearWindow}${geo} ${excl}`;
    // Preview has a single rescue query: spend it on the most relevant causal
    // event, not generic corporate-news language. Larger tiers retain one broad
    // fallback after their specific queries.
    if (n <= 1) return [specificQueries[0] ?? generic];
    return [...specificQueries.slice(0, n - 1), generic].slice(0, n);
  }
  const qs = specificQueries.slice(0, n);
  if (domain && enableChannelAccess) qs.unshift(buildChannelAccessQuery(domain, spanish ? "es" : "en", accountRole));
  return qs.slice(0, n);
}

export function evaluateDiscoveryValue(company: UniverseCompany, titleAndContent: string): { level: "high" | "medium" | "low"; reason: string } {
  const visibility = company.visibility_tier ?? "unknown";
  const hasNonObviousAngle = /convocatoria.{0,40}proveedor|busca.{0,30}proveedor|nueva categor[ií]a|ampli[oó].{0,20}surtido|incorpor[oó].{0,30}(marca|producto)|programa de bienestar|category reset|vendor onboarding/i.test(titleAndContent);
  if (visibility === "obvious") {
    return hasNonObviousAngle
      ? { level: "medium", reason: "Cuenta ampliamente conocida, pero la señal aporta un ángulo específico de categoría/proveedores." }
      : { level: "low", reason: "Cuenta ampliamente conocida con una señal genérica que el cliente probablemente identificaría sin LeadLens." };
  }
  if (visibility === "emerging") return { level: "high", reason: "Cuenta especializada o emergente fuera del conjunto obvio, con evidencia comercial verificable." };
  return { level: "medium", reason: "Cuenta no clasificada como obvia y con evidencia comercial verificable." };
}

export function isDefensibleCandidate(candidate: LeadCandidate): boolean {
  return candidate.opportunity_kind !== "channel_fit" || ["strong", "moderate"].includes(candidate.channel_evidence_grade ?? "");
}

/** Preview may stop early only for defensible evidence. A preliminary channel
 * hypothesis must trigger the event-rescue round instead of terminating the
 * company's research. */
export function shouldContinueCompanySearch(best: { cand: LeadCandidate; score: number } | null, tier: string): boolean {
  if (!best || !isDefensibleCandidate(best.cand)) return true;
  return tier !== "preview" && best.score < 85;
}

/** Monitor hypotheses are retained for transparency but never consume the
 * customer-facing quota ahead of defensible opportunities. */
export function prioritizeDiscoveryPortfolio(candidates: LeadCandidate[], limit: number): LeadCandidate[] {
  return [...candidates].sort((a, b) => Number(isDefensibleCandidate(b)) - Number(isDefensibleCandidate(a))
    || (b.confidence_score ?? 0) - (a.confidence_score ?? 0)).slice(0, limit);
}

export function chooseBetterCandidate(
  current: { cand: LeadCandidate; score: number } | null,
  next: { cand: LeadCandidate; score: number },
): { cand: LeadCandidate; score: number } {
  if (!current) return next;
  const currentDefensible = isDefensibleCandidate(current.cand);
  const nextDefensible = isDefensibleCandidate(next.cand);
  if (currentDefensible !== nextDefensible) return nextDefensible ? next : current;
  return next.score > current.score ? next : current;
}

export function companyUrlKey(company: string, url: string): string {
  return `${company.trim().toLowerCase()}|${url}`;
}

export function eventResultEligibleForExtraction(company: string, queryKind: "event" | "channel_access", title: string | null, snippet: string | null): boolean {
  return queryKind === "channel_access" || companyNameInText(company, `${title ?? ""} ${snippet ?? ""}`);
}

export function knownDomainIdentityConfidence(input: {
  lexical_score: number;
  origin?: "vertical_seed" | "dynamic_enumeration" | "unknown";
  official_page_observes_name: boolean;
}): number {
  let score = Math.min(85, Math.max(0, input.lexical_score));
  // A curated seed maps brand → corporate domain explicitly. This is stronger
  // than lexical host similarity (Supernat → supermercadonaturista.com), but
  // still capped below a fully corroborated live identity resolution.
  if (input.origin === "vertical_seed") score = Math.max(score, 70);
  if (input.official_page_observes_name) score = Math.max(score, input.origin === "vertical_seed" ? 82 : 75);
  return Math.min(85, score);
}

export function accountRoleEligibleForOffer(role: AccountCommercialRole | undefined, physicalChannelOffer: boolean): boolean {
  if (!physicalChannelOffer) return role !== "service_provider" && role !== "seller_network";
  return role !== "brand_owner" && role !== "service_provider" && role !== "seller_network";
}

export async function runCompanyFirstDiscovery(
  icp: ICP, criteria: LeadSearchCriteria, tier: string, limit: number,
  options: { costCapUsd?: number } = {},
): Promise<{ candidates: LeadCandidate[]; metrics: DiscoveryMetrics; needs: NeedsMap }> {
  const t0 = Date.now();
  const budget = TIER_BUDGET[tier] ?? TIER_BUDGET.preview;
  const spanish = criteria.output_language === "es" || criteria.target_market_region === "latin_america";
  const gl = criteria.target_market_region === "latin_america" ? "co" : "us";

  const { braveProvider, serperProvider, tavilyProvider } = await import("@/lib/sources/access/providers");
  const { extractWithFallback } = await import("@/lib/sources/access/extractors");
  const { resolvePublicationDate } = await import("@/lib/sources/access/date-resolver");

  // 1. Needs map, then company universe.
  const needs = await buildNeedsMap(icp, criteria);
  const universe = await buildCompanyUniverse(icp, criteria, needs, { maxCompanies: budget.maxCompanies });

  const metrics: DiscoveryMetrics = {
    needs_map_families: needs.relevant_signal_families,
    companies_discovered: universe.companies.length, companies_verified: universe.companies.length,
    universe_rejected: universe.stats.rejected,
    universe_origin_counts: {}, universe_visibility_counts: {}, universe_role_counts: {},
    universe_accounts: universe.companies.map(c => ({
      company: c.name, domain: c.domain, sector: c.sector, country: c.country,
      origin: c.universe_origin ?? "unknown", visibility: c.visibility_tier ?? "unknown",
      role: c.account_role ?? "unknown", score: c.universe_score ?? null,
    })),
    dynamic_companies_with_verified_domain: universe.companies.filter(c => c.universe_origin === "dynamic_enumeration" && c.confidence === "verified" && !!c.domain).length,
    universe_quality: evaluateUniverseQuality(universe.companies),
    company_signal_queries: 0, urls: 0, extractions: 0, junk_urls_skipped: 0,
    candidates_with_valid_date: 0, candidates_company_matched: 0,
    opp_status_counts: { opportunity: 0, investigate: 0, monitor: 0, reject: 0 },
    materiality_counts: {}, signal_kind_counts: {}, role_counts: {}, direction_counts: {}, channel_evidence_grades: {}, org_rejected: {}, rubric_verdicts: {}, homonyms_rejected: 0,
    emitted: 0, defensible_emitted: 0, preliminary_emitted: 0, dynamic_emitted: 0, dynamic_defensible_emitted: 0, error_taxonomy: {}, deep_trace: [], search_trace: [], adversarial_verdicts: {}, adversarial_disagreements: 0, source_stats: {},
    operating_mode: "provider_limited", providers_available: [], providers_missing: [], provider_status: {}, coverage_limitation: null,
    fresh_search_count: 0, fresh_extraction_count: 0, reused_evidence_count: 0, confidence_impact: null,
    duration_ms: 0, est_cost_usd: 0,
  };
  for (const c of universe.companies) {
    const origin = c.universe_origin ?? "unknown";
    const visibility = c.visibility_tier ?? "unknown";
    metrics.universe_origin_counts[origin] = (metrics.universe_origin_counts[origin] ?? 0) + 1;
    metrics.universe_visibility_counts[visibility] = (metrics.universe_visibility_counts[visibility] ?? 0) + 1;
    const accountRole = c.account_role ?? "unknown";
    metrics.universe_role_counts[accountRole] = (metrics.universe_role_counts[accountRole] ?? 0) + 1;
  }
  const tax = (k: string) => (metrics.error_taxonomy[k] = (metrics.error_taxonomy[k] ?? 0) + 1);
  let budgetExhausted = false;
  const projectedCost = (extraQueries = 0, extractions = 0) =>
    calculateDiscoveryCost(metrics.company_signal_queries + extraQueries, metrics.extractions + extractions, universe.stats.enumeration_queries);
  const canSpend = (extraQueries = 0, extractions = 0) => options.costCapUsd === undefined || projectedCost(extraQueries, extractions) <= options.costCapUsd;

  const out: LeadCandidate[] = [];
  const seenCompanyUrl = new Set<string>();
  const extractionCache = new Map<string, { ok: boolean; content: string; extractor: string; fallback_used: boolean }>();

  // Client product capability terms + the operation the ICP requires (for
  // commercial/operational fit). Derived once from the criteria + needs map.
  const productTerms = `${criteria.offer_summary ?? ""} ${criteria.value_proposition ?? ""}`.toLowerCase().split(/[^a-záéíóúñ]+/).filter((w) => w.length >= 5).slice(0, 12);
  const opTerms = requiredOperationTerms(needs);
  const enableChannelAccess = channelAccessRelevant(`${criteria.offer_summary ?? ""} ${criteria.value_proposition ?? ""} ${criteria.target_industries.join(" ")} ${needs.target_company_profile}`);
  // Per-domain utility ledger — written into metrics.source_stats and USED to
  // order extraction (see ranked below). Seeded with decayed cross-run priors
  // (compounding loop: every run teaches the next which domains yield events).
  const sourcePriors = loadSourcePriors();
  const sourceLedger: Record<string, DomainStats> = JSON.parse(JSON.stringify(sourcePriors));
  const touchedDomains = new Set<string>();

  const provYield: Record<string, number> = {};
  const providerRunStatus: Record<string, string> = {};
  const daysOld = (iso: string | null) => { if (!iso) return null; const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000); return Number.isFinite(d) && d >= 0 ? d : null; };

  for (const company of universe.companies) {
    const defensibleCount = out.filter(isDefensibleCandidate).length;
    if (budgetExhausted || defensibleCount >= limit || metrics.extractions >= budget.maxExtractions || Date.now() - t0 > MAX_DISCOVERY_MS) break;

    // Stage 1 — organization type / fit BEFORE any signal search (runtime win +
    // fixes public-service entities like Metro de Medellín slipping through).
    const org = classifyOrganization({ name: company.name, description: company.sector });
    if (!org.eligible_for_icp) { metrics.org_rejected[org.organization_type] = (metrics.org_rejected[org.organization_type] ?? 0) + 1; tax(`org_${org.organization_type}`); continue; }
    if (!accountRoleEligibleForOffer(company.account_role, enableChannelAccess)) { tax(`account_role_presearch_reject:${company.account_role}`); continue; }

    let best: { cand: LeadCandidate; score: number } | null = null;
    let identity: CorporateIdentity | null = null;
    let sellerDirectionObserved = false;
    const companyDomains = new Set<string>();  // independent source domains for corroboration

    for (let round = 0; round < 2 && shouldContinueCompanySearch(best, tier); round++) {
      const queries = buildCompanyQueries(company.name, company.domain, needs, spanish, budget.queriesPerCompany, round === 1, enableChannelAccess, company.account_role);
      const results: { url: string; canonical_url: string; title: string | null; snippet: string | null; published_date: string | null; source_type: string | null; provider: string; query_kind: "event" | "channel_access"; query: string }[] = [];
      const roundQueryLog: Array<{ query: string; kind: "event" | "channel_access" }> = [];
      for (const q of queries) {
        if (!canSpend(1, 0)) { budgetExhausted = true; tax("budget_cap_reached_before_query"); break; }
        metrics.company_signal_queries++;
        const queryKind: "event" | "channel_access" = /^site:/i.test(q) && /provider|proveedor|brand|marca|distribu|vendor/i.test(q) ? "channel_access" : "event";
        roundQueryLog.push({ query: q, kind: queryKind });
        const sOpts = {
          language: spanish ? "es" : "en", region: gl, max_results: 5,
          query_type: "company_specific" as const,
          ...(queryKind === "event" ? { freshness_days: 180 } : {}),
        };
        // Three complementary search sources. Tavily surfaces real editorial/news
        // domains (Serper alone floods social media; Brave is unavailable without
        // a key), so it materially lifts real-event recall.
        const catchErr = (e: unknown) => ({ results: [] as never[], ok: false, error: e instanceof Error ? e.message : String(e) });
        const [brave, serper, tavily] = await Promise.all([
          braveProvider.search({ query: q, ...sOpts }).catch(catchErr),
          serperProvider.search({ query: q, ...sOpts }).catch(catchErr),
          tavilyProvider.search({ query: q, ...sOpts }).catch(catchErr),
        ]);
        // Per-run provider status: a provider that ever returns results is
        // "available"; one that only ever errors is recorded with WHY (quota vs
        // auth vs request), so coverage never conflates "down" with "no hits".
        for (const [name, resp] of [["brave", brave], ["serper", serper], ["tavily", tavily]] as const) {
          if (resp.results.length) { provYield[name] = (provYield[name] ?? 0) + resp.results.length; providerRunStatus[name] = "available"; }
          else if ((resp as { ok?: boolean }).ok === false && providerRunStatus[name] !== "available") providerRunStatus[name] = classifyProviderError((resp as { error?: string }).error);
          else if (!providerRunStatus[name]) providerRunStatus[name] = "healthy_no_results";
        }
        for (const r of [...brave.results, ...serper.results, ...tavily.results]) {
          const dedupeKey = companyUrlKey(company.name, r.canonical_url);
          if (seenCompanyUrl.has(dedupeKey)) continue;
          seenCompanyUrl.add(dedupeKey);
          if (isJunkUrl(r.canonical_url, spanish)) { metrics.junk_urls_skipped++; tax("prefilter_junk_or_foreign"); continue; }
          results.push({ ...r, snippet: r.snippet ?? null, query_kind: queryKind, query: q }); metrics.urls++;
          try { const resultDomain = new URL(r.canonical_url).host.replace(/^www\./, ""); touchedDomains.add(resultDomain); noteUrl(sourceLedger, resultDomain); } catch { /* ignore */ }
        }
      }
      // Targeted corporate research: when search yields NOTHING for a company
      // that has a verified corporate domain, inspect the corporate site itself
      // (1 extraction). Honest: source_type company_website; the date/material
      // gates still decide — this adds coverage, never fabricates events.
      if (results.length === 0 && company.domain && round === 1) {
        const fallbackQuery = buildChannelAccessQuery(company.domain, spanish ? "es" : "en", company.account_role);
        results.push({ url: `https://${company.domain}`, canonical_url: `https://${company.domain}`, title: company.name, snippet: null, published_date: null, source_type: "company_website", provider: "targeted_corporate", query_kind: "channel_access", query: fallbackQuery });
        if (!roundQueryLog.some(x => x.query === fallbackQuery)) roundQueryLog.push({ query: fallbackQuery, kind: "channel_access" });
        metrics.reused_evidence_count += 0; // corporate fetch is fresh, tracked via extractions
      }
      // Extract event-bearing pages first: a result whose TITLE already carries a
      // needs-family event verb is far likelier to be a real signal than the
      // provider's top hit (often a homepage/about page). Ties are broken by
      // SOURCE UTILITY: domains that have produced dated trigger events (this
      // run or in observed benchmarks) get the scarce extraction budget before
      // proven date-less/noise domains. No gate is relaxed by ordering.
      const rankedWithScores = results
        .map((r) => {
          const d = (() => { try { return new URL(r.canonical_url).host.replace(/^www\./, ""); } catch { return ""; } })();
          const hasEvent = eventVerbPresent((r.title ?? "").toLowerCase(), needs, spanish);
          const associationHint = companyNameInText(company.name, `${r.title ?? ""} ${r.snippet ?? ""}`);
          const accessHint = enableChannelAccess ? channelAccessSearchHint(r.title ?? "", r.canonical_url) : 0;
          const lanePriority = r.query_kind === "channel_access" ? accessHint : (associationHint ? Number(hasEvent) * 4 + 2 : -4);
          return { r, hasEvent, associationHint, accessHint, lanePriority, util: sourceUtilityScore(sourceLedger, d) };
        })
        .sort((a, b) => (b.lanePriority - a.lanePriority) || (b.util - a.util));
      let ranked = rankedWithScores.map((x) => x.r);
      // Preview favors breadth: at most one paid extraction per company/round,
      // so 2 noisy companies cannot consume the entire 15-company budget.
      const extractionPerRound = tier === "preview" ? 1 : 2;
      const catalogAccess = enableChannelAccess && company.domain
        ? assessCatalogChannel({ company: company.name, domain: company.domain, results: ranked.map(r => ({ title: r.title, url: r.canonical_url })) })
        : null;
      // If the result set itself proves a multi-brand catalog, validate one of
      // those exact official pages. Otherwise the single preview extraction can
      // be consumed by an unrelated event/home page and the recoverable channel
      // hypothesis disappears despite already being visible in search metadata.
      if (catalogAccess?.qualifies && catalogAccess.evidence_urls?.length) {
        ranked = prioritizeChannelProofUrls(ranked, catalogAccess.evidence_urls);
      }
      // Search engines sometimes ignore the quoted company and return a valid
      // event for another brand. Do not pay to extract it unless title/snippet
      // visibly associates the queried company. Official channel pages remain
      // eligible because identity is verified after extraction.
      const extractionRanked = ranked.filter(r => eventResultEligibleForExtraction(company.name, r.query_kind, r.title, r.snippet));
      const selectedUrls = new Set(extractionRanked.slice(0, extractionPerRound).map(r => r.canonical_url));
      if (metrics.search_trace.length < 80) {
        for (const qlog of roundQueryLog) {
          if (metrics.search_trace.length >= 80) continue;
          const queryResults = rankedWithScores.filter(x => x.r.query === qlog.query);
          metrics.search_trace.push({
            company: company.name, round: round + 1, query_kind: qlog.kind, freshness_days: qlog.kind === "event" ? 180 : null, query: qlog.query.slice(0, 500), result_count: queryResults.length,
            results: queryResults.slice(0, 5).map(x => ({ title: (x.r.title ?? "").slice(0, 180), url: x.r.canonical_url, provider: x.r.provider, selected_for_extraction: selectedUrls.has(x.r.canonical_url), event_hint: x.hasEvent, access_hint: x.accessHint, utility: x.util })),
          });
        }
      }
      for (const item of extractionRanked.slice(0, extractionPerRound)) {
        const cachedExtraction = extractionCache.get(item.url);
        if (!cachedExtraction && metrics.extractions >= budget.maxExtractions) break;
        if (!cachedExtraction && !canSpend(0, 1)) { budgetExhausted = true; tax("budget_cap_reached_before_extraction"); break; }
        const ext = cachedExtraction ?? await extractWithFallback(item.url).catch(() => ({ ok: false, content: "", extractor: "none", fallback_used: false }));
        if (cachedExtraction) metrics.reused_evidence_count++;
        else {
          metrics.extractions++;
          extractionCache.set(item.url, { ok: !!ext.ok, content: ext.content ?? "", extractor: ext.extractor ?? "unknown", fallback_used: !!ext.fallback_used });
        }
        const content = sanitizePublicContent((ext.content ?? "").slice(0, 20_000));
        const resolved = resolvePublicationDate({ provider_date: item.published_date ?? null, html: content, url: item.url });
        const hay = `${item.title ?? ""} ${content}`.toLowerCase();
        const officialDomain = (() => {
          if (!company.domain) return false;
          try { const h = new URL(item.canonical_url).host.replace(/^www\./, ""); return h === company.domain || h.endsWith(`.${company.domain}`); }
          catch { return false; }
        })();
        const liveOfficialPage = !!ext.ok && officialDomain && channelPageContentUsable(content);
        const companyInContent = companyNameInText(company.name, `${item.title ?? ""} ${content}`) || officialDomain;
        if (resolved.date) metrics.candidates_with_valid_date++;
        if (companyInContent) metrics.candidates_company_matched++;
        // Event vs metric: a statistic ("movilizó 17M pasajeros", "creció 20%")
        // VETOES the signal; but a needs-family event phrase ("nueva bodega")
        // that isn't a metric still counts even if it's not one of the strict
        // CHANGE constructions. So: event present AND not a bare metric.
        const titleSignalKind = classifySignalKind(item.title ?? "");
        const sigKind = titleSignalKind.can_trigger ? titleSignalKind : classifySignalKind(hay);
        metrics.signal_kind_counts[sigKind.kind] = (metrics.signal_kind_counts[sigKind.kind] ?? 0) + 1;
        // Metrics, marketing/editorial/reference content are context, never a trigger.
        const isBareMetric = sigKind.kind === "state_metric" || sigKind.kind === "historical_metric" || sigKind.kind === "performance_result" || sigKind.kind === "marketing_claim" || sigKind.kind === "editorial_content" || sigKind.kind === "reference_information";
        const eventPhrase = eventVerbPresent(hay, needs, spanish);
        const famMatch = eventPhrase && !isBareMetric;
        const directAccess = enableChannelAccess
          ? assessChannelAccess(`${item.title ?? ""} ${content}`, liveOfficialPage)
          : { status: "insufficient" as const, qualifies: false, confidence: "low" as const, matched: [], reason: "Commercial-access lane is not relevant to this offer." };
        if (directAccess.status === "seller_recruitment") sellerDirectionObserved = true;
        const access = directAccess.qualifies ? directAccess : (catalogAccess?.qualifies ? catalogAccess : directAccess);
        const channelEvidence = access.qualifies ? applyObservedChannelDirection(evaluateChannelEvidence({
          assessment: access,
          offerContext: `${criteria.offer_summary ?? ""} ${criteria.value_proposition ?? ""} ${criteria.target_industries.join(" ")}`,
          extractedOfficialPage: liveOfficialPage,
        }), sellerDirectionObserved) : null;
        if (channelEvidence) metrics.channel_evidence_grades[channelEvidence.grade] = (metrics.channel_evidence_grades[channelEvidence.grade] ?? 0) + 1;
        const verifiedAccess = !!channelEvidence?.eligible;
        const effectiveAccess = { ...access, qualifies: verifiedAccess };
        if (access.status === "seller_recruitment") tax("channel_access_wrong_direction");
        else if (verifiedAccess) tax(`channel_access_verified_${channelEvidence?.grade ?? "unknown"}`);
        else if (access.qualifies) tax(`channel_access_contract_block:${channelEvidence?.blockers.join("+") ?? "unknown"}`);
        if (isBareMetric && eventPhrase) tax(`metric_not_event_${sigKind.kind}`);
        const dom = (() => { try { return new URL(item.canonical_url).host.replace(/^www\./, ""); } catch { return ""; } })();
        if (dom) touchedDomains.add(dom);
        noteOutcome(sourceLedger, dom, { extracted: !!ext.ok, valid_date: !!resolved.date, trigger_event: sigKind.kind === "corporate_event" || sigKind.kind === "operational_change" || sigKind.kind === "strategic_decision" });
        const geoConfirmed = !spanish || /\bcolombia\b|\bbogot[aá]\b|\bmedell[ií]n\b|\bcali\b|\bbarranquilla\b|\bcartagena\b|colombian[ao]/i.test(hay) || /\.co(\/|$|\.)/i.test(dom) || (officialDomain && company.country === "Colombia" && company.confidence === "verified");
        const verdict = opportunityTest({
          company: company.name, company_from_universe: true,
          signal_summary: item.title, signal_type: null, signal_date: resolved.date,
          date_confidence: resolved.confidence as "high" | "medium" | "low" | "none",
          source_url: item.canonical_url, source_type: item.source_type,
          company_in_content: companyInContent, grounded: !!ext.ok && (companyInContent || !!item.title),
          matches_needs_family: famMatch, geography_confirmed: geoConfirmed, region_required: spanish,
          channel_access_verified: verifiedAccess,
          corporate_identity_verified: officialDomain && !!company.domain,
        });
        metrics.opp_status_counts[verdict.status]++;
        if (verdict.status === "reject") {
          for (const b of verdict.hard_blockers) tax(b);
          if (metrics.deep_trace.length < 120) metrics.deep_trace.push({ company: company.name, title: (item.title ?? "").slice(0, 90), sigKind: sigKind.kind, role: "-", direction: "-", materiality: "-", operational_fit: false, fit_score: 0, fit_blockers: verdict.hard_blockers, score: null, verdict: "opportunity_test_reject", date: resolved.date, outcome: `opportunity_test_reject:${verdict.hard_blockers.join("+")}` });
          continue;
        }
        // Event-vs-metric is a hard semantic gate. A page classified as
        // `none`, editorial, marketing or a bare metric cannot be promoted by
        // a loose materiality keyword elsewhere in the article (observed:
        // Grupo Éxito leadership departure matched an unrelated "invierte").
        if (!sigKind.can_trigger && !verifiedAccess) {
          metrics.deep_trace.push({ company: company.name, title: (item.title ?? "").slice(0, 90), sigKind: sigKind.kind, role: "-", direction: "-", materiality: "-", operational_fit: false, fit_score: 0, fit_blockers: [], score: null, verdict: "non_trigger_reject", date: resolved.date, outcome: `non_trigger_reject:${sigKind.kind}` });
          tax(`non_trigger_${sigKind.kind}`);
          continue;
        }
        noteOutcome(sourceLedger, dom, { deep_candidate: true });

        // ── Deep validation (only for signals that passed the Opportunity Test) ──
        // 1. Resolve corporate identity once per company (bounded, cached).
        if (!identity) {
          // Pack-verified domain short-circuit: seeds carry HTTP-verified
          // corporate domains, so identity does not depend on search providers
          // (which can be exhausted). Confidence from name↔domain match, capped
          // at 85 — a live official-site search can still score higher.
          if (company.domain) {
            const { nameDomainMatch } = await import("./corporate-identity");
            const observedName = companyNameInText(company.name, `${item.title ?? ""} ${content}`);
            const score = knownDomainIdentityConfidence({ lexical_score: nameDomainMatch(company.name, company.domain), origin: company.universe_origin, official_page_observes_name: officialDomain && observedName });
            identity = { name: company.name, domain: company.domain, country: company.country, confidence: score, aliases: [], resolved_from: `${company.universe_origin === "vertical_seed" ? "vertical-pack" : "company-universe"}: ${company.domain}`, reasons: [`Dominio corporativo curado ${company.domain}.${observedName ? " El nombre también aparece en la página oficial extraída." : " La relación marca–dominio requiere validación continua."}`] };
          } else {
            identity = await resolveCorporateIdentity(company.name, company.country, spanish);
          }
          if (identity.domain) companyDomains.add(identity.domain);
        }
        // 2. Homonym guard: the signal must belong to THIS corporate identity.
        const idMatch = signalMatchesIdentity(identity, item.canonical_url, hay, spanish);
        if (!idMatch.ok) {
          // Homonym rejections must be visible in the trace: several REAL
          // Opportunity-Test survivors died here invisibly in the 2026-07-21
          // precision run. conf reveals whether it was a true homonym or a
          // failed identity resolution (conf=0 → resolution failure, not homonym).
          metrics.deep_trace.push({ company: company.name, title: (item.title ?? "").slice(0, 90), sigKind: sigKind.kind, role: "-", direction: "-", materiality: "-", operational_fit: false, fit_score: 0, fit_blockers: [], score: null, verdict: "homonym_reject", date: resolved.date, outcome: `homonym_reject:conf=${identity.confidence}` });
          metrics.homonyms_rejected++; tax("homonym_wrong_identity"); continue;
        }
        // 3. Entity role: is the company the SUBJECT of the event (the account)
        //    or an incidental mention? Fixes attributing a story to the wrong firm.
        const titleRole = assessEntityRole(company.name, item.title ?? "");
        const role = verifiedAccess
          ? { role: "service_operator" as const, is_account: true, reason: "El dominio oficial atribuye a la empresa la operación del canal multimarca." }
          : (titleSignalKind.can_trigger && titleRole.is_account ? titleRole : assessEntityRole(company.name, hay));
        metrics.role_counts[role.role] = (metrics.role_counts[role.role] ?? 0) + 1;
        const trace = (outcome: string, extra: Partial<DiscoveryMetrics["deep_trace"][number]> = {}) => metrics.deep_trace.push({ company: company.name, title: (item.title ?? "").slice(0, 90), sigKind: sigKind.kind, role: role.role, direction: "-", materiality: "-", operational_fit: false, fit_score: 0, fit_blockers: [], score: null, verdict: outcome, date: resolved.date, outcome, ...extra });
        if (!role.is_account) { trace(`role_reject:${role.role}`); tax(`role_${role.role}`); continue; }
        // 4. Direction/sentiment: distress blocks (no budget); risk → monitor;
        //    regulatory/disruption depend on the product. Replaces blanket veto.
        // A live multi-brand catalog can contain clearance labels, product
        // claims or copied descriptions unrelated to the operator's financial
        // health. For evergreen channel proof, direction comes from the page
        // heading; event candidates still use their full extracted context.
        const directionContext = verifiedAccess ? (item.title ?? "") : hay;
        const dir = classifyDirection(directionContext, { productSolvesCompliance: /cumplimiento|complian|regulatori/i.test(productTerms.join(" ")), productSolvesMonitoring: /visibilidad|monitoreo|telemetr|trazabilidad|tracking/i.test(productTerms.join(" ")) });
        metrics.direction_counts[dir.direction] = (metrics.direction_counts[dir.direction] ?? 0) + 1;
        if (dir.policy === "block") { trace(`direction_block:${dir.direction}`, { direction: dir.direction }); tax(`direction_${dir.direction}`); continue; }
        // 5. Materiality — a metric/performance/historical signal is never high.
        const matRaw = classifyMateriality(hay);
        const mat = verifiedAccess
          ? { level: "medium" as const, matched: access.matched[0] ?? "canal multimarca" }
          : (!isBareMetric ? matRaw : { level: "low" as const, matched: matRaw.matched });
        metrics.materiality_counts[mat.level] = (metrics.materiality_counts[mat.level] ?? 0) + 1;
        // 6. Commercial + operational fit (the #1 residual).
        const fit = assessCommercialFit({ needs, company: company.name, sector: company.sector, content: hay, event_keyword: mat.matched, disqualifiers: criteria.disqualification_criteria ?? [], product_terms: productTerms, required_operation_terms: opTerms, channel_category_alignment: channelEvidence?.category_alignment, geography_confirmed: geoConfirmed });
        if (fit.hard_blockers.length) { trace(`fit_block:${fit.hard_blockers.join("+")}`, { direction: dir.direction, materiality: mat.level, operational_fit: fit.operational_fit, fit_score: fit.score, fit_blockers: fit.hard_blockers }); for (const b of fit.hard_blockers) tax(b); continue; }
        // 7. Corroboration: independent source domains seen for this company.
        if (dom) companyDomains.add(dom);
        const hasPrimary = !!identity.domain && (dom === identity.domain || hay.includes(identity.domain.split(".")[0]));
        const corr = corroborationTier(Math.max(0, companyDomains.size - 1), hasPrimary, identity.confidence);
        // 8. Rubric v2 (adds commercial + operational fit).
        const rub = scoreOpportunityV2({
          corporate_identity_confidence: identity.confidence,
          icp_fit_score: fit.score, operational_fit: fit.operational_fit,
          signal_association_ok: companyInContent && idMatch.ok && role.is_account,
          materiality: mat.level, corroboration: corr,
          causal_thesis_specific: (famMatch || verifiedAccess) && mat.level !== "low",
          days_old: daysOld(resolved.date), has_next_step: true,
          hard_blockers: verdict.hard_blockers,
        });
        // Risk-direction caps at monitor (never prioritaria).
        if (dir.policy === "monitor" && rub.verdict === "prioritaria") rub.verdict = "monitorear";
        metrics.rubric_verdicts[rub.verdict] = (metrics.rubric_verdicts[rub.verdict] ?? 0) + 1;
        if (rub.verdict === "rechazar") { trace(rub.verdict, { direction: dir.direction, materiality: mat.level, operational_fit: fit.operational_fit, fit_score: fit.score, fit_blockers: fit.hard_blockers, score: rub.score }); tax(`rubric_reject_${mat.level === "low" ? "low_materiality" : "score<60"}`); continue; }

        // 9. Formal counterevidence: reasons the thesis could be wrong. Adjusts
        //    confidence/priority — never rescues, never auto-rejects.
        const ce = assessCounterevidence({ content: hay, event_summary: item.title, days_old: daysOld(resolved.date), operational_fit: fit.operational_fit, corroboration: corr });
        const adjusted = applyCounterevidence(rub.verdict, rub.score, ce);
        rub.verdict = adjusted.verdict; rub.score = adjusted.score;

        // 10. Independent adversarial review — a separate reviewer tries to
        //     reject the assembled opportunity. Reject → never emitted.
        if (channelEvidence?.eligible) {
          rub.score = Math.min(rub.score, channelEvidence.score_cap);
          if (channelEvidence.grade === "preliminary" && rub.verdict === "prioritaria") rub.verdict = "monitorear";
        }
        const adv = adversarialReview({
          company: company.name, identity_confidence: identity.confidence, domain: identity.domain,
          organization_eligible: org.eligible_for_icp, entity_role_is_account: role.is_account,
          signal_association_ok: companyInContent && idMatch.ok && role.is_account,
          materiality: mat.level === "low" ? "low" : mat.level, operational_fit: fit.operational_fit,
          commercial_fit_score: fit.score, causal_thesis_specific: (famMatch || verifiedAccess) && mat.level !== "low",
          corroboration: corr, days_old: daysOld(resolved.date), has_next_step: true,
          counterevidence: ce, generator_verdict: rub.verdict,
        });
        metrics.adversarial_verdicts[adv.verdict] = (metrics.adversarial_verdicts[adv.verdict] ?? 0) + 1;
        if (adv.disagrees_with_generator) metrics.adversarial_disagreements++;
        trace(`${rub.verdict}·adv:${adv.verdict}`, { direction: dir.direction, materiality: mat.level, operational_fit: fit.operational_fit, fit_score: fit.score, fit_blockers: fit.hard_blockers, score: rub.score, adversarial_objections: adv.objections });
        if (adv.verdict === "reject") { tax("adversarial_reject"); continue; }
        if (adv.verdict === "monitor" && rub.verdict !== "monitorear") rub.verdict = "monitorear";

        const novelty = evaluateDiscoveryValue(company, `${item.title ?? ""} ${content.slice(0, 3000)}`);
        const thesis = buildAccountThesis({ company: company.name, offer: criteria.offer_summary ?? criteria.value_proposition ?? "", needs, title: item.title ?? "Señal corporativa verificada", signalDate: resolved.date, channelAccess: effectiveAccess, discoveryOrigin: company.universe_origin });
        const cand: LeadCandidate = {
          id: `cf_${Buffer.from(item.canonical_url).toString("base64url").slice(0, 16)}`,
          company: company.name, domain: identity.domain ?? company.domain ?? undefined, source: "public_signal",
          source_url: item.canonical_url, location: company.country ?? undefined, industry: company.sector ?? undefined,
          raw_context: [
            item.title ?? "",
            `Empresa (${org.organization_type}): ${company.name}${identity.domain ? ` · dominio ${identity.domain}` : ""} · ${company.country ?? ""}`,
            `Identidad corporativa: confianza ${identity.confidence}/100 — ${idMatch.reason}`,
            `Tipo de señal: ${sigKind.kind}${sigKind.matched ? ` (${sigKind.matched})` : ""}`,
            `Materialidad: ${mat.level}${mat.matched ? ` (${mat.matched})` : ""} · Corroboración: ${corr} (${companyDomains.size} dominios)`,
            `Calidad: ${rub.score}/100 → ${rub.verdict}${rub.adversarial_flags.length ? ` · Objeciones: ${rub.adversarial_flags.join(" ")}` : ""}`,
            `Fecha: ${resolved.date ?? "?"} (${resolved.confidence})`,
            `Hecho observado: ${thesis.observed_fact}`,
            `Relevancia para el cliente: ${thesis.client_relevance}`,
            `Límite de evidencia: ${thesis.evidence_limit}`,
            `Pregunta de validación: ${thesis.validation_question}`,
            ...(access.evidence_urls?.length ? [`Evidencia complementaria de canal: ${access.evidence_urls.join(" · ")}`] : []),
            content.slice(0, 1500),
          ].join("\n"),
          confidence_score: Math.min(0.95, rub.score / 100),
          signal_date: resolved.date ?? null,
          account_visibility: company.visibility_tier ?? "unknown",
          discovery_value: novelty.level,
          discovery_value_reason: novelty.reason,
          opportunity_kind: verifiedAccess ? "channel_fit" : "timing_signal",
          opportunity_kind_reason: verifiedAccess ? access.reason : "Evento material reciente con fecha estructurada y asociación corporativa verificadas.",
          channel_evidence_grade: channelEvidence?.grade,
          channel_proof_type: channelEvidence?.proof_type,
          channel_category_alignment: channelEvidence?.category_alignment,
          channel_limitations: channelEvidence?.limitations,
          discovery_origin: company.universe_origin ?? "unknown",
          discovery_source_detail: company.discovery_source,
          universe_score: company.universe_score,
          country_confidence: company.country_confidence,
          country_evidence: company.country_evidence ?? undefined,
          account_role: company.account_role,
          account_role_confidence: company.account_role_confidence,
          account_role_evidence: company.account_role_evidence,
          ...thesis,
        };
        best = chooseBetterCandidate(best, { cand, score: rub.score });
        if (rub.verdict === "prioritaria") break;
      }
    }
    if (best) {
      const obviousAlreadyIncluded = out.some(c => c.account_visibility === "obvious");
      if (best.cand.account_visibility === "obvious" && (best.cand.discovery_value === "low" || obviousAlreadyIncluded)) {
        tax(best.cand.discovery_value === "low" ? "low_discovery_value_obvious_account" : "portfolio_obvious_account_quota");
      } else {
        out.push(best.cand);
      }
    }
  }

  // Persist cumulative priors for learning, but expose only THIS run's deltas
  // in metrics. Previous US runs must never appear as Colombia coverage.
  metrics.source_stats = computeRunSourceDeltas(sourceLedger, sourcePriors, touchedDomains);
  persistSourceStats(metrics.source_stats);
  // Operating-mode classification (post-hoc, from what actually happened).
  metrics.fresh_search_count = metrics.urls;
  metrics.fresh_extraction_count = metrics.extractions;
  metrics.provider_status = providerRunStatus;
  metrics.providers_available = Object.keys(provYield);
  // "missing" = a search provider that ERRORED (quota/auth/request), NOT one that
  // was healthy but returned nothing. This is what coverage diagnosis needs.
  const searchProviders = ["brave", "serper", "tavily"];
  metrics.providers_missing = searchProviders.filter((x) => provYield[x] === undefined && providerRunStatus[x] !== undefined && providerRunStatus[x] !== "healthy_no_results");
  // Actionable provider breakdown, e.g. "serper/tavily: exhausted; brave: available".
  const providerBreakdown = searchProviders.map((p) => `${p}: ${providerRunStatus[p] ?? "not_called"}`).join("; ");
  const exhausted = searchProviders.filter((p) => providerRunStatus[p] === "exhausted");
  if (metrics.urls > 0 && metrics.providers_available.length >= 2) {
    metrics.operating_mode = "full_discovery";
    metrics.confidence_impact = metrics.providers_missing.length ? `Cobertura parcial: sin ${metrics.providers_missing.join("/")} (${providerBreakdown}).` : null;
  } else if (metrics.urls > 0) {
    metrics.operating_mode = "provider_limited";
    metrics.coverage_limitation = `Solo respondió ${metrics.providers_available.join("/") || "un proveedor desconocido"}; cobertura de mercado insuficiente${exhausted.length ? ` (agotados: ${exhausted.join("/")})` : ""}. [${providerBreakdown}]`;
    metrics.confidence_impact = "Los hallazgos individuales pueden validarse, pero la ausencia de resultados no es interpretable y el reporte piloto debe permanecer bloqueado.";
  } else if (metrics.extractions > 0) {
    metrics.operating_mode = "targeted_discovery";
    metrics.coverage_limitation = `Sin search providers${exhausted.length ? ` (agotados: ${exhausted.join("/")})` : ""}: solo investigación dirigida de sitios corporativos verificados — NO es cobertura de mercado. [${providerBreakdown}]`;
    metrics.confidence_impact = "Alta probabilidad de señales no vistas; los hallazgos son válidos pero la ausencia de hallazgos no implica ausencia de eventos.";
  } else {
    metrics.operating_mode = "stopped";
    metrics.coverage_limitation = "Sin search providers ni URLs objetivo: no hay evidencia suficiente para un reporte defendible.";
    metrics.confidence_impact = "Run detenido honestamente.";
  }
  metrics.duration_ms = Date.now() - t0;
  metrics.est_cost_usd = Number(calculateDiscoveryCost(metrics.company_signal_queries, metrics.extractions, universe.stats.enumeration_queries).toFixed(3));
  // Defensible opportunities own the delivery quota. Preliminary monitors are
  // visible only when capacity remains; they can never starve later accounts.
  const portfolio = prioritizeDiscoveryPortfolio(out, limit);
  metrics.emitted = portfolio.length;
  metrics.defensible_emitted = portfolio.filter(isDefensibleCandidate).length;
  metrics.preliminary_emitted = portfolio.length - metrics.defensible_emitted;
  metrics.dynamic_emitted = portfolio.filter(c => c.discovery_origin === "dynamic_enumeration").length;
  metrics.dynamic_defensible_emitted = portfolio.filter(c => c.discovery_origin === "dynamic_enumeration" && isDefensibleCandidate(c)).length;
  return { candidates: portfolio, metrics, needs };
}
