// Customer Deliverables V1 — four-tier GOLDEN DIFFERENTIATION + Signature LeadLens (deterministic).
// Proves the one-time ladder (Preview→Brief→Portfolio→Premium) is materially differentiated by
// COMPOSITION and decision utility — not merely account count — and that every tier expresses the
// recurring LeadLens signature (Decision + Fit/Timing/Evidence + evidence + a next step to validate).
// Lower tiers are "small but complete", never crippled. No network.

import type { DeliverableViewModel, AccountBriefVM, DecisionState, Strength } from "../../lib/deliverable/deliverable-view-model";
import {
  fromDeliverableViewModel, composeForTier, TIER_COMPOSITION, toPresentationModel, renderPdfHtml,
  tierOffersChannel, type DeliveryTier,
} from "../../lib/delivery-system";
import { assemblePremiumContext } from "../../lib/intelligence/premium/premium-context";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

const DEC: DecisionState[] = ["prioritize", "validate", "monitor", "hold"];
const STR: Strength[] = ["Strong", "Moderate", "Limited"];
function acc(i: number): AccountBriefVM {
  const id = String(i + 1); const decision = DEC[i % 4]; const strong = decision === "prioritize";
  return {
    id, rank: i + 1, company: `Co ${id}`, segment: ["Logistics", "Healthcare", "Manufacturing"][i % 3], geography: "US",
    domain: `c${id}.com`, accountRole: null, opportunityType: null, decision, decisionNote: `why ${id}`,
    thesis: `thesis ${id}`, whyItMatters: `matters ${id}`,
    dimensions: [{ label: "Fit", value: STR[i % 3] }, { label: "Timing", value: STR[(i + 1) % 3] }, { label: "Evidence", value: STR[(i + 2) % 3] }],
    whatChanged: strong ? [{ event: `change ${id}`, date: "2026-08-05", age: "9d", source: "news", kind: "recent_event" as const }] : [],
    evidence: { sourceCount: 3, datedCount: 2, corroborated: strong, latestAge: "9d", strength: STR[(i + 2) % 3] },
    sources: [{ label: "Src A", url: "https://a.co", date: "2026-08-05", age: "9d", relation: "direct", claim: "x" }, { label: "Src B", url: "https://b.co", date: "2026-07-01", age: "60d", relation: "corroborating", claim: "y" }, { label: "Src C", url: "https://c.co", date: null, age: null, relation: "context", claim: "z" }],
    counterSignals: decision === "validate" ? [`counter ${id}`] : [], limitations: strong ? [] : [`limit ${id}`],
    validations: decision === "hold" ? [] : [`validate ${id}`],
    validationDetails: decision === "validate" ? [{ question: `q ${id}`, decisionCritical: true, howToValidate: "call", changesDecisionBecause: "x" }] : undefined,
    nextStep: strong ? `next ${id}` : null, revisitWhen: null, monitorIdentity: null, freshness: null, confidence: "Moderate",
  };
}
const accounts = Array.from({ length: 18 }, (_, i) => acc(i));
const counts = { prioritize: 0, validate: 0, monitor: 0, hold: 0 } as Record<DecisionState, number>;
for (const a of accounts) counts[a.decision]++;
const vm: DeliverableViewModel = {
  meta: { client: "Acme", market: "US", generatedAt: "2026-09-01T00:00:00Z", generatedLabel: "Sep 1", tierLabel: "", language: "en", schemaVersion: 1 },
  headline: "Where to focus", summary: "Evaluated set.",
  portfolio: { total: 18, counts, allocation: { line: "Focus first", detail: "on prioritize" }, funnel: { considered: 40, rejected: 22, selected: 18 }, note: "Observed within this researched portfolio." },
  accounts,
  commercialContext: { objective: "find operators", clientDescription: "we consult", summary: "ICP", regions: ["US"], industries: ["Logistics"], criteria: ["change"] },
  validationQueue: accounts.filter((a) => a.validations.length).slice(0, 8).map((a) => ({ accountId: a.id, company: a.company, decision: a.decision, items: a.validations })),
  coverage: { withDatedEvidence: 12, withSources: 18, corroborated: 9, grade: "Moderate", note: "ok" },
  methodology: ["Fit/Timing/Evidence", "caseDecision authority"], limitations: ["public evidence only"],
  downloads: { pdf: true, portfolioCsv: true, evidenceCsv: true },
  capabilities: { showPortfolioTab: true, showCompareTab: true, showEvidenceTab: true, showDownloadsTab: true, showMethodology: true },
};
const ctx = assemblePremiumContext({ benchmark: { recurringNeeds: [{ statement: "recurring need", basis: "signal", confidence: "Moderate", stale: false, evidence: [{ sourceId: "s", url: "https://x.co/r", observedDate: "2026-08-01", claim: "c" }] }] } });
const baseDoc = fromDeliverableViewModel(vm);
const docFor = (tier: DeliveryTier) => tier === "premium" ? { ...baseDoc, premiumContext: ctx } : baseDoc;
const composed = (tier: DeliveryTier) => composeForTier(docFor(tier), tier);
const pdf = (tier: DeliveryTier) => renderPdfHtml(toPresentationModel(docFor(tier), tier, "pdf"));

const preview = composed("preview"), brief = composed("brief"), portfolio = composed("intelligence"), premium = composed("premium");

// ── SIGNATURE LEADLENS: every tier expresses the recurring decision pattern per account. ──
for (const [name, c] of [["preview", preview], ["brief", brief], ["portfolio", portfolio], ["premium", premium]] as const) {
  const a = c.accounts[0];
  t(`signature/${name}: account carries a Decision`, ["prioritize", "validate", "monitor", "hold"].includes(a.decision));
  t(`signature/${name}: account carries Fit/Timing/Evidence`, a.dimensions.length === 3 && a.dimensions.some((d) => d.label === "Fit") && a.dimensions.some((d) => d.label === "Timing") && a.dimensions.some((d) => d.label === "Evidence"));
  t(`signature/${name}: account carries an evidence summary`, a.evidence != null && typeof a.evidence.sourceCount === "number");
  t(`signature/${name}: account carries a "why" (decisionNote)`, !!a.decisionNote);
}
// Every tier PDF renders the recurring signature markers.
for (const tier of ["preview", "brief", "intelligence", "premium"] as DeliveryTier[]) {
  const h = pdf(tier);
  t(`signature-pdf/${tier}: shows Why + Fit + Evidence`, /Why:/.test(h) && /Fit:/.test(h) && /Evidence:/.test(h));
}

// ── PREVIEW: small but complete — NOT a crippled Brief. ──
t("preview: bounded validation + uncertainty present (small but complete)", preview.accounts[0].validations.length >= 1 && preview.accounts.some((a) => a.counterSignals.length + a.limitations.length >= 1));
t("preview: NOT the full narrative (thesis reserved for Brief+)", preview.accounts.every((a) => a.thesis === null));
t("preview: no portfolio-heavy sections (context/coverage/methodology/premium)", preview.commercialContext === null && preview.coverage === null && preview.methodology.length === 0 && preview.premium == null);

// ── GOLDEN: PREVIEW → BRIEF (adds commercial context, full account narrative, validation queue, coverage). ──
t("P→B: Brief adds commercial context Preview lacks", preview.commercialContext === null && brief.commercialContext !== null);
t("P→B: Brief adds the full account narrative (thesis)", preview.accounts[0].thesis === null && brief.accounts[0].thesis !== null);
t("P→B: Brief adds a validation queue + coverage", brief.validationQueue.length > 0 && preview.validationQueue.length === 0 && brief.coverage !== null && preview.coverage === null);
t("P→B: Brief PDF strictly richer than Preview PDF", pdf("brief").length > pdf("preview").length);

// ── GOLDEN: BRIEF → PORTFOLIO (adds allocation, comparison, methodology, portfolio narrative, CSV). ──
t("B→P: Portfolio adds allocation (where effort goes)", brief.portfolioSynthesis.allocation === null && portfolio.portfolioSynthesis.allocation !== null);
t("B→P: Portfolio adds Compare + Methodology", TIER_COMPOSITION.brief.sections.compare === false && TIER_COMPOSITION.intelligence.sections.compare === true && brief.methodology.length === 0 && portfolio.methodology.length > 0);
t("B→P: Portfolio adds CSV export (Brief has none)", !tierOffersChannel("brief", "csv") && tierOffersChannel("intelligence", "csv"));
t("B→P: Portfolio keeps full account depth (validationDetails)", brief.accounts[0].validationDetails === undefined && portfolio.accounts.some((a) => a.validationDetails !== undefined));

// ── GOLDEN: PORTFOLIO → PREMIUM (adds the decision-context architecture; both keep CSV). ──
t("Po→Pr: Premium adds the decision-architecture section Portfolio lacks", portfolio.premium == null && premium.premium != null && premium.premium!.executivePortfolio.total > 0);
t("Po→Pr: Premium adds decision-critical briefs + benchmark context", (premium.premium!.decisionCriticalBriefs.length > 0) && premium.premium!.executivePortfolio.context?.benchmark.state === "PRESENT");
t("Po→Pr: Premium PDF adds the architecture markers Portfolio PDF lacks", /Executive decision architecture/.test(pdf("premium")) && !/Executive decision architecture/.test(pdf("intelligence")));
t("Po→Pr: both offer CSV (Premium does not lose Portfolio's export)", tierOffersChannel("intelligence", "csv") && tierOffersChannel("premium", "csv"));

// ── Non-cannibalization: each higher tier is a strict superset of the lower's customer sections. ──
t("ladder: Portfolio keeps everything Brief shows (context+validation+coverage)", portfolio.commercialContext !== null && portfolio.validationQueue.length > 0 && portfolio.coverage !== null);
t("ladder: Premium keeps everything Portfolio shows (allocation+methodology+full depth)", premium.portfolioSynthesis.allocation !== null && premium.methodology.length > 0 && premium.accounts.some((a) => a.validationDetails !== undefined));
t("ladder: strictly increasing PDF richness preview<brief<portfolio<premium", pdf("preview").length < pdf("brief").length && pdf("brief").length < pdf("intelligence").length && pdf("intelligence").length < pdf("premium").length);

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
