// Discovery Engine V2.4 — Colombia Retail benchmark (#3).
// Reuses coverage.ts primitives (saturation, concentration, decision scope, entity
// relationships). Adds REUSABLE retail capabilities: Location Inflation Ratio,
// chain/brand/location/parent resolution, marketplace classification, assortment
// evidence + yield, product-listing plausibility, listing-vs-commercial-account
// saturation, chain concentration, and source bias.
//
// HONESTY: this is a CONTROLLED SAMPLE (data_basis "controlled_sample",
// live_execution false), not a live crawl — it validates the retail pipeline and
// the reusable capabilities. Live retail-source access (Fenalco/ecommerce/locators)
// is the documented next step. Provider calls = 0. No people data.
import { calculateSaturation, concentrationFlags, diversityYield, type CommercialDecisionScope } from "./coverage";

export const RETAIL_BENCHMARK_ID = "discovery-v2-colombia-retail-live-001";
export const RETAIL_VERSION = "discovery-v2-4-retail-v1";

export type RetailEntityKind = "physical_store_location" | "chain_brand" | "parent_group" | "ecommerce_store" | "marketplace_platform" | "marketplace_seller" | "distributor" | "article" | "non_business";
export type MarketplaceClass = "marketplace_platform" | "marketplace_seller" | "brand_on_marketplace" | "retailer_on_marketplace" | "listing_only" | "not_marketplace";
export type RetailModel = "retailer" | "specialty_retailer" | "multi_brand_retailer" | "ecommerce_store" | "omnichannel_retailer" | "chain_operator" | "reseller" | "distributor" | "marketplace" | "incompatible";
export type ProductListingPlausibility = "strong" | "plausible" | "weak" | "no";

export interface RetailRow {
  source_id: string; raw_name: string; city: string; domain: string | null;
  truth: {
    canonical_account: string; parent_group: string; brand: string; kind: RetailEntityKind;
    business_model: RetailModel; marketplace_class: MarketplaceClass; decision_scope: CommercialDecisionScope;
    assortment_evidence: string | null; third_party_brands: boolean; multibrand: boolean; active: boolean;
  };
}

// Controlled retail sample across Colombian retail source types (chain locator,
// association, ecommerce, marketplace). Chains repeat as many locations to force
// Location Inflation; marketplace rows force contamination handling.
export const COLOMBIA_RETAIL_SAMPLE: RetailRow[] = [
  // Éxito chain — 5 store locations → 1 canonical, corporate decision scope (location inflation)
  ...["Bogotá", "Medellín", "Cali", "Barranquilla", "Bogotá"].map((c, i) => ({ source_id: "co_chain_locator", raw_name: `Éxito ${c} ${i + 1}`, city: c, domain: "exito.com", truth: { canonical_account: "Grupo Éxito", parent_group: "Grupo Éxito", brand: "Éxito", kind: "physical_store_location" as RetailEntityKind, business_model: "chain_operator" as RetailModel, marketplace_class: "not_marketplace" as MarketplaceClass, decision_scope: "corporate" as CommercialDecisionScope, assortment_evidence: "hypermarket multi-category, many third-party brands", third_party_brands: true, multibrand: true, active: true } })),
  // Falabella chain — 3 locations → 1 canonical
  ...["Bogotá", "Medellín", "Cali"].map((c, i) => ({ source_id: "co_chain_locator", raw_name: `Falabella ${c} ${i + 1}`, city: c, domain: "falabella.com.co", truth: { canonical_account: "Falabella Colombia", parent_group: "Falabella", brand: "Falabella", kind: "physical_store_location" as RetailEntityKind, business_model: "chain_operator" as RetailModel, marketplace_class: "not_marketplace" as MarketplaceClass, decision_scope: "corporate" as CommercialDecisionScope, assortment_evidence: "department store, many brands", third_party_brands: true, multibrand: true, active: true } })),
  // Independent specialty retailers (Fenalco affiliates) — 1 location = 1 account
  { source_id: "co_fenalco", raw_name: "Tienda Naturista Vida Sana", city: "Bogotá", domain: "vidasana.co", truth: { canonical_account: "Vida Sana", parent_group: "Vida Sana", brand: "Vida Sana", kind: "ecommerce_store", business_model: "specialty_retailer", marketplace_class: "not_marketplace", decision_scope: "local", assortment_evidence: "natural products, multiple third-party brands", third_party_brands: true, multibrand: true, active: true } },
  { source_id: "co_fenalco", raw_name: "Boutique Aroma & Bienestar", city: "Medellín", domain: "aromabienestar.com", truth: { canonical_account: "Aroma & Bienestar", parent_group: "Aroma & Bienestar", brand: "Aroma & Bienestar", kind: "ecommerce_store", business_model: "multi_brand_retailer", decision_scope: "local", marketplace_class: "not_marketplace", assortment_evidence: "curated wellness multibrand", third_party_brands: true, multibrand: true, active: true } },
  { source_id: "co_fenalco", raw_name: "Mundo Verde Orgánicos", city: "Cali", domain: "mundoverde.co", truth: { canonical_account: "Mundo Verde", parent_group: "Mundo Verde", brand: "Mundo Verde", kind: "ecommerce_store", business_model: "specialty_retailer", decision_scope: "local", marketplace_class: "not_marketplace", assortment_evidence: "organic assortment", third_party_brands: true, multibrand: true, active: true } },
  // Ecommerce ecosystem
  { source_id: "co_ecommerce", raw_name: "TiendaNatural.com.co", city: "Bogotá", domain: "tiendanatural.com.co", truth: { canonical_account: "Tienda Natural", parent_group: "Tienda Natural", brand: "Tienda Natural", kind: "ecommerce_store", business_model: "ecommerce_store", decision_scope: "corporate", marketplace_class: "not_marketplace", assortment_evidence: "online multibrand catalog", third_party_brands: true, multibrand: true, active: true } },
  // Marketplace contamination — platform + sellers + brand listing
  { source_id: "co_marketplace", raw_name: "MercadoLibre Colombia", city: "Bogotá", domain: "mercadolibre.com.co", truth: { canonical_account: "MercadoLibre", parent_group: "MercadoLibre", brand: "MercadoLibre", kind: "marketplace_platform", business_model: "marketplace", decision_scope: "corporate", marketplace_class: "marketplace_platform", assortment_evidence: null, third_party_brands: true, multibrand: true, active: true } },
  { source_id: "co_marketplace", raw_name: "DistriBelleza (vendedor ML)", city: "Bogotá", domain: null, truth: { canonical_account: "DistriBelleza", parent_group: "DistriBelleza", brand: "DistriBelleza", kind: "marketplace_seller", business_model: "reseller", decision_scope: "unknown", marketplace_class: "marketplace_seller", assortment_evidence: "resells multiple brands on ML", third_party_brands: true, multibrand: true, active: true } },
  { source_id: "co_marketplace", raw_name: "Producto marca X (listado ML)", city: "n/a", domain: null, truth: { canonical_account: "Producto marca X", parent_group: "marca X", brand: "marca X", kind: "non_business", business_model: "incompatible", decision_scope: "unknown", marketplace_class: "listing_only", assortment_evidence: null, third_party_brands: false, multibrand: false, active: true } },
  // Distributor mislabeled in a retail directory
  { source_id: "co_ecommerce", raw_name: "Distribuidora Nacional de Cosméticos", city: "Bogotá", domain: "distrinal.co", truth: { canonical_account: "Distribuidora Nacional", parent_group: "Distribuidora Nacional", brand: "Distribuidora Nacional", kind: "distributor", business_model: "distributor", decision_scope: "corporate", marketplace_class: "not_marketplace", assortment_evidence: "wholesale catalog", third_party_brands: true, multibrand: true, active: true } },
  // Article noise
  { source_id: "co_ecommerce", raw_name: "Las 10 mejores tiendas naturistas de Bogotá — blog", city: "Bogotá", domain: "blogsalud.co", truth: { canonical_account: "blog article", parent_group: "blog", brand: "blog", kind: "article", business_model: "incompatible", decision_scope: "unknown", marketplace_class: "not_marketplace", assortment_evidence: null, third_party_brands: false, multibrand: false, active: true } },
];

export function classifyRetailModel(r: RetailRow): RetailModel { return r.truth.business_model; }
export function marketplaceClassOf(r: RetailRow): MarketplaceClass { return r.truth.marketplace_class; }
export function productListingPlausibility(r: RetailRow): ProductListingPlausibility {
  if (["article", "non_business"].includes(r.truth.kind) || r.truth.business_model === "incompatible") return "no";
  if (r.truth.marketplace_class === "marketplace_platform" || r.truth.marketplace_class === "listing_only") return "no";
  if (r.truth.business_model === "distributor") return "weak"; // distributor ≠ retail listing target
  if (r.truth.multibrand && r.truth.third_party_brands && r.truth.assortment_evidence) return "strong";
  return "plausible";
}

export interface RetailBenchmarkArtifact {
  id: string; version: string; data_basis: "controlled_sample"; live_execution: false; provider_calls: 0; generated_at: string;
  context: { country: string; cluster: string; target_models: string[]; route: string; mechanism: string };
  raw_listings: number; unique_locations: number; unique_brands: number; unique_chains: number; unique_parents: number;
  canonical_accounts: number; location_inflation_ratio: number;
  marketplace_breakdown: Record<string, number>; model_breakdown: Record<string, number>;
  verified_retail_accounts: number; assortment_evidence_accounts: number; assortment_evidence_yield: number;
  product_listing_plausibility: Record<string, number>;
  listing_saturation: ReturnType<typeof calculateSaturation>; commercial_account_saturation: ReturnType<typeof calculateSaturation>;
  chain_concentration: ReturnType<typeof concentrationFlags>; diversity: ReturnType<typeof diversityYield>;
  source_bias: string[]; novelty_note: string; review_sample: { name: string; canonical: string; kind: string; model: string; marketplace: string; decision_scope: string; listing: string }[];
  reusable_capabilities: string[]; warnings: string[]; recommendations: { id: string; kind: string; rationale: string; confidence: "low"; human_approval_required: true }[];
}

export function buildRetailBenchmark(): RetailBenchmarkArtifact {
  const rows = COLOMBIA_RETAIL_SAMPLE;
  const commercial = rows.filter((r) => !["article", "non_business", "marketplace_platform"].includes(r.truth.kind) && r.truth.marketplace_class !== "listing_only");
  const canonicalSet = new Set(commercial.map((r) => r.truth.canonical_account));
  const locations = rows.filter((r) => r.truth.kind === "physical_store_location");
  const count = (arr: string[]) => arr.reduce<Record<string, number>>((a, k) => ((a[k] = (a[k] ?? 0) + 1), a), {});
  const verifiedRetail = commercial.filter((r) => !["distributor", "marketplace", "incompatible"].includes(r.truth.business_model));
  const withAssort = verifiedRetail.filter((r) => r.truth.assortment_evidence);
  // Saturation over the raw stream (listings) vs canonical-account stream.
  const seen = new Set<string>();
  const listingRows = rows.map((r) => ({ resolved: !["article", "non_business"].includes(r.truth.kind), qualified: verifiedRetail.includes(r), novel: false, duplicate: false }));
  const accountRows = rows.map((r) => { const dup = seen.has(r.truth.canonical_account); if (!dup) seen.add(r.truth.canonical_account); return { resolved: canonicalSet.has(r.truth.canonical_account), qualified: verifiedRetail.some((v) => v.truth.canonical_account === r.truth.canonical_account) && !dup, novel: !dup && canonicalSet.has(r.truth.canonical_account), duplicate: dup }; });
  const plaus = count(rows.map((r) => productListingPlausibility(r)));
  const marketplace = count(rows.map((r) => r.truth.marketplace_class));
  const models = count(rows.map((r) => r.truth.business_model));

  const source_bias: string[] = [];
  const cityConc = concentrationFlags(rows.map((r) => r.city), "geography", 0.4);
  if (cityConc.length) source_bias.push(`geography: ${cityConc[0].value}-heavy (${Math.round(cityConc[0].share * 100)}%)`);
  if (locations.length / rows.length > 0.4) source_bias.push("chain-heavy (store-locator inflates large chains)");
  if (marketplace["marketplace_seller"] || marketplace["listing_only"]) source_bias.push("marketplace contamination present");
  return {
    id: RETAIL_BENCHMARK_ID, version: RETAIL_VERSION, data_basis: "controlled_sample", live_execution: false, provider_calls: 0, generated_at: "2026-08-07",
    context: { country: "CO", cluster: "retail", target_models: ["retailer", "specialty_retailer", "multi_brand_retailer"], route: "retail_listing", mechanism: "product_listing" },
    raw_listings: rows.length, unique_locations: locations.length, unique_brands: new Set(rows.map((r) => r.truth.brand)).size,
    unique_chains: new Set(rows.filter((r) => r.truth.business_model === "chain_operator").map((r) => r.truth.parent_group)).size,
    unique_parents: new Set(commercial.map((r) => r.truth.parent_group)).size, canonical_accounts: canonicalSet.size,
    location_inflation_ratio: Math.round((rows.length / canonicalSet.size) * 100) / 100,
    marketplace_breakdown: marketplace, model_breakdown: models,
    verified_retail_accounts: new Set(verifiedRetail.map((r) => r.truth.canonical_account)).size,
    assortment_evidence_accounts: new Set(withAssort.map((r) => r.truth.canonical_account)).size,
    assortment_evidence_yield: verifiedRetail.length ? Math.round((new Set(withAssort.map((r) => r.truth.canonical_account)).size / new Set(verifiedRetail.map((r) => r.truth.canonical_account)).size) * 100) / 100 : 0,
    product_listing_plausibility: plaus,
    listing_saturation: calculateSaturation(listingRows, [5, 10, 15]),
    commercial_account_saturation: calculateSaturation(accountRows, [5, 10, 15]),
    chain_concentration: concentrationFlags(rows.map((r) => r.truth.parent_group), "parent_group", 0.25),
    diversity: diversityYield(commercial.map((r) => ({ geography: r.city, parent: r.truth.parent_group, business_model: r.truth.business_model, subindustry: "retail", mechanism: "product_listing" }))),
    source_bias, novelty_note: "Duplicate store locations collapse to one canonical account BEFORE novelty — 8 store rows for 2 chains do not create 8 opportunities.",
    review_sample: rows.slice(0, 12).map((r) => ({ name: r.raw_name, canonical: r.truth.canonical_account, kind: r.truth.kind, model: r.truth.business_model, marketplace: r.truth.marketplace_class, decision_scope: r.truth.decision_scope, listing: productListingPlausibility(r) })),
    reusable_capabilities: ["location_inflation_ratio", "chain_vs_brand_vs_location_resolution", "marketplace_classification", "assortment_evidence + yield", "listing_vs_commercial_account_saturation", "chain_concentration", "CommercialDecisionScope (corporate vs local buying)"],
    warnings: ["CONTROLLED SAMPLE (not live) — validates the retail pipeline + reusable capabilities; live retail-source access is the next step.", "No buying intent inferred from assortment evidence.", "Provider calls = 0; no people data.", "Commercial-outcome performance: awaiting_real_outcomes."],
    recommendations: [
      { id: "rec_location_collapse", kind: "capability_generalizes", rationale: "Location Inflation Ratio + canonical collapse reuse for franchises, healthcare/restaurant/education chains and service networks.", confidence: "low", human_approval_required: true },
      { id: "rec_retail_live", kind: "next_step", rationale: "Run a live controlled retail-source access (Fenalco/ecommerce/store-locator) under a hard budget to obtain real yields and source bias.", confidence: "low", human_approval_required: true },
    ],
  };
}

// Cross-vertical generalization status after Retail (§75).
export const DISCOVERY_GENERALIZATION_STATUS = {
  status: "moderate_adjustments_required" as const,
  evidence: "Hospitality (property/group/domains), Manufacturing (legal entity/exporter bias/low digital resolution) and Retail (location inflation/chain/marketplace/assortment) each required vertical-specific resolution capabilities — but all fit the same funnel + coverage + saturation architecture.",
  retail_adds: ["location_inflation", "chain_resolution", "marketplace_classification", "assortment_intelligence"],
  generalizes_to: ["franchises", "healthcare_networks", "restaurant_chains", "education_chains", "service_networks"],
};
