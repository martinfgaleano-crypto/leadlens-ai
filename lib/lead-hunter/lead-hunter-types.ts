// ─── Lead Hunter types v0 ─────────────────────────────────────────────────────
// Compliance-safe, signal-based, review-first account discovery. Lead Hunter
// finds COMPANIES with opportunity signals from permitted public sources —
// never contacts, never scraping, never automated outreach.
// See docs/strategy/LEADLENS_LEAD_HUNTER_ARCHITECTURE.md.

export type LeadHunterRunStatus = "draft" | "queued" | "processing" | "completed" | "failed" | "cancelled";
export type LeadHunterReviewStatus = "pending_review" | "approved" | "rejected" | "reserved";
export type LeadHunterProviderMode = "manual_sources" | "provider_search" | "hybrid";
export type LeadHunterSafetyDecision = "ok" | "needs_review" | "blocked";

export type LeadHunterSourceCategory =
  | "company_website"
  | "public_job_post"
  | "public_news"
  | "public_directory_permitted"
  | "event_conference_page"
  | "marketplace_listing"
  | "public_registry"
  | "customer_provided"
  | "other_permitted_public_source"
  // Restricted — recognized so the policy engine can BLOCK them explicitly:
  | "apollo_without_license"
  | "zoominfo_without_license"
  | "linkedin_scraping"
  | "paywalled_source"
  | "private_database"
  | "personal_social_profile"
  | "unknown_rights";

export type LeadHunterSignalType =
  | "hiring"
  | "expansion"
  | "new_office"
  | "funding"
  | "product_launch"
  | "partnership"
  | "event_participation"
  | "new_pricing_or_product_page"
  | "marketplace_listing"
  | "public_case_study"
  | "growth_announcement"
  | "regulatory_or_registry_update"
  | "b2b_buying_trigger"
  | "other";

export interface LeadHunterBrief {
  id: string;
  name: string;
  target_market: string | null;
  region: string | null;
  country: string | null;
  industry: string | null;
  icp_notes: string | null;
  signal_types: string[];
  allowed_source_categories: string[];
  excluded_source_categories: string[];
  max_candidates: number;
  language: string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadHunterRun {
  id: string;
  brief_id: string | null;
  status: LeadHunterRunStatus;
  provider_mode: LeadHunterProviderMode;
  started_at: string | null;
  completed_at: string | null;
  candidate_count: number;
  approved_count: number;
  rejected_count: number;
  error_message: string | null;
  run_summary: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface LeadHunterSourceInput {
  id: string;
  run_id: string;
  source_url: string;
  source_title: string | null;
  source_category: LeadHunterSourceCategory | string;
  pasted_context: string | null;
  usage_rights_status: string;
  safety_status: LeadHunterSafetyDecision | string;
  created_at: string;
}

export interface LeadHunterCandidate {
  id: string;
  run_id: string | null;
  brief_id: string | null;
  company_name: string;
  domain: string | null;
  website_url: string | null;
  region: string | null;
  country: string | null;
  industry: string | null;
  signal_type: LeadHunterSignalType | string | null;
  signal_summary: string | null;
  signal_date: string | null;
  source_url: string;
  source_title: string | null;
  source_category: LeadHunterSourceCategory | string;
  evidence_snippet: string | null;
  evidence_quality: string | null;
  freshness_status: string | null;
  confidence_score: number | null;
  fit_rationale: string | null;
  suggested_action: string | null;
  usage_rights_status: string;
  safety_status: LeadHunterSafetyDecision | string;
  review_status: LeadHunterReviewStatus | string;
  review_notes: string | null;
  vault_company_id: string | null;
  vault_contact_id: string | null;
  vault_signal_id: string | null;
  vault_source_id: string | null;
  created_at: string;
  updated_at: string;
}

/** A raw finding before it becomes a stored candidate (engine output). */
export interface LeadHunterFinding {
  company_name: string;
  domain?: string;
  website_url?: string;
  region?: string;
  country?: string;
  industry?: string;
  signal_type?: LeadHunterSignalType | string;
  signal_summary?: string;
  signal_date?: string;
  evidence_snippet?: string;
  fit_rationale?: string;
  source: LeadHunterSourceEvidence;
}

export interface LeadHunterSourceEvidence {
  source_url: string;
  source_title?: string;
  source_category: LeadHunterSourceCategory | string;
  usage_rights_status?: string;
}

export interface LeadHunterRunSummary {
  sources_processed: number;
  candidates_created: number;
  blocked_sources: number;
  needs_review: number;
  provider_mode: LeadHunterProviderMode;
  notes?: string[];
}

/** Provider adapter contract — future automated discovery implements this.
 *  v0 ships manual-sources only; see lib/lead-hunter/providers/. */
export interface LeadHunterDiscoveryProvider {
  provider_id: string;
  mode: LeadHunterProviderMode;
  /** Discover candidate sources for a brief (bounded). Manual provider returns []. */
  searchSources(brief: LeadHunterBrief, maxSources: number): Promise<LeadHunterSourceEvidence[]>;
  /** Turn one source input into zero or more findings (bounded). */
  extractCandidatesFromSource(source: LeadHunterSourceInput, brief: LeadHunterBrief | null): Promise<LeadHunterFinding[]>;
}
