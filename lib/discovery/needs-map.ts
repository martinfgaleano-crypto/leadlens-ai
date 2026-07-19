// ─── ICP → commercial needs map (needs-map-v1) ───────────────────────────────
// Transforms a client's product/ICP into an EXPLICIT causal map BEFORE any
// query is generated. This is the discipline that turns "search news and hope
// a company appears" into "know what corporate change matters and what it
// looks like publicly". LLM-structured with a deterministic fallback; the
// SHAPE is guaranteed so downstream discovery never runs without a map.
//
//   product → buyer problem → operational trigger → observable signal
//   → expected need → target company profile → disqualifiers → commercial action

import type { ICP, LeadSearchCriteria } from "@/types";

export const NEEDS_MAP_VERSION = "needs-map-v1";

export interface NeedsMap {
  version: string;
  buyer_problem: string;
  /** Corporate changes that CREATE the buyer problem (causal). */
  operational_triggers: string[];
  /** Public phrasing used to describe those changes (query seeds, es + en). */
  observable_signals: string[];
  expected_need: string;
  /** What a target company must look like for the event to be commercially relevant. */
  target_company_profile: string;
  disqualifiers: string[];
  /** Signal families with a real causal link to the product — nothing else runs. */
  relevant_signal_families: SignalFamily[];
  possible_commercial_action: string;
}

export type SignalFamily =
  | "expansion" | "new_facility" | "fleet_growth" | "infrastructure"
  | "investment" | "acquisition" | "partnership" | "operational_transformation"
  | "capacity" | "contract_award" | "new_market" | "technology_change" | "regulatory";

const SIGNAL_FAMILIES: SignalFamily[] = [
  "expansion", "new_facility", "fleet_growth", "infrastructure", "investment",
  "acquisition", "partnership", "operational_transformation", "capacity",
  "contract_award", "new_market", "technology_change", "regulatory",
];

// Deterministic fallback keeps discovery honest when the LLM is unavailable —
// derives triggers/signals from the ICP's own buying_signals, never invents a
// vertical.
function fallbackMap(icp: ICP, criteria: LeadSearchCriteria): NeedsMap {
  const signals = (criteria.buying_signals ?? []).filter(Boolean);
  return {
    version: NEEDS_MAP_VERSION,
    buyer_problem: criteria.value_proposition || icp.target_industries[0] || "operational complexity",
    operational_triggers: signals.length ? signals : ["expansion", "new operations", "investment"],
    observable_signals: signals.length ? signals : ["expansión", "nueva operación", "inversión"],
    expected_need: criteria.offer_summary || "the client's solution",
    target_company_profile: [icp.target_industries.join(", "), criteria.target_geography.join(", "), (criteria.target_company_size ?? []).join(", ")].filter(Boolean).join(" · "),
    disqualifiers: icp.disqualifiers ?? [],
    relevant_signal_families: ["expansion", "new_facility", "investment", "partnership"],
    possible_commercial_action: "Validate the operational fit, then reach out referencing the change.",
  };
}

export async function buildNeedsMap(icp: ICP, criteria: LeadSearchCriteria): Promise<NeedsMap> {
  if (!process.env.ANTHROPIC_API_KEY || process.env.DEMO_MODE === "true") return fallbackMap(icp, criteria);
  const es = criteria.output_language === "es" || criteria.target_market_region === "latin_america";
  const SYSTEM = `Eres un estratega de inteligencia comercial B2B. Construyes un MAPA CAUSAL DE NECESIDADES que conecta lo que vende un cliente con los cambios empresariales observables públicamente que crean necesidad de su solución.
Reglas:
- Solo incluye familias de señales con relación CAUSAL real con el producto. No incluyas todas.
- observable_signals debe contener frases exactas que aparecerían en anuncios públicos ${es ? "en español" : "en inglés"} (ej.: "inauguró un nuevo centro de distribución", "amplió su flota", "firmó un contrato logístico").
- Devuelve SOLO JSON válido. Escribe los textos ${es ? "en español" : "en inglés"}.`;
  const prompt = `Producto/servicio del cliente: ${criteria.offer_summary}
Propuesta de valor: ${criteria.value_proposition}
Empresas objetivo (ICP): industrias=${icp.target_industries.join(", ")}; geografía=${criteria.target_geography.join(", ")}; tamaño=${(criteria.target_company_size ?? []).join(", ")}
Señales que el cliente considera relevantes: ${(criteria.buying_signals ?? []).join(", ")}
Exclusiones: ${(icp.disqualifiers ?? []).join(", ")}

Familias de señales disponibles (elige SOLO las causalmente relevantes): ${SIGNAL_FAMILIES.join(", ")}

Devuelve JSON:
{"buyer_problem": "...", "operational_triggers": ["..."], "observable_signals": ["frase pública 1","frase pública 2", ...6-10], "expected_need": "...", "target_company_profile": "...", "disqualifiers": ["..."], "relevant_signal_families": ["..."], "possible_commercial_action": "..."}`;
  try {
    const { callClaudeJSON } = await import("@/lib/anthropic");
    const r = await callClaudeJSON<Omit<NeedsMap, "version">>(SYSTEM, prompt, 1500);
    const families = (r.relevant_signal_families ?? []).filter((f): f is SignalFamily => (SIGNAL_FAMILIES as string[]).includes(f));
    return {
      version: NEEDS_MAP_VERSION,
      buyer_problem: r.buyer_problem || fallbackMap(icp, criteria).buyer_problem,
      operational_triggers: (r.operational_triggers ?? []).filter(Boolean).slice(0, 8),
      observable_signals: (r.observable_signals ?? []).filter(Boolean).slice(0, 10),
      expected_need: r.expected_need || criteria.offer_summary,
      target_company_profile: r.target_company_profile || fallbackMap(icp, criteria).target_company_profile,
      disqualifiers: (r.disqualifiers ?? icp.disqualifiers ?? []).filter(Boolean),
      relevant_signal_families: families.length ? families : ["expansion", "new_facility", "investment", "partnership"],
      possible_commercial_action: r.possible_commercial_action || fallbackMap(icp, criteria).possible_commercial_action,
    };
  } catch {
    return fallbackMap(icp, criteria);
  }
}
