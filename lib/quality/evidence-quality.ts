import type {
  ProcessedLead,
  LeadLensReport,
  RecommendedActionType,
  EvidenceQualityLevel,
  AccountMemoryState,
  SourceType,
  RegionConfidence,
} from "@/types";

import { getRegionConfidence as getRegionConf } from "../sources/signal-taxonomy";

// ─── Region confidence (delegates to signal-taxonomy) ─────────────────────────
// Exported for backward compatibility — prefer importing from signal-taxonomy directly.

export function getRegionConfidence(location?: string | null): RegionConfidence {
  return getRegionConf(location);
}

// ─── Evidence inputs ──────────────────────────────────────────────────────────

export interface EvidenceInputs {
  source_count: number;
  signal_count: number;
  fresh_signal_count: number;
  source_types?: SourceType[];
  signal_age_days: number | null;
  freshness_score: number;
  evidence_confidence: number;
  source_confidence: "high" | "medium" | "low";
  region_confidence: RegionConfidence;
  buyer_seller_confusion_risk: "low" | "medium" | "high" | undefined;
  account_memory_state: AccountMemoryState | undefined;
  is_context_only?: boolean;
  signal_date?: string | null;
}

/**
 * Extract evidence quality inputs for a lead.
 * If the Source Access & Freshness Layer has already run (source_layer_applied),
 * consume its pre-computed fields instead of re-deriving them.
 */
export function extractEvidenceInputs(lead: ProcessedLead): EvidenceInputs {
  const discipline    = lead.enrichment.evidence_discipline ?? [];
  const timingSignals = lead.enrichment.timing_signals ?? [];
  const lm            = lead.learning;

  // evidence_confidence is always computed by EQ (not Source Layer)
  const verified  = discipline.filter(e => e.type === "verified_public_signal");
  const inferred  = discipline.filter(e => e.type === "inferred_from_context");
  const rc        = lead.enrichment.research_confidence ?? 0;
  const evidence_confidence = parseFloat(
    (rc * 0.6 + (verified.length > 0 ? 0.4 : inferred.length > 0 ? 0.15 : 0)).toFixed(3)
  );

  if (lm?.source_layer_applied) {
    // Source Layer has run — consume its pre-computed fields.
    const sc = lm.source_count ?? 0;
    return {
      source_count:              sc,
      signal_count:              lm.signal_count ?? 0,
      fresh_signal_count:        lm.fresh_signal_count ?? 0,
      source_types:              lm.source_types,
      signal_age_days:           lm.signal_age_days ?? null,
      freshness_score:           lm.freshness_score ?? 0,
      evidence_confidence,
      source_confidence:         sc >= 2 ? "high" : sc === 1 ? "medium" : "low",
      region_confidence:         (lm.region_confidence as RegionConfidence | undefined) ?? "unknown",
      buyer_seller_confusion_risk: lead.outreach.buyer_seller_confusion_risk,
      account_memory_state:      lm.account_memory_state,
      is_context_only:           lm.is_context_only,
      signal_date:               lm.signal_date,
    };
  }

  // Fallback: Source Layer hasn't run — derive from raw enrichment.
  const source_count = verified.length;

  const confirmSignals = timingSignals.filter(
    s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
  );
  const signal_count = confirmSignals.length;

  // v0: signal_date not yet in schema — always null/0
  const fresh_signal_count = 0;
  const signal_age_days    = null;
  const freshness_score    = 0;

  const source_confidence: "high" | "medium" | "low" =
    source_count >= 2 ? "high" : source_count === 1 ? "medium" : "low";

  const region_confidence = getRegionConf(lead.candidate.location);

  return {
    source_count,
    signal_count,
    fresh_signal_count,
    source_types:              undefined, // set by Source Layer, not EQ fallback
    signal_age_days,
    freshness_score,
    evidence_confidence,
    source_confidence,
    region_confidence,
    buyer_seller_confusion_risk: lead.outreach.buyer_seller_confusion_risk,
    account_memory_state:      lm?.account_memory_state,
    is_context_only:           undefined, // unknown in fallback
    signal_date:               null,
  };
}

// ─── Classification ───────────────────────────────────────────────────────────

export function classifyEvidenceQuality(inputs: EvidenceInputs): EvidenceQualityLevel {
  const {
    source_count, fresh_signal_count, evidence_confidence,
    buyer_seller_confusion_risk, account_memory_state,
    region_confidence, is_context_only, signal_date,
  } = inputs;

  // Hard floor: no verified sources → insufficient
  if (source_count === 0) return "insufficient";

  let level: EvidenceQualityLevel;

  if (fresh_signal_count >= 1 && signal_date) {
    // Fresh timing signal with confirmed date — enabled by Source Layer v1+
    level = source_count >= 2 ? "high" : "medium";
  } else {
    // No confirmed fresh signal — best possible today is "medium"
    level = (source_count >= 2 && evidence_confidence >= 0.6) ? "medium" : "low";
  }

  // Caps — applied in order from most to least restrictive
  if (buyer_seller_confusion_risk === "high") {
    level = cap(level, "low");
  }
  // Context-only sources cannot support "high" regardless of other signals
  if (is_context_only) {
    level = cap(level, "medium");
  }
  if (account_memory_state === "repeated_without_new_signal") {
    level = cap(level, "medium");
  }
  if (buyer_seller_confusion_risk === "medium") {
    level = cap(level, "medium");
  }
  // Low or unknown region confidence is conservative
  if (region_confidence === "low" || region_confidence === "unknown") {
    level = cap(level, "medium");
  }

  return level;
}

function cap(current: EvidenceQualityLevel, max: EvidenceQualityLevel): EvidenceQualityLevel {
  const ORDER: EvidenceQualityLevel[] = ["insufficient", "low", "medium", "high"];
  const ci = ORDER.indexOf(current);
  const mi = ORDER.indexOf(max);
  return ci <= mi ? current : max;
}

// ─── Recommended action guardrail ─────────────────────────────────────────────

export function applyRecommendedActionGuardrail(
  level: EvidenceQualityLevel,
  action: RecommendedActionType
): { action: RecommendedActionType; applied: boolean } {
  switch (level) {
    case "high":
      return { action, applied: false };

    case "medium":
      if (action === "send_outreach_now") {
        return { action: "validate_source_first", applied: true };
      }
      return { action, applied: false };

    case "low":
      if (action === "send_outreach_now" || action === "validate_source_first") {
        return { action: "monitor_for_new_signal", applied: true };
      }
      return { action, applied: false };

    case "insufficient":
      if (action === "exclude" || action === "add_to_watchlist") {
        return { action, applied: false };
      }
      return { action: "add_to_watchlist", applied: true };
  }
}

// ─── Evidence summary ─────────────────────────────────────────────────────────

export function buildEvidenceSummary(level: EvidenceQualityLevel, inputs: EvidenceInputs): string {
  const { source_count, signal_count, region_confidence } = inputs;

  switch (level) {
    case "high":
      return `High evidence quality — ${source_count} independent source(s), confirmed timing signal, ${region_confidence} regional coverage.`;
    case "medium":
      return `Medium evidence quality — ${source_count} verified source(s), ${signal_count} timing signal(s). Validate before outreach.`;
    case "low":
      return `Low evidence quality — limited verified sources (${source_count}), no confirmed fresh signal. Monitor for new signal before acting.`;
    case "insufficient":
      return `Insufficient evidence — no verified independent sources found. Add to watchlist and revisit if new signals emerge.`;
  }
}

// ─── Apply hints to all leads ─────────────────────────────────────────────────

export function applyEvidenceQualityHints(leads: ProcessedLead[]): ProcessedLead[] {
  return leads.map(lead => {
    try {
      const inputs = extractEvidenceInputs(lead);
      const level  = classifyEvidenceQuality(inputs);
      const summary = buildEvidenceSummary(level, inputs);
      const sourceLayerApplied = lead.learning?.source_layer_applied ?? false;

      const originalAction = lead.enrichment.recommended_action;
      let guardrailApplied = false;
      let guardrailedAction: RecommendedActionType | undefined;
      if (originalAction) {
        const result = applyRecommendedActionGuardrail(level, originalAction);
        guardrailApplied = result.applied;
        guardrailedAction = result.action;
      }

      const insufficientReason =
        level === "insufficient"
          ? (inputs.source_count === 0 ? "No verified independent sources found." : "Evidence below minimum threshold.")
          : undefined;

      return {
        ...lead,
        learning: {
          // Required fields
          agent_confidence:            lead.learning?.agent_confidence ?? 0,
          qc_flags:                    lead.learning?.qc_flags ?? [],
          genericness_risk:            lead.learning?.genericness_risk ?? "medium",
          hallucination_risk:          lead.learning?.hallucination_risk ?? "low",
          evidence_discipline_summary: lead.learning?.evidence_discipline_summary ?? "weak",
          signal_patterns:             lead.learning?.signal_patterns ?? [],
          improvement_notes:           lead.learning?.improvement_notes ?? [],
          // Spread all prior layers (Vault, Account Memory, Source Layer, etc.)
          ...lead.learning,
          // EQ-owned fields — always set by this pass
          evidence_quality:            level,
          evidence_confidence:         inputs.evidence_confidence,
          source_confidence:           inputs.source_confidence,
          insufficient_evidence_reason: insufficientReason,
          evidence_summary:            summary,
          recommended_action_guardrail_applied: guardrailApplied,
          original_recommended_action: originalAction,
          guardrailed_recommended_action: guardrailedAction,
          // Source/freshness fields: set only when Source Layer hasn't run
          // (Source Layer values are more accurate; roundtrip via inputs when it has run)
          ...(sourceLayerApplied ? {} : {
            source_count:       inputs.source_count,
            signal_count:       inputs.signal_count,
            fresh_signal_count: inputs.fresh_signal_count,
            signal_age_days:    inputs.signal_age_days,
            freshness_score:    inputs.freshness_score,
            region_confidence:  inputs.region_confidence,
          }),
        },
      };
    } catch {
      return lead;
    }
  });
}

// ─── Apply guardrails to ranked_opportunities in final report ─────────────────

export function applyEvidenceQualityToReport(report: LeadLensReport): LeadLensReport {
  try {
    const qualityMap = new Map<string, {
      level: EvidenceQualityLevel;
      originalAction?: RecommendedActionType;
      guardrailApplied: boolean;
    }>();

    for (const lead of report.processed_leads) {
      const lm = lead.learning;
      if (lm?.evidence_quality) {
        qualityMap.set(lead.id, {
          level: lm.evidence_quality,
          originalAction: lm.original_recommended_action as RecommendedActionType | undefined,
          guardrailApplied: lm.recommended_action_guardrail_applied ?? false,
        });
      }
    }

    const patched = (report.ranked_opportunities ?? []).map(opp => {
      const qm = qualityMap.get(opp.lead_id);
      if (!qm) return opp;
      const result = applyRecommendedActionGuardrail(qm.level, opp.recommended_action);
      return {
        ...opp,
        recommended_action:                  result.action,
        evidence_quality:                    qm.level,
        original_recommended_action:         result.applied ? opp.recommended_action : undefined,
        recommended_action_guardrail_applied: result.applied,
      };
    });

    const counts = { high: 0, medium: 0, low: 0, insufficient: 0 };
    for (const lead of report.processed_leads) {
      const level = lead.learning?.evidence_quality;
      if (level) counts[level]++;
    }

    return { ...report, ranked_opportunities: patched, evidence_quality_counts: counts };
  } catch {
    return report;
  }
}
