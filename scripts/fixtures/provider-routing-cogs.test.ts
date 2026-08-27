// Provider Routing + COGS Optimization V1 — task-aware routing, health/fallback/
// early-stop, normalized economics (yield/waste/cost), materiality lexicon
// expansion, shared-extractor parity, and quality-floor regression.
import { planRoute, DEFAULT_ROUTING_BUDGET, type HealthMap } from "@/lib/monitor/provider-routing";
import { normalizeEconomics, totalCost, emptyObservation, recordWaste, type ProviderRouteObservation } from "@/lib/monitor/research-economics";
import { extractEvent, type EventCandidate } from "@/lib/monitor/event-extraction";
import { proposalsToObservedItems, type EventProposal } from "@/lib/monitor/claim-event-extractor";
import { classifyMateriality } from "@/lib/discovery/materiality";
import { classifySignalKind } from "@/lib/discovery/event-vs-metric";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };
const run = async () => {

const NOW = new Date("2026-08-26T00:00:00.000Z");
const cand = (title: string, dateRaw: string | null = "2026-07-01"): EventCandidate =>
  ({ accountId: "Acme", sourceHost: "reuters.com", sourceUrl: "https://reuters.com/x", titleAndContent: title, eventDateRaw: dateRaw, publicationDate: null, retrievedAt: NOW.toISOString() });

// ─── ROUTING ──────────────────────────────────────────────────────────────────
t("routing: lead_hunter → broad discovery primary (brave first), early-stop unique-eligible",
  (() => { const p = planRoute({ task: "lead_hunter_discovery", accountKnown: false, temporal: false, needsFullText: false }); return p.primary[0].provider === "brave" && p.primary[0].role === "broad_discovery" && p.earlyStop === "enough_unique_eligible_candidates"; })());
t("routing: monitor_delta temporal → Tavily news mode leads, escalate later; early-stop dc-resolved/no-change",
  (() => { const p = planRoute({ task: "monitor_delta", accountKnown: true, temporal: true, needsFullText: false }); return p.primary[0].provider === "tavily" && p.primary[0].queryMode === "news" && p.earlyStop === "decision_critical_resolved_or_sufficient_no_change"; })());
t("routing: initial_research → account-specific; fallback includes counterevidence search",
  (() => { const p = planRoute({ task: "initial_research", accountKnown: true, temporal: true, needsFullText: false }); return p.primary.length >= 1 && p.fallback.some((s) => /counterevidence/.test(s.reason)); })());
t("routing: full_text → extraction role (firecrawl first), stop when event date validated",
  (() => { const p = planRoute({ task: "full_text_extraction", accountKnown: true, temporal: false, needsFullText: true }); return p.primary[0].provider === "firecrawl" && p.earlyStop === "event_date_validated"; })());
t("routing: corroboration picks a DIFFERENT provider than the primary already used",
  (() => { const p = planRoute({ task: "corroboration", accountKnown: true, temporal: false, needsFullText: false, primaryProviderUsed: "brave" }); return p.primary.length === 1 && p.primary[0].provider !== "brave" && p.earlyStop === "independent_support_achieved"; })());
t("routing (health): quota-exhausted provider is SKIPPED up front with a reason (no wasted latency)",
  (() => { const h: HealthMap = { serper: "quota_exhausted" }; const p = planRoute({ task: "lead_hunter_discovery", accountKnown: false, temporal: false, needsFullText: false }, h); return p.skipped.some((s) => s.provider === "serper" && /quota_exhausted/.test(s.reason)) && !p.primary.concat(p.fallback).some((s) => s.provider === "serper"); })());
t("routing (fallback): primary provider unavailable → next healthy provider becomes primary",
  (() => { const h: HealthMap = { brave: "unavailable" }; const p = planRoute({ task: "lead_hunter_discovery", accountKnown: false, temporal: false, needsFullText: false }, h); return p.primary[0].provider === "tavily" && p.skipped.some((s) => s.provider === "brave"); })());
t("routing (all down): no healthy provider → empty primary + explicit degrade reason",
  (() => { const h: HealthMap = { brave: "unavailable", tavily: "unavailable", serper: "unavailable" }; const p = planRoute({ task: "monitor_delta", accountKnown: true, temporal: true, needsFullText: false }, h); return p.primary.length === 0 && p.reasons.some((r) => /degrade|insufficient/.test(r)); })());
t("routing (geo/lang): Colombia context → Spanish, no new provider invented",
  (() => { const p = planRoute({ task: "lead_hunter_discovery", accountKnown: false, geography: "co", temporal: false, needsFullText: false }); return p.language === "es" && p.geography === "co" && p.primary.every((s) => ["brave", "tavily", "serper", "exa", "firecrawl"].includes(s.provider)); })());
t("routing: no opaque score — plan exposes reasons + ordered steps only",
  (() => { const p = planRoute({ task: "initial_research", accountKnown: true, temporal: false, needsFullText: false }); return Array.isArray(p.reasons) && p.reasons.length > 0 && !("score" in (p as object)); })());
t("routing: technical budgets present (calls/fallback/parallel/fulltext/llm/timeout)",
  DEFAULT_ROUTING_BUDGET.maxProviderCalls > 0 && DEFAULT_ROUTING_BUDGET.maxLlmExtractionCalls > 0 && DEFAULT_ROUTING_BUDGET.maxParallelProviders >= 1);

// ─── ECONOMICS: yield / waste / cost ─────────────────────────────────────────
{
  const brave = emptyObservation("brave");
  brave.calls = 3; brave.successes = 3; brave.latencyMsTotal = 900; brave.candidates = 20; brave.uniqueCandidates = 12; brave.acceptedSources = 5; brave.events = 3; brave.materialEvents = 2; brave.costUsd = null;
  recordWaste(brave, "duplicate_result", 8); recordWaste(brave, "temporal_rejected", 2);
  const tavily = emptyObservation("tavily");
  tavily.calls = 2; tavily.successes = 2; tavily.candidates = 8; tavily.uniqueCandidates = 6; tavily.acceptedSources = 3; tavily.events = 1; tavily.materialEvents = 1; tavily.costUsd = null;
  const econ = normalizeEconomics([brave, tavily]);
  t("economics: aggregates calls/candidates/unique/accepted/events + waste reasons",
    econ.providerCalls === 5 && econ.uniqueCandidates === 18 && econ.acceptedEvents === 4 && (econ.wasteByReason.duplicate_result ?? 0) === 8);
  t("economics: waste rate computed (wasted/total results)", econ.wasteRate > 0 && econ.wasteRate <= 1);
  t("economics: cost/per metrics are NULL when provider cost is unknown (never fabricated)",
    econ.cost.costKnown === false && econ.costPerUniqueCandidate === null && econ.costPerMaterialEvent === null);
}
{
  const p = emptyObservation("firecrawl"); p.acceptedSources = 4; p.events = 2; p.materialEvents = 2; p.costUsd = 0.02;
  const econ = normalizeEconomics([p], 0.01);
  t("economics: when costs ARE known, cost-per metrics compute (cost/material event)",
    econ.cost.costKnown && econ.cost.totalCostUsd === 0.03 && econ.costPerMaterialEvent === 0.015);
}
t("economics: totalCost is null if any contributor cost is unknown", totalCost([{ ...emptyObservation("brave"), costUsd: null }], 0.01).costKnown === false);

// ─── MATERIALITY LEXICON EXPANSION (§40) — quality floor preserved ───────────
const acceptsAsEvent = (title: string): boolean => extractEvent(cand(title)).item.isDatedMaterialEvent;
t("materiality: expansion 'opened a new facility' → dated material event", acceptsAsEvent("Acme opened a new facility in Texas"));
t("materiality: operations start 'began production' → dated material event", acceptsAsEvent("Acme began production at its new line"));
t("materiality: 'commissioned a new plant' → dated material event", acceptsAsEvent("Acme commissioned a new plant"));
t("materiality: capacity 'expanded its capacity' → dated material event", acceptsAsEvent("Acme expanded its capacity significantly"));
t("materiality: partnership 'appointed a new distributor' → dated material event", acceptsAsEvent("Acme appointed a new distributor for the region"));
t("materiality: partnership 'signed a distribution agreement' → dated material event", acceptsAsEvent("Acme signed a distribution agreement with BetaCorp"));
t("materiality: negative 'cancelled its facility project' → counterevidence", extractEvent(cand("Acme cancelled its facility project")).item.isCounterevidence === true);
t("materiality: negative 'postponed the plant opening' → counterevidence", extractEvent(cand("Acme postponed the plant opening")).item.isCounterevidence === true);
t("materiality: negative 'divested its division' → counterevidence", extractEvent(cand("Acme divested its European division")).item.isCounterevidence === true);
// Quality floor: no false positives from noise / static / metric.
t("quality floor: static 'operates in 14 countries' → NOT an event", !acceptsAsEvent("Acme operates in 14 countries"));
t("quality floor: metric 'revenue reached $500M' → NOT an event", !acceptsAsEvent("Acme revenue reached $500M last year"));
t("quality floor: PR 'received a sustainability award' → NOT a material event", !acceptsAsEvent("Acme received a sustainability award"));
t("quality floor: expanded materiality did not make classifyMateriality return high for noise",
  classifyMateriality("Acme sponsored a local marathon").level === "low" && classifyMateriality("Acme opened a new facility").level === "high");
t("quality floor: no event without a defensible date (materiality present but date null)",
  !extractEvent(cand("Acme opened a new facility", null)).item.isDatedMaterialEvent);

// ─── SHARED EXTRACTOR PARITY (initial vs recurring use SAME primitives) ───────
{
  const proposal: EventProposal = { family: "new_facility", description: "Acme opened a new plant", eventDatePhrase: "March 2026", polarity: "positive", claimType: "event" };
  const src = { sourceHost: "reuters.com", sourceUrl: "https://reuters.com/x", publicationDate: "2026-08-01", retrievedAt: NOW.toISOString(), accountId: "Acme" };
  // "initial" (no cutoff) and "recurring" both call the SAME proposalsToObservedItems/extractEvent.
  const a = proposalsToObservedItems([proposal], src, []);
  const b = proposalsToObservedItems([proposal], src, []);
  t("parity: shared extraction primitive → identical claim/event/date/materiality/polarity",
    JSON.stringify(a) === JSON.stringify(b) && a[0].eventDate === "2026-03-01" && a[0].isDatedMaterialEvent);
  t("parity: can_trigger deterministic path also recognizes the expanded family",
    classifySignalKind("Acme opened a new plant").can_trigger === true);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
};
run();
