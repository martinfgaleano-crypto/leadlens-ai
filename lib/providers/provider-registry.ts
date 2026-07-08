// ─── Provider Registry (compliance metadata) ──────────────────────────────────
// Single source of truth for which data providers exist, whether they are
// configured, and — critically — whether their data may appear in CUSTOMER
// deliverables. See docs/strategy/LEADLENS_DATA_SOURCING_COMPLIANCE.md.
//
// Core rule: a configured API key is NOT permission. Apollo (and any
// licensed-only provider) is customer_facing_allowed only when the explicit
// licensed flag is set — key presence alone never activates it.

export type ProviderCategory = "contact_data" | "search" | "enrichment" | "signals";
export type ProviderRiskLevel = "low" | "medium" | "high";
export type LicenseStatus = "not_required" | "unlicensed" | "licensed";

export interface ProviderMeta {
  provider_id: string;
  display_name: string;
  category: ProviderCategory;
  /** API key/env present */
  configured: boolean;
  /** operationally enabled at all (internal use may still be allowed) */
  enabled: boolean;
  /** data may appear in customer deliverables */
  customer_facing_allowed: boolean;
  requires_license: boolean;
  license_status: LicenseStatus;
  allowed_use: string;
  risk_level: ProviderRiskLevel;
  notes: string;
}

export function isApolloLicensed(): boolean {
  return process.env.APOLLO_LICENSED_PROVIDER_ENABLED === "true";
}

export function getProviderRegistry(): ProviderMeta[] {
  const apolloConfigured = !!process.env.APOLLO_API_KEY;
  const apolloLicensed = isApolloLicensed();

  return [
    {
      provider_id: "apollo",
      display_name: "Apollo",
      category: "contact_data",
      configured: apolloConfigured,
      // Enabled only with the explicit license flag — never by key presence.
      enabled: apolloConfigured && apolloLicensed,
      customer_facing_allowed: apolloLicensed,
      requires_license: true,
      license_status: apolloLicensed ? "licensed" : "unlicensed",
      allowed_use: apolloLicensed
        ? "Customer deliverables (licensed)"
        : "Internal LeadLens sales prospecting only — requires data licensing/reseller agreement for customer-facing use",
      risk_level: "high",
      notes: "Optional — requires data licensing. Standard subscriptions do not permit resale of contact data in customer deliverables.",
    },
    {
      provider_id: "tavily",
      display_name: "Tavily (web search)",
      category: "search",
      configured: !!process.env.TAVILY_API_KEY,
      enabled: !!process.env.TAVILY_API_KEY,
      customer_facing_allowed: true,
      requires_license: false,
      license_status: "not_required",
      allowed_use: "Public-web account/signal research (account-level evidence, source URLs preserved)",
      risk_level: "low",
      notes: "Public sources only; provenance tracked per result.",
    },
    {
      provider_id: "anthropic",
      display_name: "Anthropic (analysis)",
      category: "enrichment",
      configured: !!process.env.ANTHROPIC_API_KEY,
      enabled: !!process.env.ANTHROPIC_API_KEY,
      customer_facing_allowed: true,
      requires_license: false,
      license_status: "not_required",
      allowed_use: "AI analysis/synthesis of permitted inputs — not a data source",
      risk_level: "low",
      notes: "Processes data; does not originate contact data.",
    },
  ];
}

/**
 * Guard for customer-deliverable paths that would consume Apollo data.
 * Returns a human-readable block reason, or null when allowed.
 */
export function apolloCustomerFacingBlockReason(): string | null {
  if (isApolloLicensed()) return null;
  return "Apollo is a licensed-only provider. Set APOLLO_LICENSED_PROVIDER_ENABLED=true only after a data licensing/reseller agreement is in place. API key presence does not grant customer-facing usage rights.";
}
