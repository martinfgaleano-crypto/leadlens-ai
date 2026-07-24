export type DeliveryReadinessStatus = "ready" | "review_required" | "blocked";

export interface DeliveryReadinessInput {
  total_accounts: number;
  report_quality_score: number;
  act_now: number;
  validate_first: number;
  monitor: number;
  exclude: number;
  insufficient_evidence: number;
  failed_qc: number;
  novel_accounts?: number;
  obvious_accounts?: number;
  low_discovery_value?: number;
  /** Accounts backed by a dated timing signal or moderate/strong channel proof. */
  defensible_opportunities?: number;
  preliminary_channel_accounts?: number;
}

export interface DeliveryReadinessDecision {
  status: DeliveryReadinessStatus;
  reasons: string[];
  required_actions: string[];
}

/** Final safety gate for a customer-facing report. It never hides a report;
 * it states whether human delivery is safe, needs review, or is blocked. */
export function evaluateReportDeliveryReadiness(input: DeliveryReadinessInput): DeliveryReadinessDecision {
  const reasons: string[] = [];
  const required_actions: string[] = [];

  if (input.total_accounts === 0) {
    reasons.push("The report contains no analyzed accounts.");
    required_actions.push("Re-run discovery with a viable ICP and source configuration.");
  }
  if (input.report_quality_score < 60) {
    reasons.push(`Report quality score ${input.report_quality_score}/100 is below the delivery floor.`);
    required_actions.push("Resolve the report-level quality findings before delivery.");
  }
  if (input.failed_qc > 0) {
    reasons.push(`${input.failed_qc} account(s) failed outreach quality control.`);
    required_actions.push("Remove or repair every QC-failed account.");
  }
  if (input.exclude === input.total_accounts && input.total_accounts > 0) {
    reasons.push("Every analyzed account is excluded.");
    required_actions.push("Refine the ICP or discovery pool and generate a new report.");
  }
  if (input.total_accounts > 0 && input.novel_accounts === 0) {
    reasons.push("The report contains no non-obvious account with meaningful discovery value.");
    required_actions.push("Expand discovery into specialized, regional or emerging accounts before charging or delivery.");
  }
  if ((input.obvious_accounts ?? 0) > 1) {
    reasons.push(`${input.obvious_accounts} obvious account(s) exceed the paid-report benchmark quota of one.`);
    required_actions.push("Keep at most one obvious account as context and replace the rest with novel opportunities.");
  }
  if (input.total_accounts > 0 && input.low_discovery_value === input.total_accounts) {
    reasons.push("Every account has low discovery value.");
    required_actions.push("Do not deliver a list the client could produce without LeadLens.");
  }
  if (input.total_accounts > 0 && input.defensible_opportunities === 0) {
    reasons.push("The report contains no defensible opportunity; all surviving accounts are preliminary hypotheses.");
    required_actions.push("Obtain a dated company event or moderate/strong live channel evidence before paid delivery.");
  }
  if (reasons.length > 0) return { status: "blocked", reasons, required_actions };

  if (input.act_now === 0) {
    reasons.push("No account cleared the act-now evidence threshold.");
    required_actions.push("Review validation candidates and set client expectations before delivery.");
  }
  if (input.insufficient_evidence > 0) {
    reasons.push(`${input.insufficient_evidence} account(s) have insufficient evidence.`);
    required_actions.push("Confirm they are clearly labeled as monitor/watchlist only.");
  }
  if ((input.preliminary_channel_accounts ?? 0) > 0) {
    reasons.push(`${input.preliminary_channel_accounts} account(s) have preliminary channel evidence only.`);
    required_actions.push("Keep preliminary channel accounts in monitor and do not count them toward the delivery minimum.");
  }
  if (input.report_quality_score < 80) {
    reasons.push(`Report quality score ${input.report_quality_score}/100 requires human review.`);
    required_actions.push("Complete the recommended fixes before client handoff.");
  }
  if (reasons.length > 0) return { status: "review_required", reasons, required_actions };

  return {
    status: "ready",
    reasons: ["At least one account is actionable and all report-level delivery floors passed."],
    required_actions: [],
  };
}
