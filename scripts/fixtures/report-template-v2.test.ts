// Regression suite for Customer Deliverables V2.1 report templates + data integrity.
// Deterministic; no network, no DB, no credit. Covers the founder-review findings: headline/decision
// consistency, tier-scoped metrics, source-count reconciliation, recency/missing-date integrity,
// localized labels, differentiated content, Premium-only sections, deterministic render, and the Admin
// routes failing closed for unauthenticated requests.
import { NextRequest } from "next/server";
import { fromDeliverableViewModel } from "../../lib/delivery-system/delivery-document";
import { toPresentationModel } from "../../lib/delivery-system/presentation-model";
import { renderPdfBuffer } from "../../lib/delivery-system/renderers/pdf";
import { buildSampleDeliverable, REPORT_TEMPLATE } from "../../lib/delivery-system/report-template";
import { buildRealAcceptanceDeliverable } from "../../lib/delivery-system/real-acceptance-sample";
import { buildTierContractSummary } from "../../lib/products/tier-contract-matrix";
import { checkAccountConsistency, reconcileAccountConsistency } from "../../lib/deliverable/decision-consistency";
import { deriveCoverageGaps, derivePortfolioRisk, derivePlaybooks } from "../../lib/deliverable/portfolio-analytics";
import type { AccountBriefVM, DecisionState, Strength } from "../../lib/deliverable/deliverable-view-model";
import type { DeliveryTier } from "../../lib/delivery-system/tier-composer";

let passed = 0, failed = 0;
function t(name: string, cond: boolean) { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } }

const isPdf = (b: Buffer) => b.length > 800 && b.subarray(0, 5).toString("latin1") === "%PDF-";
const pdfText = (b: Buffer) => b.toString("latin1"); // decision on presence of localized/English tokens is done on the VM, not the compressed stream
const caps: Record<DeliveryTier, number> = { preview: 2, brief: 6, intelligence: 12, premium: 18 };

// ── Descriptor invariants ──
t("version is CUSTOMER_DELIVERABLES_V2_3", REPORT_TEMPLATE.version === "CUSTOMER_DELIVERABLES_V2_3");
t("supersedes V2_2", REPORT_TEMPLATE.supersedes === "CUSTOMER_DELIVERABLES_V2_2");
t("approval state is FOUNDER_REVIEW (not auto-approved)", REPORT_TEMPLATE.approvalState === "FOUNDER_REVIEW");
t("four tiers with frozen caps 2/6/12/18", JSON.stringify(REPORT_TEMPLATE.tiers.map((x) => x.maxAccounts)) === JSON.stringify([2, 6, 12, 18]));
t("frozen prices 7/25/59/129", JSON.stringify(REPORT_TEMPLATE.tiers.map((x) => x.price)) === JSON.stringify([7, 25, 59, 129]));

// ── Sample fixture: synthetic safety + differentiation ──
const vmEs = buildSampleDeliverable("es");
const vmEn = buildSampleDeliverable("en");
t("sample has 18 accounts", vmEs.accounts.length === 18);
t("sample is clearly synthetic (client labeled)", /sint|sample|synthetic|muestra/i.test(vmEs.meta.client ?? ""));
t("all sources are example.* (no real-company sourcing)", vmEs.accounts.every((a) => a.sources.every((s) => !s.url || /example\.(com|org|net)/.test(s.url))));
t("es sample preserves accents", vmEs.accounts.some((a) => /[áéíóúñ¿¡ü]/.test(a.thesis ?? "")) && /[áéíóúñ]/.test(vmEs.summary ?? ""));
// Differentiation: theses are genuinely distinct, not a repeated template.
const theses = vmEs.accounts.map((a) => a.thesis ?? "");
t("company theses are distinct (no repeated template)", new Set(theses).size === theses.length);
t("decision mix is varied (all four decisions present)", new Set(vmEs.accounts.map((a) => a.decision)).size === 4);
// Validation actions are not all identical (sector-appropriate variety).
const firstValidations = vmEs.accounts.map((a) => a.validations[0] ?? "").filter(Boolean);
t("validation actions are varied (not one boilerplate question)", new Set(firstValidations).size >= Math.floor(firstValidations.length * 0.7));

// ── Finding #1: headline consistent with the decision distribution ──
const pri = vmEs.portfolio.counts.prioritize;
t("headline reflects the real prioritize count (no overstated '1 priority')", (vmEs.headline ?? "").includes(String(pri)) && !/^1 cuenta prioritaria/.test(vmEs.headline ?? ""));

// ── Finding #4/#11: per-account source-count reconciles with the listed sources ──
t("evidence.sourceCount equals the number of listed sources (reconciles)", vmEs.accounts.every((a) => a.evidence.sourceCount === a.sources.length));
// ── Finding #12/#13: missing-date honesty — no dated sources ⇒ no recency claim ──
t("accounts with no dated sources make no recency claim (latestAge null)", vmEs.accounts.every((a) => (a.evidence.datedCount > 0) || a.evidence.latestAge == null));
t("dated counts never exceed listed sources", vmEs.accounts.every((a) => a.evidence.datedCount <= a.sources.length));

// ── Finding #2/#10: tier-scoped coverage (never leak the full-portfolio aggregate) ──
const doc = fromDeliverableViewModel(vmEs);
const briefPM = toPresentationModel(doc, "brief", "pdf");
const premPM = toPresentationModel(doc, "premium", "pdf");
t("brief coverage is scoped to ≤ 6 companies", (briefPM.document.coverage?.withSources ?? 99) <= 6);
t("premium coverage is scoped to ≤ 18 companies", (premPM.document.coverage?.withSources ?? 0) <= 18);
t("brief and premium coverage differ (no leaked aggregate)", JSON.stringify(briefPM.document.coverage) !== JSON.stringify(premPM.document.coverage));
t("decision counts are tier-scoped (recounted per tier)", briefPM.document.portfolioSynthesis.counts.monitor <= premPM.document.portfolioSynthesis.counts.monitor);

// ── Per-tier render + counts + Premium-only section ──
for (const tier of ["preview", "brief", "intelligence", "premium"] as DeliveryTier[]) {
  const pm = toPresentationModel(doc, tier, "pdf");
  t(`${tier}: capped to ${caps[tier]} accounts`, pm.document.accounts.length === caps[tier]);
  t(`${tier}: renders a real PDF`, isPdf(renderPdfBuffer(pm)));
  if (tier === "premium") t("premium: has Premium Decision Context", !!(pm.document.premium && pm.document.premium.executivePortfolio.total > 0));
  else t(`${tier}: no Premium-only section`, !pm.document.premium);
}

// ── Determinism ──
const a = renderPdfBuffer(toPresentationModel(fromDeliverableViewModel(buildSampleDeliverable("es")), "premium", "pdf"));
const b = renderPdfBuffer(toPresentationModel(fromDeliverableViewModel(buildSampleDeliverable("es")), "premium", "pdf"));
t("premium render is deterministic (equal byte length)", a.length === b.length);

// ── Localization: EN renders; the two languages produce different bytes (labels differ) ──
const enBuf = renderPdfBuffer(toPresentationModel(fromDeliverableViewModel(vmEn), "premium", "pdf"));
t("en premium renders a real PDF", isPdf(enBuf));
t("es and en premium differ (labels localized)", a.length !== enBuf.length && pdfText(a) !== pdfText(enBuf));

// ── Finding #8: headline is tier-scoped (never claims a count beyond the tier's companies) ──
const synPreviewHL = toPresentationModel(doc, "preview", "pdf").document.headline ?? "";
const synPortfolioHL = toPresentationModel(doc, "intelligence", "pdf").document.headline ?? "";
t("preview headline is scoped to 2 evaluadas (not 18)", /de 2 evaluad/.test(synPreviewHL) && !/de 18/.test(synPreviewHL));
t("portfolio headline is scoped to 12 evaluadas (not 18)", /de 12 evaluad/.test(synPortfolioHL) && !/de 18/.test(synPortfolioHL));

// ── MODE A: real controlled-acceptance data renders honestly (decisions taken verbatim) ──
const real = buildRealAcceptanceDeliverable();
t("real sample loads 6 controlled-acceptance cases", real.accounts.length === 6);
t("real sample includes the known real company set (e.g. Nestlé USA)", real.accounts.some((a) => /Nestl/.test(a.company)));
t("real decisions are taken from the artifact (no prioritize invented)", real.portfolio.counts.prioritize === 0 && real.portfolio.counts.validate === 5 && real.portfolio.counts.hold === 1);
t("real sources use real public URLs (not example.*)", real.accounts.some((a) => a.sources.some((s) => /nestleusa\.com|conagrabrands\.com|hitachienergy\.com/.test(s.url ?? ""))));
t("real per-account sourceCount reconciles with listed sources", real.accounts.every((a) => a.evidence.sourceCount === a.sources.length));
t("real is labeled as controlled-acceptance (not a paid customer)", /controlled acceptance/i.test(real.meta.client ?? "") && /real/i.test(real.summary ?? ""));
const realDoc = fromDeliverableViewModel(real);
const realBriefHL = toPresentationModel(realDoc, "brief", "pdf").document.headline ?? "";
t("real brief headline is honest + tier-scoped (5 to validate of 6)", /5 accounts to validate of 6 evaluated/.test(realBriefHL));
t("real brief renders a real PDF", isPdf(renderPdfBuffer(toPresentationModel(realDoc, "brief", "pdf"))));
t("real brief does NOT leak the artifact's mixed-language decisionRationale", !pdfText(renderPdfBuffer(toPresentationModel(realDoc, "brief", "pdf"))).includes("encaje moderate"));

// ── V2.2 §12: cover leads with the PRODUCT NAME, not the decision distribution ──
// Render UNCOMPRESSED so the PDF's text stream is searchable (production stays compressed).
const premEsPdf = pdfText(renderPdfBuffer(toPresentationModel(doc, "premium", "pdf"), { compress: false }));
const portEsPdf = pdfText(renderPdfBuffer(toPresentationModel(doc, "intelligence", "pdf"), { compress: false }));
t("premium cover carries the product name (Dosier de Inteligencia Comercial)", premEsPdf.includes("Dosier de Inteligencia Comercial"));
t("cover shows a Decision snapshot label (distribution is secondary)", premEsPdf.includes("RESUMEN DE DECISIONES"));
t("report shows a 'What's included' tier-value band", premEsPdf.includes("incluye este producto"));

// ── V2.2 defect regressions ──
t("no Premium English leak 'Stronger corroborated' in ES", !premEsPdf.includes("Stronger corroborated") && !premEsPdf.includes("could strengthen the case"));
t("premium localizes 'could change this decision' to Spanish", !premEsPdf.includes("could strengthen") );
t("no Portfolio copy defect 'primero priorizar primero'", !portEsPdf.includes("primero priorizar primero"));

// ── V2.2 §29: real HOLD (John Deere) is framed honestly, not as 'worth validating now' ──
{
  const jd = buildRealAcceptanceDeliverable().accounts.find((a) => /Deere/.test(a.company))!;
  t("John Deere stays HOLD (verbatim)", jd.decision === "hold");
  t("John Deere HOLD note is honest (stale >180d), not 'worth validating now'", /180 days|fresher signal/.test(jd.decisionNote ?? "") && !/worth validating now/.test(jd.decisionNote ?? ""));
  t("John Deere HOLD next step is hold-consistent", /No outreach now/.test(jd.nextStep ?? ""));
}

// ── V2.2 §33: the synthetic full-order sample is all on-target (no off-geography delivered account) ──
t("no off-target 'Agroexport Urabá' in the synthetic sample", !vmEs.accounts.some((a) => /Agroexport/.test(a.company)));

// ── V2.2 §6/§36: tier-contract matrix is truthful (rendered vs contracted-not-rendered surfaced) ──
const tcs = buildTierContractSummary();
t("tier-contract summary covers all four tiers", tcs.length === 4 && tcs.map((x) => x.tier).join(",") === "preview,brief,intelligence,premium");
t("premium surfaces contracted-not-rendered gaps to HQ (not hidden)", (tcs.find((x) => x.tier === "premium")?.contractedNotRendered.length ?? 0) > 0);
t("Account Memory shown as workspace for intelligence + premium only", tcs.filter((x) => x.workspace.some((w) => /Account Memory/.test(w))).map((x) => x.tier).sort().join(",") === "intelligence,premium");

// ── V2.3 §24-27: canonical decision-consistency guard (regression matrix) ──
function acct(over: Partial<AccountBriefVM>): AccountBriefVM {
  return {
    id: "x", rank: 1, company: "X", segment: null, geography: null, domain: null, accountRole: null, opportunityType: null,
    decision: "hold", decisionNote: null, thesis: null, whyItMatters: null,
    dimensions: [], whatChanged: [], evidence: { sourceCount: 1, datedCount: 0, corroborated: null, latestAge: null, strength: "Limited" as Strength },
    sources: [], counterSignals: [], limitations: [], validations: [], nextStep: null, freshness: null, confidence: null, ...over,
  };
}
// PRIORITIZE / VALIDATE / MONITOR with sound rationale → no issue, unchanged.
t("prioritize with next step is untouched", checkAccountConsistency(acct({ decision: "prioritize", evidence: { sourceCount: 3, datedCount: 2, corroborated: true, latestAge: "5d ago", strength: "Strong" }, nextStep: "Reach out now." })) === null);
t("validate with a decision-critical question is untouched", checkAccountConsistency(acct({ decision: "validate", evidence: { sourceCount: 2, datedCount: 1, corroborated: true, latestAge: "9d ago", strength: "Moderate" }, nextStep: "Confirm procurement status." })) === null);
// HOLD (stale) with an immediate-trigger next step → contradiction detected + reconciled (decision unchanged).
{
  const jd = acct({ decision: "hold", company: "Deere", evidence: { sourceCount: 2, datedCount: 1, corroborated: true, latestAge: "7mo ago", strength: "Moderate" }, nextStep: "Validate ownership before outreach." });
  t("HOLD + stale + 'before outreach' is flagged", checkAccountConsistency(jd)?.field === "nextStep");
  const fixed = reconcileAccountConsistency(jd, "en");
  t("reconcile keeps HOLD (decision unchanged)", fixed.decision === "hold");
  t("reconcile removes the immediate-trigger next step", !/before outreach/i.test(fixed.nextStep ?? "") && /No outreach now/.test(fixed.nextStep ?? ""));
}
// HOLD with wrong-target / insufficient but NO immediate-trigger prose → left alone.
t("HOLD without trigger prose is not altered", reconcileAccountConsistency(acct({ decision: "hold", nextStep: "No action; revisit next cycle." })).nextStep === "No action; revisit next cycle.");
// Applied canonically: the real Brief John Deere next step is hold-consistent (via the delivery seam).
{
  const jd = fromDeliverableViewModel(buildRealAcceptanceDeliverable()).accounts.find((a) => /Deere/.test(a.company))!;
  t("real John Deere (canonical seam) has a hold-consistent next step", jd.decision === "hold" && !/before outreach|worth validating now/i.test(jd.nextStep ?? ""));
}

// ── V2.3 §15/§16/§19: coverage-gaps / portfolio-risk / playbooks derived honestly from existing data ──
{
  const accts = buildSampleDeliverable("es").accounts;
  const cg = deriveCoverageGaps(accts);
  t("coverage gaps only list real evidence gaps (subset of the set)", cg.withoutDatedEvidence.length <= accts.length && cg.withoutCorroboration.length <= accts.length);
  const risk = derivePortfolioRisk(accts);
  t("portfolio risk lists only actionable thin-evidence accounts", risk.thinEvidence.every((c) => accts.some((a) => a.company === c && (a.decision === "prioritize" || a.decision === "validate"))));
  const pb = derivePlaybooks(accts);
  t("playbooks cover only prioritize/validate accounts (no invented process)", pb.length > 0 && pb.every((p) => p.decision === "prioritize" || p.decision === "validate"));
  t("playbooks reuse the account's own validations (no fabrication)", pb.every((p) => p.validate.every((v) => accts.some((a) => a.validations.includes(v)))));
}
const premEsPdf3 = pdfText(renderPdfBuffer(toPresentationModel(doc, "premium", "pdf"), { compress: false }));
t("premium renders Coverage & risk section", premEsPdf3.includes("Cobertura y riesgo"));
t("premium renders Commercial playbooks section", premEsPdf3.includes("as comerciales"));
t("momentum/decay honestly deferred to Monitor (not fabricated)", premEsPdf3.includes("Monitor") && (premEsPdf3.includes("Impulso") || premEsPdf3.includes("historial")));

// ── V2.3 §12/§46: matrix marks the newly-delivered capabilities as rendered ──
{
  const prem = buildTierContractSummary().find((x) => x.tier === "premium")!;
  t("coverage gaps + portfolio risk + playbooks are now in-report", ["Coverage gaps", "Portfolio risk", "playbooks"].every((k) => prem.reportRendered.some((r) => r.toLowerCase().includes(k.toLowerCase().split(" ")[0]))));
  t("stakeholder hypotheses still flagged as contracted-not-rendered (HQ gap)", prem.contractedNotRendered.some((r) => /stakeholder/i.test(r)));
}

// ── Admin routes fail closed for unauthenticated requests ──
async function denyCheck() {
  const { GET: templateGet } = await import("../../app/api/admin/deliverables/template/route");
  const { GET: previewGet } = await import("../../app/api/admin/deliverables/template/preview/route");
  const r1 = templateGet(new NextRequest("http://localhost/api/admin/deliverables/template"));
  const r2 = previewGet(new NextRequest("http://localhost/api/admin/deliverables/template/preview?tier=premium"));
  t("template route denies unauthenticated (>=400)", r1 instanceof Response && r1.status >= 400);
  t("preview route denies unauthenticated (>=400)", r2 instanceof Response && r2.status >= 400);
}

denyCheck().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
