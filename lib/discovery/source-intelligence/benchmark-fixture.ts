// Discovery Engine V2 — deterministic benchmark fixture (Colombia hospitality).
// A CONTROLLED, reproducible candidate universe — NOT a live crawl. It lets us
// measure the discovery PIPELINE (extraction → resolution → validation → funnel)
// with 0 provider calls and no third-party scraping. `truth` fields encode what a
// real source/provider would reveal; the pipeline never "cheats" beyond a source's
// declared visibility (registries expose names not domains, etc.). Known Account
// Memory entities (Éteka, Celestino) appear so novelty suppression is exercised.
export interface FixtureCandidate {
  source_id: string;                 // where the row was seen
  raw_name: string;
  location: string | null;
  category: string | null;           // as the source labels it
  domain_hint: string | null;        // domain the SOURCE exposes (registries: null)
  truth: {
    canonical: string;               // ground-truth canonical name
    canonical_id: string;            // ground-truth canonical id (amor:* if in memory)
    entity_kind: "hotel_property" | "hotel_group" | "association" | "aggregator" | "article" | "non_business";
    official_domain: string | null;  // real official domain (null ⇒ none)
    active: boolean;
    business_model: "hotel_operator" | "spa_operator" | "hospitality_group" | "other" | "none";
    has_spa: boolean;
    route_evidence: "strong" | "plausible" | "weak" | "none";
    geography_ok: boolean;
  };
}

// Rows deliberately overlap across sources (same truth.canonical_id) to exercise
// deduplication, incremental yield and complementarity.
export const COLOMBIA_HOSPITALITY_FIXTURE: FixtureCandidate[] = [
  // ── RNT (registry): high identity coverage, NO domains, some inactive/dupes ──
  { source_id: "co_rnt", raw_name: "ETEKA HOTEL SPA S.A.S.", location: "Cartagena", category: "Establecimiento de alojamiento", domain_hint: null, truth: { canonical: "Éteka", canonical_id: "amor:eteka", entity_kind: "hotel_property", official_domain: "etekacartagena.com", active: true, business_model: "hotel_operator", has_spa: true, route_evidence: "strong", geography_ok: true } },
  { source_id: "co_rnt", raw_name: "HOTEL CELESTINO BOUTIQUE", location: "Medellín", category: "Establecimiento de alojamiento", domain_hint: null, truth: { canonical: "Celestino Hotel Boutique & Spa", canonical_id: "amor:celestino-hotel-boutique-spa", entity_kind: "hotel_property", official_domain: "hotelcelestino.com", active: true, business_model: "hotel_operator", has_spa: true, route_evidence: "strong", geography_ok: true } },
  { source_id: "co_rnt", raw_name: "MASAYA HOSTELS COLOMBIA", location: "Bogotá", category: "Establecimiento de alojamiento", domain_hint: null, truth: { canonical: "Masaya Collection", canonical_id: "amor:masaya-collection", entity_kind: "hotel_group", official_domain: "masaya-experience.com", active: true, business_model: "hospitality_group", has_spa: false, route_evidence: "plausible", geography_ok: true } },
  { source_id: "co_rnt", raw_name: "HOTEL BOUTIQUE CASA LILA", location: "Cartagena", category: "Establecimiento de alojamiento", domain_hint: null, truth: { canonical: "Hotel Boutique Casa Lila", canonical_id: "co:casa-lila", entity_kind: "hotel_property", official_domain: "casalilacartagena.com", active: true, business_model: "hotel_operator", has_spa: true, route_evidence: "plausible", geography_ok: true } },
  { source_id: "co_rnt", raw_name: "HOTEL VERANERA DEL LLANO", location: "Villavicencio", category: "Establecimiento de alojamiento", domain_hint: null, truth: { canonical: "Hotel Veranera del Llano", canonical_id: "co:veranera", entity_kind: "hotel_property", official_domain: "hotelveranera.com", active: true, business_model: "hotel_operator", has_spa: false, route_evidence: "weak", geography_ok: true } },
  { source_id: "co_rnt", raw_name: "POSADA TURISTICA EL DESCANSO", location: "Guatapé", category: "Establecimiento de alojamiento", domain_hint: null, truth: { canonical: "Posada El Descanso", canonical_id: "co:el-descanso", entity_kind: "hotel_property", official_domain: null, active: true, business_model: "hotel_operator", has_spa: false, route_evidence: "weak", geography_ok: true } },
  { source_id: "co_rnt", raw_name: "HOTEL CAMPESTRE LOS ALMENDROS", location: "Montería", category: "Establecimiento de alojamiento", domain_hint: null, truth: { canonical: "Hotel Campestre Los Almendros", canonical_id: "co:almendros", entity_kind: "hotel_property", official_domain: "loshotelesalmendros.co", active: false, business_model: "hotel_operator", has_spa: false, route_evidence: "none", geography_ok: true } },
  { source_id: "co_rnt", raw_name: "SPA URBANO ZEN (registro turístico)", location: "Bogotá", category: "Establecimiento de alojamiento", domain_hint: null, truth: { canonical: "Spa Urbano Zen", canonical_id: "co:zen-spa", entity_kind: "hotel_property", official_domain: "spazen.co", active: true, business_model: "spa_operator", has_spa: true, route_evidence: "plausible", geography_ok: true } },

  // ── Cotelco (association): buyer-model rich, medium domains, overlaps RNT ──
  { source_id: "co_cotelco", raw_name: "Hotel Spa Éteka", location: "Cartagena", category: "Hotel afiliado", domain_hint: "etekacartagena.com", truth: { canonical: "Éteka", canonical_id: "amor:eteka", entity_kind: "hotel_property", official_domain: "etekacartagena.com", active: true, business_model: "hotel_operator", has_spa: true, route_evidence: "strong", geography_ok: true } },
  { source_id: "co_cotelco", raw_name: "Hotel Celestino Boutique & Spa", location: "Medellín", category: "Hotel afiliado", domain_hint: "hotelcelestino.com", truth: { canonical: "Celestino Hotel Boutique & Spa", canonical_id: "amor:celestino-hotel-boutique-spa", entity_kind: "hotel_property", official_domain: "hotelcelestino.com", active: true, business_model: "hotel_operator", has_spa: true, route_evidence: "strong", geography_ok: true } },
  { source_id: "co_cotelco", raw_name: "Hacienda Bambusa Hotel Boutique", location: "Armenia", category: "Hotel afiliado", domain_hint: "haciendabambusa.com", truth: { canonical: "Hacienda Bambusa", canonical_id: "co:bambusa", entity_kind: "hotel_property", official_domain: "haciendabambusa.com", active: true, business_model: "hotel_operator", has_spa: true, route_evidence: "strong", geography_ok: true } },
  { source_id: "co_cotelco", raw_name: "Estelar Hoteles (grupo)", location: "Nacional", category: "Cadena afiliada", domain_hint: "hotelesestelar.com", truth: { canonical: "Hoteles Estelar", canonical_id: "co:estelar", entity_kind: "hotel_group", official_domain: "hotelesestelar.com", active: true, business_model: "hospitality_group", has_spa: true, route_evidence: "plausible", geography_ok: true } },
  { source_id: "co_cotelco", raw_name: "Hotel Boutique Casa Lila Cartagena", location: "Cartagena", category: "Hotel afiliado", domain_hint: "casalilacartagena.com", truth: { canonical: "Hotel Boutique Casa Lila", canonical_id: "co:casa-lila", entity_kind: "hotel_property", official_domain: "casalilacartagena.com", active: true, business_model: "hotel_operator", has_spa: true, route_evidence: "plausible", geography_ok: true } },
  { source_id: "co_cotelco", raw_name: "Sofitel Legend Santa Clara", location: "Cartagena", category: "Hotel afiliado", domain_hint: "sofitel-legend-santaclara.com", truth: { canonical: "Sofitel Legend Santa Clara", canonical_id: "co:sofitel-santaclara", entity_kind: "hotel_property", official_domain: "sofitel-legend-santaclara.com", active: true, business_model: "hotel_operator", has_spa: true, route_evidence: "strong", geography_ok: true } },
  { source_id: "co_cotelco", raw_name: "Cotelco — Asociación Hotelera", location: "Bogotá", category: "Asociación", domain_hint: "cotelco.org", truth: { canonical: "Cotelco", canonical_id: "co:cotelco", entity_kind: "association", official_domain: "cotelco.org", active: true, business_model: "none", has_spa: false, route_evidence: "none", geography_ok: true } },

  // ── Search engine: broad + noisy (articles, aggregators), some unique hotels ──
  { source_id: "search_engine", raw_name: "Los 10 mejores hoteles con spa en Cartagena — TripAdvisor", location: "Cartagena", category: "Article", domain_hint: "tripadvisor.com", truth: { canonical: "TripAdvisor listicle", canonical_id: "web:tripadvisor-listicle", entity_kind: "article", official_domain: null, active: true, business_model: "none", has_spa: false, route_evidence: "none", geography_ok: true } },
  { source_id: "search_engine", raw_name: "Booking.com — Hoteles spa Colombia", location: "Colombia", category: "Aggregator", domain_hint: "booking.com", truth: { canonical: "Booking.com", canonical_id: "web:booking", entity_kind: "aggregator", official_domain: null, active: true, business_model: "none", has_spa: false, route_evidence: "none", geography_ok: true } },
  { source_id: "search_engine", raw_name: "Hotel Spa Éteka Cartagena", location: "Cartagena", category: "Company", domain_hint: "etekacartagena.com", truth: { canonical: "Éteka", canonical_id: "amor:eteka", entity_kind: "hotel_property", official_domain: "etekacartagena.com", active: true, business_model: "hotel_operator", has_spa: true, route_evidence: "strong", geography_ok: true } },
  { source_id: "search_engine", raw_name: "Hotel Charleston Santa Teresa — Spa", location: "Cartagena", category: "Company", domain_hint: "hotelcharlestonsantateresa.com", truth: { canonical: "Hotel Charleston Santa Teresa Spa", canonical_id: "amor:hotel-charleston-santa-teresa-spa", entity_kind: "hotel_property", official_domain: "hotelcharlestonsantateresa.com", active: true, business_model: "hotel_operator", has_spa: true, route_evidence: "strong", geography_ok: true } },
  { source_id: "search_engine", raw_name: "Bioxcel Spa & Wellness Boutique", location: "Bogotá", category: "Company", domain_hint: "bioxcelspa.co", truth: { canonical: "Bioxcel Spa & Wellness", canonical_id: "co:bioxcel", entity_kind: "hotel_property", official_domain: "bioxcelspa.co", active: true, business_model: "spa_operator", has_spa: true, route_evidence: "plausible", geography_ok: true } },
  { source_id: "search_engine", raw_name: "Hotel Marriott Bogotá", location: "Bogotá", category: "Company", domain_hint: "marriott.com", truth: { canonical: "Marriott Bogotá", canonical_id: "co:marriott-bogota", entity_kind: "hotel_property", official_domain: "marriott.com", active: true, business_model: "hotel_operator", has_spa: true, route_evidence: "plausible", geography_ok: true } },
  { source_id: "search_engine", raw_name: "Qué es un hotel boutique — blog de viajes", location: null, category: "Article", domain_hint: "viajablog.co", truth: { canonical: "Travel blog article", canonical_id: "web:viajablog", entity_kind: "article", official_domain: null, active: true, business_model: "none", has_spa: false, route_evidence: "none", geography_ok: true } },
  { source_id: "search_engine", raw_name: "Hotel Boutique Casa Lila (sitio oficial)", location: "Cartagena", category: "Company", domain_hint: "casalilacartagena.com", truth: { canonical: "Hotel Boutique Casa Lila", canonical_id: "co:casa-lila", entity_kind: "hotel_property", official_domain: "casalilacartagena.com", active: true, business_model: "hotel_operator", has_spa: true, route_evidence: "plausible", geography_ok: true } },
  { source_id: "search_engine", raw_name: "Restaurante El Balcón (no es hotel)", location: "Cali", category: "Company", domain_hint: "elbalconcali.co", truth: { canonical: "Restaurante El Balcón", canonical_id: "co:el-balcon", entity_kind: "non_business", official_domain: "elbalconcali.co", active: true, business_model: "other", has_spa: false, route_evidence: "none", geography_ok: true } },
];

export const FIXTURE_ID = "discovery-v2-colombia-hospitality-001";
export const FIXTURE_VERSION = "fixture-v1";
