// §7 regression suite for the bounded MRU closure.
// Proves the Market Research Universe survives the delivery chain (assembler →
// canonical intelligence → tier scoping → presentation model → renderer input),
// that the SELECTED portfolio and the RESEARCHED MARKET UNIVERSE stay DISTINCT
// populations, and that the canonical intelligence layer never emits an "act now"
// basis when no account is prioritized and always uses a tier-local denominator.
//
// Scope note: these assertions target the canonical intelligence block (the surface
// the MRU wiring feeds). They do NOT assert the legacy premium executive-portfolio
// path, which carries separately-tracked pre-existing P0 defects (see closure report).
import assert from "node:assert/strict";
import { buildCanonicalIntelligenceDelivery, scopeCanonicalIntelligence } from "../../lib/intelligence/canonical-intelligence-delivery";
import { assembleInstitutionalReport } from "../../lib/reports/institutional-assembler";
import { summarizeCoverage, type MarketResearchUniverseV1, type MarketSource } from "../../lib/intelligence/market-research-universe";
import { AMOR_DE_GEA_CUSTOMER_DEPENDENCIES, AMOR_DE_GEA_US_ROUTE_ONTOLOGY } from "../../lib/intelligence/route-ontologies/amor-de-gea-us";
import type { InstitutionalOpportunityReportV1, AccountDossier } from "../../lib/reports/institutional-report-types";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`✓ ${name}`); };

// ── A minimal, valid Market Research Universe (distinct from any selected set) ──
const src = (id: string, domain: string, relationship: MarketSource["relationship"] = "PRIMARY_OFFICIAL"): MarketSource => ({ source_id: id, url: `https://${domain}/${id}`, domain, title: id, source_type: relationship === "PRIMARY_OFFICIAL" ? "official" : "independent_media", relationship, published_at: null, retrieved_at: "2026-09-30T00:00:00Z", freshness: "structural", route_ids: ["natural_products_distribution"], account_refs: [] });
const route = { route_id: "natural_products_distribution", lifecycle: "EVIDENCE_SUPPORTED" as const, query_count: 4, source_ids: ["official", "independent"], candidate_account_refs: ["candidate:a"], eligible_account_refs: [], excluded_account_refs: [], exclusion_reasons: [], mechanism_research: "VERIFIED" as const, corroboration_attempted: true, independent_support_count: 1, counterevidence: [], customer_dependency_ids: ["importer_of_record"], observations: ["A formal supplier route exists."], limitations: [], stop_reason: "evidence_obtained" as const };
const mru: MarketResearchUniverseV1 = {
  version: "market-research-universe-v1", universe_id: "closure-fixture", generated_at: "2026-09-30T00:00:00Z", objective: "Map US commercial routes", geography: ["US"],
  population: { population_type: "market_research_universe", population_size: 72, selection_scope: "market sources", coverage_scope: "route sources", limitations: [] },
  account_population: { population_type: "account_research_universe", population_size: 47, selection_scope: "discovered candidates", coverage_scope: "candidates", limitations: [] },
  selected_population: { population_type: "selected_portfolio", population_size: 17, selection_scope: "prior tier output", coverage_scope: "kept separate", limitations: ["Universe not generated from these dossiers."] },
  research_questions: [{ question_id: "q1", question: "Which route is accessible?", decision_supported: "route selection", route_ids: [route.route_id], status: "VERIFIED" }],
  route_definitions: AMOR_DE_GEA_US_ROUTE_ONTOLOGY, route_research: [route],
  buyer_types: [{ buyer_type: "Supplier development", route_ids: [route.route_id], evidence_source_ids: ["official"], coverage_state: "VERIFIED" }],
  commercial_mechanisms: [{ mechanism_id: "m1", mechanism_type: "supplier_intake", lifecycle: "VERIFIED", description: "Official supplier intake", official_url: "https://example.com/suppliers", source_ids: ["official"], verified_at: "2026-09-30T00:00:00Z", relevance: "External brand onboarding", account_ref: null, route_id: route.route_id, limitations: [], required_customer_inputs: ["importer_of_record"], coverage_state: "VERIFIED" }],
  access_paths: [{ access_id: "a1", mechanism_id: "m1", path_type: "official_vendor_page", url: "https://example.com/suppliers", coverage_state: "VERIFIED", source_ids: ["official"], limitations: [] }],
  customer_dependencies: AMOR_DE_GEA_CUSTOMER_DEPENDENCIES, ecosystem_entities: [{ entity_id: "eco:trade", name: "Trade ecosystem", role: "ecosystem", route_ids: [route.route_id], account_eligible: false, source_ids: ["independent"] }],
  market_sources: [src("official", "example.com"), src("independent", "trade.example", "INDEPENDENT_CORROBORATION")],
  claims: [{ claim_id: "c1", claim: "A supplier route is observable.", scope: "multiple_observations", support_type: "fact", support_count: 2, source_ids: ["official", "independent"], route_ids: [route.route_id], account_refs: [], independent_support: true, counterexamples: [], confidence: "medium", limitations: [] }],
  research_passes: [{ pass_id: "p1", purpose: "route evidence", started_at: "2026-09-30T00:00:00Z", completed_at: "2026-09-30T00:01:00Z", queries: 4, new_sources: 2, new_entities: 1, novelty_rate: 0.5, stop_reason: "evidence_obtained" }],
  coverage: {} as never, gaps: [], provenance: { generated_by: "fixture", source_data_refs: ["fixture"], fresh_search_count: 4, fresh_extraction_count: 2, reused_evidence_count: 0 }, limitations: ["Search coverage is bounded."],
};
mru.coverage = summarizeCoverage(mru);

// ── A selected portfolio with NO prioritized account (validate / monitor / hold) ──
const dossier = (company: string, action: AccountDossier["actionability_status"], source: boolean): AccountDossier => ({
  rank: 1, company, industry: "Natural specialty grocery", location: "United States", domain: `${company.toLowerCase().replace(/\s/g, "")}.example`, tier: "WARM", actionability_status: action,
  actionability_reasons: [], actionability_blockers: [], fit_score: 7,
  thesis: { basis: "inference", text: "Premium natural retail relevance" }, why_now: { basis: source ? "fact" : "unknown", text: source ? "A current supplier program is documented." : "Timing unknown." }, why_this_company: { basis: "inference", text: "Operates premium retail." }, why_this_quarter: { basis: "unknown", text: "Quarter urgency unknown." },
  risks: [{ basis: "unknown", text: "Incumbent supplier unknown." }], confidence_drivers: [], evidence_grounded: source,
  evidence_chain: source ? [{ label: "Official supplier page", url: `https://${company}.example/suppliers`, date: "2026-09-01", date_basis: "fact" }] : [],
  hypotheses: [{ basis: "hypothesis", text: "Validate category owner." }], recommended_next_step: { basis: "recommendation", text: "Validate route." }, playbook: null,
  opportunity_case: { fit: { value: "Moderate" }, timing: null, evidence: [], changes: [], validations: [] } as never,
  commercial_intelligence: { route_label: "Natural specialty grocery", buyer_type: "Supplier development", commercial_mechanism: null, access_path: null, access_verified: false, current_actionability: false, corroborated: false, counterevidence_researched: true },
});
const dossiers = [dossier("Natural Grocers", "validate_first", true), dossier("Sprouts", "validate_first", true), dossier("Canyon Ranch", "exclude", false)];
const report = { metadata: { assembled_at: "2026-09-30T00:00:00Z" }, account_dossiers: dossiers } as InstitutionalOpportunityReportV1;

// ── A: a report carrying MRU → intelligence.market_research_universe is set (and only then) ──
const meta = { job_id: "t", plan: null, search_id: null, customer_ref: null, created_at: "2026-10-03T00:00:00Z" };
const assembledWith = assembleInstitutionalReport({ ranked_opportunities: [], processed_leads: [], canonical_cases: [], market_research_universe: mru } as never, meta);
const assembledWithout = assembleInstitutionalReport({ ranked_opportunities: [], processed_leads: [], canonical_cases: [] } as never, meta);
test("A: assembler forwards reportJson.market_research_universe into canonical intelligence", () => {
  assert.ok(assembledWith.intelligence?.market_research_universe != null);
  assert.equal(assembledWith.intelligence!.market_research_universe!.universe_id, "closure-fixture");
});
test("A: forwarding is conditional (no MRU in report → none in intelligence), not hardcoded", () => {
  assert.equal(assembledWithout.intelligence?.market_research_universe ?? null, null);
});

// Canonical intelligence built directly from the selected portfolio + MRU.
const intel = buildCanonicalIntelligenceDelivery(report, 18, mru);

// ── D: selected portfolio and MRU are DISTINCT populations ──
test("D: selected portfolio population is the dossier set, not the MRU population", () => {
  assert.equal(intel.benchmark.accounts.length, 3);                               // selected = 3
  assert.equal(intel.market_research_universe!.population.population_size, 72);    // researched market = 72
  assert.notEqual(intel.benchmark.accounts.length, intel.market_research_universe!.population.population_size);
});
test("D: the MRU's own selected_population metadata is never used as the delivered portfolio", () => {
  // MRU metadata claims 17; the delivered selected population must come from dossiers (3).
  assert.equal(intel.market_research_universe!.selected_population.population_size, 17);
  assert.equal(intel.scope.selected, 3);
});

// ── B: MRU survives tier scoping (Premium) ──
const scoped = scopeCanonicalIntelligence(intel, ["Natural Grocers", "Sprouts"])!;
test("B: MRU survives tier composition / scoping for Premium", () => {
  assert.ok(scoped.market_research_universe != null);
  assert.equal(scoped.market_research_universe!.universe_id, "closure-fixture");
  assert.equal(scoped.market_research_universe!.coverage.mechanisms_verified, 1);
});

// ── G: scoping uses a tier-local denominator (not full set, not capacity) ──
test("G: tier scoping recomputes a tier-local denominator", () => {
  assert.equal(scoped.scope.selected, 2);
  assert.equal(scoped.evidence_coverage.denominator, 2);
  assert.ok(scoped.charts.every((c) => c.denominator === 2));
  assert.ok(scoped.benchmark.accounts.every((row) => row.cells.every((cell) => cell.denominator === 2)));
});

// ── F: zero prioritize → no "act now" / prioritized-basis in the canonical read ──
test("F: zero-Prioritize portfolio yields no act-now basis in the canonical read", () => {
  const dist = intel.charts.find((c) => c.chart_id === "decision-distribution")!.data as Array<{ decision: string; value: number }>;
  assert.equal(dist.find((d) => d.decision === "prioritize")!.value, 0);
  assert.match(intel.portfolio_intelligence.leadlens_read.text, /no account established an evidence-qualified current commercial-access basis/);
  assert.doesNotMatch(intel.portfolio_intelligence.leadlens_read.text.toLowerCase(), /\bact now\b/);
  assert.doesNotMatch(scoped.portfolio_intelligence.leadlens_read.text.toLowerCase(), /\bact now\b/);
});

// ── C + E: advanced intelligence + MRU survive tier composition into the object the
//    presentation model hands the renderer. The presentation model's intelligence step
//    is a pure passthrough of the tier-composed intelligence
//    (presentation-model.ts: `intelligence: channel === "csv" ? null : composed.intelligence ?? null`,
//    where `composed.intelligence === scopeCanonicalIntelligence(doc.intelligence, tierAccounts)`),
//    so asserting the scoped object is exactly asserting the renderer's input. The full
//    end-to-end PDF proof (extracted-text) lives in scripts/pilot2-verify-pdfs.mts (§4).
const composedForTier = scopeCanonicalIntelligence(intel, dossiers.map((d) => d.company))!;
test("C: advanced intelligence survives builder → tier composition → renderer input", () => {
  assert.ok(Array.isArray(composedForTier.market_intelligence.routes));
  assert.ok(composedForTier.benchmark.accounts.length === 3);
  assert.ok(composedForTier.charts.length === 4);
  assert.ok(typeof composedForTier.evidence_coverage.denominator === "number");
  assert.ok(composedForTier.market_map.nodes.length > 0);
});
test("E: the tier-composed intelligence the renderer receives still carries the MRU (Premium)", () => {
  assert.ok(composedForTier.market_research_universe != null);
  assert.equal(composedForTier.market_research_universe!.universe_id, "closure-fixture");
  assert.equal(composedForTier.market_research_universe!.coverage.mechanisms_verified, 1);
  assert.equal(composedForTier.market_research_universe!.coverage.access_verified, 1);
});

console.log(`\n${passed}/9 pilot2 MRU closure checks passed`);
