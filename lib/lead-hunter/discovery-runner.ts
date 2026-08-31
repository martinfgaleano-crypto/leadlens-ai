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

export function criteriaFromPlan(plan: DiscoveryPlan): LeadSearchCriteria {
  return {
    // Preserve the confirmed target organization family end-to-end. Previously
    // organizationTypes disappeared here, allowing a manufacturer-only request
    // to become a broad industry/event search downstream.
    target_industries: Array.from(new Set([...plan.organizationTypes, ...plan.industries])),
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

export function icpFromPlan(plan: DiscoveryPlan): ICP {
  return {
    target_industries: Array.from(new Set([...plan.organizationTypes, ...plan.industries])),
    target_titles: [],
    company_size_range: "",
    pain_points: [],
    disqualifiers: plan.exclusions,
    ideal_signals: plan.watchSignalFamilies.map(String),
    exclusions_explicit: plan.exclusions,
  };
}

/** Keep bounded discovery lanes ordered when provider capacity is degraded.
 * Event-First is the recall lane for observed changes, so it must not compete
 * with the broader Account-First fan-out for the only healthy search provider. */
export async function runDiscoveryLanes<TEvent, TAccount>(
  eventLane: () => Promise<TEvent>,
  accountLane: () => Promise<TAccount>,
): Promise<{ eventResult: TEvent; accountResult: TAccount }> {
  const eventResult = await eventLane();
  const accountResult = await accountLane();
  return { eventResult, accountResult };
}

/** Real discovery runner backed by the existing engine. Bounded by the plan's
 *  budget (lead_count) and the engine's own cost cap. */
export const defaultDiscoveryRunner: DiscoveryRunner = async (plan): Promise<DiscoveryRunOutput> => {
  const { runCompanyFirstDiscovery } = await import("@/lib/discovery/company-first-discovery");
  const { runEventFirstDiscovery } = await import("./event-first-discovery");
  const { tavilyProvider, braveProvider, serperProvider } = await import("@/lib/sources/access/providers");
  const criteria = criteriaFromPlan(plan);
  const icp = icpFromPlan(plan);
  const limit = Math.max(1, plan.budget.maxCandidatesPerRoute);
  // Tier is derived from the technical budget (NOT a commercial plan): a small
  // candidate budget runs the cheaper/faster discovery tier.
  const tier = plan.budget.maxProviderCalls <= 24 ? "preview" : plan.budget.maxProviderCalls <= 48 ? "brief" : "intelligence";
  // Run Event-First before Account-First. With only one healthy search provider,
  // concurrent lane fan-out caused the productive lane to receive successful but
  // empty responses while the identical controlled Event-First plan converted a
  // canonical company. Sequential bounded lanes avoid provider contention; they
  // do not change eligibility, Evidence, Timing, materiality, or Decision.
  const { eventResult, accountResult } = await runDiscoveryLanes(
    () => runEventFirstDiscovery(plan, [tavilyProvider, braveProvider, serperProvider], {
      maxQueries: tier === "preview" ? 4 : 6,
      maxIdentityQueries: tier === "preview" ? 3 : 5,
    }),
    () => runCompanyFirstDiscovery(icp, criteria, tier, limit, { costCapUsd: 0.5 }),
  );
  const { metrics } = accountResult;

  const accountOrgs: RawDiscoveredOrg[] = (metrics.universe_accounts ?? []).map((a) => ({
    name: a.company,
    domain: a.domain ?? undefined,
    country: a.country ?? undefined,
    organizationType: a.sector ?? undefined,
    origin: a.origin ?? "unknown",
    provider: "engine",
    route: a.route ?? "engine",
    confidence: a.domain ? "verified" : "plausible",
  }));
  const orgs = [...accountOrgs, ...eventResult.orgs];

  return {
    orgs,
    providersAvailable: metrics.providers_available ?? [],
    providersFailed: metrics.providers_missing ?? [],
    operatingMode: metrics.operating_mode ?? "provider_limited",
    routeMetrics: (metrics.universe_route_metrics ?? []).map(x => ({ route: x.route, queries: x.queries, resultPages: x.result_pages, groundedNames: x.grounded_names, acceptedCompanies: x.accepted_companies })),
    eventFirst: eventResult.metrics,
  };
};
