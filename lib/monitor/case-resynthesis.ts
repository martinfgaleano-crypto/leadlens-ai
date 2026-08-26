// ─── Canonical Opportunity Case re-synthesis for recurring reviews ────────────
//
// A recurring review does NOT decide with ad-hoc transition rules. When there is
// material new information, it rebuilds the CURRENT Case through the SAME canonical
// engine used elsewhere — `opportunityTest` — over the validated current evidence,
// then Account Memory (diffAccountCase) compares to the predecessor. Current Case
// first, history second (§29).
//
// Guard: with NO material new information (only rediscovered / no-news), the prior
// decision is RETAINED — the Case is not re-decided purely from the passage of
// time (aging alone ≠ weakened Case). Freshness is surfaced, not forced.

import type { DecisionState, Strength } from "@/lib/deliverable/deliverable-view-model";
import type { AccountReviewSnapshot } from "@/lib/deliverable/account-memory";
import { opportunityTest, type OppStatus } from "@/lib/discovery/opportunity-test";
import type { DeltaEvidenceResult, AcceptedEvent } from "./delta-research";

export type DecisionSource = "canonical_opportunity_test" | "retained_no_material_change" | "fallback_conservative";

export interface ResynthesizedCase {
  decision: DecisionState;
  decisionSource: DecisionSource;
  verdictStatus: OppStatus | null;
  reasons: string[];
  fit: Strength | null;
  timing: Strength | null;
  evidence: Strength | null;
  hasMaterialCounter: boolean;
  remainingDecisionCritical: string[];
  freshnessGap: boolean;
}

const STATUS_DECISION: Record<OppStatus, DecisionState> = { opportunity: "prioritize", investigate: "validate", monitor: "monitor", reject: "hold" };
const weaken = (s: Strength | null): Strength | null => s === "Strong" ? "Moderate" : s === "Moderate" ? "Limited" : s;
const strengthen = (s: Strength | null): Strength | null => s === "Limited" ? "Moderate" : s === "Moderate" ? "Strong" : s;
const latest = (evts: AcceptedEvent[]): AcceptedEvent | null => evts.slice().sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())[0] ?? null;

/**
 * Re-synthesize the current Case decision from validated deltas. `now` governs the
 * canonical engine's own recency/staleness logic.
 */
export function resynthesizeCase(prior: AccountReviewSnapshot, delta: DeltaEvidenceResult, now: Date): ResynthesizedCase {
  const remainingDecisionCritical = prior.decisionCriticalThemeKeys.filter((k) => !delta.resolvedValidationKeys.includes(k));
  const independentSupportNew = [...delta.acceptedEvents, ...delta.historicalEvidence].some((e) => e.independentSupport);

  const hasMaterialNewInfo = delta.acceptedEvents.length > 0 || delta.historicalEvidence.length > 0 || delta.hasMaterialCounter || delta.resolvedValidationKeys.length > 0;

  // No material new info → RETAIN prior decision (do not re-decide from aging).
  if (!hasMaterialNewInfo) {
    return {
      decision: prior.decision, decisionSource: "retained_no_material_change", verdictStatus: null,
      reasons: ["no_material_new_information"],
      fit: prior.fit, timing: prior.timing, evidence: prior.evidence,
      hasMaterialCounter: false, remainingDecisionCritical, freshnessGap: delta.freshnessGap,
    };
  }

  // Build the canonical input from the strongest current validated event.
  const signalEvent = latest(delta.acceptedEvents) ?? latest(delta.historicalEvidence);
  const source = signalEvent?.origins[0] ?? prior.evidenceOrigins[0] ?? "unknown.com";
  const verdict = opportunityTest({
    company: prior.accountId,
    company_from_universe: true,
    signal_summary: signalEvent ? `${signalEvent.kind} on ${signalEvent.eventDate}` : "monitored account — prior verified change",
    signal_type: signalEvent?.kind ?? null,
    signal_date: signalEvent?.eventDate ?? (prior.changeKeys[0]?.split(":")[1] ?? null),
    date_confidence: signalEvent ? "high" : "medium",
    source_url: `https://${source}`,
    source_type: "news",
    company_in_content: true,
    grounded: true,
    matches_needs_family: true,
    geography_confirmed: true,
    region_required: false,
    corporate_identity_verified: true,
  });

  let decision = STATUS_DECISION[verdict.status];
  let decisionSource: DecisionSource = "canonical_opportunity_test";
  const reasons: string[] = [`opportunity_test_${verdict.status}`, ...verdict.soft_flags];

  // Fallback guard: a positive event that hard-rejects for a NON-temporal input
  // reason is an input artifact, not a real Case outcome — retain prior, flagged.
  if (verdict.status === "reject" && delta.acceptedEvents.length > 0
    && !verdict.hard_blockers.some((b) => /stale|no_valid_date|no_material_event/.test(b))) {
    decision = prior.decision; decisionSource = "fallback_conservative"; reasons.push("fallback_input_artifact");
  }

  // Decision-critical unknowns cap the decision at Validate (cannot Prioritize with
  // an open decision-critical question).
  if (remainingDecisionCritical.length > 0 && decision === "prioritize") { decision = "validate"; reasons.push("open_decision_critical_caps_at_validate"); }
  // Material counterevidence weakens Prioritize/Monitor to Validate (needs re-check).
  if (delta.hasMaterialCounter && (decision === "prioritize" || decision === "monitor")) { decision = "validate"; reasons.push("material_counterevidence_requires_revalidation"); }

  const evidence = delta.hasMaterialCounter ? weaken(prior.evidence) : (independentSupportNew ? strengthen(prior.evidence) : prior.evidence);
  // Timing derives ONLY from an observed post-review dated event.
  const timing = delta.acceptedEvents.length > 0 && !delta.hasMaterialCounter ? strengthen(prior.timing) : prior.timing;

  return {
    decision, decisionSource, verdictStatus: verdict.status, reasons,
    fit: prior.fit, timing, evidence,
    hasMaterialCounter: delta.hasMaterialCounter, remainingDecisionCritical, freshnessGap: delta.freshnessGap,
  };
}
