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

export const VERTICAL_PACKS_VERSION = "vertical-packs-v1";

export interface VerticalPack {
  id: string;
  name: string;
  match: RegExp;                       // matched against ICP industries + offer
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
  seed_companies: Array<{ name: string; sector: string }>;
}

const FLEET: VerticalPack = {
  id: "fleet_software",
  name: "Software de gestión de flotas",
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
    { name: "Coordinadora", sector: "logística y paquetería" }, { name: "Servientrega", sector: "logística y paquetería" },
    { name: "Inter Rapidísimo", sector: "logística y paquetería" }, { name: "TCC", sector: "transporte de carga" },
    { name: "Envía", sector: "logística y paquetería" }, { name: "Coltanques", sector: "transporte de carga líquida" },
    { name: "Ditransa", sector: "transporte de carga" }, { name: "Copetran", sector: "transporte terrestre" },
    { name: "Expreso Bolivariano", sector: "transporte de pasajeros" }, { name: "Rápido Ochoa", sector: "transporte terrestre" },
    { name: "Transportes Vigía", sector: "transporte refrigerado" }, { name: "Colvanes", sector: "logística y mensajería" },
    { name: "Berlinas del Fonce", sector: "transporte terrestre" }, { name: "Cootransmagdalena", sector: "transporte de carga" },
    { name: "Transportes Botero Soto", sector: "transporte de carga" }, { name: "Logística de Distribución Sánchez Polo", sector: "transporte de carga" },
  ],
};

const LOGISTICS: VerticalPack = {
  id: "logistics_automation",
  name: "Automatización de bodegas y WMS",
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
    { name: "Grupo Éxito", sector: "retail" }, { name: "Alkosto", sector: "retail" },
    { name: "Olímpica", sector: "retail" }, { name: "Falabella de Colombia", sector: "retail" },
    { name: "Sodimac Colombia", sector: "retail hogar y construcción" }, { name: "PriceSmart Colombia", sector: "retail mayorista" },
    { name: "Makro Colombia", sector: "retail mayorista" }, { name: "Koba Colombia", sector: "retail descuento (D1)" },
    { name: "Jerónimo Martins Colombia", sector: "retail descuento (Ara)" }, { name: "Alpina", sector: "alimentos" },
    { name: "Nutresa", sector: "alimentos" }, { name: "Colombina", sector: "alimentos" },
    { name: "Bavaria", sector: "bebidas" }, { name: "Postobón", sector: "bebidas" },
    { name: "Quala", sector: "consumo masivo" }, { name: "Corona", sector: "manufactura cerámica" },
    { name: "Solla", sector: "alimentos balanceados" }, { name: "Ramo", sector: "alimentos" },
  ],
};

const OPERATIONAL_SW: VerticalPack = {
  id: "operational_software",
  name: "Software operativo (planificación/integración/inventarios)",
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
    { name: "Nutresa", sector: "alimentos" }, { name: "Alpina", sector: "alimentos" },
    { name: "Colombina", sector: "alimentos" }, { name: "Corona", sector: "manufactura" },
    { name: "Cementos Argos", sector: "cemento y construcción" }, { name: "Tecnoglass", sector: "manufactura de vidrio" },
    { name: "Auteco", sector: "ensamble de motocicletas" }, { name: "Fanalca", sector: "manufactura y movilidad" },
    { name: "Leonisa", sector: "confección" }, { name: "Crystal", sector: "textil y confección" },
    { name: "Nalsani", sector: "manufactura y retail (Totto)" }, { name: "Manuelita", sector: "agroindustria" },
    { name: "Riopaila Castilla", sector: "agroindustria" }, { name: "Incauca", sector: "agroindustria" },
    { name: "Enka de Colombia", sector: "manufactura de polímeros" }, { name: "Fabricato", sector: "textil" },
  ],
};

export const VERTICAL_PACKS: VerticalPack[] = [FLEET, LOGISTICS, OPERATIONAL_SW];

/** Match the best pack for an ICP (industries + offer text). Null if none. */
export function matchVerticalPack(icp: ICP, criteria: LeadSearchCriteria): VerticalPack | null {
  const hay = `${icp.target_industries.join(" ")} ${criteria.offer_summary ?? ""} ${criteria.value_proposition ?? ""}`.toLowerCase();
  let best: { pack: VerticalPack; hits: number } | null = null;
  for (const p of VERTICAL_PACKS) {
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
