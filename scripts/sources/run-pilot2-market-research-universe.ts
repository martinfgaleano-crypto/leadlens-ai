#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv } from "../lib/load-env.mjs";
import { braveProvider } from "../../lib/sources/access/providers";
import { AMOR_DE_GEA_CUSTOMER_DEPENDENCIES, AMOR_DE_GEA_US_ROUTE_ONTOLOGY } from "../../lib/intelligence/route-ontologies/amor-de-gea-us";
import { buildMarketResearchCharts, summarizeCoverage, validateMarketResearchUniverse, type MarketResearchUniverseV1, type MarketSource, type RouteResearchRecord } from "../../lib/intelligence/market-research-universe";
for (const [key, value] of Object.entries(loadEnv())) if (typeof value === "string") process.env[key] = value;

async function main() {
const OUT = process.env.PILOT2_MARKET_OUT ?? "output/pilot2/2026-09-30-market-universe-v2";
const MAX_QUERIES = Math.max(1, Math.min(Number(process.env.PILOT2_MARKET_MAX_QUERIES ?? "18"), 24));
const RESULTS_PER_QUERY = Math.max(2, Math.min(Number(process.env.PILOT2_MARKET_RESULTS_PER_QUERY ?? "5"), 8));
const startedAt = new Date().toISOString();
mkdirSync(OUT, { recursive: true });

const queryFamilies: Record<string, string[]> = {
  natural_specialty_grocery: ["US natural specialty grocery supplier new item submission", "US regional premium grocery become a vendor"],
  online_natural_retail: ["US online natural products retailer brand submission supplier"],
  specialty_beverage_retail: ["US specialty beverage retailer new brand submission"],
  wellness_hospitality: ["US wellness resort spa supplier procurement vendor", "US hotel wellness beverage supplier program"],
  fitness_wellness_clubs: ["US fitness wellness club retail vendor supplier"],
  natural_products_distribution: ["US natural products distributor new supplier brand submission", "US natural beverage distributor vendor onboarding"],
  specialty_food_beverage_import: ["US specialty food beverage importer external brands supplier", "US Latin American specialty food importer brand portfolio"],
  foodservice_procurement: ["US foodservice distributor supplier registration specialty beverage"],
  corporate_gifting: ["US corporate gifting company supplier application wellness products"],
};

const urls = new Set<string>();
const sources: MarketSource[] = [];
const routeResearch: RouteResearchRecord[] = [];
const ecosystem = new Map<string, { entity_id: string; name: string; role: string; route_ids: string[]; account_eligible: boolean; source_ids: string[] }>();
const passes: MarketResearchUniverseV1["research_passes"] = [];
let queryCount = 0;

function domainOf(url: string): string { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; } }
function sourceType(url: string): MarketSource["source_type"] {
  const d = domainOf(url);
  if (/\.gov$|\.edu$/.test(d)) return "institutional";
  if (/directory|association|trade|expo|faire|range\.me/i.test(url)) return "directory";
  if (/news|journal|magazine|businesswire|prnewswire/i.test(url)) return "independent_media";
  return "official";
}
function entityName(title: string | null, domain: string): string { return (title?.split(/[|–—-]/)[0]?.trim() || domain).slice(0, 120); }

for (const definition of AMOR_DE_GEA_US_ROUTE_ONTOLOGY) {
  const routeQueries = (queryFamilies[definition.canonical_route_id] ?? []).slice(0, Math.max(0, MAX_QUERIES - queryCount));
  const sourceIds: string[] = [];
  const candidateRefs = new Set<string>();
  const passStart = new Date().toISOString();
  let raw = 0;
  for (const query of routeQueries) {
    queryCount++;
    const response = await braveProvider.search({ query, max_results: RESULTS_PER_QUERY, language: "en", region: "us", query_type: "generic" });
    if (!response.ok) console.error(`query_failed route=${definition.canonical_route_id} error=${response.error}`);
    for (const result of response.results) {
      if (urls.has(result.canonical_url)) continue;
      urls.add(result.canonical_url); raw++;
      const domain = domainOf(result.canonical_url);
      const id = `src:${sources.length + 1}`;
      const type = sourceType(result.canonical_url);
      sources.push({ source_id: id, url: result.canonical_url, domain, title: result.title ?? domain, source_type: type, relationship: type === "official" ? "PRIMARY_OFFICIAL" : "INDEPENDENT_CORROBORATION", published_at: result.published_date, retrieved_at: result.retrieved_at, freshness: result.published_date ? "current" : "structural", route_ids: [definition.canonical_route_id], account_refs: [] });
      sourceIds.push(id);
      const ref = `entity:${domain}`; candidateRefs.add(ref);
      const current = ecosystem.get(ref) ?? { entity_id: ref, name: entityName(result.title, domain), role: type === "directory" || type === "institutional" ? "ecosystem" : definition.commercial_role, route_ids: [], account_eligible: type === "official", source_ids: [] };
      if (!current.route_ids.includes(definition.canonical_route_id)) current.route_ids.push(definition.canonical_route_id);
      current.source_ids.push(id); ecosystem.set(ref, current);
    }
  }
  const official = sourceIds.filter((id) => sources.find((s) => s.source_id === id)?.source_type === "official").length;
  const independent = sourceIds.filter((id) => sources.find((s) => s.source_id === id)?.relationship === "INDEPENDENT_CORROBORATION").length;
  const lifecycle: RouteResearchRecord["lifecycle"] = sourceIds.length >= 2 && official > 0 ? "EVIDENCE_SUPPORTED" : sourceIds.length ? "DISCOVERED" : routeQueries.length ? "INSUFFICIENT_DATA" : "HYPOTHESIS";
  routeResearch.push({ route_id: definition.canonical_route_id, lifecycle, query_count: routeQueries.length, source_ids: sourceIds, candidate_account_refs: Array.from(candidateRefs), eligible_account_refs: [], excluded_account_refs: [], exclusion_reasons: [], mechanism_research: routeQueries.length ? (official ? "FOUND_UNVERIFIED" : "RESEARCHED_NOT_FOUND") : "NOT_RESEARCHED", corroboration_attempted: routeQueries.length > 0, independent_support_count: independent, counterevidence: [], customer_dependency_ids: AMOR_DE_GEA_CUSTOMER_DEPENDENCIES.filter((d) => d.route_ids.includes(definition.canonical_route_id)).map((d) => d.dependency_id), observations: sourceIds.length ? [`${sourceIds.length} unique public sources were recovered for this route; account eligibility and commercial mechanisms require deep verification.`] : [], limitations: ["Search-result discovery is not claim verification; official pages require extraction before a mechanism can be VERIFIED."], stop_reason: routeQueries.length === 0 ? "budget_exhausted" : sourceIds.length ? "evidence_obtained" : "route_exhausted" });
  passes.push({ pass_id: `route:${definition.canonical_route_id}`, purpose: `Discover route structure, ecosystem entities and supplier-access evidence for ${definition.display_label}`, started_at: passStart, completed_at: new Date().toISOString(), queries: routeQueries.length, new_sources: raw, new_entities: candidateRefs.size, novelty_rate: raw ? candidateRefs.size / raw : 0, stop_reason: routeResearch.at(-1)!.stop_reason });
}

const supported = routeResearch.filter((r) => r.lifecycle === "EVIDENCE_SUPPORTED");
const universe: MarketResearchUniverseV1 = {
  version: "market-research-universe-v1", universe_id: `amor-de-gea-us-${startedAt.slice(0, 10)}`, generated_at: new Date().toISOString(), objective: "Map evidence-supported US commercial routes, buyer functions and observable access mechanisms for Amor de Gea's premium botanical wellness beverages.", geography: ["United States — national"],
  population: { population_type: "market_research_universe", population_size: sources.length, selection_scope: "Unique public route, ecosystem and commercial-access sources returned by bounded Brave research", coverage_scope: `${queryCount} queries across ${routeResearch.length} route hypotheses`, limitations: ["Search coverage is bounded, not exhaustive market coverage.", "Search results remain discovery evidence until extracted and claim-validated."] },
  account_population: { population_type: "account_research_universe", population_size: ecosystem.size, selection_scope: "Unique domains observed during market-route research", coverage_scope: "Includes ecosystem entities and potential accounts; eligibility is not implied", limitations: ["Domain observation is not account qualification."] },
  selected_population: { population_type: "selected_portfolio", population_size: 17, selection_scope: "Existing canonical Pilot 2 selected portfolio", coverage_scope: "Kept separate from this market-research run", limitations: ["The market universe was not generated from these 17 dossiers."] },
  research_questions: [
    { question_id: "routes", question: "Which US commercial route families are observable for this offering?", decision_supported: "route prioritization", route_ids: AMOR_DE_GEA_US_ROUTE_ONTOLOGY.map((r) => r.canonical_route_id), status: sources.length ? "FOUND_UNVERIFIED" : "RESEARCHED_NOT_FOUND" },
    { question_id: "access", question: "Which routes expose formal supplier, vendor, product-submission or partner access?", decision_supported: "commercial-access research", route_ids: AMOR_DE_GEA_US_ROUTE_ONTOLOGY.map((r) => r.canonical_route_id), status: supported.length ? "FOUND_UNVERIFIED" : "RESEARCHED_NOT_FOUND" },
    { question_id: "dependencies", question: "Which customer-side facts block route or account decisions?", decision_supported: "customer validation", route_ids: AMOR_DE_GEA_US_ROUTE_ONTOLOGY.map((r) => r.canonical_route_id), status: "VERIFIED" },
  ],
  route_definitions: AMOR_DE_GEA_US_ROUTE_ONTOLOGY, route_research: routeResearch,
  buyer_types: AMOR_DE_GEA_US_ROUTE_ONTOLOGY.flatMap((r) => r.buyer_types.map((buyer) => ({ buyer_type: buyer, route_ids: [r.canonical_route_id], evidence_source_ids: routeResearch.find((rr) => rr.route_id === r.canonical_route_id)?.source_ids.slice(0, 1) ?? [], coverage_state: "FOUND_UNVERIFIED" as const }))),
  commercial_mechanisms: [], access_paths: [], customer_dependencies: AMOR_DE_GEA_CUSTOMER_DEPENDENCIES,
  ecosystem_entities: Array.from(ecosystem.values()), market_sources: sources,
  claims: supported.map((route) => ({ claim_id: `route-supported:${route.route_id}`, claim: `${AMOR_DE_GEA_US_ROUTE_ONTOLOGY.find((r) => r.canonical_route_id === route.route_id)!.display_label} has multiple observable public sources, including at least one likely first-party source.`, scope: route.independent_support_count ? "multiple_observations" as const : "single_observation" as const, support_type: "inference" as const, support_count: route.source_ids.length, source_ids: route.source_ids, route_ids: [route.route_id], account_refs: route.candidate_account_refs, independent_support: route.independent_support_count > 0, counterexamples: [], confidence: route.independent_support_count > 0 ? "medium" as const : "low" as const, limitations: ["Route support does not establish product acceptance, open commercial scope or buyer intent."] })),
  research_passes: passes, coverage: {} as never,
  gaps: ["Commercial mechanisms remain unverified until official pages are extracted.", "Customer product classification, landed economics, MOQ and importer-of-record model remain unresolved."],
  provenance: { generated_by: "run-pilot2-market-research-universe-v1", source_data_refs: sources.map((s) => s.url), fresh_search_count: queryCount, fresh_extraction_count: 0, reused_evidence_count: 0 },
  limitations: ["This is bounded route research, not TAM, market share or complete US coverage.", "No search result is promoted to verified account evidence by this run.", "The selected portfolio remains a separate population."],
};
universe.coverage = summarizeCoverage(universe);
universe.charts = buildMarketResearchCharts(universe);
const validationErrors = validateMarketResearchUniverse(universe);
writeFileSync(`${OUT}/market-research-universe.json`, JSON.stringify(universe, null, 2));
writeFileSync(`${OUT}/research-summary.json`, JSON.stringify({ generated_at: universe.generated_at, provider: "brave", queries: queryCount, sources: sources.length, ecosystem_entities: ecosystem.size, routes: routeResearch.map((r) => ({ route_id: r.route_id, lifecycle: r.lifecycle, sources: r.source_ids.length, independent_support: r.independent_support_count, stop_reason: r.stop_reason })), validation_errors: validationErrors }, null, 2));
console.log(JSON.stringify({ out: OUT, queries: queryCount, sources: sources.length, entities: ecosystem.size, supported_routes: supported.length, validation_errors: validationErrors }, null, 2));
if (validationErrors.length) process.exitCode = 2;
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
