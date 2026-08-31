import type { ProcessedLead } from "@/types";
import type { DecisionState } from "@/lib/deliverable/deliverable-view-model";

export type HoldReason =
  | "NO_CURRENT_EVENT" | "STALE_EVENT" | "INSUFFICIENT_EVIDENCE"
  | "LOW_FIT" | "WRONG_TARGET" | "INSUFFICIENT_COVERAGE"
  | "NO_MATERIALITY" | "STRUCTURAL_REJECT" | "OTHER_EXISTING_CANONICAL_REASON";

export interface AccountActionabilityFunnel {
  target_valid: boolean;
  company_identity_valid: boolean;
  research_coverage: "sufficient" | "partial" | "insufficient";
  search_results: number;
  material_event_candidates: number;
  temporal_valid_events: number;
  materiality_valid_events: number;
  evidence_valid: boolean;
  independent_support: boolean;
  fit_state: "strong" | "moderate" | "limited";
  timing_state: "strong" | "moderate" | "limited";
  final_decision: DecisionState | null;
  hold_reason: HoldReason | null;
}

export interface ActionabilityFunnelSummary {
  accounts: number;
  valid_targets: number;
  researched: number;
  event_candidates: number;
  temporal_valid: number;
  material_valid: number;
  evidence_valid: number;
  decisions: Record<DecisionState | "no_case", number>;
  hold_reasons: Record<HoldReason, number>;
}

export function deriveAccountActionabilityFunnel(
  lead: ProcessedLead,
  decision: DecisionState | null,
  reasons: string[] = [],
): AccountActionabilityFunnel {
  const telemetry = lead.enrichment.account_research;
  const structuralReject = lead.outreach.qc_status === "FAILED";
  const degraded = Boolean(telemetry?.enrichment_failed?.reason === "provider_degraded"
    || telemetry?.early_stop_reason === "providers_unavailable"
    || (telemetry && telemetry.provider_calls > 0 && telemetry.provider_calls === telemetry.provider_failures));
  const partial = Boolean(!degraded && telemetry && telemetry.provider_failures > 0);
  const events = telemetry?.validated_events ?? [];
  const materialEvents = events.filter((event) => event.materiality_valid);
  const temporalEvents = materialEvents.filter((event) => Boolean(event.event_date));
  const fitScore = lead.qualification.fit_score;
  const fit = fitScore >= 7 ? "strong" : fitScore >= 4 ? "moderate" : "limited";
  const timing = temporalEvents.length ? "moderate" : "limited";
  const targetValid = !structuralReject && Boolean(lead.candidate.company) && Boolean(lead.candidate.domain);
  const evidenceValid = temporalEvents.length > 0 && (telemetry?.evidence_accepted ?? 0) > 0;

  return {
    target_valid: targetValid,
    company_identity_valid: Boolean(lead.candidate.domain) && !structuralReject,
    research_coverage: degraded ? "insufficient" : partial ? "partial" : telemetry ? "sufficient" : "insufficient",
    search_results: telemetry?.results_seen ?? 0,
    material_event_candidates: events.length,
    temporal_valid_events: temporalEvents.length,
    materiality_valid_events: materialEvents.length,
    evidence_valid: evidenceValid,
    independent_support: evidenceValid && (telemetry?.corroborating_domains ?? 0) >= 1,
    fit_state: fit,
    timing_state: timing,
    final_decision: decision,
    hold_reason: decision === "hold" || decision === null
      ? classifyHoldReason({ structuralReject, targetValid, degraded, fit, events: events.length, temporal: temporalEvents.length, evidenceValid, reasons })
      : null,
  };
}

function classifyHoldReason(input: {
  structuralReject: boolean; targetValid: boolean; degraded: boolean;
  fit: "strong" | "moderate" | "limited"; events: number; temporal: number;
  evidenceValid: boolean; reasons: string[];
}): HoldReason {
  const reason = input.reasons.join(" ").toLowerCase();
  if (input.structuralReject) return "STRUCTURAL_REJECT";
  if (!input.targetValid) return "WRONG_TARGET";
  if (input.degraded) return "INSUFFICIENT_COVERAGE";
  if (input.fit === "limited") return "LOW_FIT";
  if (/stale|old event|freshness/.test(reason)) return "STALE_EVENT";
  if (input.events === 0) return "NO_CURRENT_EVENT";
  if (input.temporal === 0) return "STALE_EVENT";
  if (!input.evidenceValid) return "INSUFFICIENT_EVIDENCE";
  if (/material/.test(reason)) return "NO_MATERIALITY";
  return "OTHER_EXISTING_CANONICAL_REASON";
}

export function summarizeActionabilityFunnel(rows: AccountActionabilityFunnel[]): ActionabilityFunnelSummary {
  const decisions: ActionabilityFunnelSummary["decisions"] = { prioritize: 0, validate: 0, monitor: 0, hold: 0, no_case: 0 };
  const holdReasons = Object.fromEntries([
    "NO_CURRENT_EVENT", "STALE_EVENT", "INSUFFICIENT_EVIDENCE", "LOW_FIT", "WRONG_TARGET",
    "INSUFFICIENT_COVERAGE", "NO_MATERIALITY", "STRUCTURAL_REJECT", "OTHER_EXISTING_CANONICAL_REASON",
  ].map((key) => [key, 0])) as Record<HoldReason, number>;
  for (const row of rows) {
    decisions[row.final_decision ?? "no_case"]++;
    if (row.hold_reason) holdReasons[row.hold_reason]++;
  }
  return {
    accounts: rows.length,
    valid_targets: rows.filter((row) => row.target_valid).length,
    researched: rows.filter((row) => row.search_results > 0).length,
    event_candidates: rows.reduce((sum, row) => sum + row.material_event_candidates, 0),
    temporal_valid: rows.reduce((sum, row) => sum + row.temporal_valid_events, 0),
    material_valid: rows.reduce((sum, row) => sum + row.materiality_valid_events, 0),
    evidence_valid: rows.filter((row) => row.evidence_valid).length,
    decisions,
    hold_reasons: holdReasons,
  };
}
