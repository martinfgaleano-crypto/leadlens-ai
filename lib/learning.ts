import type {
  FeedbackSignal,
  FeedbackEffect,
  ProcessedLead,
  LeadSearchCriteria,
  LeadCandidate,
  VaultPattern,
} from "@/types";
import { matchVaultPatterns } from "@/lib/vault/feedback-vault";

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
  // Stub — pre-discovery filter, not yet active.
  // Post-qualification vault hints are applied by applyVaultHints() instead.
  return candidates;
}

// ─── applyVaultHints ──────────────────────────────────────────────────────────
// Post-qualification pass: enriches ProcessedLead.learning with vault metadata.
// NEVER changes fit_score, category, or outreach content.
// Safe to call with empty patterns — returns leads unchanged.

export function applyVaultHints(
  leads: ProcessedLead[],
  vaultPatterns: VaultPattern[]
): ProcessedLead[] {
  if (vaultPatterns.length === 0) return leads;

  return leads.map(lead => {
    const industry = lead.candidate.industry ?? "";
    if (!industry || !lead.learning) return lead;

    const { positive, negative } = matchVaultPatterns(industry, vaultPatterns);

    // Only apply hints from vault_ready patterns (meets minimum threshold)
    const readyPositive = positive?.vault_ready ? positive : undefined;
    const readyNegative = negative?.vault_ready ? negative : undefined;

    if (!readyPositive && !readyNegative) return lead;

    const parts: string[] = [];
    if (readyPositive) {
      parts.push(
        `Vault: ${readyPositive.signal_count} positive signal${readyPositive.signal_count !== 1 ? "s" : ""} ` +
        `for "${readyPositive.industry}" (${readyPositive.confidence} confidence)`
      );
    }
    if (readyNegative) {
      parts.push(
        `Vault caution: ${readyNegative.signal_count} negative signal${readyNegative.signal_count !== 1 ? "s" : ""} ` +
        `for "${readyNegative.industry}" — review before outreach`
      );
    }

    const vault_matched_patterns = [
      ...(readyPositive?.top_signals ?? []),
      ...(readyNegative?.top_signals.map(s => `⚠ ${s}`) ?? []),
    ];

    const vault_confidence = readyPositive?.confidence ?? readyNegative?.confidence ?? "low";

    return {
      ...lead,
      learning: {
        ...lead.learning,
        vault_hint_applied: true,
        vault_positive_match: !!readyPositive,
        vault_negative_match: !!readyNegative,
        vault_reason: parts.join(". "),
        vault_confidence,
        vault_matched_patterns,
      },
    };
  });
}
