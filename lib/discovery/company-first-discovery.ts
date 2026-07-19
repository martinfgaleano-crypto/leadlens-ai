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

export const DISCOVERY_VERSION = "company-first-v1";

export interface DiscoveryBudget { maxCompanies: number; queriesPerCompany: number; maxExtractions: number; }
export const TIER_BUDGET: Record<string, DiscoveryBudget> = {
  preview: { maxCompanies: 18, queriesPerCompany: 2, maxExtractions: 24 },
  brief: { maxCompanies: 30, queriesPerCompany: 3, maxExtractions: 60 },
  intelligence: { maxCompanies: 45, queriesPerCompany: 3, maxExtractions: 90 },
  premium: { maxCompanies: 60, queriesPerCompany: 4, maxExtractions: 120 },
};

export interface DiscoveryMetrics {
  needs_map_families: string[];
  companies_discovered: number; companies_verified: number;
  universe_rejected: Record<string, number>;
  company_signal_queries: number; urls: number; extractions: number;
  candidates_with_valid_date: number; candidates_company_matched: number;
  opp_status_counts: Record<OppStatus, number>;
  emitted: number; error_taxonomy: Record<string, number>;
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
  const qs = uniq.slice(0, n).map((p) => `"${company}" ${p} ${year} ${excl}`);
  if (round2) qs.unshift(`"${company}" ${spanish ? "anuncio comunicado" : "announcement press release"} ${year} ${excl}`);
  return qs.slice(0, n);
}

export async function runCompanyFirstDiscovery(
  icp: ICP, criteria: LeadSearchCriteria, tier: string, limit: number,
): Promise<{ candidates: LeadCandidate[]; metrics: DiscoveryMetrics; needs: NeedsMap }> {
  const t0 = Date.now();
  const budget = TIER_BUDGET[tier] ?? TIER_BUDGET.preview;
  const spanish = criteria.output_language === "es" || criteria.target_market_region === "latin_america";
  const gl = criteria.target_market_region === "latin_america" ? "co" : "us";

  const { braveProvider, serperProvider } = await import("@/lib/sources/access/providers");
  const { extractWithFallback } = await import("@/lib/sources/access/extractors");
  const { resolvePublicationDate } = await import("@/lib/sources/access/date-resolver");

  // 1. Needs map, then company universe.
  const needs = await buildNeedsMap(icp, criteria);
  const universe = await buildCompanyUniverse(icp, criteria, needs, { maxCompanies: budget.maxCompanies });

  const metrics: DiscoveryMetrics = {
    needs_map_families: needs.relevant_signal_families,
    companies_discovered: universe.companies.length, companies_verified: universe.companies.length,
    universe_rejected: universe.stats.rejected,
    company_signal_queries: 0, urls: 0, extractions: 0,
    candidates_with_valid_date: 0, candidates_company_matched: 0,
    opp_status_counts: { opportunity: 0, investigate: 0, monitor: 0, reject: 0 },
    emitted: 0, error_taxonomy: {},
    duration_ms: 0, est_cost_usd: 0,
  };
  const tax = (k: string) => (metrics.error_taxonomy[k] = (metrics.error_taxonomy[k] ?? 0) + 1);

  const out: LeadCandidate[] = [];
  const seenUrl = new Set<string>();

  for (const company of universe.companies) {
    if (out.length >= limit || metrics.extractions >= budget.maxExtractions) break;
    let best: { cand: LeadCandidate; status: OppStatus } | null = null;

    for (let round = 0; round < 2 && !best; round++) {
      const queries = companyQueries(company.name, needs, spanish, budget.queriesPerCompany, round === 1);
      const results: { url: string; canonical_url: string; title: string | null; published_date: string | null; source_type: string | null; provider: string }[] = [];
      for (const q of queries) {
        metrics.company_signal_queries++;
        const [brave, serper] = await Promise.all([
          braveProvider.search({ query: q, language: spanish ? "es" : "en", region: gl, max_results: 5, query_type: "company_specific", freshness_days: 180 }).catch(() => ({ results: [] })),
          serperProvider.search({ query: q, language: spanish ? "es" : "en", region: gl, max_results: 5, query_type: "company_specific", freshness_days: 180 }).catch(() => ({ results: [] })),
        ]);
        for (const r of [...brave.results, ...serper.results]) {
          if (seenUrl.has(r.canonical_url)) continue;
          seenUrl.add(r.canonical_url); results.push(r); metrics.urls++;
        }
      }
      // Extract the most promising few per company.
      for (const item of results.slice(0, 3)) {
        if (metrics.extractions >= budget.maxExtractions) break;
        const ext = await extractWithFallback(item.url).catch(() => ({ ok: false, content: "", extractor: "none", fallback_used: false }));
        metrics.extractions++;
        const content = (ext.content ?? "").slice(0, 20_000);
        const resolved = resolvePublicationDate({ provider_date: item.published_date ?? null, html: content, url: item.url });
        const hay = `${item.title ?? ""} ${content}`.toLowerCase();
        const companyInContent = content.toLowerCase().includes(company.name.toLowerCase().slice(0, Math.min(18, company.name.length)));
        if (resolved.date) metrics.candidates_with_valid_date++;
        if (companyInContent) metrics.candidates_company_matched++;
        // Real material-event check: a needs-family event verb must actually
        // appear in the title/content — a bare company-name match is not an event.
        const famMatch = eventVerbPresent(hay, needs, spanish);
        // Geography: for CO/es runs require the content/domain to confirm the
        // region (guards against foreign homonyms like German "Bavaria").
        const dom = (() => { try { return new URL(item.canonical_url).host; } catch { return ""; } })();
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
        const cand: LeadCandidate = {
          id: `cf_${Buffer.from(item.canonical_url).toString("base64url").slice(0, 16)}`,
          company: company.name, domain: company.domain ?? undefined, source: "public_signal",
          source_url: item.canonical_url, location: company.country ?? undefined, industry: company.sector ?? undefined,
          raw_context: `${item.title ?? ""}\nEmpresa (universo verificado): ${company.name} · ${company.fit_reason}\nEstado Opportunity Test: ${verdict.status} — ${verdict.reason}\nFecha: ${resolved.date ?? "?"} (${resolved.confidence})\n${content.slice(0, 1500)}`,
          confidence_score: verdict.status === "opportunity" ? 0.8 : verdict.status === "investigate" ? 0.6 : 0.45,
          signal_date: resolved.date ?? null,
        };
        const rank: Record<OppStatus, number> = { opportunity: 3, investigate: 2, monitor: 1, reject: 0 };
        if (!best || rank[verdict.status] > rank[best.status]) best = { cand, status: verdict.status };
        if (verdict.status === "opportunity") break;
      }
    }
    if (best) { out.push(best.cand); metrics.emitted++; }
  }

  metrics.duration_ms = Date.now() - t0;
  metrics.est_cost_usd = Number((metrics.company_signal_queries * 0.002 + metrics.extractions * 0.008 + universe.stats.enumeration_queries * 0.004).toFixed(3));
  // Rank emitted by Opportunity Test strength then confidence (does NOT touch
  // the downstream deterministic scorer/selector).
  out.sort((a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0));
  return { candidates: out.slice(0, limit), metrics, needs };
}
