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
  const firstName = candidate.name?.split(" ")[0] ?? "there";
  const company = candidate.company;
  const role = candidate.title ?? "your role";
  const industry = candidate.industry ?? "your industry";

  // Use timing signal if it's clean and specific (not a generic fallback)
  const liveSignal = enrichment.timing_signals[0];
  const isCleanSignal = liveSignal &&
    !liveSignal.toLowerCase().startsWith("no live") &&
    !liveSignal.toLowerCase().includes("inferred") &&
    liveSignal.length > 20;

  if (isCleanSignal) {
    const isPersonal = /\b(recently|just|new\b|hired|raised|joined|launched|growing|building|looking|posted|no\s+dedic|ready to|wants to)\b/i.test(liveSignal);
    if (isPersonal) {
      // Strip 3rd-person references to the lead ("Marcus wears..." → use context differently)
      const startsWithName = new RegExp(`^${firstName}\\s+`, "i").test(liveSignal);
      if (!startsWithName) {
        const signal = liveSignal.replace(/\.$/, "");
        return `${firstName} — noticed that ${signal.charAt(0).toLowerCase()}${signal.slice(1)} at ${company}. That usually signals it's worth thinking more seriously about systematic outbound.`;
      }
    }
    // Signal is a company descriptor — use role/industry angle instead
  }

  // Use ICP-aligned pain angle
  if (enrichment.inferred_pain) {
    return `${firstName} — most ${role}s in ${industry} tell us that building a consistent outbound pipeline without adding headcount is one of the harder problems at the ${candidate.company_size ?? "growth"} stage. Curious if that's true for ${company}.`;
  }

  // Fallback: role + company context
  return `${firstName} — saw that ${company} fits the profile of ${industry} teams we work with: strong product, growth-stage, outbound is becoming a bottleneck. Thought LeadLens might be worth a quick look.`;
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
  const SYSTEM = `You are a B2B SDR research assistant writing internal lead notes.
Write a concise analytical insight about this lead — NOT a public-facing email sentence.
Rules:
- 1–2 sentences, written as internal context for an outreach writer
- Capture the most specific thing about their role, stage, or likely pain
- If no confirmed signals exist, frame clearly as pattern-based inference
- Never invent news, funding rounds, or hiring events
- Do NOT write something that starts with the person's first name
- Do NOT write something that sounds like an email opener
Return only JSON.`;

  const userMsg = `Lead: ${candidate.name ?? "?"}, ${candidate.title ?? "?"} at ${candidate.company}
Industry: ${candidate.industry ?? "?"} | Size: ${candidate.company_size ?? "?"}
Timing signals: ${enrichment.timing_signals.join("; ") || "none confirmed"}
Inferred pain: ${enrichment.inferred_pain ?? "none"}
Company summary: ${enrichment.company_summary ?? "none"}
Fit reasons: ${qualified.fit_reasons.join("; ")}
Offer context: ${criteria.offer_summary}

Return JSON: { "trigger_insight": "1–2 sentence internal note" }`;

  const result = await callClaudeJSON<{ trigger_insight: string }>(SYSTEM, userMsg, 300);
  return result.trigger_insight;
}
