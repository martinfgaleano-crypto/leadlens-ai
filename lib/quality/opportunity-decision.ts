// ─── Opportunity Decision Engine v1 ───────────────────────────────────────────
// Deterministic post-pass (same family as evidence-quality / signal-freshness):
// turns each opportunity's REAL enrichment/qualification data into an
// explainable decision — thesis, why now, why this company, why this quarter,
// risks, confidence drivers — plus an executive playbook for HOT accounts.
//
// Grounding rule: every sentence is assembled from fields the pipeline actually
// produced. When the data is missing, the field says so honestly ("No dated
// signal…") instead of fabricating a claim. Nothing here calls an LLM, changes
// scores, or reorders the ranking — it explains, it never decides.

import type {
  ExecutivePlaybook,
  LeadLensReport,
  OpportunityDecision,
  ProcessedLead,
  ReportIntelligence,
} from "@/types";

// Version identifier for the report _versions block. Bump on logic changes.
export const DECISION_ENGINE_VERSION = 1;

const clean = (s: string | null | undefined): string | null => {
  const t = (s ?? "").trim();
  return t.length >= 8 ? t : null;
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const d = Math.floor((Date.now() - t) / 86_400_000);
  return d >= 0 ? d : null;
}

export function buildOpportunityDecision(lead: ProcessedLead): OpportunityDecision {
  const e = lead.enrichment;
  const q = lead.qualification;
  const c = lead.candidate;
  const days = daysSince(c.signal_date);
  const timing = (e.timing_signals ?? []).filter(Boolean);
  const evidence = (e.evidence ?? []).filter(Boolean);

  // Thesis — the research agent's account thesis when present; otherwise the
  // strongest fit reason + what the signals mean.
  const assembled = [clean(q.fit_reasons?.[0]), clean(e.signal_interpretation)].filter(Boolean).join(" ");
  const thesis =
    clean(e.account_thesis) ??
    (assembled.length >= 8
      ? assembled
      : `${c.company} matched the target profile, but the research pass produced no account thesis — treat as a lead to validate, not a conclusion.`);

  // Why now — dated signal first, then timing signals, then honesty.
  const why_now =
    clean(e.why_now) ??
    (days !== null
      ? `A verifiable signal is dated ${c.signal_date} (${days} day${days === 1 ? "" : "s"} ago)${timing[0] ? `: ${timing[0]}` : ""}.`
      : timing.length > 0
        ? `Observed timing signals: ${timing.slice(0, 2).join("; ")}. No structured date — verify recency before acting.`
        : "No dated or timing signal was found — there is no verified reason to act now rather than later.");

  // Why this company — qualification fit reasons are the only honest source.
  const fitReasons = (q.fit_reasons ?? []).filter(Boolean);
  const why_this_company =
    fitReasons.length > 0
      ? fitReasons.slice(0, 3).join(" · ")
      : clean(e.segment_fit_note) ??
        "Fit was inferred from profile matching only — no company-specific fit reasons were verified.";

  // Why this quarter — strictly from buying window + signal age.
  const window = e.buying_window;
  const windowReason = clean(e.buying_window_reason);
  let why_this_quarter: string;
  if (window === "immediate") {
    why_this_quarter = `Buying window classified as immediate${windowReason ? ` — ${windowReason}` : ""}. Deprioritizing this account risks meeting the need after it is filled.`;
  } else if (window === "near_term") {
    why_this_quarter = `Buying window classified as near-term${windowReason ? ` — ${windowReason}` : ""}. The signal supports engaging within the quarter, not immediately.`;
  } else if (days !== null && days <= 90) {
    why_this_quarter = `The underlying signal is ${days} days old — recent enough that the driving event likely still shapes this quarter's priorities.`;
  } else {
    why_this_quarter = "No quarter-level urgency is evidenced. Reasonable to engage this quarter for positioning, but nothing verified expires if you wait.";
  }

  // Risks — only risks the pipeline actually surfaced.
  const risk_factors = [
    ...(e.opportunity_risks ?? []),
    ...(e.risks_weaknesses ?? []),
    ...(q.disqualification_reasons ?? []),
  ].filter(Boolean).slice(0, 4);
  if (risk_factors.length === 0) {
    risk_factors.push("No specific risks surfaced from the available evidence — treat the unknowns (budget, incumbent, timing) as the risk.");
  }

  // Confidence drivers — only assert what is verifiably true of this lead.
  const confidence_drivers: string[] = [];
  if (days !== null) confidence_drivers.push(`Structured signal date present (${c.signal_date})`);
  if (c.source_url) confidence_drivers.push("Source provenance available for the primary signal");
  if (evidence.length > 0) confidence_drivers.push(`${evidence.length} evidence item${evidence.length === 1 ? "" : "s"} captured by research`);
  const dims = q.score_dimensions;
  if (dims?.icp_fit != null && dims.icp_fit >= 70) confidence_drivers.push(`ICP fit scored ${dims.icp_fit}/100`);
  if (dims?.evidence_quality != null && dims.evidence_quality >= 70) confidence_drivers.push(`Evidence quality scored ${dims.evidence_quality}/100`);
  if (e.research_confidence >= 0.7) confidence_drivers.push(`Research confidence ${Math.round(e.research_confidence * 100)}%`);
  if (confidence_drivers.length === 0) confidence_drivers.push("Low verified support — confidence rests on profile matching alone.");

  return {
    thesis,
    why_now,
    why_this_company,
    why_this_quarter,
    risk_factors,
    confidence_drivers,
    evidence_grounded: evidence.length > 0 && (days !== null || timing.length > 0),
  };
}

/** HOT accounts only — a first-conversation plan from available info. */
export function buildExecutivePlaybook(lead: ProcessedLead): ExecutivePlaybook {
  const e = lead.enrichment;
  const c = lead.candidate;
  const pain = clean(e.inferred_pain) ?? clean(e.pain_hypothesis);
  const firstEvidence = (e.evidence ?? []).filter(Boolean)[0] ?? null;
  const days = daysSince(c.signal_date);

  return {
    recommended_stakeholder: c.title
      ? `${c.title} (named in the source) — confirm they still own this area.`
      : pain
        ? `The owner of "${pain.slice(0, 80)}" — typically operations or commercial leadership. Not yet identified; validate before outreach.`
        : "Not identified from available sources — map the buying role before any outreach.",
    suggested_timing:
      e.buying_window === "immediate"
        ? "This week — the buying window is classified immediate."
        : e.buying_window === "near_term"
          ? "Within 2–4 weeks, while the driving signal is still fresh."
          : days !== null && days <= 30
            ? `Soon — the signal is only ${days} days old.`
            : "No urgency verified — engage when capacity allows; lead with research, not pressure.",
    primary_value_hypothesis:
      clean(e.pain_hypothesis) ?? pain ?? "Unproven — the first conversation should test what problem (if any) the observed signal creates for them.",
    main_objection_expected:
      (e.opportunity_risks ?? [])[0] ??
      (e.risks_weaknesses ?? [])[0] ??
      "“Why now?” — expect to justify timing, since urgency is inferred from public signals.",
    first_conversation_angle: firstEvidence
      ? `Open with the observed fact: “${firstEvidence.slice(0, 140)}” — then ask how it changes their priorities.`
      : clean(e.why_now)
        ? `Open with the timing observation: ${e.why_now!.slice(0, 140)}`
        : "No specific angle is evidenced — open with a research question about their current priorities, not a pitch.",
  };
}

/** Attach decisions/playbooks to ranked opportunities and build the executive
 *  funnel from real pipeline numbers. Mutates the report; never reorders. */
export function applyDecisionIntelligence(
  report: LeadLensReport,
  leads: ProcessedLead[],
  candidatesConsidered: number,
): LeadLensReport {
  const byId = new Map(leads.map((l) => [l.id, l]));
  let applied = 0;
  for (const opp of report.ranked_opportunities ?? []) {
    const lead = byId.get(opp.lead_id);
    if (!lead) continue;
    opp.decision = buildOpportunityDecision(lead);
    if (opp.category === "HOT") opp.playbook = buildExecutivePlaybook(lead);
    applied++;
  }

  const selected = report.total_leads;
  const rejection_reasons: Record<string, number> = {};
  if (report.discard_count > 0) rejection_reasons.low_confidence = report.discard_count;
  const insufficient = report.evidence_quality_counts?.insufficient ?? 0;
  if (insufficient > 0) rejection_reasons.insufficient_evidence = insufficient;

  report.report_intelligence = {
    companies_considered: Math.max(candidatesConsidered, selected),
    companies_selected: selected,
    companies_rejected: Math.max(candidatesConsidered - selected, 0) + report.discard_count,
    rejection_reasons,
    source_mode: leads[0]?.candidate.source === "vault" ? "vault" : "provider",
  };

  console.log(`[decision-engine] decisions applied to ${applied} opportunities (grounded=${(report.ranked_opportunities ?? []).filter((o) => o.decision?.evidence_grounded).length})`);
  return report;
}
