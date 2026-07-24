import { evaluateActionability } from "@/lib/quality/actionability-gate";
import { computeRanking } from "@/lib/ranking";
import { applyDecisionIntelligence } from "@/lib/quality/opportunity-decision";
import { exportToCSV } from "@/lib/utils/export";
import type { ProcessedLead } from "@/types";

let passed = 0;
let assertions = 0;
function test(name: string, condition: boolean) {
  assertions++;
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`PASS: ${name}`);
}

function lead(o: { id: string; score: number; evidence: "high" | "medium" | "low" | "insufficient"; signal?: boolean; confidence?: number; qc?: "APPROVED" | "REVIEW_NEEDED" | "FAILED" }): ProcessedLead {
  return {
    id: o.id,
    candidate: { id: o.id, company: o.id, source: "test", confidence_score: 0.9 },
    enrichment: { candidate: {} as never, timing_signals: [o.signal === false ? "No confirmed signal" : "Warehouse expansion announced"], evidence: ["source"], missing_data: [], research_confidence: 0.9 },
    qualification: {
      enrichment: {} as never, fit_score: o.score, category: o.score >= 8 ? "HOT" : o.score >= 6 ? "WARM" : "COLD",
      fit_reasons: ["ICP fit"], disqualification_reasons: [], qualification_confidence: o.confidence ?? 0.9,
      score_breakdown: { role_fit: 1, company_fit: 2, pain_fit: 2, timing_signal: 2, reachability: 1, strategic_relevance: 1 },
      score_dimensions: { icp_fit: 80, signal_strength: 80, timing: 80, evidence_quality: 80, strategic_value: 70, confidence: 80, disqualification_risk: 10 },
    },
    outreach: { personalization_trigger: "x", subject: "x", email_body: "x", linkedin_dm: "x", followup_1: "x", followup_2: "x", tone: "direct", qc_status: o.qc ?? "APPROVED", qc_notes: [] },
    learning: { agent_confidence: 0.9, qc_flags: [], genericness_risk: "low", hallucination_risk: "low", evidence_discipline_summary: "verified", signal_patterns: [], improvement_notes: [], evidence_quality: o.evidence },
  } as unknown as ProcessedLead;
}

const strong = lead({ id: "strong", score: 7.5, evidence: "high" });
const inflated = lead({ id: "inflated", score: 9.8, evidence: "insufficient" });
const medium = lead({ id: "medium", score: 9.2, evidence: "medium" });
const noSignal = lead({ id: "no-signal", score: 9.5, evidence: "high", signal: false });
const failed = lead({ id: "failed-qc", score: 10, evidence: "high", qc: "FAILED" });
const obvious = lead({ id: "obvious", score: 9, evidence: "high" });
obvious.candidate.account_visibility = "obvious";
obvious.candidate.discovery_value = "medium";
const lowValue = lead({ id: "low-value", score: 9, evidence: "high" });
lowValue.candidate.discovery_value = "low";
const channelFit = lead({ id: "channel-fit", score: 9, evidence: "high" });
channelFit.candidate.opportunity_kind = "channel_fit";
channelFit.candidate.channel_evidence_grade = "moderate";
const preliminaryChannelFit = structuredClone(channelFit);
preliminaryChannelFit.candidate.channel_evidence_grade = "preliminary";
const failedChannelFit = lead({ id: "failed-channel-fit", score: 9, evidence: "high", qc: "FAILED" });
failedChannelFit.candidate.opportunity_kind = "channel_fit";

test("high evidence + signal + fit is actionable", evaluateActionability(strong).status === "act_now");
test("insufficient evidence can never be act-now", evaluateActionability(inflated).status === "monitor");
test("medium evidence requires validation", evaluateActionability(medium).status === "validate_first");
test("missing timing signal requires validation", evaluateActionability(noSignal).status === "validate_first");
test("failed QC is excluded", evaluateActionability(failed).status === "exclude");
test("obvious account can never be act-now without validation", evaluateActionability(obvious).status === "validate_first");
test("low discovery value is monitor-only", evaluateActionability(lowValue).status === "monitor");
test("channel fit is validate-first, never act-now", evaluateActionability(channelFit).status === "validate_first");
test("preliminary channel capability remains monitor", evaluateActionability(preliminaryChannelFit).status === "monitor");
test("failed QC still excludes a channel-fit account", evaluateActionability(failedChannelFit).status === "exclude");
const ranked = computeRanking([inflated, failed, medium, strong, noSignal]);
test("actionable account outranks higher raw scores", ranked[0].lead_id === "strong");
test("failed QC is last", ranked.at(-1)?.lead_id === "failed-qc");
test("ranking exposes gate audit fields", ranked.every(r => r.actionability_status && Array.isArray(r.actionability_blockers)));
const coldSignalRanking = computeRanking([lead({ id: "cold-signal", score: 5.8, evidence: "medium" })])[0];
test("cold dated event never becomes a buying-intent claim", !/buying signal|contact first/i.test(coldSignalRanking.ranking_explanation) && /not evidence of purchase intent/i.test(coldSignalRanking.ranking_explanation));

const report = {
  job_id: "gate-test", plan: "starter", total_leads: 5, hot_count: 4, warm_count: 1, cold_count: 0, discard_count: 0,
  avg_score: 9.2, executive_summary: "test", patterns_observed: [], recommendations: [],
  processed_leads: [inflated, failed, medium, strong, noSignal], created_at: new Date().toISOString(), ranked_opportunities: ranked,
} as unknown as import("@/types").LeadLensReport;
applyDecisionIntelligence(report, report.processed_leads, 5);
test("playbook exists only for act-now accounts", report.ranked_opportunities?.filter(r => r.playbook).every(r => r.actionability_status === "act_now") === true);
const csv = exportToCSV(report);
test("CSV exports actionability and blockers", csv.includes("Actionability Reasons") && csv.includes("No verified evidence supports the opportunity"));
console.log(`\n${passed}/${assertions} actionability assertions passed.`);
