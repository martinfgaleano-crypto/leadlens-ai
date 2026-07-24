import type { LeadLensReport } from "@/types";

export type HumanVerdict = "true_positive" | "false_positive" | "needs_validation" | "false_negative_visible" | "correct_rejection";

export interface AdjudicationRow {
  company?: string;
  verdict?: string;
  error_class?: string;
  severity?: string;
}

export interface PilotFeedback {
  usefulness?: number | null;
  actionability?: number | null;
  evidence_trust?: number | null;
  would_pay?: boolean | null;
  decision_changed?: boolean | null;
  accounts_would_work?: number | null;
}

export interface PilotScorecard {
  version: "pilot-scorecard-v1";
  status: "insufficient_data" | "failed" | "promising" | "validated";
  human_quality: {
    judged_emissions: number;
    true_positives: number;
    false_positives: number;
    needs_validation: number;
    observed_precision: number | null;
    minimum_sample_met: boolean;
    critical_failures: number;
    error_classes: Record<string, number>;
  };
  system_quality: {
    total_accounts: number | null;
    actionability: LeadLensReport["actionability_summary"] | null;
    delivery_readiness: LeadLensReport["delivery_readiness"] | null;
    report_quality_score: number | null;
    evidence_quality: LeadLensReport["evidence_quality_counts"] | null;
    defensible_opportunities: number | null;
    preliminary_channel_accounts: number | null;
  };
  client_signal: PilotFeedback | null;
  claims_allowed: string[];
  claims_prohibited: string[];
  blockers: string[];
  next_action: string;
}

const VALID_VERDICTS = new Set<HumanVerdict>(["true_positive", "false_positive", "needs_validation", "false_negative_visible", "correct_rejection"]);

export function buildPilotScorecard(input: { report?: LeadLensReport | null; adjudication: AdjudicationRow[]; feedback?: PilotFeedback | null }): PilotScorecard {
  const rows = input.adjudication.filter(r => VALID_VERDICTS.has((r.verdict ?? "") as HumanVerdict));
  const count = (v: HumanVerdict) => rows.filter(r => r.verdict === v).length;
  const truePositives = count("true_positive");
  const falsePositives = count("false_positive");
  const needsValidation = count("needs_validation");
  const judgedEmissions = truePositives + falsePositives + needsValidation;
  const precisionDenominator = truePositives + falsePositives;
  const observedPrecision = precisionDenominator > 0 ? truePositives / precisionDenominator : null;
  const criticalFailures = rows.filter(r => (r.severity ?? "").toLowerCase() === "critical").length;
  const errorClasses: Record<string, number> = {};
  for (const row of rows) if (row.error_class?.trim()) errorClasses[row.error_class.trim()] = (errorClasses[row.error_class.trim()] ?? 0) + 1;

  const minimumSampleMet = judgedEmissions >= 5;
  const processed = input.report?.processed_leads;
  const defensibleOpportunities = processed ? processed.filter(l => l.candidate.opportunity_kind !== "channel_fit"
    || ["strong", "moderate"].includes(l.candidate.channel_evidence_grade ?? "")).length : null;
  const preliminaryChannelAccounts = processed ? processed.filter(l => l.candidate.opportunity_kind === "channel_fit"
    && !["strong", "moderate"].includes(l.candidate.channel_evidence_grade ?? "")).length : null;
  const blockers: string[] = [];
  if (!input.report) blockers.push("No real report artifact was supplied.");
  if (!minimumSampleMet) blockers.push(`Only ${judgedEmissions}/5 emitted opportunities have a valid human verdict.`);
  if (criticalFailures > 0) blockers.push(`${criticalFailures} critical human-review failure(s) invalidate the batch.`);
  if (!input.feedback) blockers.push("Client debrief feedback is missing.");
  if (input.report?.delivery_readiness?.status === "blocked") blockers.push("The report delivery gate is blocked.");
  if ((input.report?.total_leads ?? 0) > 0 && defensibleOpportunities === 0) blockers.push("The report has zero defensible opportunities; preliminary channel hypotheses do not count.");

  let status: PilotScorecard["status"] = "insufficient_data";
  if (criticalFailures > 0 || input.report?.delivery_readiness?.status === "blocked" || defensibleOpportunities === 0) status = "failed";
  else if (input.report && minimumSampleMet && input.feedback && observedPrecision !== null && observedPrecision >= 0.8) status = "promising";

  // `validated` deliberately requires aggregation across multiple independent
  // pilots, which a single-run scorecard cannot establish.
  const claimsAllowed = [
    `This pilot contains ${judgedEmissions} human-adjudicated emitted opportunities.`,
    observedPrecision === null ? "Observed precision is not measurable yet." : `Observed precision in this reviewed sample is ${(observedPrecision * 100).toFixed(1)}% (${truePositives}/${precisionDenominator}).`,
  ];
  const claimsProhibited = [
    "LeadLens has proven market-wide recall.",
    "LeadLens guarantees meetings, pipeline or revenue.",
    "LeadLens is validated from fixtures or automated scores alone.",
    ...(status !== "promising" ? ["LeadLens has demonstrated production quality in this pilot."] : []),
  ];

  return {
    version: "pilot-scorecard-v1",
    status,
    human_quality: { judged_emissions: judgedEmissions, true_positives: truePositives, false_positives: falsePositives, needs_validation: needsValidation, observed_precision: observedPrecision, minimum_sample_met: minimumSampleMet, critical_failures: criticalFailures, error_classes: errorClasses },
    system_quality: {
      total_accounts: input.report?.total_leads ?? null,
      actionability: input.report?.actionability_summary ?? null,
      delivery_readiness: input.report?.delivery_readiness ?? null,
      report_quality_score: input.report?.report_quality_score ?? null,
      evidence_quality: input.report?.evidence_quality_counts ?? null,
      defensible_opportunities: defensibleOpportunities,
      preliminary_channel_accounts: preliminaryChannelAccounts,
    },
    client_signal: input.feedback ?? null,
    claims_allowed: claimsAllowed,
    claims_prohibited: claimsProhibited,
    blockers,
    next_action: criticalFailures > 0 ? "Root-cause every critical failure, add regression coverage, and rerun before delivery." : !minimumSampleMet ? "Complete human adjudication for at least five emitted opportunities." : !input.feedback ? "Complete the client debrief and attach feedback.json." : "Repeat the same ICP across Preview and Brief and compare decision value.",
  };
}
