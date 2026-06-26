import type { QualifiedLead, LeadSearchCriteria, PersonalizationResult } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

/**
 * Generates a PersonalizationResult for a qualified opportunity.
 * Returns a structured object — NOT just a trigger string.
 * The trigger string is still available as .personalization_trigger for backward compat.
 */
export async function runPersonalizationAgent(
  qualified: QualifiedLead,
  criteria: LeadSearchCriteria
): Promise<PersonalizationResult> {
  if (IS_DEMO || !process.env.ANTHROPIC_API_KEY) {
    return buildDemoPersonalization(qualified, criteria);
  }
  return buildClaudePersonalization(qualified, criteria);
}

// ─── Deterministic personalization ───────────────────────────────────────────

function buildDemoPersonalization(
  qualified: QualifiedLead,
  criteria: LeadSearchCriteria
): PersonalizationResult {
  // Guard: never generate personalization for DISCARD accounts
  if (qualified.category === "DISCARD" || qualified.fit_score < 4) {
    const disqualReasons = qualified.disqualification_reasons.slice(0, 2).join("; ");
    return {
      personalization_trigger: `DO NOT CONTACT — ${qualified.enrichment.candidate.company} scored ${qualified.fit_score}/10 (DISCARD). ${disqualReasons}`,
      recommended_angle: "DO NOT CONTACT — account fails minimum ICP criteria. Exclude from all outreach sequences.",
      account_reasoning: disqualReasons || "ICP mismatch — see disqualification_reasons for details",
      what_to_avoid: "Do not send any outreach to this account. It does not meet minimum ICP criteria.",
      strongest_hook: "N/A — DISCARD account",
      personalization_confidence: 0,
    };
  }

  const enrichment = qualified.enrichment;
  const { candidate } = enrichment;
  const company = candidate.company;
  const industry = candidate.industry ?? "their sector";
  const score = qualified.fit_score;

  // Find best timing signal (if any)
  const liveSignal = enrichment.timing_signals[0];
  const isCleanSignal = liveSignal &&
    !liveSignal.toLowerCase().startsWith("no confirmed") &&
    !liveSignal.toLowerCase().includes("inferred") &&
    liveSignal.length > 20;

  // Determine recommended angle based on evidence
  let recommended_angle: string;
  let personalization_trigger: string;
  let account_reasoning: string;
  let strongest_hook: string;
  let what_to_avoid: string;

  if (isCleanSignal && liveSignal) {
    const signal = liveSignal.replace(/\.$/, "");
    recommended_angle = `Signal-led angle: Reference the public signal directly — "${signal.slice(0, 80)}..." — as the reason for reaching out now. This is the strongest entry point.`;
    personalization_trigger = `Noticed that ${company} ${signal.charAt(0).toLowerCase()}${signal.slice(1)}. That kind of signal often correlates with commercial evaluation activity — wanted to reach out while the timing looks relevant.`;
    account_reasoning = `${company} has a confirmed public buying signal. This is the highest-quality timing to approach — the signal suggests an active commercial decision window of 30–90 days.`;
    strongest_hook = `"${company} [signal]" — reference the specific event and ask if it reflects a broader commercial priority`;
    what_to_avoid = `Do not claim to know their internal priorities. Do not over-interpret the signal — present it as context, not certainty. Avoid generic language like "I saw you're growing."`;
  } else if (enrichment.pain_hypothesis) {
    recommended_angle = `Hypothesis-led angle: Frame the conversation around the pain hypothesis — "${enrichment.pain_hypothesis.slice(0, 80)}..." — as a question, not a claim.`;
    personalization_trigger = `${company} fits the profile of ${industry} companies we work with at this stage: strong commercial foundation, but identifying which accounts to prioritize — and why now — tends to become a bottleneck before the team scales.`;
    account_reasoning = `No confirmed signal available for ${company}. Outreach should be hypothesis-led — ask about the pain, don't assert it. The risk: lower response rate without a timing trigger.`;
    strongest_hook = `Ask about how they currently prioritize accounts — not whether they have a problem`;
    what_to_avoid = `Avoid asserting you know their challenges. Don't say "you must be struggling with X." Frame everything as a question or observation from similar companies in ${industry}.`;
  } else {
    recommended_angle = `Segment-pattern angle: Position based on ${industry} companies at this stage, not on ${company}'s specific behavior. Keep the opener curious and low-commitment.`;
    personalization_trigger = `${company} caught our attention as an ${industry} company at a stage where commercial intelligence tends to matter most. Thought it might be worth a quick conversation.`;
    account_reasoning = `Limited evidence available for ${company}. This is a profile-based opportunity — lower signal confidence. Outreach should be lighter touch with a clear exit if there's no fit.`;
    strongest_hook = `Reference the ${industry} segment and a relevant outcome from similar companies — not specific claims about ${company}`;
    what_to_avoid = `Do not reference specific news or claims about ${company} — there's not enough evidence. Avoid any language that sounds like surveillance or assumptions about their internal state.`;
  }

  const personalization_confidence =
    isCleanSignal ? 0.85 :
    enrichment.pain_hypothesis ? 0.60 :
    0.35;

  return {
    personalization_trigger,
    recommended_angle,
    account_reasoning,
    what_to_avoid,
    strongest_hook,
    personalization_confidence,
  };
}

// ─── Claude personalization ───────────────────────────────────────────────────

async function buildClaudePersonalization(
  qualified: QualifiedLead,
  criteria: LeadSearchCriteria
): Promise<PersonalizationResult> {
  // Guard: skip Claude call entirely for DISCARD accounts
  if (qualified.category === "DISCARD" || qualified.fit_score < 4) {
    const reasons = qualified.disqualification_reasons.slice(0, 2).join("; ");
    return {
      personalization_trigger: `DO NOT CONTACT — ${qualified.enrichment.candidate.company} scored ${qualified.fit_score}/10 (DISCARD). ${reasons}`,
      recommended_angle: "DO NOT CONTACT — account fails minimum ICP criteria.",
      account_reasoning: reasons || "ICP mismatch",
      what_to_avoid: "Do not send any outreach to this account.",
      strongest_hook: "N/A — DISCARD account",
      personalization_confidence: 0,
    };
  }

  const { callClaudeJSON } = await import("@/lib/anthropic");
  const enrichment = qualified.enrichment;
  const { candidate } = enrichment;

  const SYSTEM = `You are a B2B commercial intelligence analyst building an account-level personalization brief.
This is an INTERNAL document — not the outreach itself.
Your job is to identify the strongest, most defensible angle for approaching this company, based on evidence.

Rules:
- If there's a confirmed public signal, the recommended_angle MUST be signal-led
- If no signal exists, the angle must be hypothesis-led — based on company stage and segment pattern
- Never invent signals or events not in the evidence
- what_to_avoid must be specific to this account — not generic "don't be pushy"
- personalization_confidence: 0.8–1.0 if signal exists, 0.5–0.7 if hypothesis-led, 0.2–0.4 if thin evidence
- strongest_hook: the single most specific and relevant entry point for a first touch
- account_reasoning: honestly state whether this is signal-driven or pattern-driven, and what that means
Return only valid JSON.`;

  const userMsg = `Offer: ${criteria.offer_summary}
Value prop: ${criteria.value_proposition}

Company: ${candidate.company}
Industry: ${candidate.industry ?? "?"} | Size: ${candidate.company_size ?? "?"} | Location: ${candidate.location ?? "?"}
Fit score: ${qualified.fit_score}/10 (${qualified.category})
Fit reasons: ${qualified.fit_reasons.join("; ")}
Timing signals (confirmed): ${enrichment.timing_signals.filter(s => !s.toLowerCase().includes("no confirmed")).join("; ") || "none"}
Pain hypothesis: ${enrichment.pain_hypothesis ?? enrichment.inferred_pain ?? "none"}
Why now: ${enrichment.why_now ?? "not determined"}
Risks: ${enrichment.risks_weaknesses?.join("; ") ?? "none noted"}

Return JSON:
{
  "personalization_trigger": "1–2 sentence internal insight: why approach this company right now",
  "recommended_angle": "The specific sales angle backed by evidence — signal-led if possible, hypothesis-led if not",
  "account_reasoning": "Honest explanation of why this angle, what confidence level, what assumptions it makes",
  "what_to_avoid": "Specific things NOT to say or assume when approaching this company",
  "strongest_hook": "Single best first-touch hook — specific, evidence-backed, non-generic",
  "personalization_confidence": 0.0
}`;

  return callClaudeJSON<PersonalizationResult>(SYSTEM, userMsg, 1000);
}
