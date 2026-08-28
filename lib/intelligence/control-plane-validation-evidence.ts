import { createHash } from "node:crypto";

export const CONTROL_PLANE_VALIDATION_EVIDENCE_VERSION = "control-plane-validation-evidence-v1" as const;

export interface ControlPlaneValidationEvidenceV1 {
  version: typeof CONTROL_PLANE_VALIDATION_EVIDENCE_VERSION;
  evidence_id: string;
  /** Fingerprint of an earlier observation of the same controlled sample. */
  supersedes_source_fingerprint?: string;
  source_type: "controlled_acceptance";
  source_fingerprint: string;
  observed_at: string;
  artifact_version: string;
  evaluator_compatibility: ["capability-control-plane-v1", "launch-readiness-v1"];
  capability_ids: string[];
  provenance: Array<{ ref: string; kind: "controlled_acceptance" | "human_review"; sha256?: string }>;
  // Each block is optional: a controlled acceptance measures only the domains it
  // actually exercised. An Evidence-quality review, for example, carries the
  // evidence_quality block (and the human_validation cases it confirmed) but not
  // infra blocks it never touched — an absent block is NOT_MEASURED, never a
  // fabricated 0/0. At least one recognized block must be present.
  metrics: {
    positive_capture?: { captured: number; controls: number };
    human_validation?: { true_positives: number; false_positives: number; false_negatives: number; true_negatives: number; customer_safe_cases: number };
    tenant_isolation?: { passed: number; controls: number; real_acceptance_runs: number };
    report_safety?: { passed: number; controls: number; false_successes: number; real_acceptance_runs: number };
    runtime?: { recent_ms: number; historical_p95_ms: number; historical_sample: number };
    candidate_hygiene?: { rejected_non_accounts: number; controls: number; leaks: number };
    provider_degradation?: { passed: number; controls: number; observed_failures: number; provider_state: "normal" | "degraded" | "exhausted" | "unknown" };
    // Evidence-quality relationship review. Bounded counts only; a 0-denominator
    // block is NOT measured. No score is ever ingested here.
    evidence_quality?: EvidenceQualityMetricsBlock;
  };
}

/** Bounded Evidence-relationship review counts (see lib/intelligence/evidence-quality.ts). */
export interface EvidenceQualityMetricsBlock {
  association: { correct: number; controls: number };
  grounding: { grounded: number; controls: number };
  source_quality: { adequate: number; controls: number };
  temporal_validity: { valid: number; controls: number };
  materiality: { material: number; controls: number };
  corroboration: { independent_correct: number; controls: number };
  duplicate_origin_rejected: { rejected: number; controls: number };
  counterevidence_handled: { handled: number; controls: number };
  customer_safe: { safe: number; controls: number };
  reviewed_relationships: number;
}

/** Neutral (not-measured) legacy blocks so consumers can read absent blocks safely. */
export function normalizedEvidenceMetrics(row: ControlPlaneValidationEvidenceV1): Required<Pick<ControlPlaneValidationEvidenceV1["metrics"],
  "positive_capture" | "human_validation" | "tenant_isolation" | "report_safety" | "runtime" | "candidate_hygiene" | "provider_degradation">> {
  const m = row.metrics;
  return {
    positive_capture: m.positive_capture ?? { captured: 0, controls: 0 },
    human_validation: m.human_validation ?? { true_positives: 0, false_positives: 0, false_negatives: 0, true_negatives: 0, customer_safe_cases: 0 },
    tenant_isolation: m.tenant_isolation ?? { passed: 0, controls: 0, real_acceptance_runs: 0 },
    report_safety: m.report_safety ?? { passed: 0, controls: 0, false_successes: 0, real_acceptance_runs: 0 },
    runtime: m.runtime ?? { recent_ms: 0, historical_p95_ms: 0, historical_sample: 0 },
    candidate_hygiene: m.candidate_hygiene ?? { rejected_non_accounts: 0, controls: 0, leaks: 0 },
    provider_degradation: m.provider_degradation ?? { passed: 0, controls: 0, observed_failures: 0, provider_state: "unknown" },
  };
}

type EvidenceWithoutFingerprint = Omit<ControlPlaneValidationEvidenceV1, "source_fingerprint">;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function validationEvidenceFingerprint(value: EvidenceWithoutFingerprint): string {
  const projection = { ...value, evidence_id: undefined };
  return createHash("sha256").update(canonical(projection)).digest("hex");
}

export function createControlPlaneValidationEvidence(input: EvidenceWithoutFingerprint): ControlPlaneValidationEvidenceV1 {
  return { ...input, source_fingerprint: validationEvidenceFingerprint(input) };
}

const finiteInt = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const validRatio = (numerator: unknown, denominator: unknown) => finiteInt(numerator) && finiteInt(denominator) && denominator > 0 && numerator <= denominator;
// A count-pair where the denominator MAY be 0 (0/0 = not measured, never faked).
const validPair = (numerator: unknown, denominator: unknown) => finiteInt(numerator) && finiteInt(denominator) && numerator <= denominator;

function evidenceQualityErrors(eq: unknown): string[] {
  if (!eq || typeof eq !== "object") return ["evidence_quality must be an object"];
  const q = eq as Record<string, { correct?: unknown; grounded?: unknown; adequate?: unknown; valid?: unknown; material?: unknown; independent_correct?: unknown; rejected?: unknown; handled?: unknown; safe?: unknown; controls?: unknown }> & { reviewed_relationships?: unknown };
  const pair = (block: string, numerKey: string): string[] => {
    const b = q[block] as Record<string, unknown> | undefined;
    return validPair(b?.[numerKey], b?.controls) ? [] : [`evidence_quality.${block} counts are invalid`];
  };
  return [
    ...pair("association", "correct"),
    ...pair("grounding", "grounded"),
    ...pair("source_quality", "adequate"),
    ...pair("temporal_validity", "valid"),
    ...pair("materiality", "material"),
    ...pair("corroboration", "independent_correct"),
    ...pair("duplicate_origin_rejected", "rejected"),
    ...pair("counterevidence_handled", "handled"),
    ...pair("customer_safe", "safe"),
    ...(finiteInt(q.reviewed_relationships) ? [] : ["evidence_quality.reviewed_relationships is invalid"]),
  ];
}

export function validateControlPlaneValidationEvidence(value: unknown): { ok: true; evidence: ControlPlaneValidationEvidenceV1 } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: ["evidence must be an object"] };
  const raw = value as Partial<ControlPlaneValidationEvidenceV1> & Record<string, unknown>;
  if ("readiness_score" in raw || "launch_readiness" in raw || "score" in raw) errors.push("readiness scores cannot be ingested as evidence");
  if (raw.version !== CONTROL_PLANE_VALIDATION_EVIDENCE_VERSION) errors.push("unsupported evidence version");
  if (raw.source_type !== "controlled_acceptance") errors.push("source_type must be controlled_acceptance");
  if (!raw.evidence_id || typeof raw.evidence_id !== "string") errors.push("evidence_id is required");
  if (!raw.observed_at || !Number.isFinite(Date.parse(raw.observed_at))) errors.push("observed_at must be ISO-compatible");
  if (!Array.isArray(raw.capability_ids) || raw.capability_ids.length === 0 || raw.capability_ids.some((id) => typeof id !== "string")) errors.push("capability_ids are required");
  if (!Array.isArray(raw.provenance) || raw.provenance.length === 0 || raw.provenance.some((item) => !item || typeof item.ref !== "string" || !["controlled_acceptance", "human_review"].includes(item.kind))) errors.push("provenance is required");
  const m = raw.metrics;
  if (!m || typeof m !== "object") errors.push("metrics are required");
  else {
    const present: string[] = [];
    if (m.positive_capture !== undefined) { present.push("positive_capture"); if (!validRatio(m.positive_capture?.captured, m.positive_capture?.controls)) errors.push("positive_capture ratio is invalid"); }
    if (m.human_validation !== undefined) { present.push("human_validation"); const h = m.human_validation; if (!h || ![h.true_positives, h.false_positives, h.false_negatives, h.true_negatives, h.customer_safe_cases].every(finiteInt)) errors.push("human_validation counts are invalid"); }
    if (m.tenant_isolation !== undefined) { present.push("tenant_isolation"); if (!validRatio(m.tenant_isolation?.passed, m.tenant_isolation?.controls) || !finiteInt(m.tenant_isolation?.real_acceptance_runs)) errors.push("tenant_isolation counts are invalid"); }
    if (m.report_safety !== undefined) { present.push("report_safety"); if (!validRatio(m.report_safety?.passed, m.report_safety?.controls) || !finiteInt(m.report_safety?.false_successes) || !finiteInt(m.report_safety?.real_acceptance_runs)) errors.push("report_safety counts are invalid"); }
    if (m.runtime !== undefined) { present.push("runtime"); if (!m.runtime || !finiteInt(m.runtime.recent_ms) || !finiteInt(m.runtime.historical_p95_ms) || !finiteInt(m.runtime.historical_sample) || m.runtime.historical_sample === 0) errors.push("runtime evidence is invalid"); }
    if (m.candidate_hygiene !== undefined) { present.push("candidate_hygiene"); if (!validRatio(m.candidate_hygiene?.rejected_non_accounts, m.candidate_hygiene?.controls) || !finiteInt(m.candidate_hygiene?.leaks)) errors.push("candidate_hygiene counts are invalid"); }
    if (m.provider_degradation !== undefined) { present.push("provider_degradation"); if (!validRatio(m.provider_degradation?.passed, m.provider_degradation?.controls) || !finiteInt(m.provider_degradation?.observed_failures) || !["normal", "degraded", "exhausted", "unknown"].includes(m.provider_degradation?.provider_state ?? "")) errors.push("provider_degradation counts are invalid"); }
    if (m.evidence_quality !== undefined) { present.push("evidence_quality"); errors.push(...evidenceQualityErrors(m.evidence_quality)); }
    if (present.length === 0) errors.push("metrics must contain at least one recognized block");
  }
  if (!raw.source_fingerprint || typeof raw.source_fingerprint !== "string") errors.push("source_fingerprint is required");
  else {
    const { source_fingerprint: _ignored, ...projection } = raw as unknown as ControlPlaneValidationEvidenceV1;
    if (validationEvidenceFingerprint(projection) !== raw.source_fingerprint) errors.push("source_fingerprint does not match evidence payload");
  }
  if (raw.supersedes_source_fingerprint !== undefined && (!/^[a-f0-9]{64}$/.test(raw.supersedes_source_fingerprint) || raw.supersedes_source_fingerprint === raw.source_fingerprint)) errors.push("supersedes_source_fingerprint is invalid");
  return errors.length ? { ok: false, errors } : { ok: true, evidence: raw as unknown as ControlPlaneValidationEvidenceV1 };
}

export function dedupeValidationEvidence(values: ControlPlaneValidationEvidenceV1[]): ControlPlaneValidationEvidenceV1[] {
  const seen = new Set<string>();
  const unique = values.filter((value) => seen.has(value.source_fingerprint) ? false : (seen.add(value.source_fingerprint), true));
  const superseded = new Set(unique.map((value) => value.supersedes_source_fingerprint).filter((value): value is string => Boolean(value)));
  return unique.filter((value) => !superseded.has(value.source_fingerprint));
}
