// ─── Vault → Report bridge types v0 ──────────────────────────────────────────
// The Vault as an ACTIVE opportunity source: approved companies/signals are
// selected against an ICP and converted into report-compatible LeadCandidate[].
// Selection is exclusion-first (suppressed, restricted rights, already-used,
// unapproved records never pass by default) and scoring is deterministic and
// explainable. See docs/strategy/LEADLENS_VAULT_REPORT_BRIDGE.md.

export type VaultPipelineMode = "preview" | "dry_run" | "generate";
export type VaultFreshnessPreference = "fresh_only" | "fresh_or_recent" | "any";

export type VaultOpportunityRejectionReason =
  | "not_approved"
  | "not_production_eligible"
  | "suppressed"
  | "usage_rights_restricted"
  | "usage_rights_unresolved"
  | "already_used"
  | "reserved_for_other"
  | "excluded_domain"
  | "too_stale"
  | "below_min_confidence"
  | "missing_company";

export interface VaultOpportunityMatchScore {
  total: number; // 0–100, deterministic
  icp_fit: number;
  geography: number;
  industry: number;
  freshness: number;
  confidence: number;
  evidence: number;
  signal_strength: number;
}

/** A joined, selection-ready view of one approved company+signal(+source). */
export interface VaultOpportunity {
  vault_company_id: string;
  vault_signal_id: string | null;
  vault_source_id: string | null;
  company_name: string;
  domain: string | null;
  website_url: string | null;
  industry: string | null;
  region: string | null;
  country: string | null;
  signal_type: string | null;
  signal_summary: string | null;
  signal_date: string | null;
  freshness_status: "fresh" | "recent" | "stale" | "unknown";
  source_url: string | null;
  source_title: string | null;
  source_type: string | null;
  evidence_snippet: string | null;
  usage_rights_status: string;
  confidence_score: number | null; // 0–100 as stored in the Vault
  review_status: string;
  suppression_status: string;
  reservation_status: "none" | "reserved_for_customer" | "reserved_for_other";
  usage_history_count: number;
  match_score: VaultOpportunityMatchScore | null;
  match_reasons: string[];
  rejection_reasons: VaultOpportunityRejectionReason[];
}

export interface VaultOpportunitySelectionCriteria {
  customer_email?: string | null;
  monitor_id?: string | null;
  order_id?: string | null;
  target_market?: string | null;
  icp_notes?: string | null;
  region?: string | null;
  country?: string | null;
  industry?: string | null;
  excluded_domains?: string[];
  max_candidates?: number;
  min_confidence?: number; // 0–100
  freshness_preference?: VaultFreshnessPreference;
  include_reserved?: boolean; // default false
  exclude_used?: boolean; // default true
  require_approved?: boolean; // default true
  /** Default true. Only production-origin signals (037) enter customer-like
   *  selection; demo/fixture/synthetic/internal_qa/benchmark/legacy_unknown are
   *  excluded fail-closed. Opting out requires BOTH this flag set false AND
   *  env VAULT_ALLOW_NON_PRODUCTION_SELECTION=true (internal QA only). */
  require_production_origin?: boolean;
  require_permitted_usage_rights?: boolean; // default true
}

export interface VaultOpportunitySelectionResult {
  ok: boolean;
  mode: VaultPipelineMode;
  selected: VaultOpportunity[];
  rejected_counts: Partial<Record<VaultOpportunityRejectionReason, number>>;
  total_considered: number;
  sparse: boolean; // true when selected < requested
  message: string; // human-readable summary, incl. "not enough…" state
  unavailable_reason?: string; // Supabase missing / migration not applied
}

export interface VaultToLeadCandidateResult {
  ok: boolean;
  candidates: import("@/types").LeadCandidate[];
  skipped: number;
  notes: string[];
}
