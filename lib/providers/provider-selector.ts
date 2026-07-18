import type { LeadProvider } from "./lead-provider";
import { mockLeadProvider } from "./mock-lead-provider";

/**
 * Returns the best available lead provider based on environment configuration.
 * Priority order: DEMO_MODE → Apollo → PDL → Tavily → error
 *
 * Note: Apollo and PDL are better for structured B2B contact search.
 * Tavily is useful for web research but not a contact database.
 */
export function getLeadProvider(opts: { forceReal?: boolean } = {}): LeadProvider {
  const isDemo = process.env.DEMO_MODE === "true";
  // Hybrid test mode: real Claude agents + mock leads (no real lead provider needed)
  const allowMockWithAI = process.env.ALLOW_MOCK_LEADS_WITH_REAL_AI === "true";

  // Customer-facing runs (pilots) force real discovery — mock env flags are
  // for demos and internal QA only and must never reach a real client.
  if (!opts.forceReal && (isDemo || allowMockWithAI)) return mockLeadProvider;

  // Preferred compliant discovery: the existing multi-provider sources engine
  // (Brave + Serper search → Tavily/Firecrawl extraction → promotion gates v3).
  if (process.env.BRAVE_SEARCH_API_KEY && process.env.SERPER_API_KEY) {
    const { publicSignalProvider } = require("./public-signal-provider");
    return publicSignalProvider as LeadProvider;
  }

  // COMPLIANCE (permanent project rules): Apollo is banned outright, and
  // person-data providers (PDL contact/profile data) violate the no-personal-
  // data rule — neither is EVER auto-selected, even when their legacy API keys
  // exist in the environment. Public-web search (Tavily) is the compliant
  // real-discovery provider.
  const hasTavily = !!process.env.TAVILY_API_KEY;

  if (hasTavily) {
    const { tavilyLeadProvider } = require("./tavily-lead-provider");
    return tavilyLeadProvider as LeadProvider;
  }

  // No compliant provider configured and not in demo/hybrid mode.
  throw new Error(
    "No compliant lead provider configured. Options:\n" +
      "  • Set TAVILY_API_KEY for real public-web lead discovery\n" +
      "  • Set DEMO_MODE=true to use mock data with no external APIs\n" +
      "  • Set ALLOW_MOCK_LEADS_WITH_REAL_AI=true to test Claude agents with mock leads\n" +
      "  (Apollo and person-data providers are excluded by project policy.)"
  );
}

/**
 * Returns the best email-finding provider if one is configured.
 * Falls back to null if no email provider is available.
 */
export async function getEmailProvider(): Promise<{
  findEmail: (candidate: import("@/types").LeadCandidate) => Promise<import("@/types").EmailFindResult>;
} | null> {
  if (process.env.DEMO_MODE === "true") return null;

  if (process.env.HUNTER_API_KEY) {
    const { hunterFindEmail } = await import("./hunter-provider");
    return { findEmail: hunterFindEmail };
  }

  // Apollo and PDL have their own findEmail methods
  const provider = getLeadProvider();
  if (provider.findEmail) return { findEmail: (c) => provider.findEmail!(c) };

  return null;
}
