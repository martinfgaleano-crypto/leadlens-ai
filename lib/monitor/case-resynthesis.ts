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
import type { OppStatus } from "@/lib/discovery/opportunity-test";
import { synthesizeCase, type CanonicalCaseInput } from "./canonical-case";
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

const latest = (evts: AcceptedEvent[]): AcceptedEvent | null => evts.slice().sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())[0] ?? null;

/** Map a recurring review's validated deltas into the CANONICAL Case input, so
 *  recurring and initial reviews share one synthesis authority (§22–24). */
export function recurringToCanonicalInput(prior: AccountReviewSnapshot, delta: DeltaEvidenceResult): CanonicalCaseInput {
  const signalEvent = latest(delta.acceptedEvents) ?? latest(delta.historicalEvidence);
  return {
    accountId: prior.accountId,
    identityVerified: true, fromUniverse: true,
    signalKind: signalEvent?.kind ?? null,
    signalDate: signalEvent?.eventDate ?? (prior.changeKeys[0]?.split(":")[1] ?? null),
    dateConfidence: signalEvent ? "high" : "medium",
    sourceHost: signalEvent?.origins[0] ?? prior.evidenceOrigins[0] ?? "unknown.com",
    materialEvent: true,
    hasMaterialCounter: delta.hasMaterialCounter,
    openDecisionCritical: prior.decisionCriticalThemeKeys.filter((k) => !delta.resolvedValidationKeys.includes(k)),
    priorFit: prior.fit, priorTiming: prior.timing, priorEvidence: prior.evidence,
    independentSupportNew: [...delta.acceptedEvents, ...delta.historicalEvidence].some((e) => e.independentSupport),
    hasPostReviewEvent: delta.acceptedEvents.length > 0,
    geographyConfirmed: true, regionRequired: false,
  };
}

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

  // Delegate to the ONE canonical Case authority (shared with initial reviews).
  const canonical = synthesizeCase(recurringToCanonicalInput(prior, delta));
  // A canonical fallback under a real material event → retain prior decision, flagged.
  const decision = canonical.decisionSource === "fallback_conservative" ? prior.decision : canonical.decision;
  const decisionSource: DecisionSource = canonical.decisionSource === "fallback_conservative" ? "fallback_conservative" : "canonical_opportunity_test";

  return {
    decision, decisionSource, verdictStatus: canonical.verdictStatus, reasons: canonical.reasons,
    fit: canonical.fit, timing: canonical.timing, evidence: canonical.evidence,
    hasMaterialCounter: delta.hasMaterialCounter, remainingDecisionCritical, freshnessGap: delta.freshnessGap,
  };
}
