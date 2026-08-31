// ─── Company universe (company-first-v1) ─────────────────────────────────────
// The root fix for news-first discovery: instead of searching events and
// GUESSING the company from a headline (which produced Revistaturbo, El
// Transporte, "Colombia"…), we FIRST build a universe of plausible real
// companies that fit the ICP, then search signals per company (see
// signal-search.ts). Companies come from permitted public enumeration —
// sector rankings, association member lists, business directories, corporate
// pages — never Apollo/PDL/PII. Every candidate name is classified with
// entity-resolution-v3; only single_company survives. Publishers, public
// entities, categories and places are dropped HERE, before any signal search.

import type { ICP, LeadSearchCriteria } from "@/types";
import type { NeedsMap } from "./needs-map";
import { classifyEntity } from "@/lib/vault/entity-resolution";
import { classifyOrganization } from "./organization-type";
import { inferAccountCommercialRole, rolePriority, type AccountCommercialRole } from "./account-role";
import { getUsage } from "@/lib/ops/usage-ledger";
import { classifyProviderError } from "@/lib/ops/provider-health";
import type { SearchProvider } from "@/lib/sources/access/provider-contract";

export const COMPANY_UNIVERSE_VERSION = "company-universe-v2";

export interface UniverseCompany {
  name: string;
  domain: string | null;
  country: string | null;
  region: string | null;
  sector: string | null;
  discovery_source: string;       // the enumeration URL/title the name came from
  discovery_route?: "industry_category" | "geo_category" | "source_ecosystem" | "vertical_seed";
  discovery_channels?: Array<"dynamic" | "pack">;
  confidence: "verified" | "plausible";
  fit_reason: string;
  visibility_tier?: "emerging" | "established" | "obvious";
  universe_origin?: "vertical_seed" | "dynamic_enumeration";
  universe_score?: number;
  country_confidence?: "verified_pack" | "high" | "medium" | "unknown";
  country_evidence?: string | null;
  account_role?: AccountCommercialRole;
  account_role_confidence?: "high" | "medium" | "low";
  account_role_evidence?: string[];
}

export interface EnumerationRouteMetric { route: string; queries: number; result_pages: number; grounded_names: number; accepted_companies: number; }
export interface EnumerationTrace { route: string; query: string; provider: string; result_count: number; results: Array<{ title: string | null; url: string }> }
export interface UniverseResult {
  companies: UniverseCompany[];
  stats: { enumeration_queries: number; domain_resolution_queries: number; structured_pages_extracted: number; structured_entities_found: number; raw_names: number; raw_name_sample: string[]; classified_company: number; rejected: Record<string, number>; degraded_seed_pack?: string | null; route_metrics: EnumerationRouteMetric[]; enumeration_trace: EnumerationTrace[]; providers_available: string[]; providers_failed: string[]; llm_extraction_used: boolean };
}

// Publisher/media and directory hosts never seed a company name from their own
// brand — we mine the company names FROM their content instead.
const MEDIA_OR_DIRECTORY = /(revista|diario|peri[oó]dico|portal|noticias?|prensa|larepublica|portafolio|dinero|semana|eltiempo|elespectador|bnamericas|forbes|bloomberg|reuters|paginas?amarillas|directorio|guia|listado)/i;
export const isMediaOrDirectoryName = (name: string): boolean => MEDIA_OR_DIRECTORY.test(name);
// Single-token names that are generic Spanish commercial words or ambiguous
// fragments ("Inter" → ¿Inter Rapidísimo? ¿Banco Inter BR? ¿Inter Milan?).
// These match anything downstream (substrings/homonyms) and produced the
// "Inter"/Nu-bank false positive in the 2026-07-21 traced benchmark.
const AMBIGUOUS_NAME = /^(inter|natural|mente|mercado|grupo|empresa|compa[ñn][ií]a|industria|comercio|log[ií]stica|transportes?|nacional|central|global|capital|digital|express|colombia|andina|caribe|pacifico|servicios?|soluciones|sistemas?|general|internacional|carga|cargas|estas?|estos?|env[ií]os?|entregas?|empresas|sector|negocios?|econom[ií]a|pa[ií]s|ciudad|regi[oó]n|distribuci[oó]n|almacenamiento|bodegas?|flotas?|veh[ií]culos?|camiones|operador(es)?|proveedor(es)?|clientes?|productos?|ventas?|bogot[aá]|medell[ií]n|cali|barranquilla)$/i;
const GENERIC_COMPANY_WORD = new Set([
  "producto", "productos", "natural", "naturales", "naturista", "naturistas", "saludable", "saludables",
  "tienda", "mercado", "supermercado", "distribuidor", "distribuidores", "hotel", "hoteles", "spa", "resort",
  "empresa", "grupo", "colombia", "bogota", "medellin", "cali", "barranquilla", "cartagena", "global", "servicios",
  "packaging", "paper", "foods", "food", "beverage", "industrial", "industries", "manufacturing", "distribution", "enterprises",
  "supply", "supplies", "direct", "international",
  "alimento", "alimentos", "bebida", "bebidas", "comercial", "comerciales",
]);

export function rejectEnumeratedName(name: string): string | null {
  const clean = name.trim();
  const normalized = clean.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length < 4) return "name_too_short";
  if (/^(quienes|enes) somos$|^(inicio|contacto|nosotros|home|about us)$/i.test(normalized)) return "navigation_fragment";
  const words = normalized.split(" ").filter(Boolean);
  if (words.every(w => GENERIC_COMPANY_WORD.has(w))) return "generic_commercial_phrase";
  if (AMBIGUOUS_NAME.test(clean)) return "entity_ambiguous_generic_name";
  return null;
}

function domainOf(url: string): string | null {
  try { return new URL(url).host.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

function norm(value: string): string { return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ""); }

/** Infers a corporate domain only when the host itself carries a distinctive
 * company token. A page mentioning a company on a directory/news host remains
 * provenance, never an asserted official domain. */
export function inferEnumeratedDomain(company: string, pages: { title: string | null; snippet: string | null; url: string }[]): { domain: string | null; source: string | null } {
  const companyNorm = norm(company);
  // Four-character corporate brands are common (Lear, Quad, UFPW-like names).
  // Requiring five characters made an otherwise exact official host such as
  // Lear Corporation -> lear.com impossible to verify after legal suffixes were
  // removed. Generic commercial tokens remain excluded, and the host must still
  // carry the complete distinctive token, so this does not weaken the
  // directory/media or unrelated-host guards.
  const tokens = company.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(t => t.length >= 4 && !GENERIC_COMPANY_WORD.has(t) && !/^(company|compania|corporation|incorporated|limited|internacional)$/.test(t));
  const mentioned = pages.filter(p => norm(`${p.title ?? ""} ${p.snippet ?? ""}`).includes(companyNorm) || tokens.some(t => norm(`${p.title ?? ""} ${p.snippet ?? ""}`).includes(t)));
  for (const p of mentioned) {
    const domain = domainOf(p.url);
    if (!domain || MEDIA_OR_DIRECTORY.test(domain)) continue;
    const hostNorm = norm(domain.split(".").slice(0, -1).join(""));
    if ((companyNorm.length >= 5 && hostNorm.includes(companyNorm)) || tokens.some(t => hostNorm.includes(t))) return { domain, source: p.url };
  }
  return { domain: null, source: mentioned[0]?.url ?? null };
}

export function inferEnumeratedCountry(company: string, pages: { title: string | null; snippet: string | null; url: string }[], targetCountry: string): { country: string | null; confidence: "high" | "medium" | "unknown"; evidence: string | null } {
  const companyNorm = norm(company);
  const country = targetCountry.trim();
  if (!country) return { country: null, confidence: "unknown", evidence: null };
  // Search-result prose often repeats the requested geography even when the
  // organization is explicitly foreign (observed: "Omni-Pac UK" on a US
  // packaging query). A contradictory company marker or country-code domain
  // dominates that query-context mention. Global .com domains remain eligible
  // because multinationals may operate legitimately in the target market.
  const targetIsUs = /^(united states|usa|us|u\.s\.)$/i.test(country);
  const targetIsColombia = /^colombia$/i.test(country);
  const explicitUk = /(?:^|\s)(?:uk|u\.k\.|united kingdom)(?:$|\s)/i.test(company);
  const foreignCountryHost = pages.some(p => {
    const domain = domainOf(p.url);
    if (!domain) return false;
    if (targetIsUs) return /\.(?:co\.uk|uk|co|de|fr|es|it|br|mx|ca|au|in|jp)$/i.test(domain);
    if (targetIsColombia) return /\.(?:co\.uk|uk|us|de|fr|es|it|br|mx|ca|au|in|jp)$/i.test(domain);
    return false;
  });
  if ((targetIsUs && explicitUk) || foreignCountryHost) return { country: null, confidence: "unknown", evidence: null };
  const geoPattern = /^colombia$/i.test(country)
    ? /\bcolombia\b|\bbogot[aá]\b|\bmedell[ií]n\b|\bcali\b|\bbarranquilla\b|\bcartagena\b|\bbucaramanga\b|\bpereira\b/i
    : /^(united states|usa|us|u\.s\.)$/i.test(country)
      ? /\bunited states\b|\bu\.s\.a?\b|\busa\b|\bamerican\b/i
      : new RegExp(`\\b${country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  for (const p of pages) {
    const text = `${p.title ?? ""} ${p.snippet ?? ""}`;
    if (!norm(text).includes(companyNorm)) continue;
    const domain = domainOf(p.url);
    if (geoPattern.test(text)) return { country, confidence: "high", evidence: p.url };
    if (/^colombia$/i.test(country) && domain && /\.co$/i.test(domain)) return { country, confidence: "medium", evidence: p.url };
  }
  return { country: null, confidence: "unknown", evidence: null };
}

/** Explicit brand-only identity is not an operating account. This deliberately
 * requires a company-specific construction; a corporation mentioning that it
 * owns brands is not rejected. */
export function isBrandOnlyIdentity(company: string, pages: { title: string | null; snippet: string | null; url: string }[]): boolean {
  const escaped = company.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return false;
  const exactBrand = new RegExp(`(?:${escaped}\\s*\\(brand\\)|${escaped}\\s*(?:®)?\\s+brand\\b|${escaped}\\s+(?:is|was)\\s+(?:an?\\s+)?(?:[a-z-]+\\s+){0,3}brand\\b|${escaped}[^.]{0,45}brand\\s+(?:of|owned by|belonging to))`, "i");
  return pages.some((page) => exactBrand.test(`${page.title ?? ""}. ${page.snippet ?? ""}`));
}

/** Enumeration queries: find PAGES THAT LIST companies matching the ICP —
 *  rankings, association members, sector directories — plus a few
 *  official-domain probes. Region/vertical aware, from the needs map. */
export interface EnumerationRouteQuery { route: "industry_category" | "geo_category" | "source_ecosystem"; query: string; }

/** Organization-enumeration queries deliberately exclude event/change terms.
 * Events belong to Research. Every query repeats the confirmed target family so
 * routing cannot silently broaden "manufacturers" into "any warehouse user". */
export function enumerationRouteQueries(icp: ICP, geo0: string, needs: NeedsMap, spanish: boolean): EnumerationRouteQuery[] {
  const targetTerms = Array.from(new Set(icp.target_industries.map(x => x.trim()).filter(Boolean))).slice(0, 3);
  // Search engines interpret a long "A and B and C" phrase as one impossible
  // category. Preserve every confirmed buyer family, but express alternatives
  // explicitly so one vertical cannot suppress the others.
  const target = targetTerms.length > 1
    ? `(${targetTerms.map((term) => `"${term.slice(0, 48)}"`).join(" OR ")})`
    : (targetTerms[0] ?? "");
  const industry = target || needs.target_company_profile.slice(0, 100);
  const geo = (geo0 || (spanish ? "Colombia" : "United States")).slice(0, 40);
  const wellness = /wellness|bienestar|productos? naturales|bebidas? funcional|spa|hotel|resort|retail/i.test(`${industry} ${needs.target_company_profile} ${needs.expected_need}`);
  if (spanish) {
    if (wellness) return [
      { route: "industry_category", query: `empresas compran venden distribuyen ${industry} ${geo}` },
      { route: "geo_category", query: `${geo} Bogotá Medellín Cali cadenas tiendas naturistas distribuidores multimarca ${industry}` },
      { route: "source_ecosystem", query: `miembros asociación gremio ${industry} ${geo}` },
      { route: "source_ecosystem", query: `hoteles boutique spa resorts ${industry} ${geo}` },
      { route: "geo_category", query: `${industry} operadores regionales independientes ${geo}` },
    ];
    return [
      { route: "industry_category", query: `empresas ${industry} ${geo}` },
      { route: "geo_category", query: `${industry} empresas por región ${geo}` },
      { route: "source_ecosystem", query: `miembros asociación gremio ${industry} ${geo}` },
      { route: "source_ecosystem", query: `expositores feria ${industry} ${geo} empresas` },
      { route: "industry_category", query: `listado empresas ${industry} ${geo}` },
    ];
  }
  return [
    { route: "industry_category", query: `${geo} ${industry} companies` },
    { route: "geo_category", query: `${industry} companies by state ${geo}` },
    { route: "source_ecosystem", query: `${industry} association member companies ${geo}` },
    { route: "source_ecosystem", query: `${industry} trade show exhibitor companies ${geo}` },
    { route: "industry_category", query: `list of ${industry} companies ${geo}` },
  ];
}

export function enumerationQueries(icp: ICP, geo0: string, needs: NeedsMap, spanish: boolean): string[] {
  return enumerationRouteQueries(icp, geo0, needs, spanish).map(x => x.query);
}

/** Portfolio construction is deliberately unlike a search-results page:
 * dynamic discoveries receive protected capacity, curated knowledge provides
 * a quality prior, and obvious accounts are only backfill/benchmarks. */
export function prioritizeUniverse(companies: UniverseCompany[], limit: number): UniverseCompany[] {
  const score = (c: UniverseCompany) => {
    const origin = c.universe_origin === "dynamic_enumeration" ? 18 : 12;
    const identity = c.domain ? 18 : 7;
    const novelty = c.visibility_tier === "emerging" ? 18 : c.visibility_tier === "obvious" ? -25 : c.visibility_tier === "established" ? 8 : 14;
    return origin + identity + novelty + rolePriority(c.account_role);
  };
  const ranked = companies.map(c => ({ ...c, universe_score: score(c) }));
  const dynamic = ranked.filter(c => c.universe_origin === "dynamic_enumeration" && c.visibility_tier !== "obvious").sort((a, b) => (b.universe_score ?? 0) - (a.universe_score ?? 0));
  const seeds = ranked.filter(c => c.universe_origin !== "dynamic_enumeration" && c.visibility_tier !== "obvious").sort((a, b) => (b.universe_score ?? 0) - (a.universe_score ?? 0));
  const obvious = ranked.filter(c => c.visibility_tier === "obvious").sort((a, b) => (b.universe_score ?? 0) - (a.universe_score ?? 0));
  const selected: UniverseCompany[] = [];
  // Reserve up to 40% for new discoveries. If enumeration is weak, seeds fill
  // the capacity; dynamic names never displace all verified priors.
  const dynamicTarget = Math.min(dynamic.length, Math.max(1, Math.floor(limit * 0.4)));
  selected.push(...dynamic.slice(0, dynamicTarget));
  // Preserve buyer-route diversity before filling by raw score. This prevents
  // ten distributors from crowding hospitality out of a wellness portfolio.
  const protectedRoleMinimums: Array<[AccountCommercialRole, number]> = [["buyer_channel", 2], ["hospitality_operator", 2], ["end_user_operator", 1]];
  for (const [protectedRole, desired] of protectedRoleMinimums) {
    const pool = [...seeds, ...dynamic].filter(c => c.account_role === protectedRole);
    while (selected.filter(c => c.account_role === protectedRole).length < desired && selected.length < limit) {
      const anchor = pool.find(c => !selected.some(s => s.name.toLowerCase() === c.name.toLowerCase()));
      if (!anchor) break;
      selected.push(anchor);
    }
  }
  const selectedKeys = new Set(selected.map(c => c.name.toLowerCase()));
  let si = 0, di = dynamicTarget;
  while (selected.length < limit && (si < seeds.length || di < dynamic.length)) {
    if (si < seeds.length) { const c = seeds[si++]; if (!selectedKeys.has(c.name.toLowerCase())) { selected.push(c); selectedKeys.add(c.name.toLowerCase()); } }
    if (selected.length < limit && di < dynamic.length) { const c = dynamic[di++]; if (!selectedKeys.has(c.name.toLowerCase())) { selected.push(c); selectedKeys.add(c.name.toLowerCase()); } }
  }
  for (const c of obvious) if (selected.length < limit) selected.push(c);
  return selected.slice(0, limit);
}

/** Extract candidate company names from enumeration result pages using the LLM
 *  (bounded), then classify each with entity-resolution-v3. Deterministic
 *  fallback mines capitalized multi-word tokens from titles/snippets. */
export function companyNameGroundedInPages(name: string, pages: { title: string | null; snippet: string | null }[]): boolean {
  const distinctive = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter(t => t.length >= 4 && !GENERIC_COMPANY_WORD.has(t) && !/^(company|corporation|incorporated|limited|group|grupo)$/.test(t));
  if (!distinctive.length) return false;
  return pages.some(p => {
    const hay = `${p.title ?? ""} ${p.snippet ?? ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return distinctive.every(t => new RegExp(`(?:^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[^a-z0-9])`, "i").test(hay));
  });
}

async function extractCompanyNames(pages: { title: string | null; snippet: string | null; url: string }[], spanish: boolean, targetFamily: string): Promise<{ names: string[]; llm_ok: boolean }> {
  const corpus = pages.map((p) => `- ${p.title ?? ""} | ${p.snippet ?? ""}`).join("\n").slice(0, 6000);
  if (process.env.ANTHROPIC_API_KEY && process.env.DEMO_MODE !== "true" && corpus.length > 40) {
    try {
      const { callClaudeJSON } = await import("@/lib/anthropic");
      const SYSTEM = `Extraes NOMBRES DE EMPRESAS REALES de fragmentos de listados/rankings/directorios para la familia objetivo: ${targetFamily}. Reglas estrictas:
- Solo empresas comerciales reales (con operación), NO medios, NO entidades públicas, NO ciudades/países, NO categorías genéricas.
- Solo organizaciones que el fragmento vincula explícitamente con la familia objetivo; no amplíes a industrias adyacentes.
- Devuelve el nombre corporativo, no el titular de la noticia.
- El nombre debe aparecer literalmente en los fragmentos. No completes ni inventes empresas por conocimiento previo.
- Si no estás seguro de que sea una empresa real, NO la incluyas.
- Devuelve SOLO JSON: {"companies": ["Nombre 1","Nombre 2", ...]}`;
      const r = await callClaudeJSON<{ companies: string[] }>(SYSTEM, `Fragmentos:\n${corpus}\n\nExtrae hasta 30 nombres de empresas reales ${spanish ? "colombianas" : ""}.`, 1200);
      const llmNames = (r.companies ?? []).filter(Boolean).filter(n => companyNameGroundedInPages(n, pages));
      // A syntactically successful but near-empty extraction is a recall failure,
      // not proof that 20+ result snippets name no companies. Recover only literal,
      // grounded proper names; all normal entity/geography/domain gates still run.
      const recovered = llmNames.length < 5 ? recoverGroundedCompanyNames(pages) : [];
      return { names: Array.from(new Set([...llmNames, ...recovered])).slice(0, 40), llm_ok: true };
    } catch { /* fall through — key may exist but be EXHAUSTED at runtime */ }
  }
  // Fallback: capitalized 1-3 word tokens from titles (weak, flagged low).
  const names = new Set<string>();
  for (const p of pages) {
    const m = (p.title ?? "").match(/\b([A-ZÁÉÍÓÚÑ][\wáéíóúñ&.-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ&.-]+){0,2})\b/g) ?? [];
    for (const n of m) if (n.length >= 4 && n.length <= 40) names.add(n.trim());
  }
  return { names: Array.from(names).slice(0, 40), llm_ok: false };
}

const ENUMERATION_PHRASE_REJECT = /\b(top|best|list|manufacturers?|manufacturing|industry|association|members?|directory|market|united states|america|news|report|guide|suppliers?|vendors?|food|beverage|consumer goods)\b/i;

/** Deterministic thin-universe recovery. It never invents a name: every result is
 * a literal capitalized phrase from a title/snippet and must pass the same strict
 * page-grounding boundary as LLM output. Subsequent entity/geography/domain gates
 * remain authoritative. */
export function recoverGroundedCompanyNames(pages: { title: string | null; snippet: string | null }[]): string[] {
  const names = new Set<string>();
  for (const page of pages) {
    const text = `${page.title ?? ""}. ${page.snippet ?? ""}`;
    const matches = text.match(/(?:^|[.!?;:]\s+)([A-Z][A-Za-z0-9&'’.-]*(?:\s+(?:[A-Z][A-Za-z0-9&'’.-]*|of|and|de|del|la)){0,4})/g) ?? [];
    for (const raw of matches) {
      const name = raw.replace(/^[.!?;:]\s*/, "").replace(/[.,;:]$/, "").trim();
      // Recovery is deliberately more conservative than the LLM path: generic
      // one-word heading fragments ("Expansion", "Solutions") are the dominant
      // false-positive class. Distinctive one-word brands still come through LLM
      // extraction or verified vertical packs.
      if (name.length < 4 || name.length > 70 || !/\s/.test(name) || /\b(?:and|of|de|del|la)$/i.test(name) || ENUMERATION_PHRASE_REJECT.test(name)) continue;
      if (!companyNameGroundedInPages(name, [page])) continue;
      names.add(name);
    }
  }
  return Array.from(names).slice(0, 30);
}

export interface StructuredCompanyEntity { name: string; domain: string; source_url: string; official_url: string; }

/** Deterministic extraction from directory/member/exhibitor pages. Only an
 * explicit outbound corporate URL can create an entity; headings and page-owner
 * names alone cannot. The enumeration page remains provenance, never account. */
export function extractStructuredCompanyEntities(content: string, sourceUrl: string): StructuredCompanyEntity[] {
  let sourceHost = "";
  try { sourceHost = new URL(sourceUrl).host.replace(/^www\./, "").toLowerCase(); } catch { return []; }
  const candidates: Array<{ name: string; url: string }> = [];
  const push = (nameRaw: string, urlRaw: string) => {
    const name = nameRaw.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
    if (!name || rejectEnumeratedName(name) || name.length > 90) return;
    let url: URL;
    try { url = new URL(urlRaw, sourceUrl); } catch { return; }
    if (!/^https?:$/.test(url.protocol)) return;
    const host = url.host.replace(/^www\./, "").toLowerCase();
    if (!host || host === sourceHost || host.endsWith(`.${sourceHost}`) || /(?:facebook|linkedin|instagram|youtube|twitter|x)\.com$/i.test(host) || MEDIA_OR_DIRECTORY.test(host)) return;
    const inferred = inferEnumeratedDomain(name, [{ title: name, snippet: "official website", url: url.toString() }]);
    if (inferred.domain !== host) return;
    candidates.push({ name, url: url.toString() });
  };
  for (const match of content.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) push(match[2], match[1]);
  for (const match of content.matchAll(/\[([^\]\n]{3,90})\]\((https?:\/\/[^)\s]+)\)/g)) push(match[1], match[2]);
  for (const match of content.matchAll(/"@type"\s*:\s*"(?:Organization|Corporation|LocalBusiness)"[\s\S]{0,900}?"name"\s*:\s*"([^"]{3,90})"[\s\S]{0,900}?"url"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+)"/gi)) push(match[1], match[2].replace(/\\\//g, "/"));
  const unique = new Map<string, StructuredCompanyEntity>();
  for (const item of candidates) {
    const domain = domainOf(item.url);
    if (!domain || unique.has(domain)) continue;
    unique.set(domain, { name: item.name, domain, source_url: sourceUrl, official_url: item.url });
  }
  return Array.from(unique.values()).slice(0, 30);
}

export async function buildCompanyUniverse(
  icp: ICP, criteria: LeadSearchCriteria, needs: NeedsMap,
  opts: { maxCompanies?: number; providersOverride?: { braveProvider: SearchProvider; tavilyProvider: SearchProvider; serperProvider: SearchProvider } } = {},
): Promise<UniverseResult> {
  // providersOverride is a controlled-test seam only (provider-resilience doubles);
  // production always uses the real configured provider stack.
  const { braveProvider, serperProvider, tavilyProvider } = opts.providersOverride ?? await import("@/lib/sources/access/providers");
  const spanish = criteria.output_language === "es" || criteria.target_market_region === "latin_america";
  const gl = criteria.target_market_region === "latin_america" ? "co" : "us";
  const routeQueries = enumerationRouteQueries(icp, criteria.target_geography[0] ?? "", needs, spanish);
  const queries = routeQueries.map(x => x.query);
  const rejected: Record<string, number> = {};
  const bump = (k: string) => (rejected[k] = (rejected[k] ?? 0) + 1);

  // 1. Gather enumeration pages (no freshness limit — directories are evergreen).
  const seen = new Set<string>();
  const pages: { title: string | null; snippet: string | null; url: string; route: EnumerationRouteQuery["route"]; query: string }[] = [];
  const routeMetrics = new Map<string, EnumerationRouteMetric>();
  const providerCooldown = new Set<string>();
  const previousUsage = getUsage();
  for (const id of ["serper", "tavily", "brave"] as const) {
    const u = previousUsage[id];
    if (!u?.last_failure || !u.last_error || Date.now() - new Date(u.last_failure).getTime() >= 86_400_000) continue;
    if (/exhausted|invalid|rate_limited/.test(classifyProviderError(u.last_error))) providerCooldown.add(id);
  }
  const providersAvailable = new Set<string>();
  const providersFailed = new Set<string>();
  const enumerationTrace: EnumerationTrace[] = [];
  let providerCalls = 0;
  let domainResolutionQueries = 0;
  const maxEnumerationProviderCalls = 8;
  for (const rq of routeQueries) {
    const q = rq.query;
    const rm = routeMetrics.get(rq.route) ?? { route: rq.route, queries: 0, result_pages: 0, grounded_names: 0, accepted_companies: 0 };
    rm.queries++; routeMetrics.set(rq.route, rm);
    const gathered: Array<{ canonical_url: string; title: string | null; snippet: string | null }> = [];
    for (const [name, provider] of [["brave", braveProvider], ["tavily", tavilyProvider], ["serper", serperProvider]] as const) {
      if (providerCalls >= maxEnumerationProviderCalls || providerCooldown.has(name)) continue;
      const response = await provider.search({ query: q, language: spanish ? "es" : "en", region: gl, max_results: 8, query_type: "industry_discovery" }).catch(() => ({ ok: false, results: [], error: "request_failed" }));
      if (enumerationTrace.length < 12) enumerationTrace.push({ route: rq.route, query: q, provider: name, result_count: response.results.length, results: response.results.slice(0, 5).map(x => ({ title: x.title, url: x.canonical_url })) });
      if ((response as { ok?: boolean }).ok === false) {
        // A failed/rate-limited provider is cooled down AND must NOT consume the shared
        // enumeration budget — otherwise a degrading primary (e.g. Brave) starves the
        // healthy fallback providers and Discovery falsely collapses to zero (§10/§11).
        providerCooldown.add(name); providersFailed.add(name);
        continue;
      }
      providerCalls++;
      providersAvailable.add(name);
      gathered.push(...response.results);
      // Enumeration needs candidate breadth, not automatic provider consensus: stop at
      // the first provider that supplies sufficient usable results (normal path = 1).
      if (response.results.length >= 5) break;
    }
    for (const r of gathered) {
      if (seen.has(r.canonical_url)) continue;
      seen.add(r.canonical_url);
      pages.push({ title: r.title, snippet: r.snippet, url: r.canonical_url, route: rq.route, query: q });
      rm.result_pages++;
    }
  }

  // 2. Mine company names from the pages.
  const targetFamily = Array.from(new Set(icp.target_industries)).join("; ");
  const extractedNames = await extractCompanyNames(pages, spanish, targetFamily);
  let rawNames = extractedNames.names;
  let structuredPagesExtracted = 0;
  const structuredEntities: StructuredCompanyEntity[] = [];
  if (rawNames.length < 5) {
    const sourcePages = pages.filter((p) => p.route === "source_ecosystem").slice(0, 2);
    if (sourcePages.length) {
      const { extractWithFallback } = await import("@/lib/sources/access/extractors");
      for (const page of sourcePages) {
        const extraction = await extractWithFallback(page.url).catch(() => null);
        if (!extraction?.ok || !extraction.content) continue;
        structuredPagesExtracted++;
        structuredEntities.push(...extractStructuredCompanyEntities(extraction.content, page.url));
      }
      rawNames = Array.from(new Set([...rawNames, ...structuredEntities.map((entity) => entity.name)])).slice(0, 40);
    }
  }
  const structuredByName = new Map(structuredEntities.map((entity) => [entity.name.toLowerCase(), entity]));
  const enumeratedEvidence = new Map(rawNames.map(name => {
    const structured = structuredByName.get(name.toLowerCase());
    return [name.toLowerCase(), structured ? { domain: structured.domain, source: structured.source_url } : inferEnumeratedDomain(name, pages)] as const;
  }));
  const targetCountry = criteria.target_geography[0] ?? "";
  const enumeratedGeography = new Map(rawNames.map(name => [name.toLowerCase(), inferEnumeratedCountry(name, pages, targetCountry)]));

  // 2b. Vertical-pack seed universe. A matched pack is a curated candidate
  // prior, not merely an outage fallback: LLM enumeration can return famous but
  // commercially wrong companies (observed in the Amor de Gea US wellness
  // pilot). Pack candidates go first, while every downstream identity, event,
  // fit and evidence gate remains fully active.
  let degraded_seed_pack: string | null = null;
  const packDomains = new Map<string, string>();   // HTTP-verified pack domains
  const packVisibility = new Map<string, "emerging" | "established" | "obvious">();
  const packRoles = new Map<string, AccountCommercialRole>();
  const packSectors = new Map<string, string>();
  const packSeedNames: string[] = [];
  const { matchVerticalPack } = await import("./vertical-packs");
  const pack = matchVerticalPack(icp, criteria);
  if (pack) {
    if (!extractedNames.llm_ok) degraded_seed_pack = pack.id;
    for (const s of pack.seed_companies) {
      packSeedNames.push(s.name);
      if (s.domain) packDomains.set(s.name.toLowerCase(), s.domain);
      if (s.visibility_tier) packVisibility.set(s.name.toLowerCase(), s.visibility_tier);
      if (s.account_role) packRoles.set(s.name.toLowerCase(), s.account_role);
      packSectors.set(s.name.toLowerCase(), s.sector);
    }
  }

  // 3. Classify + dedupe. Only single_company survives; everything else is a
  //    named rejection reason (no publisher/place/category ever advances).
  const universe = new Map<string, UniverseCompany>();
  const claimedDomains = new Map<string, string>();
  const seedKeys = new Set(packSeedNames.map(name => name.toLowerCase()));
  const excludedAccountKeys = new Set((criteria.excluded_account_names ?? []).map(name => norm(name)));
  for (const name of [...packSeedNames, ...rawNames]) {
    if (MEDIA_OR_DIRECTORY.test(name)) { bump("media_or_directory_name"); continue; }
    // Ambiguous single-token generic names ("Inter", "Mercado") match anything
    // downstream (substrings, homonyms, foreign banks) — never a resolvable
    // account on their own. Distinctive brands (Rappi, Opain) stay valid.
    const isSeedName = seedKeys.has(name.toLowerCase());
    const nameRejection = isSeedName ? null : rejectEnumeratedName(name);
    if (nameRejection) { bump(nameRejection); continue; }
    if (!isSeedName && isBrandOnlyIdentity(name, pages)) { bump("brand_not_operating_company"); continue; }
    const cls = classifyEntity({ name, signalType: null });
    if (cls.entity_class !== "single_company" || !cls.primary_account) { bump(`entity_${cls.entity_class}`); continue; }
    if (excludedAccountKeys.has(norm(cls.primary_account))) {
      bump("excluded_previous_account_before_search");
      continue;
    }
    const org = classifyOrganization({ name: cls.primary_account, description: icp.target_industries[0] ?? "" });
    if (!org.eligible_for_icp) { bump(`org_${org.organization_type}`); continue; }
    const key = cls.primary_account.toLowerCase();
    if (universe.has(key)) {
      // Appearing independently in enumeration strengthens a seed's provenance.
      if (!seedKeys.has(name.toLowerCase())) {
        const existing = universe.get(key)!;
        existing.universe_score = (existing.universe_score ?? 0) + 5;
        existing.discovery_channels = Array.from(new Set<"dynamic" | "pack">([...(existing.discovery_channels ?? ["pack"]), "dynamic"]));
      }
      continue;
    }
    const isSeed = seedKeys.has(name.toLowerCase());
    const enumerated = enumeratedEvidence.get(name.toLowerCase());
    const geography = enumeratedGeography.get(name.toLowerCase());
    const resolvedDomain = packDomains.get(cls.primary_account.toLowerCase()) ?? (!isSeed ? enumerated?.domain : null) ?? null;
    if (!isSeed && resolvedDomain && claimedDomains.has(resolvedDomain)) { bump("duplicate_domain_identity"); continue; }
    // Geography is finalized AFTER bounded corporate identity expansion below.
    // Rejecting here made country a prerequisite for domain research and caused
    // literal US manufacturers to disappear merely because an enumeration
    // snippet omitted "United States". Target geography itself is still never
    // evidence: unresolved/conflicting companies are removed after expansion.
    const roleText = isSeed
      ? `${pack?.seed_companies.find(s => s.name.toLowerCase() === name.toLowerCase())?.sector ?? ""} ${name}`
      : pages.filter(p => norm(`${p.title ?? ""} ${p.snippet ?? ""}`).includes(norm(name))).map(p => `${p.title ?? ""} ${p.snippet ?? ""}`).join(" ");
    const inferredRole = inferAccountCommercialRole(roleText);
    const accountRole = packRoles.get(cls.primary_account.toLowerCase()) ?? inferredRole.role;
    const groundingPage = !isSeed ? pages.find(p => companyNameGroundedInPages(name, [p])) : undefined;
    if (groundingPage) {
      const rm = routeMetrics.get(groundingPage.route); if (rm) rm.grounded_names++;
    }
    universe.set(key, {
      name: cls.primary_account, domain: resolvedDomain,
      country: isSeed ? (targetCountry || (gl === "co" ? "Colombia" : null)) : (geography?.country ?? null),
      region: criteria.target_market_region ?? null,
      // A hotel, specialist retailer and distributor must not all inherit the
      // same broad ICP label: their own sector drives role-aware queries and
      // commercial-fit reasoning downstream.
      sector: isSeed ? (packSectors.get(cls.primary_account.toLowerCase()) ?? icp.target_industries[0] ?? null) : (icp.target_industries[0] ?? null),
      discovery_source: isSeed ? `vertical intelligence pack: ${pack?.id ?? "unknown"}` : (enumerated?.source ?? "dynamic sector enumeration (associations/exhibitors/specialists)"),
      discovery_route: isSeed ? "vertical_seed" : (groundingPage?.route ?? "industry_category"),
      discovery_channels: [isSeed ? "pack" : "dynamic"],
      confidence: resolvedDomain ? "verified" : "plausible",
      fit_reason: isSeed
        ? `Prior sectorial de LeadLens para ${icp.target_industries[0] ?? ""}; aún requiere señal y evidencia comercial.`
        : `Descubierta dinámicamente en fuentes de asociaciones, expositores u operadores especializados de ${icp.target_industries[0] ?? ""} en ${criteria.target_geography[0] ?? ""}.`,
      visibility_tier: packVisibility.get(cls.primary_account.toLowerCase()),
      universe_origin: isSeed ? "vertical_seed" : "dynamic_enumeration",
      country_confidence: isSeed ? "verified_pack" : (geography?.confidence ?? "unknown"),
      country_evidence: isSeed ? `vertical intelligence pack: ${pack?.id ?? "unknown"}` : (geography?.evidence ?? null),
      account_role: accountRole,
      account_role_confidence: packRoles.has(cls.primary_account.toLowerCase()) ? "high" : inferredRole.confidence,
      account_role_evidence: packRoles.has(cls.primary_account.toLowerCase()) ? [`curated vertical role: ${accountRole}`] : inferredRole.evidence,
    });
    if (!isSeed && groundingPage) { const rm = routeMetrics.get(groundingPage.route); if (rm) rm.accepted_companies++; }
    if (resolvedDomain) claimedDomains.set(resolvedDomain, key);
  }

  // 4. Bounded identity expansion for organizations discovered autonomously.
  // Category/list pages rarely link each corporate homepage. Resolve only the
  // first few grounded names through ONE healthy provider; this is permitted
  // named-account expansion because the names came from upstream discovery.
  // The existing host/name guard remains authoritative, so search snippets can
  // never turn a directory or unrelated company into an official domain.
  const identityPriority = (company: UniverseCompany): number => {
    if (company.domain) return 100;
    const name = company.name;
    const corporateForm = /\b(company|co\.?|corp(?:oration)?|inc\.?|llc|ltd|brands?|foods?|industries|holdings|labs?|supply|group)\b/i.test(name) ? 35 : 0;
    const words = name.trim().split(/\s+/).length;
    return corporateForm + Math.min(words, 4) * 5;
  };
  const unresolved = Array.from(universe.values()).filter(c => c.universe_origin === "dynamic_enumeration"
    && (!c.domain || Boolean(targetCountry && c.country !== targetCountry)))
    .sort((a, b) => identityPriority(b) - identityPriority(a) || a.name.localeCompare(b.name))
    .slice(0, 6);
  const identityProvider = providersAvailable.has("brave") && !providerCooldown.has("brave")
    ? (["brave", braveProvider] as const)
    : providersAvailable.has("tavily") && !providerCooldown.has("tavily") ? (["tavily", tavilyProvider] as const) : null;
  const brandOnlyKeys = new Set<string>();
  if (identityProvider) {
    for (const company of unresolved) {
      if (providerCalls >= 12) break;
      const q = `"${company.name}" official company website ${targetCountry} ${targetFamily}`.slice(0, 240);
      providerCalls++; domainResolutionQueries++;
      const response = await identityProvider[1].search({ query: q, language: spanish ? "es" : "en", region: gl, max_results: 5, query_type: "company_specific" }).catch(() => ({ ok: false, results: [], error: "request_failed" }));
      if ((response as { ok?: boolean }).ok === false) { providersFailed.add(identityProvider[0]); break; }
      const identityPages = response.results.map(r => ({ title: r.title, snippet: r.snippet, url: r.canonical_url }));
      if (enumerationTrace.length < 20) enumerationTrace.push({ route: "named_account_expansion", query: q, provider: identityProvider[0], result_count: response.results.length, results: response.results.slice(0, 5).map(x => ({ title: x.title, url: x.canonical_url })) });
      if (isBrandOnlyIdentity(company.name, identityPages)) {
        brandOnlyKeys.add(company.name.toLowerCase());
        bump("brand_not_operating_company");
        continue;
      }
      const inferred = inferEnumeratedDomain(company.name, identityPages);
      const inferredCountry = inferEnumeratedCountry(company.name, identityPages, targetCountry);
      if (inferred.domain) {
        const claimed = claimedDomains.get(inferred.domain);
        if (claimed && claimed !== company.name.toLowerCase()) { bump("duplicate_domain_identity"); continue; }
        company.domain = inferred.domain;
        company.confidence = "verified";
        company.discovery_source = `${company.discovery_source}; corporate identity: ${inferred.source}`;
        claimedDomains.set(inferred.domain, company.name.toLowerCase());
      }
      if (inferredCountry.country) {
        company.country = inferredCountry.country;
        company.country_confidence = inferredCountry.confidence;
        company.country_evidence = inferredCountry.evidence;
      }
    }
  }

  // Final geography gate: target geography is never accepted from query intent.
  // A dynamic company must have explicit page/domain evidence collected either
  // during enumeration or corporate identity expansion.
  const geographySafe = Array.from(universe.values()).filter((company) => {
    if (brandOnlyKeys.has(company.name.toLowerCase())) return false;
    if (company.universe_origin !== "dynamic_enumeration" || !targetCountry) return true;
    // Dynamic self-serve candidates must resolve to a corporate domain. A brand
    // name plus target-country prose is not a canonical account identity.
    if (company.domain && company.country === targetCountry) return true;
    if (!company.domain) bump("dynamic_identity_unresolved");
    bump("dynamic_geography_unverified");
    return false;
  });
  for (const metric of Array.from(routeMetrics.values())) metric.accepted_companies = geographySafe.filter((company) => company.discovery_route === metric.route).length;
  const companies = prioritizeUniverse(geographySafe, opts.maxCompanies ?? 40);
  return {
    companies,
    stats: { enumeration_queries: queries.length, domain_resolution_queries: domainResolutionQueries, structured_pages_extracted: structuredPagesExtracted, structured_entities_found: structuredEntities.length, raw_names: rawNames.length, raw_name_sample: rawNames.slice(0, 30), classified_company: companies.length, rejected, degraded_seed_pack, route_metrics: Array.from(routeMetrics.values()), enumeration_trace: enumerationTrace, providers_available: Array.from(providersAvailable), providers_failed: Array.from(providersFailed), llm_extraction_used: extractedNames.llm_ok },
  };
}

export { domainOf, MEDIA_OR_DIRECTORY };
