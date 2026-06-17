import type { LeadProvider } from "./lead-provider";
import { mockLeadProvider } from "./mock-lead-provider";

/**
 * Returns the best available lead provider based on environment configuration.
 * Priority order: DEMO_MODE → Apollo → PDL → Tavily → error
 *
 * Note: Apollo and PDL are better for structured B2B contact search.
 * Tavily is useful for web research but not a contact database.
 */
export function getLeadProvider(): LeadProvider {
  const isDemo = process.env.DEMO_MODE === "true";
  // Hybrid test mode: real Claude agents + mock leads (no real lead provider needed)
  const allowMockWithAI = process.env.ALLOW_MOCK_LEADS_WITH_REAL_AI === "true";

  if (isDemo || allowMockWithAI) return mockLeadProvider;

  const hasApollo = !!process.env.APOLLO_API_KEY;
  const hasPDL = !!process.env.PEOPLE_DATA_LABS_API_KEY;
  const hasTavily = !!process.env.TAVILY_API_KEY;

  if (hasApollo) {
    // Lazy import to avoid loading Apollo SDK when key is absent
    const { apolloLeadProvider } = require("./apollo-lead-provider");
    return apolloLeadProvider as LeadProvider;
  }

  if (hasPDL) {
    const { peopleDataLabsProvider } = require("./people-data-labs-provider");
    return peopleDataLabsProvider as LeadProvider;
  }

  if (hasTavily) {
    // Tavily is a fallback — less structured than Apollo/PDL
    const { tavilyLeadProvider } = require("./tavily-lead-provider");
    return tavilyLeadProvider as LeadProvider;
  }

  // No provider configured and not in demo/hybrid mode — throw a clear error
  throw new Error(
    "No lead provider configured. Options:\n" +
      "  • Set DEMO_MODE=true to use mock data with no external APIs\n" +
      "  • Set ALLOW_MOCK_LEADS_WITH_REAL_AI=true to test Claude agents with mock leads\n" +
      "  • Add APOLLO_API_KEY, PEOPLE_DATA_LABS_API_KEY, or TAVILY_API_KEY for real lead search"
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
