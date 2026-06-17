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
  const title = candidate.title ?? "their role";
  const company = candidate.company;
  const size = candidate.company_size ?? "a small team";

  return {
    candidate,
    company_summary: `${company} is a ${size} company in the ${industry} space. They serve B2B clients and appear to be at a growth stage based on available signals.`,
    role_relevance: `As ${title}, this person likely has decision-making authority over sales tools and pipeline strategy. They would be responsible for building or approving new vendor relationships.`,
    inferred_pain: `Growing companies in ${industry} at the ${size} stage often struggle with consistent outbound — not enough headcount to scale prospecting manually.`,
    timing_signals: candidate.raw_context
      ? [extractKeySignal(candidate.raw_context)]
      : ["No live timing signals available — role and industry used for outreach angle"],
    evidence: [
      `Source: ${candidate.source}`,
      candidate.source_url ? `Source URL available` : "No direct source URL",
      candidate.email ? `Email available (${candidate.email_status ?? "status unknown"})` : "No email found",
    ],
    missing_data: [
      ...(!candidate.email ? ["Email not found"] : []),
      ...(!candidate.linkedin_url ? ["LinkedIn URL not found"] : []),
      "Recent news or hiring signals not verified",
      "Funding status not confirmed",
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
      webContext = await searchTavilyForLead(candidate.company, candidate.title);
    } catch {
      // Tavily failure is non-blocking
    }
  }

  const SYSTEM = `You are a B2B commercial intelligence analyst. Enrich this lead with context.
Rules:
- Never invent specific news, funding rounds, or hiring data you cannot confirm.
- If you are inferring from role/industry, say so explicitly in missing_data.
- Only put confirmed signals in timing_signals.
- research_confidence is 0–1.
Return only valid JSON.`;

  const userMsg = `Offer: ${criteria.offer_summary}
Lead: ${candidate.name ?? "Unknown"}, ${candidate.title ?? "Unknown title"} at ${candidate.company}
Industry: ${candidate.industry ?? "unknown"} | Size: ${candidate.company_size ?? "unknown"}
LinkedIn: ${candidate.linkedin_url ?? "N/A"}
Web context: ${webContext || "none available"}

Return JSON:
{
  "company_summary": "2-3 sentences about the company",
  "role_relevance": "Why this role matters for the offer",
  "inferred_pain": "1 sentence on most likely pain point",
  "timing_signals": ["confirmed signals only — empty array if none"],
  "evidence": ["what we actually know"],
  "missing_data": ["what we couldn't confirm"],
  "research_confidence": 0.0
}`;

  const result = await callClaudeJSON<Omit<EnrichedLead, "candidate">>(SYSTEM, userMsg, 1500);
  return { candidate, ...result };
}
