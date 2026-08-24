// DEV-ONLY visual QA fixture for the real Account Brief.
//
// Renders the PRESENTATIONAL `BriefView` with fully SYNTHETIC data so the brief's
// visual system can be inspected in a browser WITHOUT a Supabase session. This
// route:
//   • returns 404 in production (NODE_ENV guard) — never customer-reachable,
//   • performs NO auth, NO database reads/writes, NO external provider calls,
//   • uses obviously synthetic companies/events/dates/sources only,
//   • is not linked from any customer surface.
// It exists solely to close the authenticated-QA gap for design review.
import { notFound } from "next/navigation";
import OpportunityWorkspace from "@/components/deliverable/OpportunityWorkspace";
import { assembleInstitutionalReport } from "@/lib/reports/institutional-assembler";
import { resolveReportExperience } from "@/lib/products/report-experience";
import { fromInstitutionalReport, fromAmorPilot } from "@/lib/deliverable/adapters";
import { snapshotAccountReview } from "@/lib/deliverable/account-memory";
import type { DeliverableViewModel } from "@/lib/deliverable/deliverable-view-model";

export const dynamic = "force-dynamic";

const NOW = "2026-08-14T00:00:00.000Z";

// Synthetic report input (same shape the pipeline emits). Not real customer data.
const RAW = {
  onboarding: { output_language: "en" },
  created_at: NOW,
  executive_summary:
    "Three accounts show recent, dated public change that plausibly increases supplier and tooling needs. Fit and timing are strongest at Northstar. No procurement events are confirmed — treat each as a fit-and-timing thesis to validate, not a buying signal.",
  total_leads: 3, hot_count: 1, warm_count: 1, cold_count: 1, discard_count: 0,
  ranked_opportunities: [
    { lead_id: "a1", rank: 1, category: "HOT", recommended_action: "send_outreach_now" },
    { lead_id: "a2", rank: 2, category: "WARM", recommended_action: "validate" },
    { lead_id: "a3", rank: 3, category: "COLD", recommended_action: "monitor" },
  ],
  processed_leads: [
    { id: "a1",
      candidate: { company: "Northstar Logistics", source_url: "https://example.com/northstar-distribution", industry: "Mid-market logistics", location: "United States · Midwest", domain: "example.com", signal_date: "2026-08-05" },
      qualification: { category: "HOT", fit_score: 8, fit_reasons: ["Operations-led regional expansion aligns with the commercial context."] },
      enrichment: {
        account_thesis: "Northstar is expanding regional distribution while adding operations capacity — plausibly increasing supplier and tooling needs. Recent and partly corroborated, but no procurement event is confirmed.",
        why_now: "Signed a regional distribution agreement 9 days ago and posted 4 operations roles.",
        timing_signals: ["Regional distribution agreement", "Operations hiring"],
        signal_date: "2026-08-05",
        opportunity_risks: ["No procurement event or vendor evaluation confirmed.", "Expansion may relate to a different division.", "Timing evidence is more recent than the fit evidence."],
        pain_hypothesis: "Scaling distribution likely strains the current supplier network before they plan for it.",
        next_best_question: "Confirm whether procurement is centralized at group level.",
        evidence_urls: ["https://example.com/northstar-careers"],
      } },
    { id: "a2",
      candidate: { company: "FreshRoute Foods", source_url: "https://example.com/freshroute-sites", industry: "Regional food distribution", location: "United States · Southeast", domain: "example.com", signal_date: "2026-07-31" },
      qualification: { category: "WARM", fit_score: 6, fit_reasons: ["Distribution footprint growth fits the target profile."] },
      enrichment: {
        account_thesis: "Opened 2 new distribution sites; structural fit is strong but the timing evidence is moderate and single-sourced.",
        why_now: "Opened 2 new distribution sites 14 days ago.",
        signal_date: "2026-07-31",
        opportunity_risks: ["Decision scope may be regional, not corporate.", "Only one source confirms the expansion."],
        next_best_question: "Check whether the new sites use the same supplier network.",
      } },
    { id: "a3",
      candidate: { company: "Atlas Clinics Group", source_url: "", industry: "Multi-location healthcare", location: "United States · West", domain: "example.com", signal_date: "2026-07-24" },
      qualification: { category: "COLD", fit_score: 4, fit_reasons: ["Multi-location operator; moderate structural fit."] },
      enrichment: {
        account_thesis: "Announced 2 new clinic locations; fit is moderate and timing is limited — monitor rather than act.",
        why_now: "Announced 2 new clinic locations 21 days ago.",
        signal_date: "2026-07-24",
        opportunity_risks: ["No operations change observed yet."],
        next_best_question: "Verify the expansion affects your target category.",
      } },
  ],
};

const META = { job_id: "dev-preview", plan: "standard", search_id: null, customer_ref: null, created_at: NOW };

// Second synthetic fixture — a DIFFERENT shape/size (6 accounts, EU markets,
// industrial + SaaS, mixed evidence density incl. undated + a DISCARD), run
// through the SAME production assembler. Exercises the decision filter (>3),
// 4-way compare, Hold state, and graceful undated/limited cases.
const RAW_ALT = {
  onboarding: { output_language: "en" },
  created_at: NOW,
  executive_summary:
    "Six European accounts were evaluated. Two merit attention now on recent, corroborated expansion; two need validation of buyer access; one is early; one is not defensible today.",
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
    { id: "b1", candidate: { company: "Pennine Components Ltd", source_url: "https://example.co.uk/pennine", industry: "Industrial components", location: "United Kingdom · North West", domain: "example.co.uk", signal_date: "2026-08-08" },
      qualification: { category: "HOT", fit_score: 9, fit_reasons: ["Capacity expansion aligns with supplier-addition context."] },
      enrichment: { account_thesis: "Pennine is commissioning a second production line — corroborated by a planning filing and a hiring surge — plausibly adding supplier needs.", why_now: "Announced a second production line 6 days ago; posted 7 production roles.", signal_date: "2026-08-08",
        opportunity_risks: ["No procurement RFP confirmed.", "Line may use existing suppliers."], next_best_question: "Confirm whether new-line sourcing is centralised.", evidence_urls: ["https://example.co.uk/pennine-planning", "https://example.co.uk/pennine-careers"] } },
    { id: "b2", candidate: { company: "Nordwind Logistik GmbH", source_url: "https://example.de/nordwind", industry: "Logistics", location: "Germany · Hamburg", domain: "example.de", signal_date: "2026-08-03" },
      qualification: { category: "HOT", fit_score: 8, fit_reasons: ["New distribution hub fits the target profile."] },
      enrichment: { account_thesis: "Nordwind opened a Hamburg distribution hub, corroborated across two independent sources — a strong, recent timing signal.", why_now: "Opened a Hamburg hub 11 days ago.", signal_date: "2026-08-03",
        opportunity_risks: ["Decision authority may sit with the parent group."], next_best_question: "Identify whether procurement is group-level or local.", evidence_urls: ["https://example.de/nordwind-hub", "https://example.de/nordwind-press"] } },
    { id: "b3", candidate: { company: "Helsinki Data Oy", source_url: "https://example.fi/hdata", industry: "B2B SaaS", location: "Finland · Helsinki", domain: "example.fi", signal_date: "2026-07-27" },
      qualification: { category: "WARM", fit_score: 6, fit_reasons: ["Headcount growth suggests tooling needs."] },
      enrichment: { account_thesis: "Helsinki Data is scaling engineering headcount; fit is plausible but the signal is single-sourced.", why_now: "Posted 12 engineering roles 18 days ago.", signal_date: "2026-07-27",
        opportunity_risks: ["Only one source.", "Growth may be pre-funded, not new demand."], next_best_question: "Validate whether tooling budget is centralised." } },
    { id: "b4", candidate: { company: "Lyon Manufacture SA", source_url: "https://example.fr/lyon", industry: "Precision manufacturing", location: "France · Auvergne-Rhône-Alpes", domain: "example.fr" },
      qualification: { category: "WARM", fit_score: 6, fit_reasons: ["Certification suggests new production capability."] },
      enrichment: { account_thesis: "Lyon Manufacture earned a new quality certification — a capability signal, but with no dated expansion yet.", why_now: "Achieved ISO certification (date not disclosed).",
        opportunity_risks: ["No date on the certification.", "Capability ≠ demand."], next_best_question: "Confirm whether certification is tied to a new contract." } },
    { id: "b5", candidate: { company: "Aarhus Retail Group", source_url: "https://example.dk/aarhus", industry: "Retail", location: "Denmark · Aarhus", domain: "example.dk", signal_date: "2026-07-19" },
      qualification: { category: "COLD", fit_score: 4, fit_reasons: ["Store openings; moderate structural fit."] },
      enrichment: { account_thesis: "Aarhus is opening stores but the commercial fit for the context is weak — monitor.", why_now: "Announced 3 store openings 26 days ago.", signal_date: "2026-07-19",
        opportunity_risks: ["Weak category fit."], next_best_question: "Reassess if the context broadens to retail." } },
    { id: "b6", candidate: { company: "Old Mill Bakery", source_url: "", industry: "Food production", location: "Ireland · Cork", domain: "example.ie" },
      qualification: { category: "DISCARD", fit_score: 2, fit_reasons: ["No defensible commercial thesis."] },
      enrichment: { account_thesis: "No defensible opportunity thesis for the current context.", opportunity_risks: ["Below scale.", "No relevant change found."] } },
  ],
};

const META_ALT = { job_id: "dev-preview-alt", plan: "premium_launch_v0", search_id: null, customer_ref: null, created_at: NOW };

// Legacy Amor de Gea pilot artifact — read-only, proves the renderer is generic
// (a bespoke report shape, not the institutional one). Never mutated.
function loadAmorViewModel(): DeliverableViewModel | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const raw = fs.readFileSync(path.join(process.cwd(), "output", "amor-pilot1-deliverable.data.json"), "utf8");
    return fromAmorPilot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export default function DevBriefPreview({ searchParams }: { searchParams?: { source?: string; report?: string; memory?: string } }) {
  if (process.env.NODE_ENV === "production") notFound();

  // ?source=amor renders the real legacy pilot through the SAME workspace,
  // proving generic compatibility. Default: synthetic institutional report.
  if (searchParams?.source === "amor") {
    const vm = loadAmorViewModel();
    if (vm) return <OpportunityWorkspace vm={vm} />;
  }

  // ?report=alt renders the second fixture (6 EU accounts, mixed density).
  const alt = searchParams?.report === "alt";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report = assembleInstitutionalReport((alt ? RAW_ALT : RAW) as any, alt ? META_ALT : META);
  const experience = resolveReportExperience(alt ? "premium_launch_v0" : "intelligence_launch_v0");
  const vm = fromInstitutionalReport(report, experience);
  // ?memory=1 — synthesize a SECOND review by rolling back a prior review (dev
  // QA only; obviously synthetic timeline, never a claim of real history).
  if (searchParams?.memory === "1") {
    const prior = vm.accounts.map((a) => {
      const changed = a.whatChanged.some((c) => c.kind === "true_change" || c.kind === "recent_event");
      const prev = changed ? { ...a, decision: "monitor" as const, dimensions: a.dimensions.map((d) => d.label === "Timing" || d.label === "Evidence" ? { ...d, value: "Limited" as const } : d), whatChanged: [{ event: "No verified recent change", date: null, age: null, source: null, kind: "unknown" as const }], evidence: { ...a.evidence, corroborated: null, datedCount: 0, strength: "Limited" as const }, sources: [], validations: ["Confirm current planning systems / vendor"], validationDetails: [{ question: "Confirm current planning systems / vendor", decisionCritical: true, howToValidate: null, changesDecisionBecause: null }], revisitWhen: a.revisitWhen ?? "A new facility is announced" } : a;
      return [a.id, snapshotAccountReview(prev, { reviewId: "dev-review-1", reviewedAt: "2026-03-15", contextVersion: "dev-v1" })] as const;
    });
    const memory = { current: { reviewId: "dev-review-2", reviewedAt: "2026-08-22", contextVersion: "dev-v1" }, previousById: Object.fromEntries(prior) };
    return <OpportunityWorkspace vm={vm} memory={memory} />;
  }
  return <OpportunityWorkspace vm={vm} />;
}
