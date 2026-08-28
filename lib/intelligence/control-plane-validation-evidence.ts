import { createHash } from "node:crypto";

export const CONTROL_PLANE_VALIDATION_EVIDENCE_VERSION = "control-plane-validation-evidence-v1" as const;

export interface ControlPlaneValidationEvidenceV1 {
  version: typeof CONTROL_PLANE_VALIDATION_EVIDENCE_VERSION;
  evidence_id: string;
  source_type: "controlled_acceptance";
  source_fingerprint: string;
  observed_at: string;
  artifact_version: string;
  evaluator_compatibility: ["capability-control-plane-v1", "launch-readiness-v1"];
  capability_ids: string[];
  provenance: Array<{ ref: string; kind: "controlled_acceptance" | "human_review"; sha256?: string }>;
  metrics: {
    positive_capture: { captured: number; controls: number };
    human_validation: { true_positives: number; false_positives: number; false_negatives: number; true_negatives: number; customer_safe_cases: number };
    tenant_isolation: { passed: number; controls: number; real_acceptance_runs: number };
    report_safety: { passed: number; controls: number; false_successes: number; real_acceptance_runs: number };
    runtime: { recent_ms: number; historical_p95_ms: number; historical_sample: number };
    candidate_hygiene: { rejected_non_accounts: number; controls: number; leaks: number };
    provider_degradation: { passed: number; controls: number; observed_failures: number; provider_state: "normal" | "degraded" | "exhausted" | "unknown" };
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
  if (!m) errors.push("metrics are required");
  else {
    if (!validRatio(m.positive_capture?.captured, m.positive_capture?.controls)) errors.push("positive_capture ratio is invalid");
    const h = m.human_validation;
    if (!h || ![h.true_positives, h.false_positives, h.false_negatives, h.true_negatives, h.customer_safe_cases].every(finiteInt)) errors.push("human_validation counts are invalid");
    if (!validRatio(m.tenant_isolation?.passed, m.tenant_isolation?.controls) || !finiteInt(m.tenant_isolation?.real_acceptance_runs)) errors.push("tenant_isolation counts are invalid");
    if (!validRatio(m.report_safety?.passed, m.report_safety?.controls) || !finiteInt(m.report_safety?.false_successes) || !finiteInt(m.report_safety?.real_acceptance_runs)) errors.push("report_safety counts are invalid");
    if (!m.runtime || !finiteInt(m.runtime.recent_ms) || !finiteInt(m.runtime.historical_p95_ms) || !finiteInt(m.runtime.historical_sample) || m.runtime.historical_sample === 0) errors.push("runtime evidence is invalid");
    if (!validRatio(m.candidate_hygiene?.rejected_non_accounts, m.candidate_hygiene?.controls) || !finiteInt(m.candidate_hygiene?.leaks)) errors.push("candidate_hygiene counts are invalid");
    if (!validRatio(m.provider_degradation?.passed, m.provider_degradation?.controls) || !finiteInt(m.provider_degradation?.observed_failures) || !["normal", "degraded", "exhausted", "unknown"].includes(m.provider_degradation?.provider_state ?? "")) errors.push("provider_degradation counts are invalid");
  }
  if (!raw.source_fingerprint || typeof raw.source_fingerprint !== "string") errors.push("source_fingerprint is required");
  else {
    const { source_fingerprint: _ignored, ...projection } = raw as unknown as ControlPlaneValidationEvidenceV1;
    if (validationEvidenceFingerprint(projection) !== raw.source_fingerprint) errors.push("source_fingerprint does not match evidence payload");
  }
  return errors.length ? { ok: false, errors } : { ok: true, evidence: raw as unknown as ControlPlaneValidationEvidenceV1 };
}

export function dedupeValidationEvidence(values: ControlPlaneValidationEvidenceV1[]): ControlPlaneValidationEvidenceV1[] {
  const seen = new Set<string>();
  return values.filter((value) => seen.has(value.source_fingerprint) ? false : (seen.add(value.source_fingerprint), true));
}
