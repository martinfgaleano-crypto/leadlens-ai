import { evaluateReportDeliveryReadiness as gate } from "@/lib/quality/report-delivery-gate";
import { assembleInstitutionalReport } from "@/lib/reports/institutional-assembler";

let passed = 0;
function test(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`PASS: ${name}`);
}

const base = { total_accounts: 5, report_quality_score: 90, act_now: 2, validate_first: 2, monitor: 1, exclude: 0, insufficient_evidence: 0, failed_qc: 0 };
test("healthy actionable report is ready", gate(base).status === "ready");
test("empty report is blocked", gate({ ...base, total_accounts: 0, act_now: 0 }).status === "blocked");
test("quality below floor is blocked", gate({ ...base, report_quality_score: 59 }).status === "blocked");
test("any failed outreach QC blocks delivery", gate({ ...base, failed_qc: 1 }).status === "blocked");
test("all excluded blocks delivery", gate({ ...base, act_now: 0, validate_first: 0, monitor: 0, exclude: 5 }).status === "blocked");
test("no actionable accounts requires review", gate({ ...base, act_now: 0, validate_first: 4 }).status === "review_required");
test("insufficient evidence requires review", gate({ ...base, insufficient_evidence: 1 }).status === "review_required");
test("quality under 80 requires review", gate({ ...base, report_quality_score: 79 }).status === "review_required");
test("blocked response includes remediation", gate({ ...base, failed_qc: 1 }).required_actions.length > 0);
test("paid report with zero novel accounts is blocked", gate({ ...base, novel_accounts: 0, obvious_accounts: 1, low_discovery_value: 0 }).status === "blocked");
test("more than one obvious benchmark is blocked", gate({ ...base, novel_accounts: 3, obvious_accounts: 2, low_discovery_value: 0 }).status === "blocked");
test("all-low discovery value is blocked", gate({ ...base, novel_accounts: 0, obvious_accounts: 0, low_discovery_value: 5 }).status === "blocked");
test("report made only of preliminary hypotheses is blocked", gate({ ...base, act_now: 0, validate_first: 0, monitor: 5, defensible_opportunities: 0, preliminary_channel_accounts: 5 }).status === "blocked");
test("mixed report exposes preliminary accounts for review", gate({ ...base, defensible_opportunities: 4, preliminary_channel_accounts: 1 }).status === "review_required");
const historical = assembleInstitutionalReport({
  created_at: new Date().toISOString(), total_leads: 1, hot_count: 1, warm_count: 0, cold_count: 0, discard_count: 0,
  ranked_opportunities: [{ lead_id: "old", rank: 1, category: "HOT", recommended_action: "send_outreach_now" }],
  processed_leads: [{ id: "old", candidate: { company: "Legacy Co" }, enrichment: {}, qualification: { category: "HOT", fit_score: 8 } }],
}, { job_id: "old", plan: "starter", search_id: null, customer_ref: null, created_at: new Date().toISOString() });
test("historical reports retain legacy actionable priorities", historical.priority_opportunities.length === 1 && historical.account_dossiers[0].actionability_status === "act_now");
console.log(`\n${passed}/15 delivery-gate assertions passed.`);
