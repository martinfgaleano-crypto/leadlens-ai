// Provider adapter contract re-export + shared caps for Lead Hunter discovery.
// v0 ships manual-sources only. Future automated providers (e.g. a Tavily
// search adapter — env: TAVILY_API_KEY) implement LeadHunterDiscoveryProvider
// and MUST respect these caps and the sourcing policy.

export type { LeadHunterDiscoveryProvider } from "@/lib/lead-hunter/lead-hunter-types";

export const MAX_CANDIDATES_HARD_CAP = 50;
export const MAX_SOURCES_HARD_CAP = 25;
