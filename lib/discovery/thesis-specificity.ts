// ─── Thesis specificity test (thesis-specificity-v1) ─────────────────────────
// The substitution test: a thesis you could paste onto any company by swapping
// the name is too generic. A specific thesis references the concrete EVENT, the
// client's PRODUCT capability, a VALIDATION condition, and a NEXT ACTION.
// Deterministic; flags empty/interchangeable language.

export const THESIS_SPECIFICITY_VERSION = "thesis-specificity-v1";

export interface ThesisCheckInput {
  thesis: string;
  company: string;
  event_keyword: string | null;   // the material-event term found (e.g. "nueva bodega")
  product_terms: string[];        // client product/capability terms
}
export interface ThesisCheck {
  specific: boolean;
  score: number;                  // 0-100 specificity
  flags: string[];
  references_event: boolean;
  references_product: boolean;
  has_validation: boolean;
  has_action: boolean;
}

// Empty/interchangeable phrases that carry no company-specific meaning.
const GENERIC = /\b(podr[ií]a (necesitar|beneficiarse|requerir)|puede (necesitar|requerir|beneficiarse)|representa una oportunidad|est[aá] creciendo|busca mejorar|mejores soluciones|soluciones tecnol[oó]gicas|transformaci[oó]n digital(?! con)|could (benefit|need)|may (need|require)|represents an opportunity|is growing)\b/i;
const VALIDATION = /\b(validar|confirmar|verificar|revisar si|depende de|antes de contactar|habr[ií]a que|se debe comprobar|validate|confirm|check whether|before outreach)\b/i;
const ACTION = /\b(investigar|contactar|monitorear|priorizar|reservar|agendar|proponer|acercarse|investigate|contact|monitor|prioritize|reach out)\b/i;

export function thesisSpecificityTest(i: ThesisCheckInput): ThesisCheck {
  const low = i.thesis.toLowerCase();
  const flags: string[] = [];

  const references_event = !!i.event_keyword && low.includes(i.event_keyword.toLowerCase().split(" ")[0]);
  const references_product = i.product_terms.some((p) => p && low.includes(p.toLowerCase().split(" ")[0]));
  const has_validation = VALIDATION.test(low);
  const has_action = ACTION.test(low);
  const genericHit = low.match(GENERIC);

  if (genericHit) flags.push(`lenguaje genérico: "${genericHit[0]}"`);
  if (!references_event) flags.push("no referencia el evento concreto");
  if (!references_product) flags.push("no referencia el producto del cliente");
  if (!has_validation) flags.push("sin condición a validar");
  if (!has_action) flags.push("sin siguiente acción");
  // Substitution proxy: the thesis must name the company or clearly the event —
  // otherwise it reads as interchangeable.
  const namesCompany = low.includes(i.company.toLowerCase().split(" ")[0]);
  if (!namesCompany && !references_event) flags.push("intercambiable entre empresas (no ancla al caso)");

  let score = 0;
  if (references_event) score += 30;
  if (references_product) score += 25;
  if (has_validation) score += 20;
  if (has_action) score += 15;
  if (!genericHit) score += 10;
  const specific = score >= 70 && !genericHit && references_event && references_product;

  return { specific, score, flags, references_event, references_product, has_validation, has_action };
}
