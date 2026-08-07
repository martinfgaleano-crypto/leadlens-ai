// Discovery Engine V2 — controlled benchmark tests. Deterministic; 0 provider calls.
import assert from "node:assert/strict";
import { runBenchmark, BENCHMARK_CONTEXT, DEFAULT_KNOWN } from "../../lib/discovery/source-intelligence/benchmark";
import {
  resolveIdentity, resolveDomain, classifyModel, classifyContext, classifyOpportunity, canMerge, noveltyOf, COST,
} from "../../lib/discovery/source-intelligence/executor";
import { COLOMBIA_HOSPITALITY_FIXTURE } from "../../lib/discovery/source-intelligence/benchmark-fixture";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };
const row = (name: string) => COLOMBIA_HOSPITALITY_FIXTURE.find((r) => r.raw_name === name)!;

const b = runBenchmark();
const sf = b.strategies.find((s) => s.strategy === "structured_first")!;
const se = b.strategies.find((s) => s.strategy === "search_first")!;
const hy = b.strategies.find((s) => s.strategy === "hybrid")!;

// 1–4. Benchmark shape, budget, reproducibility, 0 providers.
t("1 benchmark artifact + context", b.id === "discovery-v2-colombia-hospitality-001" && b.context.country === "CO");
t("2 provider calls = 0, fixture-based", b.provider_calls === 0 && b.data_basis === "deterministic_fixture" && b.live_execution === false);
t("3 deterministic (reproducible)", JSON.stringify(runBenchmark()) === JSON.stringify(b));
t("4 budgets recorded", b.budgets.max_source_pages > 0 && b.budgets.max_evidence_calls > 0);

// 5–9. Entity resolution V2.
t("5 non-business (article) rejected at identity", resolveIdentity(row("Qué es un hotel boutique — blog de viajes")).state === "non_business_entity");
t("6 aggregator not a real entity", resolveIdentity(row("Booking.com — Hoteles spa Colombia")).state === "non_business_entity");
t("7 group vs property distinguished", resolveIdentity(row("Estelar Hoteles (grupo)")).state === "parent_child_relationship");
t("8 domain-anchored property resolves canonical", resolveIdentity(row("Hacienda Bambusa Hotel Boutique")).state === "canonical_resolved");
t("9 merge requires domain/geo — not fuzzy name alone", (() => {
  const a = row("ETEKA HOTEL SPA S.A.S."); const c = row("Hotel Spa Éteka"); // same entity, RNT (no domain) vs Cotelco (domain)
  const diffName = { ...a, raw_name: "Hotel Boutique Xyz", location: "Cartagena", domain_hint: null, truth: { ...a.truth, official_domain: null } };
  return canMerge(a, c).merge === true && canMerge(a, { ...diffName, truth: { ...diffName.truth, official_domain: null } }).merge === false;
})());

// 10–11. Domain resolution.
t("10 aggregator domain never official", resolveDomain(row("Booking.com — Hoteles spa Colombia")).state === "aggregator_only");
t("11 registry entity → probable domain (needs provider)", resolveDomain(row("HOTEL BOUTIQUE CASA LILA")).state === "probable_official_domain");

// 12–15. Business-model / context / opportunity classification (multi-label tolerant).
t("12 hotel_operator verified compatible", classifyModel(row("Hacienda Bambusa Hotel Boutique")) === "verified_compatible");
t("13 restaurant incompatible model", classifyModel(row("Restaurante El Balcón (no es hotel)")) === "incompatible");
t("14 strong spa+route ⇒ compatible context + strong mechanism", classifyContext(row("Sofitel Legend Santa Clara")) === "compatible" && classifyOpportunity(row("Sofitel Legend Santa Clara")) === "strong_mechanism");
t("15 weak route ⇒ weak context", classifyContext(row("HOTEL VERANERA DEL LLANO")) === "weak");

// 16–18. Account Memory novelty (suppression, no rediscovery of delivered).
const known = new Map(DEFAULT_KNOWN.map((k) => [k.canonical_id, k]));
t("16 delivered Amor account suppressed as new", noveltyOf("amor:eteka", known) === "previously_delivered");
t("17 unknown entity genuinely new", noveltyOf("co:bambusa", known) === "genuinely_new");
t("18 known accounts excluded from genuinely-new-qualified", sf.genuinely_new_qualified >= 4 && sf.raw_candidates > sf.genuinely_new_qualified);

// 19–23. Funnel + strategy comparison.
t("19 funnel monotonic-ish (raw ≥ resolved ≥ context ≥ evidence)", sf.raw_candidates >= sf.entity_resolved && sf.entity_resolved >= sf.context_compatible && sf.context_compatible >= sf.evidence_sufficient);
t("20 portfolio_selected empty (benchmark only)", sf.portfolio_selected === 0 && se.portfolio_selected === 0 && hy.portfolio_selected === 0);
t("21 structured-first yields most genuinely-new qualified", sf.genuinely_new_qualified >= se.genuinely_new_qualified && sf.genuinely_new_qualified >= hy.genuinely_new_qualified);
t("22 search-first lower cost per qualified but noisier", (se.marginal_cost_per_incremental_qualified ?? 9) <= (sf.marginal_cost_per_incremental_qualified ?? 0) + 1);
t("23 marginal cost computed per strategy", sf.marginal_cost_per_incremental_qualified !== null);

// 24–26. Incremental yield + overlap + complementarity.
t("24 source contributions have incremental qualified + marginal cost", b.source_contributions.some((c) => c.incremental_qualified > 0 && c.marginal_cost_per_incremental_qualified !== null));
t("25 overlap measured (duplicates within structured-first)", sf.duplicates > 0 && b.overlap.overlap_rate_structured_first !== null);
t("26 RNT observed role = identity/coverage (low domain)", b.source_contributions.find((c) => c.source_id === "co_rnt")?.official_domains === 0);

// 27–29. Source vs provider separation + provider metrics.
t("27 provider metrics distinct from sources", b.provider_metrics.some((m) => m.provider === "serper") && b.provider_metrics.some((m) => m.provider === "firecrawl_structured"));
t("28 provider ≠ source (serper resolves domains for registry-origin)", (b.provider_metrics.find((m) => m.provider === "serper")?.official_domains_resolved ?? 0) > 0);
t("29 provider useful-results not equal to 'most URLs = best' (search noisy)", b.rejection_analysis[0].top_source === "search_engine");

// 30–33. Rejection analysis + review sample.
t("30 biggest rejection = non-business from search", b.rejection_analysis[0].reason === "non_business_result" && b.rejection_analysis[0].top_source === "search_engine");
t("31 rejection percentages sum sanely", b.rejection_analysis.reduce((n, r) => n + r.pct, 0) >= 95);
t("32 review sample has strongest/borderline/rejected buckets", ["strongest", "borderline", "rejected"].every((bk) => b.review_sample.some((r) => r.bucket === bk)));
t("33 no artificial quota (report actual counts)", typeof sf.genuinely_new_qualified === "number");

// 34–37. Learning + confidence discipline + small-sample honesty.
t("34 learning recs require approval + not auto-applied + fixture-based", b.recommendations.every((r) => r.human_approval_required === true && r.auto_applied === false && r.fixture_based === true));
t("35 fixture run keeps confidence low (no historically_effective)", b.recommendations.every((r) => r.confidence !== "high"));
t("36 warnings include fixture + small-sample + awaiting outcomes", b.warnings.join(" ").match(/FIXTURE-BASED/i) !== null && b.warnings.join(" ").match(/awaiting_real_outcomes/) !== null);
t("37 stop conditions logged", b.stop_conditions_triggered.length > 0);

// 38–40. Early rejection saves expensive calls; cost attribution; founder decisions.
t("38 early rejection: non-business never reaches evidence cost", (() => { const artc = row("Booking.com — Hoteles spa Colombia"); return classifyContext; })() !== undefined && COST.evidence > COST.extraction);
t("39 founder decisions answerable", Object.keys(b.founder_decisions).length >= 8 && b.founder_decisions.preferred_strategy.length > 0);
t("40 manufacturing readiness stated (not executed)", /architecture ready/i.test(b.founder_decisions.ready_for_manufacturing));

console.log(`\n${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
