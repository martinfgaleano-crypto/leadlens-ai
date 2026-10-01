export const MARKET_RESEARCH_UNIVERSE_VERSION = "market-research-universe-v1" as const;

export type PopulationType = "market_research_universe" | "account_research_universe" | "selected_portfolio";
export type ResearchCoverageState = "NOT_RESEARCHED" | "RESEARCHED_NOT_FOUND" | "FOUND_UNVERIFIED" | "VERIFIED" | "CONTRADICTED" | "STALE";
export type RouteLifecycle = "HYPOTHESIS" | "DISCOVERED" | "EVIDENCE_SUPPORTED" | "LIMITED" | "REJECTED" | "INSUFFICIENT_DATA";
export type MechanismLifecycle = "UNKNOWN" | "HYPOTHESIZED" | "IDENTIFIED" | "VERIFIED" | "STALE" | "INVALID";
export type SourceRelationship = "PRIMARY_OFFICIAL" | "SAME_DOMAIN_SUPPORT" | "INDEPENDENT_CORROBORATION" | "SYNDICATED_DERIVATIVE" | "CONFLICTING_SOURCE";
export type CustomerDependencyStatus = "UNKNOWN" | "CUSTOMER_INPUT_REQUIRED" | "SATISFIED" | "BLOCKING" | "NOT_APPLICABLE";

export interface PopulationMetadata {
  population_type: PopulationType;
  population_size: number;
  selection_scope: string;
  coverage_scope: string;
  limitations: string[];
}

export interface RouteDefinition {
  canonical_route_family_id: string;
  canonical_route_id: string;
  display_label: string;
  aliases: string[];
  parent_route_id: string | null;
  buyer_types: string[];
  commercial_role: string;
  scope: string;
}

export interface MarketSource {
  source_id: string;
  url: string;
  domain: string;
  title: string;
  source_type: "official" | "institutional" | "industry" | "directory" | "independent_media" | "other";
  relationship: SourceRelationship;
  published_at: string | null;
  retrieved_at: string;
  freshness: "structural" | "current" | "event" | "stale" | "unknown";
  route_ids: string[];
  account_refs: string[];
}

export interface CommercialMechanismResearch {
  mechanism_id: string;
  mechanism_type: string;
  lifecycle: MechanismLifecycle;
  description: string;
  official_url: string | null;
  source_ids: string[];
  verified_at: string | null;
  relevance: string;
  account_ref: string | null;
  route_id: string;
  limitations: string[];
  required_customer_inputs: string[];
  coverage_state: ResearchCoverageState;
}

export interface AccessPathResearch {
  access_id: string;
  mechanism_id: string;
  path_type: string;
  url: string | null;
  coverage_state: ResearchCoverageState;
  source_ids: string[];
  limitations: string[];
}

export interface CustomerDependency {
  dependency_id: string;
  label: string;
  status: CustomerDependencyStatus;
  blocking_level: "none" | "route" | "account" | "decision";
  source: "customer_context" | "market_evidence" | "account_evidence" | "inference";
  route_ids: string[];
  account_refs: string[];
  validation_question: string;
}

export interface RouteResearchRecord {
  route_id: string;
  lifecycle: RouteLifecycle;
  query_count: number;
  source_ids: string[];
  candidate_account_refs: string[];
  eligible_account_refs: string[];
  excluded_account_refs: string[];
  exclusion_reasons: string[];
  mechanism_research: ResearchCoverageState;
  corroboration_attempted: boolean;
  independent_support_count: number;
  counterevidence: string[];
  customer_dependency_ids: string[];
  observations: string[];
  limitations: string[];
  stop_reason: "evidence_obtained" | "route_exhausted" | "provider_exhausted" | "budget_exhausted" | "query_families_exhausted" | "diminishing_novelty" | "customer_dependency" | null;
}

export interface ResearchQuestion {
  question_id: string;
  question: string;
  decision_supported: string;
  route_ids: string[];
  status: ResearchCoverageState;
}

export interface MarketClaimSupport {
  claim_id: string;
  claim: string;
  scope: "single_observation" | "multiple_observations" | "cross_route_observation" | "market_supported_observation";
  support_type: "fact" | "inference" | "hypothesis" | "unknown";
  support_count: number;
  source_ids: string[];
  route_ids: string[];
  account_refs: string[];
  independent_support: boolean;
  counterexamples: string[];
  confidence: "high" | "medium" | "low" | "insufficient";
  limitations: string[];
}

export interface MarketResearchChart {
  chart_id: "route_research_coverage" | "commercial_access_depth" | "freshness_coverage" | "customer_dependency_impact";
  title: string;
  question_answered: string;
  population: PopulationMetadata;
  denominator: number;
  unknown_count: number;
  not_researched_count: number;
  data: Array<Record<string, string | number | boolean | null>>;
  eligible: boolean;
  selected: boolean;
  omission_reason: string | null;
}

export interface MarketResearchUniverseV1 {
  version: typeof MARKET_RESEARCH_UNIVERSE_VERSION;
  universe_id: string;
  generated_at: string;
  objective: string;
  geography: string[];
  population: PopulationMetadata;
  account_population: PopulationMetadata;
  selected_population: PopulationMetadata;
  research_questions: ResearchQuestion[];
  route_definitions: RouteDefinition[];
  route_research: RouteResearchRecord[];
  buyer_types: Array<{ buyer_type: string; route_ids: string[]; evidence_source_ids: string[]; coverage_state: ResearchCoverageState }>;
  commercial_mechanisms: CommercialMechanismResearch[];
  access_paths: AccessPathResearch[];
  customer_dependencies: CustomerDependency[];
  ecosystem_entities: Array<{ entity_id: string; name: string; role: string; route_ids: string[]; account_eligible: boolean; source_ids: string[] }>;
  market_sources: MarketSource[];
  claims: MarketClaimSupport[];
  charts?: MarketResearchChart[];
  research_passes: Array<{ pass_id: string; purpose: string; started_at: string; completed_at: string | null; queries: number; new_sources: number; new_entities: number; novelty_rate: number | null; stop_reason: RouteResearchRecord["stop_reason"] }>;
  coverage: { routes_researched: number; routes_supported: number; sources: number; independent_sources: number; mechanisms_researched: number; mechanisms_found: number; mechanisms_verified: number; access_identified: number; access_verified: number; buyer_functions_identified: number; corroboration_attempted: number; corroboration_achieved: number };
  gaps: string[];
  provenance: { generated_by: string; source_data_refs: string[]; fresh_search_count: number; fresh_extraction_count: number; reused_evidence_count: number };
  limitations: string[];
}

export function canonicalizeRoute(label: string, definitions: RouteDefinition[]): RouteDefinition | null {
  const normalized = label.trim().toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
  return definitions.find((route) => [route.display_label, route.canonical_route_id, ...route.aliases]
    .some((candidate) => candidate.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim() === normalized)) ?? null;
}

export function classifySourceRelationship(primary: MarketSource, candidate: MarketSource): SourceRelationship {
  if (candidate.relationship === "CONFLICTING_SOURCE") return "CONFLICTING_SOURCE";
  if (candidate.domain === primary.domain) return "SAME_DOMAIN_SUPPORT";
  if (candidate.relationship === "SYNDICATED_DERIVATIVE") return "SYNDICATED_DERIVATIVE";
  return "INDEPENDENT_CORROBORATION";
}

export function summarizeCoverage(input: Pick<MarketResearchUniverseV1, "route_research" | "commercial_mechanisms" | "access_paths" | "buyer_types">): MarketResearchUniverseV1["coverage"] {
  const routes = input.route_research;
  const mechanisms = input.commercial_mechanisms;
  return {
    routes_researched: routes.filter((r) => r.query_count > 0).length,
    routes_supported: routes.filter((r) => r.lifecycle === "EVIDENCE_SUPPORTED").length,
    sources: new Set(routes.flatMap((r) => r.source_ids)).size,
    independent_sources: routes.reduce((sum, r) => sum + r.independent_support_count, 0),
    mechanisms_researched: routes.filter((r) => r.mechanism_research !== "NOT_RESEARCHED").length,
    mechanisms_found: mechanisms.filter((m) => ["IDENTIFIED", "VERIFIED"].includes(m.lifecycle)).length,
    mechanisms_verified: mechanisms.filter((m) => m.lifecycle === "VERIFIED").length,
    access_identified: input.access_paths.filter((p) => ["FOUND_UNVERIFIED", "VERIFIED"].includes(p.coverage_state)).length,
    access_verified: input.access_paths.filter((p) => p.coverage_state === "VERIFIED").length,
    buyer_functions_identified: input.buyer_types.filter((b) => ["FOUND_UNVERIFIED", "VERIFIED"].includes(b.coverage_state)).length,
    corroboration_attempted: routes.filter((r) => r.corroboration_attempted).length,
    corroboration_achieved: routes.filter((r) => r.independent_support_count > 0).length,
  };
}

export function validateMarketResearchUniverse(universe: MarketResearchUniverseV1): string[] {
  const errors: string[] = [];
  if (universe.population.population_type !== "market_research_universe") errors.push("INVALID_MARKET_POPULATION");
  if (universe.account_population.population_type !== "account_research_universe") errors.push("INVALID_ACCOUNT_POPULATION");
  if (universe.selected_population.population_type !== "selected_portfolio") errors.push("INVALID_SELECTED_POPULATION");
  if (!universe.research_questions.length) errors.push("RESEARCH_QUESTIONS_REQUIRED");
  if (!universe.route_definitions.length || !universe.route_research.length) errors.push("ROUTE_RESEARCH_REQUIRED");
  if (!universe.market_sources.length) errors.push("MARKET_SOURCES_REQUIRED");
  if (universe.claims.some((claim) => claim.support_count !== claim.source_ids.length)) errors.push("CLAIM_SUPPORT_COUNT_MISMATCH");
  if (universe.claims.some((claim) => claim.scope !== "single_observation" && claim.support_count < 2)) errors.push("MARKET_PATTERN_UNDERSUPPORTED");
  const routeIds = new Set(universe.route_definitions.map((r) => r.canonical_route_id));
  if (universe.route_research.some((r) => !routeIds.has(r.route_id))) errors.push("UNKNOWN_CANONICAL_ROUTE");
  if (universe.commercial_mechanisms.some((m) => m.lifecycle === "VERIFIED" && (!m.official_url || !m.verified_at || m.coverage_state !== "VERIFIED"))) errors.push("INVALID_VERIFIED_MECHANISM");
  return Array.from(new Set(errors));
}

export function buildMarketResearchCharts(universe: MarketResearchUniverseV1): MarketResearchChart[] {
  const routes = universe.route_research;
  const dependencies = universe.customer_dependencies;
  const routePopulation: PopulationMetadata = { ...universe.population, population_size: routes.length, coverage_scope: "Canonical route hypotheses researched" };
  const evidenceDates = universe.market_sources.map((s) => s.freshness);
  const charts: MarketResearchChart[] = [
    {
      chart_id: "route_research_coverage", title: "Route research coverage", question_answered: "Which route hypotheses were researched and what did the evidence support?", population: routePopulation, denominator: routes.length,
      unknown_count: routes.filter((r) => r.lifecycle === "INSUFFICIENT_DATA" || r.lifecycle === "HYPOTHESIS").length, not_researched_count: routes.filter((r) => r.query_count === 0).length,
      data: routes.map((r) => ({ route_id: r.route_id, lifecycle: r.lifecycle, queries: r.query_count, sources: r.source_ids.length, candidates: r.candidate_account_refs.length, eligible_accounts: r.eligible_account_refs.length, independent_support: r.independent_support_count })), eligible: routes.length > 0, selected: routes.length > 0, omission_reason: routes.length ? null : "No route research records.",
    },
    {
      chart_id: "commercial_access_depth", title: "Commercial access depth", question_answered: "Where does an observable commercial path exist?", population: routePopulation, denominator: routes.length,
      unknown_count: routes.filter((r) => r.mechanism_research === "FOUND_UNVERIFIED" || r.mechanism_research === "RESEARCHED_NOT_FOUND").length, not_researched_count: routes.filter((r) => r.mechanism_research === "NOT_RESEARCHED").length,
      data: routes.map((r) => ({ route_id: r.route_id, mechanism_research: r.mechanism_research, mechanisms_identified: universe.commercial_mechanisms.filter((m) => m.route_id === r.route_id && ["IDENTIFIED", "VERIFIED"].includes(m.lifecycle)).length, mechanisms_verified: universe.commercial_mechanisms.filter((m) => m.route_id === r.route_id && m.lifecycle === "VERIFIED").length, access_verified: universe.access_paths.filter((p) => p.coverage_state === "VERIFIED" && universe.commercial_mechanisms.some((m) => m.mechanism_id === p.mechanism_id && m.route_id === r.route_id)).length })), eligible: routes.some((r) => r.mechanism_research !== "NOT_RESEARCHED"), selected: routes.some((r) => r.mechanism_research !== "NOT_RESEARCHED"), omission_reason: routes.some((r) => r.mechanism_research !== "NOT_RESEARCHED") ? null : "Commercial mechanisms were not researched.",
    },
    {
      chart_id: "freshness_coverage", title: "Evidence freshness", question_answered: "How much market evidence is current, structural, stale or undated?", population: universe.population, denominator: universe.market_sources.length,
      unknown_count: evidenceDates.filter((x) => x === "unknown").length, not_researched_count: 0,
      data: (["current", "event", "structural", "stale", "unknown"] as const).map((freshness) => ({ freshness, sources: evidenceDates.filter((x) => x === freshness).length })), eligible: universe.market_sources.length > 0, selected: universe.market_sources.length > 0, omission_reason: universe.market_sources.length ? null : "No market sources.",
    },
    {
      chart_id: "customer_dependency_impact", title: "Customer dependency impact", question_answered: "Which customer facts block the most routes or decisions?", population: routePopulation, denominator: routes.length,
      unknown_count: dependencies.filter((d) => d.status === "UNKNOWN").length, not_researched_count: 0,
      data: dependencies.map((d) => ({ dependency_id: d.dependency_id, label: d.label, status: d.status, blocking_level: d.blocking_level, affected_routes: d.route_ids.length, affected_accounts: d.account_refs.length })), eligible: dependencies.length > 0, selected: dependencies.length > 0, omission_reason: dependencies.length ? null : "No customer dependencies identified.",
    },
  ];
  return charts;
}
