import type { LeadProvider } from "./lead-provider";
import type { LeadCandidate, LeadSearchCriteria, ICP } from "@/types";

/** Coverage context of the most recent discovery run — read by the pipeline to
 *  let the report explain limited coverage honestly. Per-process; the pilot
 *  pipeline runs discovery then reads this synchronously. */
export interface DiscoveryCoverage {
  operating_mode: string; providers_available: string[]; providers_missing: string[];
  coverage_limitation: string | null; companies_investigated: number;
  fresh_search_count: number; fresh_extraction_count: number; reused_evidence_count: number;
  confidence_impact: string | null;
}
export let lastDiscoveryCoverage: DiscoveryCoverage | null = null;
export function getLastDiscoveryCoverage(): DiscoveryCoverage | null { return lastDiscoveryCoverage; }

// ─── Public-signal lead provider (company-first-v1) ──────────────────────────
// Compliant real discovery, now COMPANY-FIRST: build a needs map from the ICP,
// enumerate a universe of plausible real companies from permitted public
// sources, then search dated signals PER COMPANY and apply the fail-closed
// Opportunity Test. This replaces the old news-first path that guessed the
// company from a headline (and produced media/publisher names). No Apollo, no
// person databases, no PII. Fail-closed: emits few, never fills to a target.
// Discovery metrics are logged for observability.

export const publicSignalProvider: LeadProvider = {
  name: "public_signal",

  async searchLeads(criteria: LeadSearchCriteria, limit: number): Promise<LeadCandidate[]> {
    const { runCompanyFirstDiscovery } = await import("@/lib/discovery/company-first-discovery");
    // Synthesize a minimal ICP from the criteria (the pipeline's ICP object is
    // not threaded to the provider; criteria carries the fields discovery needs).
    const icp: ICP = {
      target_industries: criteria.target_industries ?? [],
      target_titles: criteria.target_job_titles ?? [],
      company_size_range: (criteria.target_company_size ?? []).join(", "),
      pain_points: [],
      disqualifiers: criteria.disqualification_criteria ?? [],
      ideal_signals: criteria.buying_signals ?? [],
    };
    // Tier drives the discovery budget (effort ≠ delivered count).
    const tier = (criteria as { discovery_tier?: string }).discovery_tier
      ?? (limit <= 2 ? "preview" : limit <= 6 ? "brief" : limit <= 12 ? "intelligence" : "premium");
    const { candidates, metrics } = await runCompanyFirstDiscovery(icp, criteria, tier, limit);
    console.log(`[analytics] ${JSON.stringify({ event: "discovery_completed", version: "company-first-v1", tier, ...metrics })}`);
    // Stash coverage context so the report can HONESTLY explain limited coverage
    // (which providers were down, how many companies were actually investigated).
    lastDiscoveryCoverage = {
      operating_mode: metrics.operating_mode,
      providers_available: metrics.providers_available,
      providers_missing: metrics.providers_missing,
      coverage_limitation: metrics.coverage_limitation,
      companies_investigated: metrics.companies_verified,
      fresh_search_count: metrics.fresh_search_count,
      fresh_extraction_count: metrics.fresh_extraction_count,
      reused_evidence_count: metrics.reused_evidence_count,
      confidence_impact: metrics.confidence_impact,
    };
    return candidates;
  },
};
