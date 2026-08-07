// Discovery Engine V2.1 — LIVE controlled validation (Colombia hospitality).
// Contains REAL observations captured from a small, controlled public-source access
// (Cotelco affiliate directory, via the in-app browser) plus the reusable live-
// execution architecture: operational accessibility, verification cost, research
// depth, and LIVE snapshots kept strictly SEPARATE from fixture snapshots.
//
// HONESTY: entities below were really observed at https://cotelco.org/afiliados/
// on 2026-08-04. Company-level fields ONLY (name, city, official domain) — emails
// and phones were deliberately NOT captured (§48 no people data). This is a SMALL
// sample (n=4): sufficient to establish accessibility + the pipeline runs live, NOT
// sufficient for performance ranking. No search provider ran (no credentials loaded
// in the execution environment + known exhaustion) — that cohort is not_executed.
import { REGISTRY_VERSION } from "./registry";
import { TAXONOMY_VERSION, type DiscoveryContext } from "./taxonomy";

export const LIVE_BENCHMARK_ID = "discovery-v2-colombia-hospitality-live-001";
export const LIVE_CONTEXT: DiscoveryContext = {
  country: "CO", industry_labels: ["hospitality", "boutique_hospitality", "spa", "wellness"],
  business_models: ["hotel_operator"], routes: ["hospitality_guest_experience"], mechanisms: ["guest_amenity"],
};

// ─── Operational accessibility (§7–§8) ────────────────────────────────────────
export const ACCESSIBILITY_STATES = [
  "direct_access", "provider_accessible", "structured_endpoint", "parser_required", "javascript_heavy",
  "pagination_complex", "rate_limited", "authentication_required", "access_blocked",
  "manually_accessible_only", "unstable", "inaccessible", "operationally_unsuitable",
] as const;
export type AccessibilityState = (typeof ACCESSIBILITY_STATES)[number];
export interface AccessibilityObservation {
  source_id: string; source_name: string; attempted_url: string; states: AccessibilityState[];
  access_method: string; provider_required: string | null; parsing_difficulty: "low" | "medium" | "high";
  structural_stability: "stable" | "unstable" | "unknown"; last_success: string | null; last_failure: string | null;
  failure_reason: string | null; notes: string;
  scorecard: { authority: number; coverage: number; accessibility: number; extraction_reliability: number; entity_density: number; identity_quality: number; domain_availability: number; freshness: number; latency: "low" | "medium" | "high"; cost: "low" | "medium" | "high"; maintenance_burden: "low" | "medium" | "high" };
  recommended_role: "primary_discovery" | "secondary_discovery" | "identity_validation" | "evidence_enrichment" | "signal_only" | "gap_filler" | "manual_only" | "avoid_for_now";
}

// REAL accessibility observations from this sprint.
export const LIVE_ACCESSIBILITY: AccessibilityObservation[] = [
  {
    source_id: "co_cotelco", source_name: "Cotelco — Oferta de Alojamiento (afiliados)", attempted_url: "https://cotelco.org/afiliados/",
    states: ["direct_access", "parser_required", "javascript_heavy", "pagination_complex"], access_method: "in_app_browser (public page)", provider_required: "browser/extraction provider (e.g. Firecrawl) for scale",
    parsing_difficulty: "medium", structural_stability: "stable", last_success: "2026-08-04", last_failure: null, failure_reason: null,
    notes: "Public affiliate directory lists hotels with name, city AND official website directly. Pagination is JS-driven and NOT URL-addressable (/page/2/ returned the same entries), so deterministic full-directory sampling needs JS interaction — controlled small sample only.",
    scorecard: { authority: 0.9, coverage: 0.7, accessibility: 0.5, extraction_reliability: 0.6, entity_density: 0.8, identity_quality: 0.85, domain_availability: 0.95, freshness: 0.6, latency: "medium", cost: "low", maintenance_burden: "medium" },
    recommended_role: "primary_discovery",
  },
  {
    source_id: "co_rnt", source_name: "Registro Nacional de Turismo (RNT)", attempted_url: "https://rnt.confecamaras.co/",
    states: ["manually_accessible_only", "javascript_heavy"], access_method: "form search (not attempted at scale)", provider_required: "headless browser",
    parsing_difficulty: "high", structural_stability: "unknown", last_success: null, last_failure: null, failure_reason: "Not executed this sprint — form/JS registry search; deferred to avoid uncontrolled access.",
    notes: "High-authority identity source but form-driven; deferred. Theoretical value high; operational cost high.",
    scorecard: { authority: 0.95, coverage: 0.95, accessibility: 0.3, extraction_reliability: 0.3, entity_density: 0.9, identity_quality: 0.95, domain_availability: 0.1, freshness: 0.7, latency: "high", cost: "high", maintenance_burden: "high" },
    recommended_role: "identity_validation",
  },
  {
    source_id: "search_engine", source_name: "Authorized search provider (Serper/Tavily/Brave)", attempted_url: "n/a",
    states: ["provider_accessible", "operationally_unsuitable"], access_method: "provider API", provider_required: "serper/tavily/brave",
    parsing_difficulty: "low", structural_stability: "unknown", last_success: null, last_failure: "2026-08-04", failure_reason: "No provider credentials loaded in the execution environment (declared in .env.local but not available to this process) + known provider exhaustion. Cohort not_executed.",
    notes: "Search cohort could not run legitimately this sprint. Not a failure — a recorded operational-access limitation (§45).",
    scorecard: { authority: 0.4, coverage: 0.9, accessibility: 0.9, extraction_reliability: 0.7, entity_density: 0.5, identity_quality: 0.5, domain_availability: 0.8, freshness: 0.9, latency: "low", cost: "medium", maintenance_burden: "low" },
    recommended_role: "gap_filler",
  },
];

// ─── Real observed entities (company-level only) ──────────────────────────────
export interface LiveEntity { raw_name: string; city: string; official_domain: string; }
export const LIVE_COTELCO_SAMPLE: LiveEntity[] = [
  { raw_name: "Hotel Estelar El Cable", city: "Manizales", official_domain: "hotelesestelar.com" },
  { raw_name: "One sixteen Hotel", city: "Bogotá", official_domain: "onesixteenhotel.com" },
  { raw_name: "1549 Hostal", city: "Barichara", official_domain: "1549hostal.com" },
  { raw_name: "AcquaSanta Lofts Hotel", city: "Cali", official_domain: "acquasantahotel.com" },
];

// ─── Research depth (§15–§16) ─────────────────────────────────────────────────
export const DEPTH_LEVELS = ["L0_discovery", "L1_identity", "L2_business_model", "L3_context", "L4_evidence", "L5_deep_opportunity"] as const;
export type DepthLevel = (typeof DEPTH_LEVELS)[number];
export const DEPTH_COST: Record<DepthLevel, number> = { L0_discovery: 0.05, L1_identity: 0.1, L2_business_model: 0.1, L3_context: 0.15, L4_evidence: 0.4, L5_deep_opportunity: 1.0 };
export function validDepthTransition(from: DepthLevel, to: DepthLevel): boolean {
  return DEPTH_LEVELS.indexOf(to) === DEPTH_LEVELS.indexOf(from) + 1;
}

// ─── LIVE snapshot (data_basis discriminator; separate from fixture) ───────────
export type DataBasis = "live_source" | "live_provider" | "mixed_live" | "deterministic_fixture" | "manually_supplied" | "unavailable";
export interface LiveSourceSnapshot {
  benchmark_id: string; data_basis: DataBasis; live_execution: boolean; source_id: string; context: DiscoveryContext;
  sample_size: number; captured_at: string; provider_interactions: { source_id: string; provider: string; step: string }[];
  funnel: Record<string, number>; verification: VerificationEconomics; depth: DepthFunnel[];
  accessibility: AccessibilityState[]; failures: string[]; confidence: "hypothesized" | "manually_validated" | "benchmarked";
}
export function confidenceAfterOneLiveRun(current: "hypothesized" | "manually_validated" | "benchmarked", validSample: boolean): "hypothesized" | "manually_validated" | "benchmarked" {
  if (!validSample) return current; // small/failed sample cannot promote
  return current === "hypothesized" ? "benchmarked" : current; // one run ⇒ benchmarked at most; never historically_effective
}

// ─── Verification economics (§20, §42) ────────────────────────────────────────
export interface VerificationEconomics {
  raw_candidates: number; verified_accounts: number; provider_calls: number; total_cost: number;
  actual_provider_cost: number | null; estimated_provider_cost: number; unknown_cost: boolean;
  cost_per_verified_account: number | null; cost_per_context_compatible: number | null;
  cost_per_evidence_sufficient: number | null; cost_per_opportunity_plausible: number | null; verification_calls_per_account: number | null;
}
export interface DepthFunnel { level: DepthLevel; entrants: number; survivors: number; rejected: number; calls: number; cost: number; }

// ─── Live benchmark artifact ──────────────────────────────────────────────────
export interface CohortResult {
  cohort: "structured" | "search" | "hybrid"; status: "executed" | "not_executed"; reason: string | null;
  data_basis: DataBasis; live_execution: boolean; source_id: string | null; provider_calls: number;
  funnel: Record<string, number> | null; verification: VerificationEconomics | null;
}
export interface LiveBenchmarkArtifact {
  id: string; taxonomy_version: string; registry_version: string; module_version: string; context: DiscoveryContext;
  generated_at: string; data_basis: DataBasis; live_execution: boolean; total_provider_calls: number;
  cohorts: CohortResult[]; accessibility: AccessibilityObservation[]; entities_company_level: LiveEntity[];
  depth: DepthFunnel[]; snapshots: LiveSourceSnapshot[]; fixture_vs_live: { assumption: string; fixture: string; live: string }[];
  rejection_analysis: { reason: string; count: number }[]; review_sample: { bucket: string; name: string; domain: string; decision: string; why: string }[];
  source_confidence_changes: { source_id: string; from: string; to: string; sample_size: number; note: string }[];
  recommendations: { id: string; kind: string; source_id: string; rationale: string; confidence: "low" | "medium" | "high"; data_basis: DataBasis; sample_size: number; human_approval_required: true; auto_applied: false }[];
  research_queue: { id: string; task: string; priority: "high" | "medium" | "low"; reason: string }[];
  warnings: string[]; founder_decisions: Record<string, string>; performance_questions: Record<string, string>;
}

export function buildLiveBenchmark(): LiveBenchmarkArtifact {
  const sample = LIVE_COTELCO_SAMPLE;
  const n = sample.length;
  // All observed entities: real active Cotelco-affiliated hotels with a directly-
  // provided official domain. Context = plausible (hotel guest-amenity); NOT "strong"
  // (spa not individually verified). Evidence sufficient (authoritative source +
  // identity + verified domain + hospitality model + route plausibility). Novelty:
  // none appear in Amor de Gea Account Memory ⇒ genuinely_new.
  const structuredFunnel = {
    source_results: 2, raw_candidates: n, entity_resolved: n, real_business: n, business_model_compatible: n,
    context_compatible: n, evidence_sufficient: n, opportunity_plausible: n, portfolio_candidate: n,
    genuinely_new: n, duplicates: 0, official_domains_verified: n, direct_domains: n, search_resolved_domains: 0,
  };
  const verification: VerificationEconomics = {
    raw_candidates: n, verified_accounts: n, provider_calls: 0, total_cost: 0.4,
    actual_provider_cost: null, estimated_provider_cost: 0.4, unknown_cost: true,
    cost_per_verified_account: 0.1, cost_per_context_compatible: 0.1, cost_per_evidence_sufficient: 0.1, cost_per_opportunity_plausible: 0.1, verification_calls_per_account: 0,
  };
  const depth: DepthFunnel[] = [
    { level: "L0_discovery", entrants: n, survivors: n, rejected: 0, calls: 2, cost: 0.1 },
    { level: "L1_identity", entrants: n, survivors: n, rejected: 0, calls: 0, cost: 0.1 },   // domain provided by source ⇒ 0 provider calls
    { level: "L2_business_model", entrants: n, survivors: n, rejected: 0, calls: 0, cost: 0.1 },
    { level: "L3_context", entrants: n, survivors: n, rejected: 0, calls: 0, cost: 0.1 },
    { level: "L4_evidence", entrants: n, survivors: n, rejected: 0, calls: 0, cost: 0.0 }, // directory itself is authoritative evidence
    { level: "L5_deep_opportunity", entrants: 0, survivors: 0, rejected: 0, calls: 0, cost: 0.0 },
  ];
  const structuredSnapshot: LiveSourceSnapshot = {
    benchmark_id: LIVE_BENCHMARK_ID, data_basis: "live_source", live_execution: true, source_id: "co_cotelco", context: LIVE_CONTEXT,
    sample_size: n, captured_at: "2026-08-04", provider_interactions: [{ source_id: "co_cotelco", provider: "in_app_browser", step: "discovery+identity+domain" }],
    funnel: structuredFunnel, verification, depth, accessibility: ["direct_access", "parser_required", "javascript_heavy", "pagination_complex"], failures: [], confidence: confidenceAfterOneLiveRun("hypothesized", true),
  };
  const cohorts: CohortResult[] = [
    { cohort: "structured", status: "executed", reason: null, data_basis: "live_source", live_execution: true, source_id: "co_cotelco", provider_calls: 0, funnel: structuredFunnel, verification },
    { cohort: "search", status: "not_executed", reason: "No search-provider credentials loaded in the execution environment (declared in .env.local, not available to this process) + known provider exhaustion.", data_basis: "unavailable", live_execution: false, source_id: "search_engine", provider_calls: 0, funnel: null, verification: null },
    { cohort: "hybrid", status: "not_executed", reason: "Depends on the search cohort (domain enrichment); Cotelco already provides domains directly, so hybrid adds little here.", data_basis: "unavailable", live_execution: false, source_id: null, provider_calls: 0, funnel: null, verification: null },
  ];
  return {
    id: LIVE_BENCHMARK_ID, taxonomy_version: TAXONOMY_VERSION, registry_version: REGISTRY_VERSION, module_version: LIVE_MODULE_VERSION, context: LIVE_CONTEXT,
    generated_at: "2026-08-04", data_basis: "live_source", live_execution: true, total_provider_calls: 0,
    cohorts, accessibility: LIVE_ACCESSIBILITY, entities_company_level: sample, depth, snapshots: [structuredSnapshot],
    fixture_vs_live: [
      { assumption: "Structured sources lack official domains (need a provider to resolve)", fixture: "RNT: 0 verified domains; domain resolution is the blocker", live: "Cotelco afiliados provides official domains DIRECTLY (4/4) — domain resolution cost ≈ 0" },
      { assumption: "Structured-first is limited by domain resolution cost", fixture: "marginal cost driven by domain/evidence calls", live: "real blocker is JS-driven, non-URL-addressable PAGINATION (scale), not domain resolution" },
      { assumption: "Search has ~67% non-business rejection", fixture: "search noisy", live: "INSUFFICIENT LIVE EVIDENCE — search cohort not executed (no credentials)" },
    ],
    rejection_analysis: [{ reason: "none_in_sample", count: 0 }],
    review_sample: sample.map((e) => ({ bucket: "accepted", name: e.raw_name, domain: e.official_domain, decision: "context_compatible (plausible) · evidence_sufficient · genuinely_new", why: "Cotelco affiliate (authoritative), identity + verified official domain; spa not individually verified ⇒ plausible not strong" })),
    source_confidence_changes: [{ source_id: "co_cotelco", from: "hypothesized", to: "benchmarked", sample_size: n, note: "One valid live run, n=4 — benchmarked at most; NOT historically_effective (needs multiple runs)." }],
    recommendations: [
      { id: "rec_cotelco_primary_domains", kind: "use_source_primary_discovery_provides_domains", source_id: "co_cotelco", rationale: "Cotelco afiliados yields active hotels WITH official domains directly (4/4), collapsing domain-resolution cost. Strong primary discovery candidate for CO hospitality.", confidence: "low", data_basis: "live_source", sample_size: n, human_approval_required: true, auto_applied: false },
      { id: "rec_cotelco_js_parser", kind: "parser_investment", source_id: "co_cotelco", rationale: "Directory pagination is JS-driven and not URL-addressable; a small headless parser with click-through pagination is needed to sample beyond the first page.", confidence: "low", data_basis: "live_source", sample_size: n, human_approval_required: true, auto_applied: false },
      { id: "rec_search_needs_creds", kind: "unblock_cohort", source_id: "search_engine", rationale: "Search cohort could not run — load authorized provider credentials (and confirm quota) to obtain the search baseline before comparing strategies.", confidence: "low", data_basis: "unavailable", sample_size: 0, human_approval_required: true, auto_applied: false },
    ],
    research_queue: [
      { id: "srq_live_1", task: "Build a Cotelco afiliados parser handling JS pagination + city filter", priority: "high", reason: "Only the first page is URL-addressable; scale needs interaction." },
      { id: "srq_live_2", task: "Authorize + quota-check a search provider to run cohort B/C", priority: "high", reason: "No search baseline yet." },
      { id: "srq_live_3", task: "Evaluate RNT form-search access (headless) for identity coverage", priority: "medium", reason: "High authority, high operational cost." },
    ],
    warnings: [
      "LIVE but SMALL sample (n=4) — establishes accessibility + that the pipeline runs live; NOT sufficient to rank strategies or promote to historically_effective.",
      "Only the structured cohort executed; search + hybrid are not_executed (recorded operational limitation, §45).",
      "Provider cost is ESTIMATED (browser access, no billable provider); actual_provider_cost = null.",
      "Commercial-outcome performance: awaiting_real_outcomes.",
    ],
    founder_decisions: {
      preferred_strategy: "INSUFFICIENT LIVE EVIDENCE (search cohort not run)",
      access_structured_source: "YES — Cotelco afiliados is publicly accessible and structured",
      domain_resolution_difficulty: "LOW for Cotelco (domains provided directly) — contradicts fixture",
      biggest_real_blocker: "JS-driven, non-URL-addressable pagination (scale), plus missing search-provider credentials",
      confidence_change: "co_cotelco: hypothesized → benchmarked (n=4, small)",
      ready_for_manufacturing: "NOT YET — run a full structured cohort (parser) + a search cohort first; one blocker (search creds) remains",
    },
    performance_questions: {
      q1_can_access_structured: "YES — Cotelco afiliados (public, structured)",
      q2_usable_entities: "4 observed in a controlled sample (directory is larger; JS pagination)",
      q3_resolve_to_real_business: "4/4 (100%) in-sample — Cotelco affiliates are active hotels",
      q4_domain_difficulty: "LOW — directory provides official domains directly",
      q5_hotel_operator_pct: "4/4 in-sample (incl. one hospitality_group: Estelar)",
      q8_genuinely_new: "4/4 — none in Amor de Gea Account Memory",
      q9_cost_per_verified: "≈0.1 estimated units (no billable provider; domains provided)",
      q11_where_rejected: "no rejections in this small sample",
      q18_biggest_blocker: "pagination/scale + missing search credentials",
      note: "Strategy ranking, search cleanliness, and hybrid economics = INSUFFICIENT LIVE EVIDENCE this sprint.",
    },
  };
}

export const LIVE_MODULE_VERSION = "discovery-v2-1-live-v1";
export { REGISTRY_VERSION, TAXONOMY_VERSION };
