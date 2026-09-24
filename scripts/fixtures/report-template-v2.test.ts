// Regression suite for Customer Deliverables V2 report templates.
// Deterministic; no network, no DB, no credit. Verifies: all four tiers render real PDFs with the
// correct company counts, Premium-only sections appear only on Premium, Spanish accents survive into
// the composed model, the descriptor invariants hold, rendering is deterministic, and the Admin
// template routes fail closed for unauthenticated requests.
import { NextRequest } from "next/server";
import { fromDeliverableViewModel } from "../../lib/delivery-system/delivery-document";
import { toPresentationModel } from "../../lib/delivery-system/presentation-model";
import { renderPdfBuffer } from "../../lib/delivery-system/renderers/pdf";
import { buildSampleDeliverable, REPORT_TEMPLATE_V2 } from "../../lib/delivery-system/report-template";
import type { DeliveryTier } from "../../lib/delivery-system/tier-composer";

let passed = 0, failed = 0;
function t(name: string, cond: boolean) { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } }

const isPdf = (b: Buffer) => b.length > 800 && b.subarray(0, 5).toString("latin1") === "%PDF-";
const caps: Record<DeliveryTier, number> = { preview: 2, brief: 6, intelligence: 12, premium: 18 };

// ── Descriptor invariants ──
t("version is CUSTOMER_DELIVERABLES_V2", REPORT_TEMPLATE_V2.version === "CUSTOMER_DELIVERABLES_V2");
t("approval state is FOUNDER_REVIEW (not auto-approved)", REPORT_TEMPLATE_V2.approvalState === "FOUNDER_REVIEW");
t("four tiers with frozen caps 2/6/12/18", JSON.stringify(REPORT_TEMPLATE_V2.tiers.map((x) => x.maxAccounts)) === JSON.stringify([2, 6, 12, 18]));
t("frozen prices 7/25/59/129", JSON.stringify(REPORT_TEMPLATE_V2.tiers.map((x) => x.price)) === JSON.stringify([7, 25, 59, 129]));
t("declares both languages", REPORT_TEMPLATE_V2.languages.includes("en") && REPORT_TEMPLATE_V2.languages.includes("es"));
t("declares known limitations", REPORT_TEMPLATE_V2.knownLimitations.length >= 3);

// ── Sample fixture ──
const vmEs = buildSampleDeliverable("es");
const vmEn = buildSampleDeliverable("en");
t("sample has 18 accounts", vmEs.accounts.length === 18);
t("sample is clearly synthetic (client labeled)", /sint|sample|synthetic|muestra/i.test(vmEs.meta.client ?? ""));
t("sample sources are example.* (no real company sourcing)", vmEs.accounts.every((a) => a.sources.every((s) => !s.url || /example\.(com|org)/.test(s.url))));
t("es sample preserves accents in content", vmEs.accounts.some((a) => /[áéíóúñ¿¡ü]/.test(a.thesis ?? "")) && /[áéíóúñ]/.test(vmEs.summary ?? ""));

// ── Per-tier render + counts + sections ──
const doc = fromDeliverableViewModel(vmEs);
for (const tier of ["preview", "brief", "intelligence", "premium"] as DeliveryTier[]) {
  const pm = toPresentationModel(doc, tier, "pdf");
  t(`${tier}: capped to ${caps[tier]} accounts`, pm.document.accounts.length === caps[tier]);
  const buf = renderPdfBuffer(pm);
  t(`${tier}: renders a real PDF`, isPdf(buf));
  // The effective gate for the Premium Decision Context is the composed document's premium section
  // (composeForTier sets it null unless the tier's premiumArchitecture is on).
  if (tier === "premium") t("premium: has Premium Decision Context section", !!(pm.document.premium && pm.document.premium.executivePortfolio.total > 0));
  else t(`${tier}: does NOT expose Premium-only section`, !pm.document.premium);
}

// ── Determinism: same template + sample ⇒ equivalent output ──
const a = renderPdfBuffer(toPresentationModel(fromDeliverableViewModel(buildSampleDeliverable("es")), "premium", "pdf"));
const b = renderPdfBuffer(toPresentationModel(fromDeliverableViewModel(buildSampleDeliverable("es")), "premium", "pdf"));
t("premium render is deterministic (equal byte length)", a.length === b.length);

// ── English sample renders too (language coverage) ──
t("en premium renders a real PDF", isPdf(renderPdfBuffer(toPresentationModel(fromDeliverableViewModel(vmEn), "premium", "pdf"))));

// ── Admin routes fail closed for unauthenticated requests ──
async function denyCheck() {
  const { GET: templateGet } = await import("../../app/api/admin/deliverables/template/route");
  const { GET: previewGet } = await import("../../app/api/admin/deliverables/template/preview/route");
  const bare = new NextRequest("http://localhost/api/admin/deliverables/template");
  const barePrev = new NextRequest("http://localhost/api/admin/deliverables/template/preview?tier=premium");
  const r1 = templateGet(bare);
  const r2 = previewGet(barePrev);
  // In a non-production test env without an admin cookie/token/bypass, requireAdmin returns 401/403.
  t("template route denies unauthenticated (>=400)", r1 instanceof Response && r1.status >= 400);
  t("preview route denies unauthenticated (>=400)", r2 instanceof Response && r2.status >= 400);
}

denyCheck().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
