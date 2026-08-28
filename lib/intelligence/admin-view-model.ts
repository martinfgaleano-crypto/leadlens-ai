// Intelligence OS Block 5 — server-assembled, presentation-safe Admin model.
// Provider-free: only deterministic local artifacts + optional persisted rows.

import { MIN_PATTERN_SAMPLE, type IntelligenceSnapshot, type MeasurementResult } from "./os-contracts";
import { buildIntelligenceSnapshot, type SnapshotInput } from "./snapshot-engine";
import { loadSnapshotInputs } from "./snapshot-loader";
import { loadLatestDeepEvidence, loadLatestResearchQuality, loadLatestSignalTemporal, loadLatestSignalBenchmark, loadLatestSignalMonitoringOperation, loadLatestEntityResolution, loadLatestOpportunitySynthesis, loadLatestClientContextReview, type DeepEvidenceArtifact, type ResearchQualityArtifact, type SignalTemporalArtifact, type SignalBenchmarkArtifact, type SignalMonitoringOperationArtifact, type EntityResolutionArtifact, type OpportunitySynthesisArtifact, type ClientContextReviewArtifact } from "./snapshot-loader";
import type { LearnedPreferenceSource } from "./pattern-registry";
import type { OutputValidationLifecycle } from "./validation-lifecycle";
import {
  buildCapabilityControlPlane,
  type CapabilityControlPlaneInput,
  type DynamicRecallSignals,
  type PositiveCaptureSignals,
  type IntelligenceControlPlane,
  type SoakSignals,
} from "./capability-control-plane";

export const ADMIN_INTELLIGENCE_VIEW_VERSION = "admin-intelligence-v1";

export interface FeedbackObservability {
  available: boolean;
  total_events: number | null;
  with_reason_codes: number | null;
  with_snapshot: number | null;
  with_versions: number | null;
  sentiment: { positive: number; neutral: number; negative: number; none: number } | null;
  top_reason_codes: Array<[string, number]>;
  reason: string | null;
}

export interface AdminIntelligenceAvailability {
  artifact: "available" | "unavailable";
  database: "available" | "unavailable" | "partial";
  validation_persistence: "available" | "migration_missing" | "unavailable";
  learned_preferences: "available" | "unavailable";
  message: string;
}

export interface AdminIntelligenceViewModel {
  version: string;
  generated_at: string;
  availability: AdminIntelligenceAvailability;
  snapshot: IntelligenceSnapshot;
  control_plane: IntelligenceControlPlane;
  feedback: FeedbackObservability;
  pattern_threshold: number;
  knowledge: {
    label: "Knowledge Infrastructure";
    disclaimer: string;
    verified_companies: number | null;
    probable_companies: number | null;
    excluded_candidates: number | null;
    buyer_segments: number | null;
    markets_represented: number | null;
    vault_records: number | null;
    account_memory_records: number | null;
    latest_run: string | null;
    current_artifact: string | null;
  };
  evidence: {
    availability: MeasurementResult;
    dated: number | null;
    corroborated: number | null;
    total: number | null;
    stale: number | null;
    source_classes: number | null;
    counterevidence_instrumented: boolean | null;
    explanation: string;
  };
  deep_accounts: DeepEvidenceArtifact | null;
  research_quality: ResearchQualityArtifact | null;
  signal_temporal: SignalTemporalArtifact | null;
  signal_benchmark: SignalBenchmarkArtifact | null;
  signal_monitoring_operation: SignalMonitoringOperationArtifact | null;
  entity_resolution: EntityResolutionArtifact | null;
  opportunity_synthesis: OpportunitySynthesisArtifact | null;
  client_context_review:ClientContextReviewArtifact|null;
  responsible_claims: string[];
  unsupported_claims: string[];
  empty_states: {
    patterns: string;
    outcomes: string;
    trends: string;
    lift: string;
    validation: string;
  };
}

export interface AdminIntelligenceLoadedData {
  input: SnapshotInput;
  feedback: FeedbackObservability;
  availability: AdminIntelligenceAvailability;
}

const label = (value: string): string => value.replace(/_/g, " ");

export function buildAdminIntelligenceViewModel(data: AdminIntelligenceLoadedData & { deep_accounts?: DeepEvidenceArtifact | null; research_quality?: ResearchQualityArtifact | null; signal_temporal?: SignalTemporalArtifact | null; signal_benchmark?: SignalBenchmarkArtifact | null; signal_monitoring_operation?: SignalMonitoringOperationArtifact | null; entity_resolution?: EntityResolutionArtifact | null; opportunity_synthesis?:OpportunitySynthesisArtifact|null;client_context_review?:ClientContextReviewArtifact|null; dynamic_recall?: DynamicRecallSignals | null; positive_capture?: PositiveCaptureSignals | null; soak?: SoakSignals | null; provider_usage?: CapabilityControlPlaneInput["provider_usage"] }): AdminIntelligenceViewModel {
  const snapshot = buildIntelligenceSnapshot(data.input);
  const telemetry = data.dynamic_recall;
  const controlPlane = buildCapabilityControlPlane({
    now: data.input.now,
    snapshot_capabilities: snapshot.capability_assessments,
    dynamic_recall: telemetry ?? null,
    positive_capture: data.positive_capture ?? null,
    soak: data.soak ?? null,
    monitor_sample: data.signal_temporal?.summary.accounts ?? 0,
    monitor_false_novelty: null,
    account_memory_records: data.input.knowledge.account_memory_records,
    provider_usage: data.provider_usage,
  });
  const artifact = data.input.artifact;
  const evidenceDimension = snapshot.index.dimensions.find((d) => d.id === "evidence_integrity")!;
  const corroborated = data.input.evidence?.corroborated ?? artifact?.evidence_corroborated ?? null;
  const total = data.input.evidence?.total ?? artifact?.evidence_total ?? null;
  const productionCapabilities = snapshot.capability_assessments
    .filter((c) => c.mode === "production" && c.sample_size > 0)
    .map((c) => label(c.capability_id));
  const supportedOutputs = snapshot.outputs
    .filter((o) => o.supporting_evidence.length > 0 && o.validation_state !== "refuted")
    .map((o) => o.summary);
  const unsupported = snapshot.gaps
    .filter((g) => g.status === "open" && (g.severity === "critical" || g.severity === "high"))
    .map((g) => g.impact);

  return {
    version: ADMIN_INTELLIGENCE_VIEW_VERSION,
    generated_at: data.input.now,
    availability: data.availability,
    snapshot,
    control_plane: controlPlane,
    feedback: data.feedback,
    pattern_threshold: MIN_PATTERN_SAMPLE,
    knowledge: {
      label: "Knowledge Infrastructure",
      disclaimer: "These figures show material available to the intelligence system. They do not directly determine Intelligence Maturity.",
      verified_companies: artifact?.verified ?? null,
      probable_companies: artifact?.probable ?? null,
      excluded_candidates: artifact?.excluded ?? null,
      buyer_segments: artifact?.segments ?? null,
      markets_represented: data.input.knowledge.distinct_regions || (artifact ? 1 : null),
      vault_records: data.input.knowledge.vault_companies,
      account_memory_records: data.input.knowledge.account_memory_records,
      latest_run: data.input.source_data_cutoff || null,
      current_artifact: artifact ? `market-to-account:${data.input.source_data_cutoff}` : null,
    },
    evidence: {
      availability: evidenceDimension.measurement,
      dated: data.input.evidence?.dated ?? null,
      corroborated,
      total,
      stale: data.input.evidence?.stale ?? null,
      source_classes: data.input.evidence?.source_classes ?? null,
      counterevidence_instrumented: data.input.evidence?.counterevidence_instrumented ?? null,
      explanation: corroborated === 0
        ? `0 corroborated evidence items in the current evaluated shortlist${total !== null ? ` (${total} evaluated)` : ""}.`
        : corroborated === null
          ? "Corroboration coverage is unavailable in the current environment."
          : `${corroborated} of ${total ?? "unknown"} evaluated evidence items are corroborated.`,
    },
    deep_accounts: data.deep_accounts ?? null,
    research_quality: data.research_quality ?? null,
    signal_temporal: data.signal_temporal ?? null,
    signal_benchmark: data.signal_benchmark ?? null,
    signal_monitoring_operation: data.signal_monitoring_operation ?? null,
    entity_resolution: data.entity_resolution ?? null,
    opportunity_synthesis:data.opportunity_synthesis??null,
    client_context_review:data.client_context_review??null,
    responsible_claims: Array.from(new Set([...productionCapabilities, ...supportedOutputs])).slice(0, 10),
    unsupported_claims: Array.from(new Set(unsupported)).slice(0, 10),
    empty_states: {
      patterns: snapshot.patterns.length === 0
        ? `No valid patterns yet. ${data.input.learner.preference_count} learned preferences are available; at least ${MIN_PATTERN_SAMPLE} compatible observations are required before promotion beyond insufficient_sample. Outputs do not automatically become patterns.`
        : "",
      outcomes: data.input.feedback.outcomes.filter((o) => o.kind !== "no_outcome").length < 5
        ? "Fewer than five attributable outcomes are available. Outcome Performance remains not measured or insufficient evidence."
        : "",
      trends: "Historical trends are not instrumented. Intelligence snapshots are not yet persisted over time.",
      lift: snapshot.lift.measurement.state === "not_measured"
        ? "Not measured. No generic-search or LLM baseline has been evaluated."
        : label(snapshot.lift.measurement.state),
      validation: snapshot.validation_summary.reviewed_count === 0
        ? "Outputs exist but no human review has been persisted. Review is the current validation bottleneck."
        : "",
    },
  };
}

type DbLike = {
  from(table: string): {
    select(columns: string): {
      order(column: string, options?: Record<string, unknown>): { limit(n: number): Promise<{ data: unknown[] | null; error: { message: string } | null }> };
      limit(n: number): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
};

async function safeRows(db: DbLike, table: string, columns: string, limit: number): Promise<{ rows: unknown[]; error: string | null }> {
  try {
    const result = await db.from(table).select(columns).limit(limit);
    return { rows: result.data ?? [], error: result.error?.message ?? null };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : "query failed" };
  }
}

export async function loadAdminIntelligenceViewModel(options: {
  root?: string;
  now?: string;
  db?: DbLike | null;
} = {}): Promise<AdminIntelligenceViewModel> {
  const now = options.now ?? new Date().toISOString();
  let db = options.db;
  if (db === undefined && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { createServerClient } = await import("@/lib/supabase/server");
    db = createServerClient() as unknown as DbLike | null;
  }

  let preferences: LearnedPreferenceSource[] = [];
  let lifecycles: OutputValidationLifecycle[] = [];
  let feedback: FeedbackObservability = {
    available: false, total_events: null, with_reason_codes: null, with_snapshot: null,
    with_versions: null, sentiment: null, top_reason_codes: [], reason: "Database unavailable.",
  };
  let preferenceAvailable = false;
  let validationState: AdminIntelligenceAvailability["validation_persistence"] = db ? "migration_missing" : "unavailable";
  let databaseState: AdminIntelligenceAvailability["database"] = db ? "partial" : "unavailable";

  if (db) {
    const [prefsResult, validationResult, feedbackResult] = await Promise.all([
      safeRows(db, "learned_preferences", "id,tenant_user_id,scope,monitor_id,feature_key,direction,status,strength,confidence,effective_confidence,observations,positive_obs,neutral_obs,negative_obs,distinct_report_count,last_observed_at,explanation,version,updated_at", 200),
      safeRows(db, "intelligence_validations", "id,output_id,lifecycle_snapshot,created_at", 500),
      safeRows(db, "opportunity_feedback", "id,reason_codes,normalized_sentiment,feature_snapshot,versions", 1000),
    ]);
    if (!prefsResult.error) {
      preferences = prefsResult.rows as LearnedPreferenceSource[];
      preferenceAvailable = true;
    }
    if (!validationResult.error) {
      lifecycles = validationResult.rows.flatMap((row) => {
        const value = (row as { lifecycle_snapshot?: unknown }).lifecycle_snapshot;
        return value && typeof value === "object" ? [value as OutputValidationLifecycle] : [];
      });
      validationState = "available";
    }
    if (!feedbackResult.error) {
      const rows = feedbackResult.rows as Array<{ reason_codes?: unknown; normalized_sentiment?: unknown; feature_snapshot?: unknown; versions?: unknown }>;
      const reasonCounts: Record<string, number> = {};
      const sentiment = { positive: 0, neutral: 0, negative: 0, none: 0 };
      for (const row of rows) {
        if (Array.isArray(row.reason_codes)) for (const code of row.reason_codes) if (typeof code === "string") reasonCounts[code] = (reasonCounts[code] ?? 0) + 1;
        if (row.normalized_sentiment === 1) sentiment.positive++;
        else if (row.normalized_sentiment === 0) sentiment.neutral++;
        else if (row.normalized_sentiment === -1) sentiment.negative++;
        else sentiment.none++;
      }
      feedback = {
        available: true, total_events: rows.length,
        with_reason_codes: rows.filter((r) => Array.isArray(r.reason_codes) && r.reason_codes.length > 0).length,
        with_snapshot: rows.filter((r) => Boolean(r.feature_snapshot)).length,
        with_versions: rows.filter((r) => Boolean(r.versions)).length,
        sentiment, top_reason_codes: Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 8), reason: null,
      };
    } else feedback.reason = "Feedback schema is unavailable.";
    databaseState = preferenceAvailable && validationState === "available" && feedback.available ? "available" : "partial";
  }

  const input = await loadSnapshotInputs({ root: options.root, now, learned_preferences: preferences });
  const deepAccounts = await loadLatestDeepEvidence(options.root);
  const researchQuality = await loadLatestResearchQuality(options.root);
  const signalTemporal = await loadLatestSignalTemporal(options.root);
  const signalBenchmark = await loadLatestSignalBenchmark(options.root);
  const signalMonitoringOperation = await loadLatestSignalMonitoringOperation(options.root);
  const entityResolution = await loadLatestEntityResolution(options.root);
  const opportunitySynthesis=await loadLatestOpportunitySynthesis(options.root);
  const clientContextReview=await loadLatestClientContextReview(options.root);
  const { getUsage } = await import("@/lib/ops/usage-ledger");
  const providerUsage = getUsage();
  const root = options.root ?? process.cwd();
  let dynamicRecall: DynamicRecallSignals | null = null;
  let positiveCapture: PositiveCaptureSignals | null = null;
  let soak: SoakSignals | null = null;
  try {
    const { promises: fs } = await import("node:fs");
    const path = await import("node:path");
    dynamicRecall = JSON.parse(await fs.readFile(path.join(root, "ml/data/acceptance/dynamic-universe-recall-v1.json"), "utf8")) as DynamicRecallSignals;
    try { positiveCapture = JSON.parse(await fs.readFile(path.join(root, "ml/data/acceptance/account-deep-research-positive-control-v1.json"), "utf8")) as PositiveCaptureSignals; } catch { /* optional positive retrieval evidence */ }
    try { soak = JSON.parse(await fs.readFile(path.join(root, "ml/data/acceptance/intelligence-soak-v1.json"), "utf8")) as SoakSignals; } catch { /* optional historical evidence */ }
  } catch { /* control plane labels missing acceptance evidence honestly */ }
  input.validation_lifecycles = lifecycles;
  const realOutcomes = lifecycles.flatMap((v) => v.outcomes).map((o) => ({
    id: o.id, kind: o.kind, dimension: "commercial_outcome" as const,
    observed_at: o.observed_at, evidence: o.evidence_refs.map((ref, index) => ({ id: `${o.id}:${index}`, kind: "outcome" as const, ref })),
    note: o.note,
  }));
  input.feedback.outcomes = realOutcomes;

  return buildAdminIntelligenceViewModel({
    input, feedback, deep_accounts: deepAccounts, research_quality: researchQuality, signal_temporal: signalTemporal,
    signal_benchmark: signalBenchmark, signal_monitoring_operation: signalMonitoringOperation, entity_resolution: entityResolution, opportunity_synthesis:opportunitySynthesis,client_context_review:clientContextReview,
    dynamic_recall: dynamicRecall, positive_capture: positiveCapture, soak, provider_usage: providerUsage,
    availability: {
      artifact: input.artifact ? "available" : "unavailable",
      database: databaseState,
      validation_persistence: validationState,
      learned_preferences: preferenceAvailable ? "available" : "unavailable",
      message: !db
        ? "Database-backed sections are unavailable; deterministic artifact data remains active."
        : databaseState === "available"
          ? "Artifact and database-backed intelligence are available."
          : "Some database-backed intelligence is unavailable; missing sections are labeled explicitly.",
    },
  });
}
