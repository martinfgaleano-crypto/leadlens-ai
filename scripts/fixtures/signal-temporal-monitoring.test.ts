import {
  SIGNAL_CATEGORIES, SIGNAL_TEMPORAL_POLICIES, assessSignalMateriality, assessTimingV2,
  compareSignalObservations, createMonitoringRun, createMonitoringTrigger, isSignalCategory,
  normalizeSignalEvent, planMonitoringQueries, temporalOutput, transitionQualification,
  type NormalizedEventInput, type SignalObservation,
} from "@/lib/intelligence/signal-temporal";
import { canonicalizeEvidence, type CanonicalEvidence } from "@/lib/intelligence/evidence-temporal";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { console.log(`${ok ? "✅" : "❌"} ${name}`); ok ? passed++ : failed++; };
const NOW = "2026-07-30T12:00:00.000Z", BASE = "2026-07-01T00:00:00.000Z";
const ev = (over: Partial<Parameters<typeof canonicalizeEvidence>[0]> = {}): CanonicalEvidence => canonicalizeEvidence({
  scope: "account", scope_key: "acme.co", url: "https://acme.co/noticias/apertura",
  publisher: "account-controlled:acme.co", source_type: "official", title: "ACME anuncia nueva sede",
  excerpt: "ACME anunció una nueva sede en Bogotá.", publication_date: "2026-07-20",
  publication_date_confidence: .9, retrieved_at: NOW, entity_match: "ACME",
  entity_match_confidence: .99, source_quality: .9, ...over,
});
const dims = {
  account_significance: .8, commercial_relevance: .9, client_relevance: .8, event_magnitude: .8,
  strategic_relevance: .8, temporal_proximity: .9, source_quality: .9, corroboration: .4,
  counterevidence_risk: .1, likely_persistence: .8,
};
const signal = (over: Partial<NormalizedEventInput> = {}) => normalizeSignalEvent({
  account_id: "acme.co", client_id: "c", category: "new_location",
  event_statement: "ACME anunció una nueva sede en Bogotá.", evidence: [ev()],
  event_status: "announced", detected_at: NOW, commercial_relevance: "high",
  client_relevance: "explicit", materiality_dimensions: dims,
  counterevidence_state: "none_found_bounded", ...over,
})!;

t("01 taxonomy contains all six families", Object.keys(SIGNAL_CATEGORIES).length === 6);
t("02 taxonomy recognizes new location", isSignalCategory("new_location"));
t("03 taxonomy rejects static structural fact", !isSignalCategory("company_description"));
t("04 static company fact does not normalize", normalizeSignalEvent({ account_id: "a", category: "structural_fit", event_statement: "Retailer", evidence: [ev()], detected_at: NOW }) === null);
t("05 structural fit cannot create a signal", normalizeSignalEvent({ account_id: "a", category: "structural_fit", event_statement: "Fit", evidence: [ev()], detected_at: NOW }) === null);
const planned = normalizeSignalEvent({ account_id: "a", category: "facility_opening", event_statement: "Opening planned", evidence: [ev()], event_status: "planned", detected_at: NOW })!;
const completed = normalizeSignalEvent({ account_id: "a", category: "facility_opening", event_statement: "Opening complete", evidence: [ev()], event_status: "completed", detected_at: NOW })!;
t("06 planned and completed events remain distinct", planned.signal_key !== completed.signal_key && planned.event_status !== completed.event_status);
t("07 retrieval date does not become event date", normalizeSignalEvent({ account_id: "a", category: "partnership", event_statement: "Alliance", evidence: [ev({ publication_date: null })], detected_at: NOW })!.publication_date === null);
t("08 official site plus official social counts once", normalizeSignalEvent({ account_id: "a", category: "partnership", event_statement: "Alliance", evidence: [ev(), ev({ url: "https://instagram.com/acme", publisher: "account-controlled:acme.co" })], detected_at: NOW })!.source_independence_state === "single_source");
t("09 syndicated copies count once", normalizeSignalEvent({ account_id: "a", category: "partnership", event_statement: "Alliance", evidence: [ev({ url: "https://n1.co/a", publisher: "N1", syndicated_from: "wire:1" }), ev({ url: "https://n2.co/a", publisher: "N2", syndicated_from: "wire:1" })], detected_at: NOW })!.source_independence_state === "single_source");
const twoSource = normalizeSignalEvent({ account_id: "a", category: "partnership", event_statement: "Alliance", evidence: [ev(), ev({ url: "https://news.co/acme", publisher: "News", source_type: "news" })], detected_at: NOW })!;
t("10 independent corroboration strengthens source state", twoSource.source_independence_state === "corroborated");
t("11 signal defaults to observation mode", signal().operational_mode === "observation");
t("12 ranking impact defaults off", signal().ranking_impact === "off");
t("13 report impact defaults off", signal().report_impact === "off");
t("14 review defaults unreviewed", signal().review_state === "unreviewed");
t("15 dated is not automatically corroborated", signal().current_status === "dated");
t("16 multi-dimensional materiality is high or critical", ["high", "critical"].includes(assessSignalMateriality(dims).state));
t("17 insufficient dimensions fail closed", assessSignalMateriality({ ...dims, account_significance: null, client_relevance: null, event_magnitude: null, strategic_relevance: null, likely_persistence: null, counterevidence_risk: null }).state === "insufficient_evidence");
t("18 hiring decays faster than opening", SIGNAL_TEMPORAL_POLICIES.sales_hiring.relevance_window_days < SIGNAL_TEMPORAL_POLICIES.facility_opening.relevance_window_days);
t("19 negative policy persists longer", SIGNAL_TEMPORAL_POLICIES.closure.relevance_window_days > SIGNAL_TEMPORAL_POLICIES.product_launch.relevance_window_days);
const trigger = createMonitoringTrigger({ account_id: "a", category: "new_location", statement: "New location", baseline: BASE, why: "Commercial access", created_at: NOW, verified_name: "ACME", verified_domain: "acme.co" })!;
t("20 trigger requires a baseline", createMonitoringTrigger({ account_id: "a", category: "new_location", statement: "x", baseline: null, why: "x", created_at: NOW, verified_name: "ACME", verified_domain: "acme.co" }) === null);
t("21 trigger is active but not scheduled", trigger.active_status === "active" && trigger.next_check_at !== null);
const queries = planMonitoringQueries({ trigger, verified_name: "ACME", verified_domain: "acme.co", country: "Colombia", language: "es", prior_source_cutoff: BASE, now: NOW });
t("22 planner uses verified identity", queries.every((q) => q.query.includes('"ACME"') || q.query.includes("site:acme.co")));
t("23 generic monitoring query rejected", planMonitoringQueries({ ...{ trigger: { ...trigger, query_templates: ["expansion"] }, verified_name: "ACME", verified_domain: "acme.co", country: "Colombia", language: "es", prior_source_cutoff: BASE, now: NOW } })[0].accepted === false);
t("24 query window uses prior cutoff with overlap", queries[0].requested_from < BASE && queries[0].overlap_days > 0);
t("25 provider date uncertainty preserved", queries[0].provider_date_behavior === "requested_not_guaranteed");
t("26 query cap enforced", planMonitoringQueries({ trigger, verified_name: "ACME", verified_domain: "acme.co", country: "Colombia", language: "es", prior_source_cutoff: BASE, now: NOW, max_queries: 2 }).length === 2);
const run1 = createMonitoringRun({ client_id: "c", source_cutoff: NOW, baseline_cutoff: BASE, requested_from: BASE, query_cap: 99, extraction_cap: 99, trigger_cap_per_account: 99 });
const run2 = createMonitoringRun({ client_id: "c", source_cutoff: NOW, baseline_cutoff: BASE, requested_from: BASE, query_cap: 99, extraction_cap: 99, trigger_cap_per_account: 99 });
t("27 monitoring run idempotent", run1.run_id === run2.run_id);
t("28 global query cap enforced", run1.query_cap === 30);
t("29 extraction cap enforced", run1.extraction_cap === 12);
t("30 trigger cap enforced", run1.trigger_cap_per_account === 3);
const first = compareSignalObservations({ account_id: "a", monitoring_run_id: run1.run_id, prior: null, current: signal(), baseline_available: true, detected_at: NOW });
t("31 first observation is not historical change", first.state === "first_seen" && !!first.limitation);
const missing = compareSignalObservations({ account_id: "a", monitoring_run_id: run1.run_id, prior: null, current: signal(), baseline_available: false, detected_at: NOW });
t("32 missing baseline blocks What Changed", missing.state === "unresolved" && missing.limitation === "baseline_missing");
const same = compareSignalObservations({ account_id: "a", monitoring_run_id: run1.run_id, prior: signal(), current: signal(), baseline_available: true, detected_at: NOW });
t("33 repeated duplicate evidence unchanged", same.state === "unchanged");
const corroborated = { ...signal(), signal_id: "new", corroboration_state: "corroborated" as const, current_status: "corroborated" as const, supporting_evidence_ids: [...signal().supporting_evidence_ids, "ev_independent"], confidence: .8 };
t("34 independent corroboration can change state", compareSignalObservations({ account_id: "a", monitoring_run_id: run1.run_id, prior: signal(), current: corroborated, baseline_available: true, detected_at: NOW }).state === "corroborated");
t("35 announced becoming completed is material", compareSignalObservations({ account_id: "a", monitoring_run_id: run1.run_id, prior: planned, current: completed, baseline_available: true, detected_at: NOW }).state === "materially_changed");
t("36 announced becoming cancelled is negative", compareSignalObservations({ account_id: "a", monitoring_run_id: run1.run_id, prior: planned, current: { ...planned, event_status: "cancelled", current_status: "contradicted" }, baseline_available: true, detected_at: NOW }).state === "contradicted");
t("37 old event cannot create current timing", assessTimingV2({ signal: { ...signal(), freshness_state: "stale", current_status: "stale" }, structural_relevance: "strong", commercial_accessibility: "clear" }) === "stale_timing");
t("38 counterevidence weakens timing", assessTimingV2({ signal: { ...signal(), counterevidence_state: "material" }, structural_relevance: "strong", commercial_accessibility: "clear" }) === "contradicted_timing");
t("39 structural fit cannot create act now", transitionQualification({ account_id: "a", previous: "prioritize", timing: "no_current_timing_evidence", structural_relevance: "strong", client_fit: "strong", critical_counterevidence: false, clear_action: true, confidence: .9 }).new_decision !== "act_now");
t("40 emerging timing can investigate", transitionQualification({ account_id: "a", previous: "prioritize", timing: "emerging_timing", structural_relevance: "strong", client_fit: "strong", critical_counterevidence: false, confidence: .6 }).new_decision === "investigate_now");
t("41 strong timing without fit cannot act", transitionQualification({ account_id: "a", previous: "investigate_now", timing: "strong_timing", structural_relevance: "strong", client_fit: "weak", critical_counterevidence: false, clear_action: true, confidence: .9 }).new_decision !== "act_now");
t("42 severe contradiction can exclude", transitionQualification({ account_id: "a", previous: "prioritize", timing: "contradicted_timing", structural_relevance: "strong", client_fit: "strong", critical_counterevidence: true, confidence: .9 }).new_decision === "exclude");
const tr = transitionQualification({ account_id: "a", previous: "monitor", timing: "no_current_timing_evidence", structural_relevance: "strong", client_fit: "strong", critical_counterevidence: false, confidence: .7 });
t("43 transition preserves prior and new", tr.previous_decision === "monitor" && tr.new_decision === "prioritize");
t("44 raw signal count is not an input", !("signal_count" in tr));
t("45 no-current-signal output valid", temporalOutput({ type: "no_current_signal", account_id: "a" }).type === "no_current_signal");
t("46 no-current-signal remains internal", temporalOutput({ type: "no_current_signal", account_id: "a" }).internal_only === true);
t("47 output ranking remains off", temporalOutput({ type: "what_changed", account_id: "a" }).ranking_impact === "off");
t("48 output report remains off", temporalOutput({ type: "what_changed", account_id: "a" }).report_impact === "off");
t("49 no signal is valid timing", assessTimingV2({ signal: null, structural_relevance: "strong", commercial_accessibility: "clear" }) === "no_current_timing_evidence");
t("50 current signal alone does not guarantee strong timing", assessTimingV2({ signal: signal(), structural_relevance: "strong", commercial_accessibility: "clear" }) !== "strong_timing");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
