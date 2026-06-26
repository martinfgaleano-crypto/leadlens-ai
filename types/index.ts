// ─── Core enums ──────────────────────────────────────────────────────────────

export type PlanType = "starter" | "standard" | "pro" | "sample";
export type LeadStatus = "pending" | "processing" | "completed" | "error";
export type LeadCategory = "HOT" | "WARM" | "COLD" | "DISCARD";
export type QCStatus = "APPROVED" | "REVIEW_NEEDED" | "FAILED";
export type EmailStatus = "verified" | "unknown" | "not_found" | "invalid";
export type LeadSource = "mock" | "apollo" | "tavily" | "hunter" | "people_data_labs" | "manual";
export type OutputLanguage = "en" | "es" | "pt" | "ja";
export type MarketRegion = "north_america" | "latin_america" | "europe" | "asia" | "global";
export type FeedbackSignal = "useful" | "not_useful" | "irrelevant" | "contacted" | "meeting_booked" | "wrong_fit" | "generic";
export type EvidenceDisciplineType = "verified_public_signal" | "inferred_from_context" | "weak_inference" | "missing_evidence";
export type RiskLevel = "low" | "medium" | "high";

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
  product_detected?: string;          // What the seller's product actually does
  problem_solved?: string;            // The specific problem it solves
  buyer_profile?: string;             // Likely buyer role/team at target company
  icp_clarity_score?: number;         // 0–100: how specific/actionable this ICP is
  icp_risks?: string[];               // Risks in the ICP definition
  exclusions_explicit?: string[];     // Hard exclusions beyond standard disqualifiers
  top_priority_signals?: string[];    // Signals that most strongly predict opportunity
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

// ─── Evidence discipline (how well-supported a claim is) ─────────────────────

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
  // Enhanced intelligence fields (optional — populated when evidence allows)
  why_now?: string;             // Why this account is relevant *at this moment*
  pain_hypothesis?: string;    // Specific, falsifiable pain hypothesis — not generic
  risks_weaknesses?: string[]; // Real risks: weak evidence, wrong segment, etc.
  evidence_discipline?: EvidenceClaim[]; // Classification of key claims
  segment_fit_note?: string;   // Why this company fits/doesn't fit the ICP segment
}

// ─── Score dimensions (0–100 per axis) ───────────────────────────────────────

export interface ScoreDimensions {
  icp_fit: number;              // How well company/segment matches ICP (0–100)
  signal_strength: number;      // Strength of detected buying signals (0–100)
  timing: number;               // Timing relevance — confirmed signals = high (0–100)
  evidence_quality: number;     // Confidence in the evidence base (0–100)
  strategic_value: number;      // Long-term commercial value of this account type (0–100)
  confidence: number;           // Aggregate confidence in the opportunity score (0–100)
  disqualification_risk: number; // Risk this account should be excluded (0–100, higher = riskier)
}

// ─── Qualified Lead (from Qualification Agent) ────────────────────────────────

export interface QualifiedLead {
  enrichment: EnrichedLead;
  fit_score: number; // 0–10 (sum of subscores, backward-compat)
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
  // Enhanced scoring (optional)
  score_dimensions?: ScoreDimensions;   // Multi-axis 0–100 scoring
  score_explanation?: string;           // Why the score is what it is (human-readable)
}

// ─── Personalization Result (from Personalization Agent) ─────────────────────

export interface PersonalizationResult {
  personalization_trigger: string;  // Core insight used to inform outreach angle
  recommended_angle: string;        // Specific sales angle based on signals
  account_reasoning: string;        // Why this angle fits this account right now
  what_to_avoid: string;            // What NOT to say/assume in outreach
  strongest_hook: string;           // Single strongest first-touch hook
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
  call_opener?: string;               // Cold call opening line
  cta_recommendation?: string;       // Recommended CTA and why
  outreach_assumptions?: string;     // What assumptions this outreach makes
  what_to_avoid_in_outreach?: string; // What to avoid in this specific outreach
  tone: string;
  qc_status: QCStatus;
  qc_notes: string[];
  // QC analysis fields (set by QC Agent)
  genericness_risk?: RiskLevel;
  hallucination_risk?: RiskLevel;
  evidence_weakness?: RiskLevel;
  improvement_notes?: string[];
}

// ─── Learning / Feedback Metadata ────────────────────────────────────────────
// Populated by the pipeline after all agents complete.
// User feedback fields are hooks for future UI + DB integration.

export interface LearningMetadata {
  agent_confidence: number;                  // 0–1 aggregate across research + qualification
  qc_flags: string[];                        // All QC notes for this account
  genericness_risk: RiskLevel;
  hallucination_risk: RiskLevel;
  evidence_discipline_summary: "verified" | "mostly_inferred" | "weak";
  signal_patterns: string[];                 // Confirmed buying signals extracted
  segment_pattern?: string;                  // Industry/segment this account belongs to
  improvement_notes: string[];              // What could make this entry better
  reusable_pattern?: string;               // A pattern worth storing for future runs
  // Future feedback hooks (not yet collected in UI — leave undefined until connected):
  user_feedback?: FeedbackSignal;
  feedback_notes?: string;
  rejected_reason?: string;
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
  // Enhanced report intelligence (optional)
  segment_insights?: string[];         // Which segments performed best and why
  top_signals_observed?: string[];     // Buying signals that appeared most across accounts
  first_actions?: string[];           // Specific "do this first" recommendations
  strategic_warnings?: string[];      // Risks in the overall batch (thin evidence, wrong ICP, etc.)
  evidence_quality_summary?: string;  // How trustworthy is the evidence in this batch
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
