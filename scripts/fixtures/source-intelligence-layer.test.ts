// Country × Industry Source Intelligence Layer V1 — focused tests.
// Deterministic; no provider calls, no search. Verifies the success criteria
// (§47): a context yields an explained, tiered source plan, and a different
// context yields a materially different plan.
import assert from "node:assert/strict";
import {
  INDUSTRY_LABELS, relatedLabels, areIncompatible, BUSINESS_MODELS, COMMERCIAL_ROUTES, OPPORTUNITY_MECHANISMS,
  type DiscoveryContext,
} from "../../lib/discovery/source-intelligence/taxonomy";
import {
  COLOMBIA, COUNTRY_REGISTRY, COLOMBIA_SOURCES, SOURCE_MAPPINGS, SOURCE_ROLES, SOURCE_PRIORITY_TIERS, SOURCE_CONFIDENCE_STATES,
} from "../../lib/discovery/source-intelligence/registry";
import {
  buildSourcePlan, yieldMetrics, FUNNEL_STAGES, detectCoverageGaps, seedResearchQueue, emptySourceMemory,
  appendSnapshot, proposeReprioritization, historicalPortfolioYield, type SourcePerformanceSnapshot, type KnownAccount,
} from "../../lib/discovery/source-intelligence/router";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

// 1–8. Multi-label industry graph.
t("1 industry labels multi-label set", INDUSTRY_LABELS.length >= 20);
t("2 spa overlaps wellness (no single parent)", relatedLabels("spa", "overlaps_with").includes("wellness"));
t("3 spa co-occurs with boutique_hospitality", relatedLabels("spa", "commonly_cooccurs_with").includes("boutique_hospitality"));
t("4 boutique_hospitality narrower_than hospitality", relatedLabels("boutique_hospitality", "narrower_than").includes("hospitality"));
t("5 incompatible relation works", areIncompatible("manufacturing", "boutique_hospitality"));
t("6 a label can have many relations", relatedLabels("spa").length >= 2);
t("7 business models multi-label", BUSINESS_MODELS.length >= 18);
t("8 routes + mechanisms present", COMMERCIAL_ROUTES.length >= 12 && OPPORTUNITY_MECHANISMS.length >= 12);

// 9–15. Country + source registry.
t("9 Colombia profile exists", COUNTRY_REGISTRY.CO?.code === "CO" && COLOMBIA.sector_associations.length > 3);
t("10 sources carry roles", COLOMBIA_SOURCES.every((s) => s.roles.length >= 1 && s.roles.every((r) => (SOURCE_ROLES as readonly string[]).includes(r))));
t("11 a source supports multiple roles", COLOMBIA_SOURCES.some((s) => s.roles.length >= 2));
t("12 a source supports multiple industries", COLOMBIA_SOURCES.some((s) => s.industry_labels.length >= 3));
t("13 source confidence states valid + start hypothesized", COLOMBIA_SOURCES.some((s) => s.confidence === "hypothesized") && COLOMBIA_SOURCES.every((s) => (SOURCE_CONFIDENCE_STATES as readonly string[]).includes(s.confidence)));
t("14 Colombia mappings are multi-label", (SOURCE_MAPPINGS.CO ?? []).some((m) => m.industry_labels.length >= 2));
t("15 priority tiers defined", SOURCE_PRIORITY_TIERS.includes("tier_1_primary") && SOURCE_PRIORITY_TIERS.includes("tier_3_gap_filler"));

// 16–20. Success criteria (§47): two contexts → materially different plans.
const hospitality: DiscoveryContext = { country: "CO", industry_labels: ["hospitality", "spa", "premium_consumer"], business_models: ["hotel_operator"], routes: ["hospitality_guest_experience"], mechanisms: ["guest_amenity"] };
const manufacturing: DiscoveryContext = { country: "CO", industry_labels: ["manufacturing"], business_models: ["manufacturer"], routes: ["procurement"], mechanisms: ["procurement_replacement"] };
const planH = buildSourcePlan(hospitality);
const planM = buildSourcePlan(manufacturing);
t("16 router returns a plan with steps", planH.steps.length > 0 && planH.matched_mapping_id === "co_hosp_spa_guest");
t("17 plan explains itself", planH.explanation.length > 40 && planH.steps[0].why_higher_than_alternatives.length > 10);
t("18 different context ⇒ materially different plan", planM.matched_mapping_id === "co_manufacturing_procurement" &&
  JSON.stringify(planH.steps.map((s) => s.source_id)) !== JSON.stringify(planM.steps.map((s) => s.source_id)));
t("19 structured sources before generic search", (() => { const idx = planH.steps.findIndex((s) => s.source_id === "search_engine"); const t1 = planH.steps.findIndex((s) => s.priority === "tier_1_primary"); return t1 >= 0 && (idx === -1 || idx > t1); })());
t("20 hospitality tier-1 = tourism/hotel structured sources", planH.steps.filter((s) => s.priority === "tier_1_primary").map((s) => s.source_id).sort().join(",") === "co_cotelco,co_rnt");

// 21. Router respects country / labels / route / mechanism in step attribution.
t("21 steps attribute matched country + route + mechanism", planH.steps.every((s) => s.matched_country === "CO" && s.matched_route === "hospitality_guest_experience" && s.matched_mechanism === "guest_amenity"));

// 22–24. Account Memory integration — suppress known/duplicate accounts.
const known: KnownAccount[] = [{ canonical_id: "amor:eteka", suppressed: true, novelty: "previously_delivered" }, { canonical_id: "x:new", suppressed: false, novelty: "genuinely_new" }];
const planWithMem = buildSourcePlan(hospitality, { knownAccounts: known });
t("22 router consumes account memory", planWithMem.account_memory_consulted);
t("23 suppressed accounts avoided", planWithMem.suppressed_accounts.includes("amor:eteka") && !planWithMem.suppressed_accounts.includes("x:new"));
t("24 fallback + stop conditions present", planH.fallback_source_ids.length > 0 && planH.stop_conditions.length >= 5);

// 25–28. Funnel + yield metrics.
t("25 funnel has canonical stages", FUNNEL_STAGES[0] === "source_results" && FUNNEL_STAGES.at(-1) === "portfolio_selected");
const ym = yieldMetrics({ source_results: 100, raw_candidates: 60, entity_resolved: 55, real_business: 50, business_model_compatible: 40, context_compatible: 30, evidence_sufficient: 20, opportunity_plausible: 12, portfolio_candidate: 8, portfolio_selected: 5, duplicates: 6, genuinely_new: 4, official_domains: 35, qualified: 12, cost: 24 });
t("26 raw + valid entity yield computed", ym.raw_entity_yield === 0.6 && ym.valid_entity_yield !== null);
t("27 duplicate + false-positive rate computed", ym.duplicate_rate === 0.1 && ym.false_positive_rate !== null);
t("28 cost per qualified account computed", ym.cost_per_qualified_account === 2);

// 29–31. Source Memory (history-preserving) + awaiting_real_outcomes.
let mem = emptySourceMemory("co_cotelco");
const snap = (cycle: string): SourcePerformanceSnapshot => ({ source_id: "co_cotelco", cycle_id: cycle, captured_at: "2026-08-04", country: "CO", candidates_discovered: 100, valid_entities: 70, correct_business_models: 50, context_compatible: 30, evidence_sufficient: 20, opportunity_plausible: 10, portfolio_accounts: 4, novelty_yield: 0.5, false_positives: 30, duplicates: 5, extraction_failures: 1, access_failures: 0, avg_cost: 0.5, avg_latency_ms: 800, client_selected_rate: null, contact_rate: null, order_rate: null, outcome_state: "awaiting_real_outcomes" });
mem = appendSnapshot(mem, snap("c1"));
t("29 snapshots append-only (history preserved)", mem.snapshots.length === 1 && mem.total_runs === 1);
t("30 commercial-outcome fields awaiting real outcomes", mem.snapshots[0].outcome_state === "awaiting_real_outcomes" && mem.snapshots[0].order_rate === null);
t("31 historical portfolio yield derived", historicalPortfolioYield(mem) === 0.04);

// 32–34. Learning requires approval + evidence threshold; no auto reprioritization.
t("32 no reprioritization below evidence threshold", proposeReprioritization("co_cotelco", "CO", mem, "tier_2_secondary", "tier_1_primary") === null);
mem = appendSnapshot(appendSnapshot(mem, snap("c2")), snap("c3"));
const rec = proposeReprioritization("co_cotelco", "CO", mem, "tier_2_secondary", "tier_1_primary");
t("33 reprioritization recommended after ≥3 cycles", rec !== null && rec.human_approval_required === true && rec.auto_applied === false);
t("34 recommendation cites supporting cycles", (rec?.supporting_cycles.length ?? 0) === 3);

// 35–37. Coverage gaps + research queue.
const gaps = detectCoverageGaps("CO");
t("35 coverage gaps detected with severity + action", gaps.length > 0 && gaps.every((g) => g.severity && g.recommended_action));
t("36 unknown country ⇒ high coverage gap", detectCoverageGaps("ZZ").some((g) => g.dimension === "country_has_low_source_coverage" && g.severity === "high"));
t("37 research queue seeded from gaps", seedResearchQueue("CO").every((q) => q.status === "open" && q.owner === "founder"));

// 38. Source vs Provider separation — sources carry ecosystem/roles, provider hint is separate.
t("38 source ≠ provider (provider_hint separate from source)", planH.steps.every((s) => typeof s.provider_hint === "string" && s.source_id !== s.provider_hint));

console.log(`\n${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
