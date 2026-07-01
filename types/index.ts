// ─── Core enums ──────────────────────────────────────────────────────────────

export type PlanType = "starter" | "standard" | "pro" | "sample";
export type LeadStatus = "pending" | "processing" | "completed" | "error";
export type LeadCategory = "HOT" | "WARM" | "COLD" | "DISCARD";
export type QCStatus = "APPROVED" | "REVIEW_NEEDED" | "FAILED";
export type EmailStatus = "verified" | "unknown" | "not_found" | "invalid";
export type LeadSource = "mock" | "apollo" | "tavily" | "hunter" | "people_data_labs" | "manual";
export type OutputLanguage = "en" | "es" | "pt" | "ja";
export type MarketRegion = "north_america" | "latin_america" | "europe" | "asia" | "global";
export type EvidenceDisciplineType = "verified_public_signal" | "inferred_from_context" | "weak_inference" | "missing_evidence";
export type RiskLevel = "low" | "medium" | "high";

// ─── Account Memory ───────────────────────────────────────────────────────────

/** Novelty / repetition state of an account across pipeline runs. */
export type AccountMemoryState =
  | "new_opportunity"
  | "previously_seen"
  | "repeated_without_new_signal"
  | "reactivated_with_new_signal"
  | "upgraded_priority"
  | "downgraded_priority"
  | "dropped"
  | "do_not_show";

// ─── New intelligence types ───────────────────────────────────────────────────

/** How imminent the buying window appears based on available signals */
export type BuyingWindow = "immediate" | "near_term" | "monitor" | "unclear";

/** Granular evidence quality grade — more specific than RiskLevel */
export type EvidenceQualityGrade = "strong_verified" | "moderate_public" | "inferred" | "weak" | "missing";

/** Conservative evidence quality tier used by the Evidence Quality guardrails layer.
 * Distinct from EvidenceQualityGrade (agent-level granular grade) and
 * ScoreDimensions.evidence_quality (0-100 numeric). Never changes score or ranking. */
export type EvidenceQualityLevel = "high" | "medium" | "low" | "insufficient";

// ─── Source Access & Freshness Layer types ────────────────────────────────────

/** Normalized source type — single source of truth in source-registry.ts */
export type SourceType =
  | "company_website" | "news" | "job_posting" | "press_release" | "funding"
  | "directory" | "social" | "public_registry" | "trade_association"
  | "chamber_of_commerce" | "export_import_resource" | "customer_memory"
  | "demo" | "unknown";

/** Source reliability tier (from source-registry.ts, not invented per-lead) */
export type SourceReliability = "high" | "medium" | "low" | "unknown";

/** Actual freshness state of a signal, computed from signal_age_days */
export type SourceFreshness = "fresh" | "recent" | "stale" | "unknown";

/** Expected freshness category for a source type (from source-registry.ts) */
export type FreshnessExpectation = "high" | "medium" | "low" | "not_applicable";

/** Role of a source: does it indicate timing, or just company context? */
export type SignalRole = "timing_signal" | "context_only" | "memory_signal" | "unknown";

/** Regional data coverage confidence — drives EQ caps; "unknown" = conservative */
export type RegionConfidence = "high" | "medium" | "low" | "unknown";

/** What the system recommends doing with this account */
export type RecommendedActionType =
  | "send_outreach_now"
  | "validate_source_first"
  | "monitor_for_new_signal"
  | "enrich_manually"
  | "exclude"
  | "add_to_watchlist";

// ─── Feedback ─────────────────────────────────────────────────────────────────

/**
 * User feedback signals on processed accounts.
 * Hooks for future Vault + adaptive scoring.
 * UI not built yet — fields are left undefined until the feedback loop is wired.
 */
export type FeedbackSignal =
  | "useful"
  | "not_useful"
  | "irrelevant"
  | "contacted"
  | "meeting_booked"
  | "wrong_fit"
  | "generic"
  | "replied"
  | "add_to_vault"
  | "exclude_similar";

/**
 * How a feedback signal should affect the learning system.
 * Not yet applied — designed for the future LeadLens Vault.
 *
 * When user marks "meeting_booked":
 *   direction = "strengthen", save_as_reusable = true
 * When user marks "wrong_fit":
 *   direction = "weaken", affected_segment = the mismatch segment
 */
export interface FeedbackEffect {
  signal: FeedbackSignal;
  affects_pattern: string;          // e.g. "warehouse_expansion + ops_hiring"
  direction: "strengthen" | "weaken";
  affected_segment?: string;        // Which segment this feedback applies to
  save_as_reusable?: boolean;       // If true, save the outreach angle to Vault
}

// ─── Vault pattern (aggregated from opportunity_feedback) ─────────────────────

export interface VaultPattern {
  industry: string;
  direction: "strengthen" | "weaken";
  signal_count: number;
  top_signals: string[];
  confidence: "low" | "medium" | "high";
  vault_ready: boolean;               // meets minimum threshold for pipeline use
  example_buying_windows: string[];
}

// ─── Plan config ──────────────────────────────────────────────────────────────

export const PLAN_LEAD_COUNT: Record<PlanType, number> = {
  sample: 2,
  starter: 10,
  standard: 50,
  pro: 100,
};

export const PLAN_SEARCH_POOL: Record<PlanType, number> = {
  sample: 6,
  starter: 30,
  standard: 120,
  pro: 250,
};

export const PLAN_PRICE: Record<PlanType, number> = {
  sample: 7,
  starter: 29,
  standard: 79,
  pro: 149,
};

// ─── Onboarding (from user form) ─────────────────────────────────────────────

export interface OnboardingData {
  company_name: string;
  company_description: string;
  offer_description: string;
  value_proposition: string;
  target_customer_description: string;
  average_ticket?: string;
  tone: "direct" | "consultative" | "casual";
  contact_email: string;
  output_language?: OutputLanguage;
  target_market_region?: MarketRegion;
}

// ─── ICP (structured output of ICP Agent) ────────────────────────────────────

export interface ICP {
  target_industries: string[];
  target_titles: string[];
  company_size_range: string;
  pain_points: string[];
  disqualifiers: string[];
  ideal_signals: string[];
  // Enhanced ICP intelligence (optional — populated by Claude path)
  product_detected?: string;
  problem_solved?: string;
  buyer_profile?: string;
  icp_clarity_score?: number;         // 0–100
  icp_risks?: string[];
  exclusions_explicit?: string[];
  top_priority_signals?: string[];
}

// ─── Lead Search Criteria (input to Lead Finder) ─────────────────────────────

export interface LeadSearchCriteria {
  target_industries: string[];
  target_company_size: string[];
  target_job_titles: string[];
  target_geography: string[];
  excluded_industries: string[];
  buying_signals: string[];
  disqualification_criteria: string[];
  average_ticket?: string;
  offer_summary: string;
  value_proposition: string;
  tone: "direct" | "consultative" | "casual";
  plan: PlanType;
  lead_count: number;
  output_language?: OutputLanguage;
  target_market_region?: MarketRegion;
  outreach_language?: string;
  localization_notes?: string;
  sender_company_name?: string;
  sender_company_description?: string;
}

// ─── Lead Candidate (raw from provider) ──────────────────────────────────────

export interface LeadCandidate {
  id: string;
  name?: string;
  title?: string;
  company: string;
  domain?: string;
  website_url?: string;
  linkedin_url?: string;
  email?: string;
  email_status?: EmailStatus;
  location?: string;
  industry?: string;
  company_size?: string;
  source: LeadSource;
  source_url?: string;
  raw_context?: string;
  confidence_score: number; // 0–1
}

// ─── Evidence discipline ──────────────────────────────────────────────────────

export interface EvidenceClaim {
  claim: string;
  type: EvidenceDisciplineType;
}

// ─── Enriched Lead (from Research Agent) ─────────────────────────────────────

export interface EnrichedLead {
  candidate: LeadCandidate;
  company_summary?: string;
  role_relevance?: string;
  inferred_pain?: string;
  timing_signals: string[];
  evidence: string[];
  missing_data: string[];
  research_confidence: number; // 0–1
  // Enhanced intelligence fields
  why_now?: string;
  pain_hypothesis?: string;
  risks_weaknesses?: string[];
  evidence_discipline?: EvidenceClaim[];
  segment_fit_note?: string;
  // ── Account Intelligence layer ──────────────────────────────────────────────
  // Populated by Research Agent — answers "why does this account matter, and what do we do now?"
  account_thesis?: string;           // "Why this account may be commercially relevant now"
  signal_interpretation?: string;    // What the signals MEAN, not just what they are
  buying_window?: BuyingWindow;      // Timing classification: immediate/near_term/monitor/unclear
  buying_window_reason?: string;     // Why this window classification
  evidence_quality_grade?: EvidenceQualityGrade; // Granular grade: strong_verified → missing
  opportunity_risks?: string[];      // Specific risks in pursuing this account
  recommended_action?: RecommendedActionType;    // Preliminary action recommendation
  recommended_action_reason?: string;
  next_best_question?: string;       // What to validate before contacting
}

// ─── Score dimensions (0–100 per axis) ───────────────────────────────────────

export interface ScoreDimensions {
  icp_fit: number;
  signal_strength: number;
  timing: number;
  evidence_quality: number;
  strategic_value: number;
  confidence: number;
  disqualification_risk: number;
}

// ─── Qualified Lead (from Qualification Agent) ────────────────────────────────

export interface QualifiedLead {
  enrichment: EnrichedLead;
  fit_score: number; // 0–10
  category: LeadCategory;
  fit_reasons: string[];
  disqualification_reasons: string[];
  qualification_confidence: number;
  score_breakdown: {
    role_fit: number;            // 0–2
    company_fit: number;         // 0–2
    pain_fit: number;            // 0–2
    timing_signal: number;       // 0–2
    reachability: number;        // 0–1
    strategic_relevance: number; // 0–1
  };
  // Enhanced scoring
  score_dimensions?: ScoreDimensions;
  score_explanation?: string;
  // ── Ranking intelligence (populated after all leads scored) ─────────────────
  signal_interpretation?: string;    // What the score pattern means commercially
  opportunity_tier_reason?: string;  // Why HOT/WARM/COLD/DISCARD at this score
  rank?: number;                     // Position in ranked list (1 = best in batch)
  ranking_explanation?: string;      // "A ranks above B because..."
  comparative_notes?: string;        // Observations vs adjacent accounts
}

// ─── Personalization Result (from Personalization Agent) ─────────────────────

export interface PersonalizationResult {
  personalization_trigger: string;
  recommended_angle: string;
  account_reasoning: string;
  what_to_avoid: string;
  strongest_hook: string;
  personalization_confidence: number; // 0–1
}

// ─── Outreach Sequence (from Outreach Agent) ─────────────────────────────────

export interface OutreachSequence {
  personalization_trigger: string;
  recommended_angle?: string;
  subject: string;
  email_body: string;
  linkedin_dm: string;
  followup_1: string;
  followup_2: string;
  call_opener?: string;
  cta_recommendation?: string;
  outreach_assumptions?: string;
  what_to_avoid_in_outreach?: string;
  tone: string;
  qc_status: QCStatus;
  qc_notes: string[];
  genericness_risk?: RiskLevel;
  hallucination_risk?: RiskLevel;
  evidence_weakness?: RiskLevel;
  buyer_seller_confusion_risk?: RiskLevel;
  improvement_notes?: string[];
  was_repaired?: boolean;
}

// ─── Opportunity Ranking (computed after all leads scored) ────────────────────
// Explains WHY accounts rank where they do relative to each other.

export interface OpportunityRanking {
  lead_id: string;
  company: string;
  rank: number;
  fit_score: number;
  category: LeadCategory;
  top_priority_reason: string;     // Main reason this account is at this rank
  ranking_explanation: string;     // Comparative: "A ranks above B because..."
  opportunity_tier_reason: string; // Why HOT/WARM/COLD/DISCARD
  comparative_notes?: string;      // Contextual observations vs adjacent accounts
  recommended_action: RecommendedActionType;
  evidence_quality?: EvidenceQualityLevel;
  original_recommended_action?: RecommendedActionType;
  recommended_action_guardrail_applied?: boolean;
}

// ─── Learning / Feedback Metadata ────────────────────────────────────────────

export interface LearningMetadata {
  agent_confidence: number;                       // 0–1 aggregate
  qc_flags: string[];
  genericness_risk: RiskLevel;
  hallucination_risk: RiskLevel;
  evidence_discipline_summary: "verified" | "mostly_inferred" | "weak";
  signal_patterns: string[];                      // Confirmed buying signals
  segment_pattern?: string;
  improvement_notes: string[];
  reusable_pattern?: string;                      // A pattern worth storing
  // ── Learning Intelligence MVP 2 ─────────────────────────────────────────────
  offer_market_fit_pattern?: string;              // e.g. "warehouse expansion → logistics ICP match"
  reason_for_priority?: string;                   // Why this account was priority tier
  reason_for_demotion?: string;                   // Why NOT priority (if applicable)
  predicted_learning_value?: "high" | "medium" | "low"; // How much this entry teaches
  feedback_hooks?: FeedbackSignal[];              // Which feedback signals apply to this account
  // Future feedback fields (not collected yet — hooks for Vault integration):
  user_feedback?: FeedbackSignal;
  feedback_notes?: string;
  rejected_reason?: string;
  // ── Vault hints (applied post-qualification, never change score/category) ─────
  vault_hint_applied?: boolean;
  vault_positive_match?: boolean;
  vault_negative_match?: boolean;
  vault_reason?: string;
  vault_confidence?: "insufficient_volume" | "low" | "medium" | "high";
  vault_matched_patterns?: string[];
  // ── Account Memory (applied post-vault, never changes scores) ────────────────
  account_memory_state?: AccountMemoryState;
  account_memory_times_seen?: number;          // 0 = never seen before
  account_memory_last_seen_at?: string;        // ISO timestamp of previous appearance
  account_memory_last_category?: string;       // HOT/WARM/COLD/DISCARD from last run
  // ── Source Access & Freshness Layer (applied before EQ, never changes scores) ─
  source_layer_applied?: boolean;
  discovered_at?: string;            // ISO timestamp of pipeline run (always set)
  signal_date?: string | null;       // Actual date of signal origin (null = unknown)
  signal_age_days?: number | null;   // Days since signal_date (null when date unknown)
  source_type?: SourceType;          // Primary source type for this opportunity
  source_types?: SourceType[];       // All unique source types found
  source_name?: string | null;       // Human-readable source name (null = not available)
  source_reliability?: SourceReliability;
  source_freshness?: SourceFreshness; // fresh/recent/stale/unknown (computed from age)
  signal_role?: SignalRole;
  is_context_only?: boolean;         // True when all sources are context-only
  is_timing_signal?: boolean;        // True when at least one timing source is present
  freshness_label?: string;          // Human-readable freshness summary for UI
  source_summary?: string;           // Human-readable source description for UI
  limited_region_coverage?: boolean; // True when region_confidence is low/unknown
  // ── Evidence Quality (applied post-source-layer, never changes scores) ────────
  evidence_quality?: EvidenceQualityLevel;
  source_count?: number;
  signal_count?: number;
  fresh_signal_count?: number;
  freshness_score?: number;
  evidence_confidence?: number;
  source_confidence?: "high" | "medium" | "low";
  region_confidence?: RegionConfidence;
  insufficient_evidence_reason?: string;
  evidence_summary?: string;
  recommended_action_guardrail_applied?: boolean;
  original_recommended_action?: string;
  guardrailed_recommended_action?: string;
}

// ─── Processed Lead (final pipeline output) ──────────────────────────────────

export interface ProcessedLead {
  id: string;
  candidate: LeadCandidate;
  enrichment: EnrichedLead;
  qualification: QualifiedLead;
  outreach: OutreachSequence;
  learning?: LearningMetadata;
}

// ─── Report (final output of full pipeline) ──────────────────────────────────

export interface LeadLensReport {
  job_id: string;
  plan: PlanType;
  total_leads: number;
  hot_count: number;
  warm_count: number;
  cold_count: number;
  discard_count: number;
  avg_score: number;
  executive_summary: string;
  patterns_observed: string[];
  recommendations: string[];
  processed_leads: ProcessedLead[];
  created_at: string;
  // Enhanced report intelligence
  segment_insights?: string[];
  top_signals_observed?: string[];
  first_actions?: string[];
  strategic_warnings?: string[];
  evidence_quality_summary?: string;
  evidence_quality_counts?: { high: number; medium: number; low: number; insufficient: number };
  // ── Ranking Intelligence ────────────────────────────────────────────────────
  ranked_opportunities?: OpportunityRanking[];    // All accounts ranked with explanations
  // ── Report-level QC ────────────────────────────────────────────────────────
  report_quality_score?: number;                  // 0–100 self-assessed quality
  report_quality_notes?: string[];                // Issues found at batch level
  report_risks?: string[];                        // Risks in the overall report
  recommended_fix_before_delivery?: string;       // If quality issues detected, what to fix
}

// ─── Pipeline I/O ─────────────────────────────────────────────────────────────

export interface PipelineInput {
  onboardingData: OnboardingData;
  plan: PlanType;
  jobId?: string;
}

// ─── Provider result ──────────────────────────────────────────────────────────

export interface EmailFindResult {
  email?: string;
  email_status: EmailStatus;
  confidence_score: number;
  source?: string;
}

// ─── QC Result (internal) ────────────────────────────────────────────────────

export interface QCResult {
  status: QCStatus;
  notes: string[];
  genericness_risk?: RiskLevel;
  hallucination_risk?: RiskLevel;
  evidence_weakness?: RiskLevel;
  buyer_seller_confusion_risk?: RiskLevel;
  improvement_notes?: string[];
}

// ─── Raw lead (legacy upload flow) ───────────────────────────────────────────

/** @deprecated Use LeadCandidate for new code. Kept for CSV upload route. */
export interface RawLead {
  name: string;
  company: string;
  title: string;
  email: string;
  linkedin_url?: string;
  notes?: string;
}

// ─── Batch Job (for future Supabase persistence) ─────────────────────────────

export type PaymentStatus = "pending" | "paid";

export interface BatchJob {
  id: string;
  status: LeadStatus;
  plan: PlanType;
  onboarding: OnboardingData;
  report?: LeadLensReport;
  created_at: string;
  completed_at?: string;
  stripe_session_id?: string;
  customer_email: string;
  payment_status?: PaymentStatus;
}
