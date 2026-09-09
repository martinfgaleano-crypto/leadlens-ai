// Premium Differentiation V1 — Phase 2/3/5/16: production wiring + persistence envelope + fail-closed.
// Deterministic; ZERO spend (researcher injected). Proves eligibility, research-input derivation,
// the durable PremiumContextEnvelopeV1 (present/unavailable/failed/ceiling), never-throws behavior,
// versioned backward-compatible read, and that a fail-closed/absent envelope yields null at delivery.

import type { PremiumContextResearcher, RawPremiumResearch } from "../../lib/intelligence/premium/premium-context";
import {
  isPremiumEligible, deriveResearchInput, producePremiumContext, premiumContextFromEnvelope,
  PREMIUM_CONTEXT_VERSION, PREMIUM_CAPABILITY_GENERATION,
} from "../../lib/intelligence/premium/premium-production";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

const NOW = Date.parse("2026-09-09T00:00:00Z");
const fakeResearcher = (raw: RawPremiumResearch | (() => never)): PremiumContextResearcher => ({
  research: async () => (typeof raw === "function" ? raw() : raw),
});
const rawPresent: RawPremiumResearch = {
  benchmark: { recurringNeeds: [{ statement: "Recurring need", basis: "signal", confidence: "Moderate", stale: false, evidence: [{ sourceId: "s1", url: "https://x.com/a", observedDate: "2026-08-01", claim: "need" }] }] },
  competitors: [], additionalOpportunities: [], ecosystem: [],
  cost: { providerCalls: 6, llmCalls: 1, deepResearchEscalations: 0, estimatedUsd: 0.05, measured: false, elapsedMs: 40000 },
};

async function main() {
  // ── Eligibility (server-authoritative; premium only) ──
  t("eligible: pro / premium / premium_launch_v0", isPremiumEligible("pro") && isPremiumEligible("premium") && isPremiumEligible("premium_launch_v0"));
  t("NOT eligible: sample/starter/standard/null", !isPremiumEligible("sample") && !isPremiumEligible("starter") && !isPremiumEligible("standard") && !isPremiumEligible(null));

  // ── Research-input derivation ──
  const di = deriveResearchInput({ onboardingData: { offer_description: "ops consulting", target_customer_description: "US 3PLs" }, criteria: { target_market_region: "United States", target_industries: ["Logistics"] }, companies: ["Acme", "Acme", "Beta"] });
  t("derive: objective composes customer desc + region", di.objective === "US 3PLs in United States");
  t("derive: offer from offer_description", di.offer === "ops consulting");
  t("derive: portfolio companies deduped", di.portfolioCompanies.join(",") === "Acme,Beta");
  const di2 = deriveResearchInput({ onboardingData: { value_proposition: "we optimize supply chains" }, criteria: { target_industries: ["Mfg"] }, companies: [] });
  t("derive: offer falls back to value_proposition; objective from industries", di2.offer === "we optimize supply chains" && di2.objective === "Mfg");

  // ── producePremiumContext: PRESENT ──
  const present = await producePremiumContext({ objective: "o", portfolioCompanies: ["A"], offer: "x" }, { researcher: fakeResearcher(rawPresent), now: () => NOW });
  t("present: status present + context set", present.status === "present" && present.context !== null && present.context!.benchmark.state === "PRESENT");
  t("present: versioned + capability generation + ISO generatedAt", present.version === PREMIUM_CONTEXT_VERSION && present.capabilityGeneration === PREMIUM_CAPABILITY_GENERATION && present.generatedAt === "2026-09-09T00:00:00.000Z");
  t("present: cost recorded (measured flag preserved)", present.cost.estimatedUsd === 0.05 && present.cost.llmCalls === 1 && present.cost.measured === false);
  t("present: researchScope carries caps + objective", present.researchScope.objective === "o" && present.researchScope.caps.competitors === 5);

  // ── UNAVAILABLE (valid zero-result) ──
  const empty = await producePremiumContext({ objective: "o", portfolioCompanies: [], offer: null }, { researcher: fakeResearcher({ benchmark: {}, competitors: [], additionalOpportunities: [], ecosystem: [] }), now: () => NOW });
  t("unavailable: zero-result → status unavailable, context null, honest reason", empty.status === "unavailable" && empty.context === null && empty.failClosedReasons.includes("no_defensible_context_found"));

  // ── FAILED: COGS ceiling (researcher throws) — NEVER throws, honest reason ──
  const ceiling = await producePremiumContext({ objective: "o", portfolioCompanies: ["A"], offer: null }, { researcher: fakeResearcher(() => { throw new Error("PREMIUM_COGS_CEILING: estimated $9 exceeds ceiling $8"); }), now: () => NOW });
  t("ceiling: status failed + reason cogs_ceiling_reached (fail-closed, no throw)", ceiling.status === "failed" && ceiling.failClosedReasons.includes("cogs_ceiling_reached") && ceiling.context === null);

  // ── FAILED: generic error → research_error, still no throw ──
  const errored = await producePremiumContext({ objective: "o", portfolioCompanies: ["A"], offer: null }, { researcher: fakeResearcher(() => { throw new Error("provider exploded"); }), now: () => NOW });
  t("failed: generic error → research_error", errored.status === "failed" && errored.failClosedReasons.includes("research_error"));

  // ── premiumContextFromEnvelope: versioned, fail-closed read ──
  t("read: present envelope → context", premiumContextFromEnvelope(present) !== null);
  t("read: unavailable envelope → null", premiumContextFromEnvelope(empty) === null);
  t("read: failed envelope → null", premiumContextFromEnvelope(ceiling) === null);
  t("read: version mismatch → null (backward/forward safe)", premiumContextFromEnvelope({ ...present, version: "premium_context_v2" }) === null);
  t("read: missing/malformed → null", premiumContextFromEnvelope(undefined) === null && premiumContextFromEnvelope({}) === null && premiumContextFromEnvelope("x") === null);
}

main().then(() => { console.log(`${passed} passed, ${failed} failed`); if (failed > 0) process.exit(1); }).catch((e) => { console.error(e); process.exit(1); });
