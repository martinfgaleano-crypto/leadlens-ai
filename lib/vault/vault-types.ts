// ─── Vault Foundation types v0 ────────────────────────────────────────────────
// Compliance-safe research memory: every record carries provenance and usage
// rights. Distinct namespace from the legacy vault_leads types and from the
// report-pipeline SourceType in @/types.

export type VaultReviewStatus = "pending_review" | "approved" | "rejected";
export type VaultStatus = "candidate" | "active" | "archived";
export type UsageRightsStatus = "unverified" | "permitted" | "licensed" | "restricted";
export type VaultSuppressionType = "email" | "domain" | "company";

export type VaultSourceType =
  | "customer_provided"
  | "company_website"
  | "public_directory"
  | "public_job_post"
  | "public_event"
  | "public_news"
  | "business_registry"
  | "licensed_provider"
  | "other_public";

export type VaultSignalType =
  | "hiring"
  | "expansion"
  | "funding"
  | "product_launch"
  | "leadership_change"
  | "event_participation"
  | "regulatory"
  | "other";

export interface VaultCompany {
  id: string;
  name: string;
  domain: string | null;
  website_url: string | null;
  linkedin_company_url: string | null;
  industry: string | null;
  region: string | null;
  country: string | null;
  company_size: string | null;
  description: string | null;
  source_status: string | null;
  vault_status: VaultStatus;
  suppression_status: string;
  created_at: string;
  updated_at: string;
}

export interface VaultContact {
  id: string;
  company_id: string | null;
  full_name: string | null;
  title: string | null;
  seniority: string | null;
  department: string | null;
  email: string | null;
  email_status: string | null;
  linkedin_url: string | null;
  region: string | null;
  country: string | null;
  source_status: string | null;
  usage_rights_status: UsageRightsStatus;
  vault_status: VaultStatus;
  review_status: VaultReviewStatus;
  suppression_status: string;
  created_at: string;
  updated_at: string;
}

export interface VaultSource {
  id: string;
  provider_id: string | null;
  source_type: VaultSourceType | string;
  source_url: string | null;
  source_title: string | null;
  retrieved_at: string | null;
  published_at: string | null;
  freshness_status: string | null;
  confidence_score: number | null;
  usage_rights_status: UsageRightsStatus;
  notes: string | null;
  raw_metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface VaultSignal {
  id: string;
  company_id: string | null;
  contact_id: string | null;
  source_id: string | null;
  signal_type: VaultSignalType | string;
  signal_summary: string | null;
  signal_date: string | null;
  expires_at: string | null;
  strength_score: number | null;
  confidence_score: number | null;
  review_status: VaultReviewStatus;
  // Production data isolation (037). Fail-closed: unknown origin is never
  // production-eligible. Optional in type for pre-037 rows/DBs.
  data_origin?: DataOrigin;
  production_eligible?: boolean;
  origin_reason?: string | null;
  origin_version?: string | null;
  created_at: string;
  updated_at: string;
}

export const DATA_ORIGINS = [
  "production", "benchmark", "demo", "fixture", "synthetic", "internal_qa", "legacy_unknown",
] as const;
export type DataOrigin = (typeof DATA_ORIGINS)[number];

export interface VaultUsageHistory {
  id: string;
  company_id: string | null;
  contact_id: string | null;
  order_id: string | null;
  job_id: string | null;
  customer_email: string | null;
  usage_type: string;
  delivered_at: string | null;
  fit_score: number | null;
  notes: string | null;
  created_at: string;
}

export interface VaultReservation {
  id: string;
  company_id: string | null;
  contact_id: string | null;
  reserved_for_customer_email: string | null;
  reserved_for_order_id: string | null;
  reservation_reason: string | null;
  expires_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface VaultSuppressionEntry {
  id: string;
  suppression_type: VaultSuppressionType | string;
  value: string;
  reason: string;
  source: string | null;
  created_at: string;
}

/** Manual intake bundle (admin candidate form). */
export interface VaultCandidate {
  company_name: string;
  domain?: string;
  website_url?: string;
  region?: string;
  country?: string;
  industry?: string;
  contact_name?: string;
  contact_title?: string;
  email?: string;
  source_url: string;
  source_type: VaultSourceType | string;
  signal_type?: VaultSignalType | string;
  signal_summary?: string;
  signal_date?: string;
  confidence_score?: number;
  usage_rights_status?: UsageRightsStatus;
  notes?: string;
}
