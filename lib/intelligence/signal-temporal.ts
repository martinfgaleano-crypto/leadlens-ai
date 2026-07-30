import {
  independentSourceKey,
  type CanonicalEvidence,
  type CorroborationState,
  type FreshnessState,
} from "./evidence-temporal";
import type { QualificationState } from "./research-quality";

export const SIGNAL_TEMPORAL_VERSION = "signal-temporal-v2";

export const SIGNAL_CATEGORIES = {
  growth_expansion: [
    "new_location", "geographic_expansion", "facility_opening", "capacity_expansion",
    "distribution_expansion", "channel_expansion", "market_entry", "store_opening",
    "office_opening", "operational_investment",
  ],
  commercial_activity: [
    "partnership", "distribution_agreement", "supplier_agreement", "major_customer_win",
    "product_launch", "category_expansion", "portfolio_expansion", "new_service",
    "procurement_event", "strategic_initiative",
  ],
  organizational_change: [
    "executive_hire", "leadership_change", "sales_hiring", "operations_hiring",
    "procurement_hiring", "expansion_hiring", "restructuring", "department_creation",
  ],
  financial_corporate: [
    "funding", "acquisition", "merger", "strategic_investment", "financial_pressure",
    "cost_reduction", "layoffs", "insolvency", "bankruptcy",
  ],
  negative_contradictory: [
    "closure", "cancelled_expansion", "geographic_exit", "product_discontinuation",
    "contraction", "partnership_ended", "inactivity", "wrong_entity", "stale_claim",
    "source_conflict",
  ],
  market_channel: [
    "retailer_entry", "hospitality_entry", "distributor_activity",
    "corporate_wellness_activity", "gifting_activity", "amenities_activity",
    "wholesale_activity", "channel_partner_change",
  ],
} as const;

export type SignalFamily = keyof typeof SIGNAL_CATEGORIES;
export type SignalCategory = (typeof SIGNAL_CATEGORIES)[SignalFamily][number];
export type SignalState =
  | "candidate" | "observed" | "dated" | "partially_corroborated" | "corroborated"
  | "contradicted" | "weakened" | "expired" | "stale" | "superseded" | "rejected" | "unresolved";
export type EventStatus =
  | "rumored" | "announced" | "planned" | "initiated" | "in_progress"
  | "completed" | "delayed" | "cancelled" | "contradicted" | "unknown";
export type MaterialityState = "immaterial" | "low" | "moderate" | "high" | "critical" | "insufficient_evidence";
export type TimingStateV2 =
  | "no_current_timing_evidence" | "weak_timing" | "emerging_timing" | "credible_timing"
  | "strong_timing" | "contradicted_timing" | "stale_timing" | "insufficient_evidence";
export type SignalChangeState =
  | "first_seen" | "newly_active" | "strengthened" | "weakened" | "corroborated"
  | "contradicted" | "materially_changed" | "expired" | "unchanged" | "removed" | "unresolved";
export type CounterevidenceState = "not_checked" | "none_found_bounded" | "weak" | "material" | "critical" | "unresolved";

export interface MaterialityDimensions {
  account_significance: number | null;
  commercial_relevance: number | null;
  client_relevance: number | null;
  event_magnitude: number | null;
  strategic_relevance: number | null;
  temporal_proximity: number | null;
  source_quality: number | null;
  corroboration: number | null;
  counterevidence_risk: number | null;
  likely_persistence: number | null;
}

export interface MaterialityAssessment {
  state: MaterialityState;
  dimensions: MaterialityDimensions;
  decisive_dimensions: string[];
  limitations: string[];
}

export interface SignalTemporalPolicy {
  category: SignalCategory;
  relevance_window_days: number;
  decay: "rapid" | "moderate" | "slow" | "persistent_negative";
  minimum_date_confidence: number;
  review_horizon_days: number;
  required_independent_sources: number;
  possible_negative_interpretation: string;
  expiry_behavior: "expire" | "weaken" | "retain_negative";
}

const CATEGORY_SET = new Set<string>(Object.values(SIGNAL_CATEGORIES).flat());
export const isSignalCategory = (value: string): value is SignalCategory => CATEGORY_SET.has(value);
const policy = (
  category: SignalCategory,
  relevance_window_days: number,
  decay: SignalTemporalPolicy["decay"],
  review_horizon_days: number,
  required_independent_sources = 2,
  minimum_date_confidence = .65,
  possible_negative_interpretation = "No execution evidence may weaken the event.",
  expiry_behavior: SignalTemporalPolicy["expiry_behavior"] = "weaken",
): SignalTemporalPolicy => ({
  category, relevance_window_days, decay, minimum_date_confidence, review_horizon_days,
  required_independent_sources, possible_negative_interpretation, expiry_behavior,
});

export const SIGNAL_TEMPORAL_POLICIES: Record<SignalCategory, SignalTemporalPolicy> =
  Object.fromEntries(Object.values(SIGNAL_CATEGORIES).flat().map((category) => {
    if (/hiring|procurement_event/.test(category)) return [category, policy(category, 90, "rapid", 30)];
    if (/opening|expansion|market_entry|investment/.test(category)) return [category, policy(category, 365, "slow", 60)];
    if (/launch|new_service|initiative/.test(category)) return [category, policy(category, 180, "moderate", 45)];
    if (/leadership|executive|department|restructuring/.test(category)) return [category, policy(category, 270, "moderate", 60)];
    if (/closure|exit|insolvency|bankruptcy|cancelled|discontinuation|contraction|layoffs/.test(category))
      return [category, policy(category, 730, "persistent_negative", 90, 1, .55, "Negative event may have been reversed.", "retain_negative")];
    return [category, policy(category, 180, "moderate", 60)];
  })) as Record<SignalCategory, SignalTemporalPolicy>;

export interface SignalObservation {
  signal_id: string;
  signal_key: string;
  tenant_user_id: string | null;
  client_id: string | null;
  account_id: string;
  category: SignalCategory;
  normalized_event_type: SignalCategory;
  event_statement: string;
  factual_claim_ids: string[];
  supporting_evidence_ids: string[];
  contradicting_evidence_ids: string[];
  source_independence_state: CorroborationState;
  publication_date: string | null;
  publication_date_confidence: number | null;
  effective_date: string | null;
  first_observed: string;
  last_observed: string;
  detected_at: string;
  freshness_state: FreshnessState;
  event_status: EventStatus;
  location: string | null;
  market: string | null;
  segment: string | null;
  commercial_relevance: "none" | "low" | "medium" | "high";
  client_relevance: "unknown" | "irrelevant" | "plausible" | "explicit";
  timing_relevance: "none" | "weak" | "emerging" | "credible" | "strong";
  confidence: number;
  corroboration_state: CorroborationState;
  counterevidence_state: CounterevidenceState;
  counterevidence_query: string | null;
  unresolved_questions: string[];
  materiality: MaterialityAssessment;
  expected_duration_days: number;
  expiry_date: string | null;
  current_status: SignalState;
  prior_status: SignalState | null;
  methodology_version: string;
  operational_mode: "observation";
  review_state: "unreviewed" | "reviewed";
  ranking_impact: "off";
  report_impact: "off";
}

const hash = (value: string): string => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const iso = (value: string | null | undefined): string | null =>
  value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const daysBetween = (older: string, newer: string) => Math.max(0, (Date.parse(newer) - Date.parse(older)) / 86_400_000);

export function assessSignalMateriality(dimensions: MaterialityDimensions): MaterialityAssessment {
  const known = Object.entries(dimensions).filter((x): x is [string, number] => x[1] != null);
  const limitations: string[] = [];
  if (known.length < 5) return {
    state: "insufficient_evidence", dimensions, decisive_dimensions: known.map(([k]) => k),
    limitations: ["Fewer than five materiality dimensions are evidenced."],
  };
  const positive = known.filter(([k]) => k !== "counterevidence_risk").map(([k, v]) => [k, clamp(v)] as const);
  const risk = clamp(dimensions.counterevidence_risk ?? 0);
  const high = positive.filter(([, v]) => v >= .75);
  const moderate = positive.filter(([, v]) => v >= .5);
  const commercial = dimensions.commercial_relevance ?? 0;
  const state: MaterialityState =
    risk >= .9 ? "immaterial"
      : high.length >= 5 && commercial >= .75 ? "critical"
        : high.length >= 3 && commercial >= .65 ? "high"
          : moderate.length >= 4 && commercial >= .45 ? "moderate"
            : positive.some(([, v]) => v >= .35) ? "low" : "immaterial";
  if (risk >= .6) limitations.push("Material counterevidence risk limits materiality.");
  return { state, dimensions, decisive_dimensions: [...high.map(([k]) => k), ...(risk >= .6 ? ["counterevidence_risk"] : [])], limitations };
}

export interface NormalizedEventInput {
  account_id: string;
  client_id?: string | null;
  category: string;
  event_statement: string;
  evidence: CanonicalEvidence[];
  claim_ids?: string[];
  event_status?: EventStatus;
  effective_date?: string | null;
  detected_at: string;
  location?: string | null;
  market?: string | null;
  segment?: string | null;
  commercial_relevance?: SignalObservation["commercial_relevance"];
  client_relevance?: SignalObservation["client_relevance"];
  materiality_dimensions?: Partial<MaterialityDimensions>;
  counterevidence?: CanonicalEvidence[];
  counterevidence_state?: CounterevidenceState;
  counterevidence_query?: string | null;
  prior?: SignalObservation | null;
}

export function normalizeSignalEvent(input: NormalizedEventInput): SignalObservation | null {
  if (!isSignalCategory(input.category)) return null;
  if (!input.event_statement.trim() || !input.evidence.length) return null;
  const evidence = input.evidence.filter((e) => (e.entity_match_confidence ?? 0) >= .65);
  if (!evidence.length) return null;
  const dates = evidence.map((e) => e.publication_date).filter((x): x is string => !!iso(x));
  const publication = dates.sort().at(-1) ?? null;
  const dateConfidence = evidence.filter((e) => !!e.publication_date).reduce((m, e) => Math.max(m, e.publication_date_confidence ?? .7), 0) || null;
  const independent = new Set(evidence.map(independentSourceKey)).size;
  const sourceTypes = new Set(evidence.map((e) => e.source_type ?? "unknown")).size;
  const corroboration: CorroborationState =
    independent >= 3 && sourceTypes >= 2 ? "strongly_corroborated"
      : independent >= 2 && sourceTypes >= 2 ? "corroborated"
        : independent >= 2 ? "partially_corroborated" : "single_source";
  const temporalPolicy = SIGNAL_TEMPORAL_POLICIES[input.category];
  const age = publication ? daysBetween(publication, input.detected_at) : null;
  const freshness: FreshnessState = age == null ? "unknown" : age <= temporalPolicy.relevance_window_days * .35 ? "fresh" : age <= temporalPolicy.relevance_window_days ? "recent" : "stale";
  const counter = input.counterevidence ?? [];
  const counterState = input.counterevidence_state ?? (counter.length ? "material" : "not_checked");
  const dimensions: MaterialityDimensions = {
    account_significance: null, commercial_relevance: ({ none: 0, low: .25, medium: .6, high: .9 } as const)[input.commercial_relevance ?? "low"],
    client_relevance: ({ unknown: null, irrelevant: 0, plausible: .55, explicit: .9 } as const)[input.client_relevance ?? "unknown"],
    event_magnitude: null, strategic_relevance: null,
    temporal_proximity: freshness === "fresh" ? .9 : freshness === "recent" ? .6 : freshness === "stale" ? .15 : null,
    source_quality: evidence.reduce((s, e) => s + (e.source_quality ?? .5), 0) / evidence.length,
    corroboration: independent >= 2 ? .8 : .35,
    counterevidence_risk: counterState === "critical" ? 1 : counterState === "material" ? .75 : counterState === "weak" ? .4 : counterState === "none_found_bounded" ? .1 : null,
    likely_persistence: null, ...input.materiality_dimensions,
  };
  const materiality = assessSignalMateriality(dimensions);
  const eventStatus = input.event_status ?? "unknown";
  const status: SignalState =
    counterState === "critical" || eventStatus === "contradicted" || eventStatus === "cancelled" ? "contradicted"
      : freshness === "stale" ? "stale"
        : !publication ? "observed"
          : corroboration === "corroborated" || corroboration === "strongly_corroborated" ? "corroborated"
            : corroboration === "partially_corroborated" ? "partially_corroborated" : "dated";
  const effective = iso(input.effective_date);
  const signalKey = `sigk_${hash(`${input.account_id}:${input.category}:${eventStatus}:${effective ?? publication ?? input.event_statement.toLowerCase().trim()}`)}`;
  const expiry = publication ? new Date(Date.parse(publication) + temporalPolicy.relevance_window_days * 86_400_000).toISOString() : null;
  const confidence = clamp((dimensions.source_quality ?? .5) * .45 + (dimensions.corroboration ?? 0) * .3 + (dateConfidence ?? 0) * .15 + (counterState === "none_found_bounded" ? .1 : 0) - (dimensions.counterevidence_risk ?? 0) * .35);
  return {
    signal_id: `sigo_${hash(`${signalKey}:${input.detected_at}:${evidence.map((e) => e.evidence_id).sort().join(",")}`)}`,
    signal_key: signalKey, tenant_user_id: null, client_id: input.client_id ?? null, account_id: input.account_id,
    category: input.category, normalized_event_type: input.category, event_statement: input.event_statement.trim(),
    factual_claim_ids: input.claim_ids ?? [], supporting_evidence_ids: evidence.map((e) => e.evidence_id),
    contradicting_evidence_ids: counter.map((e) => e.evidence_id), source_independence_state: corroboration,
    publication_date: publication, publication_date_confidence: dateConfidence, effective_date: effective,
    first_observed: input.prior?.first_observed ?? input.detected_at, last_observed: input.detected_at, detected_at: input.detected_at,
    freshness_state: freshness, event_status: eventStatus, location: input.location ?? null,
    market: input.market ?? null, segment: input.segment ?? null,
    commercial_relevance: input.commercial_relevance ?? "low", client_relevance: input.client_relevance ?? "unknown",
    timing_relevance: "none", confidence, corroboration_state: corroboration, counterevidence_state: counterState,
    counterevidence_query: input.counterevidence_query ?? null,
    unresolved_questions: counterState === "not_checked" ? ["Signal-specific counterevidence was not checked."] : [],
    materiality, expected_duration_days: temporalPolicy.relevance_window_days, expiry_date: expiry,
    current_status: status, prior_status: input.prior?.current_status ?? null,
    methodology_version: SIGNAL_TEMPORAL_VERSION, operational_mode: "observation", review_state: "unreviewed",
    ranking_impact: "off", report_impact: "off",
  };
}

export interface MonitoringTrigger {
  trigger_id: string; tenant_user_id: string | null; client_id: string | null; account_id: string;
  category: SignalCategory; trigger_statement: string; current_baseline: string;
  evidence_required: string[]; disconfirming_evidence: string[]; why_it_matters: string;
  client_relevance: string; expected_review_horizon_days: number; search_cadence_recommendation_days: number;
  query_templates: string[]; priority: "low" | "medium" | "high"; confidence: number;
  active_status: "active" | "paused" | "retired"; created_at: string; last_checked_at: string | null;
  next_check_at: string | null; expiry: string | null; methodology_version: string;
}

export function createMonitoringTrigger(input: {
  account_id: string; client_id?: string | null; category: SignalCategory; statement: string;
  baseline: string | null; why: string; created_at: string; verified_name: string; verified_domain: string;
  priority?: MonitoringTrigger["priority"];
}): MonitoringTrigger | null {
  if (!input.baseline || !iso(input.baseline) || !input.verified_name.trim() || !input.verified_domain.trim()) return null;
  const p = SIGNAL_TEMPORAL_POLICIES[input.category];
  return {
    trigger_id: `trg_${hash(`${input.account_id}:${input.category}:${input.statement}`)}`, tenant_user_id: null,
    client_id: input.client_id ?? null, account_id: input.account_id, category: input.category,
    trigger_statement: input.statement, current_baseline: new Date(input.baseline).toISOString(),
    evidence_required: ["entity-matched evidence", "publication or effective date", "commercially relevant event"],
    disconfirming_evidence: ["cancelled or delayed event", "wrong entity", "stale or evergreen content"],
    why_it_matters: input.why, client_relevance: "Requires explicit client-context gate.",
    expected_review_horizon_days: p.review_horizon_days, search_cadence_recommendation_days: p.review_horizon_days,
    query_templates: queryTemplates(input.category), priority: input.priority ?? "medium", confidence: .7,
    active_status: "active", created_at: input.created_at, last_checked_at: null,
    next_check_at: new Date(Date.parse(input.created_at) + p.review_horizon_days * 86_400_000).toISOString(),
    expiry: null, methodology_version: SIGNAL_TEMPORAL_VERSION,
  };
}

function queryTemplates(category: SignalCategory): string[] {
  if (/expansion|opening|location|market_entry|investment/.test(category))
    return ['"{name}" expansión', '"{name}" "nueva sede"', '"{name}" apertura {country}'];
  if (/partnership|agreement|supplier|customer|partner/.test(category))
    return ['"{name}" alianza', '"{name}" "acuerdo de distribución"', '"{name}" proveedor'];
  if (/hiring|leadership|executive|department/.test(category))
    return ['site:{domain} empleo', '"{name}" contratación', '"{name}" gerente compras'];
  if (/closure|exit|layoffs|bankruptcy|inactivity|cancelled|contraction/.test(category))
    return ['"{name}" cierre', '"{name}" canceló', '"{name}" inactiva'];
  return ['"{name}" lanzamiento', '"{name}" distribución', '"{name}" {category}'];
}

export interface MonitoringQuery {
  query_id: string; trigger_id: string; query: string; requested_from: string; requested_to: string;
  overlap_days: number; provider_date_behavior: "requested_not_guaranteed"; accepted: boolean; rejection_reason: string | null;
}

export function planMonitoringQueries(input: {
  trigger: MonitoringTrigger; verified_name: string; verified_domain: string; aliases?: string[];
  country: string; language: string; prior_source_cutoff: string | null; now: string; max_queries?: number;
}): MonitoringQuery[] {
  if (!input.prior_source_cutoff || !iso(input.prior_source_cutoff) || input.trigger.active_status !== "active") return [];
  const p = SIGNAL_TEMPORAL_POLICIES[input.trigger.category];
  const overlapDays = Math.min(7, Math.max(2, Math.round(p.review_horizon_days * .1)));
  const horizonStart = Date.parse(input.now) - p.relevance_window_days * 86_400_000;
  const overlapStart = Date.parse(input.prior_source_cutoff) - overlapDays * 86_400_000;
  const from = new Date(Math.max(horizonStart, overlapStart)).toISOString();
  const values = input.trigger.query_templates.slice(0, Math.min(input.max_queries ?? 3, 3));
  return values.map((template, index) => {
    const query = template.replaceAll("{name}", input.verified_name).replaceAll("{domain}", input.verified_domain)
      .replaceAll("{country}", input.country).replaceAll("{category}", input.trigger.category);
    const exactIdentity = query.includes(`"${input.verified_name}"`) || query.includes(`site:${input.verified_domain}`);
    const generic = query.trim().split(/\s+/).length < 2 || !exactIdentity;
    return {
      query_id: `mq_${hash(`${input.trigger.trigger_id}:${from}:${query}`)}`, trigger_id: input.trigger.trigger_id,
      query, requested_from: from, requested_to: new Date(input.now).toISOString(), overlap_days: overlapDays,
      provider_date_behavior: "requested_not_guaranteed", accepted: !generic,
      rejection_reason: generic ? "generic_or_unverified_identity" : null,
    };
  });
}

export interface SignalChange {
  change_id: string; signal_key: string | null; account_id: string; monitoring_run_id: string;
  state: SignalChangeState; prior_state: SignalState | null; current_state: SignalState | null;
  evidence_delta: { added: string[]; removed: string[] }; effective_date: string | null; detection_date: string;
  materiality: MaterialityState; commercial_interpretation: string; confidence: number; limitation: string | null;
  immutable: true; methodology_version: string;
}

export function compareSignalObservations(input: {
  account_id: string; monitoring_run_id: string; prior: SignalObservation | null;
  current: SignalObservation | null; baseline_available: boolean; detected_at: string;
}): SignalChange {
  const { prior, current } = input;
  let state: SignalChangeState;
  let limitation: string | null = null;
  if (!input.baseline_available) { state = "unresolved"; limitation = "baseline_missing"; }
  else if (!prior && current) { state = "first_seen"; limitation = "First observation is not proof of new activity."; }
  else if (prior && !current) { state = "removed"; limitation = "Absence within a bounded search is not proof that the event ceased."; }
  else if (!prior && !current) { state = "unchanged"; limitation = "No current signal found within bounded monitoring."; }
  else {
    const p = prior!, c = current!;
    const added = c.supporting_evidence_ids.filter((id) => !p.supporting_evidence_ids.includes(id));
    const independentStrength = ["corroborated", "strongly_corroborated"].includes(c.corroboration_state)
      && !["corroborated", "strongly_corroborated"].includes(p.corroboration_state);
    if (c.event_status === "cancelled" || c.current_status === "contradicted") state = "contradicted";
    else if (p.event_status !== c.event_status && ["completed", "in_progress"].includes(c.event_status)) state = "materially_changed";
    else if (independentStrength) state = "corroborated";
    else if (c.current_status === "stale" && p.current_status !== "stale") state = "weakened";
    else if (added.length && c.confidence > p.confidence + .1) state = "strengthened";
    else state = "unchanged";
  }
  const added = current?.supporting_evidence_ids.filter((id) => !prior?.supporting_evidence_ids.includes(id)) ?? [];
  const removed = prior?.supporting_evidence_ids.filter((id) => !current?.supporting_evidence_ids.includes(id)) ?? [];
  return {
    change_id: `chg_${hash(`${input.monitoring_run_id}:${prior?.signal_id ?? "none"}:${current?.signal_id ?? "none"}:${state}`)}`,
    signal_key: current?.signal_key ?? prior?.signal_key ?? null, account_id: input.account_id,
    monitoring_run_id: input.monitoring_run_id, state, prior_state: prior?.current_status ?? null,
    current_state: current?.current_status ?? null, evidence_delta: { added, removed },
    effective_date: current?.effective_date ?? current?.publication_date ?? null, detection_date: input.detected_at,
    materiality: current?.materiality.state ?? prior?.materiality.state ?? "insufficient_evidence",
    commercial_interpretation: state === "unchanged" ? "No decision-changing temporal change detected." : state === "first_seen" ? "Establishes a baseline only." : "Requires qualification gates before action.",
    confidence: current?.confidence ?? prior?.confidence ?? 0, limitation, immutable: true,
    methodology_version: SIGNAL_TEMPORAL_VERSION,
  };
}

export function assessTimingV2(input: {
  signal: SignalObservation | null; structural_relevance: "weak" | "moderate" | "strong";
  commercial_accessibility: "unknown" | "weak" | "plausible" | "clear";
}): TimingStateV2 {
  const s = input.signal;
  if (!s) return "no_current_timing_evidence";
  if (s.current_status === "contradicted" || ["critical", "material"].includes(s.counterevidence_state)) return "contradicted_timing";
  if (s.current_status === "stale" || s.freshness_state === "stale") return "stale_timing";
  if (!s.publication_date || s.publication_date_confidence == null) return "insufficient_evidence";
  const meaningful = ["moderate", "high", "critical"].includes(s.materiality.state) && ["medium", "high"].includes(s.commercial_relevance);
  const clientFit = ["plausible", "explicit"].includes(s.client_relevance);
  const corroborated = ["corroborated", "strongly_corroborated"].includes(s.corroboration_state);
  if (meaningful && clientFit && corroborated && input.commercial_accessibility === "clear" && s.event_status !== "planned") return "strong_timing";
  if (meaningful && ["plausible", "clear"].includes(input.commercial_accessibility) && s.confidence >= .55) return "credible_timing";
  if (s.current_status !== "candidate" && s.confidence >= .35) return "emerging_timing";
  return "weak_timing";
}

export interface QualificationTransition {
  transition_id: string; previous_decision: QualificationState; new_decision: QualificationState;
  reason: string; decisive_evidence: string[]; timing_state: TimingStateV2; failed_gates: string[];
  confidence: number; reviewer_state: "unreviewed"; ranking_impact: "off";
}

export function transitionQualification(input: {
  account_id: string; previous: QualificationState; timing: TimingStateV2;
  structural_relevance: "weak" | "moderate" | "strong"; client_fit: "unknown" | "weak" | "strong";
  critical_counterevidence: boolean; wrong_entity?: boolean; inactivity?: boolean;
  decisive_evidence?: string[]; clear_action?: boolean; confidence: number;
}): QualificationTransition {
  let next = input.previous;
  const failed: string[] = [];
  if (input.wrong_entity || input.inactivity || input.critical_counterevidence) next = "exclude";
  else if (input.previous === "monitor" && input.structural_relevance === "strong" && input.client_fit === "strong") next = "prioritize";
  else if (["monitor", "prioritize"].includes(input.previous) && ["emerging_timing", "credible_timing"].includes(input.timing)) next = "investigate_now";
  else if (input.previous === "investigate_now" && ["credible_timing", "strong_timing"].includes(input.timing)
    && input.client_fit === "strong" && input.clear_action && !input.critical_counterevidence) next = "act_now";
  else if (input.previous === "prioritize" && ["stale_timing", "no_current_timing_evidence"].includes(input.timing) && input.client_fit !== "strong") next = "monitor";
  if (next !== "act_now") {
    if (input.client_fit !== "strong") failed.push("strong_client_fit");
    if (!["credible_timing", "strong_timing"].includes(input.timing)) failed.push("credible_current_timing");
    if (!input.clear_action) failed.push("clear_action");
  }
  return {
    transition_id: `qtr_${hash(`${input.account_id}:${input.previous}:${next}:${input.timing}`)}`,
    previous_decision: input.previous, new_decision: next,
    reason: next === input.previous ? "No explicit transition rule passed." : `Explicit ${input.previous} → ${next} rule passed.`,
    decisive_evidence: input.decisive_evidence ?? [], timing_state: input.timing, failed_gates: failed,
    confidence: clamp(input.confidence), reviewer_state: "unreviewed", ranking_impact: "off",
  };
}

export interface MonitoringRun {
  run_id: string; client_id: string | null; source_cutoff: string; baseline_cutoff: string;
  requested_from: string; requested_to: string; query_cap: number; extraction_cap: number;
  trigger_cap_per_account: number; operational_mode: "observation"; status: "planned" | "running" | "completed" | "failed";
  provider_date_behavior: "requested_not_guaranteed"; ranking_impact: "off"; report_impact: "off";
}

export function createMonitoringRun(input: {
  client_id?: string | null; source_cutoff: string; baseline_cutoff: string; requested_from: string;
  query_cap?: number; extraction_cap?: number; trigger_cap_per_account?: number;
}): MonitoringRun {
  const queryCap = Math.min(30, Math.max(0, input.query_cap ?? 30));
  const extractionCap = Math.min(12, Math.max(0, input.extraction_cap ?? 12));
  const triggerCap = Math.min(3, Math.max(0, input.trigger_cap_per_account ?? 3));
  const key = `${input.client_id ?? "global"}:${input.baseline_cutoff}:${input.source_cutoff}:${input.requested_from}:${queryCap}:${extractionCap}:${triggerCap}`;
  return {
    run_id: `mon_${hash(key)}`, client_id: input.client_id ?? null, source_cutoff: new Date(input.source_cutoff).toISOString(),
    baseline_cutoff: new Date(input.baseline_cutoff).toISOString(), requested_from: new Date(input.requested_from).toISOString(),
    requested_to: new Date(input.source_cutoff).toISOString(), query_cap: queryCap, extraction_cap: extractionCap,
    trigger_cap_per_account: triggerCap, operational_mode: "observation", status: "planned",
    provider_date_behavior: "requested_not_guaranteed", ranking_impact: "off", report_impact: "off",
  };
}

export type TemporalOutputType =
  | "current_signal" | "signal_strengthening" | "signal_weakening" | "signal_contradiction"
  | "what_changed" | "timing_interpretation" | "monitoring_update" | "qualification_change"
  | "corroboration_recovery" | "counterevidence_finding" | "stale_signal_warning"
  | "research_gap" | "no_material_change" | "no_current_signal";

export function temporalOutput(input: {
  type: TemporalOutputType; account_id: string; signal_id?: string | null; claim_ids?: string[];
  evidence_ids?: string[]; prior_state_id?: string | null; current_state_id?: string | null;
  trigger_id?: string | null; qualification_transition_id?: string | null;
}) {
  return {
    ...input, signal_id: input.signal_id ?? null, claim_ids: input.claim_ids ?? [],
    evidence_ids: input.evidence_ids ?? [], prior_state_id: input.prior_state_id ?? null,
    current_state_id: input.current_state_id ?? null, trigger_id: input.trigger_id ?? null,
    qualification_transition_id: input.qualification_transition_id ?? null,
    internal_only: true as const, review_state: "unreviewed" as const, ranking_impact: "off" as const,
    report_impact: "off" as const, methodology_version: SIGNAL_TEMPORAL_VERSION,
  };
}
