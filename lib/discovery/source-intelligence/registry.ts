// Country registry + Source registry + contextual source mappings.
// SOURCE = where business information originates (e.g. a hotel association's
// member directory). This is distinct from PROVIDER (the retrieval mechanism,
// e.g. Firecrawl/Serper — see lib/providers/*). Colombia is the first serious
// profile; the framework is reusable for other countries.
import type { BusinessModel, CommercialRoute, IndustryLabel, OpportunityMechanism } from "./taxonomy";

// ─── Country registry ─────────────────────────────────────────────────────────
export interface CountryProfile {
  code: string; name: string; primary_languages: string[]; business_language_variants: string[];
  national_registries: string[]; chambers: string[]; sector_associations: string[];
  tourism_business_directories: string[]; trade_organizations: string[]; regulatory_surfaces: string[];
  ecommerce_ecosystems: string[]; commercial_directories: string[]; structured_data_availability: "high" | "medium" | "low";
  search_engine_characteristics: string; known_access_restrictions: string[]; typical_source_freshness: string;
  source_quality_notes: string;
}
export const COLOMBIA: CountryProfile = {
  code: "CO", name: "Colombia", primary_languages: ["es"], business_language_variants: ["es-CO"],
  national_registries: ["RUES (Registro Único Empresarial y Social)", "Cámara de Comercio filings"],
  chambers: ["Cámara de Comercio de Bogotá", "Cámara de Comercio de Medellín para Antioquia", "Cámara de Comercio de Cali", "Confecámaras"],
  sector_associations: ["Cotelco (hotelería)", "Fenalco (comercio)", "ANDI (industria)", "ANATO (turismo)", "ACODRES (gastronomía)", "Cámara Colombiana de Comercio Electrónico (CCCE)"],
  tourism_business_directories: ["Registro Nacional de Turismo (RNT)", "Colombia.travel", "Cotelco directorio"],
  trade_organizations: ["ProColombia", "Marca País Colombia"],
  regulatory_surfaces: ["INVIMA (sanitario)", "RUES", "DIAN (RUT)"],
  ecommerce_ecosystems: ["MercadoLibre Colombia", "Tiendas VTEX/Shopify locales", "Linio (histórico)"],
  commercial_directories: ["Páginas Amarillas", "Guía de proveedores sectoriales", "directorios de cámaras"],
  structured_data_availability: "medium",
  search_engine_characteristics: "Google.com.co dominant; strong local-language results; directory sites rank well.",
  known_access_restrictions: ["Some registry data behind paid certificates", "Association directories may gate member details"],
  typical_source_freshness: "Association/registry data updated periodically; official sites current; marketplaces very fresh.",
  source_quality_notes: "Official associations (Cotelco, Fenalco, ANDI) offer high buyer-model density; RNT/RUES strong for identity; search engines best as gap-fillers.",
};
export const COUNTRY_REGISTRY: Record<string, CountryProfile> = { CO: COLOMBIA };
// Future markets are additions, not rewrites:
export const PLANNED_COUNTRIES = ["MX", "US", "ES", "CL", "AR", "PE", "BR"] as const;

// ─── Source roles / ecosystems / priority states ──────────────────────────────
export const SOURCE_ROLES = [
  "DISCOVERY_SOURCE", "IDENTITY_SOURCE", "BUSINESS_MODEL_SOURCE", "EVIDENCE_SOURCE",
  "SIGNAL_SOURCE", "COVERAGE_SOURCE", "VALIDATION_SOURCE",
] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];

export const SOURCE_ECOSYSTEMS = [
  "official_registries", "industry_associations", "chambers_of_commerce", "membership_directories",
  "tourism_directories", "hotel_collections", "store_locators", "marketplaces", "exhibitor_directories",
  "conference_participants", "supplier_directories", "distributor_directories", "multibrand_catalogs",
  "ecommerce_ecosystems", "professional_directories", "trade_publications", "search_engines", "news",
  "company_websites", "partner_pages",
] as const;
export type SourceEcosystem = (typeof SOURCE_ECOSYSTEMS)[number];

export const SOURCE_PRIORITY_TIERS = [
  "tier_1_primary", "tier_2_secondary", "tier_3_gap_filler", "tier_4_signal_only",
  "low_priority", "avoid", "inaccessible", "deprecated",
] as const;
export type SourcePriorityTier = (typeof SOURCE_PRIORITY_TIERS)[number];

export const SOURCE_CONFIDENCE_STATES = [
  "hypothesized", "manually_validated", "benchmarked", "historically_effective", "degraded", "unreliable",
] as const;
export type SourceConfidence = (typeof SOURCE_CONFIDENCE_STATES)[number];

// Explainable priority dimensions (never a single opaque score).
export interface SourcePriorityDimensions {
  authority: number; entity_density: number; buyer_compatibility_yield: number; official_domain_yield: number;
  evidence_yield: number; novelty_yield: number; freshness: number; extraction_reliability: number;
  cost_efficiency: number; historical_portfolio_yield: number | null; // null ⇒ awaiting_real_outcomes
}

export interface SourceRegistryEntry {
  id: string; name: string; domain: string | null; country_scope: string[]; geographic_scope: string;
  industry_labels: IndustryLabel[]; business_model_labels: BusinessModel[]; route_labels: CommercialRoute[];
  ecosystem: SourceEcosystem; roles: SourceRole[]; source_type: string; access_method: "structured" | "semi_structured" | "unstructured";
  authentication_required: boolean; robots_notes: string; parsing_method: string;
  expected_entity_density: "high" | "medium" | "low"; expected_domain_availability: "high" | "medium" | "low";
  expected_freshness: "high" | "medium" | "low"; expected_authority: "high" | "medium" | "low"; expected_noise: "high" | "medium" | "low";
  typical_use_cases: string[]; last_validated: string | null; active: boolean; confidence: SourceConfidence;
}

// Colombia source registry — research-backed ecosystems for major B2B patterns.
export const COLOMBIA_SOURCES: SourceRegistryEntry[] = [
  { id: "co_rues", name: "RUES — Registro Único Empresarial y Social", domain: "rues.org.co", country_scope: ["CO"], geographic_scope: "national",
    industry_labels: ["manufacturing", "distribution", "specialty_retail", "professional_services", "wholesale"], business_model_labels: ["manufacturer", "distributor", "retailer", "wholesaler", "service_provider"],
    route_labels: ["procurement", "wholesale_distribution", "retail_listing"], ecosystem: "official_registries", roles: ["IDENTITY_SOURCE", "VALIDATION_SOURCE", "COVERAGE_SOURCE"], source_type: "government_registry", access_method: "semi_structured",
    authentication_required: false, robots_notes: "Public search; some certificates paid.", parsing_method: "structured search + detail pages", expected_entity_density: "high", expected_domain_availability: "low", expected_freshness: "medium", expected_authority: "high", expected_noise: "low",
    typical_use_cases: ["Confirm legal identity", "Validate NIT/registration", "Broad coverage universe"], last_validated: null, active: true, confidence: "hypothesized" },
  { id: "co_cotelco", name: "Cotelco — Asociación Hotelera y Turística", domain: "cotelco.org", country_scope: ["CO"], geographic_scope: "national",
    industry_labels: ["hospitality", "hotels", "boutique_hospitality", "spa", "tourism"], business_model_labels: ["hotel_operator", "spa_operator", "hospitality_group", "association"],
    route_labels: ["hospitality_guest_experience", "spa_integration"], ecosystem: "industry_associations", roles: ["DISCOVERY_SOURCE", "BUSINESS_MODEL_SOURCE", "COVERAGE_SOURCE"], source_type: "association_directory", access_method: "semi_structured",
    authentication_required: false, robots_notes: "Member directory partly public.", parsing_method: "member directory pages", expected_entity_density: "high", expected_domain_availability: "medium", expected_freshness: "medium", expected_authority: "high", expected_noise: "low",
    typical_use_cases: ["Find hotels/spas with buyer models", "Route hospitality discovery"], last_validated: null, active: true, confidence: "hypothesized" },
  { id: "co_rnt", name: "Registro Nacional de Turismo (RNT)", domain: "rnt.confecamaras.co", country_scope: ["CO"], geographic_scope: "national",
    industry_labels: ["tourism", "hospitality", "hotels", "resorts"], business_model_labels: ["hotel_operator", "hospitality_group", "service_provider"],
    route_labels: ["hospitality_guest_experience"], ecosystem: "tourism_directories", roles: ["IDENTITY_SOURCE", "COVERAGE_SOURCE", "VALIDATION_SOURCE"], source_type: "government_registry", access_method: "structured",
    authentication_required: false, robots_notes: "Public registry search.", parsing_method: "registry search", expected_entity_density: "high", expected_domain_availability: "low", expected_freshness: "medium", expected_authority: "high", expected_noise: "low",
    typical_use_cases: ["Confirm active tourism registration", "Universe of registered lodging"], last_validated: null, active: true, confidence: "hypothesized" },
  { id: "co_fenalco", name: "Fenalco — Federación Nacional de Comerciantes", domain: "fenalco.com.co", country_scope: ["CO"], geographic_scope: "national",
    industry_labels: ["specialty_retail", "multi_brand_retail", "natural_products_retail", "food_and_beverage"], business_model_labels: ["retailer", "multi_brand_store", "chain_operator", "association"],
    route_labels: ["retail_listing", "wholesale_distribution"], ecosystem: "industry_associations", roles: ["DISCOVERY_SOURCE", "BUSINESS_MODEL_SOURCE"], source_type: "association_directory", access_method: "semi_structured",
    authentication_required: false, robots_notes: "Affiliate listings partly public.", parsing_method: "affiliate directory", expected_entity_density: "medium", expected_domain_availability: "medium", expected_freshness: "medium", expected_authority: "high", expected_noise: "low",
    typical_use_cases: ["Retail buyer discovery", "Commerce sector mapping"], last_validated: null, active: true, confidence: "hypothesized" },
  { id: "co_andi", name: "ANDI — Asociación Nacional de Industriales", domain: "andi.com.co", country_scope: ["CO"], geographic_scope: "national",
    industry_labels: ["manufacturing", "distribution", "wholesale"], business_model_labels: ["manufacturer", "distributor", "wholesaler", "association"],
    route_labels: ["procurement", "wholesale_distribution", "channel_distribution"], ecosystem: "industry_associations", roles: ["DISCOVERY_SOURCE", "BUSINESS_MODEL_SOURCE"], source_type: "association_directory", access_method: "semi_structured",
    authentication_required: false, robots_notes: "Member chambers partly public.", parsing_method: "member/chamber pages", expected_entity_density: "medium", expected_domain_availability: "medium", expected_freshness: "low", expected_authority: "high", expected_noise: "low",
    typical_use_cases: ["Manufacturer/procurement discovery"], last_validated: null, active: true, confidence: "hypothesized" },
  { id: "co_ccce", name: "Cámara Colombiana de Comercio Electrónico (CCCE)", domain: "ccce.org.co", country_scope: ["CO"], geographic_scope: "national",
    industry_labels: ["ecommerce", "specialty_retail", "multi_brand_retail"], business_model_labels: ["ecommerce_store", "marketplace", "retailer"],
    route_labels: ["ecommerce_listing", "retail_listing"], ecosystem: "ecommerce_ecosystems", roles: ["DISCOVERY_SOURCE", "BUSINESS_MODEL_SOURCE"], source_type: "association_directory", access_method: "semi_structured",
    authentication_required: false, robots_notes: "Member listings partly public.", parsing_method: "member directory", expected_entity_density: "medium", expected_domain_availability: "high", expected_freshness: "medium", expected_authority: "medium", expected_noise: "low",
    typical_use_cases: ["Ecommerce retailer discovery", "Online buyer models"], last_validated: null, active: true, confidence: "hypothesized" },
  { id: "co_mercadolibre", name: "MercadoLibre Colombia", domain: "mercadolibre.com.co", country_scope: ["CO"], geographic_scope: "national",
    industry_labels: ["ecommerce", "multi_brand_retail", "natural_products_retail"], business_model_labels: ["marketplace", "marketplace_seller", "reseller"],
    route_labels: ["ecommerce_listing", "reseller", "retail_listing"], ecosystem: "marketplaces", roles: ["DISCOVERY_SOURCE", "SIGNAL_SOURCE"], source_type: "marketplace", access_method: "unstructured",
    authentication_required: false, robots_notes: "ToS-sensitive; sellers public.", parsing_method: "listing/seller pages", expected_entity_density: "high", expected_domain_availability: "low", expected_freshness: "high", expected_authority: "low", expected_noise: "high",
    typical_use_cases: ["Reseller/seller discovery", "Category presence signal"], last_validated: null, active: true, confidence: "hypothesized" },
  { id: "co_procolombia", name: "ProColombia — directorio de exportadores", domain: "procolombia.co", country_scope: ["CO"], geographic_scope: "national",
    industry_labels: ["manufacturing", "food_and_beverage", "botanical_products", "distribution"], business_model_labels: ["manufacturer", "exporter", "brand_owner"],
    route_labels: ["wholesale_distribution", "procurement", "strategic_partnership"], ecosystem: "supplier_directories", roles: ["DISCOVERY_SOURCE", "BUSINESS_MODEL_SOURCE", "EVIDENCE_SOURCE"], source_type: "trade_directory", access_method: "semi_structured",
    authentication_required: false, robots_notes: "Public exporter profiles.", parsing_method: "exporter profiles", expected_entity_density: "medium", expected_domain_availability: "high", expected_freshness: "medium", expected_authority: "high", expected_noise: "low",
    typical_use_cases: ["Exporter/manufacturer discovery", "Supplier evidence"], last_validated: null, active: true, confidence: "hypothesized" },
  { id: "co_invima", name: "INVIMA — registros sanitarios", domain: "invima.gov.co", country_scope: ["CO"], geographic_scope: "national",
    industry_labels: ["health_and_wellness", "botanical_products", "food_and_beverage", "beauty"], business_model_labels: ["manufacturer", "brand_owner", "importer"],
    route_labels: ["procurement", "retail_listing"], ecosystem: "official_registries", roles: ["VALIDATION_SOURCE", "EVIDENCE_SOURCE"], source_type: "regulator", access_method: "structured",
    authentication_required: false, robots_notes: "Public registry lookup.", parsing_method: "registry lookup", expected_entity_density: "low", expected_domain_availability: "low", expected_freshness: "medium", expected_authority: "high", expected_noise: "low",
    typical_use_cases: ["Validate sanitary registration", "Regulatory evidence for wellness"], last_validated: null, active: true, confidence: "hypothesized" },
  { id: "co_company_sites", name: "Company official websites", domain: null, country_scope: ["CO"], geographic_scope: "national",
    industry_labels: [...([] as IndustryLabel[])], business_model_labels: [], route_labels: [], ecosystem: "company_websites", roles: ["IDENTITY_SOURCE", "BUSINESS_MODEL_SOURCE", "EVIDENCE_SOURCE"], source_type: "company_website", access_method: "unstructured",
    authentication_required: false, robots_notes: "Respect robots.txt.", parsing_method: "page extraction", expected_entity_density: "low", expected_domain_availability: "high", expected_freshness: "high", expected_authority: "high", expected_noise: "low",
    typical_use_cases: ["Confirm identity + official domain", "Business-model + opportunity evidence"], last_validated: null, active: true, confidence: "manually_validated" },
  { id: "co_partner_pages", name: "Partner / location / group pages", domain: null, country_scope: ["CO"], geographic_scope: "national",
    industry_labels: ["hospitality", "boutique_hospitality", "multi_brand_retail"], business_model_labels: ["hospitality_group", "chain_operator", "brand_owner"], route_labels: ["location_rollout", "partnership"], ecosystem: "partner_pages", roles: ["DISCOVERY_SOURCE"], source_type: "company_ecosystem", access_method: "unstructured",
    authentication_required: false, robots_notes: "Respect robots.txt.", parsing_method: "location/partner extraction", expected_entity_density: "medium", expected_domain_availability: "high", expected_freshness: "medium", expected_authority: "medium", expected_noise: "low",
    typical_use_cases: ["Controlled ecosystem expansion from a qualified account"], last_validated: null, active: true, confidence: "hypothesized" },
  { id: "search_engine", name: "General search engine", domain: null, country_scope: ["CO"], geographic_scope: "global",
    industry_labels: [], business_model_labels: [], route_labels: [], ecosystem: "search_engines", roles: ["DISCOVERY_SOURCE", "IDENTITY_SOURCE", "EVIDENCE_SOURCE"], source_type: "search_engine", access_method: "unstructured",
    authentication_required: false, robots_notes: "Provider APIs used.", parsing_method: "SERP", expected_entity_density: "low", expected_domain_availability: "high", expected_freshness: "high", expected_authority: "low", expected_noise: "high",
    typical_use_cases: ["Gap filler", "Domain resolver", "Evidence finder", "Long-tail discovery"], last_validated: null, active: true, confidence: "historically_effective" },
];
export const SOURCE_REGISTRY: Record<string, SourceRegistryEntry[]> = { CO: COLOMBIA_SOURCES };

// ─── Contextual source mappings (country × labels × route × mechanism → tiers) ─
export interface SourceContextMapping {
  id: string; country: string; industry_labels: IndustryLabel[]; business_models: BusinessModel[];
  route: CommercialRoute; mechanism: OpportunityMechanism; tiers: { tier: SourcePriorityTier; source_ids: string[] }[];
  confidence: SourceConfidence; rationale: string;
}
export const COLOMBIA_MAPPINGS: SourceContextMapping[] = [
  { id: "co_hosp_spa_guest", country: "CO", industry_labels: ["hospitality", "spa", "premium_consumer"], business_models: ["hotel_operator"], route: "hospitality_guest_experience", mechanism: "guest_amenity",
    tiers: [{ tier: "tier_1_primary", source_ids: ["co_rnt", "co_cotelco"] }, { tier: "tier_2_secondary", source_ids: ["co_partner_pages", "co_company_sites"] }, { tier: "tier_3_gap_filler", source_ids: ["search_engine"] }, { tier: "tier_4_signal_only", source_ids: ["co_mercadolibre"] }],
    confidence: "hypothesized", rationale: "Structured tourism registry + hotel association carry high buyer-model density for guest-amenity routes; search engines fill gaps and resolve domains." },
  { id: "co_retail_listing", country: "CO", industry_labels: ["natural_products_retail", "specialty_retail", "ecommerce"], business_models: ["retailer", "ecommerce_store", "multi_brand_store"], route: "retail_listing", mechanism: "product_listing",
    tiers: [{ tier: "tier_1_primary", source_ids: ["co_fenalco", "co_ccce"] }, { tier: "tier_2_secondary", source_ids: ["co_company_sites", "co_mercadolibre"] }, { tier: "tier_3_gap_filler", source_ids: ["search_engine"] }, { tier: "low_priority", source_ids: ["co_rues"] }],
    confidence: "hypothesized", rationale: "Retail/ecommerce associations plus ecommerce ecosystems yield differentiated multi-brand buyers; registries add identity coverage only." },
  { id: "co_corporate_gifting", country: "CO", industry_labels: ["corporate_gifting", "gifting", "events"], business_models: ["corporate_gifting_provider"], route: "corporate_gifting", mechanism: "kit_inclusion",
    tiers: [{ tier: "tier_1_primary", source_ids: ["search_engine", "co_ccce"] }, { tier: "tier_2_secondary", source_ids: ["co_company_sites"] }, { tier: "tier_3_gap_filler", source_ids: ["co_mercadolibre"] }],
    confidence: "hypothesized", rationale: "Gifting providers are fragmented with weak association coverage; structured search + company sites lead, ecommerce as signal." },
  { id: "co_manufacturing_procurement", country: "CO", industry_labels: ["manufacturing"], business_models: ["manufacturer"], route: "procurement", mechanism: "procurement_replacement",
    tiers: [{ tier: "tier_1_primary", source_ids: ["co_andi", "co_rues"] }, { tier: "tier_2_secondary", source_ids: ["co_procolombia", "co_company_sites"] }, { tier: "tier_3_gap_filler", source_ids: ["search_engine"] }, { tier: "tier_4_signal_only", source_ids: ["co_invima"] }],
    confidence: "hypothesized", rationale: "Industrial association + registry carry manufacturer density for procurement; export directory adds supplier evidence; regulator validates." },
  { id: "co_distribution", country: "CO", industry_labels: ["distribution", "wholesale"], business_models: ["distributor", "wholesaler"], route: "wholesale_distribution", mechanism: "distribution",
    tiers: [{ tier: "tier_1_primary", source_ids: ["co_andi", "co_procolombia"] }, { tier: "tier_2_secondary", source_ids: ["co_rues", "co_company_sites"] }, { tier: "tier_3_gap_filler", source_ids: ["search_engine"] }],
    confidence: "hypothesized", rationale: "Distributor discovery relies on industrial/trade directories; registries add coverage." },
];
export const SOURCE_MAPPINGS: Record<string, SourceContextMapping[]> = { CO: COLOMBIA_MAPPINGS };
export const REGISTRY_VERSION = "source-intelligence-registry-v1";
