// Discovery Engine V2.4.1 — international Foundation Source validation (REAL).
// These records come from ACTUAL small controlled public-web accesses on 2026-08-07
// (in-app browser, no auth bypass, no bulk, no people data). They move atlas entries
// from "researched/hypothesized" to "operationally_validated" where evidence supports
// it. A source-access inspection is NOT a discovery benchmark (§37) — validation_state
// is "operationally_validated", never "benchmarked".
import type { CountryCode } from "./multi-country";

export type FoundationValidationState = "hypothesized" | "manually_validated" | "operationally_validated" | "benchmarked" | "inaccessible" | "degraded";
export interface FoundationValidation {
  country: CountryCode; source_id: string; source_name: string; attempted_url: string; accessed: boolean; captured_at: string;
  access: ("direct_public" | "api_public" | "bulk_public" | "auth_required" | "javascript_heavy" | "manual_only" | "blocked" | "rate_limited" | "unclear")[];
  provides: { canonical_identifier: boolean; legal_name: boolean; status: boolean; jurisdiction: boolean; geography: boolean; entity_type: boolean; industry: boolean; official_domain: boolean };
  identifier_observed: string; personal_data_presence: "none_observed" | "incidental" | "material"; account_first_feasible: boolean;
  reuse_metadata: string; entity_density_observed: string; validation_state: FoundationValidationState;
  identity_usefulness: "high" | "medium" | "low"; opportunity_usefulness: "high" | "medium" | "low" | "none"; primary_limitation: string; observed_sample: string;
}

// REAL observations (small controlled samples).
export const FOUNDATION_VALIDATIONS: FoundationValidation[] = [
  { country: "GB", source_id: "gb_companies_house", source_name: "Companies House (Find & update company information)", attempted_url: "https://find-and-update.company-information.service.gov.uk/search?q=packaging", accessed: true, captured_at: "2026-08-07",
    access: ["direct_public", "api_public", "bulk_public"], provides: { canonical_identifier: true, legal_name: true, status: true, jurisdiction: true, geography: true, entity_type: true, industry: true, official_domain: false },
    identifier_observed: "company number (e.g. 04517869)", personal_data_presence: "material", account_first_feasible: true,
    reuse_metadata: "explicit_open_reuse (Crown/CH free service + API)", entity_density_observed: "high (many 'packaging' companies with number/status/office)", validation_state: "operationally_validated",
    identity_usefulness: "high", opportunity_usefulness: "none", primary_limitation: "Strong identity (number/status/SIC/office) but NO commercial domain and no opportunity evidence; officer personal data present — collect ONLY organizational fields.", observed_sample: "Search 'packaging' → structured rows: name, company number, status (Incorporated/Dissolved + date), registered office." },
  { country: "AU", source_id: "au_abr_abn", source_name: "Australian Business Register / ABN Lookup", attempted_url: "https://abr.business.gov.au/Search/ResultsActive?SearchText=packaging", accessed: true, captured_at: "2026-08-07",
    access: ["direct_public", "api_public", "bulk_public"], provides: { canonical_identifier: true, legal_name: true, status: true, jurisdiction: true, geography: true, entity_type: true, industry: false, official_domain: false },
    identifier_observed: "ABN (e.g. 58 005 787 913)", personal_data_presence: "incidental", account_first_feasible: true,
    reuse_metadata: "explicit_open_reuse (ABN Lookup web service + Bulk Extract)", entity_density_observed: "high (>200 matches for 'packaging')", validation_state: "operationally_validated",
    identity_usefulness: "high", opportunity_usefulness: "none", primary_limitation: "National identity foundation (ABN/name/entity-type/status/state+postcode); NO domains, weak industry. Not full commercial discovery.", observed_sample: "Search 'packaging' → ABN, Name, Type (Business/Trading/Entity Name), Active status, state+postcode (VIC/QLD/WA/NSW)." },
  { country: "CA", source_id: "ca_corporations_canada", source_name: "Corporations Canada (federal corporation search)", attempted_url: "https://ised-isde.canada.ca/cc/lgcy/fdrlCrpSrch.html?crpNm=packaging", accessed: true, captured_at: "2026-08-07",
    access: ["direct_public", "javascript_heavy"], provides: { canonical_identifier: true, legal_name: true, status: true, jurisdiction: true, geography: true, entity_type: false, industry: false, official_domain: false },
    identifier_observed: "federal corporation number", personal_data_presence: "incidental", account_first_feasible: true,
    reuse_metadata: "explicit_open_reuse (open government datasets)", entity_density_observed: "medium-high (714 returned for 'packaging' — FEDERAL only)", validation_state: "operationally_validated",
    identity_usefulness: "high", opportunity_usefulness: "none", primary_limitation: "FEDERAL corporations only — provincially-incorporated companies are NOT here; results are JS-heavy/paginated. Confirms federal_plus_provincial fragmentation.", observed_sample: "Search 'packaging' → '20 results found, 714 returned' (federal corporations); JS-rendered result pages." },
  { country: "US", source_id: "us_sec_edgar", source_name: "SEC EDGAR (company search)", attempted_url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=packaging&type=10-K", accessed: true, captured_at: "2026-08-07",
    access: ["direct_public", "api_public", "bulk_public"], provides: { canonical_identifier: true, legal_name: true, status: true, jurisdiction: true, geography: true, entity_type: false, industry: true, official_domain: false },
    identifier_observed: "CIK (e.g. 0000075677) + SIC code", personal_data_presence: "material", account_first_feasible: true,
    reuse_metadata: "explicit_open_reuse (EDGAR public data)", entity_density_observed: "very low for SMEs (only 4 'packaging' issuers — PUBLIC companies only)", validation_state: "operationally_validated",
    identity_usefulness: "medium", opportunity_usefulness: "low", primary_limitation: "PUBLIC companies ONLY — NOT universal US business identity (4 'packaging' issuers vs 714 CA-federal, >200 AU). USA foundation is FRAGMENTED; SEC ≠ SME coverage.", observed_sample: "Search 'packaging' → CIK, company, SIC industry (2650 Paperboard containers), state (IL/NY) — 4 items only." },
];

// USA state layer: representative states researched (fragmented) — NOT live-validated
// per-state this sprint (per-state JS forms + provider budget). Recorded honestly.
export const US_STATE_FOUNDATION_STATUS = {
  federal_validated: ["us_sec_edgar (public companies only)", "us_sam_gov (researched — federal supplier universe, not live-tested)"],
  representative_states: ["CA", "TX", "NY", "FL", "IL"], state_validation: "researched_not_live_tested",
  conclusion: "USA foundation is fragmented: no single national SME registry. SEC=public-cos, SAM.gov=federal suppliers; state SoS systems supply SME legal identity but each is a separate JS form. Architecture (country→state→industry) is in place; per-state live validation is queued.",
};

// Applied validation → atlas confidence updates (source-access inspection ⇒
// operationally_validated, NOT benchmarked).
export function validatedAtlasConfidence(source_id: string): FoundationValidationState | null {
  const v = FOUNDATION_VALIDATIONS.find((x) => x.source_id === source_id);
  return v ? v.validation_state : null;
}

// Cross-country FOUNDATION architecture assessment (§64) — real Market Memory.
export const CROSS_COUNTRY_FOUNDATION = [
  { country: "CO" as CountryCode, structure: "national business/identity (RUES/NIT) — Cámara de Comercio", foundation_kind: "single_national", domain_yield: "low", validated: "prior (V2.x)" },
  { country: "GB" as CountryCode, structure: "single national company registry (Companies House / company number)", foundation_kind: "single_national", domain_yield: "none", validated: "operationally_validated" },
  { country: "AU" as CountryCode, structure: "single national business register (ABR / ABN)", foundation_kind: "single_national", domain_yield: "none", validated: "operationally_validated" },
  { country: "CA" as CountryCode, structure: "federal (Corporations Canada) + provincial registries", foundation_kind: "federal_plus_provincial", domain_yield: "none", validated: "operationally_validated (federal)" },
  { country: "US" as CountryCode, structure: "fragmented: SEC (public cos) + SAM.gov (federal suppliers) + 50 state SoS", foundation_kind: "fragmented", domain_yield: "none", validated: "operationally_validated (SEC federal); states researched" },
];

// Empirical readiness overlay (uses REAL validation, not architecture existence).
export interface EmpiricalReadiness {
  country: CountryCode; foundation_readiness: "validated" | "partial" | "researched" | "none";
  source_accessibility: "public" | "mixed" | "restricted" | "unknown"; live_benchmark_depth: number;
  identity_resolution_readiness: "high" | "medium" | "low"; primary_gap: string; next_action: string;
}
export function empiricalReadiness(): EmpiricalReadiness[] {
  return [
    { country: "CO", foundation_readiness: "validated", source_accessibility: "public", live_benchmark_depth: 3, identity_resolution_readiness: "high", primary_gap: "technology unbenchmarked; retail SME/regional coverage partial", next_action: "Colombia Technology live benchmark (#4)" },
    { country: "US", foundation_readiness: "partial", source_accessibility: "mixed", live_benchmark_depth: 1, identity_resolution_readiness: "medium", primary_gap: "state identity fragmented; specialized public discovery surface low-yield; SAM 404", next_action: "Evidence-audit the 14 accepted manufacturers, then consider USA Technology benchmark" },
    { country: "GB", foundation_readiness: "validated", source_accessibility: "public", live_benchmark_depth: 0, identity_resolution_readiness: "high", primary_gap: "no discovery/opportunity source benchmarked (identity only)", next_action: "Curate + validate a UK technology/SaaS discovery source, then Benchmark #1" },
    { country: "AU", foundation_readiness: "validated", source_accessibility: "public", live_benchmark_depth: 0, identity_resolution_readiness: "high", primary_gap: "no discovery source benchmarked (identity only)", next_action: "Validate a manufacturer association source, then Benchmark #1" },
    { country: "CA", foundation_readiness: "partial", source_accessibility: "mixed", live_benchmark_depth: 0, identity_resolution_readiness: "medium", primary_gap: "federal validated; provincial registries unmapped (fragmentation)", next_action: "Map 1–2 provincial registries (ON/BC), then Benchmark #1" },
  ];
}
export const FOUNDATION_VALIDATION_VERSION = "discovery-v2-4-1-foundation-validation-v1";
