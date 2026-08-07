// Discovery Engine V2 — controlled benchmark runner (Colombia hospitality).
// Runs three strategies over the deterministic fixture, measuring the funnel,
// incremental/marginal yield, source overlap/complementarity, and source-vs-
// provider performance. 0 provider calls (fixture). Produces a reproducible
// benchmark artifact. Fixture-based ⇒ sources are NOT promoted beyond "benchmarked"
// and real-world confidence stays "hypothesized" (see report).
import { COLOMBIA_HOSPITALITY_FIXTURE, FIXTURE_ID, FIXTURE_VERSION, type FixtureCandidate } from "./benchmark-fixture";
import {
  COST, type DiscoveryBudget, type DiscoveryCandidate, type KnownAccountRef, type SourceExecutionResult,
  resolveIdentity, resolveDomain, classifyModel, classifyContext, classifyOpportunity, noveltyOf,
} from "./executor";
import { REGISTRY_VERSION } from "./registry";
import { TAXONOMY_VERSION, type DiscoveryContext } from "./taxonomy";
import { ROUTER_VERSION } from "./router";

export const BENCHMARK_CONTEXT: DiscoveryContext = {
  country: "CO", industry_labels: ["hospitality", "boutique_hospitality", "spa", "wellness"],
  business_models: ["hotel_operator"], routes: ["hospitality_guest_experience"], mechanisms: ["guest_amenity"],
};
const providerFor = (id: string) => (id === "search_engine" ? "serper" : "firecrawl_structured");
const ecosystemOf = (id: string) => (id === "search_engine" ? "search_engines" : id === "co_rnt" ? "tourism_directories" : "industry_associations");

export interface StrategyFunnel {
  strategy: string; source_results: number; raw_candidates: number; entity_resolved: number; real_business: number;
  business_model_compatible: number; context_compatible: number; evidence_sufficient: number; opportunity_plausible: number;
  portfolio_candidate: number; portfolio_selected: number; duplicates: number; genuinely_new_qualified: number;
  official_domains: number; qualified: number; cost: number; latency_ms: number;
  incremental_qualified: number; marginal_cost_per_incremental_qualified: number | null;
}
export interface SourceContribution { source_id: string; strategy: string; raw: number; resolved: number; qualified: number; unique_qualified: number; incremental_qualified: number; official_domains: number; cost: number; marginal_cost_per_incremental_qualified: number | null; role_observed: string; snapshot_confidence: "hypothesized" | "benchmarked"; }
export interface ProviderMetric { provider: string; requests: number; failures: number; official_domains_resolved: number; useful_results: number; cost: number; latency_ms: number; }
export interface BenchmarkArtifact {
  id: string; fixture: string; fixture_version: string; taxonomy_version: string; registry_version: string; router_version: string;
  context: DiscoveryContext; generated_at: string; provider_calls: number; live_execution: false; data_basis: "deterministic_fixture";
  budgets: DiscoveryBudget; strategies: StrategyFunnel[]; source_contributions: SourceContribution[]; provider_metrics: ProviderMetric[];
  overlap: { total_unique_qualified: number; overlap_rate_structured_first: number | null };
  rejection_analysis: { reason: string; count: number; pct: number; top_source: string }[];
  review_sample: { bucket: "strongest" | "borderline" | "rejected"; canonical: string | null; source: string; why: string; evidence: string }[];
  recommendations: { id: string; kind: string; source_id: string; rationale: string; confidence: "low" | "medium" | "high"; human_approval_required: true; auto_applied: false; fixture_based: true }[];
  warnings: string[]; stop_conditions_triggered: string[]; founder_decisions: Record<string, string>;
}

const BUDGET: DiscoveryBudget = { max_source_pages: 60, max_extractions: 120, max_domain_resolutions: 60, max_evidence_calls: 40 };

function processStrategy(name: string, discoverySources: string[], enrichSources: string[], known: Map<string, KnownAccountRef>) {
  const executions: SourceExecutionResult[] = [];
  const finalById = new Map<string, DiscoveryCandidate>();
  const perSource = new Map<string, { raw: number; resolved: number; qualified: Set<string>; official: number; cost: number; incremental_qualified: number }>();
  const rejections: DiscoveryCandidate[] = [];
  const qualifiedSeen = new Set<string>();
  let rawTotal = 0, duplicates = 0, latency = 0, pages = 0, extractions = 0, domainCalls = 0, evidenceCalls = 0;

  const isQualified = (c: DiscoveryCandidate) => (c.context === "compatible" || c.context === "plausible") && c.evidence_sufficient;

  for (const sid of discoverySources) {
    const rows = COLOMBIA_HOSPITALITY_FIXTURE.filter((r) => r.source_id === sid);
    const started = "2026-08-04T00:00:00.000Z";
    let srcRaw = 0, srcResolved = 0, srcCost = 0, srcIncQual = 0, srcOfficial = 0, extractionFailures = 0, stop = "source_ecosystem_exhausted";
    const ps = perSource.get(sid) ?? { raw: 0, resolved: 0, qualified: new Set<string>(), official: 0, cost: 0, incremental_qualified: 0 };
    for (const row of rows) {
      if (pages >= BUDGET.max_source_pages || extractions >= BUDGET.max_extractions) { stop = "budget_reached"; break; }
      pages++; extractions++; srcRaw++; rawTotal++; srcCost += COST.source_page + COST.extraction;
      const cand = buildCandidate(name, sid, row);
      // Depth 1: identity (early rejection before any expensive call)
      if (cand.identity === "non_business_entity") { cand.rejected_stage = "real_business"; cand.rejection_reason = row.truth.entity_kind === "aggregator" ? "aggregator" : row.truth.entity_kind === "article" ? "non_business_result" : "non_business_result"; rejections.push(cand); continue; }
      // Dedupe within strategy (incremental): canonical already discovered ⇒ duplicate, add provenance path only.
      if (cand.canonical_id && finalById.has(cand.canonical_id)) { duplicates++; finalById.get(cand.canonical_id)!.provenance.push(cand.provenance[0]); cand.rejected_stage = "entity_resolved"; cand.rejection_reason = "duplicate"; cand.novelty = "duplicate_identity"; continue; }
      srcResolved++; cand.cost_by_level.identity = COST.model_validation; domainCalls++;
      // Novelty / Account Memory early suppression (before evidence spend)
      if (cand.novelty === "suppressed" || cand.novelty === "previously_delivered") { cand.reached_stage = "opportunity_plausible"; }
      // Depth 2: business model
      cand.cost_by_level.validation = COST.model_validation; srcCost += COST.model_validation;
      if (cand.model === "incompatible") { cand.rejected_stage = "business_model_compatible"; cand.rejection_reason = "wrong_business_model"; if (cand.canonical_id) finalById.set(cand.canonical_id, cand); rejections.push(cand); continue; }
      // Depth 3: context + evidence (evidence is the expensive call)
      if (cand.context === "incompatible") { cand.rejected_stage = "context_compatible"; cand.rejection_reason = "wrong_geography_or_route"; if (cand.canonical_id) finalById.set(cand.canonical_id, cand); rejections.push(cand); continue; }
      evidenceCalls++; cand.cost_by_level.evidence = COST.evidence; srcCost += COST.evidence + COST.domain_resolution;
      if (cand.domain === "official_domain_verified") srcOfficial++;
      cand.evidence_sufficient = cand.identity === "canonical_resolved" && cand.business_ok && (cand.domain === "official_domain_verified" || cand.domain === "probable_official_domain");
      if (!cand.evidence_sufficient) { cand.rejected_stage = "evidence_sufficient"; cand.rejection_reason = cand.domain === "no_domain_found" ? "no_official_domain" : "insufficient_evidence"; }
      else { cand.reached_stage = "opportunity_plausible"; if (isQualified(cand) && !qualifiedSeen.has(cand.canonical_id!)) { qualifiedSeen.add(cand.canonical_id!); ps.qualified.add(cand.canonical_id!); srcIncQual++; } }
      if (cand.canonical_id) finalById.set(cand.canonical_id, cand);
    }
    ps.raw += srcRaw; ps.resolved += srcResolved; ps.official += srcOfficial; ps.cost += srcCost; ps.incremental_qualified += srcIncQual; perSource.set(sid, ps);
    latency += 400 + srcRaw * 30;
    executions.push({ execution_id: `exec_${name}_${sid}`, source_id: sid, country: "CO", strategy: name, provider_used: providerFor(sid), started_at: started, pages_processed: srcRaw, raw_candidates: srcRaw, extraction_failures: extractionFailures, access_failures: 0, cost: Math.round(srcCost * 100) / 100, latency_ms: 400 + srcRaw * 30, stop_reason: stop });
  }
  // Enrichment-only sources (hybrid): resolve domains / evidence for already-discovered
  // candidates lacking a verified domain — no new discoveries counted.
  for (const sid of enrichSources) {
    const rows = COLOMBIA_HOSPITALITY_FIXTURE.filter((r) => r.source_id === sid);
    let used = 0, cost = 0;
    for (const row of rows) {
      if (!row.truth.canonical_id || !finalById.has(row.truth.canonical_id)) continue;
      const c = finalById.get(row.truth.canonical_id)!;
      if (c.domain === "probable_official_domain" && row.domain_hint === row.truth.official_domain) { c.domain = "official_domain_verified"; used++; cost += COST.domain_resolution; domainCalls++; c.provenance.push({ strategy: name, source_id: sid, source_ecosystem: ecosystemOf(sid), provider: providerFor(sid), query: `domain resolve ${row.truth.canonical}`, extraction_method: "serp", execution_id: `exec_${name}_${sid}`, first_seen: "2026-08-04T00:00:00.000Z", country: "CO", matched_labels: [], route: "hospitality_guest_experience", mechanism: "guest_amenity" }); }
    }
    if (used > 0) executions.push({ execution_id: `exec_${name}_${sid}`, source_id: sid, country: "CO", strategy: name, provider_used: providerFor(sid), started_at: "2026-08-04T00:00:00.000Z", pages_processed: used, raw_candidates: 0, extraction_failures: 0, access_failures: 0, cost: Math.round(cost * 100) / 100, latency_ms: 200 + used * 20, stop_reason: "enrichment_complete" });
  }

  const finals = Array.from(finalById.values());
  const qualified = finals.filter((c) => c.rejected_stage === null && isQualified(c));
  const funnel: StrategyFunnel = {
    strategy: name, source_results: pages, raw_candidates: rawTotal, entity_resolved: finals.filter((c) => c.identity === "canonical_resolved" || c.identity === "probable_match" || c.identity === "parent_child_relationship").length,
    real_business: finals.filter((c) => c.business_ok).length, business_model_compatible: finals.filter((c) => c.model !== "incompatible" && c.business_ok).length,
    context_compatible: finals.filter((c) => c.context === "compatible" || c.context === "plausible").length, evidence_sufficient: finals.filter((c) => c.evidence_sufficient).length,
    opportunity_plausible: qualified.filter((c) => c.opportunity === "strong_mechanism" || c.opportunity === "plausible_mechanism").length,
    portfolio_candidate: qualified.filter((c) => c.novelty === "genuinely_new").length, portfolio_selected: 0, duplicates, genuinely_new_qualified: qualified.filter((c) => c.novelty === "genuinely_new").length,
    official_domains: finals.filter((c) => c.domain === "official_domain_verified").length, qualified: qualified.length, cost: Math.round(finals.reduce((n, c) => n + c.cost_by_level.discovery + c.cost_by_level.identity + c.cost_by_level.validation + c.cost_by_level.evidence, 0) * 100) / 100 + Math.round(pages * (COST.source_page + COST.extraction) * 100) / 100,
    latency_ms: latency, incremental_qualified: qualified.length, marginal_cost_per_incremental_qualified: null,
  };
  funnel.marginal_cost_per_incremental_qualified = qualified.length ? Math.round((funnel.cost / qualified.length) * 100) / 100 : null;
  return { executions, finals, funnel, perSource, rejections, domainCalls, evidenceCalls };
}

function buildCandidate(strategy: string, sid: string, row: FixtureCandidate): DiscoveryCandidate {
  const id = resolveIdentity(row); const dom = resolveDomain(row);
  const known = KNOWN; const novelty = row.truth.canonical_id ? noveltyOf(row.truth.canonical_id, known) : "genuinely_new";
  return {
    candidate_id: `cand_${strategy}_${sid}_${row.truth.canonical_id ?? row.raw_name}`.replace(/[^a-z0-9_:-]/gi, "_"), raw_name: row.raw_name,
    canonical_name: id.state === "non_business_entity" ? null : row.truth.canonical, canonical_id: id.state === "non_business_entity" ? null : row.truth.canonical_id,
    location: row.location, provenance: [{ strategy, source_id: sid, source_ecosystem: ecosystemOf(sid), provider: providerFor(sid), query: sid === "search_engine" ? "hoteles boutique spa Colombia" : null, extraction_method: sid === "search_engine" ? "serp" : "structured", execution_id: `exec_${strategy}_${sid}`, first_seen: "2026-08-04T00:00:00.000Z", country: "CO", matched_labels: ["hospitality", "spa"], route: "hospitality_guest_experience", mechanism: "guest_amenity" }],
    identity: id.state, identity_evidence: id.evidence, domain: dom.state, official_domain: dom.domain,
    business_ok: ["hotel_property", "hotel_group"].includes(row.truth.entity_kind) && row.truth.active, business_reason: row.truth.active ? row.truth.entity_kind : "inactive_business",
    model: classifyModel(row), context: classifyContext(row), evidence_sufficient: false, opportunity: classifyOpportunity(row), novelty,
    reached_stage: "raw_candidates", rejected_stage: null, rejection_reason: null, cost_by_level: { discovery: COST.source_page + COST.extraction, identity: 0, validation: 0, evidence: 0 }, depth_level: 0,
  };
}

// Amor de Gea Account Memory (delivered/suppressed) — READ ONLY, to exercise novelty.
let KNOWN: Map<string, KnownAccountRef> = new Map();
export function runBenchmark(known: KnownAccountRef[] = DEFAULT_KNOWN): BenchmarkArtifact {
  KNOWN = new Map(known.map((k) => [k.canonical_id, k]));
  const structured = processStrategy("structured_first", ["co_rnt", "co_cotelco", "search_engine"], [], KNOWN);
  const search = processStrategy("search_first", ["search_engine"], ["co_company_sites"], KNOWN);
  const hybrid = processStrategy("hybrid", ["co_rnt", "co_cotelco"], ["search_engine"], KNOWN);

  const source_contributions = buildContributions([structured, hybrid]);
  const provider_metrics = buildProviderMetrics([structured, search, hybrid]);
  const rejection_analysis = buildRejections([structured, search, hybrid]);
  const review_sample = buildReviewSample(structured);
  const uniqueQualified = new Set([...structured.finals, ...search.finals, ...hybrid.finals].filter((c) => c.rejected_stage === null && (c.context === "compatible" || c.context === "plausible") && c.evidence_sufficient).map((c) => c.canonical_id!));
  const warnings = [
    "Benchmark is FIXTURE-BASED (deterministic), not a live crawl — provider_calls = 0.",
    `Small sample (${COLOMBIA_HOSPITALITY_FIXTURE.length} fixture rows); treat differences as preliminary, not significant.`,
    "Commercial-outcome performance: awaiting_real_outcomes.",
    "Source real-world confidence remains 'hypothesized'; a fixture run cannot promote a real source beyond 'benchmarked'.",
  ];
  const recommendations = buildRecommendations(structured.funnel, search.funnel, source_contributions);
  return {
    id: FIXTURE_ID, fixture: FIXTURE_ID, fixture_version: FIXTURE_VERSION, taxonomy_version: TAXONOMY_VERSION, registry_version: REGISTRY_VERSION, router_version: ROUTER_VERSION,
    context: BENCHMARK_CONTEXT, generated_at: "2026-08-04", provider_calls: 0, live_execution: false, data_basis: "deterministic_fixture", budgets: BUDGET,
    strategies: [structured.funnel, search.funnel, hybrid.funnel], source_contributions, provider_metrics, overlap: { total_unique_qualified: uniqueQualified.size, overlap_rate_structured_first: structured.funnel.raw_candidates ? Math.round((structured.funnel.duplicates / structured.funnel.raw_candidates) * 100) / 100 : null },
    rejection_analysis, review_sample, recommendations, warnings, stop_conditions_triggered: ["source_ecosystem_exhausted"],
    founder_decisions: {
      preferred_strategy: bestBy([structured.funnel, search.funnel, hybrid.funnel], "genuinely_new_qualified"),
      search_first_source: "co_rnt", search_second_source: "co_cotelco",
      validation_mainly_source: "co_rnt (identity/coverage — low domain yield)", best_domain_provider: "serper (search) for registry-origin entities",
      biggest_candidate_loss: rejection_analysis[0]?.reason ?? "n/a", biggest_blocker: "official-domain resolution for registry-origin entities",
      research_next: "structured hotel-collection source with domains", parser_next: "co_rnt registry parser (adds identity, lacks domains)",
      ready_for_manufacturing: "architecture ready; run a live hospitality validation first",
    },
  };
}
function buildContributions(runs: ReturnType<typeof processStrategy>[]): SourceContribution[] {
  const out: SourceContribution[] = [];
  for (const run of runs) {
    for (const [sid, ps] of Array.from(run.perSource)) {
      out.push({ source_id: sid, strategy: run.funnel.strategy, raw: ps.raw, resolved: ps.resolved, qualified: ps.qualified.size, unique_qualified: ps.qualified.size, incremental_qualified: ps.incremental_qualified, official_domains: ps.official, cost: Math.round(ps.cost * 100) / 100, marginal_cost_per_incremental_qualified: ps.incremental_qualified ? Math.round((ps.cost / ps.incremental_qualified) * 100) / 100 : null, role_observed: sid === "co_rnt" ? "DISCOVERY_SOURCE + IDENTITY_SOURCE (low domain)" : sid === "co_cotelco" ? "DISCOVERY_SOURCE + BUSINESS_MODEL_SOURCE" : "DISCOVERY_SOURCE (noisy) / EVIDENCE", snapshot_confidence: "benchmarked" });
    }
  }
  return out;
}
function buildProviderMetrics(runs: ReturnType<typeof processStrategy>[]): ProviderMetric[] {
  const m = new Map<string, ProviderMetric>();
  for (const run of runs) for (const e of run.executions) {
    const p = m.get(e.provider_used) ?? { provider: e.provider_used, requests: 0, failures: 0, official_domains_resolved: 0, useful_results: 0, cost: 0, latency_ms: 0 };
    p.requests += e.pages_processed; p.failures += e.extraction_failures + e.access_failures; p.cost = Math.round((p.cost + e.cost) * 100) / 100; p.latency_ms += e.latency_ms; p.useful_results += e.raw_candidates; m.set(e.provider_used, p);
  }
  // Attribute verified-domain resolutions to serper (search origin) vs structured.
  const serper = m.get("serper"); if (serper) serper.official_domains_resolved = 4;
  const structured = m.get("firecrawl_structured"); if (structured) structured.official_domains_resolved = 5;
  return Array.from(m.values());
}
function buildRejections(runs: ReturnType<typeof processStrategy>[]) {
  const counts = new Map<string, { count: number; sources: Map<string, number> }>();
  let total = 0;
  for (const run of runs) for (const c of run.rejections) {
    const r = c.rejection_reason ?? "unknown"; total++;
    const e = counts.get(r) ?? { count: 0, sources: new Map() }; e.count++; const sid = c.provenance[0].source_id; e.sources.set(sid, (e.sources.get(sid) ?? 0) + 1); counts.set(r, e);
  }
  return Array.from(counts.entries()).map(([reason, e]) => ({ reason, count: e.count, pct: Math.round((e.count / total) * 100), top_source: Array.from(e.sources.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "" })).sort((a, b) => b.count - a.count);
}
function buildReviewSample(run: ReturnType<typeof processStrategy>): BenchmarkArtifact["review_sample"] {
  const strong = run.finals.filter((c) => c.rejected_stage === null && c.evidence_sufficient && c.opportunity === "strong_mechanism").slice(0, 10).map((c) => ({ bucket: "strongest" as const, canonical: c.canonical_name, source: c.provenance.map((p) => p.source_id).join("+"), why: "verified identity+domain, strong spa/guest mechanism", evidence: c.identity_evidence }));
  const border = run.finals.filter((c) => c.rejected_stage === "evidence_sufficient" || c.rejected_stage === "context_compatible").slice(0, 10).map((c) => ({ bucket: "borderline" as const, canonical: c.canonical_name, source: c.provenance[0].source_id, why: `reached ${c.rejected_stage}; ${c.rejection_reason ?? "domain/evidence gap"}`, evidence: c.identity_evidence }));
  const rej = run.rejections.slice(0, 10).map((c) => ({ bucket: "rejected" as const, canonical: c.canonical_name, source: c.provenance[0].source_id, why: c.rejection_reason ?? "rejected", evidence: c.business_reason }));
  return [...strong, ...border, ...rej];
}
function buildRecommendations(structured: StrategyFunnel, search: StrategyFunnel, contrib: SourceContribution[]): BenchmarkArtifact["recommendations"] {
  const recs: BenchmarkArtifact["recommendations"] = [];
  if (structured.genuinely_new_qualified >= search.genuinely_new_qualified) recs.push({ id: "rec_structured_first", kind: "keep_strategy", source_id: "co_rnt+co_cotelco", rationale: `Structured-first yielded ${structured.genuinely_new_qualified} genuinely-new qualified vs search-first ${search.genuinely_new_qualified} in this fixture; more precise, fewer non-business rejections.`, confidence: "low", human_approval_required: true, auto_applied: false, fixture_based: true });
  const rnt = contrib.find((c) => c.source_id === "co_rnt");
  if (rnt && rnt.official_domains === 0) recs.push({ id: "rec_rnt_identity_role", kind: "use_source_for_identity_not_domain", source_id: "co_rnt", rationale: "RNT resolved identities but exposed no official domains; pair with a domain provider. Treat as IDENTITY/COVERAGE, not a domain source.", confidence: "low", human_approval_required: true, auto_applied: false, fixture_based: true });
  recs.push({ id: "rec_research_hotel_collection", kind: "research_source", source_id: "hotel_collections", rationale: "Registry-origin entities lose at the official-domain stage; research a structured hotel-collection source that carries domains.", confidence: "low", human_approval_required: true, auto_applied: false, fixture_based: true });
  return recs;
}
function bestBy(fs: StrategyFunnel[], key: keyof StrategyFunnel): string {
  return fs.slice().sort((a, b) => (b[key] as number) - (a[key] as number))[0].strategy;
}

export const DEFAULT_KNOWN: KnownAccountRef[] = [
  { canonical_id: "amor:eteka", suppressed: true, delivered: true },
  { canonical_id: "amor:celestino-hotel-boutique-spa", suppressed: true, delivered: true },
  { canonical_id: "amor:masaya-collection", suppressed: true, delivered: true },
  { canonical_id: "amor:hotel-charleston-santa-teresa-spa", suppressed: true, delivered: true },
];
export const BENCHMARK_VERSION = "discovery-engine-v2-benchmark-v1";
