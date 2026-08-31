// ─── Canonical Opportunity Case synthesis authority (one Case engine) ─────────
//
// The SINGLE decision authority for a validated set of intelligence. Both initial
// and recurring reviews converge here: they each map their validated intelligence
// into one `CanonicalCaseInput`, and this function decides Fit/Timing/Evidence/
// Decision using the canonical `opportunityTest` engine plus principled caps. It
// builds the CURRENT Case only — Account Memory (diffAccountCase) does the history.
//
// Doctrines enforced: no observed post-review event → no Timing boost; an open
// decision-critical question caps at Validate; material counterevidence caps at
// Validate; event existence alone never forces Prioritize.

import type { DecisionState, Strength } from "@/lib/deliverable/deliverable-view-model";
import { opportunityTest, type OppStatus } from "@/lib/discovery/opportunity-test";

export interface CanonicalCaseInput {
  accountId: string;
  /** Identity already established (known account / verified universe). */
  identityVerified: boolean;
  fromUniverse: boolean;
  /** Strongest current VALIDATED signal for the account. */
  signalKind: string | null;
  signalDate: string | null;        // event date ISO or null
  dateConfidence: "high" | "medium" | "low" | "none";
  sourceHost: string | null;
  materialEvent: boolean;
  hasMaterialCounter: boolean;
  openDecisionCritical: string[];
  priorFit: Strength | null;
  priorTiming: Strength | null;
  priorEvidence: Strength | null;
  independentSupportNew: boolean;
  /** Timing may only strengthen from an OBSERVED post-review dated event. */
  hasPostReviewEvent: boolean;
  geographyConfirmed: boolean;
  regionRequired: boolean;
}

export type CanonicalDecisionSource = "canonical_opportunity_test" | "fallback_conservative";

export interface CanonicalCase {
  decision: DecisionState;
  decisionSource: CanonicalDecisionSource;
  verdictStatus: OppStatus;
  reasons: string[];
  fit: Strength | null;
  timing: Strength | null;
  evidence: Strength | null;
  remainingDecisionCritical: string[];
  hasMaterialCounter: boolean;
}

const STATUS_DECISION: Record<OppStatus, DecisionState> = { opportunity: "prioritize", investigate: "validate", monitor: "monitor", reject: "hold" };
const weaken = (s: Strength | null): Strength | null => s === "Strong" ? "Moderate" : s === "Moderate" ? "Limited" : s;
const strengthen = (s: Strength | null): Strength | null => s === "Limited" ? "Moderate" : s === "Moderate" ? "Strong" : s;

/**
 * THE canonical status → Decision mapping + caps, shared by BOTH the recurring
 * synthesis and the initial deliverable (via `decisionOf`). This is the single
 * final Decision authority — there is no independent second mapping.
 *   • opportunity→Prioritize, investigate→Validate, monitor→Monitor, reject→Hold
 *   • an open decision-critical question caps at Validate;
 *   • material counterevidence caps a Prioritize/Monitor at Validate.
 */
export function caseDecision(status: OppStatus, openDecisionCritical: string[] = [], hasMaterialCounter = false): { decision: DecisionState; reasons: string[] } {
  let decision = STATUS_DECISION[status];
  const reasons: string[] = [`opportunity_test_${status}`];
  if (openDecisionCritical.length > 0 && decision === "prioritize") { decision = "validate"; reasons.push("open_decision_critical_caps_at_validate"); }
  if (hasMaterialCounter && (decision === "prioritize" || decision === "monitor")) { decision = "validate"; reasons.push("material_counterevidence_requires_revalidation"); }
  return { decision, reasons };
}

/** THE canonical Case decision. Deterministic. */
export function synthesizeCase(input: CanonicalCaseInput): CanonicalCase {
  const verdict = opportunityTest({
    company: input.accountId,
    company_from_universe: input.fromUniverse,
    signal_summary: input.signalKind ? `${input.signalKind}${input.signalDate ? ` on ${input.signalDate}` : ""}` : null,
    signal_type: input.signalKind,
    signal_date: input.signalDate,
    date_confidence: input.dateConfidence,
    source_url: input.sourceHost ? `https://${input.sourceHost}` : null,
    source_type: "news",
    company_in_content: true,
    grounded: true,
    matches_needs_family: input.materialEvent,
    geography_confirmed: input.geographyConfirmed,
    region_required: input.regionRequired,
    corporate_identity_verified: input.identityVerified,
  });

  let decisionSource: CanonicalDecisionSource = "canonical_opportunity_test";
  // A material event that hard-rejects for a NON-temporal input reason is an input
  // artifact, not a real Case outcome → conservative fallback, flagged.
  const artifactReject = verdict.status === "reject" && input.materialEvent
    && !verdict.hard_blockers.some((b) => /stale|no_valid_date|no_material_event/.test(b));

  const dec = caseDecision(artifactReject ? "monitor" : verdict.status, input.openDecisionCritical, input.hasMaterialCounter);
  let decision = dec.decision;
  const reasons: string[] = [...dec.reasons, ...verdict.hard_blockers.map(b => `hard_blocker_${b}`), ...verdict.soft_flags];
  if (artifactReject) { decisionSource = "fallback_conservative"; reasons.push("fallback_input_artifact"); }

  const remainingDecisionCritical = input.openDecisionCritical;

  const evidence = input.hasMaterialCounter ? weaken(input.priorEvidence) : (input.independentSupportNew ? strengthen(input.priorEvidence) : input.priorEvidence);
  const timing = input.hasPostReviewEvent && !input.hasMaterialCounter ? strengthen(input.priorTiming) : input.priorTiming;

  return { decision, decisionSource, verdictStatus: verdict.status, reasons, fit: input.priorFit, timing, evidence, remainingDecisionCritical, hasMaterialCounter: input.hasMaterialCounter };
}
