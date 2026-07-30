export const COLOMBIAN_ENTITY_RESOLUTION_VERSION = "colombian-entity-resolution-v1";

export type IdentityState = "confirmed" | "high_confidence" | "probable" | "ambiguous" | "wrong_entity" | "unresolved";
export type DomainState = "verified" | "probable" | "parked" | "inactive" | "unrelated" | "unresolved";
export type PropertyType = "website" | "instagram" | "facebook" | "linkedin" | "google_business" | "marketplace";
export type PropertyState = "verified" | "probable" | "unrelated" | "unresolved";
export type RelationshipState =
  | "same_company" | "branch" | "franchise" | "subsidiary" | "parent" | "sister_company"
  | "distributor" | "retailer" | "supplier" | "marketplace_seller" | "unrelated_namesake" | "unknown";
export type AttributionScope = "account_wide" | "parent_level" | "subsidiary_level" | "branch_level" | "location_specific" | "relationship_only" | "unknown";
export type EventAttributionState =
  | "directly_attributed" | "parent_attributed" | "subsidiary_attributed" | "branch_attributed"
  | "relationship_attributed" | "possibly_attributed" | "not_attributable" | "wrong_entity";
export type AnchorStrength = "strong" | "moderate" | "weak" | "conflict";
export type IdentityEdgeType =
  | "operates_as" | "legally_registered_as" | "owns_domain" | "owns_social_profile"
  | "located_at" | "branch_of" | "subsidiary_of" | "distributed_by" | "listed_on"
  | "mentioned_by" | "same_entity_as" | "possible_same_entity" | "not_same_entity"
  | "supersedes" | "formerly_known_as";

const hash = (value: string): string => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
};
const normText = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const iso = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
export const domainFrom = (url: string) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; } };
export const domainMatches = (actual: string | null, expected: string | null) => !!actual && !!expected && (actual === expected || actual.endsWith(`.${expected}`));

const LEGAL_SUFFIXES = new Set(["sas", "sa", "ltda", "limitada", "eu"]);
const GENERIC_PREFIXES = new Set(["grupo", "comercializadora", "distribuidora", "importadora", "exportadora"]);
export interface NormalizedCompanyName {
  raw_name: string; normalized_full: string; comparison_name: string;
  legal_suffixes_removed: string[]; generic_prefixes_observed: string[];
}
export function normalizeColombianCompanyName(rawName: string): NormalizedCompanyName {
  // Collapse dotted Colombian legal abbreviations before punctuation removal,
  // otherwise "S.A.S." becomes three meaningless one-letter tokens.
  const normalized_full = normText(rawName
    .replace(/\bS\s*\.\s*A\s*\.\s*S\s*\.?/gi, "SAS")
    .replace(/\bS\s*\.\s*A\s*\.?/gi, "SA")
    .replace(/\bE\s*\.\s*U\s*\.?/gi, "EU"));
  const tokens = normalized_full.split(" ").filter(Boolean);
  const legal_suffixes_removed = tokens.filter((x) => LEGAL_SUFFIXES.has(x));
  const generic_prefixes_observed = tokens.filter((x) => GENERIC_PREFIXES.has(x));
  const comparison = tokens.filter((x) => !LEGAL_SUFFIXES.has(x));
  return {
    raw_name: rawName, normalized_full, comparison_name: comparison.join(" "),
    legal_suffixes_removed, generic_prefixes_observed,
  };
}

export interface IdentitySourceRef {
  source_id: string; url: string; source_type: string; observed_at: string;
}
export interface IdentityAnchor {
  anchor_id: string; kind: "verified_domain" | "registry" | "address" | "phone" | "official_social"
  | "legal_name" | "contact_page" | "city_category" | "product_portfolio" | "partner_link"
  | "directory_record" | "name_similarity" | "country" | "social_handle" | "keyword_overlap"
  | "conflicting_domain" | "geographic_conflict" | "category_conflict";
  value: string; strength: AnchorStrength; supports_identity: boolean; confidence: number;
  evidence: IdentitySourceRef[]; reason: string;
}
export function identityAnchor(input: Omit<IdentityAnchor, "anchor_id">): IdentityAnchor {
  return { ...input, anchor_id: `anchor_${hash(`${input.kind}:${input.value}:${input.supports_identity}`)}` };
}

export interface OfficialProperty {
  property_id: string; type: PropertyType; url: string; state: PropertyState;
  ownership_evidence: IdentityAnchor[]; source_owner_key: string; confidence: number;
  profile_only: boolean; last_verified_at: string; limitations: string[];
}
export function verifyOfficialProperty(input: {
  type: PropertyType; url: string; verified_domain: string | null; anchors: IdentityAnchor[];
  profile_only?: boolean; verified_at: string;
}): OfficialProperty {
  const strong = input.anchors.filter((a) => a.supports_identity && a.strength === "strong");
  const moderate = input.anchors.filter((a) => a.supports_identity && a.strength === "moderate");
  const conflict = input.anchors.some((a) => !a.supports_identity && ["strong", "conflict"].includes(a.strength));
  const state: PropertyState = conflict ? "unrelated" : strong.length ? "verified" : moderate.length >= 2 ? "probable" : "unresolved";
  const owner = input.verified_domain ?? domainFrom(input.url) ?? `unresolved:${hash(input.url)}`;
  return {
    property_id: `prop_${hash(`${input.type}:${input.url}`)}`, type: input.type, url: input.url,
    state, ownership_evidence: input.anchors, source_owner_key: owner,
    confidence: state === "verified" ? .95 : state === "probable" ? .72 : state === "unrelated" ? .05 : .35,
    profile_only: input.profile_only ?? true, last_verified_at: input.verified_at,
    limitations: state === "unresolved" ? ["Ownership lacks a strong anchor or two independent moderate anchors."] : [],
  };
}

export interface ColombianIdentityProfile {
  profile_id: string; account_id: string; client_id: string | null;
  canonical_commercial_name: string; normalized_name: NormalizedCompanyName;
  legal_name: string | null; nit: string | null; verified_domain: string | null;
  alternate_verified_domains: string[]; official_properties: OfficialProperty[];
  city: string | null; department: string | null; country: "Colombia";
  verified_addresses: string[]; business_category: string | null; products_services: string[];
  parent_entity: string | null; subsidiaries: string[]; branches: string[]; known_aliases: string[];
  former_names: string[]; marketplace_identities: string[]; distributor_relationships: string[];
  registry_references: IdentitySourceRef[]; identity_confidence: number;
  identity_state: IdentityState; confirmed_anchors: IdentityAnchor[]; conflicting_anchors: IdentityAnchor[];
  unresolved_identity_questions: string[]; source_provenance: IdentitySourceRef[];
  last_verified_date: string; methodology_version: string; internal_only: true;
}
export function buildColombianIdentityProfile(input: {
  account_id: string; client_id?: string | null; commercial_name: string; verified_domain?: string | null;
  legal_name?: string | null; nit?: string | null; city?: string | null; department?: string | null;
  category?: string | null; products_services?: string[]; aliases?: string[]; anchors?: IdentityAnchor[];
  properties?: OfficialProperty[]; sources?: IdentitySourceRef[]; verified_at: string;
}): ColombianIdentityProfile {
  const anchors = input.anchors ?? [];
  const assessment = assessIdentity(anchors);
  return {
    profile_id: `entity_${hash(`${input.account_id}:${input.verified_at}:${anchors.map((a) => a.anchor_id).sort().join(",")}`)}`,
    account_id: input.account_id, client_id: input.client_id ?? null,
    canonical_commercial_name: input.commercial_name, normalized_name: normalizeColombianCompanyName(input.commercial_name),
    legal_name: input.legal_name ?? null, nit: input.nit ?? null, verified_domain: input.verified_domain ?? null,
    alternate_verified_domains: [], official_properties: input.properties ?? [],
    city: input.city ?? null, department: input.department ?? null, country: "Colombia",
    verified_addresses: [], business_category: input.category ?? null, products_services: input.products_services ?? [],
    parent_entity: null, subsidiaries: [], branches: [], known_aliases: input.aliases ?? [],
    former_names: [], marketplace_identities: [], distributor_relationships: [],
    registry_references: [], identity_confidence: assessment.confidence, identity_state: assessment.state,
    confirmed_anchors: anchors.filter((a) => a.supports_identity),
    conflicting_anchors: anchors.filter((a) => !a.supports_identity),
    unresolved_identity_questions: assessment.missing,
    source_provenance: input.sources ?? [], last_verified_date: new Date(input.verified_at).toISOString(),
    methodology_version: COLOMBIAN_ENTITY_RESOLUTION_VERSION, internal_only: true,
  };
}

export function assessIdentity(anchors: IdentityAnchor[]): { state: IdentityState; confidence: number; missing: string[] } {
  const strongPositive = anchors.filter((a) => a.supports_identity && a.strength === "strong");
  const moderatePositive = anchors.filter((a) => a.supports_identity && a.strength === "moderate");
  const weakPositive = anchors.filter((a) => a.supports_identity && a.strength === "weak");
  const strongConflict = anchors.filter((a) => !a.supports_identity && ["strong", "conflict"].includes(a.strength));
  if (strongConflict.some((a) => a.kind === "conflicting_domain" || a.kind === "geographic_conflict" || a.kind === "category_conflict"))
    return { state: strongPositive.length ? "ambiguous" : "wrong_entity", confidence: strongPositive.length ? .45 : .95, missing: ["Resolve conflicting strong anchor."] };
  if (strongPositive.length >= 2) return { state: "confirmed", confidence: .98, missing: [] };
  if (strongPositive.length === 1 && moderatePositive.length >= 1) return { state: "confirmed", confidence: .94, missing: [] };
  if (strongPositive.length === 1) return { state: "high_confidence", confidence: .88, missing: ["Recover one reinforcing moderate or strong anchor."] };
  if (moderatePositive.length >= 2) return { state: "probable", confidence: .72, missing: ["Recover a strong domain, registry, address, phone or legal-name anchor."] };
  if (moderatePositive.length === 1 || weakPositive.length) return { state: "ambiguous", confidence: .42, missing: ["Identity has only weak/moderate evidence."] };
  return { state: "unresolved", confidence: 0, missing: ["No identity anchor recovered."] };
}

export interface IdentityNode { node_id: string; type: string; value: string; entity_scope: string; }
export interface IdentityEdge {
  edge_id: string; from_node_id: string; to_node_id: string; type: IdentityEdgeType;
  supporting_evidence: IdentitySourceRef[]; confidence: number; source: string;
  observed_at: string; review_state: "unreviewed" | "reviewed"; supersedes_edge_id: string | null;
}
export interface IdentityEvidenceGraph {
  graph_id: string; account_id: string; nodes: IdentityNode[]; edges: IdentityEdge[];
  methodology_version: string; immutable_history: true;
}
export function buildIdentityGraph(input: { account_id: string; nodes: Omit<IdentityNode, "node_id">[]; edges: Omit<IdentityEdge, "edge_id">[] }): IdentityEvidenceGraph {
  const nodes = input.nodes.map((n) => ({ ...n, node_id: `node_${hash(`${n.type}:${n.value}:${n.entity_scope}`)}` }));
  const nodeIds = new Set(nodes.map((n) => n.node_id));
  const edges = input.edges.map((e) => {
    if (!nodeIds.has(e.from_node_id) || !nodeIds.has(e.to_node_id)) throw new Error("identity_edge_references_unknown_node");
    return { ...e, edge_id: `edge_${hash(`${e.from_node_id}:${e.type}:${e.to_node_id}:${e.observed_at}`)}` };
  });
  return { graph_id: `graph_${hash(`${input.account_id}:${edges.map((e) => e.edge_id).sort().join(",")}`)}`, account_id: input.account_id, nodes, edges, methodology_version: COLOMBIAN_ENTITY_RESOLUTION_VERSION, immutable_history: true };
}

export function sourceOwnerKey(profile: ColombianIdentityProfile, property: OfficialProperty): string {
  return profile.verified_domain ?? property.source_owner_key;
}

export interface EntityCandidate {
  candidate_id: string; raw_name: string; normalized_name: NormalizedCompanyName; domain: string | null;
  relationship: RelationshipState; location: string | null; category: string | null;
  anchors: IdentityAnchor[]; decision: IdentityState; confidence: number; rejected_reason: string | null;
}
export function assessEntityCandidate(input: {
  raw_name: string; domain?: string | null; verified_domain?: string | null; relationship?: RelationshipState;
  location?: string | null; expected_city?: string | null; category?: string | null; expected_category?: string | null;
  anchors?: IdentityAnchor[];
}): EntityCandidate {
  const anchors = [...(input.anchors ?? [])];
  if (input.domain && input.verified_domain) anchors.push(identityAnchor({
    kind: domainMatches(input.domain, input.verified_domain) ? "verified_domain" : "conflicting_domain",
    value: input.domain, strength: domainMatches(input.domain, input.verified_domain) ? "strong" : "conflict",
    supports_identity: domainMatches(input.domain, input.verified_domain), confidence: .99, evidence: [],
    reason: domainMatches(input.domain, input.verified_domain) ? "Domain matches verified domain." : "Domain conflicts with verified domain.",
  }));
  if (input.location && input.expected_city && normText(input.location) !== normText(input.expected_city)) anchors.push(identityAnchor({
    kind: "geographic_conflict", value: input.location, strength: "conflict", supports_identity: false,
    confidence: .95, evidence: [], reason: "Candidate city conflicts with verified city.",
  }));
  if (input.category && input.expected_category && normText(input.category) !== normText(input.expected_category)) anchors.push(identityAnchor({
    kind: "category_conflict", value: input.category, strength: "conflict", supports_identity: false,
    confidence: .9, evidence: [], reason: "Candidate category decisively conflicts.",
  }));
  const assessment = assessIdentity(anchors);
  const relationship = input.relationship ?? "unknown";
  const separated = ["parent", "subsidiary", "branch", "franchise", "distributor", "retailer", "supplier", "marketplace_seller"].includes(relationship);
  return {
    candidate_id: `candidate_${hash(`${input.raw_name}:${input.domain ?? ""}:${relationship}`)}`,
    raw_name: input.raw_name, normalized_name: normalizeColombianCompanyName(input.raw_name),
    domain: input.domain ?? null, relationship, location: input.location ?? null, category: input.category ?? null,
    anchors, decision: separated && assessment.state === "confirmed" ? "high_confidence" : assessment.state,
    confidence: separated ? Math.min(assessment.confidence, .88) : assessment.confidence,
    rejected_reason: assessment.state === "wrong_entity" ? assessment.missing.join(" ") : null,
  };
}

export type ProviderTask = "identity_discovery" | "official_source" | "event_discovery" | "independent_source" | "extraction" | "negative_event";
export interface ProviderQuery {
  query_id: string; provider: "brave" | "tavily" | "serper"; stage: "identity" | "property" | "event" | "counterevidence";
  query: string; task: ProviderTask; requires_identity_state: IdentityState[];
}
export function planProviderQueries(input: {
  provider: "brave" | "tavily" | "serper"; stage: ProviderQuery["stage"];
  commercial_name: string; verified_domain: string | null; city: string | null; category: string | null;
  event_term?: string | null; negative_terms?: string[];
}): ProviderQuery[] {
  const q: string[] = [];
  if (input.stage === "identity") {
    if (input.provider === "brave") q.push(`"${input.commercial_name}" ${input.city ?? "Colombia"} ${input.category ?? ""}`.trim(), `"${input.commercial_name}" sitio oficial`);
    if (input.provider === "tavily") q.push(`${input.commercial_name} empresa colombiana ${input.city ?? ""} ${input.category ?? ""}`.trim());
    if (input.provider === "serper") q.push(`"${input.commercial_name}" ${input.city ?? "Colombia"}`);
  } else if (input.stage === "property") {
    q.push(`"${input.commercial_name}" Instagram`, `"${input.commercial_name}" dirección teléfono`);
  } else if (input.stage === "event") {
    if (!input.event_term) return [];
    if (input.provider === "brave") q.push(`"${input.commercial_name}" "${input.event_term}" ${input.city ?? "Colombia"}`);
    if (input.provider === "tavily") q.push(`${input.commercial_name} ${input.event_term} Colombia`, input.verified_domain ? `site:${input.verified_domain} ${input.event_term}` : "");
    if (input.provider === "serper") q.push(`"${input.commercial_name}" ${input.event_term}`);
  } else {
    q.push(`"${input.commercial_name}" ${(input.negative_terms ?? ["cierre", "inactiva", "cancelada"]).join(" ")}`);
  }
  return q.filter(Boolean).map((query) => ({
    query_id: `entityq_${hash(`${input.provider}:${input.stage}:${query}`)}`, provider: input.provider,
    stage: input.stage, query, task: input.stage === "identity" ? "identity_discovery" : input.stage === "property" ? "official_source" : input.stage === "event" ? "event_discovery" : "negative_event",
    requires_identity_state: input.stage === "event" || input.stage === "counterevidence" ? ["confirmed", "high_confidence"] : ["confirmed", "high_confidence", "probable", "ambiguous", "unresolved"],
  }));
}

export type ProviderHealthState = "configured" | "healthy" | "degraded" | "disabled" | "auth_error" | "bad_request" | "rate_limited" | "timeout" | "unknown";
export interface ProviderHealthSummary {
  provider: string; state: ProviderHealthState; last_probe: string; success_rate: number | null;
  last_error_category: string | null; supported_tasks: ProviderTask[]; automatic_fallback: boolean;
  cost_reporting: "available" | "not_available"; sanitized: true;
}
export function classifyProviderHealth(input: {
  provider: string; configured: boolean; status?: number | null; error?: string | null;
  successes: number; attempts: number; probed_at: string; supported_tasks: ProviderTask[];
}): ProviderHealthSummary {
  const message = (input.error ?? "").toLowerCase();
  const quotaBlocked = /not enough credits|quota|insufficient credit/.test(message);
  const state: ProviderHealthState = !input.configured || quotaBlocked ? "disabled"
    : input.status === 400 ? "bad_request"
      : input.status === 401 || input.status === 403 ? "auth_error"
        : input.status === 429 ? "rate_limited"
          : /timeout|aborted/.test(message) ? "timeout"
            : input.attempts && input.successes === input.attempts ? "healthy"
              : input.successes > 0 ? "degraded" : input.error ? "degraded" : "unknown";
  return {
    provider: input.provider, state, last_probe: input.probed_at,
    success_rate: input.attempts ? input.successes / input.attempts : null,
    last_error_category: state === "healthy" ? null : quotaBlocked ? "quota_or_account" : state,
    supported_tasks: input.supported_tasks,
    automatic_fallback: !["disabled", "auth_error", "bad_request"].includes(state),
    cost_reporting: "not_available", sanitized: true,
  };
}

export interface IdentityFirstExecutionPlan {
  account_id: string; identity_state: IdentityState; identity_queries: ProviderQuery[];
  event_queries: ProviderQuery[]; extraction_urls: string[]; event_extraction_urls: string[];
  stop_reason: "event_eligible" | "wrong_entity" | "unresolved_identity" | "query_budget_exhausted" | "source_access_blocked";
}
export function enforceIdentityFirstCaps(input: {
  account_id: string; identity_state: IdentityState; identity_queries: ProviderQuery[];
  event_queries: ProviderQuery[]; extraction_urls?: string[]; event_extraction_urls?: string[];
  source_access_blocked?: boolean;
}): IdentityFirstExecutionPlan {
  const identity_queries = input.identity_queries.slice(0, 5);
  const eligible = ["confirmed", "high_confidence"].includes(input.identity_state);
  const stop_reason = input.source_access_blocked ? "source_access_blocked"
    : input.identity_state === "wrong_entity" ? "wrong_entity"
      : !eligible ? "unresolved_identity"
        : input.identity_queries.length > 5 ? "query_budget_exhausted" : "event_eligible";
  return {
    account_id: input.account_id, identity_state: input.identity_state, identity_queries,
    event_queries: eligible && !input.source_access_blocked ? input.event_queries.slice(0, 3) : [],
    extraction_urls: (input.extraction_urls ?? []).slice(0, 12),
    event_extraction_urls: eligible && !input.source_access_blocked ? (input.event_extraction_urls ?? []).slice(0, 8) : [],
    stop_reason,
  };
}

export interface EventAttribution {
  attribution_id: string; account_id: string; event_id: string; identity_state: IdentityState;
  relationship: RelationshipState; state: EventAttributionState; scope: AttributionScope;
  event_subject: string; location: string | null; event_date: string | null; event_status: string;
  source_owner: string; decisive_anchors: string[]; limitations: string[];
  signal_eligible: boolean; confidence: number; methodology_version: string;
  internal_only: true; ranking_impact: "off"; report_impact: "off";
}
export function attributeEvent(input: {
  account_id: string; event_id: string; identity_state: IdentityState; relationship: RelationshipState;
  event_subject: string; scope: AttributionScope; location?: string | null; event_date?: string | null;
  event_status: string; source_owner: string; decisive_anchors?: string[];
}): EventAttribution {
  let state: EventAttributionState;
  if (input.identity_state === "wrong_entity") state = "wrong_entity";
  else if (!["confirmed", "high_confidence"].includes(input.identity_state)) state = input.identity_state === "unresolved" ? "not_attributable" : "possibly_attributed";
  else if (input.relationship === "parent") state = "parent_attributed";
  else if (input.relationship === "subsidiary") state = "subsidiary_attributed";
  else if (input.relationship === "branch") state = "branch_attributed";
  else if (["distributor", "retailer", "supplier", "marketplace_seller"].includes(input.relationship)) state = "relationship_attributed";
  else state = "directly_attributed";
  const direct = state === "directly_attributed" && input.scope === "account_wide" && !!iso(input.event_date);
  const limitations: string[] = [];
  if (!iso(input.event_date)) limitations.push("Event date is missing or invalid.");
  if (input.scope !== "account_wide") limitations.push(`Attribution scope is ${input.scope}, not account-wide.`);
  if (state !== "directly_attributed") limitations.push(`Attribution state is ${state}.`);
  return {
    attribution_id: `attr_${hash(`${input.account_id}:${input.event_id}:${state}:${input.scope}`)}`,
    account_id: input.account_id, event_id: input.event_id, identity_state: input.identity_state,
    relationship: input.relationship, state, scope: input.scope, event_subject: input.event_subject,
    location: input.location ?? null, event_date: iso(input.event_date), event_status: input.event_status,
    source_owner: input.source_owner, decisive_anchors: input.decisive_anchors ?? [],
    limitations, signal_eligible: direct, confidence: direct ? .9 : state === "wrong_entity" ? .98 : .5,
    methodology_version: COLOMBIAN_ENTITY_RESOLUTION_VERSION, internal_only: true,
    ranking_impact: "off", report_impact: "off",
  };
}

export function entityResolutionOutput(input: { type: "identity_confirmation" | "identity_ambiguity" | "wrong_entity_rejection" | "event_attribution_finding" | "verified_property" | "legal_commercial_name_linkage" | "unresolved_identity_gap"; account_id: string; refs: string[] }) {
  return { ...input, output_id: `entityout_${hash(`${input.type}:${input.account_id}:${input.refs.join(",")}`)}`, internal_only: true as const, review_state: "unreviewed" as const, ranking_impact: "off" as const, report_impact: "off" as const, methodology_version: COLOMBIAN_ENTITY_RESOLUTION_VERSION };
}
