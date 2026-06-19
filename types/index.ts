// ─── Core enums ──────────────────────────────────────────────────────────────

export type PlanType = "starter" | "standard" | "pro" | "sample";
export type LeadStatus = "pending" | "processing" | "completed" | "error";
export type LeadCategory = "HOT" | "WARM" | "COLD" | "DISCARD";
export type QCStatus = "APPROVED" | "REVIEW_NEEDED" | "FAILED";
export type EmailStatus = "verified" | "unknown" | "not_found" | "invalid";
export type LeadSource = "mock" | "apollo" | "tavily" | "hunter" | "people_data_labs" | "manual";
export type OutputLanguage = "en" | "es" | "pt" | "ja";
export type MarketRegion = "north_america" | "latin_america" | "europe" | "asia" | "global";

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
}

// ─── Qualified Lead (from Qualification Agent) ────────────────────────────────

export interface QualifiedLead {
  enrichment: EnrichedLead;
  fit_score: number; // 0–10 (sum of subscores)
  category: LeadCategory;
  fit_reasons: string[];
  disqualification_reasons: string[];
  qualification_confidence: number;
  score_breakdown: {
    role_fit: number;       // 0–2
    company_fit: number;    // 0–2
    pain_fit: number;       // 0–2
    timing_signal: number;  // 0–2
    reachability: number;   // 0–1
    strategic_relevance: number; // 0–1
  };
}

// ─── Outreach Sequence (from Outreach Agent) ─────────────────────────────────

export interface OutreachSequence {
  personalization_trigger: string;
  subject: string;
  email_body: string;
  linkedin_dm: string;
  followup_1: string;
  followup_2: string;
  tone: string;
  qc_status: QCStatus;
  qc_notes: string[];
}

// ─── Processed Lead (final pipeline output) ──────────────────────────────────

export interface ProcessedLead {
  id: string;
  candidate: LeadCandidate;
  enrichment: EnrichedLead;
  qualification: QualifiedLead;
  outreach: OutreachSequence;
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
