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
import BriefView from "@/app/results/[jobId]/brief/BriefView";
import { assembleInstitutionalReport } from "@/lib/reports/institutional-assembler";
import { resolveReportExperience } from "@/lib/products/report-experience";

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
      candidate: { company: "Northstar Logistics", source_url: "https://example.com/northstar-distribution", industry: "Mid-market logistics", location: "United States · Midwest", domain: "example.com" },
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
      candidate: { company: "FreshRoute Foods", source_url: "https://example.com/freshroute-sites", industry: "Regional food distribution", location: "United States · Southeast", domain: "example.com" },
      qualification: { category: "WARM", fit_score: 6, fit_reasons: ["Distribution footprint growth fits the target profile."] },
      enrichment: {
        account_thesis: "Opened 2 new distribution sites; structural fit is strong but the timing evidence is moderate and single-sourced.",
        why_now: "Opened 2 new distribution sites 14 days ago.",
        signal_date: "2026-07-31",
        opportunity_risks: ["Decision scope may be regional, not corporate.", "Only one source confirms the expansion."],
        next_best_question: "Check whether the new sites use the same supplier network.",
      } },
    { id: "a3",
      candidate: { company: "Atlas Clinics Group", source_url: "", industry: "Multi-location healthcare", location: "United States · West", domain: "example.com" },
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

export default function DevBriefPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const report = assembleInstitutionalReport(RAW as any, META);
  const experience = resolveReportExperience("intelligence_launch_v0");
  return <BriefView report={report} experience={experience} />;
}
