import type {
  FeedbackSignal,
  FeedbackEffect,
  ProcessedLead,
  LeadSearchCriteria,
  LeadCandidate,
} from "@/types";

// ─── deriveFeedbackEffects ────────────────────────────────────────────────────
// Converts a user feedback signal on a specific account into a structured
// learning event. Direction + save_as_reusable guide future Vault integration.

export function deriveFeedbackEffects(
  signal: FeedbackSignal,
  lead: ProcessedLead
): FeedbackEffect {
  const industry       = lead.candidate.industry ?? "unknown";
  const signalPatterns = lead.learning?.signal_patterns ?? [];
  const patternSummary = signalPatterns[0]?.slice(0, 60) ?? "no confirmed signal";

  switch (signal) {
    case "useful":
      return {
        signal,
        affects_pattern:  `${industry} + "${patternSummary}"`,
        direction:        "strengthen",
        affected_segment: industry,
        save_as_reusable: false,
      };

    case "meeting_booked":
      return {
        signal,
        affects_pattern:  `${industry} + "${patternSummary}" → meeting booked`,
        direction:        "strengthen",
        affected_segment: industry,
        save_as_reusable: true,
      };

    case "replied":
      return {
        signal,
        affects_pattern:  `${industry} + "${patternSummary}" → reply received`,
        direction:        "strengthen",
        affected_segment: industry,
        save_as_reusable: true,
      };

    case "contacted":
      return {
        signal,
        affects_pattern:  `${industry} + "${patternSummary}" → contacted`,
        direction:        "strengthen",
        affected_segment: industry,
        save_as_reusable: false,
      };

    case "add_to_vault":
      return {
        signal,
        affects_pattern:  `${industry} + "${patternSummary}" → vault-worthy angle`,
        direction:        "strengthen",
        affected_segment: industry,
        save_as_reusable: true,
      };

    case "wrong_fit":
      return {
        signal,
        affects_pattern:  `${industry} → ICP mismatch`,
        direction:        "weaken",
        affected_segment: industry,
        save_as_reusable: false,
      };

    case "not_useful":
    case "irrelevant":
      return {
        signal,
        affects_pattern:  `${industry} + "${patternSummary}" → low value`,
        direction:        "weaken",
        affected_segment: industry,
        save_as_reusable: false,
      };

    case "generic":
      return {
        signal,
        affects_pattern:  `outreach angle too generic for ${industry}`,
        direction:        "weaken",
        affected_segment: undefined,
        save_as_reusable: false,
      };

    case "exclude_similar":
      return {
        signal,
        affects_pattern:  `${industry} segment → exclude similar`,
        direction:        "weaken",
        affected_segment: industry,
        save_as_reusable: false,
      };
  }
}

// ─── applyLearningHints ───────────────────────────────────────────────────────
// Future hook: adjusts account candidate list based on accumulated Vault patterns.
//
// When to activate (not yet wired):
//   - Vault has ≥3 FeedbackEffect patterns for the same ICP segment
//   - Called between Account Discovery and Signal Detection in pipeline.ts
//
// Planned behavior when active:
//   1. Boost confidence_score for candidates matching "strengthen" patterns
//   2. Flag candidates matching "weaken" patterns for early deprioritization
//   3. Inject early_signal_hint for candidates matching vault-worthy patterns

export function applyLearningHints(
  _criteria: LeadSearchCriteria,
  candidates: LeadCandidate[],
  _feedbackPatterns: FeedbackEffect[]
): LeadCandidate[] {
  // Stub — returns candidates unchanged until Vault has enough signal volume.
  // Replace this body when vault pattern queries are wired in lib/vault/.
  return candidates;
}
