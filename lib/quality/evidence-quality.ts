import type {
  ProcessedLead,
  LeadLensReport,
  RecommendedActionType,
  EvidenceQualityLevel,
  AccountMemoryState,
} from "@/types";

// ─── Region confidence ─────────────────────────────────────────────────────────
// Max "medium" for 4 priority regions (Source Access Layer not yet implemented).
// "high" is intentionally never assigned until that layer exists.

const PRIORITY_REGION_PATTERNS = [
  /\b(united states|u\.s\.a?|usa|us)\b/i,
  /\b(canada|canadian)\b/i,
  /\b(colombia|colombian)\b/i,
  /\b(m[eé]xico|mexico|mexican)\b/i,
  /\b(united kingdom|u\.k\.|uk|england|scotland|wales|london|manchester|birmingham)\b/i,
  // US cities / states as proxies
  /\b(new york|california|texas|florida|chicago|los angeles|san francisco|seattle|boston|austin)\b/i,
];

export function getRegionConfidence(location?: string): "high" | "medium" | "low" {
  if (!location) return "low";
  const isPriority = PRIORITY_REGION_PATTERNS.some(re => re.test(location));
  return isPriority ? "medium" : "low";
  // "high" reserved for when Source Access Layer is implemented (SOURCE_STRATEGY.md §D)
}

// ─── Evidence inputs ──────────────────────────────────────────────────────────

export interface EvidenceInputs {
  source_count: number;
  signal_count: number;
  fresh_signal_count: number;         // always 0 today — signal_date/discovered_at not in schema
  source_types: string[];
  signal_age_days: number | null;
  freshness_score: number;
  evidence_confidence: number;
  source_confidence: "high" | "medium" | "low";
  region_confidence: "high" | "medium" | "low";
  buyer_seller_confusion_risk: "low" | "medium" | "high" | undefined;
  account_memory_state: AccountMemoryState | undefined;
}

export function extractEvidenceInputs(lead: ProcessedLead): EvidenceInputs {
  const discipline = lead.enrichment.evidence_discipline ?? [];
  const timingSignals = lead.enrichment.timing_signals ?? [];

  // Only verified_public_signal counts as an independent source.
  // website/directory/context-only entries never count here.
  const verified = discipline.filter(e => e.type === "verified_public_signal");
  const inferred = discipline.filter(e => e.type === "inferred_from_context");

  const source_count = verified.length;
  const source_types = verified.map(e => e.claim.slice(0, 60));

  // Non-generic, non-inferred timing signals
  const confirmSignals = timingSignals.filter(
    s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
  );
  const signal_count = confirmSignals.length;

  // fresh_signal_count is always 0 — signal_date/discovered_at fields don't exist
  const fresh_signal_count = 0;
  const signal_age_days = null;
  const freshness_score = 0;

  // evidence_confidence: weighted combination of research_confidence + source quality
  const rc = lead.enrichment.research_confidence ?? 0;
  const evidence_confidence = parseFloat(
    (rc * 0.6 + (verified.length > 0 ? 0.4 : inferred.length > 0 ? 0.15 : 0)).toFixed(3)
  );

  const source_confidence: "high" | "medium" | "low" =
    verified.length >= 2 ? "high" :
    verified.length === 1 ? "medium" :
    "low";

  const region_confidence = getRegionConfidence(lead.candidate.location);

  const buyer_seller_confusion_risk = lead.outreach.buyer_seller_confusion_risk;
  const account_memory_state = lead.learning?.account_memory_state;

  return {
    source_count,
    signal_count,
    fresh_signal_count,
    source_types,
    signal_age_days,
    freshness_score,
    evidence_confidence,
    source_confidence,
    region_confidence,
    buyer_seller_confusion_risk,
    account_memory_state,
  };
}

// ─── Classification ───────────────────────────────────────────────────────────

export function classifyEvidenceQuality(inputs: EvidenceInputs): EvidenceQualityLevel {
  const { source_count, fresh_signal_count, evidence_confidence,
          buyer_seller_confusion_risk, account_memory_state, region_confidence } = inputs;

  // Hard floor: no verified sources → insufficient
  if (source_count === 0) return "insufficient";

  let level: EvidenceQualityLevel;

  if (fresh_signal_count >= 1) {
    // Fresh timing signal path (unreachable today — kept for future Source Access Layer)
    level = source_count >= 2 ? "high" : "medium";
  } else {
    // No verified fresh signal — best possible is "medium"
    level = (source_count >= 2 && evidence_confidence >= 0.6) ? "medium" : "low";
  }

  // Caps — applied in order from most to least restrictive
  if (buyer_seller_confusion_risk === "high") {
    level = cap(level, "low");
  }
  if (account_memory_state === "repeated_without_new_signal") {
    level = cap(level, "medium");
  }
  if (buyer_seller_confusion_risk === "medium") {
    level = cap(level, "medium");
  }
  if (region_confidence === "low") {
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

// ─── Evidence summary text ─────────────────────────────────────────────────────

export function buildEvidenceSummary(level: EvidenceQualityLevel, inputs: EvidenceInputs): string {
  const { source_count, signal_count, region_confidence, source_confidence } = inputs;

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
      const level = classifyEvidenceQuality(inputs);
      const summary = buildEvidenceSummary(level, inputs);

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
          ...lead.learning,
          agent_confidence: lead.learning?.agent_confidence ?? 0,
          qc_flags: lead.learning?.qc_flags ?? [],
          genericness_risk: lead.learning?.genericness_risk ?? "medium",
          hallucination_risk: lead.learning?.hallucination_risk ?? "low",
          evidence_discipline_summary: lead.learning?.evidence_discipline_summary ?? "weak",
          signal_patterns: lead.learning?.signal_patterns ?? [],
          improvement_notes: lead.learning?.improvement_notes ?? [],
          evidence_quality: level,
          source_count: inputs.source_count,
          signal_count: inputs.signal_count,
          fresh_signal_count: inputs.fresh_signal_count,
          source_types: inputs.source_types,
          signal_age_days: inputs.signal_age_days,
          freshness_score: inputs.freshness_score,
          evidence_confidence: inputs.evidence_confidence,
          source_confidence: inputs.source_confidence,
          region_confidence: inputs.region_confidence,
          insufficient_evidence_reason: insufficientReason,
          evidence_summary: summary,
          recommended_action_guardrail_applied: guardrailApplied,
          original_recommended_action: originalAction,
          guardrailed_recommended_action: guardrailedAction,
        },
      };
    } catch {
      // Best-effort — never block the pipeline
      return lead;
    }
  });
}

// ─── Apply guardrails to ranked_opportunities in final report ─────────────────

export function applyEvidenceQualityToReport(report: LeadLensReport): LeadLensReport {
  try {
    // Build a map from lead_id → evidence quality metadata
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

    // Patch ranked_opportunities recommended_action
    const patched = (report.ranked_opportunities ?? []).map(opp => {
      const qm = qualityMap.get(opp.lead_id);
      if (!qm) return opp;

      const result = applyRecommendedActionGuardrail(qm.level, opp.recommended_action);
      return {
        ...opp,
        recommended_action: result.action,
        evidence_quality: qm.level,
        original_recommended_action: result.applied ? opp.recommended_action : undefined,
        recommended_action_guardrail_applied: result.applied,
      };
    });

    // Count by level
    const counts = { high: 0, medium: 0, low: 0, insufficient: 0 };
    for (const lead of report.processed_leads) {
      const level = lead.learning?.evidence_quality;
      if (level) counts[level]++;
    }

    return {
      ...report,
      ranked_opportunities: patched,
      evidence_quality_counts: counts,
    };
  } catch {
    // Best-effort — return original report unchanged
    return report;
  }
}
