import type { VaultCandidate } from "./search-vault";

export interface ReuseResult {
  vaultResultsToUse: VaultCandidate[];
  remainingCount:    number;
}

/**
 * Decides how many vault leads to reuse and how many to request from Apollo.
 * Takes as many vault leads as available up to requestedCount; the rest come from Apollo.
 */
export function allocateLeads(
  vaultCandidates: VaultCandidate[],
  requestedCount:  number,
): ReuseResult {
  const take = Math.min(vaultCandidates.length, requestedCount);
  return {
    vaultResultsToUse: vaultCandidates.slice(0, take),
    remainingCount:    requestedCount - take,
  };
}
