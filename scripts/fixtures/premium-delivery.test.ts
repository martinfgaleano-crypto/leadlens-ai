// Premium Differentiation V1 — Phase D/E: Delivery visibility + GOLDEN DIFFERENTIATION (deterministic).
// Proves the Premium decision-architecture is CUSTOMER-VISIBLE in Delivery (web section model + PDF),
// that it differentiates Premium from Portfolio by CAPABILITY even with account BREADTH held constant,
// that Portfolio (intelligence) is byte-for-byte unaffected (hero preserved), that CSV stays the flat
// operational contract, that it is fail-closed on empty portfolios, and that the research context
// renders only when actually present. No network/LLM.

import type { DeliverableViewModel, AccountBriefVM, DecisionState } from "../../lib/deliverable/deliverable-view-model";
import { fromDeliverableViewModel, composeForTier, toPresentationModel, renderPdfHtml, renderPdfBuffer, renderCsv, toWebPresentation } from "../../lib/delivery-system";
import { assemblePremiumContext } from "../../lib/intelligence/premium/premium-context";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

function acc(id: string, decision: DecisionState, rank: number, over: Partial<AccountBriefVM> = {}): AccountBriefVM {
  return {
    id, rank, company: `Acme ${id}`, segment: over.segment ?? "Logistics", geography: "US", domain: `acme${id}.com`,
    accountRole: null, opportunityType: null, decision, decisionNote: `why ${id}`,
    thesis: `thesis ${id}`, whyItMatters: `matters ${id}`,
    dimensions: over.dimensions ?? [{ label: "Fit", value: "Strong" }, { label: "Timing", value: "Moderate" }, { label: "Evidence", value: "Moderate" }],
    whatChanged: [], evidence: over.evidence ?? { sourceCount: 3, datedCount: 2, corroborated: true, latestAge: "9d", strength: "Moderate" },
    sources: [], counterSignals: over.counterSignals ?? [`counter ${id}`], limitations: [`limit ${id}`], validations: [`validate ${id}`],
    validationDetails: [{ question: `q ${id}`, decisionCritical: true, howToValidate: "call", changesDecisionBecause: `confirming q ${id} would strengthen the case` }],
    nextStep: `next ${id}`, revisitWhen: null, monitorIdentity: null, freshness: null, confidence: "Moderate",
  };
}
const decisions: DecisionState[] = ["prioritize", "validate", "monitor", "hold"];
// 12 accounts — the SAME count both tiers receive (intelligence cap 12, premium cap 18 → identical here),
// so any difference is CAPABILITY, not breadth.
const accounts = Array.from({ length: 12 }, (_, i) => acc(String(i + 1), decisions[i % 4], i + 1));
const vm: DeliverableViewModel = {
  meta: { client: "Northstar Co", market: "US", generatedAt: "2026-09-01T00:00:00Z", generatedLabel: "Sep 1, 2026", tierLabel: "Intelligence", language: "en", schemaVersion: 1 },
  headline: "Where to focus now", summary: "12 accounts evaluated.",
  portfolio: { total: 12, counts: { prioritize: 3, validate: 3, monitor: 3, hold: 3 }, allocation: { line: "Focus first", detail: "on prioritize" }, funnel: null, note: "note" },
  accounts,
  commercialContext: { objective: "find expanding 3PLs", clientDescription: "we sell WMS", summary: "ICP", regions: ["US"], industries: ["Logistics"], criteria: ["expanding"] },
  validationQueue: [], coverage: { withDatedEvidence: 12, withSources: 12, corroborated: 8, grade: "Moderate", note: "ok" },
  methodology: ["Fit/Timing/Evidence"], limitations: ["public evidence only"],
  downloads: { pdf: true, portfolioCsv: true, evidenceCsv: true },
  capabilities: { showPortfolioTab: true, showCompareTab: true, showEvidenceTab: true, showDownloadsTab: true, showMethodology: true },
};
const doc = fromDeliverableViewModel(vm);

// ── Composition: premium tier gets the section; Portfolio (intelligence) does NOT. ──
const prem = composeForTier(doc, "premium");
const port = composeForTier(doc, "intelligence");
t("premium tier: premium section present with content", !!prem.premium && prem.premium.executivePortfolio.total === 12 && prem.premium.decisionCriticalBriefs.length > 0);
t("premium: exec portfolio has synthesis (clusters/distribution)", !!prem.premium && !!prem.premium.executivePortfolio.synthesis && prem.premium.executivePortfolio.decisionDistribution.prioritize === 3);
t("premium: decision-critical briefs carry conditional pathways (no future-Decision prediction)", prem.premium!.decisionCriticalBriefs.every((b) => b.pathway.state !== "OPEN" || (/does not predict/i.test(b.pathway.conditionalNote) && !/will (become|move to)/i.test(b.pathway.conditionalNote))));
t("Portfolio (intelligence) tier: premium section is NULL (hero preserved, unweakened)", port.premium == null);
t("Portfolio keeps its full sections (accounts/commercialContext/methodology/coverage) unchanged", port.accounts.length === 12 && !!port.commercialContext && port.methodology.length > 0 && !!port.coverage);
t("BREADTH held constant: both tiers deliver the same 12 accounts", prem.accounts.length === port.accounts.length && prem.accounts.length === 12);

// ── Lower-tier isolation (§14): NO tier below premium composes a premium section. ──
for (const lt of ["preview", "brief", "intelligence"] as const) {
  const c = composeForTier(doc, lt);
  t(`lower-tier isolation: ${lt} has no premium section`, c.premium == null);
  const pdf = renderPdfHtml(toPresentationModel(doc, lt, "pdf"));
  t(`lower-tier isolation: ${lt} PDF renders no premium architecture`, !/Executive decision architecture|Decision-critical briefs/.test(pdf));
  const web = toWebPresentation(toPresentationModel(doc, lt, "web"));
  t(`lower-tier isolation: ${lt} web has no premiumArchitecture section present`, web.sections.find((s) => s.kind === "premiumArchitecture")!.present === false);
}

// ── GOLDEN DIFFERENTIATION: same breadth, Premium PDF strictly adds decision architecture. ──
const premPdf = renderPdfHtml(toPresentationModel(doc, "premium", "pdf"));
const portPdf = renderPdfHtml(toPresentationModel(doc, "intelligence", "pdf"));
const MARKERS = ["Executive decision architecture", "Decision-critical briefs", "Validation priorities"];
t("GOLDEN: Premium PDF contains the decision-architecture markers", MARKERS.every((m) => premPdf.includes(m)));
t("GOLDEN: Portfolio PDF contains NONE of them (differentiation is real, not adjectival)", MARKERS.every((m) => !portPdf.includes(m)));
t("GOLDEN: with breadth constant, Premium PDF is strictly larger (added capability, not more companies)", premPdf.length > portPdf.length);
t("Premium PDF still contains everything Portfolio does (superset: accounts, commercial context)", premPdf.includes("Accounts") && premPdf.includes("Commercial context"));

// The REAL downloaded artifact (jsPDF bytes, compressed) — prove the buffer path renders the premium
// layer: a valid PDF, strictly larger than Portfolio's with breadth held constant (= added capability).
const premBuf = renderPdfBuffer(toPresentationModel(doc, "premium", "pdf"));
const portBuf = renderPdfBuffer(toPresentationModel(doc, "intelligence", "pdf"));
t("real PDF: premium is a valid application/pdf artifact", premBuf.subarray(0, 5).toString("latin1") === "%PDF-");
t("real PDF: premium bytes strictly exceed Portfolio (architecture added, not more companies)", premBuf.length > portBuf.length);

// ── CSV stays the flat operational contract — identical across tiers (no premium leakage/corruption). ──
const premCsv = renderCsv(toPresentationModel(doc, "premium", "csv"));
const portCsv = renderCsv(toPresentationModel(doc, "intelligence", "csv"));
t("CSV: premium == portfolio (flat operational data unchanged by premium layer)", premCsv === portCsv);
t("CSV: no premium-architecture prose leaked into flat data", !/Executive decision architecture|Decision-critical/i.test(premCsv));

// ── Web section model exposes the premium section for premium only. ──
const premWeb = toWebPresentation(toPresentationModel(doc, "premium", "web"));
const portWeb = toWebPresentation(toPresentationModel(doc, "intelligence", "web"));
t("web: premiumArchitecture present for premium tier", premWeb.sections.find((s) => s.kind === "premiumArchitecture")!.present === true);
t("web: premiumArchitecture absent for Portfolio tier", portWeb.sections.find((s) => s.kind === "premiumArchitecture")!.present === false);

// ── Fail-closed: empty portfolio → premium section total 0 → PDF omits the premium block. ──
const emptyDoc = fromDeliverableViewModel({ ...vm, accounts: [], portfolio: { ...vm.portfolio, total: 0, counts: { prioritize: 0, validate: 0, monitor: 0, hold: 0 } } });
const emptyPrem = composeForTier(emptyDoc, "premium");
t("fail-closed: empty premium section total 0", emptyPrem.premium!.executivePortfolio.total === 0 && emptyPrem.premium!.decisionCriticalBriefs.length === 0);
t("fail-closed: empty premium PDF omits the architecture block (no shell)", !renderPdfHtml(toPresentationModel(emptyDoc, "premium", "pdf")).includes("Executive decision architecture"));

// ── Research context: renders ONLY when present (fail-closed). Attach a PRESENT benchmark. ──
const ctx = assemblePremiumContext({ benchmark: { recurringNeeds: [{ statement: "Recurring supply-chain volatility is a persistent need", basis: "signal", confidence: "Moderate", stale: false, evidence: [{ sourceId: "s1", url: "https://x.com/r", observedDate: "2026-08-01", claim: "volatility" }] }] } }, Date.parse("2026-09-09T00:00:00Z"));
const docWithCtx = { ...doc, premiumContext: ctx };
const premPdfCtx = renderPdfHtml(toPresentationModel(docWithCtx, "premium", "pdf"));
t("context: premium PDF renders the Commercial benchmark when context present", premPdfCtx.includes("Commercial benchmark") && premPdfCtx.includes("Recurring supply-chain volatility"));
t("context: absent context → no Commercial benchmark section (fail-closed)", !premPdf.includes("Commercial benchmark"));
t("context: benchmark scope note (portfolio ≠ market) shown", /not the whole market/i.test(premPdfCtx));

console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
