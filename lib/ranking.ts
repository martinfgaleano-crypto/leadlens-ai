/**
 * Opportunity Ranking Intelligence
 *
 * Computes a ranked list of accounts after all leads are scored, explaining WHY each
 * account ranks where it does relative to the others in the batch. This is the layer
 * that makes LeadLens feel like a commercial analyst rather than a score sorter.
 *
 * Called from pipeline.ts after all leads are processed.
 * Results stored in LeadLensReport.ranked_opportunities and on each lead's qualification.
 */

import type {
  ProcessedLead,
  OpportunityRanking,
  RecommendedActionType,
  LeadCategory,
} from "@/types";

// ─── Public entry point ───────────────────────────────────────────────────────

export function computeRanking(leads: ProcessedLead[]): OpportunityRanking[] {
  if (leads.length === 0) return [];

  // Sort: fit_score desc → signal_strength desc → evidence_quality desc
  const sorted = [...leads].sort((a, b) => {
    const scoreDiff = b.qualification.fit_score - a.qualification.fit_score;
    if (Math.abs(scoreDiff) > 0.05) return scoreDiff;
    const aSignal = a.qualification.score_dimensions?.signal_strength ?? 0;
    const bSignal = b.qualification.score_dimensions?.signal_strength ?? 0;
    if (Math.abs(aSignal - bSignal) > 2) return bSignal - aSignal;
    const aEv = a.qualification.score_dimensions?.evidence_quality ?? 0;
    const bEv = b.qualification.score_dimensions?.evidence_quality ?? 0;
    return bEv - aEv;
  });

  const rankings: OpportunityRanking[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const lead = sorted[i];
    const above = i > 0 ? sorted[i - 1] : null;
    const below = i < sorted.length - 1 ? sorted[i + 1] : null;

    const ranking = buildRankingForLead(lead, i + 1, above, below, sorted.length);
    rankings.push(ranking);

    // Apply ranking back to the lead's qualification for in-report display
    lead.qualification.rank = ranking.rank;
    lead.qualification.ranking_explanation = ranking.ranking_explanation;
    lead.qualification.comparative_notes = ranking.comparative_notes;
    lead.qualification.opportunity_tier_reason = ranking.opportunity_tier_reason;
    if (!lead.qualification.signal_interpretation) {
      lead.qualification.signal_interpretation = deriveSignalInterpretation(lead);
    }
  }

  return rankings;
}

// ─── Build ranking for a single lead ─────────────────────────────────────────

function buildRankingForLead(
  lead: ProcessedLead,
  rank: number,
  above: ProcessedLead | null,
  below: ProcessedLead | null,
  total: number
): OpportunityRanking {
  const q = lead.qualification;
  const dims = q.score_dimensions;
  const company = lead.candidate.company;
  const category = q.category;

  const hasSignal = confirmedSignal(lead);
  const recommended_action = deriveRecommendedAction(category, hasSignal, q.qualification_confidence, q.fit_score);
  const top_priority_reason = buildTopPriorityReason(lead, hasSignal, rank, total);
  const opportunity_tier_reason = buildTierReason(lead, dims, hasSignal);
  const ranking_explanation = buildRankingExplanation(lead, above, rank);
  const comparative_notes = buildComparativeNotes(lead, above, below);

  return {
    lead_id: lead.id,
    company,
    rank,
    fit_score: q.fit_score,
    category,
    top_priority_reason,
    ranking_explanation,
    opportunity_tier_reason,
    comparative_notes,
    recommended_action,
  };
}

// ─── Recommended action derivation ───────────────────────────────────────────

export function deriveRecommendedAction(
  category: LeadCategory,
  hasSignal: boolean,
  confidence: number,
  fitScore: number
): RecommendedActionType {
  if (category === "DISCARD") return "exclude";
  if (confidence < 0.35) return "enrich_manually";

  if (category === "COLD" && !hasSignal) return "monitor_for_new_signal";
  if (category === "COLD" && hasSignal) return "validate_source_first";

  if (category === "WARM") {
    if (fitScore >= 7.0 && hasSignal) return "send_outreach_now";
    if (fitScore >= 7.0 && !hasSignal) return "validate_source_first";
    if (hasSignal) return "validate_source_first";
    return "monitor_for_new_signal";
  }

  if (category === "HOT") {
    return hasSignal ? "send_outreach_now" : "validate_source_first";
  }

  return "monitor_for_new_signal";
}

// ─── Top priority reason ──────────────────────────────────────────────────────

function buildTopPriorityReason(
  lead: ProcessedLead,
  hasSignal: boolean,
  rank: number,
  total: number
): string {
  const q = lead.qualification;
  const dims = q.score_dimensions;
  const company = lead.candidate.company;
  const ind = lead.candidate.industry ?? "their segment";

  if (q.category === "DISCARD") {
    return `${company} is excluded from the ranked list — hard ICP disqualifier detected`;
  }

  if (rank === 1 && q.category === "HOT") {
    return `Top account in this batch — ${hasSignal ? "confirmed buying signal + " : ""}strongest ICP fit (${q.fit_score}/10)`;
  }
  if (rank === 1 && q.category === "WARM") {
    return `Highest-scoring account in the batch (${q.fit_score}/10, WARM) — ${hasSignal ? "confirmed signal" : "strong segment fit"} makes this the best starting point`;
  }
  if (rank === 1) {
    return `Best available account in this batch (${q.fit_score}/10) — limited options; use with caution`;
  }

  if (hasSignal && dims && dims.signal_strength >= 60) {
    return `${company} has a confirmed buying signal in ${ind} — signal strength (${dims.signal_strength}/100) lifts it above lower-signal accounts at similar scores`;
  }

  if (dims && dims.icp_fit >= 75) {
    return `${company} is a close ICP match (icp_fit: ${dims.icp_fit}/100) in ${ind} — strong segment alignment makes it worth the outreach even without a confirmed signal`;
  }

  const position = rank <= Math.ceil(total * 0.3) ? "top third" : rank <= Math.ceil(total * 0.6) ? "middle tier" : "lower tier";
  return `${company} is in the ${position} of this batch — ${q.fit_score}/10 score reflects ${hasSignal ? "a confirmed signal with moderate fit" : "segment-level fit without a confirmed timing trigger"}`;
}

// ─── Tier reason ─────────────────────────────────────────────────────────────

function buildTierReason(
  lead: ProcessedLead,
  dims: typeof lead.qualification.score_dimensions,
  hasSignal: boolean
): string {
  const q = lead.qualification;
  const company = lead.candidate.company;
  const category = q.category;

  switch (category) {
    case "HOT":
      return `HOT: ${company} meets all HOT criteria — icp_fit ≥70 (${dims?.icp_fit ?? "?"}), signal_strength ≥50 (${dims?.signal_strength ?? "?"}), evidence_quality ≥60 (${dims?.evidence_quality ?? "?"}), disqualification_risk ≤35 (${dims?.disqualification_risk ?? "?"})`;

    case "WARM":
      if (q.fit_score >= 7.0 && !hasSignal) {
        return `WARM (7+): Strong ICP fit but missing a confirmed timing signal — outreach is justifiable with a hypothesis-framed opener`;
      }
      if (q.fit_score < 7.0 && hasSignal) {
        return `WARM (<7): Has a confirmed buying signal but ICP fit is partial — validate the specific pain hypothesis before outreach`;
      }
      return `WARM: Meets 2 of 3 HOT criteria — one key dimension (${dims?.signal_strength ?? 0 < 50 ? "signal" : dims?.evidence_quality ?? 0 < 60 ? "evidence" : "ICP fit"}) is below HOT threshold`;

    case "COLD":
      return `COLD: ${hasSignal ? "Has a signal but ICP fit or evidence quality is too weak to recommend outreach" : "No confirmed signal and fit score is below WARM threshold"} — add to monitor list, not Wave 1`;

    case "DISCARD":
      return `DISCARD: ${company} fails on hard ICP criteria — ${q.disqualification_reasons[0]?.slice(0, 100) ?? "industry/segment mismatch detected"}. Do not outreach.`;

    default:
      return `Score ${q.fit_score}/10 places ${company} in the ${category} tier`;
  }
}

// ─── Ranking explanation (comparative) ───────────────────────────────────────

function buildRankingExplanation(
  lead: ProcessedLead,
  above: ProcessedLead | null,
  rank: number
): string {
  const q = lead.qualification;
  const company = lead.candidate.company;
  const dims = q.score_dimensions;
  const hasSignal = confirmedSignal(lead);

  if (rank === 1) {
    if (hasSignal) {
      return `${company} leads the batch because it combines a confirmed buying signal with the strongest ICP fit (${q.fit_score}/10). Signal-led outreach has measurably higher reply rates — this is the account to contact first.`;
    }
    return `${company} ranks #1 in this batch on overall score (${q.fit_score}/10) and ICP alignment. No confirmed signal, but segment fit makes it the best available starting point — use a hypothesis-framed opener.`;
  }

  if (!above) {
    return `${company} is ranked #${rank} — scored ${q.fit_score}/10`;
  }

  const aboveQ = above.qualification;
  const aboveDims = aboveQ.score_dimensions;
  const aboveHasSignal = confirmedSignal(above);
  const above_company = above.candidate.company;

  // Score gap is meaningful
  const scoreDiff = aboveQ.fit_score - q.fit_score;
  if (scoreDiff >= 1.5) {
    return `${company} ranks below ${above_company} due to a ${scoreDiff.toFixed(1)}-point score gap — ${above_company} (${aboveQ.fit_score}/10) has stronger ${aboveHasSignal && !hasSignal ? "confirmed signals and " : ""}ICP alignment. ${company} (${q.fit_score}/10) is still worth ${q.category === "WARM" ? "outreach with more caution" : "monitoring"}.`;
  }

  // Same score tier, different differentiators
  if (aboveHasSignal && !hasSignal) {
    return `${company} ranks below ${above_company} because ${above_company} has a confirmed buying signal while ${company} does not — at similar score levels, signal presence is the tiebreaker. ${company} should be outreached after ${above_company} if budget allows.`;
  }

  if (dims && aboveDims) {
    if (aboveDims.icp_fit > dims.icp_fit + 10) {
      return `${above_company} ranks above ${company} primarily on ICP fit (${aboveDims.icp_fit} vs ${dims.icp_fit}/100) — ${above_company} is a closer match to the target segment.`;
    }
    if (aboveDims.evidence_quality > dims.evidence_quality + 15) {
      return `${above_company} ranks above ${company} on evidence quality (${aboveDims.evidence_quality} vs ${dims.evidence_quality}/100) — the intelligence on ${above_company} is more reliable, reducing outreach risk.`;
    }
  }

  return `${company} ranks #${rank} (${q.fit_score}/10). Slightly below ${above_company} (${aboveQ.fit_score}/10) — closely matched accounts, both worth contacting within the same wave.`;
}

// ─── Comparative notes ────────────────────────────────────────────────────────

function buildComparativeNotes(
  lead: ProcessedLead,
  above: ProcessedLead | null,
  below: ProcessedLead | null
): string | undefined {
  const parts: string[] = [];
  const hasSignal = confirmedSignal(lead);

  if (above && confirmedSignal(above) && !hasSignal) {
    parts.push(`${above.candidate.company} (above) has a confirmed signal that ${lead.candidate.company} lacks — prioritize ${above.candidate.company} first if you contact both`);
  }

  if (below && lead.qualification.fit_score - below.qualification.fit_score < 0.5) {
    parts.push(`${below.candidate.company} (just below) is nearly tied — consider them in the same outreach wave`);
  }

  if (lead.qualification.category === "WARM" && lead.qualification.fit_score >= 7.5) {
    parts.push(`At ${lead.qualification.fit_score}/10, ${lead.candidate.company} is close to HOT threshold — a confirmed signal would move it to the top tier`);
  }

  return parts.length > 0 ? parts.join(". ") : undefined;
}

// ─── Signal interpretation ────────────────────────────────────────────────────

export function deriveSignalInterpretation(lead: ProcessedLead): string {
  const signals = lead.enrichment.timing_signals;
  const company = lead.candidate.company;
  const industry = lead.candidate.industry ?? "their segment";
  const dims = lead.qualification.score_dimensions;

  const hasSignal = confirmedSignal(lead);

  if (!hasSignal) {
    if ((dims?.icp_fit ?? 0) >= 70) {
      return `No confirmed signal, but ${company}'s ICP fit is strong (${dims?.icp_fit ?? "?"}/100) — outreach should be framed around segment patterns, not a specific trigger event`;
    }
    return `No confirmed buying signal for ${company} — opportunity is hypothesis-led from ${industry} segment profile. Lower expected response rate without a timing anchor.`;
  }

  const signalText = signals.filter(
    s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
  ).join(" ").toLowerCase();

  // Hiring + expansion combo
  if (/hir|recruit/.test(signalText) && /expand|new|grow|open|facilit/.test(signalText)) {
    return `${company} is simultaneously hiring and expanding — this combination typically signals an active operational scaling phase where companies evaluate vendors to fill capability gaps created by growth. Higher urgency window.`;
  }
  // Funding
  if (/raised|funded|series|seed|investment/.test(signalText)) {
    return `Post-funding phase at ${company} typically triggers a 3–12 month vendor evaluation cycle — companies in this phase are actively buying capabilities. Contact within 60 days of the announcement for highest relevance.`;
  }
  // Warehouse/facility expansion
  if (/warehouse|facilit|distribut center|capacity|storage/.test(signalText)) {
    return `Physical infrastructure expansion at ${company} suggests operational scaling that typically exposes account management and prioritization gaps. The 30–90 day post-announcement window is the optimal outreach timing.`;
  }
  // Trade show
  if (/trade show|expo|fair|conference|exhibit/.test(signalText)) {
    return `${company}'s trade show participation indicates active market engagement and vendor evaluation activity — companies attend industry events when they're in buying or partner-discovery mode.`;
  }
  // Product launch
  if (/launch|new product|announced|platform|service/.test(signalText)) {
    return `${company}'s recent announcement suggests active go-to-market investment. Post-launch phases typically create demand for adjacent vendor capabilities that support distribution, sales, or operations.`;
  }
  // Hiring only
  if (/hir|recruit|joins|headcount/.test(signalText)) {
    return `${company}'s hiring activity signals commercial growth investment — new hires often drive vendor evaluation cycles as they build or reshape their operational stack within 60 days of joining.`;
  }
  // Generic confirmed signal
  return `${company} has a confirmed public signal — ${signals[0]?.slice(0, 80) ?? "see timing_signals"}. This type of observable event typically correlates with an active evaluation window of 30–90 days.`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confirmedSignal(lead: ProcessedLead): boolean {
  return lead.enrichment.timing_signals.some(
    s => !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
  );
}
