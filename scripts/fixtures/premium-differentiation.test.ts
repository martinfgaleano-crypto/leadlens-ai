// Premium Differentiation V1 — deterministic decision-architecture acceptance (Phase A / Gate A).
// Proves the PURE Premium capabilities computed from the already-evaluated portfolio: fail-closed,
// deterministic, never override the canonical Decision, portfolio ≠ market, contact-rationale is not
// outreach. Research-backed capabilities (benchmark/competitor/discovery/ecosystem) are Phase B.

import type { AccountBriefVM, DecisionState } from "../../lib/deliverable/deliverable-view-model";
import {
  buildContactRationale, buildDecisionPathway, selectDecisionCriticalBriefs,
  buildAdvancedSynthesis, buildPremiumExecutivePortfolio,
} from "../../lib/intelligence/premium/premium-decision-architecture";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

function acc(o: Partial<AccountBriefVM> & { id: string; decision: DecisionState }): AccountBriefVM {
  return {
    id: o.id, rank: o.rank ?? null, company: o.company ?? `Co ${o.id}`, segment: o.segment ?? null,
    geography: o.geography ?? "US", domain: null, accountRole: null, opportunityType: null,
    opportunityDescriptor: o.opportunityDescriptor, decision: o.decision, decisionNote: o.decisionNote ?? null,
    thesis: o.thesis ?? null, whyItMatters: o.whyItMatters ?? null, dimensions: o.dimensions ?? [],
    whatChanged: o.whatChanged ?? [],
    evidence: o.evidence ?? { sourceCount: 0, datedCount: 0, corroborated: null, latestAge: null, strength: null },
    sources: [], counterSignals: o.counterSignals ?? [], limitations: o.limitations ?? [],
    validations: o.validations ?? [], validationDetails: o.validationDetails, nextStep: null,
    freshness: null, confidence: null,
  };
}
const D = (f: string, ti: string, e: string) => [{ label: "Fit", value: f as never }, { label: "Timing", value: ti as never }, { label: "Evidence", value: e as never }];

// Fixture portfolio (synthetic; US + South America; consultancy/B2B ICPs).
const A = acc({ id: "a", rank: 1, decision: "prioritize", segment: "Logistics", thesis: "Expanding capacity.", whyItMatters: "Fits our operations offer.", dimensions: D("Strong", "Strong", "Strong"), evidence: { sourceCount: 4, datedCount: 3, corroborated: true, latestAge: "9d", strength: "Strong" }, whatChanged: [{ event: "Signed distribution deal", date: "2026-08-05", age: "9d", source: null, kind: "recent_event" } as never] });
const B = acc({ id: "b", rank: 2, decision: "validate", segment: "Logistics", thesis: "New sites opened.", whyItMatters: "Strong route fit.", dimensions: D("Strong", "Moderate", "Moderate"), evidence: { sourceCount: 2, datedCount: 1, corroborated: false, latestAge: "14d", strength: "Moderate" }, counterSignals: ["Decision scope may be regional."], validationDetails: [{ question: "Confirm central procurement", decisionCritical: true, howToValidate: "Check filings", changesDecisionBecause: "Central procurement would justify prioritizing." }] });
const C = acc({ id: "c", rank: 3, decision: "validate", segment: "Healthcare", thesis: "Multi-site operator.", whyItMatters: "Category fit.", dimensions: D("Strong", "Limited", "Limited"), evidence: { sourceCount: 1, datedCount: 0, corroborated: false, latestAge: null, strength: "Limited" }, limitations: ["No operations change observed yet."] });
const Dh = acc({ id: "d", rank: 4, decision: "hold", segment: "Retail", thesis: "Weak category fit.", dimensions: D("Limited", "Limited", "Limited") });
const E = acc({ id: "e", rank: 5, decision: "monitor" }); // mini-depth: no thesis/whyItMatters
const F = acc({ id: "f", rank: 6, decision: "monitor", segment: "Healthcare", thesis: "Certification signal.", whyItMatters: "Capability signal.", dimensions: D("Moderate", "Limited", "Limited"), validationDetails: [{ question: "Confirm certification tied to contract", decisionCritical: true, howToValidate: null, changesDecisionBecause: "A dated contract would move it toward validate." }] });
const ALL = [A, B, C, Dh, E, F];

// ── Decision-Critical Briefs (§19/§42): up to 5, only justified, deterministic, never always 5. ──
const briefs = selectDecisionCriticalBriefs(ALL, 5);
t("briefs: only qualified selected (A,B,C,F) — hold-D and no-substance-E excluded", briefs.map((b) => b.accountId).sort().join() === "a,b,c,f");
t("briefs: NOT always 5 (4 qualify here)", briefs.length === 4);
t("briefs: highest-priority account first (prioritize A)", briefs[0].accountId === "a");
t("briefs: deterministic (stable across runs)", JSON.stringify(selectDecisionCriticalBriefs(ALL, 5).map((b) => b.accountId)) === JSON.stringify(briefs.map((b) => b.accountId)));
t("briefs: each adds utility (whyMatters + pathway + validationPriority)", briefs.every((b) => b.whyMatters.length > 0 && !!b.pathway && Array.isArray(b.validationPriority)));
t("briefs: whyNow only when Timing supported (A yes, C no)", (briefs.find((b) => b.accountId === "a")!.whyNow !== null) && (briefs.find((b) => b.accountId === "c")!.whyNow === null));
t("briefs: cap respected", selectDecisionCriticalBriefs(ALL, 2).length === 2);

// ── Decision Pathways (§18/§41): conditional, never override or predict the Decision. ──
const pB = buildDecisionPathway(B);
t("pathway: current Decision unchanged (validate)", pB.currentDecision === "validate" && pB.state === "OPEN");
t("pathway: lists validation requirements + evidence conditions", pB.validationRequirements.length > 0 && pB.evidenceConditions.length > 0);
t("pathway: conditional note makes no future-Decision prediction", /does not predict/i.test(pB.conditionalNote) && !/will (become|move to|be)\s+(prioritize|validate|monitor|hold)/i.test(pB.conditionalNote));
t("pathway fail-closed: settled account (A, no validations/uncertainty) → NOT_ESTABLISHED", buildDecisionPathway(A).state === "NOT_ESTABLISHED");

// ── Contact Rationale (§23/§43): supported appears; unsupported suppressed; never outreach. ──
t("contact rationale present when substance exists (B)", buildContactRationale(B) !== null);
t("contact rationale suppressed for no-substance account (E)", buildContactRationale(E) === null);
const crText = JSON.stringify(ALL.map(buildContactRationale)).toLowerCase();
t("contact rationale is not outreach (no email/script/sequence/subject)", !/(email|script|sequence|subject line|cold call|template)/i.test(crText));
t("contact rationale carries validateFirst from decision-critical validation (B)", buildContactRationale(B)!.validateFirst === "Confirm central procurement");

// ── Advanced Portfolio Synthesis (§17): only supportable dimensions; contradictions; portfolio ≠ market. ──
const syn = buildAdvancedSynthesis(ALL);
t("synthesis: correct decision distribution", syn.decisionDistribution.prioritize === 1 && syn.decisionDistribution.validate === 2 && syn.decisionDistribution.monitor === 2 && syn.decisionDistribution.hold === 1);
t("synthesis: only clusters with >=2 members (validate cluster + Logistics + Healthcare)", syn.clusters.every((c) => c.accountIds.length >= 2) && syn.clusters.some((c) => c.kind === "decision" && c.key === "validate") && syn.clusters.some((c) => c.kind === "segment"));
t("synthesis: detects strong-fit/thin-evidence contradiction (C)", syn.contradictions.some((x) => x.accountId === "c"));
t("synthesis: validation bottlenecks list decision-critical items (B,F)", syn.validationBottlenecks.some((x) => x.accountId === "b") && syn.validationBottlenecks.some((x) => x.accountId === "f"));
t("synthesis: timing pattern counted", syn.timingPattern !== null && syn.timingPattern.supported === 2);
t("synthesis: portfolio ≠ market note present", /not the whole market/i.test(syn.scopeNote));

// ── Premium Executive Portfolio (§31): composition. ──
const ep = buildPremiumExecutivePortfolio(ALL);
t("exec: priority map ordered by decision weight (prioritize A first)", ep.priorityMap[0].accountId === "a");
t("exec: top opportunities = prioritize+validate", ep.topOpportunities.sort().join() === "a,b,c");
t("exec: references the selected decision-critical briefs", ep.decisionCriticalBriefRefs.sort().join() === "a,b,c,f");
t("exec: aggregates key uncertainties + validation priorities", ep.keyUncertainties.length > 0 && ep.validationPriorities.length > 0);

// ── Fail-closed on empty portfolio (no crash, no fabricated objects). ──
t("empty: no briefs", selectDecisionCriticalBriefs([]).length === 0);
const es = buildAdvancedSynthesis([]);
t("empty: synthesis total 0, no clusters, null timing", es.total === 0 && es.clusters.length === 0 && es.timingPattern === null);
t("empty: exec portfolio total 0", buildPremiumExecutivePortfolio([]).total === 0);

// ── Differentiation: the Premium layer exposes decision structure a flat account list does not. ──
t("differentiation: Premium layer adds briefs + pathways + clusters beyond raw accounts", briefs.length > 0 && ep.decisionCriticalBriefRefs.length > 0 && syn.clusters.length > 0 && buildDecisionPathway(B).state === "OPEN");

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
