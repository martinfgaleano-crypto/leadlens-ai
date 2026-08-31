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
  source_excerpt: string | null;
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
  result_types: Record<string, number>;
  company_mentions: number;
  domains_resolved: number;
  geography_resolved: number;
  target_valid: number;
  result_audit: Array<{ provider: string; type: EventResultType; title: string | null; url: string; subjects: string[]; recent: boolean }>;
  result_sample: Array<{ query: string; title: string | null; url: string; published_date: string | null; provider: string }>;
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

const LEGAL_SUFFIX = /(?:,?\s+(?:s\.?\s*a\.?\s*s\.?|s\.?\s*a\.?|ltda\.?|limitada|s\.?\s*a\.?\s*s\.?\s+bic|s\.?\s*a\.?\s+bic))\.?$/i;
export function normalizeLatamCompanyName(value: string): string {
  return compact(value)
    .replace(/^(?:(?:la|el)\s+)?(?:empresa|compa[ñn][ií]a|firma|fabricante|operador(?:a)?\s+log[ií]stic[oa])(?:\s+(?:colombian[oa]|cale[ñn]a|pais[ao]|nacional))?\s+/i, "")
    .replace(LEGAL_SUFFIX, "")
    .replace(/[,:;-]+$/g, "")
    .trim();
}

export function planEventFirstQueries(plan: DiscoveryPlan, maxQueries = 6): EventFirstQuery[] {
  const geography = plan.geographies[0] || "United States";
  const language: "en" | "es" = /colombia|latinoam|méxico|mexico|españa|spain/i.test(geography) ? "es" : "en";
  const targetText = normalize([...plan.organizationTypes, ...plan.industries].join(" "));
  const buyerTerms = language === "es" && /manufactur|fabricant|industrial|planta/.test(targetText)
    ? ["fabricante", "empresa industrial"]
    : language === "es" && /logistic|distribut|transport|bodega/.test(targetText)
      ? ["operador logistico", "distribuidor"]
      : /software|saas|technology|tecnologia/.test(targetText)
        ? (language === "es" ? ["empresa de software"] : ["software company"])
        : [...plan.organizationTypes, ...plan.industries].map(compact).filter(Boolean).map(x => x.slice(0, 48)).slice(0, 3);
  if (!buyerTerms.length) return [];
  const buyer = buyerTerms.length > 1 ? `(${buyerTerms.map(x => `"${x}"`).join(" OR ")})` : `"${buyerTerms[0]}"`;
  const requested = Array.from(new Set(plan.watchSignalFamilies.flatMap(f => SIGNAL_TO_FAMILY[String(f)] ?? [])));
  const families: EventFamily[] = requested.length ? requested : ["facility", "capacity_investment", "expansion", "contract"];
  const currentYear = new Date().getUTCFullYear();
  const queries: EventFirstQuery[] = [];
  for (const family of families) {
    for (const term of FAMILY_TERMS[family][language].slice(0, 2)) {
      const query = language === "es"
        ? `${term.includes(" ") ? `"${term}"` : term} empresa ${geography} (${currentYear} OR ${currentYear - 1}) ${buyer}`
        : `${buyer} "${term}" "${geography}" (${currentYear} OR ${currentYear - 1})`;
      queries.push({ family, geography, language, query });
      if (queries.length >= maxQueries) return queries;
    }
  }
  return queries;
}

const EVENT_ACTION = /\b(?:announces?|plans?|opens?|launches?|builds?|expands?|invests?|acquires?|wins?|awarded|signs?|partners?|inaugurates?|anuncia|anuncio|planea|abre|abrio|abrira|inaugura|inauguro|construye|construyo|expande|expandio|amplia|amplio|invierte|invirtio|adquiere|adquirio|gana|firma|impulsa|acelera|fortalece|se asocia)\b/i;
const BAD_SUBJECT = /^(?:breaking|exclusive|report|analysis|news|update|companies|manufacturers|manufacturer|industry|market|sector|others?|otros?|colombia|united states|us|u\.s\.|alianza(?:\s+tambien)?|consulado\b.*|colombia nos une)$/i;
const plausibleSubject = (name: string) => /^[A-ZÁÉÍÓÚÑ]/.test(name) && !BAD_SUBJECT.test(name) && (!rejectEnumeratedName(name) || /^[A-Z0-9&]{3,6}$/.test(name));

/** Deterministic, deliberately conservative title-subject extraction. It only
 * accepts a named prefix immediately governing a material-change verb. */
function subjectsFromText(headline: string): string[] {
  const full = compact(headline).replace(/^(?:breaking|exclusive|update|news)\s*:\s*/i, "");
  // Corporate newsrooms often lead with the event and put the company after a
  // dash: “Inauguración del Centro de Distribución - P.A.N. COLOMBIA”.
  const suffixPattern = /^(?:inauguraci[oó]n|apertura|expansi[oó]n|inversi[oó]n|ampliaci[oó]n)\b.{3,100}\s+-\s+(.{2,60})$/i.exec(full);
  if (suffixPattern) {
    const suffix = normalizeLatamCompanyName(suffixPattern[1].replace(/\b(?:colombia|united states|usa)\b/ig, "").trim());
    if (suffix.length >= 3 && plausibleSubject(suffix)) return [suffix];
  }
  const original = compact(full.split(/\s+[|–—]\s+/)[0] ?? "");
  const title = original.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = EVENT_ACTION.exec(title);
  if (!match || match.index < 2 || match.index > 100) return [];
  const prefix = original.slice(0, match.index).replace(/^(?:the|la|el)\s+/i, "").replace(/[,:;-]+$/g, "").trim();
  if (/###|»|<|\bver m[aá]s\b/i.test(prefix) || prefix.length > 80) return [];
  const parts = prefix.split(/\s*,\s*|\s+(?:and|y|&)\s+/i).map(normalizeLatamCompanyName);
  return Array.from(new Set(parts.filter(name => name.length >= 3 && name.length <= 80 && plausibleSubject(name))));
}

/** Extracts only explicit event actors. Snippet fallback is allowed when it
 * contains a named actor governing the event verb; pronoun-only coreference is
 * deliberately not attempted. */
export function extractEventSubjects(headline: string, snippet = ""): string[] {
  const direct = subjectsFromText(headline);
  if (direct.length) return direct;
  const objectFirst = /^(?:nueva|nuevo|ampliaci[oó]n de|expansi[oó]n de|inversi[oó]n de)\s+(?:planta|centro(?: de distribuci[oó]n)?|operaci[oó]n|capacidad)?\s*(?:de|para)\s+([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ&., -]{2,70}?)(?:\s+en\s+|\s+por\s+|[|–—:-]|$)/i.exec(compact(headline));
  if (objectFirst) {
    const name = normalizeLatamCompanyName(objectFirst[1]);
    if (plausibleSubject(name)) return [name];
  }
  for (const sentence of compact(snippet).split(/(?<=[.!?])\s+/).slice(0, 3)) {
    const found = subjectsFromText(sentence);
    if (found.length) return found;
  }
  return [];
}

export type EventResultType = "company_direct" | "news_article" | "trade_publication" | "directory" | "association" | "government" | "social" | "event_page" | "other";
export function classifyEventResult(item: Pick<SearchResultItem, "canonical_url" | "title" | "snippet">): EventResultType {
  const host = sourceHost(item.canonical_url) ?? "";
  const text = normalize(`${item.title ?? ""} ${item.snippet ?? ""}`);
  if (/(?:facebook|instagram|linkedin|youtube|tiktok|x)\.com$/.test(host)) return "social";
  if (/\.gov\.|\.gov$|\.gob\.|colombiacompra|secop/.test(host)) return "government";
  if (/directorio|directory|paginasamarillas|infodatos|colombialicita/.test(host)) return "directory";
  if (/camara|chamber|andi|amcham|asociacion|association/.test(host)) return "association";
  if (/feria|evento|eventos|expo|alimentec/.test(`${host} ${text}`)) return "event_page";
  if (/larepublica|portafolio|semana|forbes|eltiempo|elespectador|valoraanalitik|reuters|bloomberg/.test(host)) return "news_article";
  if (/logistica|foodnews|foodengineering|industry|manufacturing|racking|nosh/.test(host)) return "trade_publication";
  return domainLooksCorporate((item.title ?? "").split(/[|–—:-]/)[0], host) ? "company_direct" : "other";
}

function sourceHost(url: string): string | null {
  try { return new URL(url).host.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

function hintKey(company: string, family: EventFamily, url: string): string {
  const host = sourceHost(url) ?? "source";
  return `${slug(company)}:${family}:${host}:${slug(url.split("?")[0].split("/").pop() ?? url)}`;
}

function domainLooksCorporate(company: string, domain: string | null): boolean {
  if (!domain || /(?:reuters|bloomberg|forbes|news|press|prnewswire|businesswire|globenewswire|yahoo|msn|magazine|buyer|middleeast|industrytoday|foodengineering|nosh|gov\.)/i.test(domain)) return false;
  const normalizedCompany = normalize(normalizeLatamCompanyName(company));
  const tokens = normalizedCompany.split(/[^a-z0-9]+/).filter(x => x.length >= 3 && !/^(company|corporation|group|grupo|industries|industry|logistics|distribution|manufacturing|foods|food|partners|equity|capital|holdings|international)$/.test(x));
  const initialism = normalizedCompany.replace(/[^a-z0-9]/g, "");
  if (/[.]/.test(company) && initialism.length >= 3) tokens.push(initialism);
  const host = normalize(domain.split(".").slice(0, -1).join(""));
  return tokens.some(token => token.length === 3 ? host === token || host.startsWith(token) || host.endsWith(token) : host.includes(token));
}

function isRecentHint(date: string | null, nowIso: string, url: string, title: string | null): boolean {
  const currentYear = new Date(nowIso).getUTCFullYear();
  const explicitYears = `${url} ${title ?? ""}`.match(/\b20\d{2}\b/g)?.map(Number) ?? [];
  if (explicitYears.some(year => year < currentYear - 1)) return false;
  if (!date) return true; // unknown stays a hint; canonical Research must date it.
  const eventTime = new Date(date).getTime();
  const nowTime = new Date(nowIso).getTime();
  if (!Number.isFinite(eventTime) || !Number.isFinite(nowTime)) return true;
  const ageDays = (nowTime - eventTime) / 86_400_000;
  return ageDays >= -31 && ageDays <= 540;
}

function resultSupportsTargetGeography(item: Pick<SearchResultItem, "title" | "snippet" | "canonical_url">, geography: string): boolean {
  const text = normalize(`${item.title ?? ""} ${item.snippet ?? ""} ${item.canonical_url}`);
  if (/colombia/i.test(geography)) {
    return /\bcolombia\b|\bbogota\b|\bmedellin\b|\bcali\b|\bbarranquilla\b|\bcartagena\b|\bantioquia\b|\bcundinamarca\b|\bvalle del cauca\b/.test(text);
  }
  if (/united states|usa|u\.s\./i.test(geography)) {
    return /\bunited states\b|\busa\b|\bu s\b|\bamerican\b|\b(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/.test(text);
  }
  return new RegExp(`\\b${normalize(geography).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);
}

function targetContextSupported(plan: DiscoveryPlan, text: string): boolean {
  const target = normalize([...plan.organizationTypes, ...plan.industries].join(" "));
  const observed = normalize(text);
  if (/software|saas|technology|tecnologia/.test(target)) return /software|saas|platform|technology|tecnologia|aplicacion empresarial/.test(observed) && !/private equity|investment firm|venture capital|fondo de inversion/.test(observed);
  if (/manufactur|fabricant|productor/.test(target)) {
    if (!/manufactur|fabricant|produccion|producer|processing|plant|planta/.test(observed)) return false;
    if (/alimento|bebida|food|beverage/.test(target) && !/alimento|bebida|food|beverage|snack|panader|lacte|cervec|fruit|drink/.test(observed)) return false;
    return true;
  }
  if (/logistic|distribut|transport|freight/.test(target)) return /logistic|distribut|transport|freight|warehouse|bodega|supply chain/.test(observed);
  return true;
}

export async function runEventFirstDiscovery(
  plan: DiscoveryPlan,
  providers: SearchProvider[],
  opts: { maxQueries?: number; maxIdentityQueries?: number; now?: () => Date } = {},
): Promise<EventFirstResult> {
  const metrics: EventFirstMetrics = { queries: 0, raw_hints: 0, unique_hints: 0, subjects_extracted: 0, canonical_companies: 0, rejected: {}, provider_calls: {}, provider_failures: {}, result_types: {}, company_mentions: 0, domains_resolved: 0, geography_resolved: 0, target_valid: 0, result_audit: [], result_sample: [] };
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
      for (const item of response.results) {
        const type = classifyEventResult(item); metrics.result_types[type] = (metrics.result_types[type] ?? 0) + 1;
        if (metrics.result_audit.length < 120) metrics.result_audit.push({ provider: item.provider, type, title: item.title, url: item.canonical_url, subjects: extractEventSubjects(item.title ?? "", item.snippet ?? ""), recent: isRecentHint(item.published_date, now, item.canonical_url, item.title) });
      }
      for (const item of response.results.slice(0, 3)) if (metrics.result_sample.length < 40) metrics.result_sample.push({ query: query.query, title: item.title, url: item.canonical_url, published_date: item.published_date, provider: item.provider });
      // Result volume and foreign event subjects are not utility. Continue to
      // the next provider until at least one recent, explicit subject also has
      // evidence for the requested geography. Canonical country validation is
      // still performed later; this only controls provider fallback.
      const usefulSubjects = response.results.filter(item => {
        const subjects = extractEventSubjects(item.title ?? "", item.snippet ?? "");
        const host = sourceHost(item.canonical_url);
        return isRecentHint(item.published_date, now, item.canonical_url, item.title)
          && subjects.length > 0
          && resultSupportsTargetGeography(item, query.geography)
          // A news mention is a valuable hint, but it is not enough to stop
          // provider fallback before a company-owned identity surface appears.
          && subjects.some(subject => domainLooksCorporate(subject, host));
      }).length;
      if (usefulSubjects > 0) break;
    }
  }
  metrics.raw_hints = raw.length;

  const hints: EventDiscoveryCandidate[] = [];
  const seen = new Set<string>();
  for (const { query, item } of raw) {
    if (!isRecentHint(item.published_date, now, item.canonical_url, item.title)) { reject("stale_hint"); continue; }
    const subjects = extractEventSubjects(item.title ?? "", item.snippet ?? "");
    if (!subjects.length) { reject("no_subject"); continue; }
    metrics.subjects_extracted += subjects.length;
    metrics.company_mentions += subjects.length;
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
        headline: item.title ?? "", source_excerpt: item.snippet, source_url: item.canonical_url,
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
  let identityAttempts = 0;
  const geoRank = (hint: EventDiscoveryCandidate) => {
    const text = `${hint.headline} ${hint.source_excerpt ?? ""}`;
    const target = hint.target_geography;
    const targetSignal = resultSupportsTargetGeography({ title: hint.headline, snippet: hint.source_excerpt, canonical_url: hint.source_url }, target);
    const foreignSignal = target === "Colombia" && /\bm[eé]xico\b|\bquer[eé]taro\b|\bnuevo le[oó]n\b|\bguanajuato\b|\brep[uú]blica dominicana\b|\bespa[ñn]a\b|\bargentina\b|\bchile\b/i.test(text);
    const targetTypeSignal = targetContextSupported(plan, text);
    return (hint.company_domain_hint ? 5 : 0) + (targetSignal ? 4 : 0) + (targetTypeSignal ? 3 : 0) - (foreignSignal ? 6 : 0);
  };
  const rankedHints = [...hints].sort((a, b) => geoRank(b) - geoRank(a));
  for (const hint of rankedHints) {
    let domain = hint.company_domain_hint;
    const discoveryPage = [{ title: hint.headline, snippet: hint.source_excerpt, url: hint.source_url }];
    // Event-page geography and corporate-domain identity are independent facts.
    // A media result can explicitly ground Florida/Colombia before the separate
    // official-domain query resolves the organization; requiring the domain first
    // silently discarded valid event-led companies.
    let country: string | null = inferEnumeratedCountry(hint.company_name_hint, discoveryPage, hint.target_geography).country;
    let identityContext = `${hint.headline} ${hint.source_excerpt ?? ""}`;
    if ((!domain || !country || !targetContextSupported(plan, identityContext)) && identityCalls < identityBudget) {
      for (const provider of providers) {
        if (identityCalls >= identityBudget || identityAttempts >= identityBudget * Math.max(1, providers.length) || (domain && country && targetContextSupported(plan, identityContext))) break;
        identityAttempts++;
        metrics.provider_calls[provider.id] = (metrics.provider_calls[provider.id] ?? 0) + 1;
        const spanishIdentity = hint.target_geography === "Colombia";
        const response = await provider.search({ query: spanishIdentity ? `"${hint.company_name_hint}" sitio oficial empresa Colombia` : `"${hint.company_name_hint}" official company "${hint.target_geography}"`, region: spanishIdentity ? "co" : "us", language: spanishIdentity ? "es" : "en", max_results: 5, query_type: "official_domain" }).catch(() => ({ ok: false, results: [] } as never));
        if (!response.ok) continue;
        identityCalls++;
        const pages = response.results.map(x => ({ title: x.title, snippet: x.snippet, url: x.canonical_url }));
        domain = domain ?? inferEnumeratedDomain(hint.company_name_hint, pages).domain;
        country = country ?? inferEnumeratedCountry(hint.company_name_hint, pages, hint.target_geography).country;
        identityContext += ` ${pages.map(x => `${x.title ?? ""} ${x.snippet ?? ""}`).join(" ")}`;
      }
    }
    if (!domain) { reject("identity_unresolved"); continue; }
    if (!domainLooksCorporate(hint.company_name_hint, domain)) { reject("identity_domain_mismatch"); continue; }
    metrics.domains_resolved++;
    if (!country) { reject("geography_unresolved"); continue; }
    metrics.geography_resolved++;
    const resolvedOrg = classifyOrganization({ name: hint.company_name_hint, description: identityContext });
    if (!resolvedOrg.eligible_for_icp) { reject(`resolved_organization:${resolvedOrg.organization_type}`); continue; }
    if (!targetContextSupported(plan, identityContext)) { reject("wrong_target_type"); continue; }
    metrics.target_valid++;
    orgs.push({
      name: hint.company_name_hint, domain, country,
      organizationType: plan.organizationTypes[0] ?? plan.industries[0],
      industry: plan.industries[0] ?? plan.organizationTypes[0],
      origin: "event_first", provider: hint.provider, route: `event_first:${hint.query_family}`,
      sourceUrl: hint.source_url, confidence: "verified",
      researchHint: {
        eventTypeHint: hint.event_type_hint,
        eventDateHint: hint.event_date_hint,
        sourceUrlHint: hint.source_url,
        headline: hint.headline,
        sourceExcerpt: hint.source_excerpt,
        provider: hint.provider,
      },
    });
  }
  metrics.canonical_companies = new Set(orgs.map(x => x.domain)).size;
  return { orgs, hints, metrics };
}
