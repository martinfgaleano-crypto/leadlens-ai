#!/usr/bin/env node
/** Premium Differentiation V1 — Phase B FUNDED LIVE acceptance (Gate B).
 *
 * Proves the contextual researcher against REAL providers + a REAL LLM on one synthetic-but-real
 * portfolio (the controlled-acquisition archetype: a US B2B ops consultancy into manufacturing).
 * It MEASURES COGS (LLM list-price via the usage ledger) and LATENCY, verifies TRUTH invariants
 * (every surfaced item is backed by a real retrieved URL; nothing fabricated; zero-result is valid),
 * and enforces the COGS envelope (<$4 target, >$8 STOP). No DB writes, no Lemon, no persistence.
 *
 * Spend gate: this SPENDS real money, so it runs live only with PREMIUM_LIVE_ACCEPT=1. Without it,
 * it prints the plan and exits 0 (dry — safe for CI / accidental invocation).
 */
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
for (const [key, value] of Object.entries(env)) if (typeof value === "string") process.env[key] = value;

const LIVE = process.env.PREMIUM_LIVE_ACCEPT === "1";
const anyProvider = ["BRAVE_SEARCH_API_KEY", "SERPER_API_KEY", "TAVILY_API_KEY", "FIRECRAWL_API_KEY"].some((k) => has(env, k));
if (!has(env, "ANTHROPIC_API_KEY")) { console.error("BLOCKED: ANTHROPIC_API_KEY missing"); process.exit(3); }
if (!anyProvider) { console.error("BLOCKED: no search provider key present (need one of BRAVE/SERPER/TAVILY/FIRECRAWL)"); process.exit(3); }

const { createLivePremiumContextResearcher, DEFAULT_LIVE_LIMITS } = await import("@/lib/intelligence/premium/premium-context-researcher");
const { assemblePremiumContext, PREMIUM_BUDGETS } = await import("@/lib/intelligence/premium/premium-context");

// One bounded, real portfolio (public US manufacturers) + a real consultancy offer.
const INPUT = {
  objective: "US mid-market manufacturing operations and supply-chain improvement",
  portfolioCompanies: ["Rockwell Automation", "Parker Hannifin", "Dover Corporation"],
  offer: "operations and supply-chain consulting",
};

console.log("── Premium Context — Live Acceptance (Gate B) ──");
console.log(`mode: ${LIVE ? "LIVE (spending)" : "DRY (no spend — set PREMIUM_LIVE_ACCEPT=1 to run live)"}`);
console.log(`limits: searches≤${DEFAULT_LIVE_LIMITS.maxProviderSearches} llm≤${DEFAULT_LIVE_LIMITS.maxLlmCalls} target<$${DEFAULT_LIVE_LIMITS.cogsTargetUsd} ceiling>$${DEFAULT_LIVE_LIMITS.cogsCeilingUsd} (STOP)`);
console.log(`caps: benchmark ${PREMIUM_BUDGETS.benchmarkEntities} / competitors ${PREMIUM_BUDGETS.competitors} / discovery ${PREMIUM_BUDGETS.discoverySurfaced}·${PREMIUM_BUDGETS.discoveryDeep} / ecosystem ${PREMIUM_BUDGETS.ecosystem}`);
console.log(`objective: ${INPUT.objective}\nportfolio: ${INPUT.portfolioCompanies.join(", ")}\noffer: ${INPUT.offer}\n`);

if (!LIVE) { console.log("DRY run complete — no providers or LLM were called. Re-run with PREMIUM_LIVE_ACCEPT=1 to fund the live acceptance."); process.exit(0); }

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "PASS" : "FAIL"}: ${n}`); };

const researcher = createLivePremiumContextResearcher({});   // real providers + real LLM + ledger cost
let raw, gated, threwCeiling = false;
try {
  raw = await researcher.research(INPUT);
} catch (e) {
  if (/PREMIUM_COGS_CEILING/.test(String(e))) { threwCeiling = true; console.error(String(e)); }
  else { console.error("RESEARCH ERROR:", e); process.exit(1); }
}
t("did not trip the COGS ceiling STOP", !threwCeiling);
if (!raw) process.exit(1);

gated = assemblePremiumContext(raw);

// ── COGS + latency (measured) ──
const usd = raw.cost.estimatedUsd;
console.log(`\n── COGS / latency (measured) ──`);
console.log(`providerCalls=${raw.cost.providerCalls} llmCalls=${raw.cost.llmCalls} estimatedUsd=${usd == null ? "null" : "$" + usd.toFixed(4)} measured=${raw.cost.measured} elapsedMs=${raw.cost.elapsedMs}`);
console.log(`(estimatedUsd = LLM list-price via ledger + provider-reported search cost; Brave/Serper report null → measured=false expected. List price, not an invoice.)`);

// ── Gated context summary ──
console.log(`\n── Gated context (post-doctrine) ──`);
console.log(`benchmark.state=${gated.benchmark.state} recurringNeeds=${gated.benchmark.recurringNeeds.length} offerPositioning=${gated.benchmark.offerPositioning.length} differentiatedWhere=${gated.benchmark.differentiatedWhere.length} currentMovements=${gated.benchmark.currentMovements.length}`);
console.log(`competitors=${gated.competitors.length} additionalOpportunities=${gated.additionalOpportunities.length} (deep=${gated.additionalOpportunities.filter((o) => o.deepResearched).length}) ecosystem=${gated.ecosystem.length}`);

const sampleNotes = [...gated.benchmark.recurringNeeds, ...gated.benchmark.offerPositioning, ...gated.benchmark.currentMovements].slice(0, 4);
if (sampleNotes.length) {
  console.log(`\n── Evidence spot-check (grounded notes → real URLs) ──`);
  for (const n of sampleNotes) console.log(`• [${n.basis}/${n.confidence}${n.stale ? "/stale" : ""}] ${n.statement}\n    ↳ ${n.evidence.map((e) => e.url).join("  ")}`);
}

// ── TRUTH invariants ──
console.log(`\n── Truth invariants ──`);
const allNotes = [...gated.benchmark.recurringNeeds, ...gated.benchmark.offerPositioning, ...gated.benchmark.differentiatedWhere, ...gated.benchmark.currentMovements];
t("every benchmark note carries ≥1 real-URL evidence", allNotes.every((n) => n.evidence.length > 0 && n.evidence.every((e) => !!e.url)));
t("every competitor has whyRelevant + evidenced positioning", gated.competitors.every((c) => c.whyRelevant.trim() && c.positioning.every((p) => p.evidence.length > 0)));
t("every discovery ties to the objective + has real evidence", gated.additionalOpportunities.every((o) => o.connectionToObjective.trim() && o.evidence.length > 0));
t("every ecosystem actor is material + evidenced", gated.ecosystem.every((e) => e.why.trim() && e.evidence.length > 0));
t("no time-sensitive 'current movement' is stale", gated.benchmark.currentMovements.every((n) => !n.stale));
t("caps respected (benchmark/competitors/discovery/ecosystem)", gated.benchmark.recurringNeeds.length <= PREMIUM_BUDGETS.benchmarkEntities && gated.competitors.length <= PREMIUM_BUDGETS.competitors && gated.additionalOpportunities.length <= PREMIUM_BUDGETS.discoverySurfaced && gated.additionalOpportunities.filter((o) => o.deepResearched).length <= PREMIUM_BUDGETS.discoveryDeep && gated.ecosystem.length <= PREMIUM_BUDGETS.ecosystem);
t("cost not fabricated (estimatedUsd is a measured number when an LLM call happened)", raw.cost.llmCalls === 0 || typeof usd === "number");
t("portfolio ≠ market note present", /not the whole market/i.test(gated.benchmark.scopeNote));

// ── COGS envelope verdict ──
console.log(`\n── COGS verdict ──`);
if (usd == null) { console.log("COGS: unmeasured (no LLM call / zero-result) — VALID but not a cost proof"); }
else if (usd <= DEFAULT_LIVE_LIMITS.cogsTargetUsd) { console.log(`COGS: $${usd.toFixed(4)} ≤ target $${DEFAULT_LIVE_LIMITS.cogsTargetUsd} → WITHIN ENVELOPE ✅`); }
else if (usd <= DEFAULT_LIVE_LIMITS.cogsCeilingUsd) { console.log(`COGS: $${usd.toFixed(4)} over target but ≤ ceiling $${DEFAULT_LIVE_LIMITS.cogsCeilingUsd} → WARN (acceptable, watch)`); }
else { console.log(`COGS: $${usd.toFixed(4)} > ceiling → would have STOPPED`); failed++; }

const zeroResult = gated.benchmark.state === "NOT_ESTABLISHED" && gated.competitors.length === 0 && gated.additionalOpportunities.length === 0 && gated.ecosystem.length === 0;
console.log(`\nzero-result: ${zeroResult ? "YES (valid Premium outcome — not a failure)" : "no (context surfaced)"}`);
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
