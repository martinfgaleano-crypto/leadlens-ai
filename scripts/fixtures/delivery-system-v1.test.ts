// Customer Delivery System V1 — canonical DTO → TierComposer + ExportPolicy → PresentationModel →
// Web/PDF/CSV. Deterministic; no network. Proves: tier caps + dossier depth + section gating, honest
// recount, channel policy, three consistent outputs from one document, and no content invention.

import { readFileSync } from "node:fs";
import type { DeliverableViewModel, AccountBriefVM, DecisionState } from "../../lib/deliverable/deliverable-view-model";
import {
  fromDeliverableViewModel, composeForTier, TIER_COMPOSITION, toPresentationModel, presentAllChannels,
  renderCsv, renderPdfHtml, toWebPresentation, deliveryFilename, EXPORT_POLICY, CSV_COLUMNS, DELIVERY_DOCUMENT_SCHEMA,
  CHANNEL_AVAILABILITY, tierOffersChannel, isDeliveryTier, offeredChannels,
} from "../../lib/delivery-system";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

// ── Fixtures ──
function acc(id: string, decision: DecisionState, rank: number): AccountBriefVM {
  return {
    id, rank, company: `Acme ${id}`, segment: "Logistics", geography: "US", domain: `acme${id}.com`,
    accountRole: null, opportunityType: null, decision, decisionNote: `why ${id}`,
    thesis: `thesis ${id}`, whyItMatters: `matters ${id}`,
    dimensions: [{ label: "Fit", value: "Strong" }, { label: "Timing", value: "Moderate" }, { label: "Evidence", value: "Limited" }],
    whatChanged: [{ event: `expanded ${id}`, date: "2026-07-01", age: "60d ago", source: "news", kind: "recent_event" }],
    evidence: { sourceCount: 3, datedCount: 2, corroborated: true, latestAge: "9d ago", strength: "Moderate" },
    sources: [
      { label: "Press A", url: "https://a.co", date: "2026-07-01", age: "60d", relation: "direct", claim: "expansion" },
      { label: "Press B", url: "https://b.co", date: "2026-06-01", age: "90d", relation: "corroborating", claim: "hiring" },
      { label: "Press C", url: "https://c.co", date: null, age: null, relation: "context", claim: "profile" },
    ],
    counterSignals: [`counter ${id}`], limitations: [`limit ${id}`], validations: [`validate ${id}`],
    validationDetails: [{ question: `q ${id}`, decisionCritical: true, howToValidate: "call", changesDecisionBecause: "x" }],
    nextStep: `next ${id}`, revisitWhen: "Q3", monitorIdentity: { canonicalName: `Acme ${id}`, domain: null, country: "US", organizationType: null, aliases: [], confidence: "strong", fromUniverse: true },
    freshness: { label: "Fresh", age: "9d ago" }, confidence: "Moderate",
  };
}
const decisions: DecisionState[] = ["prioritize", "validate", "monitor", "hold"];
const accounts = Array.from({ length: 18 }, (_, i) => acc(String(i + 1), decisions[i % 4], i + 1));

const vm: DeliverableViewModel = {
  meta: { client: "Northstar Co", market: "US", generatedAt: "2026-09-01T00:00:00Z", generatedLabel: "Sep 1, 2026", tierLabel: "Intelligence", language: "en", schemaVersion: 1 },
  headline: "Where to focus now", summary: "18 accounts evaluated.",
  portfolio: { total: 18, counts: { prioritize: 5, validate: 5, monitor: 4, hold: 4 }, allocation: { line: "Focus first", detail: "on 5 prioritize" }, funnel: { considered: 40, rejected: 22, selected: 18 }, note: "note" },
  accounts,
  commercialContext: { objective: "find expanding 3PLs", clientDescription: "we sell WMS", summary: "ICP: mid-market US logistics", regions: ["US"], industries: ["Logistics"], criteria: ["expanding"] },
  validationQueue: accounts.slice(0, 6).map((a) => ({ accountId: a.id, company: a.company, decision: a.decision, items: a.validations })),
  coverage: { withDatedEvidence: 18, withSources: 18, corroborated: 12, grade: "Moderate", note: "good" },
  methodology: ["Fit/Timing/Evidence", "caseDecision authority"], limitations: ["public evidence only"],
  downloads: { pdf: true, portfolioCsv: true, evidenceCsv: true },
  capabilities: { showPortfolioTab: true, showCompareTab: true, showEvidenceTab: true, showDownloadsTab: true, showMethodology: true },
};

// ── DTO ──
const doc = fromDeliverableViewModel(vm);
t("DTO schema tag", doc.schema === DELIVERY_DOCUMENT_SCHEMA);
t("DTO is tier/channel-agnostic (no capabilities/downloads leaked)", !("capabilities" in (doc as any)) && !("downloads" in (doc as any)) && !("tierLabel" in doc.meta));
t("DTO keeps all 18 accounts full-depth", doc.accounts.length === 18 && doc.accounts[0].validationDetails?.length === 1);

// ── TierComposer: caps + depth + gating + honest recount ──
const preview = composeForTier(doc, "preview");
t("preview caps to 2 accounts", preview.accounts.length === 2 && TIER_COMPOSITION.preview.maxAccounts === 2);
t("preview mini depth trims narrative + sources≤2", preview.accounts[0].thesis === null && preview.accounts[0].whatChanged.length === 0 && preview.accounts[0].sources.length <= 2 && preview.accounts[0].validationDetails === undefined);
t("preview keeps the verdict (decision + dimensions + note)", preview.accounts[0].decision !== undefined && preview.accounts[0].dimensions.length === 3 && preview.accounts[0].decisionNote !== null);
t("preview hides context/validationQueue/coverage/methodology", preview.commercialContext === null && preview.validationQueue.length === 0 && preview.coverage === null && preview.methodology.length === 0);
t("preview RECOUNTS synthesis to the 2 surviving accounts", preview.portfolioSynthesis.total === 2 && (preview.portfolioSynthesis.counts.prioritize + preview.portfolioSynthesis.counts.validate + preview.portfolioSynthesis.counts.monitor + preview.portfolioSynthesis.counts.hold) === 2);

const brief = composeForTier(doc, "brief");
t("brief caps to 6, standard depth (keeps narrative, drops deep internals)", brief.accounts.length === 6 && brief.accounts[0].thesis !== null && brief.accounts[0].validationDetails === undefined && brief.accounts[0].monitorIdentity === null);
t("brief includes context+validationQueue+coverage, not allocation/methodology", brief.commercialContext !== null && brief.validationQueue.length > 0 && brief.coverage !== null && brief.portfolioSynthesis.allocation === null && brief.methodology.length === 0);

const intel = composeForTier(doc, "intelligence");
t("intelligence caps to 12, full depth + allocation + methodology", intel.accounts.length === 12 && intel.accounts[0].validationDetails?.length === 1 && intel.portfolioSynthesis.allocation !== null && intel.methodology.length > 0);
t("premium caps to 18 (all), full depth", composeForTier(doc, "premium").accounts.length === 18);
t("validationQueue is filtered to surviving accounts only", intel.validationQueue.every((q) => intel.accounts.some((a) => a.id === q.accountId)));

// ── PresentationModel: channel gating on top of tier ──
const csvPM = toPresentationModel(doc, "intelligence", "csv");
t("csv channel drops narrative sections (context/methodology/coverage/validationQueue)", csvPM.document.commercialContext === null && csvPM.document.methodology.length === 0 && csvPM.document.coverage === null && csvPM.document.validationQueue.length === 0);
t("csv channel keeps the 12 accounts (data rows)", csvPM.document.accounts.length === 12 && csvPM.kind === "operational_data" && csvPM.interactive === false);
const pdfPM = toPresentationModel(doc, "intelligence", "pdf");
t("pdf channel is a non-interactive snapshot with full sections", pdfPM.interactive === false && pdfPM.kind === "snapshot_artifact" && pdfPM.document.commercialContext !== null && pdfPM.document.methodology.length > 0);
const webPM = toPresentationModel(doc, "intelligence", "web");
t("web channel is the interactive living product", webPM.interactive === true && webPM.kind === "living_product");

// ── CSV renderer ──
const csv = renderCsv(csvPM);
const lines = csv.split("\n");
t("csv header matches policy columns", lines[0] === CSV_COLUMNS.join(","));
t("csv has one row per account (12) + header", lines.length === 13);
t("csv row carries decision label + Fit/Timing/Evidence + no outreach/score", lines[1].includes("Prioritize") && lines[1].includes("Strong") && lines[1].includes("Moderate") && lines[1].includes("Limited") && !csv.toLowerCase().includes("outreach") && !csv.toLowerCase().includes("score"));
t("csv escaping: a comma-bearing field is quoted", renderCsv(toPresentationModel(fromDeliverableViewModel({ ...vm, accounts: [{ ...acc("x", "hold", 1), company: "A, B Inc" }] }), "preview", "csv")).includes('"A, B Inc"'));

// ── PDF renderer ──
const pdf = renderPdfHtml(pdfPM);
t("pdf is self-contained HTML, no scripts", pdf.startsWith("<!doctype html>") && !pdf.includes("<script"));
t("pdf renders header + accounts + methodology (policy honored)", pdf.includes("Where to focus now") && pdf.includes("Acme 1") && pdf.includes("Methodology"));
t("pdf for CSV-only content is impossible — pdf keeps narrative", pdf.includes("Commercial context") && pdf.includes("Counter-signals"));
t("pdf escapes HTML in content", renderPdfHtml(toPresentationModel(fromDeliverableViewModel({ ...vm, headline: "<b>x</b>" }), "brief", "pdf")).includes("&lt;b&gt;x&lt;/b&gt;"));

// ── Web renderer ──
const web = toWebPresentation(webPM);
t("web section order + presence honors policy/content", web.sections.map((s) => s.kind).join(",") === "header,commercialContext,portfolioSynthesis,accounts,validationQueue,coverage,methodology,limitations" && web.sections.find((s) => s.kind === "accounts")!.present === true);
t("web is the living product (interactive)", web.interactive === true);

// ── One document → three consistent outputs ──
const all = presentAllChannels(doc, "brief");
t("presentAllChannels: web/pdf/csv all from the same brief-composed document (6 accounts)", all.web.document.accounts.length === 6 && all.pdf.document.accounts.length === 6 && all.csv.document.accounts.length === 6);
t("filenames are safe + channel-tagged", deliveryFilename(all.csv, "csv") === "leadlens-northstar-co-brief-csv.csv");

// ── Policy table integrity ──
t("three channels declared", Object.keys(EXPORT_POLICY).sort().join(",") === "csv,pdf,web");
t("only csv carries csvColumns", EXPORT_POLICY.csv.csvColumns !== null && EXPORT_POLICY.web.csvColumns === null && EXPORT_POLICY.pdf.csvColumns === null);

// ── Tier × channel availability (Phase A gating) ──
t("csv offered ONLY for intelligence + premium", tierOffersChannel("intelligence", "csv") && tierOffersChannel("premium", "csv") && !tierOffersChannel("preview", "csv") && !tierOffersChannel("brief", "csv"));
t("web + pdf offered for every tier", (["preview", "brief", "intelligence", "premium"] as const).every((tr) => tierOffersChannel(tr, "web") && tierOffersChannel(tr, "pdf")));
t("isDeliveryTier accepts the four tiers, rejects junk", isDeliveryTier("premium") && !isDeliveryTier("enterprise") && !isDeliveryTier(null));
t("offeredChannels: preview = web,pdf (no csv)", offeredChannels("preview").join(",") === "web,pdf" && Object.keys(CHANNEL_AVAILABILITY).length === 4);

// ── CSV export route contract (auth, server tier, gating, headers) ──
const csvRoute = readFileSync("app/api/results/[jobId]/export/csv/route.ts", "utf8");
t("csv route: authenticated via bearer token", csvRoute.includes('req.headers.get("authorization")') && csvRoute.includes("deliverableForViewer(params.jobId, token)"));
t("csv route: owner/cross-tenant denial (401/403/404 from viewer bridge)", csvRoute.includes("if (!v.ok) return new NextResponse(null, { status: v.status })"));
t("csv route: tier-gated (channel availability), server tier not client", csvRoute.includes('tierOffersChannel(v.tier, "csv")') && !csvRoute.includes("searchParams") && !/req\.(url|nextUrl)[^;]*tier/.test(csvRoute));
t("csv route: correct content-type + attachment + noindex", csvRoute.includes('"Content-Type": "text/csv; charset=utf-8"') && csvRoute.includes("attachment; filename=") && csvRoute.includes('"X-Robots-Tag": "noindex"'));
t("csv route: no raw JSON / no research call / no credit consumption", !csvRoute.includes("report_json") && !csvRoute.includes("consumeRunSlot") && !csvRoute.includes("claimAccountIntelligenceCredit") && !csvRoute.includes("runLeadLensPipeline"));

// ── Viewer bridge: proven ownership + no research/credit ──
const bridge = readFileSync("lib/delivery-system/server/deliverable-for-viewer.ts", "utf8");
t("viewer bridge reuses getBriefForViewer ownership (owner-only, cross-tenant denied)", bridge.includes("getBriefForViewer(jobId, accessToken)") && bridge.includes('status: 403') && bridge.includes('status: 401'));
t("viewer bridge: server-authoritative tier from experience (client can't escalate)", bridge.includes("brief.experience.tier") && bridge.includes("isDeliveryTier"));
t("viewer bridge: no credit/pipeline call (starts from immutable snapshot)", !bridge.includes("consumeRunSlot") && !bridge.includes("claimAccountIntelligenceCredit") && !bridge.includes("runLeadLensPipeline") && !bridge.includes("provider-routing"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
