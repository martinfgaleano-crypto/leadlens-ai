// Premium Differentiation V1 — Phase B LIVE researcher LOGIC acceptance (deterministic; ZERO spend).
// Injects fake providers + a fake LLM + a fake cost probe to prove the researcher's safety behavior
// WITHOUT any network/LLM/money: provider health fail-closed, evidence pooling+dedup, anti-hallucination
// (a proposal citing a non-existent evidence index is dropped; evidence is built only from REAL results),
// cost accounting (LLM ledger delta + provider cost), the COGS-ceiling STOP, and zero-result validity.
// Live truth + real COGS are a SEPARATE funded acceptance (scripts/accept-premium-context-live.mts).

import type { SearchProvider, SearchQuery, SearchProviderResponse, SearchResultItem } from "../../lib/sources/access/provider-contract";
import {
  createLivePremiumContextResearcher, planQueries, mapProposalToRaw,
  DEFAULT_LIVE_LIMITS, type LlmProposal, type LiveResearcherLimits,
} from "../../lib/intelligence/premium/premium-context-researcher";
import { assemblePremiumContext } from "../../lib/intelligence/premium/premium-context";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

const NOW = Date.parse("2026-09-09T00:00:00Z");

function item(url: string, over: Partial<SearchResultItem> = {}): SearchResultItem {
  return { url, canonical_url: over.canonical_url ?? url, title: over.title ?? "Result", snippet: over.snippet ?? "snippet", published_date: over.published_date ?? "2026-08-01", retrieved_at: "2026-09-09", source_type: "news", provider: over.provider ?? "fake", rank: 1, locale: null };
}
function fakeProvider(id: string, results: SearchResultItem[], opts: { available?: boolean; cost?: number | null; throws?: boolean } = {}): SearchProvider {
  return {
    id,
    capabilities: () => ({ search: true, extract: false, regions: "global", supports_dates: true }),
    async health() { return { provider: id, status: (opts.available ?? true) ? "available" : "unavailable", reason: null, credentials_present: opts.available ?? true }; },
    async search(query: SearchQuery): Promise<SearchProviderResponse> {
      if (opts.throws) throw new Error("boom");
      return { ok: true, provider: id, query, results, latency_ms: 5, cost_estimate_usd: opts.cost ?? null, error: null };
    },
  };
}
const clock = () => NOW;

async function main() {
// ── planQueries: bounded by maxProviderSearches, time-sensitive tagged. ──
const plan = planQueries({ objective: "US mfg logistics", portfolioCompanies: ["Acme", "Beta", "Gamma", "Delta"], offer: "ops consulting" }, DEFAULT_LIVE_LIMITS);
t("plan: respects maxProviderSearches cap", plan.length <= DEFAULT_LIVE_LIMITS.maxProviderSearches);
t("plan: has a time-sensitive news query and durable queries", plan.some((p) => p.timeSensitive) && plan.some((p) => !p.timeSensitive));

// ── Fail-closed: no available providers → empty raw, cost null/unmeasured, no LLM call. ──
{
  let llmCalled = false;
  const r = createLivePremiumContextResearcher({ providers: [fakeProvider("x", [], { available: false })], now: clock, extract: async () => { llmCalled = true; return {}; } });
  const raw = await r.research({ objective: "seg", portfolioCompanies: [], offer: null });
  t("fail-closed: no providers → empty benchmark", Object.keys(raw.benchmark ?? {}).length === 0 && (raw.competitors ?? []).length === 0);
  t("fail-closed: cost estimatedUsd null + measured false", raw.cost.estimatedUsd === null && raw.cost.measured === false);
  t("fail-closed: LLM never called when no providers", llmCalled === false);
  t("fail-closed: through gate → NOT_ESTABLISHED", assemblePremiumContext(raw, NOW).benchmark.state === "NOT_ESTABLISHED");
}

// ── Zero-result: providers available but return nothing → empty raw, providerCalls counted, no LLM. ──
{
  let llmCalled = false;
  const r = createLivePremiumContextResearcher({ providers: [fakeProvider("x", [])], now: clock, extract: async () => { llmCalled = true; return {}; } });
  const raw = await r.research({ objective: "seg", portfolioCompanies: ["A"], offer: "o" });
  t("zero-result: providerCalls counted", raw.cost.providerCalls > 0);
  t("zero-result: no LLM call on empty pool", llmCalled === false);
  t("zero-result: valid empty context through gate", assemblePremiumContext(raw, NOW).additionalOpportunities.length === 0);
}

// ── Evidence pooling + dedup by canonical_url across providers. ──
{
  const shared = item("https://a.com/x", { canonical_url: "https://a.com/x" });
  const p1 = fakeProvider("p1", [shared, item("https://b.com/1", { canonical_url: "https://b.com/1" })]);
  const p2 = fakeProvider("p2", [shared]); // same canonical → deduped
  let poolSize = 0;
  const r = createLivePremiumContextResearcher({
    providers: [p1, p2], now: clock,
    extract: async (_s, user) => { poolSize = (user.match(/^\[\d+\]/gm) ?? []).length; return {}; },
  });
  await r.research({ objective: "seg", portfolioCompanies: ["A"], offer: "o" });
  t("pool: dedups shared canonical url (2 unique across providers)", poolSize === 2);
}

// ── Anti-hallucination: a note citing a non-existent index is DROPPED; a real citation keeps REAL evidence. ──
{
  const real = item("https://real.com/report", { canonical_url: "https://real.com/report", published_date: "2026-07-15", title: "Real supplier resilience report" });
  const proposal: LlmProposal = {
    benchmark: {
      recurringNeeds: [
        { statement: "Grounded need", sources: [0], basis: "signal", confidence: "Moderate" },   // index 0 exists
        { statement: "Hallucinated need", sources: [999] },                                        // index 999 does NOT exist → drop
        { statement: "No sources at all", sources: [] },                                            // ungrounded → drop
      ],
    },
    competitors: [{ entity: "CompCo", whyRelevant: "targets same buyers", positioning: [{ statement: "priced low", sources: [0] }], counterevidence: [], unknowns: [] }],
  };
  const r = createLivePremiumContextResearcher({ providers: [fakeProvider("p", [real])], now: clock, extract: async () => proposal, readAnthropicCostUsd: () => 0 });
  const raw = await r.research({ objective: "seg", portfolioCompanies: ["A"], offer: "o" });
  const needs = raw.benchmark?.recurringNeeds ?? [];
  t("anti-hallucination: only the grounded note survives", needs.length === 1 && needs[0].statement === "Grounded need");
  t("anti-hallucination: evidence is the REAL retrieved item (url+date), not model-invented", needs[0].evidence.length === 1 && needs[0].evidence[0].url === "https://real.com/report" && needs[0].evidence[0].observedDate === "2026-07-15");
  const gated = assemblePremiumContext(raw, NOW);
  t("through gate: benchmark PRESENT (grounded) + competitor retained", gated.benchmark.state === "PRESENT" && gated.competitors.length === 1);
}

// ── mapProposalToRaw is pure and drops entity-less / whyRelevant-less items at the gate. ──
{
  const real = item("https://s.com/a");
  const pool = [{ idx: 0, item: real }];
  const raw = mapProposalToRaw({ competitors: [{ entity: "", whyRelevant: "x", positioning: [{ statement: "s", sources: [0] }] }, { entity: "Keep", whyRelevant: "", positioning: [{ statement: "s", sources: [0] }] }] }, pool);
  t("map: entity-less competitor removed in mapping", (raw.competitors ?? []).every((c) => c.entity === "Keep"));
  t("map: whyRelevant-less competitor dropped by the GATE", assemblePremiumContext({ ...raw, cost: undefined } as never, NOW).competitors.length === 0);
}

// ── Cost accounting: estimatedUsd = LLM ledger delta + provider cost; measured reflects provider nullness. ──
{
  const real = item("https://c.com/a");
  let calls = 0;
  const probe = () => (calls++ === 0 ? 1.00 : 1.25); // before=1.00, after=1.25 → delta $0.25
  const r = createLivePremiumContextResearcher({
    providers: [fakeProvider("p", [real], { cost: 0.02 })], now: clock,
    limits: { maxProviderSearches: 1 } as Partial<LiveResearcherLimits>, // exactly one search → clean arithmetic
    extract: async () => ({ benchmark: { recurringNeeds: [{ statement: "n", sources: [0] }] } }),
    readAnthropicCostUsd: probe,
  });
  const raw = await r.research({ objective: "seg", portfolioCompanies: ["A"], offer: "o" });
  t("cost: estimatedUsd = llm delta 0.25 + provider 0.02 = 0.27", Math.abs((raw.cost.estimatedUsd ?? 0) - 0.27) < 1e-6);
  t("cost: measured true when provider cost reported", raw.cost.measured === true);
  t("cost: llmCalls + providerCalls counted", raw.cost.llmCalls === 1 && raw.cost.providerCalls === 1);
}
{
  // provider cost null → measured false (Brave/Serper case).
  const r = createLivePremiumContextResearcher({
    providers: [fakeProvider("p", [item("https://d.com/a")], { cost: null })], now: clock,
    extract: async () => ({ benchmark: { recurringNeeds: [{ statement: "n", sources: [0] }] } }),
    readAnthropicCostUsd: (() => { let c = 0; return () => (c++ === 0 ? 0 : 0.05); })(),
  });
  const raw = await r.research({ objective: "seg", portfolioCompanies: ["A"], offer: "o" });
  t("cost: provider null → measured false, estimate still reported (llm)", raw.cost.measured === false && Math.abs((raw.cost.estimatedUsd ?? 0) - 0.05) < 1e-6);
}

// ── COGS ceiling STOP: an LLM delta beyond the ceiling throws PREMIUM_COGS_CEILING. ──
{
  const r = createLivePremiumContextResearcher({
    providers: [fakeProvider("p", [item("https://e.com/a")])], now: clock,
    limits: { cogsCeilingUsd: 0.5 } as Partial<LiveResearcherLimits>,
    extract: async () => ({}),
    readAnthropicCostUsd: (() => { let c = 0; return () => (c++ === 0 ? 0 : 9.0); })(), // $9 delta > $0.5 ceiling
  });
  let threw = false;
  try { await r.research({ objective: "seg", portfolioCompanies: ["A"], offer: "o" }); } catch (e) { threw = /PREMIUM_COGS_CEILING/.test(String(e)); }
  t("COGS ceiling: run STOPS (throws) rather than overspend", threw);
}

}

main().then(() => {
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}).catch((e) => { console.error(e); process.exit(1); });
