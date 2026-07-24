// ─── Commercial + operational fit (commercial-fit-v1) ────────────────────────
// The #1 residual: "the company is in transport" is not fit. A fleet-software
// account needs OWN fleet + route/maintenance control; a WMS account needs an
// owned distribution operation. This scores fit across real dimensions and,
// crucially, HARD-BLOCKS when the operation is absent or fully outsourced, the
// product is unrelated to the event, or the ICP excludes it. A numeric score
// never overrides a hard blocker. Deterministic over the needs map + the
// event/company evidence text.

import type { NeedsMap } from "./needs-map";

export const COMMERCIAL_FIT_VERSION = "commercial-fit-v2";

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
  channel_category_alignment?: "confirmed" | "plausible" | "unknown";
  geography_confirmed?: boolean;
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
const STOPWORDS = new Set(["and", "the", "with", "from", "that", "this", "fully", "unrelated", "does", "not", "de", "del", "con", "para", "por", "una", "un", "los", "las", "sin"]);
const FIT_STOPWORDS = new Set(Array.from(STOPWORDS).concat(["software", "solution", "solutions", "solucion", "soluciones", "platform", "plataforma", "product", "products", "producto", "productos", "service", "services", "servicio", "servicios", "natural", "wellbeing", "bienestar"]));

function normalize(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function meaningfulTokens(value: string): string[] {
  return normalize(value).split(/\s+/).filter(t => t.length >= 4 && !FIT_STOPWORDS.has(t));
}

/** Prefix matching handles Spanish/English inflection (flota/flotas,
 * beverage/beverages) while retaining word boundaries. */
function tokenEvidence(haystack: string, terms: string[]): string[] {
  const words = new Set(normalize(haystack).split(/\s+/));
  const hits = new Set<string>();
  for (const term of terms) {
    for (const token of meaningfulTokens(term)) {
      const stem = token.slice(0, Math.min(token.length, 6));
      if (Array.from(words).some(word => word.startsWith(stem))) hits.add(token);
    }
  }
  return Array.from(hits);
}

/** A compound exclusion must match its meaning, not merely its first word.
 * Previously "food and beverage fully controlled by a third party" fired on
 * any grocery page containing "food". Single distinctive exclusions still
 * match as whole words; phrases require at least 60% of meaningful tokens. */
export function disqualifierMatches(content: string, disqualifier: string): boolean {
  const tokens = disqualifier.toLowerCase().split(/[^a-záéíóúñ]+/).filter(t => t.length >= 3 && !STOPWORDS.has(t));
  if (tokens.length === 0) return false;
  const has = (token: string) => new RegExp(`(^|[^a-záéíóúñ])${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-záéíóúñ])`, "i").test(content);
  if (tokens.length === 1) return has(tokens[0]);
  const matched = tokens.filter(has).length;
  return matched >= Math.max(2, Math.ceil(tokens.length * 0.6));
}

export function assessCommercialFit(i: CommercialFitInput): CommercialFit {
  const hay = i.content;
  const b: Record<string, number> = {};
  const hard: string[] = [];
  const reasons: string[] = [];

  // ── Disqualifiers (hard) ──
  for (const d of i.disqualifiers) {
    if (d && d.length >= 4 && disqualifierMatches(hay, d)) { hard.push(`icp_disqualifier:${d}`); }
  }

  // ── Operational fit: does the company run the operation the product needs? ──
  const opTerms = i.required_operation_terms.filter(Boolean);
  const operationEvidence = tokenEvidence(hay, opTerms);
  const opPresent = operationEvidence.length > 0;
  const outsourced = OUTSOURCED.test(hay);
  const operational_fit = opTerms.length === 0 ? true : (opPresent && !outsourced);
  if (opTerms.length > 0 && !opPresent) hard.push("no_relevant_operation_evidenced");
  if (outsourced) hard.push("operation_outsourced");
  b.operational = operational_fit ? 25 : 0;
  if (operationEvidence.length) reasons.push(`Operación evidenciada: ${operationEvidence.slice(0, 4).join(", ")}.`);

  // ── Product ↔ event relation: the product must relate to the event's domain ──
  const productEvidence = tokenEvidence(hay, i.product_terms);
  const channelCategorySupport = i.channel_category_alignment === "confirmed" || i.channel_category_alignment === "plausible";
  const productRelated = productEvidence.length > 0 || channelCategorySupport;
  if (!productRelated) hard.push("product_unrelated_to_event");
  b.problem_solution = productRelated ? 25 : 0;
  if (productEvidence.length) reasons.push(`Relación oferta–cuenta evidenciada: ${productEvidence.slice(0, 4).join(", ")}.`);
  else if (channelCategorySupport) reasons.push(`Relación de categoría sustentada por evidencia de canal (${i.channel_category_alignment}).`);

  // ── Industry / sector fit ──
  const industryEvidence = tokenEvidence(`${hay} ${i.sector ?? ""}`, [i.needs.target_company_profile || ""]);
  const industryHit = industryEvidence.length > 0;
  b.industry = industryHit ? 20 : 8;
  if (industryHit) reasons.push("Sector coincide con el perfil objetivo.");

  // ── Buyer relevance / commercial value (proxy: event implies operational scale) ──
  const scaleHit = /\b(nacional|regional|m[uú]ltiples|varios|red de|centros?|plantas?|sedes?|flota|bodegas?)\b/i.test(hay);
  b.buyer_value = scaleHit ? 15 : 6;

  // ── Geography ──
  const geographyHit = i.geography_confirmed === true || /\bcolombia\b|\.co\b|bogot[aá]|medell[ií]n|cali|barranquilla|cartagena/i.test(hay);
  b.geography = geographyHit ? 15 : 0;
  if (!geographyHit) hard.push("geography_not_evidenced_for_fit");

  const score = Object.values(b).reduce((s, v) => s + v, 0);
  return { score: Math.min(100, score), breakdown: b, hard_blockers: hard, operational_fit, reasons };
}

/** Infer the operation terms the ICP requires from its needs families. */
export function requiredOperationTerms(needs: NeedsMap): string[] {
  const fams = new Set(needs.relevant_signal_families);
  const terms: string[] = [];
  const profile = `${needs.target_company_profile ?? ""} ${needs.expected_need ?? ""}`.toLowerCase();
  if (/wellness|wellbeing|spa|resort|hospitality|natural products?|functional beverage|grocery/.test(profile)) {
    return ["wellness", "spa", "resort", "hotel", "retail", "grocery", "beverage", "store", "distribuidor", "distribuidora", "mayorista", "productos naturales", "suplementos", "vitaminas", "homeopáticos"];
  }
  if (fams.has("fleet_growth")) terms.push("flota", "vehículos", "camiones", "transporte", "distribución");
  if (fams.has("new_facility") || fams.has("capacity") || fams.has("infrastructure")) terms.push("bodega", "centro de distribución", "planta", "almacén");
  // If no operation-specific family, do not force an operation gate.
  return terms;
}
