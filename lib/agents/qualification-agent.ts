import type {
  EnrichedLead, ICP, QualifiedLead, LeadCandidate, LeadCategory, ScoreDimensions
} from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

export async function runQualificationAgent(
  enriched: EnrichedLead,
  icp: ICP
): Promise<QualifiedLead> {
  if (IS_DEMO || !process.env.ANTHROPIC_API_KEY) {
    return scoreDemoLead(enriched, icp);
  }
  return scoreLeadWithClaude(enriched, icp);
}

// ─── DEMO scoring ─────────────────────────────────────────────────────────────

function scoreDemoLead(enriched: EnrichedLead, icp: ICP): QualifiedLead {
  const { candidate } = enriched;
  const title = (candidate.title ?? "").toLowerCase();
  const industry = (candidate.industry ?? "").toLowerCase();
  const size = candidate.company_size ?? "";

  // ── 1. Commercial relevance (0–3.0) ─────────────────────────────────────
  const roleSc =
    /\b(ceo|co-?founder|founder|owner|president)\b/.test(title) ? 3.0 :
    /\b(cro|chief revenue officer)\b/.test(title) ? 2.8 :
    /\b(vp\b|vp of|head of)\b/.test(title) && /\b(sales|revenue|growth|business|bd)\b/.test(title) ? 2.5 :
    /\b(vp\b|vp of|head of)\b/.test(title) && /\bmarketing\b/.test(title) ? 1.8 :
    /\bdirector\b/.test(title) && /\b(sales|revenue|business|growth)\b/.test(title) ? 2.2 :
    /\b(director|managing director|coo|cmo)\b/.test(title) ? 1.8 :
    /\b(cfo)\b/.test(title) ? 1.5 :
    /\b(manager|lead|senior)\b/.test(title) ? 1.2 :
    // No personal title available — use company profile as proxy
    1.5;

  // ── 2. Industry fit (0–2.5) ──────────────────────────────────────────────
  const icpIndustryText = icp.target_industries.join(" ").toLowerCase();
  const icpKeywords = icpIndustryText.match(/\b[a-z]{4,}\b/g) ?? [];

  let industrySc = 0.4; // base
  for (const kw of icpKeywords) {
    if (industry.includes(kw)) { industrySc += 0.5; }
  }
  // Direct category matches
  if (/\bsaas\b/.test(industry)) industrySc = Math.max(industrySc, 2.5);
  else if (/\b(agency|marketing)\b/.test(industry)) industrySc = Math.max(industrySc, 1.5);
  else if (/\bconsult/.test(industry)) industrySc = Math.max(industrySc, 1.4);
  else if (/\b(fintech|healthtech|analytics|e-?commerce)\b/.test(industry)) industrySc = Math.max(industrySc, 1.2);
  else if (/\b(logistics|supply chain|transport|freight)\b/.test(industry)) industrySc = Math.max(industrySc, 1.8);
  else if (/\b(food|distribution|import|export)\b/.test(industry)) industrySc = Math.max(industrySc, 1.6);
  industrySc = Math.min(2.5, industrySc);

  // ── 3. Evidence/confidence (0–1.5) ──────────────────────────────────────
  const evidenceSc =
    candidate.confidence_score >= 0.85 ? 1.5 :
    candidate.confidence_score >= 0.65 ? 0.9 :
    candidate.confidence_score >= 0.45 ? 0.5 :
    0.2;

  // ── 4. Company size fit (0–1.0) ──────────────────────────────────────────
  const sizeSc =
    /^(11-50|51-200)$/.test(size) ? 1.0 :
    /^1-10$/.test(size) ? 0.7 :
    /^201-500$/.test(size) ? 0.6 :
    0.4;

  // ── 5. Timing signal (0–0.5) ─────────────────────────────────────────────
  const hasMeaningfulSignal = enriched.timing_signals.some(s =>
    !s.toLowerCase().startsWith("no confirmed") && !s.toLowerCase().includes("inferred")
  );
  const timingSc = hasMeaningfulSignal ? 0.5 : 0;

  // ── 6. Confidence calibration (±0.8) ─────────────────────────────────────
  const confBoost = (candidate.confidence_score - 0.65) * 1.6;

  const raw = roleSc + industrySc + evidenceSc + sizeSc + timingSc + confBoost;
  const fit_score = parseFloat(Math.min(10, Math.max(0, raw)).toFixed(1));
  const category = scoreToCategory(fit_score);

  const fit_reasons = buildDemoFitReasons(candidate, enriched, { roleSc, industrySc, evidenceSc, timingSc });
  const disqualification_reasons = buildDemoDisqualReasons(candidate, enriched, fit_score, hasMeaningfulSignal);

  // ── Multi-axis score dimensions (0–100 per axis) ─────────────────────────
  const icpFit = Math.min(100, Math.round((industrySc / 2.5) * 60 + (sizeSc / 1.0) * 40));
  const signalStrength = hasMeaningfulSignal
    ? Math.min(100, Math.round(50 + candidate.confidence_score * 50))
    : Math.round(candidate.confidence_score * 35);
  const timing = hasMeaningfulSignal ? 75 : 20;
  const evidenceQuality = Math.min(100, Math.round(candidate.confidence_score * 100));
  const strategicValue = industrySc >= 2.0 ? 80 : industrySc >= 1.4 ? 60 : 40;
  const confidenceDim = Math.min(100, Math.round(candidate.confidence_score * 100));
  const disqualRisk = fit_score < 4 ? 80 : candidate.confidence_score < 0.4 ? 50 : Math.round((1 - candidate.confidence_score) * 30);

  const score_dimensions: ScoreDimensions = {
    icp_fit: icpFit,
    signal_strength: signalStrength,
    timing,
    evidence_quality: evidenceQuality,
    strategic_value: strategicValue,
    confidence: confidenceDim,
    disqualification_risk: disqualRisk,
  };

  const score_explanation = buildScoreExplanation(fit_score, category, score_dimensions, candidate.company, hasMeaningfulSignal);
  const signal_interpretation = buildDemoSignalInterpretation(enriched, score_dimensions, hasMeaningfulSignal);
  const opportunity_tier_reason = buildDemoTierReason(category, score_dimensions, hasMeaningfulSignal, fit_score);

  return {
    enrichment: enriched,
    fit_score,
    category,
    fit_reasons,
    disqualification_reasons,
    qualification_confidence: candidate.confidence_score,
    score_breakdown: {
      role_fit: parseFloat(Math.min(2, roleSc / 1.5).toFixed(2)),
      company_fit: parseFloat(Math.min(2, industrySc / 1.25).toFixed(2)),
      pain_fit: hasMeaningfulSignal ? 1.5 : 0.8,
      timing_signal: timingSc * 4,
      reachability: parseFloat(Math.min(1, evidenceSc / 1.5).toFixed(2)),
      strategic_relevance: parseFloat(Math.min(1, (confBoost + 0.8) / 1.6).toFixed(2)),
    },
    score_dimensions,
    score_explanation,
    signal_interpretation,
    opportunity_tier_reason,
  };
}

// ─── Claude scoring ───────────────────────────────────────────────────────────

async function scoreLeadWithClaude(enriched: EnrichedLead, icp: ICP): Promise<QualifiedLead> {
  const { callClaudeJSON } = await import("@/lib/anthropic");
  const { candidate } = enriched;

  const SYSTEM = `You are a senior B2B commercial intelligence analyst scoring account-level opportunities against an ICP.
Score calibrated — neither inflate nor over-penalize. Focus on COMPANY fit, not individual contacts.

Legacy scoring dimensions (max 10 total):
- role_fit 0–2: Does the company's commercial profile match the ICP? (active commercial investment, right stage)
- company_fit 0–2: Does industry and size match the ICP?
- pain_fit 0–2: Is the inferred company-level pain plausible and specific to this offer?
- timing_signal 0–2: Are there confirmed public signals (hiring, expansion, announcements)? 0 if none.
- reachability 0–1: How strong is evidence coverage? High confidence source=1, moderate=0.5, thin=0
- strategic_relevance 0–1: Is this a high-value account type for long-term commercial fit?

Multi-axis dimensions (0–100 per axis):
- icp_fit: how precisely the company matches ALL ICP criteria
- signal_strength: strength of buying signals (0 if no signals — not penalized twice)
- timing: is there evidence this is the RIGHT TIME to approach? (30–90 day window)
- evidence_quality: how trustworthy is the underlying evidence?
- strategic_value: long-term value of this account type, regardless of current signals
- confidence: aggregate confidence in the opportunity score
- disqualification_risk: risk that this account should be EXCLUDED (ICP mismatch, bad geography, etc.)

CATEGORY THRESHOLDS AND STRICT CALIBRATION:
- HOT ≥8: REQUIRES ALL FOUR: icp_fit ≥70 AND signal_strength ≥50 AND evidence_quality ≥60 AND disqualification_risk ≤35. If any fails, maximum is WARM even if total score ≥8.
- WARM 6–7.9: strong on 2 of 3 core dimensions (icp_fit, signal_strength, evidence_quality), 1 is weak. Outreach is justifiable but needs careful framing.
- COLD 4–5.9: real ICP mismatches or missing evidence. Monitor only — do not outreach without manual validation.
- DISCARD <4: hard disqualifiers — wrong industry, wrong geography, explicit exclusion, or no viable commercial path.

Additional calibration rules:
- An account with strong ICP fit but ZERO signals and thin evidence = WARM at most (not HOT)
- An account with a strong signal but weak ICP fit = WARM at most
- COLD accounts with confirmed signals should be noted but remain COLD — signal alone doesn't override a weak fit
- Do NOT penalize twice for the same missing data

score_explanation must say:
"Score is [HOT/WARM/COLD/DISCARD] because [ICP Fit: X/100 — reason], [Signal: X/100 — reason], [Timing: X/100 — reason]. [Key risk if any]."

Return only valid JSON.`;

  const userMsg = `ICP:
- Industries: ${icp.target_industries.join(", ")}
- Key roles at target companies: ${icp.target_titles.join(", ")}
- Size: ${icp.company_size_range}
- Pain points: ${icp.pain_points.join("; ")}
- Disqualifiers: ${icp.disqualifiers.join("; ")}
${icp.product_detected ? `- Product: ${icp.product_detected}` : ""}

Account: ${candidate.company}
Industry: ${candidate.industry ?? "?"} | Size: ${candidate.company_size ?? "?"} | Location: ${candidate.location ?? "?"}
Source confidence: ${Math.round(candidate.confidence_score * 100)}%
Company context: ${enriched.company_summary ?? "none"}
Account fit context: ${enriched.role_relevance ?? "none"}
Pain hypothesis: ${enriched.pain_hypothesis ?? enriched.inferred_pain ?? "none"}
Why now: ${enriched.why_now ?? "not determined"}
Timing signals: ${enriched.timing_signals.join("; ") || "none confirmed"}
Risks: ${enriched.risks_weaknesses?.join("; ") ?? "none noted"}
Missing data: ${enriched.missing_data.join("; ") || "none"}
Account thesis: ${enriched.account_thesis ?? "not yet determined"}

Return JSON:
{
  "score_breakdown": { "role_fit": 0, "company_fit": 0, "pain_fit": 0, "timing_signal": 0, "reachability": 0, "strategic_relevance": 0 },
  "score_dimensions": {
    "icp_fit": 0, "signal_strength": 0, "timing": 0,
    "evidence_quality": 0, "strategic_value": 0, "confidence": 0, "disqualification_risk": 0
  },
  "fit_score": 0.0,
  "category": "HOT|WARM|COLD|DISCARD",
  "fit_reasons": ["specific reason backed by evidence"],
  "disqualification_reasons": ["only real concerns — empty if none"],
  "qualification_confidence": 0.0,
  "score_explanation": "Score is [category] because [ICP Fit: X/100 — reason]. [Signal: X/100 — reason]. [Timing: X/100 — reason]. [Key risk].",
  "signal_interpretation": "1-2 sentences: what the score pattern MEANS commercially — not just what the signals are. If HOT: why this is high priority. If DISCARD: why to skip. If WARM/COLD: what's blocking and what would unlock it.",
  "opportunity_tier_reason": "1 sentence: the specific reason this account is HOT/WARM/COLD/DISCARD — what dimension is the deciding factor"
}`;

  type ClaudeResult = Omit<QualifiedLead, "enrichment">;
  const result = await callClaudeJSON<ClaudeResult>(SYSTEM, userMsg, 2200);
  return { enrichment: enriched, ...result };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDemoSignalInterpretation(
  enriched: EnrichedLead,
  dims: ScoreDimensions,
  hasMeaningfulSignal: boolean
): string {
  const company = enriched.candidate.company;
  const industry = enriched.candidate.industry ?? "their segment";

  if (!hasMeaningfulSignal) {
    if (dims.icp_fit >= 70) {
      return `${company} has strong ICP fit (${dims.icp_fit}/100) but no confirmed timing signal — outreach is justified on segment patterns alone, but should be framed as hypothesis-led rather than signal-led`;
    }
    return `No confirmed signal for ${company} — opportunity is based entirely on ${industry} profile fit. Consider monitoring for a public trigger before investing outreach resources`;
  }

  const signalText = enriched.timing_signals.join(" ").toLowerCase();
  if (/hir|recruit/.test(signalText) && /expand|grow|open|new/.test(signalText)) {
    return `${company} is hiring and expanding simultaneously — this pattern typically signals a 60–90 day window where companies actively evaluate vendors to support operational scaling`;
  }
  if (/raised|funded|series|investment/.test(signalText)) {
    return `Post-funding phase at ${company} — companies in this state actively buy capabilities. This is a high-urgency window; contact within 60 days of the funding announcement`;
  }
  if (/warehouse|facilit|distribut/.test(signalText)) {
    return `${company}'s infrastructure expansion signals an operational scaling phase — the period when account prioritization and vendor evaluation gaps typically emerge`;
  }
  return `${company} has confirmed buying signals (signal_strength: ${dims.signal_strength}/100) — this increases outreach relevance vs comparable accounts without signals`;
}

function buildDemoTierReason(
  category: LeadCategory,
  dims: ScoreDimensions,
  hasSignal: boolean,
  fitScore: number
): string {
  switch (category) {
    case "HOT":
      return `HOT: meets all key criteria — icp_fit: ${dims.icp_fit}/100, signal_strength: ${dims.signal_strength}/100, evidence_quality: ${dims.evidence_quality}/100`;
    case "WARM":
      if (!hasSignal) return `WARM: strong ICP fit but missing a confirmed timing signal — outreach is justified with a hypothesis-framed opener`;
      if (dims.icp_fit < 70) return `WARM: confirmed signal but ICP fit is partial (${dims.icp_fit}/100) — validate the specific pain hypothesis before full outreach`;
      return `WARM: close to HOT but one key dimension is below threshold — not enough evidence for top-tier priority`;
    case "COLD":
      return `COLD: ${hasSignal ? "signal exists but ICP fit or evidence quality too weak for Wave 1" : "no confirmed signal and fit score below WARM threshold"} — monitor list, not outreach list`;
    case "DISCARD":
      return `DISCARD: fails on hard ICP criteria at score ${fitScore}/10 — do not include in any outreach sequence`;
  }
}

function scoreToCategory(score: number): LeadCategory {
  if (score >= 8) return "HOT";
  if (score >= 6) return "WARM";
  if (score >= 4) return "COLD";
  return "DISCARD";
}

function buildScoreExplanation(
  fit_score: number,
  category: LeadCategory,
  dims: ScoreDimensions,
  company: string,
  hasSignal: boolean
): string {
  const signalNote = hasSignal
    ? `Signal Strength: ${dims.signal_strength}/100 — confirmed buying signal detected`
    : `Signal Strength: ${dims.signal_strength}/100 — no confirmed signal; timing is inferred from segment`;
  const timingNote = dims.timing >= 60
    ? `Timing: ${dims.timing}/100 — evidence suggests active evaluation window`
    : `Timing: ${dims.timing}/100 — timing not confirmed`;
  const evidenceNote = dims.evidence_quality >= 70
    ? `Evidence Quality: ${dims.evidence_quality}/100 — strong evidence base`
    : dims.evidence_quality >= 45
    ? `Evidence Quality: ${dims.evidence_quality}/100 — moderate evidence; some gaps`
    : `Evidence Quality: ${dims.evidence_quality}/100 — thin evidence; inferred opportunity`;

  return `Score ${fit_score}/10 → ${category}. ICP Fit: ${dims.icp_fit}/100 — ${dims.icp_fit >= 70 ? "strong industry and size match" : "partial segment match"}. ${signalNote}. ${timingNote}. ${evidenceNote}. Disqualification risk: ${dims.disqualification_risk}/100.`;
}

function buildDemoFitReasons(
  candidate: LeadCandidate,
  enriched: EnrichedLead,
  scores: { roleSc: number; industrySc: number; evidenceSc: number; timingSc: number }
): string[] {
  const reasons: string[] = [];
  const industry = candidate.industry ?? "their industry";
  const company = candidate.company;

  if (scores.roleSc >= 2.5) reasons.push(`${company} profile suggests strong commercial activity — leadership roles indicate active vendor evaluation`);
  else if (scores.roleSc >= 1.5) reasons.push(`${company} shows characteristics of an account with active go-to-market investment`);

  if (scores.industrySc >= 2.0) reasons.push(`${industry} is a primary ICP segment — strong offer relevance at this company stage`);
  else if (scores.industrySc >= 1.4) reasons.push(`${industry} companies frequently prioritize this type of commercial investment at the ${candidate.company_size ?? "mid-market"} scale`);

  if (scores.timingSc > 0 && enriched.timing_signals[0]) {
    const signal = enriched.timing_signals[0].slice(0, 100);
    reasons.push(`Buying signal detected (public record): ${signal}`);
  }

  if (candidate.confidence_score >= 0.80) {
    reasons.push(`High evidence confidence (${Math.round(candidate.confidence_score * 100)}%) — strong signal quality from ${candidate.source}`);
  } else if (candidate.confidence_score >= 0.60) {
    reasons.push(`Moderate evidence confidence (${Math.round(candidate.confidence_score * 100)}%) — adequate basis for first outreach`);
  }

  if (enriched.why_now) {
    reasons.push(enriched.why_now);
  }

  return reasons.length > 0 ? reasons : [`${company} matches target company profile on industry and size criteria`];
}

function buildDemoDisqualReasons(
  candidate: LeadCandidate,
  enriched: EnrichedLead,
  score: number,
  hasMeaningfulSignal: boolean
): string[] {
  const reasons: string[] = [];

  if (candidate.confidence_score < 0.4) {
    reasons.push(`Low signal confidence (${Math.round(candidate.confidence_score * 100)}%) — evidence base is thin; manual research recommended before outreach`);
  }
  if (!hasMeaningfulSignal) {
    reasons.push("No confirmed buying signals from public record — outreach angle based on company profile and segment pattern only");
  }
  if (score < 4) {
    reasons.push("Overall account profile does not meet minimum ICP criteria — recommend excluding from active sequence");
  }
  if (enriched.risks_weaknesses && enriched.risks_weaknesses.length > 0) {
    reasons.push(...enriched.risks_weaknesses.slice(0, 2));
  }

  return reasons;
}
