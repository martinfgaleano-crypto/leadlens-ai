// Premium Differentiation V1 — Phase B doctrine-gating acceptance (deterministic; no network/LLM).
// Proves the TRUTH-ENFORCEMENT layer: whatever the live researcher returns, the gate applies hard
// caps, relevance+evidence inclusion, staleness, and fail-closed states. Live research truth + COGS
// are a separate funded acceptance — this proves Premium can never fabricate or over-claim.

import {
  assemblePremiumContext, emptyPremiumContext, PREMIUM_BUDGETS,
  type GroundedNote, type EvidenceRef, type CompetitorContextV1, type AdditionalOpportunityV1, type EcosystemActorV1,
} from "../../lib/intelligence/premium/premium-context";
import { buildPremiumExecutivePortfolio } from "../../lib/intelligence/premium/premium-decision-architecture";
import type { AccountBriefVM, DecisionState } from "../../lib/deliverable/deliverable-view-model";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

const NOW = Date.parse("2026-09-09T00:00:00Z");
const RECENT = "2026-08-01", STALE = "2024-12-01";
const ev = (date: string | null): EvidenceRef => ({ sourceId: `s-${date ?? "x"}-${Math.random()}`, url: "https://e.com", observedDate: date, claim: "observed claim" });
const note = (statement: string, dates: (string | null)[], basis: GroundedNote["basis"] = "signal"): GroundedNote =>
  ({ statement, basis, evidence: dates.map(ev), confidence: "Moderate", stale: false });

// ── Benchmark: supported → PRESENT; weak (no evidence) → NOT_ESTABLISHED. ──
const supported = assemblePremiumContext({ benchmark: { recurringNeeds: [note("Recurring need for supplier resilience", [RECENT])], offerPositioning: [note("Offer appears differentiated on speed", [RECENT])] } }, NOW);
t("benchmark supported → PRESENT", supported.benchmark.state === "PRESENT");
t("benchmark keeps evidence-backed notes", supported.benchmark.recurringNeeds.length === 1 && supported.benchmark.offerPositioning.length === 1);
const weak = assemblePremiumContext({ benchmark: { recurringNeeds: [note("Unsupported claim", [])] } }, NOW);
t("benchmark weak (no evidence) → NOT_ESTABLISHED", weak.benchmark.state === "NOT_ESTABLISHED" && weak.benchmark.recurringNeeds.length === 0);
t("benchmark scope note (≠ whole market)", /not the whole market/i.test(supported.benchmark.scopeNote));

// ── Staleness: a dated signal older than freshness is retained-but-flagged; stale currentMovements dropped. ──
const stale = assemblePremiumContext({ benchmark: { recurringNeeds: [note("Old but real", [STALE])], currentMovements: [note("Old movement", [STALE])] } }, NOW);
t("stale evidence flagged (not presented as current)", stale.benchmark.recurringNeeds[0].stale === true);
t("stale 'current movement' suppressed (must be current)", stale.benchmark.currentMovements.length === 0);
const fresh = assemblePremiumContext({ benchmark: { currentMovements: [note("Recent movement", [RECENT])] } }, NOW);
t("fresh current movement retained", fresh.benchmark.currentMovements.length === 1 && fresh.benchmark.currentMovements[0].stale === false);

// ── Competitor context: relevant retained; irrelevant (no whyRelevant / no evidence) suppressed; cap 5. ──
const comp = (whyRelevant: string, withEv: boolean): CompetitorContextV1 => ({ entity: `C${Math.random()}`, role: "competitor", whyRelevant, affects: "benchmark", positioning: withEv ? [note("positioned on price", [RECENT])] : [note("no evidence", [])], counterevidence: [], unknowns: [], confidence: "Moderate" });
const compOut = assemblePremiumContext({ competitors: [comp("Directly targets same buyers", true), comp("", true), comp("relevant", false), ...Array.from({ length: 8 }, () => comp("Also relevant", true))] }, NOW).competitors;
t("competitor: relevant+evidenced retained", compOut.some((c) => c.whyRelevant === "Directly targets same buyers"));
t("competitor: no-relevance suppressed", !compOut.some((c) => c.whyRelevant === ""));
t("competitor: no-evidence suppressed", !compOut.some((c) => c.whyRelevant === "relevant"));
t(`competitor: cap ${PREMIUM_BUDGETS.competitors} enforced`, compOut.length <= PREMIUM_BUDGETS.competitors);

// ── Additional discovery: supported retained; false-positive suppressed; zero valid; deep cap. ──
const disc = (tie: string, withEv: boolean, deep: boolean): AdditionalOpportunityV1 => ({ entity: `D${Math.random()}`, role: "adjacent_segment", whyDiscovered: "found near portfolio", connectionToObjective: tie, evidence: withEv ? [ev(RECENT)] : [], worthInvestigatingBecause: tie ? "fits objective" : "", unknowns: [], deepResearched: deep });
const discOut = assemblePremiumContext({ additionalOpportunities: [disc("Same buyer, adjacent need", true, true), disc("", true, true), disc("valid but no evidence", false, true), ...Array.from({ length: 6 }, () => disc("Objective-tied", true, true))] }, NOW).additionalOpportunities;
t("discovery: supported retained", discOut.some((d) => d.connectionToObjective === "Same buyer, adjacent need"));
t("discovery: no objective tie suppressed", !discOut.some((d) => d.connectionToObjective === ""));
t("discovery: no evidence suppressed", !discOut.some((d) => d.connectionToObjective === "valid but no evidence"));
t(`discovery: surfaced cap ${PREMIUM_BUDGETS.discoverySurfaced}`, discOut.length <= PREMIUM_BUDGETS.discoverySurfaced);
t(`discovery: deep cap ${PREMIUM_BUDGETS.discoveryDeep}`, discOut.filter((d) => d.deepResearched).length <= PREMIUM_BUDGETS.discoveryDeep);
t("discovery: ZERO valid is a valid result", assemblePremiumContext({ additionalOpportunities: [disc("", false, false)] }, NOW).additionalOpportunities.length === 0);

// ── Ecosystem: relevant+material retained; irrelevant supplier suppressed; cap 4. ──
const eco = (why: string, withEv: boolean): EcosystemActorV1 => ({ entity: `E${Math.random()}`, role: "supplier", materialTo: "route", why, evidence: withEv ? [ev(RECENT)] : [] });
const ecoOut = assemblePremiumContext({ ecosystem: [eco("Controls access to the target segment", true), eco("", true), eco("ordinary vendor", false), ...Array.from({ length: 5 }, () => eco("Material to route", true))] }, NOW).ecosystem;
t("ecosystem: material retained", ecoOut.some((e) => e.why === "Controls access to the target segment"));
t("ecosystem: irrelevant supplier suppressed (no why / no evidence)", !ecoOut.some((e) => e.why === "") && !ecoOut.some((e) => e.why === "ordinary vendor"));
t(`ecosystem: cap ${PREMIUM_BUDGETS.ecosystem}`, ecoOut.length <= PREMIUM_BUDGETS.ecosystem);

// ── Empty / fail-closed context is a valid Premium result. ──
const empty = emptyPremiumContext();
t("empty context: benchmark NOT_ESTABLISHED, zero competitors/discovery/ecosystem", empty.benchmark.state === "NOT_ESTABLISHED" && empty.competitors.length === 0 && empty.additionalOpportunities.length === 0 && empty.ecosystem.length === 0);
t("cost: unmeasured is null (never fabricated)", empty.cost.estimatedUsd === null && empty.cost.measured === false);

// ── Phase-C composition: exec portfolio carries context when present, null when absent. ──
const acc: AccountBriefVM = { id: "a", rank: 1, company: "Co", segment: "Logistics", geography: "US", domain: null, accountRole: null, opportunityType: null, decision: "prioritize" as DecisionState, decisionNote: null, thesis: "t", whyItMatters: "w", dimensions: [{ label: "Fit", value: "Strong" as never }], whatChanged: [], evidence: { sourceCount: 2, datedCount: 1, corroborated: true, latestAge: null, strength: "Strong" }, sources: [], counterSignals: [], limitations: [], validations: [], nextStep: null, freshness: null, confidence: null };
t("composition: context attached when supplied", buildPremiumExecutivePortfolio([acc], supported).context?.benchmark.state === "PRESENT");
t("composition: context null when absent (fail-closed, no fabrication)", buildPremiumExecutivePortfolio([acc]).context === null);

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
