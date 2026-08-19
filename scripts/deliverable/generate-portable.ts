// ─── Portable deliverable generator (internal) ────────────────────────────────
// Produces the customer delivery package from an AUTHORIZED, already-normalized
// deliverable: a self-contained portable HTML + Portfolio CSV + Evidence CSV,
// written to output/deliverables/<slug>/<date>/. Generation is internal (never
// the customer's browser); the artifacts contain only curated, customer-safe
// data and are secret-scanned before writing.
//
//   npm run deliverable:generate -- --fixture amor
//   npm run deliverable:generate -- --fixture alt
//   npm run deliverable:generate -- --job <id>     (documented; needs server env)

import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fromAmorPilot, fromInstitutionalReport } from "@/lib/deliverable/adapters";
import { assembleInstitutionalReport } from "@/lib/reports/institutional-assembler";
import { resolveReportExperience } from "@/lib/products/report-experience";
import { renderPortableHtml } from "@/lib/deliverable/portable/render-portable";
import { portfolioCsv, evidenceCsv, deliverableFilename } from "@/lib/deliverable/exports";
import { scanForSecrets, safeFilename } from "@/lib/deliverable/portable/portable-payload";
import type { DeliverableViewModel } from "@/lib/deliverable/deliverable-view-model";

const NOW = "2026-08-19T00:00:00.000Z";

// Second institutional fixture (6 EU accounts) — mirrors the dev-preview alt so
// the generator can exercise a different shape without a live job.
const RAW_ALT = {
  onboarding: { output_language: "en" }, created_at: NOW,
  executive_summary: "Six European accounts were evaluated. Two merit attention now on recent, corroborated expansion; two need validation of buyer access; one is early; one is not defensible today.",
  segment_insights: ["Mid-market industrial and B2B SaaS operators across the UK, Germany and the Nordics expanding capacity or footprint."],
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
    { id: "b1", candidate: { company: "Pennine Components Ltd", source_url: "https://example.co.uk/pennine", industry: "Industrial components", location: "United Kingdom · North West", domain: "example.co.uk", signal_date: "2026-08-08" }, qualification: { category: "HOT", fit_score: 9, fit_reasons: ["Capacity expansion aligns with supplier-addition context."] }, enrichment: { account_thesis: "Pennine is commissioning a second production line — corroborated by a planning filing and a hiring surge — plausibly adding supplier needs.", why_now: "Announced a second production line 6 days ago; posted 7 production roles.", opportunity_risks: ["No procurement RFP confirmed.", "Line may use existing suppliers."], next_best_question: "Confirm whether new-line sourcing is centralised.", evidence_urls: ["https://example.co.uk/pennine-planning", "https://example.co.uk/pennine-careers"] } },
    { id: "b2", candidate: { company: "Nordwind Logistik GmbH", source_url: "https://example.de/nordwind", industry: "Logistics", location: "Germany · Hamburg", domain: "example.de", signal_date: "2026-08-03" }, qualification: { category: "HOT", fit_score: 8, fit_reasons: ["New distribution hub fits the target profile."] }, enrichment: { account_thesis: "Nordwind opened a Hamburg distribution hub, corroborated across two independent sources — a strong, recent timing signal.", why_now: "Opened a Hamburg hub 11 days ago.", opportunity_risks: ["Decision authority may sit with the parent group."], next_best_question: "Identify whether procurement is group-level or local.", evidence_urls: ["https://example.de/nordwind-hub", "https://example.de/nordwind-press"] } },
    { id: "b3", candidate: { company: "Helsinki Data Oy", source_url: "https://example.fi/hdata", industry: "B2B SaaS", location: "Finland · Helsinki", domain: "example.fi", signal_date: "2026-07-27" }, qualification: { category: "WARM", fit_score: 6, fit_reasons: ["Headcount growth suggests tooling needs."] }, enrichment: { account_thesis: "Helsinki Data is scaling engineering headcount; fit is plausible but the signal is single-sourced.", why_now: "Posted 12 engineering roles 18 days ago.", opportunity_risks: ["Only one source.", "Growth may be pre-funded, not new demand."], next_best_question: "Validate whether tooling budget is centralised." } },
    { id: "b4", candidate: { company: "Lyon Manufacture SA", source_url: "https://example.fr/lyon", industry: "Precision manufacturing", location: "France · Auvergne-Rhône-Alpes", domain: "example.fr" }, qualification: { category: "WARM", fit_score: 6, fit_reasons: ["Certification suggests new production capability."] }, enrichment: { account_thesis: "Lyon Manufacture earned a new quality certification — a capability signal, but with no dated expansion yet.", why_now: "Achieved ISO certification (date not disclosed).", opportunity_risks: ["No date on the certification.", "Capability is not demand."], next_best_question: "Confirm whether certification is tied to a new contract." } },
    { id: "b5", candidate: { company: "Aarhus Retail Group", source_url: "https://example.dk/aarhus", industry: "Retail", location: "Denmark · Aarhus", domain: "example.dk", signal_date: "2026-07-19" }, qualification: { category: "COLD", fit_score: 4, fit_reasons: ["Store openings; moderate structural fit."] }, enrichment: { account_thesis: "Aarhus is opening stores but the commercial fit for the context is weak — monitor.", why_now: "Announced 3 store openings 26 days ago.", opportunity_risks: ["Weak category fit."], next_best_question: "Reassess if the context broadens to retail." } },
    { id: "b6", candidate: { company: "Old Mill Bakery", source_url: "", industry: "Food production", location: "Ireland · Cork", domain: "example.ie" }, qualification: { category: "DISCARD", fit_score: 2, fit_reasons: ["No defensible commercial thesis."] }, enrichment: { account_thesis: "No defensible opportunity thesis for the current context.", opportunity_risks: ["Below scale.", "No relevant change found."] } },
  ],
};

function loadViewModel(fixture: string): { vm: DeliverableViewModel; slugHint: string } {
  if (fixture === "amor") {
    const raw = readFileSync(path.join(process.cwd(), "output", "amor-pilot1-deliverable.data.json"), "utf8");
    return { vm: fromAmorPilot(JSON.parse(raw)), slugHint: "amor-de-gea" };
  }
  if (fixture === "alt") {
    const report = assembleInstitutionalReport(RAW_ALT as unknown as Record<string, unknown>, { job_id: "portable-alt", plan: "premium_launch_v0", search_id: null, customer_ref: null, created_at: NOW });
    return { vm: fromInstitutionalReport(report, resolveReportExperience("premium_launch_v0")), slugHint: "eu-industrial-saas" };
  }
  throw new Error(`Unknown fixture "${fixture}". Use --fixture amor | alt (job generation requires a server environment).`);
}

function kb(p: string): string { return `${(statSync(p).size / 1024).toFixed(1)} KB`; }

function main() {
  const args = process.argv.slice(2);
  const fixture = (args[args.indexOf("--fixture") + 1] || "").trim();
  const job = args.indexOf("--job") > -1 ? args[args.indexOf("--job") + 1] : null;
  if (job) { console.error("Job-based generation runs in the server environment (authorized snapshot + ownership). Not available in this CLI."); process.exit(2); }
  if (!fixture) { console.error("Usage: npm run deliverable:generate -- --fixture amor | alt"); process.exit(2); }

  const { vm, slugHint } = loadViewModel(fixture);
  const slug = safeFilename(vm.meta.client ?? slugHint).toLowerCase().replace(/_/g, "-");
  const date = (vm.meta.generatedAt ?? NOW).slice(0, 10);
  const dir = path.join(process.cwd(), "output", "deliverables", slug, date);
  mkdirSync(dir, { recursive: true });

  const html = renderPortableHtml(vm);
  const scan = scanForSecrets(html);
  if (!scan.clean) { console.error("ABORT: forbidden markers in generated HTML:", scan.hits.join(", ")); process.exit(1); }

  const htmlName = deliverableFilename(vm, "pdf", "html");
  const pName = deliverableFilename(vm, "portfolio", "csv");
  const eName = deliverableFilename(vm, "evidence", "csv");

  const htmlPath = path.join(dir, htmlName);
  const pPath = path.join(dir, pName);
  const ePath = path.join(dir, eName);
  writeFileSync(htmlPath, html, "utf8");
  writeFileSync(pPath, portfolioCsv(vm), "utf8");
  const hasEv = vm.downloads.evidenceCsv;
  if (hasEv) writeFileSync(ePath, evidenceCsv(vm), "utf8");

  // Internal manifest — never delivered to the customer.
  const manifest = { generatedAt: new Date().toISOString(), fixture, client: vm.meta.client, tier: vm.meta.tierLabel, accounts: vm.accounts.length, files: [htmlName, pName, ...(hasEv ? [eName] : [])], secretScan: "clean" };
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  console.log(`✅ Portable deliverable generated → ${path.relative(process.cwd(), dir)}`);
  console.log(`   ${htmlName}  (${kb(htmlPath)})`);
  console.log(`   ${pName}  (${kb(pPath)})`);
  if (hasEv) console.log(`   ${eName}  (${kb(ePath)})`);
  console.log(`   manifest.json (internal, not delivered)`);
  console.log(`   accounts: ${vm.accounts.length} · tier: ${vm.meta.tierLabel ?? "—"} · secret-scan: clean`);
}

main();
