// ─── Institutional Opportunity Report v1 — contract ───────────────────────────
// A versioned, evidence-traceable presentation layer over an existing report
// snapshot. Assembles ONLY from data already in report_json — never invents
// corporate facts, never claims purchase intent/budget/vendor search. Every
// material statement carries a `basis` so the reader can tell fact from
// inference from hypothesis from recommendation from unknown.

export const INSTITUTIONAL_REPORT_VERSION = 1;

export type ClaimBasis = "fact" | "inference" | "hypothesis" | "recommendation" | "unknown";

export interface Claim {
  basis: ClaimBasis;
  text: string;
  /** Traceability: where in the pipeline this came from (field/source URL). */
  evidence?: string | null;
}

export interface EvidenceLink {
  label: string;
  url: string | null;
  date: string | null;       // resolved signal date when present — never invented
  date_basis: "fact" | "unknown";
}

export interface AccountDossier {
  rank: number | null;
  company: string;            // fact — as captured by the pipeline
  industry: string | null;
  location: string | null;
  domain: string | null;
  tier: string;               // HOT/WARM/COLD/DISCARD (baseline category — unchanged)
  fit_score: number | null;
  thesis: Claim;              // inference
  why_now: Claim;             // fact-or-inference depending on dated evidence
  why_this_company: Claim;    // inference
  why_this_quarter: Claim;    // inference
  risks: Claim[];             // inference/unknown
  confidence_drivers: string[];
  evidence_grounded: boolean | null;
  evidence_chain: EvidenceLink[];
  hypotheses: Claim[];        // pain hypotheses, open questions — clearly hypothesis
  recommended_next_step: Claim; // recommendation
  playbook: Record<string, string> | null; // HOT accounts (from Decision Engine when present)
}

export interface InstitutionalOpportunityReportV1 {
  schema_version: number;
  metadata: {
    job_id: string;
    generated_at: string;
    assembled_at: string;
    plan: string | null;
    search_id: string | null;
    source_versions: Record<string, string | number> | null;
  };
  context: {
    customer_ref: string | null;   // email or "—"; admin view only
    icp_summary: string | null;
    regions: string[];
    industries: string[];
  };
  executive_brief: {
    headline: string;
    summary: Claim;
    priority_count: number;
    total_accounts: number;
  };
  portfolio_summary: {
    total: number;
    hot: number;
    warm: number;
    cold: number;
    discard: number;
    avg_fit_score: number | null;
    tier_note: string;
    funnel: { considered: number; rejected: number; selected: number; rejection_reasons: Record<string, number> } | null;
  };
  priority_opportunities: Array<{ rank: number | null; company: string; tier: string; one_line: string }>;
  account_dossiers: AccountDossier[];
  coverage: {
    accounts_with_dated_evidence: number;
    accounts_with_sources: number;
    regions_covered: string[];
    industries_covered: string[];
  };
  methodology: string[];
  limitations: string[];
  /** Report-level confidence assessment (derived from evidence coverage). */
  quality?: {
    grade: "strong" | "moderate" | "developing";
    evidence_coverage_pct: number;   // % of dossiers with a source link
    dated_coverage_pct: number;      // % with a dated signal
    grounded_pct: number;            // % marked evidence-grounded (when Decision Engine present)
    note: string;
  };
  versions: Record<string, string | number>;
}
