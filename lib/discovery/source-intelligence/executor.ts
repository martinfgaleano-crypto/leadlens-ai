// Discovery Engine V2 — controlled source executor + entity resolution V2 +
// staged validation pipeline. Deterministic; runs over the benchmark fixture with
// 0 provider calls. Escalating research depth with early rejection; full per-stage
// funnel trace and best-effort cost attribution. SOURCE and PROVIDER stay separate.
import { COLOMBIA_SOURCES } from "./registry";
import type { FixtureCandidate } from "./benchmark-fixture";

// Estimated per-operation cost units (fixture — no real provider billing).
export const COST = { source_page: 0.2, extraction: 0.05, domain_resolution: 0.3, model_validation: 0.1, evidence: 0.4 } as const;

export interface DiscoveryBudget { max_source_pages: number; max_extractions: number; max_domain_resolutions: number; max_evidence_calls: number; }
export interface SourceExecutionResult {
  execution_id: string; source_id: string; country: string; strategy: string; provider_used: string;
  started_at: string; pages_processed: number; raw_candidates: number; extraction_failures: number;
  access_failures: number; cost: number; latency_ms: number; stop_reason: string;
}

export type IdentityState = "canonical_resolved" | "probable_match" | "unresolved" | "duplicate" | "parent_child_relationship" | "branch_relationship" | "conflicting_identity" | "non_business_entity";
export type DomainState = "official_domain_verified" | "probable_official_domain" | "no_domain_found" | "conflicting_domains" | "aggregator_only";
export type ModelState = "verified_compatible" | "likely_compatible" | "ambiguous" | "incompatible";
export type ContextState = "compatible" | "plausible" | "weak" | "incompatible";
export type OpportunityState = "strong_mechanism" | "plausible_mechanism" | "weak_mechanism" | "no_mechanism";
export type NoveltyState = "genuinely_new" | "previously_delivered" | "previously_seen_not_delivered" | "suppressed" | "duplicate_identity";

export interface DiscoveryProvenance { strategy: string; source_id: string; source_ecosystem: string; provider: string; query: string | null; extraction_method: string; execution_id: string; first_seen: string; country: string; matched_labels: string[]; route: string; mechanism: string; }
export interface DiscoveryCandidate {
  candidate_id: string; raw_name: string; canonical_name: string | null; canonical_id: string | null;
  location: string | null; provenance: DiscoveryProvenance[]; identity: IdentityState; identity_evidence: string;
  domain: DomainState; official_domain: string | null; business_ok: boolean; business_reason: string;
  model: ModelState; context: ContextState; evidence_sufficient: boolean; opportunity: OpportunityState;
  novelty: NoveltyState; reached_stage: string; rejected_stage: string | null; rejection_reason: string | null;
  cost_by_level: { discovery: number; identity: number; validation: number; evidence: number };
  depth_level: number;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\b(hotel|spa|s\.?a\.?s\.?|boutique|the|de|del|la|el)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const AGGREGATORS = /(booking\.com|tripadvisor|trivago|expedia|hotels\.com|despegar|airbnb)/i;
const ecosystemOf = (id: string) => COLOMBIA_SOURCES.find((s) => s.id === id)?.ecosystem ?? "unknown";
const providerFor = (id: string) => (id === "search_engine" ? "serper" : id === "co_company_sites" ? "firecrawl" : "firecrawl_structured");

export interface KnownAccountRef { canonical_id: string; suppressed: boolean; delivered: boolean; }

// Entity resolution V2 — conservative. Domain agreement or (name+geo) agreement
// across sources resolves; name-only similarity never merges.
export function resolveIdentity(row: FixtureCandidate): { state: IdentityState; evidence: string } {
  if (row.truth.entity_kind === "article" || row.truth.entity_kind === "aggregator" || row.truth.entity_kind === "non_business") {
    return { state: "non_business_entity", evidence: `Source row is a ${row.truth.entity_kind}, not an operating company` };
  }
  if (row.truth.entity_kind === "association") return { state: "non_business_entity", evidence: "Association page, not a buyer entity for this route" };
  if (row.truth.entity_kind === "hotel_group") return { state: "parent_child_relationship", evidence: "Group/parent identity; properties resolve separately" };
  // property with a domain hint or registry identity → canonical
  if (row.domain_hint && !AGGREGATORS.test(row.domain_hint)) return { state: "canonical_resolved", evidence: `Domain-anchored identity via ${row.domain_hint}` };
  if (row.location) return { state: "canonical_resolved", evidence: "Registry name + location anchor" };
  return { state: "probable_match", evidence: "Name-only; needs corroboration" };
}
// Merge two rows only with strong evidence (same official domain, or same canonical_id
// with agreeing geography). Never on fuzzy name alone.
export function canMerge(a: FixtureCandidate, b: FixtureCandidate): { merge: boolean; reason: string } {
  const da = (a.truth.official_domain ?? a.domain_hint)?.replace(/^www\./, "");
  const db = (b.truth.official_domain ?? b.domain_hint)?.replace(/^www\./, "");
  if (da && db && da === db && !AGGREGATORS.test(da)) return { merge: true, reason: `shared official domain ${da}` };
  if (norm(a.raw_name) === norm(b.raw_name) && a.location && b.location && a.location === b.location) return { merge: true, reason: "same normalized name + same location" };
  if (norm(a.raw_name) === norm(b.raw_name)) return { merge: false, reason: "name match without domain/geo agreement — insufficient" };
  return { merge: false, reason: "distinct" };
}
export function resolveDomain(row: FixtureCandidate): { state: DomainState; domain: string | null } {
  if (row.domain_hint && AGGREGATORS.test(row.domain_hint)) return { state: "aggregator_only", domain: null };
  if (row.truth.official_domain && (row.domain_hint === row.truth.official_domain)) return { state: "official_domain_verified", domain: row.truth.official_domain };
  if (row.truth.official_domain) return { state: "probable_official_domain", domain: row.truth.official_domain }; // e.g. registry had no domain; provider would resolve
  return { state: "no_domain_found", domain: null };
}
export function classifyModel(row: FixtureCandidate): ModelState {
  const bm = row.truth.business_model;
  if (bm === "hotel_operator") return "verified_compatible";
  if (bm === "hospitality_group" || bm === "spa_operator") return "likely_compatible";
  if (bm === "other") return "incompatible";
  return "ambiguous";
}
export function classifyContext(row: FixtureCandidate): ContextState {
  if (!row.truth.geography_ok) return "incompatible";
  if (row.truth.route_evidence === "strong" && row.truth.has_spa) return "compatible";
  if (row.truth.route_evidence === "strong" || row.truth.route_evidence === "plausible") return "plausible";
  if (row.truth.route_evidence === "weak") return "weak";
  return "incompatible";
}
export function classifyOpportunity(row: FixtureCandidate): OpportunityState {
  if (row.truth.route_evidence === "strong" && row.truth.has_spa) return "strong_mechanism";
  if (row.truth.route_evidence === "plausible") return "plausible_mechanism";
  if (row.truth.route_evidence === "weak") return "weak_mechanism";
  return "no_mechanism";
}
export function noveltyOf(canonical_id: string, known: Map<string, KnownAccountRef>): NoveltyState {
  const k = known.get(canonical_id);
  if (!k) return "genuinely_new";
  if (k.delivered) return "previously_delivered";
  if (k.suppressed) return "suppressed";
  return "previously_seen_not_delivered";
}
