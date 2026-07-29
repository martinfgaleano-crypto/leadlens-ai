// ─── Intelligence Pattern Registry (Block 3) ─────────────────────────────────
// Pure adapter over learned_preferences-style records. A row is an observation,
// never a production rule. Sample floors and confidence are explicit; ranking
// and report impact are permanently off in this block.

import {
  MIN_PATTERN_SAMPLE, measured, unmeasured, serializeIntelligence,
  type IntelligenceEvidenceReference, type IntelligencePattern, type IntelligenceScope,
} from "./os-contracts";

export const PATTERN_REGISTRY_VERSION = "pattern-registry-v1";

export interface LearnedPreferenceSource {
  id: string;
  tenant_user_id: string;
  monitor_id: string | null;
  feature_key: string;
  direction: "positive" | "negative" | "neutral";
  status: string;
  effective_confidence: number | null;
  observations: number;
  positive_obs: number;
  neutral_obs: number;
  negative_obs: number;
  distinct_report_count: number;
  first_observed_at: string | null;
  last_observed_at: string | null;
  explanation: string | null;
  version: number;
}

function typeFor(featureKey: string): IntelligencePattern["type"] {
  if (featureKey.startsWith("source_type.")) return "source_quality";
  if (featureKey.startsWith("freshness_bucket.")) return "timing";
  if (featureKey.startsWith("combo.")) return "cross_account";
  return "client_specific";
}

function scopeFor(p: LearnedPreferenceSource): IntelligenceScope {
  return { kind: "tenant", tenant_id: p.tenant_user_id };
}

export function adaptLearnedPreferences(preferences: LearnedPreferenceSource[]): IntelligencePattern[] {
  return preferences
    .filter((p) => p.observations > 0 && p.status !== "revoked")
    .map((p): IntelligencePattern => {
      const sample = p.positive_obs + p.negative_obs;
      const enough = sample >= MIN_PATTERN_SAMPLE;
      const confidence = enough && p.effective_confidence !== null
        ? measured(Math.round(p.effective_confidence * 100), Math.min(0.7, p.distinct_report_count / 5), sample)
        : unmeasured("insufficient_evidence", `rated sample ${sample} below floor ${MIN_PATTERN_SAMPLE}`, sample);
      const evidence: IntelligenceEvidenceReference[] = [{
        id: `preference:${p.id}`,
        kind: "feedback",
        ref: `learned_preferences:${p.id}`,
        dated: !!p.last_observed_at,
        date: p.last_observed_at,
      }];
      const feature = p.feature_key.replace(/[._]/g, " ");
      return {
        id: `pattern:learned-preference:${p.id}:v${p.version}`,
        scope: scopeFor(p),
        type: typeFor(p.feature_key),
        statement: `${p.direction} feedback tendency observed for ${feature}.`,
        explanation: p.explanation ?? `Derived from ${sample} rated observations across ${p.distinct_report_count} reports.`,
        sample_size: sample,
        state: enough ? "observation" : "insufficient_sample",
        confidence,
        evidence,
        counterexamples: p.direction === "positive" && p.negative_obs > 0 ? [`${p.negative_obs} negative observations`] :
          p.direction === "negative" && p.positive_obs > 0 ? [`${p.positive_obs} positive observations`] : [],
        exceptions: p.neutral_obs > 0 ? [`${p.neutral_obs} neutral observations`] : [],
        alternative_explanations: ["The observed tendency may reflect report mix, timing, or sparse customer feedback."],
        commercial_meaning: "Candidate preference for future validation; not a buying-intent or conversion claim.",
        recommended_response: enough ? "Keep in observation mode and request human review before any use." : "Collect more distinct rated observations.",
        ranking_impact: "off",
        report_impact: "off",
        mode: "observation",
        markets: [],
        segments: [],
        accounts: [],
        time_range: { from: p.first_observed_at, to: p.last_observed_at },
        basis: `learner-v1; rated=${sample}; reports=${p.distinct_report_count}; effective_confidence=${p.effective_confidence ?? "unmeasured"}`,
        created_at: p.first_observed_at ?? p.last_observed_at ?? "1970-01-01T00:00:00.000Z",
        last_observed: p.last_observed_at,
        review_by: null,
        version: PATTERN_REGISTRY_VERSION,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function patternRegistryFingerprint(patterns: IntelligencePattern[]): string {
  return serializeIntelligence(patterns);
}
