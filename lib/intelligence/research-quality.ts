import { assessEntityMatch, domainFromUrl, type ClientContext } from "./evidence-temporal";
import { classifySignalKind } from "@/lib/discovery/event-vs-metric";
import { classifyMateriality } from "@/lib/discovery/materiality";

export const RESEARCH_QUALITY_VERSION = "research-quality-v1";

export type ResearchGap =
  | "identity" | "official_domain" | "current_operation" | "commercial_footprint"
  | "recent_signals" | "independent_corroboration" | "counterevidence"
  | "client_relevance" | "timing" | "decision_maker_category" | "geographic_fit";
export type GapState = "resolved" | "partially_resolved" | "unresolved" | "blocked" | "not_applicable";
export type ResearchStage = "identity" | "commercial_footprint" | "current_activity" | "counterevidence" | "corroboration" | "client_relevance";
export type QueryQualityState = "strong" | "usable" | "weak" | "reject";
export type EntityState = "confirmed" | "high_confidence" | "probable" | "ambiguous" | "wrong_entity" | "unresolved";
export type SourceTier = "A" | "B" | "C" | "D";
export type QualificationState = "act_now" | "investigate_now" | "prioritize" | "monitor" | "low_priority" | "exclude";
export type GateState = "passed" | "partial" | "failed" | "not_measured" | "not_applicable";
export type CostState = { state: "measured"; usd: number } | { state: "not_measured"; reason: string };

export type ResearchReasonCode =
  | "wrong_entity" | "ambiguous_entity" | "unresolved_entity" | "generic_result"
  | "missing_publication_date" | "duplicate_source" | "syndicated_source"
  | "low_quality_source" | "weak_commercial_relevance" | "unsupported_claim"
  | "no_independent_corroboration" | "no_current_signal" | "counterevidence_not_found_bounded"
  | "provider_failure" | "extraction_failure" | "query_budget_exhausted"
  | "insufficient_query_coverage" | "query_too_broad" | "account_too_obscure"
  | "language_region_gap" | "no_client_context" | "inactive_company"
  | "outside_scope" | "severe_counterevidence" | "redundant_query"
  | "no_evidence_gap_purpose" | "retry_cap_reached" | "extraction_cap_reached";

export interface AccountResearchProfile {
  profile_id: string;
  canonical_company_name: string;
  known_aliases: string[];
  domain: string | null;
  alternate_domains: string[];
  country: string | null;
  city_or_region: string | null;
  business_type: string | null;
  segment: string | null;
  known_products_or_services: string[];
  known_locations: string[];
  parent_company: string | null;
  subsidiaries: string[];
  exclusion_terms: string[];
  ambiguity_risks: string[];
  likely_language: string | null;
  identity_confidence: number;
  structural_score: number | null;
  current_evidence_gaps: ResearchGap[];
  verified_fields: string[];
  methodology_version: string;
}

const hash = (value: string): string => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
};
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const clean = (v?: string | null): string | null => v?.trim() || null;
const terms = (v: string): string[] => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);

export function buildResearchProfile(input: {
  company: string; domain?: string | null; country?: string | null; city_or_region?: string | null;
  business_type?: string | null; segment?: string | null; structural_score?: number | null;
  verified_aliases?: string[]; verified_alternate_domains?: string[]; verified_products_or_services?: string[];
  verified_locations?: string[]; verified_parent_company?: string | null; verified_subsidiaries?: string[];
  known_evidence?: Array<{ official: boolean; entity_confidence: number; dated: boolean; independent: boolean }>;
}): AccountResearchProfile {
  const name = input.company.trim();
  const shortTokens = terms(name).filter((x) => x.length <= 3);
  const genericTokens = terms(name).filter((x) => ["natural", "saludable", "consiente", "distribuidora", "hotel", "spa", "tienda"].includes(x));
  const ambiguityRisks = [
    ...(shortTokens.length ? [`short_or_acronym_tokens:${shortTokens.join(",")}`] : []),
    ...(genericTokens.length ? [`generic_name_tokens:${genericTokens.join(",")}`] : []),
  ];
  const evidence = input.known_evidence ?? [];
  const gaps: ResearchGap[] = [];
  if (!input.domain || !evidence.some((e) => e.official && e.entity_confidence >= .9)) gaps.push("identity", "official_domain");
  if (!evidence.length) gaps.push("current_operation");
  gaps.push("commercial_footprint");
  if (!evidence.some((e) => e.dated)) gaps.push("recent_signals", "timing");
  if (!evidence.some((e) => e.independent)) gaps.push("independent_corroboration");
  gaps.push("counterevidence", "client_relevance", "decision_maker_category", "geographic_fit");
  return {
    profile_id: `rp_${hash(`${name}:${input.domain ?? ""}:${input.country ?? ""}`)}`,
    canonical_company_name: name,
    known_aliases: Array.from(new Set((input.verified_aliases ?? []).map((x) => x.trim()).filter(Boolean))),
    domain: clean(input.domain), alternate_domains: Array.from(new Set(input.verified_alternate_domains ?? [])),
    country: clean(input.country), city_or_region: clean(input.city_or_region),
    business_type: clean(input.business_type), segment: clean(input.segment),
    known_products_or_services: Array.from(new Set(input.verified_products_or_services ?? [])),
    known_locations: Array.from(new Set(input.verified_locations ?? [])),
    parent_company: clean(input.verified_parent_company), subsidiaries: Array.from(new Set(input.verified_subsidiaries ?? [])),
    exclusion_terms: ambiguityRisks.length ? ["-directorio", "-empleos genéricos", "-homónimos"] : [],
    ambiguity_risks: ambiguityRisks,
    likely_language: input.country?.toLowerCase() === "colombia" ? "es" : null,
    identity_confidence: input.domain && name ? .85 : name ? .55 : 0,
    structural_score: input.structural_score ?? null,
    current_evidence_gaps: Array.from(new Set(gaps)),
    verified_fields: [
      "canonical_company_name",
      ...(input.domain ? ["domain"] : []), ...(input.country ? ["country"] : []),
      ...(input.city_or_region ? ["city_or_region"] : []), ...(input.segment ? ["segment"] : []),
    ],
    methodology_version: RESEARCH_QUALITY_VERSION,
  };
}

export interface PlannedResearchQuery {
  query_id: string;
  account_key: string;
  stage: ResearchStage;
  query: string;
  target_gap: ResearchGap;
  target_claim_id: string | null;
  expected_source_tier: SourceTier;
  quality: QueryQualityState;
  quality_dimensions: {
    account_specificity: number; identity_discrimination: number; geographic_precision: number;
    commercial_relevance: number; temporal_relevance: number; expected_source_quality: number;
    ambiguity_risk: number; redundancy: number;
  };
  accepted: boolean;
  rejection_reasons: ResearchReasonCode[];
}

export function assessQueryQuality(input: {
  query: string; profile: AccountResearchProfile; stage: ResearchStage; target_gap?: ResearchGap | null;
  previous_queries?: string[]; expected_source_tier?: SourceTier;
}): Omit<PlannedResearchQuery, "query_id" | "account_key" | "target_claim_id"> {
  const q = input.query.trim();
  const lower = q.toLowerCase();
  const exactName = lower.includes(`"${input.profile.canonical_company_name.toLowerCase()}"`) || lower.includes(input.profile.canonical_company_name.toLowerCase());
  const domain = !!input.profile.domain && lower.includes(input.profile.domain.toLowerCase());
  const geography = !![input.profile.country, input.profile.city_or_region].filter(Boolean).some((x) => lower.includes(x!.toLowerCase()));
  const commercial = /\b(distribuci[oó]n|tiendas?|sedes?|canales?|productos?|alianza|expansi[oó]n|apertura|contrato|facility|partnership|hiring|empleo)\b/i.test(q);
  const temporal = /\b(202[4-9]|reciente|apertura|expansi[oó]n|lanzamiento|nuevo|nueva|cierre|descontinuado)\b/i.test(q);
  const identity = /\b(site:|registro|c[aá]mara de comercio|oficial|nit|ubicaci[oó]n|quienes somos)\b/i.test(q);
  const priorNormalized = (input.previous_queries ?? []).map((x) => terms(x).join(" "));
  const normalized = terms(q).join(" ");
  const redundant = priorNormalized.includes(normalized);
  const tooGeneric = !exactName && !domain;
  const noPurpose = !input.target_gap;
  const dims = {
    account_specificity: domain ? 1 : exactName ? .8 : .1,
    identity_discrimination: domain ? 1 : identity ? .85 : input.profile.ambiguity_risks.length ? .35 : .6,
    geographic_precision: geography ? 1 : input.profile.country ? .3 : 0,
    commercial_relevance: commercial ? .9 : input.stage === "identity" ? .55 : .2,
    temporal_relevance: temporal ? .9 : input.stage === "current_activity" ? .2 : .5,
    expected_source_quality: ({ A: 1, B: .8, C: .55, D: .2 } as const)[input.expected_source_tier ?? "B"],
    ambiguity_risk: tooGeneric ? 1 : input.profile.ambiguity_risks.length && !domain ? .7 : .2,
    redundancy: redundant ? 1 : 0,
  };
  const score = (dims.account_specificity + dims.identity_discrimination + dims.geographic_precision + dims.commercial_relevance + dims.temporal_relevance + dims.expected_source_quality + (1 - dims.ambiguity_risk) + (1 - dims.redundancy)) / 8;
  const rejection: ResearchReasonCode[] = [];
  if (tooGeneric) rejection.push("query_too_broad");
  if (redundant) rejection.push("redundant_query");
  if (noPurpose) rejection.push("no_evidence_gap_purpose");
  const quality: QueryQualityState = rejection.length ? "reject" : score >= .76 ? "strong" : score >= .58 ? "usable" : score >= .42 ? "weak" : "reject";
  return {
    stage: input.stage, query: q, target_gap: input.target_gap ?? "identity",
    expected_source_tier: input.expected_source_tier ?? "B", quality,
    quality_dimensions: dims, accepted: rejection.length === 0 && quality !== "reject",
    rejection_reasons: rejection,
  };
}

function candidateQueries(profile: AccountResearchProfile, context: ClientContext | null, signalTerms: string[] = []): Array<{ stage: ResearchStage; query: string; gap: ResearchGap; tier: SourceTier }> {
  const name = `"${profile.canonical_company_name}"`;
  const geo = [profile.city_or_region, profile.country].filter(Boolean).join(" ");
  const domain = profile.domain ?? "";
  const official = domain ? `site:${domain}` : "";
  const triggers = signalTerms.filter(Boolean).slice(0, 4).map((x) => `"${x.replace(/"/g, "")}"`).join(" OR ") || "apertura OR expansión OR inversión OR contrato";
  const segment = profile.segment ?? profile.business_type ?? "";
  const rows: Array<{ stage: ResearchStage; query: string; gap: ResearchGap; tier: SourceTier }> = [
    { stage: "identity", query: `${name} ${official} ${geo} sitio oficial ubicación`, gap: "identity", tier: "B" },
    { stage: "commercial_footprint", query: `${name} ${official} ${geo} ${segment} tiendas sedes distribución productos`, gap: "commercial_footprint", tier: "B" },
    { stage: "current_activity", query: `${name} ${official} ${geo} (${triggers}) 2025 2026`, gap: "recent_signals", tier: "B" },
    { stage: "counterevidence", query: `${name} ${official} ${geo} cierre inactivo contracción retiró descontinuado cancelado`, gap: "counterevidence", tier: "B" },
  ];
  if (context) rows.push({ stage: "client_relevance", query: `${name} ${domain} ${geo} ${context.offering ?? ""} ${profile.segment ?? ""}`, gap: "client_relevance", tier: "B" });
  return rows;
}

export function planAccountResearch(profile: AccountResearchProfile, context: ClientContext | null, maxQueries = 5, signalTerms: string[] = []): { accepted: PlannedResearchQuery[]; rejected: PlannedResearchQuery[] } {
  const accepted: PlannedResearchQuery[] = [], rejected: PlannedResearchQuery[] = [];
  const previous: string[] = [];
  for (const row of candidateQueries(profile, context, signalTerms).slice(0, maxQueries)) {
    const assessed = assessQueryQuality({ query: row.query, profile, stage: row.stage, target_gap: row.gap, expected_source_tier: row.tier, previous_queries: previous });
    const planned: PlannedResearchQuery = {
      ...assessed, query_id: `rq_${hash(`${profile.profile_id}:${row.stage}:${row.query}`)}`,
      account_key: profile.domain ?? profile.canonical_company_name, target_claim_id: null,
    };
    (planned.accepted ? accepted : rejected).push(planned);
    previous.push(row.query);
  }
  return { accepted, rejected };
}

export function planCorroborationQuery(profile: AccountResearchProfile, input: {
  claim_id: string; claim_statement: string; known_domain: string; known_source_tier: SourceTier;
}): PlannedResearchQuery {
  const alternative = input.known_source_tier === "B" ? "medio empresarial asociación socio registro" : "sitio oficial comunicado";
  const query = `"${profile.canonical_company_name}" "${input.claim_statement.slice(0, 80)}" ${profile.country ?? ""} ${alternative} -site:${input.known_domain}`;
  const assessed = assessQueryQuality({ query, profile, stage: "corroboration", target_gap: "independent_corroboration", expected_source_tier: input.known_source_tier === "B" ? "B" : "A" });
  return { ...assessed, query_id: `rq_${hash(`${input.claim_id}:${query}`)}`, account_key: profile.domain ?? profile.canonical_company_name, target_claim_id: input.claim_id };
}

export function sourceTier(input: { url: string; source_type?: string | null; official_domain?: string | null; publisher?: string | null }): { tier: SourceTier; reason: string } {
  const domain = domainFromUrl(input.url) ?? "";
  const official = input.official_domain && domain === input.official_domain.replace(/^www\./, "").toLowerCase();
  if (/\.(gov|gov\.co)$|rues\.org\.co|supersociedades|superfinanciera|bolsadevalores/i.test(domain) || ["regulatory", "filing"].includes(input.source_type ?? "")) return { tier: "A", reason: "institutional_or_regulatory" };
  if (official || ["official", "news", "trade_publication"].includes(input.source_type ?? "")) return { tier: "B", reason: official ? "official_company_domain" : "established_or_trade_source" };
  if (/linkedin|instagram|facebook|cotelco|camaradirecta|asociaci/i.test(domain) || ["association", "marketplace", "partner"].includes(input.source_type ?? "")) return { tier: "C", reason: "professional_association_or_official_social" };
  return { tier: "D", reason: "unverified_directory_aggregator_or_unknown" };
}

export interface EvidenceCandidate {
  url: string; canonical_url: string; title: string | null; excerpt: string | null;
  provider: string; source_type: string | null; publisher?: string | null;
  publication_date: string | null; retrieved_at: string;
}
export interface EvidenceDecision {
  decision_id: string; account_key: string; candidate: EvidenceCandidate;
  accepted: boolean; reason_codes: ResearchReasonCode[]; entity_state: EntityState;
  entity_confidence: number; source_tier: SourceTier; source_tier_reason: string;
  commercial_relevance: "high" | "medium" | "low"; date_state: "dated" | "retrieved_only";
}

export function assessEvidenceCandidate(profile: AccountResearchProfile, candidate: EvidenceCandidate, seenCanonical: Set<string>): EvidenceDecision {
  const entityConfidence = assessEntityMatch({ company: profile.canonical_company_name, domain: profile.domain, url: candidate.canonical_url, title: candidate.title, excerpt: candidate.excerpt });
  const exactDomain = !!profile.domain && domainFromUrl(candidate.canonical_url) === profile.domain;
  const entityState: EntityState = exactDomain ? "confirmed" : entityConfidence >= .9 ? "high_confidence" : entityConfidence >= .65 ? "probable" : entityConfidence >= .4 ? "ambiguous" : "wrong_entity";
  const tier = sourceTier({ url: candidate.canonical_url, source_type: candidate.source_type, official_domain: profile.domain, publisher: candidate.publisher });
  const text = `${candidate.title ?? ""} ${candidate.excerpt ?? ""}`;
  const signal = classifySignalKind(text);
  const materiality = classifyMateriality(text);
  const highCommercial = (signal.can_trigger && materiality.level !== "low")
    || /\b(apertura|abri[oó]|expansi[oó]n|expand(?:s|ed|ing)?|open(?:s|ed|ing)?|new (?:plant|facility|distribution center|production line)|alianza|lanzamiento|nueva sede|nuevo hotel|signed (?:a )?contract|won (?:a )?contract|awarded (?:a )?contract|inversi[oó]n|invest(?:s|ed|ment)|contratando|hiring|cierre|retir[oó]|descontinu)/i.test(text);
  const mediumCommercial = /\b(tiendas?|sedes?|productos?|servicios?|cobertura|ubicaci[oó]n|mayorista|spa|hotel|retail)\b/i.test(text);
  const commercial_relevance = highCommercial ? "high" : mediumCommercial ? "medium" : "low";
  const reasons: ResearchReasonCode[] = [];
  if (seenCanonical.has(candidate.canonical_url)) reasons.push("duplicate_source");
  if (entityState === "wrong_entity") reasons.push("wrong_entity");
  else if (entityState === "ambiguous") reasons.push("ambiguous_entity");
  if (tier.tier === "D") reasons.push("low_quality_source");
  if (commercial_relevance === "low") reasons.push("weak_commercial_relevance");
  if (!candidate.publication_date) reasons.push("missing_publication_date");
  const accepted = !reasons.includes("duplicate_source")
    && !reasons.includes("wrong_entity")
    && !reasons.includes("ambiguous_entity")
    && tier.tier !== "D";
  return {
    decision_id: `ed_${hash(`${profile.profile_id}:${candidate.canonical_url}`)}`,
    account_key: profile.domain ?? profile.canonical_company_name, candidate, accepted,
    reason_codes: reasons, entity_state: entityState, entity_confidence: entityConfidence,
    source_tier: tier.tier, source_tier_reason: tier.reason, commercial_relevance,
    date_state: candidate.publication_date ? "dated" : "retrieved_only",
  };
}

export interface AtomicResearchClaim {
  claim_id: string; account_key: string; category: "identity" | "commercial_footprint" | "current_activity" | "negative_event";
  statement: string; fact: string; interpretation: string | null; recommendation: null;
  evidence_decision_ids: string[]; source_domains: string[]; source_tiers: SourceTier[];
  entity_state: EntityState; publication_date: string | null; freshness: "current" | "recent" | "stale" | "unknown";
  commercial_relevance: "high" | "medium" | "low"; independent_source_count: number;
  corroboration_state: "single_source" | "corroborated" | "strongly_corroborated";
  confidence: number; uncertainty: string[];
}

const eventPatterns: Array<{ re: RegExp; label: string; category: AtomicResearchClaim["category"] }> = [
  { re: /\b(apertura|abri[oó]|nueva sede|nuevo local|new (?:location|plant|facility)|open(?:s|ed|ing)?)\b/i, label: "anunció o registra una nueva ubicación", category: "current_activity" },
  { re: /\b(expansi[oó]n|expand(?:s|ed|ing)?|crecimiento geogr[aá]fico)\b/i, label: "reporta una expansión", category: "current_activity" },
  { re: /\b(alianza|partnership|convenio|acuerdo de distribuci[oó]n)\b/i, label: "reporta una alianza o acuerdo", category: "current_activity" },
  { re: /\b(cierre|cerr[oó]|inactivo|liquidaci[oó]n|bankruptcy|descontinu)/i, label: "presenta un evento operativo negativo", category: "negative_event" },
  { re: /\b(tiendas?|sedes?|distribuidores?|mayorista|hotel|spa|productos?)\b/i, label: "mantiene una huella comercial verificable", category: "commercial_footprint" },
];

export function recoverAtomicClaims(profile: AccountResearchProfile, decisions: EvidenceDecision[], now: string): AtomicResearchClaim[] {
  const accepted = decisions.filter((d) => d.accepted && ["confirmed", "high_confidence"].includes(d.entity_state));
  const grouped = new Map<string, EvidenceDecision[]>();
  for (const decision of accepted) {
    const text = `${decision.candidate.title ?? ""} ${decision.candidate.excerpt ?? ""}`;
    const match = eventPatterns.find((x) => x.re.test(text));
    if (!match) continue;
    const key = `${match.category}:${match.label}`;
    (grouped.get(key) ?? grouped.set(key, []).get(key)!).push(decision);
  }
  return Array.from(grouped.entries()).map(([key, evidence]) => {
    const [category, label] = key.split(":") as [AtomicResearchClaim["category"], string];
    const ownerKeys = evidence.map((d) => {
      const domain = domainFromUrl(d.candidate.canonical_url);
      const accountControlled = d.entity_state === "confirmed"
        || (d.source_tier === "C" && /instagram|facebook|linkedin|youtube|tiktok/i.test(domain ?? ""));
      return accountControlled ? `account-controlled:${profile.profile_id}` : domain;
    }).filter((x): x is string => !!x);
    const domains = Array.from(new Set(ownerKeys));
    const dates = evidence.map((d) => d.candidate.publication_date).filter((x): x is string => !!x).sort().reverse();
    const date = dates[0] ?? null;
    const age = date ? Math.max(0, (Date.parse(now) - Date.parse(date)) / 86_400_000) : null;
    const independent = domains.length;
    return {
      claim_id: `rc_${hash(`${profile.profile_id}:${key}`)}`, account_key: profile.domain ?? profile.canonical_company_name,
      category, statement: `${profile.canonical_company_name} ${label}.`, fact: `${profile.canonical_company_name} ${label}.`,
      interpretation: category === "current_activity" ? "Puede justificar investigación comercial adicional; no establece intención de compra." : null,
      recommendation: null, evidence_decision_ids: evidence.map((d) => d.decision_id), source_domains: domains,
      source_tiers: Array.from(new Set(evidence.map((d) => d.source_tier))), entity_state: evidence.every((d) => d.entity_state === "confirmed") ? "confirmed" : "high_confidence",
      publication_date: date, freshness: age == null ? "unknown" : age <= 120 ? "current" : age <= 365 ? "recent" : "stale",
      commercial_relevance: category === "current_activity" || category === "negative_event" ? "high" : "medium",
      independent_source_count: independent, corroboration_state: independent >= 3 ? "strongly_corroborated" : independent >= 2 ? "corroborated" : "single_source",
      confidence: clamp(.45 + Math.min(independent, 3) * .15 + (date ? .1 : 0) + (evidence.some((d) => ["A", "B"].includes(d.source_tier)) ? .1 : 0)),
      uncertainty: [...(!date ? ["Publication date unavailable."] : []), ...(independent < 2 ? ["Independent corroboration unavailable."] : [])],
    };
  });
}

export interface QualificationGate {
  id: "identity" | "structural_relevance" | "commercial_accessibility" | "evidence" | "timing" | "counterevidence" | "client_fit" | "actionability";
  state: GateState; confidence: number | null; evidence_refs: string[]; blockers: string[]; next_verification_step: string | null;
}
export interface MonitoringTrigger {
  trigger_id: string; signal_category: string; why_it_matters: string; evidence_needed: string;
  review_horizon_days: number; current_baseline: string; confidence: number;
}
export interface AccountQualification {
  qualification_id: string; account_key: string; state: QualificationState; gates: QualificationGate[];
  passed_gates: string[]; failed_gates: string[]; decisive_evidence: string[];
  remaining_uncertainty: string[]; could_change_decision: string[];
  justified_next_action: string; unjustified_next_action: string;
  monitoring_triggers: MonitoringTrigger[]; internal_only: true; methodology_version: string;
}

const gate = (id: QualificationGate["id"], state: GateState, confidence: number | null, evidence_refs: string[], blockers: string[], next: string | null): QualificationGate =>
  ({ id, state, confidence, evidence_refs, blockers, next_verification_step: next });

export function qualifyAccount(input: {
  profile: AccountResearchProfile; claims: AtomicResearchClaim[]; decisions: EvidenceDecision[];
  context: ClientContext | null; structural_relevance: "strong" | "moderate" | "weak";
  counterevidence_checked: boolean; decision_changing_question?: string | null;
}): AccountQualification {
  const accepted = input.decisions.filter((d) => d.accepted);
  const strongIdentity = accepted.some((d) => d.entity_state === "confirmed");
  const wrongIdentity = input.decisions.length > 0 && input.decisions.every((d) => ["wrong_entity", "ambiguous"].includes(d.entity_state));
  const currentClaims = input.claims.filter((c) => c.category === "current_activity" && c.freshness === "current");
  const negative = input.claims.filter((c) => c.category === "negative_event");
  const corroborated = input.claims.filter((c) => c.independent_source_count >= 2);
  const clientConflict = !!input.context?.excluded_segments.includes(input.profile.segment ?? "");
  const clientMatch = !!input.context && (
    input.context.priority_segments.includes(input.profile.segment ?? "")
    || (!input.context.priority_segments.length && input.context.region === input.profile.country)
  );
  const gates: QualificationGate[] = [
    gate("identity", wrongIdentity ? "failed" : strongIdentity ? "passed" : accepted.length ? "partial" : "not_measured", strongIdentity ? .95 : accepted.length ? .6 : null, accepted.filter((d) => ["confirmed", "high_confidence"].includes(d.entity_state)).map((d) => d.decision_id), wrongIdentity ? ["Evidence refers to another or ambiguous entity."] : [], strongIdentity ? null : "Confirm official domain and operating identity."),
    gate("structural_relevance", input.structural_relevance === "strong" ? "passed" : input.structural_relevance === "moderate" ? "partial" : "failed", input.profile.structural_score == null ? null : input.profile.structural_score / 100, [], input.structural_relevance === "weak" ? ["Weak market/segment relevance."] : [], null),
    gate("commercial_accessibility", input.claims.some((c) => c.category === "commercial_footprint") ? "partial" : "not_measured", null, input.claims.filter((c) => c.category === "commercial_footprint").map((c) => c.claim_id), ["No verified buying path or decision-maker category."], "Verify channel and supplier onboarding path."),
    gate("evidence", corroborated.length ? "passed" : accepted.length ? "partial" : "failed", corroborated.length ? Math.max(...corroborated.map((c) => c.confidence)) : accepted.length ? .45 : 0, input.claims.map((c) => c.claim_id), corroborated.length ? [] : ["No independently corroborated commercial claim."], "Corroborate the highest-value claim with an independent source."),
    gate("timing", currentClaims.length ? "passed" : "failed", currentClaims.length ? Math.max(...currentClaims.map((c) => c.confidence)) : 0, currentClaims.map((c) => c.claim_id), currentClaims.length ? [] : ["No current dated commercial window."], "Recover a dated expansion, partnership, hiring or launch signal."),
    gate("counterevidence", negative.length ? "failed" : input.counterevidence_checked ? "passed" : "not_measured", input.counterevidence_checked ? .5 : null, negative.map((c) => c.claim_id), negative.length ? ["Material negative operating evidence found."] : [], input.counterevidence_checked ? null : "Run bounded counterevidence query."),
    gate("client_fit", clientConflict ? "failed" : clientMatch ? "passed" : input.context ? "partial" : "not_measured", clientMatch ? .8 : input.context ? .45 : null, [], clientConflict ? ["Segment explicitly excluded by client."] : !input.context ? ["Client context unavailable."] : [], input.context ? null : "Capture explicit client offer, geography and constraints."),
    gate("actionability", "not_measured", null, [], ["Derived after prerequisite gates."], null),
  ];
  const byId = Object.fromEntries(gates.map((g) => [g.id, g])) as Record<QualificationGate["id"], QualificationGate>;
  let state: QualificationState;
  if (byId.identity.state === "failed" || negative.some((c) => c.confidence >= .75) || clientConflict) state = "exclude";
  else if (strongIdentity && clientMatch && byId.timing.state === "passed" && byId.evidence.state === "passed" && byId.counterevidence.state !== "failed") state = "act_now";
  else if (strongIdentity && input.structural_relevance === "strong" && !!input.decision_changing_question && (currentClaims.length > 0 || accepted.length > 0)) state = "investigate_now";
  else if (strongIdentity && input.structural_relevance === "strong" && clientMatch && !currentClaims.length) state = "prioritize";
  else if (strongIdentity && input.structural_relevance !== "weak" && !currentClaims.length) state = "monitor";
  else state = "low_priority";
  byId.actionability.state = state === "act_now" ? "passed" : ["investigate_now", "prioritize", "monitor"].includes(state) ? "partial" : "failed";
  byId.actionability.blockers = state === "act_now" ? [] : ["No evidence-backed immediate outreach action."];
  byId.actionability.next_verification_step = state === "monitor" || state === "prioritize" ? "Watch explicit monitoring triggers." : state === "investigate_now" ? input.decision_changing_question ?? null : null;
  const triggers: MonitoringTrigger[] = ["monitor", "prioritize"].includes(state) ? [
    { trigger_id: `mt_${hash(`${input.profile.profile_id}:location`)}`, signal_category: "new_location_or_expansion", why_it_matters: "A verified footprint expansion can create a new category-entry window.", evidence_needed: "Dated official announcement plus independent or partner confirmation.", review_horizon_days: 90, current_baseline: "No current corroborated expansion signal.", confidence: .65 },
    { trigger_id: `mt_${hash(`${input.profile.profile_id}:partnership`)}`, signal_category: "distribution_or_category_partnership", why_it_matters: "A new channel or category partnership may change commercial accessibility.", evidence_needed: "Named partner, account identity, event date and operating scope.", review_horizon_days: 90, current_baseline: "No verified current partnership.", confidence: .6 },
  ] : [];
  const passed = gates.filter((g) => g.state === "passed").map((g) => g.id);
  const failed = gates.filter((g) => g.state === "failed").map((g) => g.id);
  return {
    qualification_id: `oq_${hash(`${input.profile.profile_id}:${state}:${gates.map((g) => `${g.id}:${g.state}`).join("|")}`)}`,
    account_key: input.profile.domain ?? input.profile.canonical_company_name, state, gates,
    passed_gates: passed, failed_gates: failed,
    decisive_evidence: state === "exclude" ? negative.map((c) => c.claim_id) : currentClaims.map((c) => c.claim_id),
    remaining_uncertainty: gates.flatMap((g) => g.blockers),
    could_change_decision: gates.map((g) => g.next_verification_step).filter((x): x is string => !!x),
    justified_next_action: state === "act_now" ? "Prepare human-reviewed outreach using only supported claims." : state === "investigate_now" ? input.decision_changing_question! : state === "exclude" ? "Do not pursue this entity." : state === "low_priority" ? "Defer research." : "Monitor defined triggers; do not claim buying intent.",
    unjustified_next_action: state === "act_now" ? "Automatic outreach without human review." : "Immediate sales outreach or purchase-intent claim.",
    monitoring_triggers: triggers, internal_only: true, methodology_version: RESEARCH_QUALITY_VERSION,
  };
}

export interface ResearchComparison {
  version: string; block6: Record<string, number | string | null>; block7: Record<string, number | string | null>;
  quality_changes: string[]; deterministic_key: string;
}
export function compareResearchRuns(block6: Record<string, number | string | null>, block7: Record<string, number | string | null>): ResearchComparison {
  const b6Wrong = Number(block6.wrong_entity_evidence ?? 0), b7Wrong = Number(block7.wrong_entity_evidence ?? 0);
  const b6Dated = Number(block6.dated_evidence ?? 0), b7Dated = Number(block7.dated_evidence ?? 0);
  const changes = [
    b7Wrong < b6Wrong ? "Fewer wrong-entity sources were accepted." : "Wrong-entity acceptance did not improve.",
    b7Dated > b6Dated ? "More dated evidence was recovered." : "Dated evidence did not increase.",
    Number(block7.counterevidence_checks ?? 0) > Number(block6.counterevidence_checks ?? 0) ? "Counterevidence is now checked explicitly." : "Counterevidence coverage did not improve.",
    Number(block7.qualification_coverage ?? 0) > Number(block6.qualification_coverage ?? 0) ? "All researched accounts now receive transparent qualification." : "Qualification coverage did not improve.",
  ];
  return { version: RESEARCH_QUALITY_VERSION, block6, block7, quality_changes: changes, deterministic_key: hash(JSON.stringify({ block6, block7, changes })) };
}

export function costState(value: number | null, calls: number): CostState {
  return value == null ? { state: "not_measured", reason: `${calls} provider calls executed; adapters returned no cost estimate.` } : { state: "measured", usd: Math.max(0, value) };
}

export function enforceResearchLimits(input: { accounts: number; queries: number; retries: number }, caps = { accounts: 6, queries: 24, retries: 2 }): ResearchReasonCode[] {
  return [
    ...(input.accounts > caps.accounts ? ["query_budget_exhausted" as const] : []),
    ...(input.queries > caps.queries ? ["query_budget_exhausted" as const] : []),
    ...(input.retries > caps.retries ? ["retry_cap_reached" as const] : []),
  ];
}
