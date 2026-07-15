export const FEATURE_SCHEMA_VERSION = 1 as const;
export type QualityLabel = "strong"|"viable"|"weak"|"discard"|"insufficient_information"|"abstain";
export interface OpportunityFeatureSnapshot {
  schema_version: 1;
  company_key_hash: string;
  monitor_key: string;
  snapshot_at: string;
  primary_signal_type?: string | null;
  signal_types: string[];
  signal_age_days?: number | null;
  evidence_quality?: number | null;
  evidence_grounded?: boolean | null;
  normalized_industry?: string | null;
  region?: string | null;
  size_bucket?: string | null;
  soft_fit_score?: number | null;
  baseline_score?: number | null;
  baseline_rank?: number | null;
  candidate_group: string;
  demo_only: boolean;
}
export interface PredictionResult {
  model_id: string; model_version: string; probability: number; quality_score: number;
  predicted_class: "useful"|"not_useful"; uncertainty: number; out_of_distribution: boolean;
  ood_reasons: string[]; missing_features: string[]; missingness_ratio: number;
}
// REPOSITORY_MAPPING_REQUIRED
export function fromLeadLensReportToSnapshot(input: Record<string, unknown>): OpportunityFeatureSnapshot {
  throw new Error("REPOSITORY_MAPPING_REQUIRED: audit real report schema before integration");
}
