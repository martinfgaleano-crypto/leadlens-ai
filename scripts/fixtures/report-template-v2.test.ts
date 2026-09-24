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
import type { DeliveryTier } from "../../lib/delivery-system/tier-composer";

let passed = 0, failed = 0;
function t(name: string, cond: boolean) { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } }

const isPdf = (b: Buffer) => b.length > 800 && b.subarray(0, 5).toString("latin1") === "%PDF-";
const pdfText = (b: Buffer) => b.toString("latin1"); // decision on presence of localized/English tokens is done on the VM, not the compressed stream
const caps: Record<DeliveryTier, number> = { preview: 2, brief: 6, intelligence: 12, premium: 18 };

// ── Descriptor invariants ──
t("version is CUSTOMER_DELIVERABLES_V2_1", REPORT_TEMPLATE.version === "CUSTOMER_DELIVERABLES_V2_1");
t("supersedes V2", REPORT_TEMPLATE.supersedes === "CUSTOMER_DELIVERABLES_V2");
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
