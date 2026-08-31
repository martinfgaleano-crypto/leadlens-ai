// Event-First Opportunity Discovery V1
//
// Complementary discovery lane for Candidate Universe construction:
//   commercial context -> recent event hints -> subject company -> identity hint
//   -> existing Candidate Universe classification -> canonical Research.
//
// TRUTH BOUNDARY: every value emitted here is DISCOVERY provenance. A headline,
// snippet, provider date or URL is never Evidence, Timing or a canonical event.

import type { SearchProvider, SearchResultItem } from "@/lib/sources/access/provider-contract";
import { classifyOrganization } from "@/lib/discovery/organization-type";
import { inferEnumeratedCountry, inferEnumeratedDomain, rejectEnumeratedName } from "@/lib/discovery/company-universe";
import type { DiscoveryPlan, RawDiscoveredOrg } from "./candidate-universe";

export const EVENT_FIRST_DISCOVERY_VERSION = "event-first-discovery-v1";

export type EventFamily =
  | "expansion" | "facility" | "capacity_investment" | "contract"
  | "partnership" | "market_entry" | "operational_transformation" | "m_and_a";

export interface EventFirstQuery {
  family: EventFamily;
  query: string;
  geography: string;
  language: "en" | "es";
}

export interface EventDiscoveryCandidate {
  event_hint_id: string;
  company_name_hint: string;
  company_domain_hint: string | null;
  event_type_hint: EventFamily;
  event_date_hint: string | null;
  headline: string;
  source_url: string;
  source_origin: string;
  provider: string;
  discovered_at: string;
  query_family: EventFamily;
  target_geography: string;
  confidence: "moderate" | "low";
}

export interface EventFirstMetrics {
  queries: number;
  raw_hints: number;
  unique_hints: number;
  subjects_extracted: number;
  canonical_companies: number;
  rejected: Record<string, number>;
  provider_calls: Record<string, number>;
  provider_failures: Record<string, string>;
}

export interface EventFirstResult {
  orgs: RawDiscoveredOrg[];
  hints: EventDiscoveryCandidate[];
  metrics: EventFirstMetrics;
}

const FAMILY_TERMS: Record<EventFamily, { en: string[]; es: string[] }> = {
  expansion: { en: ["expands operations", "regional expansion"], es: ["expande operaciones", "expansion regional"] },
  facility: { en: ["opens new plant", "new distribution center"], es: ["abre nueva planta", "nuevo centro de distribucion"] },
  capacity_investment: { en: ["capacity investment", "invests in manufacturing"], es: ["inversion en capacidad", "amplia capacidad"] },
  contract: { en: ["awarded contract", "wins contract"], es: ["gana contrato", "contrato adjudicado"] },
  partnership: { en: ["operational partnership", "joint venture"], es: ["alianza operativa", "empresa conjunta"] },
  market_entry: { en: ["enters new market"], es: ["entra a nuevo mercado"] },
  operational_transformation: { en: ["automation investment", "operational transformation"], es: ["inversion en automatizacion", "transformacion operativa"] },
  m_and_a: { en: ["acquires company"], es: ["adquiere empresa"] },
};

const SIGNAL_TO_FAMILY: Record<string, EventFamily[]> = {
  expansion: ["expansion", "market_entry"],
  new_facility: ["facility"], infrastructure: ["facility"],
  capacity: ["capacity_investment"], investment: ["capacity_investment"],
  fleet_growth: ["capacity_investment", "contract"],
  contract_award: ["contract"], partnership: ["partnership"],
  new_market: ["market_entry"], acquisition: ["m_and_a"],
  operational_transformation: ["operational_transformation"],
  technology_change: ["operational_transformation"],
};

const compact = (value: string) => value.trim().replace(/\s+/g, " ");
const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const slug = (value: string) => normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export function planEventFirstQueries(plan: DiscoveryPlan, maxQueries = 6): EventFirstQuery[] {
  const geography = plan.geographies[0] || "United States";
  const language: "en" | "es" = /colombia|latinoam|méxico|mexico|españa|spain/i.test(geography) ? "es" : "en";
  const buyerTerms = [...plan.organizationTypes, ...plan.industries].map(compact).filter(Boolean).slice(0, 3);
  if (!buyerTerms.length) return [];
  const buyer = buyerTerms.length > 1 ? `(${buyerTerms.map(x => `"${x}"`).join(" OR ")})` : `"${buyerTerms[0]}"`;
  const requested = Array.from(new Set(plan.watchSignalFamilies.flatMap(f => SIGNAL_TO_FAMILY[String(f)] ?? [])));
  const families: EventFamily[] = requested.length ? requested : ["facility", "capacity_investment", "expansion", "contract"];
  const currentYear = new Date().getUTCFullYear();
  const queries: EventFirstQuery[] = [];
  for (const family of families) {
    for (const term of FAMILY_TERMS[family][language].slice(0, 2)) {
      queries.push({ family, geography, language, query: `${buyer} "${term}" "${geography}" (${currentYear} OR ${currentYear - 1})` });
      if (queries.length >= maxQueries) return queries;
    }
  }
  return queries;
}

const EVENT_ACTION = /\b(?:announces?|plans?|opens?|launches?|builds?|expands?|invests?|acquires?|wins?|awarded|signs?|partners?|inaugurates?|anuncia|planea|abre|abrira|inaugura|construye|expande|amplia|invierte|adquiere|gana|firma|se asocia)\b/i;
const BAD_SUBJECT = /^(?:breaking|exclusive|report|analysis|news|update|companies|manufacturers|manufacturer|industry|market|sector|colombia|united states|us|u\.s\.)$/i;

/** Deterministic, deliberately conservative title-subject extraction. It only
 * accepts a named prefix immediately governing a material-change verb. */
export function extractEventSubjects(headline: string): string[] {
  const title = compact(headline.split(/\s+[|–—]\s+/)[0] ?? "").replace(/^(?:breaking|exclusive|update|news)\s*:\s*/i, "");
  const match = EVENT_ACTION.exec(title);
  if (!match || match.index < 2 || match.index > 100) return [];
  const prefix = title.slice(0, match.index).replace(/^(?:the|la|el)\s+/i, "").replace(/[,:;-]+$/g, "").trim();
  const parts = prefix.split(/\s+(?:and|y|&)\s+/i).map(x => x.replace(/^(?:manufacturer|company|empresa)\s+/i, "").trim());
  return Array.from(new Set(parts.filter(name => name.length >= 3 && name.length <= 80 && !BAD_SUBJECT.test(name) && !rejectEnumeratedName(name))));
}

function sourceHost(url: string): string | null {
  try { return new URL(url).host.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

function hintKey(company: string, family: EventFamily, url: string): string {
  const host = sourceHost(url) ?? "source";
  return `${slug(company)}:${family}:${host}:${slug(url.split("?")[0].split("/").pop() ?? url)}`;
}

function domainLooksCorporate(company: string, domain: string | null): boolean {
  if (!domain || /(?:reuters|bloomberg|forbes|news|prnewswire|businesswire|globenewswire|yahoo|msn|gov\.)/i.test(domain)) return false;
  const tokens = normalize(company).split(/[^a-z0-9]+/).filter(x => x.length >= 4 && !/^(company|corporation|group|grupo|industries)$/.test(x));
  const host = normalize(domain.split(".")[0]);
  return tokens.some(token => host.includes(token));
}

export async function runEventFirstDiscovery(
  plan: DiscoveryPlan,
  providers: SearchProvider[],
  opts: { maxQueries?: number; maxIdentityQueries?: number; now?: () => Date } = {},
): Promise<EventFirstResult> {
  const metrics: EventFirstMetrics = { queries: 0, raw_hints: 0, unique_hints: 0, subjects_extracted: 0, canonical_companies: 0, rejected: {}, provider_calls: {}, provider_failures: {} };
  const reject = (reason: string) => { metrics.rejected[reason] = (metrics.rejected[reason] ?? 0) + 1; };
  const now = (opts.now ?? (() => new Date()))().toISOString();
  const queries = planEventFirstQueries(plan, opts.maxQueries ?? 6);
  const raw: Array<{ query: EventFirstQuery; item: SearchResultItem }> = [];
  for (const query of queries) {
    metrics.queries++;
    for (const provider of providers) {
      metrics.provider_calls[provider.id] = (metrics.provider_calls[provider.id] ?? 0) + 1;
      const response = await provider.search({ query: query.query, region: query.language === "es" ? "co" : "us", language: query.language, max_results: 6, freshness_days: 365, query_type: "signal_specific" }).catch(error => ({ ok: false, results: [], error: error instanceof Error ? error.message : String(error) } as never));
      if (!response.ok) metrics.provider_failures[provider.id] = response.error ?? "unknown";
      raw.push(...response.results.map(item => ({ query, item })));
      // One useful provider is enough per query; fallbacks preserve resilience.
      if (response.results.length >= 3) break;
    }
  }
  metrics.raw_hints = raw.length;

  const hints: EventDiscoveryCandidate[] = [];
  const seen = new Set<string>();
  for (const { query, item } of raw) {
    const subjects = extractEventSubjects(item.title ?? "");
    if (!subjects.length) { reject("no_subject"); continue; }
    metrics.subjects_extracted += subjects.length;
    for (const company of subjects) {
      const text = `${item.title ?? ""} ${item.snippet ?? ""}`;
      const org = classifyOrganization({ name: company, description: text });
      if (!org.eligible_for_icp) { reject(`organization:${org.organization_type}`); continue; }
      const host = sourceHost(item.canonical_url);
      const corporate = domainLooksCorporate(company, host);
      const key = hintKey(company, query.family, item.canonical_url);
      if (seen.has(key)) { reject("duplicate"); continue; }
      seen.add(key);
      hints.push({
        event_hint_id: `eh_${slug(key)}`, company_name_hint: company,
        company_domain_hint: corporate ? host : null,
        event_type_hint: query.family, event_date_hint: item.published_date,
        headline: item.title ?? "", source_url: item.canonical_url,
        source_origin: item.source_type ?? "search_result", provider: item.provider,
        discovered_at: now, query_family: query.family, target_geography: query.geography,
        confidence: corporate ? "moderate" : "low",
      });
    }
  }
  metrics.unique_hints = hints.length;

  // Resolve only a bounded set. Search results remain discovery context; a
  // corporate domain is accepted only by the same deterministic domain/country
  // rules used by account-first enumeration.
  const orgs: RawDiscoveredOrg[] = [];
  const identityBudget = opts.maxIdentityQueries ?? 4;
  let identityCalls = 0;
  for (const hint of hints) {
    let domain = hint.company_domain_hint;
    let country: string | null = domain ? hint.target_geography : null;
    if (!domain && identityCalls < identityBudget) {
      const provider = providers[0];
      if (provider) {
        identityCalls++;
        metrics.provider_calls[provider.id] = (metrics.provider_calls[provider.id] ?? 0) + 1;
        const response = await provider.search({ query: `"${hint.company_name_hint}" official company "${hint.target_geography}"`, region: hint.target_geography === "Colombia" ? "co" : "us", language: hint.target_geography === "Colombia" ? "es" : "en", max_results: 5, query_type: "official_domain" }).catch(() => ({ ok: false, results: [] } as never));
        const pages = response.results.map(x => ({ title: x.title, snippet: x.snippet, url: x.canonical_url }));
        domain = inferEnumeratedDomain(hint.company_name_hint, pages).domain;
        country = inferEnumeratedCountry(hint.company_name_hint, pages, hint.target_geography).country;
      }
    }
    if (!domain) { reject("identity_unresolved"); continue; }
    if (!country) { reject("geography_unresolved"); continue; }
    orgs.push({
      name: hint.company_name_hint, domain, country,
      organizationType: plan.organizationTypes[0] ?? plan.industries[0],
      industry: plan.industries[0] ?? plan.organizationTypes[0],
      origin: "event_first", provider: hint.provider, route: `event_first:${hint.query_family}`,
      sourceUrl: hint.source_url, confidence: "verified",
    });
  }
  metrics.canonical_companies = new Set(orgs.map(x => x.domain)).size;
  return { orgs, hints, metrics };
}
