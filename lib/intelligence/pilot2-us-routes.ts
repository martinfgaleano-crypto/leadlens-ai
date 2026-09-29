// Pilot 2 — US market-entry routes + export/import dependencies as STRUCTURED data (§30), so the Admin,
// deliverables and the fresh-quota discovery plan all read one source, not prose. Route decisions use the
// canonical semantics (prioritize/validate/monitor/hold). Dependencies are a COMMERCIAL map, not legal advice.

export type RouteDecision = "prioritize" | "validate" | "monitor" | "hold";

export interface UsRoute {
  route: string;
  decision: RouteDecision;
  buyer_function: string;
  purchase_mechanism: string;
  import_model: string;
  moq_fit: string;
  glass_logistics: string;
  economics_questions: string[];
  unknowns: string;
  changes_decision: string;
  // Route-specific discovery query seeds for the next fresh-quota run (§34) — diverse, not one family.
  discovery_queries: string[];
}

export const PILOT2_US_ROUTES: UsRoute[] = [
  {
    route: "Specialty importer / distributor", decision: "validate",
    buyer_function: "Category / procurement buyer at the importer", purchase_mechanism: "Distributor/importer onboarding",
    import_model: "Importer of record + FSVP", moq_fit: "Best fit — importer absorbs first international shipment",
    glass_logistics: "Importer warehouse handles glass; consolidates freight",
    economics_questions: ["Importer margin layer", "Landed cost vs premium shelf price", "Reorder cadence"],
    unknowns: "Which importer carries Colombian premium botanicals; slotting", changes_decision: "An importer already carrying comparable premium imported wellness brands",
    discovery_queries: ["specialty food importer premium natural brands US", "wellness beverage distributor imported brands", "Latin American specialty food importer United States"],
  },
  {
    route: "Premium / natural & specialty retail", decision: "validate",
    buyer_function: "Category buyer / grocery buyer", purchase_mechanism: "Retail vendor onboarding (usually via distributor)",
    import_model: "Typically distributor-fronted", moq_fit: "Moderate — retail expects a distributor in front",
    glass_logistics: "Glass fine on shelf; DC receiving requirements", economics_questions: ["Retail margin", "Distributor cut", "Promo/slotting"],
    unknowns: "Direct-vs-distributor entry; shelf economics under landed cost", changes_decision: "A specialty retailer with a direct-import program",
    discovery_queries: ["premium natural specialty grocery retailer US", "wellness beverage specialty retail buyer", "organic specialty food retailer imported brands"],
  },
  {
    route: "Wellness hospitality / hotel & spa", decision: "monitor",
    buyer_function: "F&B / spa procurement; group vs property", purchase_mechanism: "Hospitality procurement",
    import_model: "Via distributor or approved-vendor list", moq_fit: "Small per-property; gifting/amenity",
    glass_logistics: "Glass acceptable for amenity; case-pack matters", economics_questions: ["Per-property volume", "Amenity vs retail pricing"],
    unknowns: "Property autonomy vs group procurement", changes_decision: "A wellness-forward group with a vendor-intake program",
    discovery_queries: ["wellness hotel spa amenity vendor US", "luxury spa botanical product procurement", "wellness resort in-room amenity supplier"],
  },
  {
    route: "Premium & corporate gifting", decision: "monitor",
    buyer_function: "Gifting/merchandising buyer", purchase_mechanism: "Gifting vendor / kit assembly",
    import_model: "Via importer for the product component", moq_fit: "Seasonal batches; personalization fits (sleeve/box/kit)",
    glass_logistics: "Glass fits premium gift; breakage in kitting", economics_questions: ["Seasonality", "Kit margin", "Personalization cost"],
    unknowns: "Ingestible acceptance in gifting; volume", changes_decision: "A premium gifting company running wellness kits",
    discovery_queries: ["premium corporate gifting company wellness kits US", "luxury gift box curator natural products", "corporate wellness gifting vendor"],
  },
  {
    route: "Boutique / Latin-American specialty", decision: "monitor",
    buyer_function: "Owner/buyer", purchase_mechanism: "Direct or small distributor",
    import_model: "Small importer / direct", moq_fit: "Small orders; fragmented", glass_logistics: "Manual handling; higher per-unit freight",
    economics_questions: ["Small-order economics", "Direct vs importer"], unknowns: "Fragmented buyers; evidence availability",
    changes_decision: "A Latin specialty distributor with a premium tier", discovery_queries: ["Latin American specialty food distributor US premium", "Colombian brands importer United States", "premium Hispanic specialty retailer buyer"],
  },
  {
    route: "Direct B2B wholesale / regional distribution", decision: "hold",
    buyer_function: "Wholesale buyer", purchase_mechanism: "Direct wholesale", import_model: "Requires importer of record regardless",
    moq_fit: "Heavy for a first-time exporter", glass_logistics: "Full freight burden on seller", economics_questions: ["Who is importer of record"],
    unknowns: "Requires importer-of-record regardless", changes_decision: "A US entity/importer partner is established", discovery_queries: [],
  },
  {
    route: "E-commerce / marketplace adjacency", decision: "hold",
    buyer_function: "n/a (no buyer)", purchase_mechanism: "n/a", import_model: "n/a", moq_fit: "n/a", glass_logistics: "n/a",
    economics_questions: [], unknowns: "Out of scope for a B2B commercial-route pilot", changes_decision: "A named B2B buyer emerges", discovery_queries: [],
  },
];

export type DependencyClass = "VERIFIED APPLICABLE" | "LIKELY APPLICABLE" | "CONDITIONAL ON PRODUCT CLASS" | "NOT CURRENTLY APPLICABLE" | "UNKNOWN / NEEDS SPECIALIST";

export interface ExportDependency { item: string; classification: DependencyClass; commercial_impact: string; }

export const PILOT2_EXPORT_DEPENDENCIES: ExportDependency[] = [
  { item: "US importer of record / FSVP importer", classification: "LIKELY APPLICABLE", commercial_impact: "A US importer/FSVP partner is typically required → the importer/distributor route leads." },
  { item: "FDA facility registration + US agent", classification: "CONDITIONAL ON PRODUCT CLASS", commercial_impact: "If food/beverage or supplement, the producing facility likely registers with FDA + designates a US agent → time/cost before first shipment." },
  { item: "Prior notice of imported shipments", classification: "LIKELY APPLICABLE", commercial_impact: "Each shipment needs prior notice → operational, low commercial risk once set up." },
  { item: "Labeling / nutrition facts / claims / allergens", classification: "CONDITIONAL ON PRODUCT CLASS", commercial_impact: "US label rework (non-medical claims) → time/cost to pilot; personalization must not conflict." },
  { item: "HS classification + duties", classification: "UNKNOWN / NEEDS SPECIALIST", commercial_impact: "Duty rate feeds landed cost → margin stack; confirm for the exact product." },
  { item: "Country-of-origin marking + commercial invoice + packing list", classification: "LIKELY APPLICABLE", commercial_impact: "Standard customs entry docs → low risk, must be complete." },
  { item: "Glass freight / breakage / warehouse handling", classification: "VERIFIED APPLICABLE", commercial_impact: "Raises minimum viable shipment + favors channels/warehouses that handle glass → route + order-size decision." },
  { item: "Colombia: DIAN export declaration, INVIMA (product), origin, ProColombia", classification: "CONDITIONAL ON PRODUCT CLASS", commercial_impact: "Colombian export + sanitary requirements → export-readiness gate before US commercial motion." },
];

// §29 — the single concise founder/customer question to resolve regulatory classification later.
export const PILOT2_CLASSIFICATION_QUESTION =
  "How is Amor de Gea's product currently classified before INVIMA (e.g. bebida/alimento, suplemento dietario, or cosmético), under which registration/authorization category, with a one-line product description — and, optionally, the registration identifier? (We do not infer a legal classification; this determines which US requirements apply.)";
