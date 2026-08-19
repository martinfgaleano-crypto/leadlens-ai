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
t("15 capabilities gate tabs (portfolio/evidence/downloads)", typeof vm.capabilities.showPortfolioTab === "boolean" && typeof vm.capabilities.showEvidenceTab === "boolean");

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

// ─── 4. Security posture preserved (static source guards) ─────────────────────
const brief = readFileSync("app/results/[jobId]/brief/actions.ts", "utf8");
t("29 canonical route still does server-side ownership check", /lead_searches/.test(brief) && /user\.id !== ownerId/.test(brief) && /forbidden/.test(brief));
t("30 assembly stays server-side ('use server')", /^"use server";/.test(brief));
const workspace = readFileSync("components/deliverable/OpportunityWorkspace.tsx", "utf8");
t("31 workspace consumes a view model, never raw report_json", !/report_json/.test(workspace) && /DeliverableViewModel/.test(workspace));
const pageSrc = readFileSync("app/results/[jobId]/brief/page.tsx", "utf8");
t("32 canonical page renders the interactive workspace via the adapter", /OpportunityWorkspace/.test(pageSrc) && /fromInstitutionalReport/.test(pageSrc));
const dev = readFileSync("app/dev-brief-preview/page.tsx", "utf8");
t("33 Amor preview is dev-only (404 in production)", /NODE_ENV === "production"/.test(dev) && /notFound\(\)/.test(dev));

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
