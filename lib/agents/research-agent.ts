import type { LeadCandidate, EnrichedLead, LeadSearchCriteria } from "@/types";

const IS_DEMO = process.env.DEMO_MODE === "true";

/**
 * Enriches a single LeadCandidate with company context, pain points, and timing signals.
 * In DEMO_MODE: returns structured enrichment from existing candidate data.
 * In production: calls Claude + optionally Tavily for web research.
 */
export async function runResearchAgent(
  candidate: LeadCandidate,
  criteria: LeadSearchCriteria
): Promise<EnrichedLead> {
  if (IS_DEMO || !process.env.ANTHROPIC_API_KEY) {
    return buildDemoEnrichment(candidate, criteria);
  }
  return buildClaudeEnrichment(candidate, criteria);
}

// ─── Demo enrichment ──────────────────────────────────────────────────────────

function buildDemoEnrichment(
  candidate: LeadCandidate,
  criteria: LeadSearchCriteria
): EnrichedLead {
  const industry = candidate.industry ?? "their industry";
  const company = candidate.company;
  const size = candidate.company_size ?? "a small team";

  return {
    candidate,
    company_summary: `${company} is a ${size} company operating in the ${industry} space. Based on available public signals, the company appears to be at an active growth stage with characteristics that align with the target ICP.`,
    role_relevance: `${company} operates in ${industry} at the ${size} stage — a profile associated with active commercial investment and vendor evaluation cycles. This account matches the ICP on industry fit and company scale.`,
    inferred_pain: `Companies in ${industry} at the ${size} stage often lack a systematic way to identify and prioritize which accounts to approach — signals exist publicly but aren't organized into actionable intelligence.`,
    timing_signals: candidate.raw_context
      ? [extractKeySignal(candidate.raw_context)]
      : ["No confirmed public timing signals — company profile and segment used for opportunity angle"],
    evidence: [
      `Signal source: ${candidate.source}`,
      candidate.source_url ? `Source reference available` : "No direct source reference",
      `Source confidence: ${Math.round(candidate.confidence_score * 100)}%`,
    ],
    missing_data: [
      "No confirmed recent news or announcements verified",
      "Funding status not confirmed from public record",
      ...(!candidate.raw_context ? ["No direct public signal context available — segment inference used"] : []),
    ],
    research_confidence: candidate.confidence_score * 0.8,
  };
}

// Extracts the most actionable timing signal from raw_context.
// Prefers sentences with explicit buying triggers over generic company descriptions.
function extractKeySignal(rawContext: string): string {
  const sentences = rawContext
    .split(/\.\s+/)
    .map(s => s.trim().replace(/\.$/, ""))
    .filter(s => s.length > 12);

  // Prefer sentences with explicit hiring/growth/timing keywords
  const TRIGGER_PATTERNS = /\b(recently|just|new\b|hired|raised|launched|growing|building|looking|pipeline|outbound|sdr|bdr|no\s+dedic|wants|ready|trying)\b/i;
  const bestSignal = sentences.find(s => TRIGGER_PATTERNS.test(s));
  if (bestSignal) return bestSignal;

  // Fallback: longest meaningful sentence (avoids short company-category labels like "B2B SaaS")
  const byLength = [...sentences].sort((a, b) => b.length - a.length);
  return byLength[0] ?? rawContext.slice(0, 110).replace(/\.$/, "");
}

// ─── Claude + Tavily enrichment ───────────────────────────────────────────────

async function buildClaudeEnrichment(
  candidate: LeadCandidate,
  criteria: LeadSearchCriteria
): Promise<EnrichedLead> {
  const { callClaudeJSON } = await import("@/lib/anthropic");

  // Optionally fetch web context via Tavily if key is available
  let webContext = "";
  if (process.env.TAVILY_API_KEY && candidate.company) {
    try {
      const { searchTavilyForLead } = await import("@/lib/providers/tavily-lead-provider");
      webContext = await searchTavilyForLead(candidate.company, candidate.industry);
    } catch {
      // Tavily failure is non-blocking
    }
  }

  const SYSTEM = `You are a B2B commercial intelligence analyst building account-level opportunity research.
Focus on the company as a whole — not on any individual contact or decision-maker.
Rules:
- Never invent specific news, funding rounds, or hiring data you cannot confirm from the provided context.
- If you are inferring from industry/segment patterns, say so explicitly in missing_data.
- Only put confirmed or clearly evidenced signals in timing_signals.
- company_summary and role_relevance describe the COMPANY, not a person.
- role_relevance should explain why this account (company/segment) is a relevant opportunity for the offer — not why a specific person would buy.
- research_confidence is 0–1.
Return only valid JSON.`;

  const userMsg = `Offer: ${criteria.offer_summary}
Company: ${candidate.company}
Industry: ${candidate.industry ?? "unknown"} | Size: ${candidate.company_size ?? "unknown"} | Location: ${candidate.location ?? "unknown"}
Public source: ${candidate.source} | Confidence: ${Math.round(candidate.confidence_score * 100)}%
${candidate.raw_context ? `Raw context (public signals observed): ${candidate.raw_context}` : "Raw context: none"}
Web context (live search): ${webContext || "none available"}

Return JSON:
{
  "company_summary": "2-3 sentences about this company — its market, scale, and what makes it commercially interesting",
  "role_relevance": "Why this account (not a person) is a relevant opportunity for the offer — segment fit, stage, likely priorities",
  "inferred_pain": "1 sentence on the most plausible company-level challenge or gap relevant to this offer",
  "timing_signals": ["Extract specific buying signals from raw context (hiring, expansions, launches, partnerships). Use exact details from raw_context when available. Empty array only if truly no signals present."],
  "evidence": ["what public signals or sources support this account's relevance — cite raw_context details specifically"],
  "missing_data": ["what we couldn't confirm from public record beyond the provided context"],
  "research_confidence": 0.0
}`;

  const result = await callClaudeJSON<Omit<EnrichedLead, "candidate">>(SYSTEM, userMsg, 1500);
  return { candidate, ...result };
}
