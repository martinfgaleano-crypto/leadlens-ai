// Source Router + Source Memory + Discovery funnel/metrics + coverage gaps.
// Deterministic. No provider calls, no search. The router decides WHERE to search
// first and explains why, consuming Account Memory (suppress known/duplicate) and
// Source Memory (historical yield). SOURCE and PROVIDER stay separate throughout.
import {
  SOURCE_MAPPINGS, SOURCE_REGISTRY, COUNTRY_REGISTRY, type SourceRegistryEntry,
  type SourceContextMapping, type SourcePriorityTier, type SourceRole,
} from "./registry";
import type { DiscoveryContext, IndustryLabel } from "./taxonomy";
import { coverageForContext, type CoverageBreadth, type CoverageDepth } from "./coverage";

// ─── Source Memory (analogous to Account Memory; history-preserving) ──────────
export interface SourcePerformanceSnapshot {
  source_id: string; cycle_id: string; captured_at: string; country: string;
  candidates_discovered: number; valid_entities: number; correct_business_models: number;
  context_compatible: number; evidence_sufficient: number; opportunity_plausible: number;
  portfolio_accounts: number; novelty_yield: number | null; false_positives: number;
  duplicates: number; extraction_failures: number; access_failures: number;
  avg_cost: number | null; avg_latency_ms: number | null;
  // Commercial-outcome fields exist in the schema but stay null until real data (§31).
  client_selected_rate: number | null; contact_rate: number | null; order_rate: number | null;
  outcome_state: "measured" | "awaiting_real_outcomes";
}
export interface SourceMemory {
  source_id: string; first_used: string | null; last_used: string | null; countries: string[];
  industries: string[]; routes: string[]; mechanisms: string[]; total_runs: number;
  snapshots: SourcePerformanceSnapshot[]; last_success: string | null; last_failure: string | null;
  last_structural_change: string | null; quality_trend: "improving" | "stable" | "degrading" | "unknown";
}
export function emptySourceMemory(source_id: string): SourceMemory {
  return { source_id, first_used: null, last_used: null, countries: [], industries: [], routes: [], mechanisms: [], total_runs: 0, snapshots: [], last_success: null, last_failure: null, last_structural_change: null, quality_trend: "unknown" };
}
// Append-only: never overwrite historical snapshots.
export function appendSnapshot(memory: SourceMemory, snap: SourcePerformanceSnapshot): SourceMemory {
  return { ...memory, total_runs: memory.total_runs + 1, last_used: snap.captured_at, first_used: memory.first_used ?? snap.captured_at, snapshots: [...memory.snapshots, snap] };
}
export function historicalPortfolioYield(memory: SourceMemory | undefined): number | null {
  if (!memory || memory.snapshots.length === 0) return null;
  const discovered = memory.snapshots.reduce((n, s) => n + s.candidates_discovered, 0);
  const portfolio = memory.snapshots.reduce((n, s) => n + s.portfolio_accounts, 0);
  return discovered ? Math.round((portfolio / discovered) * 1000) / 1000 : null;
}

// ─── Discovery funnel + yield metrics (§18–§19) ───────────────────────────────
export const FUNNEL_STAGES = [
  "source_results", "raw_candidates", "entity_resolved", "real_business",
  "business_model_compatible", "context_compatible", "evidence_sufficient",
  "opportunity_plausible", "portfolio_candidate", "portfolio_selected",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];
export interface DiscoveryFunnelEvent {
  candidate_id: string; account_id: string | null; source_id: string; provider_id: string | null;
  stage: FunnelStage; passed: boolean; reject_reason: string | null; rule: string | null; evidence: string | null; timestamp: string;
}
export interface FunnelCounts { source_results: number; raw_candidates: number; entity_resolved: number; real_business: number; business_model_compatible: number; context_compatible: number; evidence_sufficient: number; opportunity_plausible: number; portfolio_candidate: number; portfolio_selected: number; duplicates: number; genuinely_new: number; official_domains: number; qualified: number; cost: number | null; }
const safeDiv = (a: number, b: number): number | null => (b ? Math.round((a / b) * 1000) / 1000 : null);
export function yieldMetrics(c: FunnelCounts) {
  return {
    raw_entity_yield: safeDiv(c.raw_candidates, c.source_results),
    valid_entity_yield: safeDiv(c.real_business, c.raw_candidates),
    business_model_yield: safeDiv(c.business_model_compatible, c.real_business),
    context_yield: safeDiv(c.context_compatible, c.business_model_compatible),
    evidence_yield: safeDiv(c.evidence_sufficient, c.context_compatible),
    opportunity_yield: safeDiv(c.opportunity_plausible, c.evidence_sufficient),
    portfolio_yield: safeDiv(c.portfolio_selected, c.opportunity_plausible),
    novelty_yield: safeDiv(c.genuinely_new, c.qualified),
    official_domain_yield: safeDiv(c.official_domains, c.real_business),
    false_positive_rate: safeDiv(c.raw_candidates - c.real_business, c.raw_candidates),
    duplicate_rate: safeDiv(c.duplicates, c.raw_candidates),
    cost_per_qualified_account: c.cost !== null ? safeDiv(c.cost, c.qualified) : null,
    cost_per_portfolio_account: c.cost !== null ? safeDiv(c.cost, c.portfolio_selected) : null,
  };
}

// ─── Source Router (§21–§24) ──────────────────────────────────────────────────
export interface KnownAccount { canonical_id: string; suppressed: boolean; novelty: string; }
export interface SourcePlanStep {
  source_id: string; source_name: string; priority: SourcePriorityTier; role: SourceRole; ecosystem: string;
  matched_country: string; matched_industry_labels: IndustryLabel[]; matched_business_model: string | null;
  matched_route: string; matched_mechanism: string; expected_entity_density: string; expected_domain_yield: string;
  expected_evidence_yield: string; historical_portfolio_yield: number | null; expected_role: string;
  why_higher_than_alternatives: string; provider_hint: string;
}
export interface SourcePlan {
  context: DiscoveryContext; matched_mapping_id: string | null; country_coverage: "strong" | "medium" | "weak";
  coverage_breadth: CoverageBreadth; coverage_depth: CoverageDepth;
  routing_state: "specialized_coverage" | "fallback_coverage" | "INSUFFICIENT_SOURCE_COVERAGE";
  primary_cluster: string | null; adjacent_transfer_clusters: string[]; coverage_gaps: string[];
  steps: SourcePlanStep[]; fallback_source_ids: string[]; stop_conditions: string[];
  suppressed_accounts: string[]; account_memory_consulted: boolean; source_memory_consulted: boolean;
  expected_cost: "low" | "medium" | "high"; explanation: string; version: string;
}

const TIER_ORDER: Record<SourcePriorityTier, number> = { tier_1_primary: 0, tier_2_secondary: 1, tier_3_gap_filler: 2, tier_4_signal_only: 3, low_priority: 4, avoid: 98, inaccessible: 98, deprecated: 99 };
// Structured sources before generic search (§24): prefer registries/associations.
const PROVIDER_HINT: Record<string, string> = { official_registries: "structured fetch (Firecrawl) — SOURCE, not the provider", industry_associations: "structured fetch (Firecrawl)", tourism_directories: "structured fetch (Firecrawl)", marketplaces: "extraction (Firecrawl) — ToS-aware", company_websites: "domain resolve (Serper) + page extract (Firecrawl)", partner_pages: "page extract (Firecrawl)", search_engines: "SERP provider (Serper/Brave/Tavily) — gap filler", ecommerce_ecosystems: "structured fetch (Firecrawl)", supplier_directories: "structured fetch (Firecrawl)" };

function overlap(a: readonly string[], b: readonly string[]): string[] { return a.filter((x) => b.includes(x)); }
function countryCoverage(country: string): "strong" | "medium" | "weak" {
  const sources = SOURCE_REGISTRY[country] ?? []; const mappings = SOURCE_MAPPINGS[country] ?? [];
  if (!COUNTRY_REGISTRY[country]) return "weak";
  if (sources.length >= 8 && mappings.length >= 4) return "strong";
  if (sources.length >= 4) return "medium";
  return "weak";
}
function matchMapping(ctx: DiscoveryContext): SourceContextMapping | null {
  const mappings = SOURCE_MAPPINGS[ctx.country] ?? [];
  let best: { m: SourceContextMapping; score: number } | null = null;
  for (const m of mappings) {
    if (!ctx.routes.includes(m.route)) continue;
    const mechMatch = ctx.mechanisms.includes(m.mechanism) ? 2 : 0;
    const labelMatch = overlap(m.industry_labels, ctx.industry_labels).length;
    const modelMatch = overlap(m.business_models, ctx.business_models).length;
    const score = mechMatch + labelMatch * 2 + modelMatch;
    if (score > 0 && (!best || score > best.score)) best = { m, score };
  }
  return best?.m ?? null;
}

export function buildSourcePlan(
  ctx: DiscoveryContext,
  opts: { knownAccounts?: KnownAccount[]; sourceMemory?: Record<string, SourceMemory> } = {},
): SourcePlan {
  const sources = SOURCE_REGISTRY[ctx.country] ?? [];
  const byId = new Map(sources.map((s) => [s.id, s]));
  const mapping = matchMapping(ctx);
  const knownAccounts = opts.knownAccounts ?? [];
  const suppressed = knownAccounts.filter((a) => a.suppressed).map((a) => a.canonical_id);
  const contextualCoverage = coverageForContext(ctx.industry_labels, ctx.business_models, ctx.routes);

  const steps: SourcePlanStep[] = [];
  if (mapping) {
    for (const tierGroup of [...mapping.tiers].sort((x, y) => TIER_ORDER[x.tier] - TIER_ORDER[y.tier])) {
      for (const sid of tierGroup.source_ids) {
        const s = byId.get(sid); if (!s) continue;
        const mem = opts.sourceMemory?.[sid];
        steps.push(stepFor(s, tierGroup.tier, ctx, mapping, mem));
      }
    }
  } else {
    // No mapping: fall back to generic discovery sources by role, search engine last.
    for (const s of sources.filter((x) => x.roles.includes("DISCOVERY_SOURCE"))) {
      steps.push(stepFor(s, s.id === "search_engine" ? "tier_3_gap_filler" : "tier_2_secondary", ctx, null, opts.sourceMemory?.[s.id]));
    }
  }
  const fallback = (byId.has("search_engine") ? ["search_engine"] : []).concat(
    sources.filter((s) => s.roles.includes("COVERAGE_SOURCE") && !steps.some((st) => st.source_id === s.id)).map((s) => s.id));

  return {
    context: ctx, matched_mapping_id: mapping?.id ?? null, country_coverage: countryCoverage(ctx.country),
    coverage_breadth: contextualCoverage.coverage?.breadth ?? "none",
    coverage_depth: contextualCoverage.coverage?.depth ?? "untested",
    routing_state: mapping ? contextualCoverage.routing_state : "INSUFFICIENT_SOURCE_COVERAGE",
    primary_cluster: contextualCoverage.primary_cluster,
    adjacent_transfer_clusters: contextualCoverage.adjacent_clusters,
    coverage_gaps: contextualCoverage.coverage ? [contextualCoverage.coverage.biggest_gap] : ["cluster_no_specialized_source"],
    steps, fallback_source_ids: Array.from(new Set(fallback)),
    stop_conditions: STOP_CONDITIONS, suppressed_accounts: suppressed,
    account_memory_consulted: knownAccounts.length > 0, source_memory_consulted: Boolean(opts.sourceMemory),
    expected_cost: steps.some((s) => s.priority === "tier_1_primary") ? "low" : "medium",
    explanation: mapping
      ? `País ${ctx.country}, ruta ${mapping.route}, mecanismo ${mapping.mechanism}: se priorizan fuentes estructuradas (${steps.filter((s) => s.priority === "tier_1_primary").map((s) => s.source_name).join(", ") || "n/d"}) antes de buscadores genéricos. ${mapping.rationale} Se suprimen ${suppressed.length} cuentas ya conocidas antes de investigar.`
      : `INSUFFICIENT_SOURCE_COVERAGE para ${ctx.country}/${ctx.routes.join(",")}: transferencia adyacente explícita (${contextualCoverage.adjacent_clusters.join(", ") || "ninguna"}), luego registro/cámaras, buscador genérico y sitios de empresa. Se crea una brecha; no se presenta como cobertura especializada.`,
    version: ROUTER_VERSION,
  };
}
function stepFor(s: SourceRegistryEntry, tier: SourcePriorityTier, ctx: DiscoveryContext, mapping: SourceContextMapping | null, mem?: SourceMemory): SourcePlanStep {
  const role: SourceRole = s.roles.includes("DISCOVERY_SOURCE") ? "DISCOVERY_SOURCE" : s.roles[0];
  const matchedLabels = overlap(s.industry_labels, ctx.industry_labels) as IndustryLabel[];
  return {
    source_id: s.id, source_name: s.name, priority: tier, role, ecosystem: s.ecosystem,
    matched_country: ctx.country, matched_industry_labels: matchedLabels,
    matched_business_model: overlap(s.business_model_labels, ctx.business_models)[0] ?? null,
    matched_route: mapping?.route ?? ctx.routes[0] ?? "", matched_mechanism: mapping?.mechanism ?? ctx.mechanisms[0] ?? "",
    expected_entity_density: s.expected_entity_density, expected_domain_yield: s.expected_domain_availability,
    expected_evidence_yield: s.roles.includes("EVIDENCE_SOURCE") ? "medium" : "low",
    historical_portfolio_yield: historicalPortfolioYield(mem),
    expected_role: s.roles.join(", "),
    why_higher_than_alternatives: tier === "tier_1_primary"
      ? `Fuente estructurada de ${s.ecosystem} con densidad ${s.expected_entity_density} y autoridad ${s.expected_authority}; preferida sobre buscadores genéricos.`
      : tier === "tier_3_gap_filler" ? "Buscador/relleno para resolver dominios y cubrir long-tail cuando las fuentes estructuradas se agotan."
      : `Fuente ${tier} para complementar cobertura y evidencia.`,
    provider_hint: PROVIDER_HINT[s.ecosystem] ?? "provider selected by role",
  };
}
export const STOP_CONDITIONS = [
  "target_qualified_account_count_reached", "marginal_qualified_yield_below_threshold",
  "duplicate_rate_too_high", "source_ecosystem_exhausted", "cost_per_qualified_exceeds_threshold",
  "evidence_quality_deteriorating", "enough_route_diversity", "portfolio_challenger_pool_sufficient",
];

// ─── Coverage gaps (§36) ──────────────────────────────────────────────────────
export interface SourceCoverageGap {
  dimension: string; severity: "low" | "medium" | "high"; evidence: string; affected_country: string;
  affected_labels: string[]; recommended_action: string;
}
export function detectCoverageGaps(country: string): SourceCoverageGap[] {
  const gaps: SourceCoverageGap[] = [];
  const sources = SOURCE_REGISTRY[country] ?? []; const mappings = SOURCE_MAPPINGS[country] ?? [];
  if (!COUNTRY_REGISTRY[country]) { gaps.push({ dimension: "country_has_low_source_coverage", severity: "high", evidence: "No country profile", affected_country: country, affected_labels: [], recommended_action: "Create a country source profile" }); return gaps; }
  for (const m of mappings) {
    const hasTier1 = m.tiers.some((t) => t.tier === "tier_1_primary" && t.source_ids.length > 0);
    if (!hasTier1) gaps.push({ dimension: "industry_has_no_tier1_source", severity: "high", evidence: `Mapping ${m.id} lacks a Tier 1 source`, affected_country: country, affected_labels: m.industry_labels, recommended_action: "Research a structured Tier 1 source" });
  }
  const validated = sources.filter((s) => s.confidence === "benchmarked" || s.confidence === "historically_effective");
  if (validated.length < 2) gaps.push({ dimension: "sources_unbenchmarked", severity: "medium", evidence: `${validated.length} benchmarked/effective of ${sources.length}`, affected_country: country, affected_labels: [], recommended_action: "Benchmark hypothesized sources on a controlled sample" });
  if (!sources.some((s) => s.roles.includes("SIGNAL_SOURCE"))) gaps.push({ dimension: "signal_sources_missing", severity: "medium", evidence: "No SIGNAL_SOURCE registered", affected_country: country, affected_labels: [], recommended_action: "Add a signal/timing source" });
  const stale = sources.filter((s) => s.last_validated === null);
  if (stale.length > 0) gaps.push({ dimension: "source_stale", severity: "low", evidence: `${stale.length} sources never validated`, affected_country: country, affected_labels: [], recommended_action: "Validate/last-check hypothesized sources" });
  return gaps;
}

// ─── Source research queue (§37) — improves LeadLens, not an account search ────
export interface SourceResearchTask {
  id: string; country: string; labels: string[]; route: string | null; gap: string;
  proposed_source: string; owner: string; status: "open" | "in_progress" | "done" | "rejected"; result: string | null;
}
export function seedResearchQueue(country: string): SourceResearchTask[] {
  return detectCoverageGaps(country).map((g, i) => ({
    id: `srq_${country}_${i + 1}`, country, labels: g.affected_labels, route: null, gap: g.dimension,
    proposed_source: g.recommended_action, owner: "founder", status: "open", result: null,
  }));
}

// ─── Discovery learning recommendation (§30) — human approval required ────────
export interface SourceLearningRecommendation {
  id: string; source_id: string; country: string; from_tier: SourcePriorityTier; to_tier: SourcePriorityTier;
  supporting_cycles: string[]; observed_multiplier: number | null; confidence: "low" | "medium" | "high";
  rationale: string; human_approval_required: true; auto_applied: false;
}
export function proposeReprioritization(source_id: string, country: string, memory: SourceMemory | undefined, from_tier: SourcePriorityTier, to_tier: SourcePriorityTier): SourceLearningRecommendation | null {
  if (!memory || memory.snapshots.length < 3) return null; // require an evidence threshold across cycles
  const y = historicalPortfolioYield(memory);
  if (y === null) return null;
  return {
    id: `slr_${source_id}_${country}`, source_id, country, from_tier, to_tier,
    supporting_cycles: memory.snapshots.map((s) => s.cycle_id), observed_multiplier: y > 0 ? Math.round(y * 100) / 100 : null,
    confidence: memory.snapshots.length >= 3 ? "medium" : "low",
    rationale: `Observed portfolio yield ${y} across ${memory.snapshots.length} cycles.`, human_approval_required: true, auto_applied: false,
  };
}

// ─── Provider ↔ Source provenance (§33–§34) — kept separate always ────────────
export interface SourceProviderInteraction {
  source_id: string; provider_id: string; role: SourceRole; step: "discovery" | "domain_resolution" | "evidence" | "page_extraction" | "signal";
}
export const ROUTER_VERSION = "source-router-v1";
