from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator

QualityLabel = Literal['strong','viable','weak','discard','insufficient_information','abstain']
WeakLabel = Literal['positive','negative','abstain']

class OpportunityFeatureSnapshot(BaseModel):
    model_config = ConfigDict(extra='forbid')
    schema_version: int = 1
    company_key_hash: str = Field(min_length=8)
    monitor_key: str
    snapshot_at: datetime
    primary_signal_type: str | None = None
    signal_types: list[str] = []
    signal_age_days: float | None = None
    freshest_signal_age_days: float | None = None
    oldest_signal_age_days: float | None = None
    dated_signal_ratio: float | None = Field(default=None, ge=0, le=1)
    fresh_signal_count: int = Field(default=0, ge=0)
    recent_signal_count: int = Field(default=0, ge=0)
    stale_signal_count: int = Field(default=0, ge=0)
    source_count: int = Field(default=0, ge=0)
    independent_source_count: int = Field(default=0, ge=0)
    official_source_present: bool | None = None
    primary_source_present: bool | None = None
    reputable_media_present: bool | None = None
    evidence_grounded: bool | None = None
    evidence_quality: float | None = Field(default=None, ge=0, le=1)
    evidence_completeness: float | None = Field(default=None, ge=0, le=1)
    contradiction_count: int = Field(default=0, ge=0)
    claim_count: int = Field(default=0, ge=0)
    cited_claim_ratio: float | None = Field(default=None, ge=0, le=1)
    dated_claim_ratio: float | None = Field(default=None, ge=0, le=1)
    provenance_completeness: float | None = Field(default=None, ge=0, le=1)
    rights_allowed: bool | None = None
    coverage_limited: bool | None = None
    unsupported_claim_count: int = Field(default=0, ge=0)
    normalized_industry: str | None = None
    region: str | None = None
    country: str | None = None
    size_bucket: str | None = None
    growth_stage: str | None = None
    public_private_status: str | None = None
    geographic_footprint_count: int | None = Field(default=None, ge=0)
    b2b_indicator: bool | None = None
    saas_indicator: bool | None = None
    multi_region_indicator: bool | None = None
    industry_match: float | None = Field(default=None, ge=0, le=1)
    region_match: float | None = Field(default=None, ge=0, le=1)
    size_match: float | None = Field(default=None, ge=0, le=1)
    use_case_match: float | None = Field(default=None, ge=0, le=1)
    keyword_overlap: float | None = Field(default=None, ge=0, le=1)
    matched_criteria_count: int = Field(default=0, ge=0)
    unmatched_criteria_count: int = Field(default=0, ge=0)
    hard_gate_violation_count: int = Field(default=0, ge=0)
    soft_fit_score: float | None = Field(default=None, ge=0, le=1)
    fit_confidence: float | None = Field(default=None, ge=0, le=1)
    signal_combo_keys: list[str] = []
    baseline_score: float | None = Field(default=None, ge=0, le=100)
    baseline_rank: int | None = Field(default=None, ge=1)
    candidate_group: str
    demo_only: bool = True

class WeakLabelResult(BaseModel):
    model_config = ConfigDict(extra='forbid')
    labeler_id: str
    labeler_version: str
    label: WeakLabel
    confidence: float = Field(ge=0, le=1)
    reason_codes: list[str] = []
    rationale_code: str
    applied_features: list[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TrainingExample(BaseModel):
    model_config = ConfigDict(extra='forbid')
    example_key: str
    snapshot: OpportunityFeatureSnapshot
    quality_label: QualityLabel | None = None
    binary_label: int | None = Field(default=None, ge=0, le=1)
    label_source: str | None = None
    label_confidence: float | None = Field(default=None, ge=0, le=1)
    near_duplicate_cluster: str
    split_assignment: Literal['train','validation','test'] | None = None

class PredictionResult(BaseModel):
    model_config = ConfigDict(extra='forbid')
    model_id: str
    model_version: str
    probability: float = Field(ge=0, le=1)
    quality_score: float = Field(ge=0, le=100)
    predicted_class: Literal['useful','not_useful']
    uncertainty: float = Field(ge=0, le=1)
    top_positive_factors: list[str]
    top_negative_factors: list[str]
    missing_features: list[str]
    missingness_ratio: float = Field(ge=0, le=1)
    out_of_distribution: bool
    ood_reasons: list[str]
    predicted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    fallback_used: bool = False
    fallback_reason: str | None = None

class DatasetManifest(BaseModel):
    dataset_version: str
    feature_schema_version: int
    label_schema_version: int
    created_at: datetime
    source_records: int
    accepted_examples: int
    rejected_examples: int
    duplicate_examples: int
    class_distribution: dict[str,int]
    split_distribution: dict[str,int]
    checksum: str
    demo_only: bool = True

class ModelManifest(BaseModel):
    model_id: str
    model_type: str
    model_version: str
    dataset_version: str
    feature_schema_version: int
    label_schema_version: int
    artifact_path: str
    artifact_checksum: str
    metrics: dict[str, Any]
    feature_names: list[str]
    status: Literal['experimental','candidate','shadow','challenger','champion','rejected','retired']
    demo_only: bool = True

class ShadowRow(BaseModel):
    company_key_hash: str
    baseline_rank: int
    shadow_rank: int
    rank_delta: int
    would_enter_top_k: bool
    would_leave_top_k: bool
    baseline_score: float
    ml_score: float
    out_of_distribution: bool

class ShadowRankingResult(BaseModel):
    top_k: int
    rows: list[ShadowRow]
    spearman_correlation: float | None
    baseline_order_unchanged: bool = True
