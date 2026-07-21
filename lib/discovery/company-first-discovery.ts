// ─── Company-first discovery orchestrator (company-first-v1) ──────────────────
// The full replacement flow for news-first discovery:
//   needs map → company universe → per-company signal search → extract/validate
//   → Opportunity Test (fail-closed) → corroboration → LeadCandidate
// Adaptive: if a company's first signal round is all noise, one reformulated
// round runs (company + official-domain / stronger event verb). Investigates
// many companies, emits few — nothing is filled to hit a target.

import type { ICP, LeadSearchCriteria, LeadCandidate } from "@/types";
import { buildNeedsMap, type NeedsMap } from "./needs-map";
import { buildCompanyUniverse } from "./company-universe";
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
import { loadSourcePriors, persistSourceStats } from "./source-intelligence-store";

export const DISCOVERY_VERSION = "company-first-v1";

export interface DiscoveryBudget { maxCompanies: number; queriesPerCompany: number; maxExtractions: number; }
// Stage-1 org rejection + the 5-min wall-clock cap protect runtime, so we can
// afford more per-company event queries to recover recall (the lean budgets
// alone drove recall too low: only 1 opportunity across 3 ICPs in the
// 2026-07-20 benchmark). More queries on ELIGIBLE companies = better event
// coverage without spending on public/ineligible ones.
export const TIER_BUDGET: Record<string, DiscoveryBudget> = {
  preview: { maxCompanies: 15, queriesPerCompany: 3, maxExtractions: 20 },
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
  company_signal_queries: number; urls: number; extractions: number; junk_urls_skipped: number;
  candidates_with_valid_date: number; candidates_company_matched: number;
  opp_status_counts: Record<OppStatus, number>;
  materiality_counts: Record<string, number>;
  signal_kind_counts: Record<string, number>;
  role_counts: Record<string, number>;
  direction_counts: Record<string, number>;
  org_rejected: Record<string, number>;
  rubric_verdicts: Record<string, number>;
  homonyms_rejected: number;
  adversarial_verdicts: Record<string, number>; adversarial_disagreements: number;
  source_stats: Record<string, DomainStats>;
  emitted: number; error_taxonomy: Record<string, number>;
  // Operating-mode honesty: how this run actually obtained evidence.
  operating_mode: "full_discovery" | "targeted_discovery" | "provider_limited" | "analysis_only" | "stopped";
  providers_available: string[]; providers_missing: string[];
  coverage_limitation: string | null;
  fresh_search_count: number; fresh_extraction_count: number; reused_evidence_count: number;
  confidence_impact: string | null;
  // Per-candidate trace of everything that reaches deep validation (passed the
  // Opportunity Test). Lets a human see WHY real dated events were confirmed or
  // rejected downstream — the substrate for calibration/human review.
  deep_trace: Array<{ company: string; title: string; sigKind: string; role: string; direction: string; materiality: string; operational_fit: boolean; fit_score: number; fit_blockers: string[]; score: number | null; verdict: string; date: string | null; outcome: string }>;
  duration_ms: number; est_cost_usd: number;
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
const JUNK_URL = /(facebook\.com|instagram\.com|youtube\.com|tiktok\.com|twitter\.com|x\.com\/|linkedin\.com|wikipedia\.org|\.fandom\.|play\.google\.|apps\.apple\.|tracxn\.com|crunchbase\.com|trustpilot\.|glassdoor\.|\/directorio|\/directory|paginasamarillas|pinterest\.)/i;
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
function eventVerbPresent(hay: string, needs: NeedsMap, spanish: boolean): boolean {
  const verbs = spanish ? EVENT_VERBS_ES : EVENT_VERBS_EN;
  for (const fam of needs.relevant_signal_families) {
    for (const v of (verbs[fam] ?? [])) {
      const core = v.replace(/"/g, "").toLowerCase().split(" ")[0]; // first word of the phrase
      if (core.length >= 4 && hay.includes(core)) return true;
    }
  }
  return false;
}

function companyQueries(company: string, needs: NeedsMap, spanish: boolean, n: number, round2 = false): string[] {
  const verbs = spanish ? EVENT_VERBS_ES : EVENT_VERBS_EN;
  const phrases: string[] = [];
  for (const fam of needs.relevant_signal_families) for (const v of (verbs[fam] ?? [])) phrases.push(v);
  const uniq = Array.from(new Set(phrases));
  const excl = spanish ? "-tendencias -empleo -directorio -ranking" : "-trends -jobs -directory -ranking";
  const year = new Date().getFullYear();
  // Geo-bias: gl=co alone lets Serper return .cl/.ar/.es homonyms; naming the
  // country in the query strongly biases toward the Colombian entity. Foreign
  // exclusions further suppress same-language homonyms.
  const geo = spanish ? " Colombia -site:cl -site:ar -site:es -site:mx" : "";
  const qs = uniq.slice(0, n).map((p) => `"${company}" ${p} ${year}${geo} ${excl}`);
  if (round2) qs.unshift(`"${company}" ${spanish ? "anuncio comunicado Colombia" : "announcement press release"} ${year} ${excl}`);
  return qs.slice(0, n);
}

export async function runCompanyFirstDiscovery(
  icp: ICP, criteria: LeadSearchCriteria, tier: string, limit: number,
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
    company_signal_queries: 0, urls: 0, extractions: 0, junk_urls_skipped: 0,
    candidates_with_valid_date: 0, candidates_company_matched: 0,
    opp_status_counts: { opportunity: 0, investigate: 0, monitor: 0, reject: 0 },
    materiality_counts: {}, signal_kind_counts: {}, role_counts: {}, direction_counts: {}, org_rejected: {}, rubric_verdicts: {}, homonyms_rejected: 0,
    emitted: 0, error_taxonomy: {}, deep_trace: [], adversarial_verdicts: {}, adversarial_disagreements: 0, source_stats: {},
    operating_mode: "provider_limited", providers_available: [], providers_missing: [], coverage_limitation: null,
    fresh_search_count: 0, fresh_extraction_count: 0, reused_evidence_count: 0, confidence_impact: null,
    duration_ms: 0, est_cost_usd: 0,
  };
  const tax = (k: string) => (metrics.error_taxonomy[k] = (metrics.error_taxonomy[k] ?? 0) + 1);

  const out: LeadCandidate[] = [];
  const seenUrl = new Set<string>();

  // Client product capability terms + the operation the ICP requires (for
  // commercial/operational fit). Derived once from the criteria + needs map.
  const productTerms = `${criteria.offer_summary ?? ""} ${criteria.value_proposition ?? ""}`.toLowerCase().split(/[^a-záéíóúñ]+/).filter((w) => w.length >= 5).slice(0, 12);
  const opTerms = requiredOperationTerms(needs);
  // Per-domain utility ledger — written into metrics.source_stats and USED to
  // order extraction (see ranked below). Seeded with decayed cross-run priors
  // (compounding loop: every run teaches the next which domains yield events).
  const sourceLedger = metrics.source_stats;
  Object.assign(sourceLedger, loadSourcePriors());

  const provYield: Record<string, number> = {};
  const daysOld = (iso: string | null) => { if (!iso) return null; const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000); return Number.isFinite(d) && d >= 0 ? d : null; };

  for (const company of universe.companies) {
    if (out.length >= limit || metrics.extractions >= budget.maxExtractions || Date.now() - t0 > MAX_DISCOVERY_MS) break;

    // Stage 1 — organization type / fit BEFORE any signal search (runtime win +
    // fixes public-service entities like Metro de Medellín slipping through).
    const org = classifyOrganization({ name: company.name, description: company.sector });
    if (!org.eligible_for_icp) { metrics.org_rejected[org.organization_type] = (metrics.org_rejected[org.organization_type] ?? 0) + 1; tax(`org_${org.organization_type}`); continue; }

    let best: { cand: LeadCandidate; score: number } | null = null;
    let identity: CorporateIdentity | null = null;
    const companyDomains = new Set<string>();  // independent source domains for corroboration

    for (let round = 0; round < 2 && (!best || best.score < 85); round++) {
      const queries = companyQueries(company.name, needs, spanish, budget.queriesPerCompany, round === 1);
      const results: { url: string; canonical_url: string; title: string | null; published_date: string | null; source_type: string | null; provider: string }[] = [];
      for (const q of queries) {
        metrics.company_signal_queries++;
        const sOpts = { language: spanish ? "es" : "en", region: gl, max_results: 5, query_type: "company_specific" as const, freshness_days: 180 };
        // Three complementary search sources. Tavily surfaces real editorial/news
        // domains (Serper alone floods social media; Brave is unavailable without
        // a key), so it materially lifts real-event recall.
        const [brave, serper, tavily] = await Promise.all([
          braveProvider.search({ query: q, ...sOpts }).catch(() => ({ results: [] })),
          serperProvider.search({ query: q, ...sOpts }).catch(() => ({ results: [] })),
          tavilyProvider.search({ query: q, ...sOpts }).catch(() => ({ results: [] })),
        ]);
        if (brave.results.length) provYield.brave = (provYield.brave ?? 0) + brave.results.length;
        if (serper.results.length) provYield.serper = (provYield.serper ?? 0) + serper.results.length;
        if (tavily.results.length) provYield.tavily = (provYield.tavily ?? 0) + tavily.results.length;
        for (const r of [...brave.results, ...serper.results, ...tavily.results]) {
          if (seenUrl.has(r.canonical_url)) continue;
          seenUrl.add(r.canonical_url);
          if (isJunkUrl(r.canonical_url, spanish)) { metrics.junk_urls_skipped++; tax("prefilter_junk_or_foreign"); continue; }
          results.push(r); metrics.urls++;
          try { noteUrl(sourceLedger, new URL(r.canonical_url).host.replace(/^www\./, "")); } catch { /* ignore */ }
        }
      }
      // Targeted corporate research: when search yields NOTHING for a company
      // that has a verified corporate domain, inspect the corporate site itself
      // (1 extraction). Honest: source_type company_website; the date/material
      // gates still decide — this adds coverage, never fabricates events.
      if (results.length === 0 && company.domain && round === 1) {
        results.push({ url: `https://${company.domain}`, canonical_url: `https://${company.domain}`, title: company.name, published_date: null, source_type: "company_website", provider: "targeted_corporate" });
        metrics.reused_evidence_count += 0; // corporate fetch is fresh, tracked via extractions
      }
      // Extract event-bearing pages first: a result whose TITLE already carries a
      // needs-family event verb is far likelier to be a real signal than the
      // provider's top hit (often a homepage/about page). Ties are broken by
      // SOURCE UTILITY: domains that have produced dated trigger events (this
      // run or in observed benchmarks) get the scarce extraction budget before
      // proven date-less/noise domains. No gate is relaxed by ordering.
      const ranked = results
        .map((r) => {
          const d = (() => { try { return new URL(r.canonical_url).host.replace(/^www\./, ""); } catch { return ""; } })();
          return { r, hasEvent: eventVerbPresent((r.title ?? "").toLowerCase(), needs, spanish), util: sourceUtilityScore(sourceLedger, d) };
        })
        .sort((a, b) => (Number(b.hasEvent) - Number(a.hasEvent)) || (b.util - a.util))
        .map((x) => x.r);
      for (const item of ranked.slice(0, 4)) {
        if (metrics.extractions >= budget.maxExtractions) break;
        const ext = await extractWithFallback(item.url).catch(() => ({ ok: false, content: "", extractor: "none", fallback_used: false }));
        metrics.extractions++;
        const content = (ext.content ?? "").slice(0, 20_000);
        const resolved = resolvePublicationDate({ provider_date: item.published_date ?? null, html: content, url: item.url });
        const hay = `${item.title ?? ""} ${content}`.toLowerCase();
        const companyInContent = companyNameInText(company.name, content);
        if (resolved.date) metrics.candidates_with_valid_date++;
        if (companyInContent) metrics.candidates_company_matched++;
        // Event vs metric: a statistic ("movilizó 17M pasajeros", "creció 20%")
        // VETOES the signal; but a needs-family event phrase ("nueva bodega")
        // that isn't a metric still counts even if it's not one of the strict
        // CHANGE constructions. So: event present AND not a bare metric.
        const sigKind = classifySignalKind(hay);
        metrics.signal_kind_counts[sigKind.kind] = (metrics.signal_kind_counts[sigKind.kind] ?? 0) + 1;
        // Metrics, marketing/editorial/reference content are context, never a trigger.
        const isBareMetric = sigKind.kind === "state_metric" || sigKind.kind === "historical_metric" || sigKind.kind === "performance_result" || sigKind.kind === "marketing_claim" || sigKind.kind === "editorial_content" || sigKind.kind === "reference_information";
        const eventPhrase = eventVerbPresent(hay, needs, spanish);
        const famMatch = eventPhrase && !isBareMetric;
        if (isBareMetric && eventPhrase) tax(`metric_not_event_${sigKind.kind}`);
        const dom = (() => { try { return new URL(item.canonical_url).host.replace(/^www\./, ""); } catch { return ""; } })();
        noteOutcome(sourceLedger, dom, { extracted: !!ext.ok, valid_date: !!resolved.date, trigger_event: sigKind.kind === "corporate_event" || sigKind.kind === "operational_change" || sigKind.kind === "strategic_decision" });
        const geoConfirmed = !spanish || /\bcolombia\b|\bbogot[aá]\b|\bmedell[ií]n\b|\bcali\b|\bbarranquilla\b|\bcartagena\b|colombian[ao]/i.test(hay) || /\.co(\/|$|\.)/i.test(dom);
        const verdict = opportunityTest({
          company: company.name, company_from_universe: true,
          signal_summary: item.title, signal_type: null, signal_date: resolved.date,
          date_confidence: resolved.confidence as "high" | "medium" | "low" | "none",
          source_url: item.canonical_url, source_type: item.source_type,
          company_in_content: companyInContent, grounded: !!ext.ok && (companyInContent || !!item.title),
          matches_needs_family: famMatch, geography_confirmed: geoConfirmed, region_required: spanish,
        });
        metrics.opp_status_counts[verdict.status]++;
        if (verdict.status === "reject") { for (const b of verdict.hard_blockers) tax(b); continue; }
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
            const score = Math.min(85, nameDomainMatch(company.name, company.domain));
            identity = { name: company.name, domain: company.domain, country: company.country, confidence: score, aliases: [], resolved_from: `vertical-pack (dominio verificado HTTP): ${company.domain}`, reasons: [`Dominio ${company.domain} del vertical pack, verificado por HTTP.`] };
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
        const role = assessEntityRole(company.name, hay);
        metrics.role_counts[role.role] = (metrics.role_counts[role.role] ?? 0) + 1;
        const trace = (outcome: string, extra: Partial<DiscoveryMetrics["deep_trace"][number]> = {}) => metrics.deep_trace.push({ company: company.name, title: (item.title ?? "").slice(0, 90), sigKind: sigKind.kind, role: role.role, direction: "-", materiality: "-", operational_fit: false, fit_score: 0, fit_blockers: [], score: null, verdict: outcome, date: resolved.date, outcome, ...extra });
        if (!role.is_account) { trace(`role_reject:${role.role}`); tax(`role_${role.role}`); continue; }
        // 4. Direction/sentiment: distress blocks (no budget); risk → monitor;
        //    regulatory/disruption depend on the product. Replaces blanket veto.
        const dir = classifyDirection(hay, { productSolvesCompliance: /cumplimiento|complian|regulatori/i.test(productTerms.join(" ")), productSolvesMonitoring: /visibilidad|monitoreo|telemetr|trazabilidad|tracking/i.test(productTerms.join(" ")) });
        metrics.direction_counts[dir.direction] = (metrics.direction_counts[dir.direction] ?? 0) + 1;
        if (dir.policy === "block") { trace(`direction_block:${dir.direction}`, { direction: dir.direction }); tax(`direction_${dir.direction}`); continue; }
        // 5. Materiality — a metric/performance/historical signal is never high.
        const matRaw = classifyMateriality(hay);
        const mat = !isBareMetric ? matRaw : { level: "low" as const, matched: matRaw.matched };
        metrics.materiality_counts[mat.level] = (metrics.materiality_counts[mat.level] ?? 0) + 1;
        // 6. Commercial + operational fit (the #1 residual).
        const fit = assessCommercialFit({ needs, company: company.name, sector: company.sector, content: hay, event_keyword: mat.matched, disqualifiers: criteria.disqualification_criteria ?? [], product_terms: productTerms, required_operation_terms: opTerms });
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
          causal_thesis_specific: famMatch && mat.level !== "low",
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
        const adv = adversarialReview({
          company: company.name, identity_confidence: identity.confidence, domain: identity.domain,
          organization_eligible: org.eligible_for_icp, entity_role_is_account: role.is_account,
          signal_association_ok: companyInContent && idMatch.ok && role.is_account,
          materiality: mat.level === "low" ? "low" : mat.level, operational_fit: fit.operational_fit,
          commercial_fit_score: fit.score, causal_thesis_specific: famMatch && mat.level !== "low",
          corroboration: corr, days_old: daysOld(resolved.date), has_next_step: true,
          counterevidence: ce, generator_verdict: rub.verdict,
        });
        metrics.adversarial_verdicts[adv.verdict] = (metrics.adversarial_verdicts[adv.verdict] ?? 0) + 1;
        if (adv.disagrees_with_generator) metrics.adversarial_disagreements++;
        trace(`${rub.verdict}·adv:${adv.verdict}`, { direction: dir.direction, materiality: mat.level, operational_fit: fit.operational_fit, fit_score: fit.score, fit_blockers: fit.hard_blockers, score: rub.score });
        if (adv.verdict === "reject") { tax("adversarial_reject"); continue; }
        if (adv.verdict === "monitor" && rub.verdict !== "monitorear") rub.verdict = "monitorear";

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
            content.slice(0, 1500),
          ].join("\n"),
          confidence_score: Math.min(0.95, rub.score / 100),
          signal_date: resolved.date ?? null,
        };
        if (!best || rub.score > best.score) best = { cand, score: rub.score };
        if (rub.verdict === "prioritaria") break;
      }
    }
    if (best) { out.push(best.cand); metrics.emitted++; }
  }

  persistSourceStats(metrics.source_stats);
  // Operating-mode classification (post-hoc, from what actually happened).
  metrics.fresh_search_count = metrics.urls;
  metrics.fresh_extraction_count = metrics.extractions;
  metrics.providers_available = Object.keys(provYield);
  metrics.providers_missing = ["brave", "serper", "tavily"].filter((x) => !provYield[x]);
  if (metrics.urls > 0) {
    metrics.operating_mode = "full_discovery";
    metrics.confidence_impact = metrics.providers_missing.length ? `Cobertura parcial: sin ${metrics.providers_missing.join("/")}.` : null;
  } else if (metrics.extractions > 0) {
    metrics.operating_mode = "targeted_discovery";
    metrics.coverage_limitation = "Sin search providers: solo investigación dirigida de sitios corporativos verificados — NO es cobertura de mercado.";
    metrics.confidence_impact = "Alta probabilidad de señales no vistas; los hallazgos son válidos pero la ausencia de hallazgos no implica ausencia de eventos.";
  } else {
    metrics.operating_mode = "stopped";
    metrics.coverage_limitation = "Sin search providers ni URLs objetivo: no hay evidencia suficiente para un reporte defendible.";
    metrics.confidence_impact = "Run detenido honestamente.";
  }
  metrics.duration_ms = Date.now() - t0;
  metrics.est_cost_usd = Number((metrics.company_signal_queries * 0.002 + metrics.extractions * 0.008 + universe.stats.enumeration_queries * 0.004).toFixed(3));
  // Rank emitted by Opportunity Test strength then confidence (does NOT touch
  // the downstream deterministic scorer/selector).
  out.sort((a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0));
  return { candidates: out.slice(0, limit), metrics, needs };
}
