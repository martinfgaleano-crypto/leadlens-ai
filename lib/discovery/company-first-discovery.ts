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
  company_signal_queries: number; urls: number; extractions: number;
  candidates_with_valid_date: number; candidates_company_matched: number;
  opp_status_counts: Record<OppStatus, number>;
  materiality_counts: Record<string, number>;
  signal_kind_counts: Record<string, number>;
  role_counts: Record<string, number>;
  direction_counts: Record<string, number>;
  org_rejected: Record<string, number>;
  rubric_verdicts: Record<string, number>;
  homonyms_rejected: number;
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
    materiality_counts: {}, signal_kind_counts: {}, role_counts: {}, direction_counts: {}, org_rejected: {}, rubric_verdicts: {}, homonyms_rejected: 0,
    emitted: 0, error_taxonomy: {},
    duration_ms: 0, est_cost_usd: 0,
  };
  const tax = (k: string) => (metrics.error_taxonomy[k] = (metrics.error_taxonomy[k] ?? 0) + 1);

  const out: LeadCandidate[] = [];
  const seenUrl = new Set<string>();

  // Client product capability terms + the operation the ICP requires (for
  // commercial/operational fit). Derived once from the criteria + needs map.
  const productTerms = `${criteria.offer_summary ?? ""} ${criteria.value_proposition ?? ""}`.toLowerCase().split(/[^a-záéíóúñ]+/).filter((w) => w.length >= 5).slice(0, 12);
  const opTerms = requiredOperationTerms(needs);

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
        const [brave, serper] = await Promise.all([
          braveProvider.search({ query: q, language: spanish ? "es" : "en", region: gl, max_results: 5, query_type: "company_specific", freshness_days: 180 }).catch(() => ({ results: [] })),
          serperProvider.search({ query: q, language: spanish ? "es" : "en", region: gl, max_results: 5, query_type: "company_specific", freshness_days: 180 }).catch(() => ({ results: [] })),
        ]);
        for (const r of [...brave.results, ...serper.results]) {
          if (seenUrl.has(r.canonical_url)) continue;
          seenUrl.add(r.canonical_url); results.push(r); metrics.urls++;
        }
      }
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

        // ── Deep validation (only for signals that passed the Opportunity Test) ──
        // 1. Resolve corporate identity once per company (bounded, cached).
        if (!identity) { identity = await resolveCorporateIdentity(company.name, company.country, spanish); if (identity.domain) companyDomains.add(identity.domain); }
        // 2. Homonym guard: the signal must belong to THIS corporate identity.
        const idMatch = signalMatchesIdentity(identity, item.canonical_url, hay, spanish);
        if (!idMatch.ok) { metrics.homonyms_rejected++; tax("homonym_wrong_identity"); continue; }
        // 3. Entity role: is the company the SUBJECT of the event (the account)
        //    or an incidental mention? Fixes attributing a story to the wrong firm.
        const role = assessEntityRole(company.name, hay);
        metrics.role_counts[role.role] = (metrics.role_counts[role.role] ?? 0) + 1;
        if (!role.is_account) { tax(`role_${role.role}`); continue; }
        // 4. Direction/sentiment: distress blocks (no budget); risk → monitor;
        //    regulatory/disruption depend on the product. Replaces blanket veto.
        const dir = classifyDirection(hay, { productSolvesCompliance: /cumplimiento|complian|regulatori/i.test(productTerms.join(" ")), productSolvesMonitoring: /visibilidad|monitoreo|telemetr|trazabilidad|tracking/i.test(productTerms.join(" ")) });
        metrics.direction_counts[dir.direction] = (metrics.direction_counts[dir.direction] ?? 0) + 1;
        if (dir.policy === "block") { tax(`direction_${dir.direction}`); continue; }
        // 5. Materiality — a metric/performance/historical signal is never high.
        const matRaw = classifyMateriality(hay);
        const mat = !isBareMetric ? matRaw : { level: "low" as const, matched: matRaw.matched };
        metrics.materiality_counts[mat.level] = (metrics.materiality_counts[mat.level] ?? 0) + 1;
        // 6. Commercial + operational fit (the #1 residual).
        const fit = assessCommercialFit({ needs, company: company.name, sector: company.sector, content: hay, event_keyword: mat.matched, disqualifiers: criteria.disqualification_criteria ?? [], product_terms: productTerms, required_operation_terms: opTerms });
        if (fit.hard_blockers.length) { for (const b of fit.hard_blockers) tax(b); continue; }
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
        if (rub.verdict === "rechazar") { tax(`rubric_reject_${mat.level === "low" ? "low_materiality" : "score<60"}`); continue; }

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

  metrics.duration_ms = Date.now() - t0;
  metrics.est_cost_usd = Number((metrics.company_signal_queries * 0.002 + metrics.extractions * 0.008 + universe.stats.enumeration_queries * 0.004).toFixed(3));
  // Rank emitted by Opportunity Test strength then confidence (does NOT touch
  // the downstream deterministic scorer/selector).
  out.sort((a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0));
  return { candidates: out.slice(0, limit), metrics, needs };
}
