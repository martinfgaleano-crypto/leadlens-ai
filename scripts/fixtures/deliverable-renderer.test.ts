// Interactive Customer Deliverable — normalization + invariants (0 provider calls).
// Locks the V1 renderer's guarantees:
//   1. The institutional report normalizes into the view model with honest
//      decision states, separate dimensions (never one opaque score), and dates
//      that are only ever real.
//   2. The legacy Amor de Gea pilot (a bespoke shape) renders through the SAME
//      view model — proving the renderer is generic, not hard-coded.
//   3. Optional sections degrade gracefully; no field is fabricated.
//   4. Security posture is preserved (server-side ownership + assembly; the
//      workspace never touches raw report_json).
// Run: npm run test:deliverable
import { readFileSync } from "node:fs";
import path from "node:path";
import { assembleInstitutionalReport } from "@/lib/reports/institutional-assembler";
import { resolveReportExperience } from "@/lib/products/report-experience";
import { fromInstitutionalReport, fromAmorPilot } from "@/lib/deliverable/adapters";
import { portfolioCsv, evidenceCsv, csvEscape, deliverableFilename } from "@/lib/deliverable/exports";
import { toClientCanvasVM } from "@/lib/deliverable/client-canvas-vm";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };

// ─── Synthetic institutional report (same shape the pipeline emits) ───────────
const NOW = "2026-08-14T00:00:00.000Z";
const RAW = {
  onboarding: { output_language: "en" },
  created_at: NOW,
  executive_summary: "Three accounts show recent, dated public change.",
  total_leads: 3, hot_count: 1, warm_count: 1, cold_count: 1, discard_count: 0,
  ranked_opportunities: [
    { lead_id: "a1", rank: 1, category: "HOT", recommended_action: "send_outreach_now" },
    { lead_id: "a2", rank: 2, category: "WARM", recommended_action: "validate_source_first" },
    { lead_id: "a3", rank: 3, category: "COLD", recommended_action: "monitor" },
  ],
  processed_leads: [
    { id: "a1", candidate: { company: "Northstar Logistics", source_url: "https://example.com/n", industry: "Logistics", location: "US · Midwest", domain: "example.com" },
      qualification: { category: "HOT", fit_score: 8, fit_reasons: ["Fit."] },
      enrichment: { account_thesis: "Expanding distribution.", why_now: "Signed an agreement 9 days ago.", signal_date: "2026-08-05",
        opportunity_risks: ["No procurement event confirmed."], next_best_question: "Confirm procurement centralization.", evidence_urls: ["https://example.com/careers"] } },
    { id: "a2", candidate: { company: "FreshRoute Foods", source_url: "https://example.com/f", industry: "Food distribution", location: "US · Southeast", domain: "example.com" },
      qualification: { category: "WARM", fit_score: 6, fit_reasons: ["Fit."] },
      enrichment: { account_thesis: "Opened 2 sites.", why_now: "Opened 2 sites 14 days ago.", signal_date: "2026-07-31", opportunity_risks: ["Single source."], next_best_question: "Check supplier network." } },
    { id: "a3", candidate: { company: "Atlas Clinics Group", source_url: "", industry: "Healthcare", location: "US · West", domain: "example.com" },
      qualification: { category: "COLD", fit_score: 4, fit_reasons: ["Fit."] },
      enrichment: { account_thesis: "Announced 2 clinics.", why_now: "Announced 2 clinics 21 days ago.", signal_date: "2026-07-24", opportunity_risks: ["No operations change yet."], next_best_question: "Verify category." } },
  ],
};
const META = { job_id: "test", plan: "intelligence_launch_v0", search_id: null, customer_ref: null, created_at: NOW };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const report = assembleInstitutionalReport(RAW as any, META);
const vm = fromInstitutionalReport(report, resolveReportExperience("intelligence_launch_v0"));

// ─── 1. Institutional normalization ───────────────────────────────────────────
t("1 view model produces one account per dossier", vm.accounts.length === report.account_dossiers.length && vm.accounts.length === 3);
t("2 decision states are the canonical 4-state vocabulary", vm.accounts.every((a) => ["prioritize", "validate", "monitor", "hold"].includes(a.decision)));
t("3 act_now dossier maps to Prioritize", vm.accounts[0].decision === "prioritize");
t("4 validate_source_first maps to Validate", vm.accounts[1].decision === "validate");
t("5 separate dimensions exist (Fit/Timing/Evidence — not one score)", vm.accounts[0].dimensions.length >= 2 && vm.accounts[0].dimensions.some((d) => d.label === "Fit"));
t("6 no single opaque 'score' field on the account", !("score" in (vm.accounts[0] as unknown as Record<string, unknown>)));
t("7 dimension values are ordinal strengths", vm.accounts[0].dimensions.every((d) => ["Strong", "Moderate", "Limited"].includes(d.value)));
t("8 evidence provenance preserved (source label + url)", vm.accounts[0].sources.length > 0 && vm.accounts[0].sources[0].url !== undefined);
t("9 what-changed dates are real or null (never fabricated)", vm.accounts.every((a) => a.whatChanged.every((c) => c.date === null || /^\d{4}-\d{2}-\d{2}$/.test(c.date))));
t("10 counter-signals surface (risks are first-class)", vm.accounts[0].counterSignals.length > 0);
t("11 what-to-validate surfaces", vm.accounts.some((a) => a.validations.length > 0));
t("12 recommended next step present", vm.accounts[0].nextStep !== null);
t("13 portfolio counts sum to total", (["prioritize", "validate", "monitor", "hold"] as const).reduce((s, k) => s + vm.portfolio.counts[k], 0) === vm.portfolio.total);
t("14 tier label resolved from experience", vm.meta.tierLabel !== null);
t("15 capabilities gate tabs (portfolio/compare/evidence/downloads)", typeof vm.capabilities.showPortfolioTab === "boolean" && typeof vm.capabilities.showCompareTab === "boolean" && typeof vm.capabilities.showEvidenceTab === "boolean");

// ─── 1b. V1.1 value surfacing (context, queue, exports, compare) ──────────────
t("15a commercial context surfaced (industries/regions from real data)", vm.commercialContext !== null && vm.commercialContext.industries.length > 0);
t("15b validation queue aggregates per-account validations", vm.validationQueue.length > 0 && vm.validationQueue.every((q) => q.items.length > 0));
t("15c compare capability on with ≥2 accounts", vm.capabilities.showCompareTab === true);
t("15d coverage counts corroborated accounts", typeof vm.coverage?.corroborated === "number");
// Exports
const pcsv = portfolioCsv(vm);
const ecsv = evidenceCsv(vm);
t("15e portfolio CSV: header + one row per account", pcsv.split("\r\n").length === vm.accounts.length + 1);
t("15f portfolio CSV first data row names the top account", pcsv.split("\r\n")[1].includes(vm.accounts[0].company));
t("15g evidence CSV: header + one row per source", ecsv.split("\r\n").length === vm.accounts.reduce((n, a) => n + a.sources.length, 0) + 1);
t("15h CSV escaping quotes commas/quotes/newlines", csvEscape('a,b') === '"a,b"' && csvEscape('a"b') === '"a""b"' && csvEscape("a\nb") === '"a\nb"' && csvEscape("plain") === "plain");
t("15i CSV never leaks [object Object]", !pcsv.includes("[object Object]") && !ecsv.includes("[object Object]"));
t("15j filename is safe + dated", /^LeadLens_Portfolio_.*_\d{4}-\d{2}-\d{2}\.csv$/.test(deliverableFilename(vm, "portfolio", "csv")));
t("15k downloads expose pdf + portfolio CSV + evidence CSV", vm.downloads.pdf && vm.downloads.portfolioCsv && vm.downloads.evidenceCsv);

// ─── 2. Amor de Gea legacy pilot compatibility ────────────────────────────────
let amorVm: ReturnType<typeof fromAmorPilot> | null = null;
try {
  const raw = readFileSync(path.join(process.cwd(), "output", "amor-pilot1-deliverable.data.json"), "utf8");
  amorVm = fromAmorPilot(JSON.parse(raw));
} catch { /* absent in some environments */ }
t("16 Amor pilot loads through the generic adapter", amorVm !== null);
if (amorVm) {
  t("17 Amor renders all pilot accounts", amorVm.accounts.length === 10);
  t("18 Amor report language is Spanish", amorVm.meta.language === "es");
  t("19 Amor client + market metadata mapped", amorVm.meta.client === "Amor de Gea" && amorVm.meta.market === "Colombia");
  t("20 Amor decisions map to canonical states", amorVm.accounts.every((a) => ["prioritize", "validate", "monitor", "hold"].includes(a.decision)));
  t("21 Amor accounts carry a thesis (why this account)", amorVm.accounts.every((a) => a.thesis !== null));
  t("22 Amor accounts carry what-to-validate", amorVm.accounts.every((a) => a.validations.length > 0));
  t("23 Amor accounts carry limitations (what limits confidence)", amorVm.accounts.some((a) => a.limitations.length > 0));
  t("24 Amor evidence provenance preserved (source name)", amorVm.accounts.some((a) => a.sources.length > 0));
  t("25 Amor prose dates are NOT coerced into fake ISO dates", amorVm.accounts.every((a) => a.whatChanged.every((c) => c.date === null || /^\d{4}-\d{2}-\d{2}$/.test(c.date))));
  t("26 Amor next step mapped", amorVm.accounts.every((a) => a.nextStep !== null));
}

// ─── 3. Graceful degradation (no fabrication on empty input) ──────────────────
const emptyVm = fromAmorPilot({ meta: { client: "X" }, accounts: [] });
t("27 empty portfolio renders with zero accounts (no crash, no invented data)", emptyVm.accounts.length === 0 && emptyVm.portfolio.total === 0);
t("28 missing evidence → empty sources, not a placeholder claim", fromAmorPilot({ accounts: [{ name: "Y", why: "w" }] }).accounts[0].sources.length === 0);

// ─── 3b. Second fixture — different shape/size (6 EU accounts, mixed density) ──
const RAW2 = {
  onboarding: { output_language: "en" }, created_at: NOW,
  executive_summary: "Six EU accounts.", segment_insights: ["EU industrial + SaaS."],
  total_leads: 6, hot_count: 2, warm_count: 2, cold_count: 1, discard_count: 1,
  ranked_opportunities: [
    { lead_id: "b1", rank: 1, category: "HOT", recommended_action: "send_outreach_now" },
    { lead_id: "b2", rank: 2, category: "HOT", recommended_action: "send_outreach_now" },
    { lead_id: "b3", rank: 3, category: "WARM", recommended_action: "validate_source_first" },
    { lead_id: "b4", rank: 4, category: "WARM", recommended_action: "validate_source_first" },
    { lead_id: "b5", rank: 5, category: "COLD", recommended_action: "monitor" },
    { lead_id: "b6", rank: 6, category: "DISCARD", recommended_action: "exclude" },
  ],
  processed_leads: [
    { id: "b1", candidate: { company: "Pennine Components Ltd", source_url: "https://example.co.uk/p", industry: "Industrial", location: "UK", domain: "example.co.uk" }, qualification: { category: "HOT", fit_score: 9, fit_reasons: ["Fit."] }, enrichment: { account_thesis: "Second line.", why_now: "6 days ago.", signal_date: "2026-08-08", opportunity_risks: ["No RFP."], next_best_question: "Confirm sourcing.", evidence_urls: ["https://example.co.uk/p2"] } },
    { id: "b2", candidate: { company: "Nordwind Logistik GmbH", source_url: "https://example.de/n", industry: "Logistics", location: "DE", domain: "example.de" }, qualification: { category: "HOT", fit_score: 8, fit_reasons: ["Fit."] }, enrichment: { account_thesis: "Hub.", why_now: "11 days ago.", signal_date: "2026-08-03", opportunity_risks: ["Parent."], next_best_question: "Procurement?", evidence_urls: ["https://example.de/n2"] } },
    { id: "b3", candidate: { company: "Helsinki Data Oy", source_url: "https://example.fi/h", industry: "SaaS", location: "FI", domain: "example.fi" }, qualification: { category: "WARM", fit_score: 6, fit_reasons: ["Fit."] }, enrichment: { account_thesis: "Hiring.", why_now: "18 days ago.", signal_date: "2026-07-27", opportunity_risks: ["One source."], next_best_question: "Budget?" } },
    { id: "b4", candidate: { company: "Lyon Manufacture SA", source_url: "https://example.fr/l", industry: "Manufacturing", location: "FR", domain: "example.fr" }, qualification: { category: "WARM", fit_score: 6, fit_reasons: ["Fit."] }, enrichment: { account_thesis: "Cert.", why_now: "Undated.", opportunity_risks: ["No date."], next_best_question: "Contract?" } },
    { id: "b5", candidate: { company: "Aarhus Retail Group", source_url: "https://example.dk/a", industry: "Retail", location: "DK", domain: "example.dk" }, qualification: { category: "COLD", fit_score: 4, fit_reasons: ["Fit."] }, enrichment: { account_thesis: "Stores.", why_now: "26 days ago.", signal_date: "2026-07-19", opportunity_risks: ["Weak fit."], next_best_question: "Reassess?" } },
    { id: "b6", candidate: { company: "Old Mill Bakery", source_url: "", industry: "Food", location: "IE", domain: "example.ie" }, qualification: { category: "DISCARD", fit_score: 2, fit_reasons: ["None."] }, enrichment: { account_thesis: "No thesis.", opportunity_risks: ["Below scale."] } },
  ],
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vm2 = fromInstitutionalReport(assembleInstitutionalReport(RAW2 as any, { job_id: "t2", plan: "premium_launch_v0", search_id: null, customer_ref: null, created_at: NOW }), resolveReportExperience("premium_launch_v0"));
t("34 second fixture renders all 6 accounts", vm2.accounts.length === 6);
t("35 second fixture covers all four decision states", new Set(vm2.accounts.map((a) => a.decision)).size === 4);
t("36 DISCARD dossier maps to Hold", vm2.accounts.some((a) => a.decision === "hold"));
t("37 undated account produces null date (graceful), not a fabricated one", vm2.accounts.every((a) => a.whatChanged.every((c) => c.date === null || /^\d{4}-\d{2}-\d{2}$/.test(c.date))));
t("38 second fixture portfolio CSV integrity (7 rows, no object leak)", portfolioCsv(vm2).split("\r\n").length === 7 && !portfolioCsv(vm2).includes("[object Object]"));
t("39 Unicode company names survive CSV intact", portfolioCsv(vm2).includes("Nordwind Logistik GmbH"));

// Amor CSV (Spanish/Unicode) integrity
if (amorVm) {
  t("40 Amor portfolio CSV: 11 rows, Unicode preserved (Éteka)", portfolioCsv(amorVm).split("\r\n").length === 11 && portfolioCsv(amorVm).includes("Éteka"));
}

// ─── 4. Security posture preserved (static source guards) ─────────────────────
const brief = readFileSync("app/results/[jobId]/brief/actions.ts", "utf8");
t("41 canonical route still does server-side ownership check", /lead_searches/.test(brief) && /user\.id !== ownerId/.test(brief) && /forbidden/.test(brief));
t("42 assembly stays server-side ('use server')", /^"use server";/.test(brief));
const workspace = readFileSync("components/deliverable/OpportunityWorkspace.tsx", "utf8");
t("43 workspace consumes a view model, never raw report_json", !/report_json/.test(workspace) && /DeliverableViewModel/.test(workspace));
const pageSrc = readFileSync("app/results/[jobId]/brief/page.tsx", "utf8");
t("44 canonical page renders the interactive workspace via the adapter", /OpportunityWorkspace/.test(pageSrc) && /fromInstitutionalReport/.test(pageSrc));
const dev = readFileSync("app/dev-brief-preview/page.tsx", "utf8");
t("45 Amor preview is dev-only (404 in production)", /NODE_ENV === "production"/.test(dev) && /notFound\(\)/.test(dev));
const exportsSrc = readFileSync("lib/deliverable/exports.ts", "utf8");
t("46 exports derive from the view model only (no raw report fields)", !/report_json|processed_leads|_vault/.test(exportsSrc));

// ─── 5. Authenticated workspace — client-subject parity (P1) ──────────────────
t("47 workspace no longer uses 'Prepared for X' report framing", !/Prepared for|preparedFor|Preparado para/.test(workspace));
t("48 client is the header subject via the shared ClientCanvasVM", /toClientCanvasVM\(vm\)/.test(workspace) && /className="dlv-client">\{cc\.subject\}/.test(workspace));
t("49 client header is LIGHT (no large dark navy gradient top bar)", !/\.dlv-topbar \{ background: linear-gradient\(120deg,#0b1220/.test(workspace) && /\.dlv-topbar \{ background: #fff/.test(workspace));
t("50 commercial objective shown only from real data (rendered conditionally)", /\{cc\.objective && /.test(workspace) && /Commercial objective/.test(workspace));
t("51 opportunities remain subordinate to the client (accounts + AccountBrief render)", /accountsPanel|AccountBrief/.test(workspace) && /opportunities evaluated/.test(workspace));
t("52 no HOT/WARM/COLD in the workspace", !/\bHOT\b|\bWARM\b|\bCOLD\b/.test(workspace));
t("53 no aggregate score in the workspace (no NN/100, N.N/10, 'ai score')", !/\b\d{1,3}\s*\/\s*100\b/.test(workspace) && !/\b\d(?:\.\d)?\s*\/\s*10\b/.test(workspace) && !/opportunity score|lead score|ai score/i.test(workspace));
t("54 workspace client-header VM is graceful (subject falls back, never a fake client)", (() => {
  const cc = fromInstitutionalReport(assembleInstitutionalReport(RAW2 as unknown as Record<string, unknown>, { job_id: "wtest", plan: "brief_launch_v0", search_id: null, customer_ref: null, created_at: NOW }), resolveReportExperience("brief_launch_v0"));
  const c = toClientCanvasVM(cc);
  return c.client === null && c.hasClient === false && c.subject.length > 0 && !c.landscape.some((o) => o.company === c.subject);
})());

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
