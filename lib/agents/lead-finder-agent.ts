import type { LeadSearchCriteria, LeadCandidate, PlanType } from "@/types";
import { PLAN_SEARCH_POOL, PLAN_LEAD_COUNT } from "@/types";
import { getLeadProvider } from "@/lib/providers/provider-selector";

/**
 * Finds and returns the best LeadCandidate[] for the given plan.
 * Searches a larger pool (PLAN_SEARCH_POOL) then returns the top N (PLAN_LEAD_COUNT).
 */
export async function runLeadFinderAgent(
  criteria: LeadSearchCriteria
): Promise<LeadCandidate[]> {
  const pool = PLAN_SEARCH_POOL[criteria.plan];
  const target = PLAN_LEAD_COUNT[criteria.plan];

  const provider = getLeadProvider();
  const candidates = await provider.searchLeads(criteria, pool);

  const usingMockProvider =
    process.env.DEMO_MODE === "true" ||
    process.env.ALLOW_MOCK_LEADS_WITH_REAL_AI === "true";

  if (usingMockProvider) {
    // Preserve the seeded-shuffle order from the mock provider.
    // Re-sorting purely by confidence concentrates all top-confidence leads
    // into the batch, producing an unrealistic all-HOT result.
    return candidates.slice(0, target);
  }

  // Production: sort by confidence, take best N
  return candidates
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, target);
}
