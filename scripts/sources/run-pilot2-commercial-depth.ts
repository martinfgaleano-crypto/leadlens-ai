#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "../lib/load-env.mjs";
import { braveProvider } from "../../lib/sources/access/providers";
import { extractWithFallback } from "../../lib/sources/access/extractors";
import { assessCommercialDepth, isSameOrganizationDomain, type CommercialResearchEvidence } from "../../lib/intelligence/commercial-depth-research";
import { AMOR_DE_GEA_CUSTOMER_DEPENDENCIES } from "../../lib/intelligence/route-ontologies/amor-de-gea-us";
import { buildMarketResearchCharts, summarizeCoverage, validateMarketResearchUniverse, type MarketResearchUniverseV1, type MarketSource } from "../../lib/intelligence/market-research-universe";
for (const [key, value] of Object.entries(loadEnv())) if (typeof value === "string") process.env[key] = value;

const path = process.env.PILOT2_MARKET_UNIVERSE ?? "output/pilot2/2026-09-30-market-universe-v2/market-research-universe.json";
const universe = JSON.parse(readFileSync(path, "utf8")) as MarketResearchUniverseV1;
const targets = [
  { name: "Natural Grocers", domain: "naturalgrocers.com", route: "natural_specialty_grocery", decision: "prioritize", query: "site:naturalgrocers.com vendor supplier new item product submission" },
  { name: "Sprouts Farmers Market", domain: "sprouts.com", route: "natural_specialty_grocery", decision: "validate", query: "site:sprouts.com supplier vendor submit product category" },
  { name: "Earth Fare", domain: "earthfare.com", route: "natural_specialty_grocery", decision: "validate", query: "site:earthfare.com supplier vendor product submission" },
  { name: "Dorothy Lane Market", domain: "dorothylane.com", route: "natural_specialty_grocery", decision: "validate", query: "site:dorothylane.com supplier vendor product submission" },
  { name: "Whole Foods Market", domain: "wholefoodsmarket.com", route: "natural_specialty_grocery", decision: "monitor", query: "site:wholefoodsmarket.com supplier local producer vendor submit product" },
  { name: "Life Time", domain: "lifetime.life", route: "fitness_wellness_clubs", decision: "monitor", query: "site:lifetime.life supplier vendor procurement beverage" },
  { name: "KeHE Distributors", domain: "kehe.com", route: "natural_products_distribution", decision: "not_selected", query: "site:kehe.com suppliers submit products brand onboarding" },
  { name: "Gourmet International", domain: "gourmetint.com", route: "specialty_food_beverage_import", decision: "not_selected", query: "site:gourmetint.com supplier brand wholesale contact" },
  { name: "Savor Imports", domain: "savorimports.com", route: "specialty_food_beverage_import", decision: "not_selected", query: "site:savorimports.com supplier brand wholesale contact" },
] as const;

const domainOf = (raw: string) => { try { return new URL(raw).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
const belongsToDomain = isSameOrganizationDomain;
const canonical = (raw: string) => { const u = new URL(raw); u.hash = ""; return u.toString(); };
const sourceByUrl = new Map(universe.market_sources.map((source) => [canonical(source.url), source]));
const telemetry: Array<Record<string, unknown>> = [];

function addSource(target: typeof targets[number], item: { url: string; title: string | null; published_date: string | null; retrieved_at: string; source_type: string }, relationship: MarketSource["relationship"]): MarketSource {
  const url = canonical(item.url); const existing = sourceByUrl.get(url); if (existing) { if (!existing.route_ids.includes(target.route)) existing.route_ids.push(target.route); return existing; }
  const source: MarketSource = { source_id: `src:${universe.market_sources.length + 1}`, url, domain: domainOf(url), title: item.title ?? domainOf(url), source_type: relationship === "PRIMARY_OFFICIAL" ? "official" : "independent_media", relationship, published_at: item.published_date, retrieved_at: item.retrieved_at, freshness: item.published_date ? "current" : "structural", route_ids: [target.route], account_refs: [`entity:${target.domain}`] };
  universe.market_sources.push(source); sourceByUrl.set(url, source); return source;
}

async function main() {
  const researched = [];
  for (const target of targets) {
    const search = await braveProvider.search({ query: target.query, max_results: 6, language: "en", region: "us", query_type: "generic" });
    const officialResults = search.results.filter((item) => belongsToDomain(item.url, target.domain)).slice(0, 2);
    const independentResults = search.results.filter((item) => !belongsToDomain(item.url, target.domain) && !/facebook|linkedin|instagram|youtube/.test(domainOf(item.url))).slice(0, 1);
    const candidates = [...officialResults.map((item) => ({ item, official: true })), ...independentResults.map((item) => ({ item, official: false }))];
    // Reuse already-discovered official pages when Brave returns no official result.
    if (!officialResults.length) {
      const existing = universe.market_sources.find((source) => source.domain.replace(/^www\./, "") === target.domain);
      if (existing) candidates.unshift({ item: { url: existing.url, canonical_url: existing.url, title: existing.title, snippet: null, published_date: existing.published_at, retrieved_at: new Date().toISOString(), source_type: "company" as const, provider: "memory", rank: 0, locale: "en" }, official: true });
    }
    const evidence: CommercialResearchEvidence[] = [];
    for (const candidate of candidates) {
      const source = addSource(target, candidate.item, candidate.official ? "PRIMARY_OFFICIAL" : "INDEPENDENT_CORROBORATION");
      const extraction = await extractWithFallback(candidate.item.url);
      evidence.push({ source_id: source.source_id, url: candidate.item.url, domain: source.domain, official: candidate.official, independent: !candidate.official, content: extraction.content, extraction_ok: extraction.ok, failure: extraction.failure ?? extraction.error });
      telemetry.push({ account: target.name, query: target.query, search_ok: search.ok, search_error: search.error, source_id: source.source_id, url: candidate.item.url, official: candidate.official, extraction_ok: extraction.ok, extractor: extraction.extractor, failure: extraction.failure, attempts: extraction.attempts, provenance: extraction.provenance });
    }
    const dependencyIds = AMOR_DE_GEA_CUSTOMER_DEPENDENCIES.filter((dependency) => dependency.route_ids.includes(target.route)).map((dependency) => dependency.dependency_id);
    const result = assessCommercialDepth({ account_ref: `entity:${target.domain}`, account_name: target.name, domain: target.domain, route_id: target.route, decision: target.decision, evidence, customer_dependency_ids: dependencyIds, researched_at: new Date().toISOString() });
    researched.push(result);
    const route = universe.route_research.find((record) => record.route_id === target.route);
    if (route) { route.corroboration_attempted = route.corroboration_attempted || independentResults.length > 0; route.independent_support_count += result.corroboration_status === "ACHIEVED" ? 1 : 0; route.mechanism_research = result.mechanism_status === "VERIFIED" ? "VERIFIED" : route.mechanism_research; for (const source of evidence) if (!route.source_ids.includes(source.source_id)) route.source_ids.push(source.source_id); }
    if (result.mechanism_status === "VERIFIED" && result.access_path) {
      const existing = universe.commercial_mechanisms.find((m) => m.route_id === target.route && (m.account_ref === result.account_ref || (m.official_url && domainOf(m.official_url) === target.domain)));
      const id = existing?.mechanism_id ?? `mechanism:${target.route}:${target.domain}`;
      if (!existing) universe.commercial_mechanisms.push({ mechanism_id: id, mechanism_type: result.mechanism_type!, lifecycle: "VERIFIED", description: `Official ${target.name} evidence exposes a supplier/product commercial mechanism.`, official_url: result.access_path, source_ids: result.mechanism_source_ids, verified_at: result.researched_at, relevance: "Observable route for external supplier/product evaluation; not evidence of acceptance, open capacity or buying intent.", account_ref: result.account_ref, route_id: target.route, limitations: result.limitations, required_customer_inputs: dependencyIds, coverage_state: "VERIFIED" });
      if (!universe.access_paths.some((path) => path.mechanism_id === id)) universe.access_paths.push({ access_id: `access:${id}`, mechanism_id: id, path_type: "official_supplier_or_product_route", url: result.access_path, coverage_state: "VERIFIED", source_ids: result.mechanism_source_ids, limitations: result.limitations });
    }
  }
  universe.commercial_account_research = researched;
  universe.population.population_size = universe.market_sources.length;
  universe.provenance.fresh_search_count += targets.length;
  universe.provenance.fresh_extraction_count += telemetry.filter((row) => row.extraction_ok).length;
  universe.coverage = summarizeCoverage(universe); universe.charts = buildMarketResearchCharts(universe);
  const validationErrors = validateMarketResearchUniverse(universe);
  writeFileSync(path, JSON.stringify(universe, null, 2));
  writeFileSync(path.replace("market-research-universe.json", "commercial-depth-research.json"), JSON.stringify({ generated_at: new Date().toISOString(), targets: researched, telemetry, validation_errors: validationErrors }, null, 2));
  console.log(JSON.stringify({ targets: researched.length, deeply_researched: researched.filter((r) => r.research_status === "VERIFIED").length, mechanisms_verified: researched.filter((r) => r.mechanism_status === "VERIFIED").length, access_verified: researched.filter((r) => r.access_status === "VERIFIED").length, buyer_functions: researched.filter((r) => r.buyer_functions.length).length, corroborated: researched.filter((r) => r.corroboration_status === "ACHIEVED").length, validation_errors: validationErrors }, null, 2));
  if (validationErrors.length) process.exitCode = 2;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
