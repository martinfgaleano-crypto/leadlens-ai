// ─── Default discovery runner — adapts the existing engine to the Lead Hunter ──
//
// Reuses runCompanyFirstDiscovery (company-first-v2) rather than inventing a new
// discovery engine (§5/§8). It maps a deterministic DiscoveryPlan into the engine's
// ICP + LeadSearchCriteria, runs bounded discovery, and normalizes the engine's
// universe accounts into RawDiscoveredOrg for the facade to classify.
//
// The engine's real-provider behavior is already covered by the discovery-engine-v2
// live suites; this adapter is intentionally NOT exercised in unit tests (which
// inject mock runners) to avoid provider spend.

import type { ICP, LeadSearchCriteria } from "@/types";
import type { DiscoveryPlan, DiscoveryRunner, DiscoveryRunOutput, RawDiscoveredOrg } from "./candidate-universe";

function criteriaFromPlan(plan: DiscoveryPlan): LeadSearchCriteria {
  return {
    target_industries: plan.industries,
    target_company_size: [],
    target_job_titles: [],
    target_geography: plan.geographies,
    excluded_industries: plan.exclusions,
    buying_signals: plan.watchSignalFamilies.map(String),
    disqualification_criteria: plan.exclusions,
    offer_summary: "",
    value_proposition: "",
    tone: "consultative",
    plan: "standard",
    lead_count: plan.budget.maxCandidatesPerRoute,
    require_real_discovery: true,
  };
}

function icpFromPlan(plan: DiscoveryPlan): ICP {
  return {
    target_industries: plan.industries,
    target_titles: [],
    company_size_range: "",
    pain_points: [],
    disqualifiers: plan.exclusions,
    ideal_signals: plan.watchSignalFamilies.map(String),
    exclusions_explicit: plan.exclusions,
  };
}

/** Real discovery runner backed by the existing engine. Bounded by the plan's
 *  budget (lead_count) and the engine's own cost cap. */
export const defaultDiscoveryRunner: DiscoveryRunner = async (plan): Promise<DiscoveryRunOutput> => {
  const { runCompanyFirstDiscovery } = await import("@/lib/discovery/company-first-discovery");
  const criteria = criteriaFromPlan(plan);
  const icp = icpFromPlan(plan);
  const limit = Math.max(1, plan.budget.maxCandidatesPerRoute);
  // Tier is derived from the technical budget (NOT a commercial plan): a small
  // candidate budget runs the cheaper/faster discovery tier.
  const tier = plan.budget.maxProviderCalls <= 24 ? "preview" : plan.budget.maxProviderCalls <= 48 ? "brief" : "intelligence";
  const { metrics } = await runCompanyFirstDiscovery(icp, criteria, tier, limit, { costCapUsd: 0.5 });

  const orgs: RawDiscoveredOrg[] = (metrics.universe_accounts ?? []).map((a) => ({
    name: a.company,
    domain: a.domain ?? undefined,
    country: a.country ?? undefined,
    organizationType: a.sector ?? undefined,
    origin: a.origin ?? "unknown",
    provider: "engine",
    route: "engine",
    confidence: a.domain ? "verified" : "plausible",
  }));

  return {
    orgs,
    providersAvailable: metrics.providers_available ?? [],
    providersFailed: metrics.providers_missing ?? [],
    operatingMode: metrics.operating_mode ?? "provider_limited",
  };
};
