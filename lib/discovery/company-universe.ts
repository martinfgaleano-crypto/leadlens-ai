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

export const COMPANY_UNIVERSE_VERSION = "company-first-v1";

export interface UniverseCompany {
  name: string;
  domain: string | null;
  country: string | null;
  region: string | null;
  sector: string | null;
  discovery_source: string;       // the enumeration URL/title the name came from
  confidence: "verified" | "plausible";
  fit_reason: string;
}

export interface UniverseResult {
  companies: UniverseCompany[];
  stats: { enumeration_queries: number; raw_names: number; classified_company: number; rejected: Record<string, number> };
}

// Publisher/media and directory hosts never seed a company name from their own
// brand — we mine the company names FROM their content instead.
const MEDIA_OR_DIRECTORY = /(revista|diario|peri[oó]dico|portal|noticias?|prensa|larepublica|portafolio|dinero|semana|eltiempo|elespectador|bnamericas|forbes|bloomberg|reuters|paginas?amarillas|directorio|guia|listado)/i;
// Single-token names that are generic Spanish commercial words or ambiguous
// fragments ("Inter" → ¿Inter Rapidísimo? ¿Banco Inter BR? ¿Inter Milan?).
// These match anything downstream (substrings/homonyms) and produced the
// "Inter"/Nu-bank false positive in the 2026-07-21 traced benchmark.
const AMBIGUOUS_NAME = /^(inter|mercado|grupo|empresa|compa[ñn][ií]a|industria|comercio|log[ií]stica|transportes?|nacional|central|global|capital|digital|express|colombia|andina|caribe|pacifico|servicios?|soluciones|sistemas?|general|internacional|carga|cargas|estas?|estos?|env[ií]os?|entregas?|empresas|sector|negocios?|econom[ií]a|pa[ií]s|ciudad|regi[oó]n|distribuci[oó]n|almacenamiento|bodegas?|flotas?|veh[ií]culos?|camiones|operador(es)?|proveedor(es)?|clientes?|productos?|ventas?|bogot[aá]|medell[ií]n|cali|barranquilla)$/i;

function domainOf(url: string): string | null {
  try { return new URL(url).host.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}

/** Enumeration queries: find PAGES THAT LIST companies matching the ICP —
 *  rankings, association members, sector directories — plus a few
 *  official-domain probes. Region/vertical aware, from the needs map. */
function enumerationQueries(icp: ICP, geo0: string, needs: NeedsMap, spanish: boolean): string[] {
  const industry = (icp.target_industries[0] ?? "").slice(0, 60);
  const geo = (geo0 || (spanish ? "Colombia" : "United States")).slice(0, 40);
  if (spanish) {
    return [
      `principales empresas de ${industry} en ${geo} ranking`,
      `empresas de ${industry} en ${geo} listado asociación gremio`,
      `mayores operadores de ${industry} ${geo} directorio empresarial`,
      `${industry} ${geo} empresas líderes cámara de comercio`,
      `top empresas ${industry} ${geo} 2026`,
    ];
  }
  return [
    `largest ${industry} companies in ${geo} ranking`,
    `${industry} companies ${geo} association members directory`,
    `top ${industry} operators ${geo} 2026`,
    `leading ${industry} firms ${geo} industry list`,
  ];
}

/** Extract candidate company names from enumeration result pages using the LLM
 *  (bounded), then classify each with entity-resolution-v3. Deterministic
 *  fallback mines capitalized multi-word tokens from titles/snippets. */
async function extractCompanyNames(pages: { title: string | null; snippet: string | null; url: string }[], spanish: boolean): Promise<string[]> {
  const corpus = pages.map((p) => `- ${p.title ?? ""} | ${p.snippet ?? ""}`).join("\n").slice(0, 6000);
  if (process.env.ANTHROPIC_API_KEY && process.env.DEMO_MODE !== "true" && corpus.length > 40) {
    try {
      const { callClaudeJSON } = await import("@/lib/anthropic");
      const SYSTEM = `Extraes NOMBRES DE EMPRESAS REALES de fragmentos de listados/rankings/directorios. Reglas estrictas:
- Solo empresas comerciales reales (con operación), NO medios, NO entidades públicas, NO ciudades/países, NO categorías genéricas.
- Devuelve el nombre corporativo, no el titular de la noticia.
- Si no estás seguro de que sea una empresa real, NO la incluyas.
- Devuelve SOLO JSON: {"companies": ["Nombre 1","Nombre 2", ...]}`;
      const r = await callClaudeJSON<{ companies: string[] }>(SYSTEM, `Fragmentos:\n${corpus}\n\nExtrae hasta 30 nombres de empresas reales ${spanish ? "colombianas" : ""}.`, 1200);
      return (r.companies ?? []).filter(Boolean).slice(0, 40);
    } catch { /* fall through */ }
  }
  // Fallback: capitalized 1-3 word tokens from titles (weak, flagged low).
  const names = new Set<string>();
  for (const p of pages) {
    const m = (p.title ?? "").match(/\b([A-ZÁÉÍÓÚÑ][\wáéíóúñ&.-]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ&.-]+){0,2})\b/g) ?? [];
    for (const n of m) if (n.length >= 4 && n.length <= 40) names.add(n.trim());
  }
  return Array.from(names).slice(0, 40);
}

export async function buildCompanyUniverse(
  icp: ICP, criteria: LeadSearchCriteria, needs: NeedsMap, opts: { maxCompanies?: number } = {},
): Promise<UniverseResult> {
  const { braveProvider, serperProvider } = await import("@/lib/sources/access/providers");
  const spanish = criteria.output_language === "es" || criteria.target_market_region === "latin_america";
  const gl = criteria.target_market_region === "latin_america" ? "co" : "us";
  const queries = enumerationQueries(icp, criteria.target_geography[0] ?? "", needs, spanish);
  const rejected: Record<string, number> = {};
  const bump = (k: string) => (rejected[k] = (rejected[k] ?? 0) + 1);

  // 1. Gather enumeration pages (no freshness limit — directories are evergreen).
  const seen = new Set<string>();
  const pages: { title: string | null; snippet: string | null; url: string }[] = [];
  for (const q of queries) {
    const [brave, serper] = await Promise.all([
      braveProvider.search({ query: q, language: spanish ? "es" : "en", region: gl, max_results: 8, query_type: "industry_discovery" }).catch(() => ({ results: [] })),
      serperProvider.search({ query: q, language: spanish ? "es" : "en", region: gl, max_results: 8, query_type: "industry_discovery" }).catch(() => ({ results: [] })),
    ]);
    for (const r of [...brave.results, ...serper.results]) {
      if (seen.has(r.canonical_url)) continue;
      seen.add(r.canonical_url);
      pages.push({ title: r.title, snippet: r.snippet, url: r.canonical_url });
    }
  }

  // 2. Mine company names from the pages.
  const rawNames = await extractCompanyNames(pages, spanish);

  // 3. Classify + dedupe. Only single_company survives; everything else is a
  //    named rejection reason (no publisher/place/category ever advances).
  const universe = new Map<string, UniverseCompany>();
  for (const name of rawNames) {
    if (MEDIA_OR_DIRECTORY.test(name)) { bump("media_or_directory_name"); continue; }
    // Ambiguous single-token generic names ("Inter", "Mercado") match anything
    // downstream (substrings, homonyms, foreign banks) — never a resolvable
    // account on their own. Distinctive brands (Rappi, Opain) stay valid.
    if (AMBIGUOUS_NAME.test(name.trim())) { bump("entity_ambiguous_generic_name"); continue; }
    const cls = classifyEntity({ name, signalType: null });
    if (cls.entity_class !== "single_company" || !cls.primary_account) { bump(`entity_${cls.entity_class}`); continue; }
    const key = cls.primary_account.toLowerCase();
    if (universe.has(key)) continue;
    universe.set(key, {
      name: cls.primary_account, domain: null,
      country: gl === "co" ? "Colombia" : (criteria.target_geography[0] ?? null),
      region: criteria.target_market_region ?? null,
      sector: icp.target_industries[0] ?? null,
      discovery_source: "sector enumeration (rankings/associations/directories)",
      confidence: "plausible",
      fit_reason: `Aparece en listados del sector ${icp.target_industries[0] ?? ""} en ${criteria.target_geography[0] ?? ""}.`,
    });
  }

  const companies = Array.from(universe.values()).slice(0, opts.maxCompanies ?? 40);
  return {
    companies,
    stats: { enumeration_queries: queries.length, raw_names: rawNames.length, classified_company: companies.length, rejected },
  };
}

export { domainOf, MEDIA_OR_DIRECTORY };
