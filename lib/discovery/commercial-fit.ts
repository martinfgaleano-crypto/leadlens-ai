// ─── Commercial + operational fit (commercial-fit-v1) ────────────────────────
// The #1 residual: "the company is in transport" is not fit. A fleet-software
// account needs OWN fleet + route/maintenance control; a WMS account needs an
// owned distribution operation. This scores fit across real dimensions and,
// crucially, HARD-BLOCKS when the operation is absent or fully outsourced, the
// product is unrelated to the event, or the ICP excludes it. A numeric score
// never overrides a hard blocker. Deterministic over the needs map + the
// event/company evidence text.

import type { NeedsMap } from "./needs-map";

export const COMMERCIAL_FIT_VERSION = "commercial-fit-v1";

export interface CommercialFitInput {
  needs: NeedsMap;
  company: string;
  sector: string | null;
  content: string;                 // lower-cased title+body
  event_keyword: string | null;    // the material-event term
  disqualifiers: string[];
  /** Terms describing the client's product capability (from offer/value prop). */
  product_terms: string[];
  /** Operation the ICP requires (e.g. "flota propia", "bodega", "centro de distribución"). */
  required_operation_terms: string[];
}

export interface CommercialFit {
  score: number;                   // 0-100
  breakdown: Record<string, number>;
  hard_blockers: string[];
  operational_fit: boolean;        // does the company plausibly run the relevant operation?
  reasons: string[];
}

// Signals the operation is OUTSOURCED / not owned (hard blocker for ops-fit).
const OUTSOURCED = /(terceriz|outsourc|operad[ao] por un tercero|servicio contratado a|operador log[ií]stico externo)/i;

export function assessCommercialFit(i: CommercialFitInput): CommercialFit {
  const hay = i.content;
  const b: Record<string, number> = {};
  const hard: string[] = [];
  const reasons: string[] = [];

  // ── Disqualifiers (hard) ──
  for (const d of i.disqualifiers) {
    if (d && d.length >= 4 && hay.includes(d.toLowerCase().split(" ")[0])) { hard.push(`icp_disqualifier:${d}`); }
  }

  // ── Operational fit: does the company run the operation the product needs? ──
  const opTerms = i.required_operation_terms.filter(Boolean);
  const opPresent = opTerms.some((t) => hay.includes(t.toLowerCase().split(" ")[0]));
  const outsourced = OUTSOURCED.test(hay);
  const operational_fit = opTerms.length === 0 ? true : (opPresent && !outsourced);
  if (opTerms.length > 0 && !opPresent) hard.push("no_relevant_operation_evidenced");
  if (outsourced) hard.push("operation_outsourced");
  b.operational = operational_fit ? 25 : 0;

  // ── Product ↔ event relation: the product must relate to the event's domain ──
  const productRelated = i.product_terms.some((p) => p && (hay.includes(p.toLowerCase().split(" ")[0])))
    || i.needs.relevant_signal_families.length > 0; // needs map already scoped families
  if (!productRelated) hard.push("product_unrelated_to_event");
  b.problem_solution = productRelated ? 25 : 0;

  // ── Industry / sector fit ──
  const industryHit = (i.needs.target_company_profile || "").toLowerCase().split(/[·,]/).some((seg) => {
    const key = seg.trim().split(" ")[0];
    return key.length >= 4 && (hay.includes(key) || (i.sector ?? "").toLowerCase().includes(key));
  });
  b.industry = industryHit ? 20 : 8;
  if (industryHit) reasons.push("Sector coincide con el perfil objetivo.");

  // ── Buyer relevance / commercial value (proxy: event implies operational scale) ──
  const scaleHit = /\b(nacional|regional|m[uú]ltiples|varios|red de|centros?|plantas?|sedes?|flota|bodegas?)\b/i.test(hay);
  b.buyer_value = scaleHit ? 15 : 6;

  // ── Geography ──
  b.geography = /\bcolombia\b|\.co\b|bogot[aá]|medell[ií]n|cali|barranquilla|cartagena/i.test(hay) ? 15 : 6;

  const score = Object.values(b).reduce((s, v) => s + v, 0);
  return { score: Math.min(100, score), breakdown: b, hard_blockers: hard, operational_fit, reasons };
}

/** Infer the operation terms the ICP requires from its needs families. */
export function requiredOperationTerms(needs: NeedsMap): string[] {
  const fams = new Set(needs.relevant_signal_families);
  const terms: string[] = [];
  if (fams.has("fleet_growth")) terms.push("flota", "vehículos", "camiones", "transporte", "distribución");
  if (fams.has("new_facility") || fams.has("capacity") || fams.has("infrastructure")) terms.push("bodega", "centro de distribución", "planta", "almacén");
  // If no operation-specific family, do not force an operation gate.
  return terms;
}
