// ─── Search provider placeholder (NOT functional) ─────────────────────────────
// Skeleton for future automated source discovery. Intentionally throws:
// wiring a real search provider requires (1) the provider env key (e.g.
// TAVILY_API_KEY), (2) a compliance review of its terms for this use, and
// (3) result caps + category classification through the policy engine.
// Never LinkedIn, never paywalled sources, never contact enrichment.

import type {
  LeadHunterBrief,
  LeadHunterDiscoveryProvider,
  LeadHunterFinding,
  LeadHunterSourceEvidence,
  LeadHunterSourceInput,
} from "@/lib/lead-hunter/lead-hunter-types";

export const searchProviderPlaceholder: LeadHunterDiscoveryProvider = {
  provider_id: "search_placeholder",
  mode: "provider_search",

  async searchSources(_brief: LeadHunterBrief, _max: number): Promise<LeadHunterSourceEvidence[]> {
    throw new Error("Automated source discovery is not enabled yet — use manual_sources mode. See LEADLENS_LEAD_HUNTER_ARCHITECTURE.md.");
  },

  async extractCandidatesFromSource(
    _source: LeadHunterSourceInput,
    _brief: LeadHunterBrief | null,
  ): Promise<LeadHunterFinding[]> {
    throw new Error("Automated extraction is not enabled yet — use manual_sources mode.");
  },
};
