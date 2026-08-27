// ─── Vertical Intelligence Packs (vertical-packs-v1) ─────────────────────────
// Reusable, versioned domain expertise per vertical: operations, problems,
// triggers, signal families, query families, materiality hints, counterevidence
// hints, thesis patterns, hard blockers, and a SEED UNIVERSE of real, publicly
// known companies in the vertical/region. Packs are part of the moat (compound
// with every run) AND the deterministic degraded-mode when the LLM is
// unavailable (Anthropic exhausted): needs-map and universe enumeration fall
// back to the pack instead of a weak generic fallback. Seeds are CANDIDATES
// only — every gate (org type, identity, association, fit, materiality,
// counterevidence, adversarial) still applies before anything is emitted.

import type { ICP, LeadSearchCriteria } from "@/types";
import type { NeedsMap, SignalFamily } from "./needs-map";
import type { AccountCommercialRole } from "./account-role";

export const VERTICAL_PACKS_VERSION = "vertical-packs-v1";

export interface VerticalPack {
  id: string;
  name: string;
  match: RegExp;                       // matched against ICP industries + offer
  target_countries?: string[];         // absent = generic; exact country packs never cross markets
  operations: string[];                // operations the buyer must run
  problems: string[];                  // problems the product solves
  triggers: string[];                  // operational triggers that create need
  observable_signals: string[];        // exact public phrases (ES)
  signal_families: SignalFamily[];
  required_operation_terms: string[];
  counterevidence_hints: string[];
  hard_blockers: string[];
  thesis_pattern: string;              // hecho→cambio→fricción→capacidad→condición→acción
  /** Real, publicly known companies operating in the vertical (Colombia).
   *  Candidates only — all verification gates still apply. */
  seed_companies: Array<{ name: string; sector: string; domain?: string; visibility_tier?: "emerging" | "established" | "obvious"; account_role?: AccountCommercialRole }>;
}

const FLEET: VerticalPack = {
  id: "fleet_software",
  name: "Software de gestión de flotas",
  target_countries: ["Colombia"],
  match: /(flota|fleet|transporte de carga|log[ií]stica de transporte|veh[ií]culos|rutas|telemetr)/i,
  operations: ["flota propia de vehículos", "control de rutas", "mantenimiento de vehículos", "distribución propia"],
  problems: ["costos operativos de flota", "rutas ineficientes", "mantenimiento reactivo", "sin visibilidad de vehículos"],
  triggers: ["compra de vehículos", "crecimiento de flota", "nuevos contratos de transporte", "nuevas rutas", "expansión regional", "electrificación de flota"],
  observable_signals: ['"amplió su flota"', '"incorporó vehículos"', '"renovó su flota"', '"nuevo contrato de transporte"', '"nuevas rutas"', '"expansión de operaciones"', '"flota eléctrica"'],
  signal_families: ["fleet_growth", "contract_award", "expansion", "investment", "new_market"],
  required_operation_terms: ["flota", "vehículos", "camiones", "transporte", "distribución"],
  counterevidence_hints: ["transporte tercerizado", "operador logístico externo", "ya usa telemetría", "flota arrendada"],
  hard_blockers: ["sin flota propia", "operación tercerizada", "entidad pública de transporte"],
  thesis_pattern: "La empresa {evento_flota} el {fecha}; esto aumenta la complejidad de rutas/mantenimiento; un software de flotas aporta {capacidad}; validar que la flota sea propia y quién decide tecnología; acción: investigar tamaño de flota y stack antes de contactar.",
  seed_companies: [
    { name: "Coordinadora", sector: "logística y paquetería", domain: "coordinadora.com" }, { name: "Servientrega", sector: "logística y paquetería" },
    { name: "Inter Rapidísimo", sector: "logística y paquetería", domain: "interrapidisimo.com" }, { name: "TCC", sector: "transporte de carga", domain: "tcc.com.co" },
    { name: "Envía", sector: "logística y paquetería" }, { name: "Coltanques", sector: "transporte de carga líquida" },
    { name: "Ditransa", sector: "transporte de carga", domain: "ditransa.com.co" }, { name: "Copetran", sector: "transporte terrestre" },
    { name: "Expreso Bolivariano", sector: "transporte de pasajeros", domain: "bolivariano.com.co" }, { name: "Rápido Ochoa", sector: "transporte terrestre" },
    { name: "Transportes Vigía", sector: "transporte refrigerado" }, { name: "Colvanes", sector: "logística y mensajería" },
    { name: "Berlinas del Fonce", sector: "transporte terrestre" }, { name: "Cootransmagdalena", sector: "transporte de carga" },
    { name: "Transportes Botero Soto", sector: "transporte de carga" }, { name: "Logística de Distribución Sánchez Polo", sector: "transporte de carga" },
  ],
};

const LOGISTICS: VerticalPack = {
  id: "logistics_automation",
  name: "Automatización de bodegas y WMS",
  target_countries: ["Colombia"],
  match: /(bodega|almac[eé]n|warehouse|wms|centro de distribuci[oó]n|log[ií]stica|automatizaci[oó]n|supply chain|picking)/i,
  operations: ["centro de distribución propio", "inventario propio", "operación de picking", "almacenamiento"],
  problems: ["capacidad de bodega insuficiente", "picking ineficiente", "inventario sin integrar", "errores de despacho"],
  triggers: ["nueva bodega", "nuevo centro de distribución", "ampliación de capacidad", "crecimiento ecommerce", "consolidación de operaciones"],
  observable_signals: ['"nuevo centro de distribución"', '"nueva bodega"', '"amplió capacidad"', '"inauguró planta"', '"inversión logística"', '"automatización de bodega"'],
  signal_families: ["new_facility", "capacity", "expansion", "investment", "technology_change"],
  required_operation_terms: ["bodega", "centro de distribución", "planta", "almacén", "inventario"],
  counterevidence_hints: ["logística tercerizada con 3PL", "operador logístico externo", "ya implementó WMS", "bodega arrendada operada por tercero"],
  hard_blockers: ["sin operación logística propia", "operación 100% tercerizada"],
  thesis_pattern: "La empresa {evento_logistico} el {fecha}; esto aumenta la complejidad de inventario y picking entre instalaciones; un WMS/automatización aporta {capacidad}; validar que la instalación sea operada directamente; acción: investigar infraestructura y stack antes de contacto.",
  seed_companies: [
    { name: "Grupo Éxito", sector: "retail", domain: "grupoexito.com.co" }, { name: "Alkosto", sector: "retail", domain: "alkosto.com" },
    { name: "Olímpica", sector: "retail", domain: "olimpica.com" }, { name: "Falabella de Colombia", sector: "retail", domain: "falabella.com.co" },
    { name: "Sodimac Colombia", sector: "retail hogar y construcción", domain: "homecenter.com.co" }, { name: "PriceSmart Colombia", sector: "retail mayorista" },
    { name: "Makro Colombia", sector: "retail mayorista" }, { name: "Koba Colombia", sector: "retail descuento (D1)" },
    { name: "Jerónimo Martins Colombia", sector: "retail descuento (Ara)" }, { name: "Alpina", sector: "alimentos", domain: "alpina.com" },
    { name: "Nutresa", sector: "alimentos" }, { name: "Colombina", sector: "alimentos", domain: "colombina.com" },
    { name: "Bavaria", sector: "bebidas", domain: "bavaria.co" }, { name: "Postobón", sector: "bebidas", domain: "postobon.com" },
    { name: "Quala", sector: "consumo masivo" }, { name: "Corona", sector: "manufactura cerámica" },
    { name: "Solla", sector: "alimentos balanceados" }, { name: "Ramo", sector: "alimentos" },
  ],
};

const OPERATIONAL_SW: VerticalPack = {
  id: "operational_software",
  name: "Software operativo (planificación/integración/inventarios)",
  target_countries: ["Colombia"],
  match: /(manufactura|distribuci[oó]n|planificaci[oó]n|inventarios?|integraci[oó]n|erp|operaciones|producci[oó]n)/i,
  operations: ["plantas de producción", "distribución multi-sede", "inventarios multi-instalación", "operación en expansión"],
  problems: ["complejidad operativa creciente", "sistemas sin integrar", "planificación manual", "inventarios descoordinados"],
  triggers: ["nueva planta", "adquisición", "expansión regional", "entrada a nuevos mercados", "consolidación de operaciones", "transformación digital"],
  observable_signals: ['"nueva planta"', '"adquirió"', '"expansión"', '"transformación digital"', '"invirtió"', '"amplió su capacidad"', '"entra a nuevo mercado"'],
  signal_families: ["acquisition", "new_facility", "expansion", "investment", "new_market", "operational_transformation"],
  required_operation_terms: [],
  counterevidence_hints: ["ya implementó ERP", "proveedor tecnológico actual", "desarrolló solución interna"],
  hard_blockers: ["empresa sin operación productiva o de distribución"],
  thesis_pattern: "La empresa {evento_operativo} el {fecha}; esto multiplica la complejidad de coordinación entre unidades; un software de {capacidad} reduce esa fricción; validar la unidad que ejecuta y su stack; acción: mapear sistemas actuales antes de contacto.",
  seed_companies: [
    { name: "Nutresa", sector: "alimentos" }, { name: "Alpina", sector: "alimentos", domain: "alpina.com" },
    { name: "Colombina", sector: "alimentos", domain: "colombina.com" }, { name: "Corona", sector: "manufactura" },
    { name: "Cementos Argos", sector: "cemento y construcción", domain: "argos.co" }, { name: "Tecnoglass", sector: "manufactura de vidrio", domain: "tecnoglass.com" },
    { name: "Auteco", sector: "ensamble de motocicletas" }, { name: "Fanalca", sector: "manufactura y movilidad" },
    { name: "Leonisa", sector: "confección", domain: "leonisa.com" }, { name: "Crystal", sector: "textil y confección" },
    { name: "Nalsani", sector: "manufactura y retail (Totto)" }, { name: "Manuelita", sector: "agroindustria" },
    { name: "Riopaila Castilla", sector: "agroindustria" }, { name: "Incauca", sector: "agroindustria" },
    { name: "Enka de Colombia", sector: "manufactura de polímeros" }, { name: "Fabricato", sector: "textil" },
  ],
};

const WELLNESS_CHANNELS_US: VerticalPack = {
  id: "wellness_channels_us",
  name: "Canales retail y hospitality para bebidas de bienestar",
  match: /(wellness|wellbeing|bienestar|herbal|botanical|infusion|tea brand|beverage brand|beverage distributor|natural products?|spa|resort|whole foods?)/i,
  target_countries: ["United States"],
  operations: ["retail de productos naturales", "programas de spa y bienestar", "hospitality con oferta de alimentos y bebidas", "curaduría de productos wellness"],
  problems: ["diferenciar la oferta de bienestar", "ampliar surtido funcional", "crear experiencias de wellness", "incorporar bebidas naturales para rutinas de sueño, energía y digestión"],
  triggers: ["apertura de nuevas tiendas", "expansión de resorts o spas", "lanzamiento de programas de bienestar", "ampliación de surtido natural", "alianzas con marcas wellness", "entrada a nuevos mercados"],
  observable_signals: ['"opened a new store"', '"new wellness program"', '"expanded spa"', '"wellness partnership"', '"new resort opening"', '"expanded natural products assortment"'],
  signal_families: ["expansion", "new_facility", "partnership", "new_market", "capacity"],
  required_operation_terms: ["wellness", "natural", "spa", "resort", "hotel", "grocery", "beverage", "retail"],
  counterevidence_hints: ["private label only", "closed locations", "does not accept new suppliers", "food and beverage operated by third party"],
  hard_blockers: ["no consumer wellness or hospitality channel", "defunct or permanently closed", "does not sell or serve ingestible products"],
  thesis_pattern: "La empresa {evento_canal} el {fecha}; el cambio puede crear espacio para una oferta diferenciada de bebidas herbales; validar política de proveedores, requisitos regulatorios y ownership de F&B; acción: investigar el proceso de procurement antes de contactar.",
  seed_companies: [
    { name: "Whole Foods Market", sector: "natural grocery retail", domain: "wholefoodsmarket.com" },
    { name: "Sprouts Farmers Market", sector: "natural grocery retail", domain: "sprouts.com" },
    { name: "Natural Grocers", sector: "natural grocery retail", domain: "naturalgrocers.com" },
    { name: "The Vitamin Shoppe", sector: "wellness retail", domain: "vitaminshoppe.com" },
    { name: "Thrive Market", sector: "online natural products retail", domain: "thrivemarket.com" },
    { name: "Fresh Thyme Market", sector: "natural grocery retail", domain: "freshthyme.com" },
    { name: "Earth Fare", sector: "natural grocery retail", domain: "earthfare.com" },
    { name: "Canyon Ranch", sector: "wellness resorts and spas", domain: "canyonranch.com" },
    { name: "Miraval Resorts", sector: "wellness resorts and spas", domain: "miravalresorts.com" },
    { name: "Auberge Resorts Collection", sector: "luxury hospitality and wellness", domain: "aubergeresorts.com" },
    { name: "Life Time", sector: "health clubs and wellness", domain: "lifetime.life" },
    { name: "Equinox", sector: "fitness and wellness clubs", domain: "equinox.com" },
  ],
};

const WELLNESS_CHANNELS_COLOMBIA: VerticalPack = {
  ...WELLNESS_CHANNELS_US,
  id: "wellness_channels_colombia",
  name: "Canales retail y hospitality para bebidas de bienestar en Colombia",
  target_countries: ["Colombia"],
  observable_signals: ['"abrió nueva tienda"', '"nuevo programa de bienestar"', '"amplió su spa"', '"alianza de bienestar"', '"apertura de hotel"', '"amplió su portafolio natural"'],
  seed_companies: [
    { name: "BioPlaza", sector: "mercado y distribución de productos saludables", domain: "bioplaza.com.co", visibility_tier: "emerging", account_role: "buyer_channel" },
    { name: "Supernat", sector: "cadena de supermercados naturistas", domain: "supermercadonaturista.com", visibility_tier: "emerging", account_role: "buyer_channel" },
    { name: "Fitt Global", sector: "distribución de nutrición y productos naturales", domain: "fittglobal.com", visibility_tier: "emerging", account_role: "buyer_channel" },
    { name: "Alimentos Sostenibles", sector: "mercado saludable y distribución", domain: "alimentossostenibles.co", visibility_tier: "emerging", account_role: "buyer_channel" },
    { name: "Tu Tienda Saludable", sector: "retail de alimentos naturales", domain: "tutiendasaludable.com.co", visibility_tier: "emerging", account_role: "buyer_channel" },
    { name: "MasVital Distribuciones", sector: "distribución de productos de bienestar", domain: "mas-vital.com", visibility_tier: "emerging", account_role: "buyer_channel" },
    { name: "Osana Nutraceutica", sector: "distribución naturista", domain: "osananutraceutica.com", visibility_tier: "emerging", account_role: "buyer_channel" },
    { name: "Fedco", sector: "cadena especializada de belleza y bienestar", domain: "fedco.com.co", visibility_tier: "established", account_role: "buyer_channel" },
    { name: "Laboratorios Funat", sector: "fabricante y marca naturista con distribución nacional", domain: "funat.co", visibility_tier: "established", account_role: "brand_owner" },
    { name: "Evok", sector: "retail de productos naturales y experiencias", domain: "evok.com.co", visibility_tier: "established", account_role: "buyer_channel" },
    { name: "GHL Hoteles", sector: "hotelería", domain: "ghlhoteles.com", visibility_tier: "established", account_role: "hospitality_operator" },
    { name: "Movich Hotels", sector: "hotelería", domain: "movichhotels.com", visibility_tier: "established", account_role: "hospitality_operator" },
    { name: "Grupo Éxito", sector: "retail y supermercados", domain: "grupoexito.com.co", visibility_tier: "obvious", account_role: "buyer_channel" },
    { name: "Carulla", sector: "supermercados premium", domain: "carulla.com", visibility_tier: "obvious", account_role: "buyer_channel" },
    { name: "Olímpica", sector: "retail y supermercados", domain: "olimpica.com", visibility_tier: "obvious", account_role: "buyer_channel" },
    { name: "Farmatodo Colombia", sector: "retail de salud y bienestar", domain: "farmatodo.com.co", visibility_tier: "obvious", account_role: "buyer_channel" },
    { name: "Locatel Colombia", sector: "retail de salud y bienestar", domain: "locatelcolombia.com", visibility_tier: "established", account_role: "buyer_channel" },
    { name: "Cruz Verde Colombia", sector: "retail farmacéutico y bienestar", domain: "cruzverde.com.co", visibility_tier: "obvious", account_role: "buyer_channel" },
  ],
};

export const VERTICAL_PACKS: VerticalPack[] = [FLEET, LOGISTICS, OPERATIONAL_SW, WELLNESS_CHANNELS_COLOMBIA, WELLNESS_CHANNELS_US];

/** Match the best pack for an ICP (industries + offer text). Null if none. */
export function matchVerticalPack(icp: ICP, criteria: LeadSearchCriteria): VerticalPack | null {
  const hay = `${icp.target_industries.join(" ")} ${criteria.offer_summary ?? ""} ${criteria.value_proposition ?? ""}`.toLowerCase();
  const targetCountries = new Set((criteria.target_geography ?? []).map(c => c.trim().toLowerCase()));
  let best: { pack: VerticalPack; hits: number } | null = null;
  for (const p of VERTICAL_PACKS) {
    if (p.target_countries?.length && !p.target_countries.some(c => targetCountries.has(c.toLowerCase()))) continue;
    const hits = (hay.match(new RegExp(p.match.source, "gi")) ?? []).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { pack: p, hits };
  }
  return best?.pack ?? null;
}

/** Deterministic vertical-aware NeedsMap from a pack (degraded-mode quality
 *  far above the generic fallback). */
export function packNeedsMap(pack: VerticalPack, icp: ICP, criteria: LeadSearchCriteria): NeedsMap {
  // The client's own buying signals are first-class: pack expertise complements
  // them, never replaces them (a mixed ICP must not lose "nueva bodega" because
  // the fleet pack won the match).
  const clientSignals = (criteria.buying_signals ?? []).filter(Boolean).map((s) => (s.includes('"') ? s : `"${s}"`));
  return {
    version: "needs-map-v1",
    buyer_problem: pack.problems[0],
    operational_triggers: pack.triggers.slice(0, 8),
    observable_signals: Array.from(new Set([...clientSignals, ...pack.observable_signals])).slice(0, 12),
    expected_need: criteria.offer_summary ?? pack.name,
    target_company_profile: `${icp.target_industries.join(" · ")} · ${pack.operations.join(" · ")}`,
    disqualifiers: [...(icp.disqualifiers ?? []), ...pack.hard_blockers],
    relevant_signal_families: pack.signal_families,
    possible_commercial_action: pack.thesis_pattern,
  };
}
