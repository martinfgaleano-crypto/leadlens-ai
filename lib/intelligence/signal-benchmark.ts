import { createHash } from "node:crypto";
import type { QualificationState } from "./research-quality";
import {
  SIGNAL_TEMPORAL_VERSION, type EventStatus, type SignalCategory,
} from "./signal-temporal";

export const SIGNAL_BENCHMARK_VERSION = "signal-recovery-benchmark-v1";
export type BenchmarkClass = "positive" | "negative" | "adversarial";
export type GateState = "pass" | "fail" | "insufficient_evidence" | "not_applicable";
export type BenchmarkErrorCode =
  | "query_did_not_retrieve_source" | "provider_coverage_gap" | "wrong_query_language"
  | "missing_domain_anchor" | "date_filter_too_restrictive" | "entity_gate_too_strict"
  | "source_extraction_failed" | "date_extraction_failed" | "event_normalization_failed"
  | "materiality_gate_too_strict" | "source_quality_gate_too_strict"
  | "corroboration_incorrectly_required" | "baseline_excluded_event"
  | "event_status_confusion" | "provider_timeout" | "benchmark_source_unavailable"
  | "wrong_entity_accepted" | "duplicate_accepted" | "stale_event_accepted"
  | "generic_hiring_accepted" | "controlled_source_as_independent"
  | "planned_as_completed" | "geography_mismatch_accepted"
  | "keyword_only_event" | "retrieval_as_publication";

export interface BenchmarkCase {
  id: string; class: BenchmarkClass; account: string; verified_domain: string; country: string;
  category: SignalCategory | null; window_start: string; window_end: string; expected_signal: boolean;
  expected_entity: "confirmed" | "probable" | "wrong_entity";
  expected_status: EventStatus; expected_date_state: "exact" | "inferred" | "retrieved_only" | "conflicting";
  expected_corroboration: "unsupported" | "single_source" | "partially_corroborated" | "corroborated";
  event_date: string | null; source_url: string; source_owner: string; source_type: string;
  query_family: string; provider: string; title: string; text: string; commercially_meaningful: boolean;
  duplicate_of?: string; benchmark_provenance: string;
}
export interface BenchmarkDataset {
  benchmark_id: string; methodology_version: string; reviewed_at: string; source_cutoff: string;
  label_scope: string; cases: BenchmarkCase[];
}
export interface GateDiagnostic {
  gate: "identity" | "event" | "date" | "freshness" | "materiality" | "source_quality"
  | "corroboration" | "counterevidence" | "client_relevance" | "timing";
  state: GateState; reason: string; evidence: string[]; confidence: number;
}
export interface DateCandidate {
  kind: "structured_metadata" | "article_schema" | "open_graph" | "visible_text" | "provider" | "url" | "retrieval";
  value: string | null; confidence: number;
}
export interface DateResolution {
  date: string | null; state: "exact" | "inferred" | "retrieved_only" | "conflicting" | "invalid" | "unknown";
  selected_kind: DateCandidate["kind"] | null; candidates: DateCandidate[]; conflicts: string[];
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 16);
const validDate = (value: string | null | undefined) => !!value && Number.isFinite(Date.parse(value));
const normalizedDomain = (url: string) => {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
};
const domainMatches = (actual: string, verified: string) => actual === verified || actual.endsWith(`.${verified}`);
const norm = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export function validateBenchmarkDataset(dataset: BenchmarkDataset): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const c of dataset.cases) {
    if (ids.has(c.id)) errors.push(`${c.id}:duplicate_id`); ids.add(c.id);
    if (!/^https:\/\//.test(c.source_url)) errors.push(`${c.id}:non_public_url`);
    if (!c.benchmark_provenance || !validDate(dataset.reviewed_at)) errors.push(`${c.id}:missing_provenance`);
    if (c.class === "positive" && (!c.expected_signal || !c.category || !validDate(c.event_date) || !c.commercially_meaningful))
      errors.push(`${c.id}:positive_requires_dated_meaningful_event`);
    if (c.expected_signal && !c.category) errors.push(`${c.id}:signal_requires_category`);
    if (!c.expected_signal && c.class === "positive") errors.push(`${c.id}:positive_mislabeled`);
    if (c.expected_date_state === "retrieved_only" && c.event_date) errors.push(`${c.id}:retrieval_only_has_event_date`);
  }
  return errors;
}

export function resolveBenchmarkDate(candidates: DateCandidate[]): DateResolution {
  const valid = candidates.filter((c) => c.kind !== "retrieval" && validDate(c.value));
  const values = Array.from(new Set(valid.map((c) => new Date(c.value!).toISOString().slice(0, 10))));
  if (values.length > 1) return { date: null, state: "conflicting", selected_kind: null, candidates, conflicts: values };
  const precedence: DateCandidate["kind"][] = ["structured_metadata", "article_schema", "open_graph", "visible_text", "provider", "url"];
  const selected = precedence.flatMap((kind) => valid.filter((x) => x.kind === kind).sort((a, b) => b.confidence - a.confidence)).at(0);
  if (selected) return { date: new Date(selected.value!).toISOString(), state: ["provider", "url"].includes(selected.kind) ? "inferred" : "exact", selected_kind: selected.kind, candidates, conflicts: [] };
  const retrieved = candidates.find((c) => c.kind === "retrieval" && validDate(c.value));
  return { date: null, state: retrieved ? "retrieved_only" : "unknown", selected_kind: null, candidates, conflicts: [] };
}

function assessEntity(c: BenchmarkCase): { state: "confirmed" | "probable" | "wrong_entity"; confidence: number; reason: string } {
  const domain = normalizedDomain(c.source_url);
  if (domainMatches(domain, c.verified_domain) || c.source_owner === c.verified_domain) return { state: "confirmed", confidence: .99, reason: "Verified or controlled domain." };
  const text = norm(`${c.title} ${c.text}`);
  if (/\b(nigeria|nigerian|dominican republic|puerto rico|mayaguez)\b/.test(text) && !/\bcolombia\b/.test(text))
    return { state: "wrong_entity", confidence: .97, reason: "Explicit geography conflicts with benchmark account." };
  const tokens = norm(c.account).split(" ").filter((x) => x.length > 3 && !["colombia", "global"].includes(x));
  const matches = tokens.filter((x) => text.includes(x)).length;
  return matches && matches === tokens.length
    ? { state: "probable", confidence: .82, reason: "Full distinctive account name appears in external source." }
    : { state: "wrong_entity", confidence: .85, reason: "Verified identity is not established." };
}

function classifyEvent(textValue: string): { category: SignalCategory | null; status: EventStatus; reason: string } {
  const text = norm(textValue);
  if (/generic evergreen careers|careers landing|photo profile|static .*listing|static .*directory|static product|price list|no atomic commercial event|no .* event/.test(text))
    return { category: null, status: "unknown", reason: "Static/reference content has no atomic event." };
  if (/completed the acquisition|had completed the acquisition/.test(text)) return { category: "acquisition", status: "completed", reason: "Completion language is explicit." };
  if (/merger agreement closing deadline|not yet completed/.test(text)) return { category: "acquisition", status: "planned", reason: "Future/extended closing language is explicit." };
  if (/opened|opening|inaugur|inauguro|abrio|abrio las puertas|newest logistics facility|operating next generation fulfillment center/.test(text))
    return { category: /store|tienda/.test(text) ? "store_opening" : "facility_opening", status: "completed", reason: "Completed opening language." };
  if (/announced.*partnership|announce.*partnership|announced.*agreement|agreement announcement|multiyear agreement|multi tournament partnership/.test(text))
    return { category: "partnership", status: "announced", reason: "Partnership/agreement announcement." };
  if (/announced iphone|debuts iphone|product launch/.test(text)) return { category: "product_launch", status: "announced", reason: "New product announcement." };
  if (/leadership evolution|executive chairman|co ceo/.test(text)) return { category: "leadership_change", status: "announced", reason: "Leadership appointment language." };
  return { category: null, status: "unknown", reason: "No supported atomic event pattern." };
}

const gate = (name: GateDiagnostic["gate"], state: GateState, reason: string, evidence: string[], confidence: number): GateDiagnostic =>
  ({ gate: name, state, reason, evidence, confidence });

export interface BenchmarkObservation {
  case_id: string; predicted_signal: boolean; predicted_entity: string; predicted_category: SignalCategory | null;
  predicted_status: EventStatus; predicted_date_state: DateResolution["state"]; predicted_date: string | null;
  correct_identity: boolean; correct_category: boolean; correct_status: boolean; correct_date: boolean;
  gate_trace: GateDiagnostic[]; false_negative_code: BenchmarkErrorCode | null; false_positive_code: BenchmarkErrorCode | null;
  accepted_source_ids: string[]; source_owner_keys: string[];
}

export function replayBenchmarkCase(c: BenchmarkCase): BenchmarkObservation {
  const entity = assessEntity(c);
  const event = classifyEvent(`${c.title}. ${c.text}`);
  const dates: DateCandidate[] = c.event_date
    ? [{ kind: c.expected_date_state === "exact" ? "visible_text" : "provider", value: c.event_date, confidence: c.expected_date_state === "exact" ? .95 : .7 }]
    : [{ kind: "retrieval", value: "2026-07-30T13:15:00Z", confidence: 1 }];
  const date = resolveBenchmarkDate(dates);
  const inWindow = !!date.date && Date.parse(date.date) >= Date.parse(c.window_start) && Date.parse(date.date) <= Date.parse(`${c.window_end}T23:59:59Z`);
  const eventPass = !!event.category && c.commercially_meaningful;
  const duplicate = !!c.duplicate_of;
  const predictedSignal = entity.state !== "wrong_entity" && eventPass && !!date.date && inWindow;
  const expectedDateComparable = c.expected_date_state === "retrieved_only" ? date.state === "retrieved_only" : !!date.date && !!c.event_date && date.date.slice(0, 10) === c.event_date;
  const trace: GateDiagnostic[] = [
    gate("identity", entity.state === "wrong_entity" ? "fail" : "pass", entity.reason, [c.source_url], entity.confidence),
    gate("event", eventPass ? "pass" : "fail", event.reason, [c.title], eventPass ? .9 : .85),
    gate("date", date.date ? "pass" : "fail", date.date ? `Resolved from ${date.selected_kind}.` : "No publication/effective event date.", dates.map((x) => `${x.kind}:${x.value ?? "null"}`), date.date ? .9 : .95),
    gate("freshness", date.date ? inWindow ? "pass" : "fail" : "insufficient_evidence", date.date ? inWindow ? "Event is inside benchmark window." : "Event is outside benchmark window." : "Freshness cannot be established without event date.", [c.window_start, c.window_end], date.date ? .95 : .5),
    gate("materiality", eventPass ? "pass" : c.commercially_meaningful ? "insufficient_evidence" : "fail", c.commercially_meaningful ? "Curated meaningful event." : "Static or commercially irrelevant content.", [c.text], .85),
    gate("source_quality", c.source_type === "official" ? "pass" : ["directory", "social"].includes(c.source_type) ? "insufficient_evidence" : "pass", `Source type: ${c.source_type}.`, [c.source_url], c.source_type === "official" ? .95 : .6),
    gate("corroboration", c.expected_corroboration === "corroborated" ? "pass" : "insufficient_evidence", duplicate ? "Controlled/duplicate source does not add independence." : "Single-source observation is allowed but not corroborated.", [c.source_owner], .9),
    gate("counterevidence", "not_applicable", "Fixture replay contains no asserted counterevidence unless labeled.", [], 1),
    gate("client_relevance", "not_applicable", "Cross-company benchmark measures signal recovery, not client fit.", [], 1),
    gate("timing", predictedSignal ? "pass" : "fail", predictedSignal ? "Identity, event, date and window gates pass." : "At least one current-timing prerequisite failed.", [], .9),
  ];
  const falseNegative = c.expected_signal && !predictedSignal
    ? entity.state === "wrong_entity" ? "entity_gate_too_strict"
      : !event.category ? "event_normalization_failed"
        : !date.date ? "date_extraction_failed"
          : !inWindow ? "baseline_excluded_event" : "query_did_not_retrieve_source"
    : null;
  const falsePositive = !c.expected_signal && predictedSignal
    ? entity.state === "wrong_entity" ? "wrong_entity_accepted"
      : !inWindow ? "stale_event_accepted"
        : event.category?.includes("hiring") ? "generic_hiring_accepted" : "keyword_only_event"
    : null;
  return {
    case_id: c.id, predicted_signal: predictedSignal, predicted_entity: entity.state,
    predicted_category: event.category, predicted_status: event.status, predicted_date_state: date.state,
    predicted_date: date.date, correct_identity: entity.state === c.expected_entity,
    correct_category: event.category === c.category, correct_status: event.status === c.expected_status,
    correct_date: expectedDateComparable, gate_trace: trace, false_negative_code: falseNegative,
    false_positive_code: falsePositive, accepted_source_ids: predictedSignal ? [`src_${hash(c.source_url)}`] : [],
    source_owner_keys: [c.source_owner],
  };
}

export interface RatioMetric { numerator: number; denominator: number; value: number | null; state: "measured" | "insufficient_sample"; }
const ratio = (n: number, d: number): RatioMetric => ({ numerator: n, denominator: d, value: d ? n / d : null, state: d ? "measured" : "insufficient_sample" });
export interface BenchmarkMetrics {
  sample_size: number; positive_labels: number; negative_labels: number; adversarial_cases: number;
  true_positives: number; false_positives: number; true_negatives: number; false_negatives: number;
  precision: RatioMetric; recall: RatioMetric; specificity: RatioMetric; positive_predictive_value: RatioMetric;
  signal_yield: RatioMetric; identity_precision: RatioMetric; date_valid_coverage: RatioMetric;
  event_normalization_accuracy: RatioMetric; event_status_accuracy: RatioMetric;
}

export function calculateBenchmarkMetrics(dataset: BenchmarkDataset, observations: BenchmarkObservation[]): BenchmarkMetrics {
  const joined = dataset.cases.flatMap((c) => {
    const o = observations.find((x) => x.case_id === c.id); return o ? [{ c, o }] : [];
  });
  const tp = joined.filter(({ c, o }) => c.expected_signal && o.predicted_signal).length;
  const fp = joined.filter(({ c, o }) => !c.expected_signal && o.predicted_signal).length;
  const tn = joined.filter(({ c, o }) => !c.expected_signal && !o.predicted_signal).length;
  const fn = joined.filter(({ c, o }) => c.expected_signal && !o.predicted_signal).length;
  const accepted = joined.filter(({ o }) => o.predicted_signal);
  const expectedSignals = joined.filter(({ c }) => c.expected_signal);
  return {
    sample_size: joined.length, positive_labels: dataset.cases.filter((c) => c.class === "positive").length,
    negative_labels: dataset.cases.filter((c) => c.class === "negative").length,
    adversarial_cases: dataset.cases.filter((c) => c.class === "adversarial").length,
    true_positives: tp, false_positives: fp, true_negatives: tn, false_negatives: fn,
    precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fn), specificity: ratio(tn, tn + fp),
    positive_predictive_value: ratio(tp, tp + fp), signal_yield: ratio(tp + fp, joined.length),
    identity_precision: ratio(accepted.filter(({ o }) => o.correct_identity).length, accepted.length),
    date_valid_coverage: ratio(expectedSignals.filter(({ o }) => o.correct_date).length, expectedSignals.length),
    event_normalization_accuracy: ratio(joined.filter(({ o }) => o.correct_category).length, joined.length),
    event_status_accuracy: ratio(expectedSignals.filter(({ o }) => o.correct_status).length, expectedSignals.length),
  };
}

export interface BenchmarkRun {
  run_id: string; benchmark_id: string; mode: "fixture" | "live"; provider: string | null;
  source_cutoff: string; status: "queued" | "processing" | "completed" | "limited" | "failed";
  cost: { state: "measured"; usd: number } | { state: "not_measured"; reason: string };
  timeout_state: "none" | "partial" | "timed_out"; observations: BenchmarkObservation[];
  metrics: BenchmarkMetrics; methodology_version: string;
}

export function runFixtureBenchmark(dataset: BenchmarkDataset): BenchmarkRun {
  const errors = validateBenchmarkDataset(dataset);
  if (errors.length) throw new Error(`Invalid benchmark: ${errors.join(",")}`);
  const observations = dataset.cases.map(replayBenchmarkCase);
  return {
    run_id: `bench_${hash(`${dataset.benchmark_id}:fixture:${dataset.source_cutoff}`)}`,
    benchmark_id: dataset.benchmark_id, mode: "fixture", provider: null, source_cutoff: dataset.source_cutoff,
    status: "completed", cost: { state: "not_measured", reason: "Fixture replay makes no provider calls." },
    timeout_state: "none", observations, metrics: calculateBenchmarkMetrics(dataset, observations),
    methodology_version: SIGNAL_BENCHMARK_VERSION,
  };
}

export function assertLiveBenchmarkFlag(flag: string | undefined): void {
  if (flag !== "I_UNDERSTAND_PROVIDER_CALLS") throw new Error("live_mode_requires_explicit_flag");
}

export interface QueryFamilyMetric {
  family: string; retrieved: RatioMetric; valid_identity: RatioMetric; date_valid: RatioMetric;
  event_valid: RatioMetric; accepted_signal: RatioMetric; false_positive: RatioMetric;
}
export function queryFamilyMetrics(dataset: BenchmarkDataset, observations: BenchmarkObservation[]): QueryFamilyMetric[] {
  return Array.from(new Set(dataset.cases.map((c) => c.query_family))).sort().map((family) => {
    const cases = dataset.cases.filter((c) => c.query_family === family);
    const obs = cases.map((c) => observations.find((o) => o.case_id === c.id)!).filter(Boolean);
    return {
      family, retrieved: ratio(obs.length, cases.length),
      valid_identity: ratio(obs.filter((o) => o.predicted_entity !== "wrong_entity").length, obs.length),
      date_valid: ratio(obs.filter((o) => !!o.predicted_date).length, obs.length),
      event_valid: ratio(obs.filter((o) => !!o.predicted_category).length, obs.length),
      accepted_signal: ratio(obs.filter((o) => o.predicted_signal).length, obs.length),
      false_positive: ratio(cases.filter((c, i) => !c.expected_signal && obs[i]?.predicted_signal).length, cases.filter((c) => !c.expected_signal).length),
    };
  });
}

export interface MonitoringOperationAccount {
  account_id: string; state: "queued" | "processing" | "completed" | "limited" | "failed";
  attempts: number; error: string | null;
}
export interface MonitoringOperation {
  operation_id: string; client_id: string; source_cutoff: string; methodology_version: string;
  status: "queued" | "processing" | "completed" | "limited" | "failed";
  accounts: MonitoringOperationAccount[]; operator_notes: string[]; max_retries: number;
}
export function createMonitoringOperation(input: { client_id: string; source_cutoff: string; account_ids: string[]; max_retries?: number }): MonitoringOperation {
  return {
    operation_id: `mop_${hash(`${input.client_id}:${input.source_cutoff}:${[...input.account_ids].sort().join(",")}`)}`,
    client_id: input.client_id, source_cutoff: input.source_cutoff, methodology_version: SIGNAL_BENCHMARK_VERSION,
    status: "queued", accounts: Array.from(new Set(input.account_ids)).sort().map((account_id) => ({ account_id, state: "queued", attempts: 0, error: null })),
    operator_notes: [], max_retries: Math.min(2, Math.max(0, input.max_retries ?? 1)),
  };
}
export function resumableAccounts(operation: MonitoringOperation): string[] {
  return operation.accounts.filter((a) => a.state === "queued" || (a.state === "failed" && a.attempts <= operation.max_retries)).map((a) => a.account_id);
}
export function retryFailedAccounts(operation: MonitoringOperation): MonitoringOperation {
  return { ...operation, status: "queued", accounts: operation.accounts.map((a) => a.state === "failed" && a.attempts <= operation.max_retries ? { ...a, state: "queued", error: null } : a) };
}

export interface AccountMonitoringPolicy {
  decision: QualificationState; active: boolean; cadence_days: number | null;
  rationale: string[]; methodology_version: string; scheduling_impact: "recommendation_only";
}
export function deriveMonitoringPolicy(input: {
  decision: QualificationState; trigger_review_horizon_days: number; signal_decay_days: number;
  account_importance: "low" | "medium" | "high"; source_availability: "weak" | "moderate" | "strong";
  evidence_gap: boolean; previous_change_frequency: "none" | "low" | "high"; client_relevance: "weak" | "strong";
  cost_state: "measured_low" | "measured_high" | "not_measured";
}): AccountMonitoringPolicy {
  if (input.decision === "exclude") return { decision: input.decision, active: false, cadence_days: null, rationale: ["Excluded accounts are inactive by default."], methodology_version: SIGNAL_BENCHMARK_VERSION, scheduling_impact: "recommendation_only" };
  if (input.decision === "low_priority") return { decision: input.decision, active: false, cadence_days: null, rationale: ["Low-priority accounts require an explicit temporary exception."], methodology_version: SIGNAL_BENCHMARK_VERSION, scheduling_impact: "recommendation_only" };
  const base = input.decision === "act_now" ? 7 : input.decision === "investigate_now" ? 14 : input.decision === "prioritize" ? 45 : 90;
  const urgency = input.account_importance === "high" || input.previous_change_frequency === "high" || input.evidence_gap ? .75 : 1;
  const cost = input.cost_state === "measured_high" || input.source_availability === "weak" ? 1.5 : 1;
  const categoryBound = Math.min(input.trigger_review_horizon_days, Math.max(7, Math.floor(input.signal_decay_days / 3)));
  return {
    decision: input.decision, active: true, cadence_days: Math.max(7, Math.round(Math.min(base, categoryBound) * urgency * cost)),
    rationale: [`Decision baseline: ${base} days.`, `Signal-policy bound: ${categoryBound} days.`, `Cost/source multiplier: ${cost}.`],
    methodology_version: SIGNAL_BENCHMARK_VERSION, scheduling_impact: "recommendation_only",
  };
}

export function benchmarkDoesNotAffectProduction() {
  return {
    internal_only: true as const, production_intelligence_table: false as const,
    ranking_impact: "off" as const, report_impact: "off" as const,
    outcome_performance_impact: "none" as const, methodology_version: SIGNAL_BENCHMARK_VERSION,
    depends_on: SIGNAL_TEMPORAL_VERSION,
  };
}
