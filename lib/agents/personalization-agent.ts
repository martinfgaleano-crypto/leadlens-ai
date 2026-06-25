import type { QualifiedLead, LeadSearchCriteria } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

/**
 * Generates a personalized opening trigger sentence for outreach.
 * Uses available data — never invents facts not present in enrichment.
 */
export async function runPersonalizationAgent(
  qualified: QualifiedLead,
  criteria: LeadSearchCriteria
): Promise<string> {
  if (IS_DEMO || !process.env.ANTHROPIC_API_KEY) {
    return buildDemoTrigger(qualified, criteria);
  }
  return buildClaudeTrigger(qualified, criteria);
}

// ─── Deterministic trigger ────────────────────────────────────────────────────

function buildDemoTrigger(qualified: QualifiedLead, criteria: LeadSearchCriteria): string {
  const enrichment = qualified.enrichment;
  const { candidate } = enrichment;
  const company = candidate.company;
  const industry = candidate.industry ?? "your industry";

  // Use timing signal if it's clean and specific (not a generic fallback)
  const liveSignal = enrichment.timing_signals[0];
  const isCleanSignal = liveSignal &&
    !liveSignal.toLowerCase().startsWith("no confirmed") &&
    !liveSignal.toLowerCase().includes("inferred") &&
    liveSignal.length > 20;

  if (isCleanSignal) {
    const signal = liveSignal.replace(/\.$/, "");
    return `Noticed that ${company} ${signal.charAt(0).toLowerCase()}${signal.slice(1)}. That kind of signal often correlates with commercial evaluation activity — wanted to reach out while the timing looks relevant.`;
  }

  // Use ICP-aligned company-level pain angle
  if (enrichment.inferred_pain) {
    return `${company} fits the profile of ${industry} teams we work with at this stage: strong commercial foundation, but identifying which accounts to prioritize — and why now — tends to become a bottleneck before the team scales.`;
  }

  // Fallback: segment + company context
  return `${company} caught our attention as an ${industry} company at a stage where commercial focus tends to matter most. Thought it might be worth a quick conversation.`;
}

// ─── Claude trigger ───────────────────────────────────────────────────────────

async function buildClaudeTrigger(
  qualified: QualifiedLead,
  criteria: LeadSearchCriteria
): Promise<string> {
  const { callClaudeJSON } = await import("@/lib/anthropic");
  const enrichment = qualified.enrichment;
  const { candidate } = enrichment;

  // The trigger is an INTERNAL insight for the outreach writer — not a copyable email line.
  // The outreach agent uses this as context to write its own natural opener.
  const SYSTEM = `You are a B2B commercial intelligence analyst writing an internal opportunity note.
Write a concise analytical insight about this COMPANY/ACCOUNT — NOT about any individual contact.
Rules:
- 1–2 sentences, written as internal context for an outreach writer
- Focus on the company's stage, segment fit, public signals, or likely commercial priorities
- If no confirmed signals exist, frame clearly as pattern-based inference from segment/industry
- Never invent news, funding rounds, or hiring events
- Do NOT mention a person's name, title, email, or LinkedIn
- Do NOT write something that sounds like a direct email opener to a person
- The note should answer: "Why is this company worth reaching out to, and why now?"
Return only JSON.`;

  const userMsg = `Company: ${candidate.company}
Industry: ${candidate.industry ?? "?"} | Size: ${candidate.company_size ?? "?"} | Location: ${candidate.location ?? "?"}
Timing signals: ${enrichment.timing_signals.join("; ") || "none confirmed"}
Inferred pain: ${enrichment.inferred_pain ?? "none"}
Company summary: ${enrichment.company_summary ?? "none"}
Fit reasons: ${qualified.fit_reasons.join("; ")}
Offer context: ${criteria.offer_summary}

Return JSON: { "trigger_insight": "1–2 sentence internal note about this company opportunity" }`;

  const result = await callClaudeJSON<{ trigger_insight: string }>(SYSTEM, userMsg, 300);
  return result.trigger_insight;
}
