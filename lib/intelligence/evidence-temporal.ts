import { canonicalizeUrl } from "@/lib/sources/access/provider-contract";

export const EVIDENCE_TEMPORAL_VERSION = "evidence-temporal-v1";

export type EvidenceScope = "account" | "market" | "segment";
export type EvidenceRelation = "supports" | "contradicts" | "context";
export type DateState = "exact" | "inferred" | "retrieved_only" | "conflicting" | "invalid" | "unknown";
export type ClaimCategory = "identity" | "structural_fit" | "commercial_signal" | "timing" | "risk" | "client_relevance" | "other";
export type CorroborationState =
  | "unsupported" | "single_source" | "partially_corroborated" | "corroborated"
  | "strongly_corroborated" | "contradicted" | "stale" | "unresolved";
export type FreshnessState = "fresh" | "recent" | "stale" | "unknown";

export interface CanonicalEvidenceInput {
  evidence_id?: string;
  scope: EvidenceScope;
  scope_key: string;
  url: string;
  publisher?: string | null;
  source_type?: string | null;
  provider?: string | null;
  provider_result_id?: string | null;
  title?: string | null;
  excerpt?: string | null;
  claim_text?: string | null;
  claim_type?: ClaimCategory | null;
  publication_date?: string | null;
  publication_date_state?: DateState;
  publication_date_confidence?: number | null;
  retrieved_at: string;
  verified_at?: string | null;
  language?: string | null;
  country?: string | null;
  entity_match?: string | null;
  entity_match_confidence?: number | null;
  source_quality?: number | null;
  duplicate_cluster_id?: string | null;
  syndicated_from?: string | null;
  contradiction_group_id?: string | null;
  extraction_method?: string | null;
  methodology_version?: string;
  raw_reference?: string | null;
  supersedes_evidence_id?: string | null;
}

export interface CanonicalEvidence extends CanonicalEvidenceInput {
  evidence_id: string;
  canonical_url: string;
  domain: string | null;
  publisher: string | null;
  source_type: string | null;
  provider: string | null;
  provider_result_id: string | null;
  title: string | null;
  excerpt: string | null;
  claim_text: string | null;
  claim_type: ClaimCategory | null;
  publication_date: string | null;
  publication_date_state: DateState;
  publication_date_confidence: number | null;
  verified_at: string | null;
  language: string | null;
  country: string | null;
  entity_match: string | null;
  entity_match_confidence: number | null;
  source_quality: number | null;
  duplicate_cluster_id: string;
  syndicated_from: string | null;
  contradiction_group_id: string | null;
  extraction_method: string | null;
  methodology_version: string;
  raw_reference: string | null;
  supersedes_evidence_id: string | null;
}

export interface ClaimEvidenceLink {
  evidence: CanonicalEvidence;
  relation: EvidenceRelation;
  semantic_compatibility?: number;
  time_compatible?: boolean;
}

export interface ClaimAssessment {
  claim_id: string;
  scope: EvidenceScope;
  scope_key: string;
  category: ClaimCategory;
  statement: string;
  time_scope: { valid_from: string | null; valid_until: string | null };
  links: ClaimEvidenceLink[];
  independent_source_count: number;
  source_diversity: number;
  support_count: number;
  contradiction_count: number;
  confidence: number;
  freshness: FreshnessState;
  corroboration_state: CorroborationState;
  prior_claim_id: string | null;
  change_reason: string | null;
  methodology_version: string;
}

const hash = (value: string): string => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
};
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const validIso = (value: string | null | undefined): boolean => !!value && Number.isFinite(Date.parse(value));

export function domainFromUrl(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}

const normalizedWords = (value: string): string[] => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter((w) => w.length > 2);
export function assessEntityMatch(input: { company: string; domain: string | null; url: string; title?: string | null; excerpt?: string | null }): number {
  if (input.domain && domainFromUrl(input.url) === input.domain.toLowerCase().replace(/^www\./, "")) return .99;
  const haystack = normalizedWords(`${input.title ?? ""} ${input.excerpt ?? ""}`);
  const needle = normalizedWords(input.company);
  if (!needle.length || !haystack.length) return 0;
  const matched = needle.filter((word) => haystack.includes(word)).length / needle.length;
  if (matched === 1) return .9;
  if (needle.length >= 2 && matched >= .67) return .72;
  return .25;
}

export function resolveDateState(input: {
  publication_date?: string | null; inferred?: boolean; conflict?: boolean; retrieved_at?: string | null;
}): DateState {
  if (input.conflict) return "conflicting";
  if (input.publication_date && !validIso(input.publication_date)) return "invalid";
  if (input.publication_date) return input.inferred ? "inferred" : "exact";
  if (validIso(input.retrieved_at)) return "retrieved_only";
  return "unknown";
}

export function canonicalizeEvidence(input: CanonicalEvidenceInput): CanonicalEvidence {
  const canonical_url = canonicalizeUrl(input.url);
  const duplicateKey = input.duplicate_cluster_id
    ?? input.syndicated_from
    ?? `${domainFromUrl(canonical_url) ?? "unknown"}:${canonical_url}`;
  return {
    ...input,
    evidence_id: input.evidence_id ?? `ev_${hash(`${input.scope}:${input.scope_key}:${canonical_url}:${input.provider_result_id ?? ""}`)}`,
    canonical_url,
    domain: domainFromUrl(canonical_url),
    publisher: input.publisher ?? null,
    source_type: input.source_type ?? null,
    provider: input.provider ?? null,
    provider_result_id: input.provider_result_id ?? null,
    title: input.title ?? null,
    excerpt: input.excerpt ?? null,
    claim_text: input.claim_text ?? null,
    claim_type: input.claim_type ?? null,
    publication_date: validIso(input.publication_date) ? new Date(input.publication_date!).toISOString() : null,
    publication_date_state: input.publication_date_state ?? resolveDateState(input),
    publication_date_confidence: input.publication_date_confidence == null ? null : clamp(input.publication_date_confidence),
    verified_at: input.verified_at ?? null,
    language: input.language ?? null,
    country: input.country ?? null,
    entity_match: input.entity_match ?? null,
    entity_match_confidence: input.entity_match_confidence == null ? null : clamp(input.entity_match_confidence),
    source_quality: input.source_quality == null ? null : clamp(input.source_quality),
    duplicate_cluster_id: `dup_${hash(duplicateKey)}`,
    syndicated_from: input.syndicated_from ?? null,
    contradiction_group_id: input.contradiction_group_id ?? null,
    extraction_method: input.extraction_method ?? null,
    methodology_version: input.methodology_version ?? EVIDENCE_TEMPORAL_VERSION,
    raw_reference: input.raw_reference ?? null,
    supersedes_evidence_id: input.supersedes_evidence_id ?? null,
  };
}

const FRESH_DAYS: Record<ClaimCategory, [number, number]> = {
  identity: [365, 1460], structural_fit: [180, 730], commercial_signal: [30, 120],
  timing: [21, 90], risk: [60, 240], client_relevance: [90, 365], other: [90, 365],
};

export function evidenceAgeDays(evidence: CanonicalEvidence, now: string): number | null {
  if (!evidence.publication_date || !validIso(now)) return null;
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(evidence.publication_date)) / 86_400_000));
}

export function assessFreshness(category: ClaimCategory, evidence: CanonicalEvidence[], now: string): FreshnessState {
  const ages = evidence.map((e) => evidenceAgeDays(e, now)).filter((v): v is number => v !== null);
  if (!ages.length) return "unknown";
  const youngest = Math.min(...ages);
  const [fresh, recent] = FRESH_DAYS[category];
  return youngest <= fresh ? "fresh" : youngest <= recent ? "recent" : "stale";
}

export function independentSourceKey(evidence: CanonicalEvidence): string {
  if (evidence.syndicated_from) return `syndicated:${evidence.syndicated_from}`;
  return evidence.publisher?.trim().toLowerCase() || evidence.domain || evidence.duplicate_cluster_id;
}

export function deduplicateEvidence(evidence: CanonicalEvidence[]): CanonicalEvidence[] {
  const selected = new Map<string, CanonicalEvidence>();
  for (const item of evidence) {
    const key = item.syndicated_from ? `syndicated:${item.syndicated_from}` : item.duplicate_cluster_id;
    const prior = selected.get(key);
    const quality = (item.source_quality ?? 0) + (item.publication_date ? 0.1 : 0);
    const priorQuality = (prior?.source_quality ?? 0) + (prior?.publication_date ? 0.1 : 0);
    if (!prior || quality > priorQuality) selected.set(key, item);
  }
  return Array.from(selected.values());
}

export function assessClaim(input: {
  claim_id?: string; scope: EvidenceScope; scope_key: string; category: ClaimCategory;
  statement: string; links: ClaimEvidenceLink[]; now: string;
  valid_from?: string | null; valid_until?: string | null; prior_claim_id?: string | null;
  change_reason?: string | null;
}): ClaimAssessment {
  const compatible = input.links.filter((l) =>
    (l.semantic_compatibility ?? 1) >= 0.65
    && l.time_compatible !== false
    && (l.evidence.entity_match_confidence ?? 1) >= 0.65);
  const support = deduplicateEvidence(compatible.filter((l) => l.relation === "supports").map((l) => l.evidence));
  const contradict = deduplicateEvidence(compatible.filter((l) => l.relation === "contradicts").map((l) => l.evidence));
  const independent = new Set(support.map(independentSourceKey)).size;
  const sourceClasses = new Set(support.map((e) => e.source_type ?? "unknown")).size;
  const freshness = assessFreshness(input.category, support, input.now);
  const averageQuality = support.length ? support.reduce((s, e) => s + (e.source_quality ?? 0.5), 0) / support.length : 0;
  let state: CorroborationState;
  if (contradict.length && support.length) state = "contradicted";
  else if (contradict.length) state = "contradicted";
  else if (!support.length) state = "unsupported";
  else if (freshness === "stale" && ["timing", "commercial_signal"].includes(input.category)) state = "stale";
  else if (independent === 1) state = "single_source";
  else if (independent === 2 && sourceClasses < 2) state = "partially_corroborated";
  else if (independent === 2) state = "corroborated";
  else if (independent >= 3 && sourceClasses >= 2) state = "strongly_corroborated";
  else state = "partially_corroborated";
  const confidence = clamp(
    averageQuality * 0.45
    + Math.min(independent, 3) / 3 * 0.35
    + (freshness === "fresh" ? 0.2 : freshness === "recent" ? 0.12 : freshness === "unknown" ? 0.04 : 0)
    - Math.min(contradict.length * 0.25, 0.5),
  );
  return {
    claim_id: input.claim_id ?? `cl_${hash(`${input.scope}:${input.scope_key}:${input.category}:${input.statement}`)}`,
    scope: input.scope, scope_key: input.scope_key, category: input.category, statement: input.statement,
    time_scope: { valid_from: input.valid_from ?? null, valid_until: input.valid_until ?? null },
    links: input.links, independent_source_count: independent, source_diversity: sourceClasses,
    support_count: support.length, contradiction_count: contradict.length, confidence, freshness,
    corroboration_state: state, prior_claim_id: input.prior_claim_id ?? null,
    change_reason: input.change_reason ?? null, methodology_version: EVIDENCE_TEMPORAL_VERSION,
  };
}

export interface ClientContext {
  client_id: string;
  region: string | null;
  offering: string | null;
  objective: string | null;
  priority_segments: string[];
  excluded_segments: string[];
  explicit_constraints: string[];
  unknown_fields: string[];
  captured_at: string;
}

export function buildClientContext(input: Partial<Omit<ClientContext, "unknown_fields">> & { client_id: string; captured_at: string }): ClientContext {
  const required = ["region", "offering", "objective"] as const;
  return {
    client_id: input.client_id,
    region: input.region?.trim() || null,
    offering: input.offering?.trim() || null,
    objective: input.objective?.trim() || null,
    priority_segments: input.priority_segments ?? [],
    excluded_segments: input.excluded_segments ?? [],
    explicit_constraints: input.explicit_constraints ?? [],
    unknown_fields: required.filter((key) => !input[key]?.trim()),
    captured_at: input.captured_at,
  };
}

export type TimingState = "current_opportunity" | "monitor" | "structural_only" | "insufficient_evidence" | "contradicted";
export function deriveTimingState(claims: ClaimAssessment[]): TimingState {
  const timing = claims.filter((c) => c.category === "timing" || c.category === "commercial_signal");
  if (timing.some((c) => c.corroboration_state === "contradicted")) return "contradicted";
  if (timing.some((c) => ["corroborated", "strongly_corroborated"].includes(c.corroboration_state) && c.freshness === "fresh")) return "current_opportunity";
  if (timing.some((c) => c.support_count > 0 && ["fresh", "recent"].includes(c.freshness))) return "monitor";
  if (claims.some((c) => c.category === "structural_fit" && c.support_count > 0)) return "structural_only";
  return "insufficient_evidence";
}

export interface AccountStateInput {
  account_key: string; client_id: string | null; observed_at: string;
  claims: ClaimAssessment[]; structural_score: number | null; dossier_version?: string;
}
export interface MaterialChange {
  field: string; state: "not_measured" | "added" | "removed" | "increased" | "decreased" | "changed";
  before: unknown; after: unknown; reason: string;
}
export interface AccountState extends AccountStateInput {
  state_id: string; fingerprint: string; timing_state: TimingState;
  corroborated_claims: number; contradicted_claims: number; material_changes: MaterialChange[];
  methodology_version: string;
}

function stateProjection(input: AccountStateInput) {
  return {
    structural_score: input.structural_score,
    timing_state: deriveTimingState(input.claims),
    corroborated_claims: input.claims.filter((c) => ["corroborated", "strongly_corroborated"].includes(c.corroboration_state)).length,
    contradicted_claims: input.claims.filter((c) => c.corroboration_state === "contradicted").length,
    claim_states: input.claims.map((c) => `${c.claim_id}:${c.corroboration_state}`).sort(),
  };
}

export function compareAccountStates(previous: AccountState | null, current: AccountStateInput): MaterialChange[] {
  const after = stateProjection(current);
  if (!previous) return [{ field: "account_state", state: "not_measured", before: null, after, reason: "First comparable account observation." }];
  const changes: MaterialChange[] = [];
  if (previous.timing_state !== after.timing_state) changes.push({ field: "timing_state", state: "changed", before: previous.timing_state, after: after.timing_state, reason: "Timing evidence state changed." });
  if (after.corroborated_claims !== previous.corroborated_claims) changes.push({ field: "corroborated_claims", state: after.corroborated_claims > previous.corroborated_claims ? "increased" : "decreased", before: previous.corroborated_claims, after: after.corroborated_claims, reason: "Independent corroboration count changed." });
  if (after.contradicted_claims !== previous.contradicted_claims) changes.push({ field: "contradicted_claims", state: after.contradicted_claims > previous.contradicted_claims ? "increased" : "decreased", before: previous.contradicted_claims, after: after.contradicted_claims, reason: "Contradiction count changed." });
  if (current.structural_score != null && previous.structural_score != null && Math.abs(current.structural_score - previous.structural_score) >= 5) changes.push({ field: "structural_score", state: current.structural_score > previous.structural_score ? "increased" : "decreased", before: previous.structural_score, after: current.structural_score, reason: "Structural score moved by at least five points." });
  return changes;
}

export function buildAccountState(input: AccountStateInput, previous: AccountState | null = null): AccountState {
  const projection = stateProjection(input);
  const fingerprint = hash(JSON.stringify({ account_key: input.account_key, client_id: input.client_id, ...projection }));
  return {
    ...input, ...projection, fingerprint, state_id: `as_${hash(`${input.account_key}:${input.client_id ?? "global"}:${fingerprint}`)}`,
    material_changes: compareAccountStates(previous, input), methodology_version: EVIDENCE_TEMPORAL_VERSION,
  };
}

export interface AccountDossier {
  dossier_id: string; account_key: string; client_id: string | null; generated_at: string;
  identity: { name: string; domain: string | null; country: string | null };
  structural: { score: number | null; segment: string | null; rationale: string[] };
  evidence: { total: number; independent_sources: number; corroborated_claims: number; contradicted_claims: number };
  temporal: { timing_state: TimingState; what_changed: MaterialChange[] };
  commercial: { client_relevance: "explicit_match" | "explicit_conflict" | "not_assessed"; rationale: string[] };
  decision: { state: "research_more" | "monitor" | "review_candidate"; reason: string };
  confidence: number; limitations: string[]; internal_only: true; methodology_version: string;
}

export function buildAccountDossier(input: {
  name: string; domain: string | null; country: string | null; segment: string | null;
  state: AccountState; context: ClientContext | null;
}): AccountDossier {
  const evidence = deduplicateEvidence(input.state.claims.flatMap((c) => c.links.map((l) => l.evidence)));
  const sources = new Set(evidence.map(independentSourceKey)).size;
  const explicitConflict = !!input.context?.excluded_segments.includes(input.segment ?? "");
  const explicitMatch = !!input.context?.priority_segments.includes(input.segment ?? "");
  const highEnough = input.state.corroborated_claims > 0 && input.state.contradicted_claims === 0;
  const decision = highEnough ? "review_candidate" : input.state.timing_state === "monitor" ? "monitor" : "research_more";
  const limitations: string[] = [];
  if (!input.context) limitations.push("Client context unavailable; client relevance not assessed.");
  else if (input.context.unknown_fields.length) limitations.push(`Unknown client fields: ${input.context.unknown_fields.join(", ")}.`);
  if (!evidence.some((e) => e.publication_date)) limitations.push("No exact or inferred publication date in available evidence.");
  if (!input.state.corroborated_claims) limitations.push("No independently corroborated claim.");
  return {
    dossier_id: `dos_${hash(`${input.state.state_id}:${input.context?.client_id ?? "global"}`)}`,
    account_key: input.state.account_key, client_id: input.state.client_id, generated_at: input.state.observed_at,
    identity: { name: input.name, domain: input.domain, country: input.country },
    structural: { score: input.state.structural_score, segment: input.segment, rationale: input.state.claims.filter((c) => c.category === "structural_fit").map((c) => c.statement) },
    evidence: { total: evidence.length, independent_sources: sources, corroborated_claims: input.state.corroborated_claims, contradicted_claims: input.state.contradicted_claims },
    temporal: { timing_state: input.state.timing_state, what_changed: input.state.material_changes },
    commercial: { client_relevance: explicitConflict ? "explicit_conflict" : explicitMatch ? "explicit_match" : "not_assessed", rationale: explicitConflict ? ["Segment explicitly excluded."] : explicitMatch ? ["Segment explicitly prioritized."] : [] },
    decision: { state: decision, reason: decision === "review_candidate" ? "At least one independently corroborated claim; requires human review." : decision === "monitor" ? "Recent single-source or partial evidence; monitor before action." : "Evidence is insufficient for account action." },
    confidence: input.state.claims.length ? clamp(input.state.claims.reduce((s, c) => s + c.confidence, 0) / input.state.claims.length) : 0,
    limitations, internal_only: true, methodology_version: EVIDENCE_TEMPORAL_VERSION,
  };
}
