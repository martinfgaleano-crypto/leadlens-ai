import type { EnrichedLead, ICP, QualifiedLead, LeadCandidate, LeadCategory } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

/**
 * Scores the lead against the ICP and assigns HOT/WARM/COLD/DISCARD.
 *
 * DEMO_MODE: role + industry + email + size + timing signals → calibrated score
 * Production: Claude scores with full ICP context
 *
 * Thresholds: HOT ≥8 | WARM 6–7.9 | COLD 4–5.9 | DISCARD <4
 */
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

  // ── 1. Decision-making authority (0–3.0) ─────────────────────────────────
  // Determines if this person can actually buy outbound services
  const roleSc =
    /\b(ceo|co-?founder|founder|owner|president)\b/.test(title) ? 3.0 :
    /\b(cro|chief revenue officer)\b/.test(title) ? 2.8 :
    /\b(vp\b|vp of|head of)\b/.test(title) && /\b(sales|revenue|growth|business|bd)\b/.test(title) ? 2.5 :
    /\b(vp\b|vp of|head of)\b/.test(title) && /\bmarketing\b/.test(title) ? 1.8 :
    /\bdirector\b/.test(title) && /\b(sales|revenue|business|growth)\b/.test(title) ? 2.2 :
    /\b(director|managing director|coo|cmo)\b/.test(title) ? 1.8 :
    /\b(cfo)\b/.test(title) ? 1.5 :
    /\b(manager|lead|senior)\b/.test(title) ? 1.2 :
    0.5;

  // ── 2. Industry fit for B2B outbound offer (0–2.5) ────────────────────────
  const industrySc =
    /\bsaas\b/.test(industry) ? 2.5 :
    /\b(agency|marketing)\b/.test(industry) ? 1.5 :
    /\bconsult/.test(industry) ? 1.4 :
    /\b(fintech|healthtech|analytics|e-?commerce|logistics)\b/.test(industry) ? 1.0 :
    0.4;

  // ── 3. Email reachability (0–1.5) ────────────────────────────────────────
  const emailSc =
    candidate.email_status === "verified" ? 1.5 :
    (candidate.email_status === "unknown" && !!candidate.email) ? 0.8 :
    0; // not_found or invalid = 0

  // ── 4. Company size fit (target 11–200) (0–1.0) ──────────────────────────
  const sizeSc =
    /^(11-50|51-200)$/.test(size) ? 1.0 :
    /^1-10$/.test(size) ? 0.7 :
    /^201-500$/.test(size) ? 0.6 :
    0.4;

  // ── 5. Timing signal present (0–0.5) ──────────────────────────────────────
  const hasMeaningfulSignal = enriched.timing_signals.some(s =>
    !s.toLowerCase().startsWith("no live") && !s.toLowerCase().includes("inferred")
  );
  const timingSc = hasMeaningfulSignal ? 0.5 : 0;

  // ── 6. Confidence calibration (±0.8 centered at 0.65) ────────────────────
  const confBoost = (candidate.confidence_score - 0.65) * 1.6;

  // Max theoretical: 3.0 + 2.5 + 1.5 + 1.0 + 0.5 + 0.8 = 9.3
  const raw = roleSc + industrySc + emailSc + sizeSc + timingSc + confBoost;
  const fit_score = parseFloat(Math.min(10, Math.max(0, raw)).toFixed(1));
  const category = scoreToCategory(fit_score);

  const fit_reasons = buildDemoFitReasons(candidate, enriched, { roleSc, industrySc, emailSc, timingSc });
  const disqualification_reasons = buildDemoDisqualReasons(candidate, enriched, fit_score);

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
      reachability: emailSc / 1.5,
      strategic_relevance: parseFloat(Math.min(1, (confBoost + 0.8) / 1.6).toFixed(2)),
    },
  };
}

// ─── Claude scoring ───────────────────────────────────────────────────────────

async function scoreLeadWithClaude(enriched: EnrichedLead, icp: ICP): Promise<QualifiedLead> {
  const { callClaudeJSON } = await import("@/lib/anthropic");
  const { candidate } = enriched;

  const SYSTEM = `You are a senior B2B SDR qualifying leads against an ICP. Score calibrated — neither inflate nor over-penalize.

Scoring dimensions (max 10 total):
- role_fit 0–2: Is this person the economic buyer or key influencer for this offer?
- company_fit 0–2: Does the company industry and size match the ICP?
- pain_fit 0–2: Is the inferred pain plausible and specific to this offer?
- timing_signal 0–2: Are there confirmed signals (hiring, funding, growth events)? 0 if none — but absence does NOT disqualify a HOT lead.
- reachability 0–1: Email verified = 1, unknown = 0.5, not found = 0
- strategic_relevance 0–1: Is this a high-value account type for the offer?

Category thresholds: HOT ≥8, WARM 6–7.9, COLD 4–5.9, DISCARD <4

Calibration guidance:
- HOT is appropriate when role + company + pain all score strongly, even with timing_signal = 0. Confirmed timing signals are a bonus, not a requirement.
- WARM is appropriate when 2 of 3 (role, company, pain) are strong but 1 is weak or unconfirmed.
- COLD when there are real ICP mismatches (wrong company size, partially wrong title, thin data).
- DISCARD only when there is a clear hard disqualifier: wrong industry, wrong title with no buyer path, bad email, or out-of-scope geography.
- Do not penalize a lead twice for the same missing data. Missing web context is a research limitation, not a disqualifier.

Return only valid JSON.`;

  const userMsg = `ICP:
- Industries: ${icp.target_industries.join(", ")}
- Titles: ${icp.target_titles.join(", ")}
- Size: ${icp.company_size_range}
- Pain points: ${icp.pain_points.join("; ")}
- Disqualifiers: ${icp.disqualifiers.join("; ")}

Lead: ${candidate.name ?? "Unknown"}, ${candidate.title ?? "?"} at ${candidate.company}
Industry: ${candidate.industry ?? "?"} | Size: ${candidate.company_size ?? "?"}
Email: ${candidate.email ?? "none"} (${candidate.email_status ?? "unknown"})
Company summary: ${enriched.company_summary ?? "none"}
Role relevance: ${enriched.role_relevance ?? "none"}
Inferred pain: ${enriched.inferred_pain ?? "none"}
Timing signals: ${enriched.timing_signals.join("; ") || "none"}
Missing data: ${enriched.missing_data.join("; ") || "none"}

Return JSON:
{
  "score_breakdown": { "role_fit": 0, "company_fit": 0, "pain_fit": 0, "timing_signal": 0, "reachability": 0, "strategic_relevance": 0 },
  "fit_score": 0.0,
  "category": "HOT|WARM|COLD|DISCARD",
  "fit_reasons": ["string"],
  "disqualification_reasons": ["string — empty array if none"],
  "qualification_confidence": 0.0
}`;

  type ClaudeResult = Omit<QualifiedLead, "enrichment">;
  const result = await callClaudeJSON<ClaudeResult>(SYSTEM, userMsg, 1200);
  return { enrichment: enriched, ...result };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreToCategory(score: number): LeadCategory {
  if (score >= 8) return "HOT";
  if (score >= 6) return "WARM";
  if (score >= 4) return "COLD";
  return "DISCARD";
}

function buildDemoFitReasons(
  candidate: LeadCandidate,
  enriched: EnrichedLead,
  scores: { roleSc: number; industrySc: number; emailSc: number; timingSc: number }
): string[] {
  const reasons: string[] = [];
  const title = candidate.title ?? "this role";
  const industry = candidate.industry ?? "their industry";
  const company = candidate.company;

  if (scores.roleSc >= 2.5) reasons.push(`${title} is a primary decision-maker for outbound tools and pipeline strategy`);
  else if (scores.roleSc >= 2.0) reasons.push(`${title} has direct authority over sales process and vendor selection`);
  else if (scores.roleSc >= 1.5) reasons.push(`${title} is involved in growth decisions, though not the sole decision-maker`);

  if (scores.industrySc >= 2.5) reasons.push(`${industry} companies are LeadLens's primary ICP — high offer relevance`);
  else if (scores.industrySc >= 1.4) reasons.push(`${industry} businesses regularly buy outbound research services`);

  if (scores.emailSc >= 1.5) reasons.push(`Email verified — direct outreach possible at highest deliverability`);
  else if (scores.emailSc > 0) reasons.push(`Email on file — needs verification before high-volume send`);

  if (scores.timingSc > 0 && enriched.timing_signals[0]) {
    const signal = enriched.timing_signals[0].slice(0, 80);
    reasons.push(`Timing signal detected: ${signal}`);
  }

  if (candidate.confidence_score >= 0.85) reasons.push(`High source confidence (${Math.round(candidate.confidence_score * 100)}%) — data quality strong`);

  return reasons.length > 0 ? reasons : [`${company} matches target company profile for this offer`];
}

function buildDemoDisqualReasons(
  candidate: LeadCandidate,
  enriched: EnrichedLead,
  score: number
): string[] {
  const reasons: string[] = [];

  if (!candidate.email || candidate.email_status === "not_found") reasons.push("No email found — LinkedIn DM is the only reachable channel");
  if (candidate.email_status === "invalid") reasons.push("Email marked invalid — do not send before re-verifying");
  if (score < 4) reasons.push("Overall profile does not meet minimum ICP criteria for this offer");
  if (/\b(procurement|hr|it|legal|finance)\b/i.test(candidate.title ?? "")) reasons.push("Role is not typically the buyer for outbound services");
  if (/\b(manufacturing|government|non-?profit|education)\b/i.test(candidate.industry ?? "")) reasons.push("Industry is outside primary ICP — lower conversion likelihood");

  return reasons;
}
