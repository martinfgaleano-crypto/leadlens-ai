import type { EvidenceQualityLevel, ProcessedLead, RecommendedActionType } from "@/types";

export type ActionabilityStatus = "act_now" | "validate_first" | "monitor" | "exclude";

export interface ActionabilityDecision {
  status: ActionabilityStatus;
  priority: number;
  recommended_action: RecommendedActionType;
  reasons: string[];
  blockers: string[];
}

const PRIORITY: Record<ActionabilityStatus, number> = { act_now: 0, validate_first: 1, monitor: 2, exclude: 3 };

function confirmedSignal(lead: ProcessedLead): boolean {
  return (lead.enrichment.timing_signals ?? []).some((signal) => {
    const value = signal.toLowerCase();
    return !value.startsWith("no confirmed") && !value.includes("inferred");
  });
}

function evidenceLevel(lead: ProcessedLead): EvidenceQualityLevel {
  return lead.learning?.evidence_quality ?? "insufficient";
}

/** Keeps model fit separate from permission to act on an account. */
export function evaluateActionability(lead: ProcessedLead): ActionabilityDecision {
  const level = evidenceLevel(lead);
  const hasSignal = confirmedSignal(lead);
  const fit = lead.qualification.fit_score;
  const confidence = lead.qualification.qualification_confidence;
  const qcFailed = lead.outreach.qc_status === "FAILED";
  const blockers: string[] = [];
  const reasons: string[] = [];
  const discoveryValue = lead.candidate.discovery_value;
  const obviousAccount = lead.candidate.account_visibility === "obvious";

  if (lead.qualification.category === "DISCARD") blockers.push("Account failed ICP qualification.");
  if (qcFailed) blockers.push("Outreach quality control failed.");
  if (level === "insufficient") blockers.push("No verified evidence supports the opportunity.");

  if (lead.qualification.category === "DISCARD" || qcFailed) {
    return { status: "exclude", priority: PRIORITY.exclude, recommended_action: "exclude", reasons, blockers };
  }
  if (level === "insufficient") {
    return { status: "monitor", priority: PRIORITY.monitor, recommended_action: "add_to_watchlist", reasons, blockers };
  }
  if (lead.candidate.opportunity_kind === "channel_fit") {
    if (lead.candidate.channel_evidence_grade === "preliminary" || lead.candidate.channel_evidence_grade === "insufficient") {
      reasons.push("Channel evidence proves only general distribution capability; a supplier path and category acceptance are still unverified.");
      blockers.push("Channel proof is preliminary.");
      return { status: "monitor", priority: PRIORITY.monitor, recommended_action: "enrich_manually", reasons, blockers };
    }
    reasons.push("Verified channel fit is not a dated buying-intent signal; validate supplier openness, category fit and the buyer before outreach.");
    return { status: "validate_first", priority: PRIORITY.validate_first, recommended_action: "validate_source_first", reasons, blockers };
  }
  if (discoveryValue === "low") {
    reasons.push("Discovery value is low; this account is too obvious or the signal is too generic for paid delivery.");
    return { status: "monitor", priority: PRIORITY.monitor, recommended_action: "add_to_watchlist", reasons, blockers };
  }
  if (level === "low") {
    reasons.push("Evidence is limited and does not support immediate outreach.");
    return { status: "monitor", priority: PRIORITY.monitor, recommended_action: "monitor_for_new_signal", reasons, blockers };
  }
  if (!hasSignal) {
    reasons.push("No confirmed timing signal was found.");
    const status = fit >= 6 ? "validate_first" : "monitor";
    return { status, priority: PRIORITY[status], recommended_action: fit >= 6 ? "validate_source_first" : "monitor_for_new_signal", reasons, blockers };
  }
  if (confidence < 0.55) {
    reasons.push("Qualification confidence is below the action threshold.");
    return { status: "validate_first", priority: PRIORITY.validate_first, recommended_action: "enrich_manually", reasons, blockers };
  }
  if (level === "medium") {
    reasons.push("A signal exists, but the evidence requires human validation.");
    return { status: "validate_first", priority: PRIORITY.validate_first, recommended_action: "validate_source_first", reasons, blockers };
  }
  if (obviousAccount) {
    reasons.push("The account is widely known; validate the non-obvious category or supplier angle before outreach.");
    return { status: "validate_first", priority: PRIORITY.validate_first, recommended_action: "validate_source_first", reasons, blockers };
  }
  if (fit >= 7 && level === "high") {
    reasons.push("High evidence quality, confirmed timing signal and sufficient ICP fit.");
    return { status: "act_now", priority: PRIORITY.act_now, recommended_action: "send_outreach_now", reasons, blockers };
  }
  reasons.push("Evidence is strong, but ICP fit remains below the outreach threshold.");
  return { status: "validate_first", priority: PRIORITY.validate_first, recommended_action: "validate_source_first", reasons, blockers };
}

export function compareActionability(a: ProcessedLead, b: ProcessedLead): number {
  return evaluateActionability(a).priority - evaluateActionability(b).priority;
}
