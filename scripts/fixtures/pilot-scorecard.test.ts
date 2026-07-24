import { buildPilotScorecard, type AdjudicationRow } from "@/lib/quality/pilot-scorecard";
import type { LeadLensReport } from "@/types";

let passed = 0;
function test(name: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`PASS: ${name}`);
}

const report = { total_leads: 5, report_quality_score: 90, actionability_summary: { act_now: 2, validate_first: 2, monitor: 1, exclude: 0 }, evidence_quality_counts: { high: 2, medium: 2, low: 1, insufficient: 0 }, delivery_readiness: { status: "ready", reasons: [], required_actions: [] } } as unknown as LeadLensReport;
const positiveRows: AdjudicationRow[] = [
  ...[0, 1, 2, 3].map(i => ({ company: `Good ${i}`, verdict: "true_positive", severity: "minor" })),
  { company: "Bad", verdict: "false_positive", error_class: "commercial_fit", severity: "major" },
];
const feedback = { usefulness: 4, actionability: 4, evidence_trust: 4, accounts_would_work: 2 };

const promising = buildPilotScorecard({ report, adjudication: positiveRows, feedback });
test("five reviewed emissions meet sample floor", promising.human_quality.minimum_sample_met);
test("observed precision uses TP/(TP+FP)", promising.human_quality.observed_precision === 0.8);
test("80% clean reviewed sample with feedback is promising", promising.status === "promising");
test("single pilot never self-declares validated", promising.status !== "validated");

const sparse = buildPilotScorecard({ report, adjudication: positiveRows.slice(0, 2) });
test("small sample is insufficient data", sparse.status === "insufficient_data");
test("missing feedback is explicit", sparse.blockers.some(b => b.includes("feedback")));

const critical = buildPilotScorecard({ report, adjudication: [...positiveRows, { company: "Wrong entity", verdict: "false_positive", error_class: "identity", severity: "critical" }], feedback });
test("one critical failure fails the pilot", critical.status === "failed");
test("critical error taxonomy is counted", critical.human_quality.error_classes.identity === 1);

const noReport = buildPilotScorecard({ adjudication: positiveRows, feedback });
test("missing real report stays insufficient", noReport.status === "insufficient_data" && noReport.blockers.some(b => b.includes("report artifact")));
test("claims prohibit guarantees", promising.claims_prohibited.some(c => c.includes("guarantees")));
const preliminaryOnlyReport = { ...report, processed_leads: [{ candidate: { opportunity_kind: "channel_fit", channel_evidence_grade: "preliminary" } }], total_leads: 1 } as unknown as LeadLensReport;
const preliminaryOnly = buildPilotScorecard({ report: preliminaryOnlyReport, adjudication: positiveRows, feedback });
test("scorecard does not count preliminary channel hypotheses as defensible", preliminaryOnly.status === "failed" && preliminaryOnly.system_quality.defensible_opportunities === 0 && preliminaryOnly.blockers.some(b => b.includes("zero defensible")));
console.log(`\n${passed}/11 pilot-scorecard assertions passed.`);
