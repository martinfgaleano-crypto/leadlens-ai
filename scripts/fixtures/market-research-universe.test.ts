import assert from "node:assert/strict";
import { buildMarketResearchCharts, canonicalizeRoute, classifySourceRelationship, summarizeCoverage, validateMarketResearchUniverse, type MarketResearchUniverseV1, type MarketSource } from "../../lib/intelligence/market-research-universe";
import { AMOR_DE_GEA_CUSTOMER_DEPENDENCIES, AMOR_DE_GEA_US_ROUTE_ONTOLOGY } from "../../lib/intelligence/route-ontologies/amor-de-gea-us";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`✓ ${name}`); };
const source = (id: string, domain: string, relationship: MarketSource["relationship"] = "PRIMARY_OFFICIAL"): MarketSource => ({ source_id: id, url: `https://${domain}/${id}`, domain, title: id, source_type: relationship === "PRIMARY_OFFICIAL" ? "official" : "independent_media", relationship, published_at: null, retrieved_at: "2026-09-30T00:00:00Z", freshness: "structural", route_ids: ["natural_products_distribution"], account_refs: [] });
const route = { route_id: "natural_products_distribution", lifecycle: "EVIDENCE_SUPPORTED" as const, query_count: 4, source_ids: ["official", "independent"], candidate_account_refs: ["candidate:a"], eligible_account_refs: [], excluded_account_refs: [], exclusion_reasons: [], mechanism_research: "VERIFIED" as const, corroboration_attempted: true, independent_support_count: 1, counterevidence: [], customer_dependency_ids: ["importer_of_record"], observations: ["A formal supplier route exists."], limitations: [], stop_reason: "evidence_obtained" as const };
const universe: MarketResearchUniverseV1 = {
  version: "market-research-universe-v1", universe_id: "fixture", generated_at: "2026-09-30T00:00:00Z", objective: "Test US routes", geography: ["US"],
  population: { population_type: "market_research_universe", population_size: 2, selection_scope: "market sources and ecosystem entities", coverage_scope: "two route sources", limitations: [] },
  account_population: { population_type: "account_research_universe", population_size: 1, selection_scope: "discovered candidates", coverage_scope: "one candidate", limitations: [] },
  selected_population: { population_type: "selected_portfolio", population_size: 0, selection_scope: "tier output", coverage_scope: "none selected", limitations: [] },
  research_questions: [{ question_id: "q1", question: "Which route is accessible?", decision_supported: "route selection", route_ids: [route.route_id], status: "VERIFIED" }],
  route_definitions: AMOR_DE_GEA_US_ROUTE_ONTOLOGY, route_research: [route],
  buyer_types: [{ buyer_type: "Supplier development", route_ids: [route.route_id], evidence_source_ids: ["official"], coverage_state: "VERIFIED" }],
  commercial_mechanisms: [{ mechanism_id: "m1", mechanism_type: "supplier_intake", lifecycle: "VERIFIED", description: "Official supplier intake", official_url: "https://example.com/suppliers", source_ids: ["official"], verified_at: "2026-09-30T00:00:00Z", relevance: "External brand onboarding", account_ref: null, route_id: route.route_id, limitations: [], required_customer_inputs: ["importer_of_record"], coverage_state: "VERIFIED" }],
  access_paths: [{ access_id: "a1", mechanism_id: "m1", path_type: "official_vendor_page", url: "https://example.com/suppliers", coverage_state: "VERIFIED", source_ids: ["official"], limitations: [] }],
  customer_dependencies: AMOR_DE_GEA_CUSTOMER_DEPENDENCIES, ecosystem_entities: [{ entity_id: "eco:trade", name: "Trade ecosystem", role: "ecosystem", route_ids: [route.route_id], account_eligible: false, source_ids: ["independent"] }],
  market_sources: [source("official", "example.com"), source("independent", "trade.example", "INDEPENDENT_CORROBORATION")],
  claims: [{ claim_id: "c1", claim: "A supplier route is observable.", scope: "multiple_observations", support_type: "fact", support_count: 2, source_ids: ["official", "independent"], route_ids: [route.route_id], account_refs: [], independent_support: true, counterexamples: [], confidence: "medium", limitations: [] }],
  research_passes: [{ pass_id: "p1", purpose: "route evidence", started_at: "2026-09-30T00:00:00Z", completed_at: "2026-09-30T00:01:00Z", queries: 4, new_sources: 2, new_entities: 1, novelty_rate: 0.5, stop_reason: "evidence_obtained" }],
  coverage: {} as never, gaps: [], provenance: { generated_by: "fixture", source_data_refs: ["fixture"], fresh_search_count: 4, fresh_extraction_count: 2, reused_evidence_count: 0 }, limitations: [],
};
universe.coverage = summarizeCoverage(universe);

test("aliases canonicalize deterministically", () => assert.equal(canonicalizeRoute("Regional premium grocery chain", AMOR_DE_GEA_US_ROUTE_ONTOLOGY)?.canonical_route_id, "natural_specialty_grocery"));
test("distinct routes stay distinct", () => assert.notEqual(canonicalizeRoute("Corporate gifting", AMOR_DE_GEA_US_ROUTE_ONTOLOGY)?.canonical_route_id, canonicalizeRoute("Natural product distributor", AMOR_DE_GEA_US_ROUTE_ONTOLOGY)?.canonical_route_id));
test("same-domain support is not independent", () => assert.equal(classifySourceRelationship(source("a", "example.com"), source("b", "example.com")), "SAME_DOMAIN_SUPPORT"));
test("different non-derivative source is independent", () => assert.equal(classifySourceRelationship(source("a", "example.com"), source("b", "news.example")), "INDEPENDENT_CORROBORATION"));
test("mechanism and access remain separate records", () => assert.notEqual(universe.commercial_mechanisms[0].mechanism_id, universe.access_paths[0].access_id));
test("market, account and selected populations are distinct", () => assert.deepEqual([universe.population.population_size, universe.account_population.population_size, universe.selected_population.population_size], [2, 1, 0]));
test("market route may exist with zero selected accounts", () => assert.equal(universe.route_research[0].eligible_account_refs.length, 0));
test("coverage distinguishes researched from found", () => assert.deepEqual({ researched: universe.coverage.mechanisms_researched, found: universe.coverage.mechanisms_found }, { researched: 1, found: 1 }));
test("customer dependency propagates across routes", () => assert.ok(universe.customer_dependencies.find((d) => d.dependency_id === "landed_economics")!.route_ids.length > 5));
test("valid universe passes readiness contract", () => assert.deepEqual(validateMarketResearchUniverse(universe), []));
test("one canonical chart authority preserves population and unknown semantics", () => { const charts = buildMarketResearchCharts(universe); assert.ok(charts.length === 4 && charts.every((c) => c.population.population_type === "market_research_universe") && charts.find((c) => c.chart_id === "commercial_access_depth")!.denominator === 1); });
const weak = structuredClone(universe); weak.claims[0].support_count = 1;
test("unsupported market pattern fails closed", () => assert.ok(validateMarketResearchUniverse(weak).includes("CLAIM_SUPPORT_COUNT_MISMATCH") && validateMarketResearchUniverse(weak).includes("MARKET_PATTERN_UNDERSUPPORTED")));

console.log(`\n${passed}/12 market research universe checks passed`);
