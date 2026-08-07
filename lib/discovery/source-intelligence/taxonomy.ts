// Country × Industry Source Intelligence — multi-label taxonomies.
// The taxonomy is a GRAPH, not a tree: an entity carries many industry labels,
// business models, routes and mechanisms at once. Purpose is source ROUTING and
// discovery precision, not ontology perfection. Client-agnostic (no Amor de Gea).

// ─── Industry graph (multi-label; no forced single parent) ────────────────────
export const INDUSTRY_LABELS = [
  "hospitality", "boutique_hospitality", "hotels", "resorts", "spa", "wellness",
  "specialty_retail", "natural_products_retail", "ecommerce", "gifting", "corporate_gifting",
  "botanical_products", "beauty", "health_and_wellness", "food_and_beverage", "distribution",
  "wholesale", "manufacturing", "professional_services", "technology", "logistics",
  "healthcare", "tourism", "events", "premium_consumer", "multi_brand_retail",
] as const;
export type IndustryLabel = (typeof INDUSTRY_LABELS)[number];

export const INDUSTRY_RELATION_TYPES = [
  "broader_than", "narrower_than", "adjacent_to", "overlaps_with", "commonly_cooccurs_with", "incompatible_with",
] as const;
export type IndustryRelationType = (typeof INDUSTRY_RELATION_TYPES)[number];
export interface IndustryRelation { from: IndustryLabel; type: IndustryRelationType; to: IndustryLabel; }

// A deliberately partial relation set — extensible, routing-oriented.
export const INDUSTRY_RELATIONS: IndustryRelation[] = [
  { from: "boutique_hospitality", type: "narrower_than", to: "hospitality" },
  { from: "hotels", type: "narrower_than", to: "hospitality" },
  { from: "resorts", type: "narrower_than", to: "hospitality" },
  { from: "spa", type: "overlaps_with", to: "wellness" },
  { from: "spa", type: "commonly_cooccurs_with", to: "boutique_hospitality" },
  { from: "hospitality", type: "commonly_cooccurs_with", to: "tourism" },
  { from: "natural_products_retail", type: "narrower_than", to: "specialty_retail" },
  { from: "natural_products_retail", type: "overlaps_with", to: "wellness" },
  { from: "botanical_products", type: "overlaps_with", to: "natural_products_retail" },
  { from: "specialty_retail", type: "overlaps_with", to: "multi_brand_retail" },
  { from: "ecommerce", type: "adjacent_to", to: "specialty_retail" },
  { from: "corporate_gifting", type: "narrower_than", to: "gifting" },
  { from: "corporate_gifting", type: "adjacent_to", to: "events" },
  { from: "wellness", type: "overlaps_with", to: "health_and_wellness" },
  { from: "premium_consumer", type: "overlaps_with", to: "boutique_hospitality" },
  { from: "wholesale", type: "overlaps_with", to: "distribution" },
  { from: "manufacturing", type: "adjacent_to", to: "distribution" },
  { from: "manufacturing", type: "incompatible_with", to: "boutique_hospitality" },
];
export interface IndustryLabelNode {
  id: IndustryLabel; name: string; aliases: string[]; country_terms?: Record<string, string[]>;
}
export const INDUSTRY_ALIASES: Partial<Record<IndustryLabel, IndustryLabelNode>> = {
  hospitality: { id: "hospitality", name: "Hospitality", aliases: ["hoteles", "hotelería", "alojamiento"], country_terms: { CO: ["hotelería", "hospedaje"] } },
  spa: { id: "spa", name: "Spa & wellness ritual", aliases: ["spa", "bienestar", "wellness spa"], country_terms: { CO: ["spa", "centro de bienestar"] } },
  natural_products_retail: { id: "natural_products_retail", name: "Natural products retail", aliases: ["productos naturales", "tienda naturista"], country_terms: { CO: ["tienda naturista", "productos naturales"] } },
  corporate_gifting: { id: "corporate_gifting", name: "Corporate gifting", aliases: ["regalos corporativos", "kits empresariales"], country_terms: { CO: ["regalos corporativos", "detalles empresariales"] } },
  manufacturing: { id: "manufacturing", name: "Manufacturing", aliases: ["fabricación", "industria", "manufactura"], country_terms: { CO: ["industria", "manufactura"] } },
};
export function relatedLabels(label: IndustryLabel, type?: IndustryRelationType): IndustryLabel[] {
  return INDUSTRY_RELATIONS.filter((r) => r.from === label && (!type || r.type === type)).map((r) => r.to);
}
export function areIncompatible(a: IndustryLabel, b: IndustryLabel): boolean {
  return INDUSTRY_RELATIONS.some((r) => r.type === "incompatible_with" && ((r.from === a && r.to === b) || (r.from === b && r.to === a)));
}

// ─── Business models (multi-label) ────────────────────────────────────────────
export const BUSINESS_MODELS = [
  "retailer", "distributor", "wholesaler", "manufacturer", "marketplace", "hotel_operator",
  "spa_operator", "ecommerce_store", "multi_brand_store", "corporate_gifting_provider",
  "importer", "exporter", "reseller", "service_provider", "chain_operator", "franchise",
  "association", "marketplace_seller", "brand_owner", "hospitality_group",
] as const;
export type BusinessModel = (typeof BUSINESS_MODELS)[number];

// ─── Commercial routes (context-dependent; never a permanent global route) ────
export const COMMERCIAL_ROUTES = [
  "retail_listing", "wholesale_distribution", "corporate_gifting", "hospitality_guest_experience",
  "spa_integration", "co_branding", "private_label", "partnership", "reseller",
  "channel_distribution", "procurement", "strategic_partnership", "location_rollout", "ecommerce_listing",
] as const;
export type CommercialRoute = (typeof COMMERCIAL_ROUTES)[number];

// ─── Opportunity mechanisms (separate from industry) ──────────────────────────
export const OPPORTUNITY_MECHANISMS = [
  "product_listing", "guest_amenity", "retail_add_on", "kit_inclusion", "employee_gifting",
  "client_gifting", "spa_ritual", "resale", "distribution", "seasonal_campaign",
  "regional_expansion", "store_rollout", "partnership_bundle", "procurement_replacement", "supplier_addition",
] as const;
export type OpportunityMechanism = (typeof OPPORTUNITY_MECHANISMS)[number];

// A discovery context: everything the router needs about "what kind of search this is".
export interface DiscoveryContext {
  country: string; // ISO code, e.g. "CO"
  industry_labels: IndustryLabel[];
  business_models: BusinessModel[];
  routes: CommercialRoute[];
  mechanisms: OpportunityMechanism[];
  client_id?: string;
  cycle_id?: string;
  exclusions?: string[]; // canonical account ids to suppress
  freshness_requirement?: "any" | "recent" | "current";
  budget_provider_calls?: number;
}

// A candidate's labels are evidence-backed and context-specific, never permanent truth.
export interface CandidateLabel {
  label: string; kind: "industry" | "business_model" | "route" | "mechanism";
  evidence: string; confidence: "low" | "medium" | "high"; source_id: string | null;
  state: "inferred" | "verified"; client_relevance: boolean; cycle_id: string | null;
}
export const TAXONOMY_VERSION = "source-intelligence-taxonomy-v1";
