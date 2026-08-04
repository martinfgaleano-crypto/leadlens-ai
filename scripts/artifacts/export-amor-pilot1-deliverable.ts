// Single source of truth → customer-safe deliverable JSON.
// Assembles the premium Pilot 1 package strictly from the already-approved
// Codex intelligence modules. NO new intelligence, NO provider calls, NO invented
// facts. The Python renderer consumes only this JSON, so the PDF/DOCX content is
// traceable to reviewed modules. Customer-safe: no internal version tokens, no
// named buyers, no timing claims, evidence framed as public facts + limitations.
import { writeFileSync, mkdirSync } from "node:fs";
import { AMOR_PILOT1_FINAL, AMOR_PILOT1_EMAIL, AMOR_PILOT1_AGENDA } from "../../lib/intelligence/amor-de-gea-pilot1-finalization";
import { AMOR_PHASE4_PORTFOLIO } from "../../lib/intelligence/amor-de-gea-phase4-intelligence";
import { AMOR_PHASE45_ROUTE_REVIEW } from "../../lib/intelligence/amor-de-gea-phase4-5-review";
import { AMOR_PHASE5A_WHAT_CHANGED, AMOR_PHASE5A_MARKET_MAP, AMOR_PHASE5A_SUCCESS_CONTRACT } from "../../lib/intelligence/amor-de-gea-phase5a-customer-safe";

const ROUTE_ES: Record<string, string> = {
  hospitality_spa: "Hotelería y spa",
  specialty_retail: "Retail especializado",
  gifting: "Regalos corporativos",
  regional_distribution: "Distribución regional",
};
// Faithful Spanish rendering of each account's real public evidence fact
// (translated 1:1 from the English `fact` in phase4-intelligence / phase4-6 repair).
const EVIDENCE_FACT_ES: Record<string, string> = {
  "Éteka": "Su página oficial describe un hotel spa en Cartagena con rituales de bienestar; la página fue actualizada el 5 de julio de 2026.",
  "Celestino Hotel Boutique & Spa": "Su sitio oficial describe un hotel boutique con spa en Medellín, con sauna, jacuzzi y baño frío.",
  "Sinergy On": "Su sitio oficial ofrece explícitamente kits corporativos y de eventos personalizados en Bogotá.",
  "Vitálica": "Su e-commerce oficial activo describe productos naturales, vitaminas y suplementos en Colombia.",
  "Ser Saludable": "Su tienda oficial describe medicina natural, vitaminas, nutrición deportiva y productos de bienestar.",
  "Masaya Collection": "Su página oficial describe estadías boutique en Colombia centradas en sofisticación, bienestar y conexión; actualizada el 21 de julio de 2026.",
  "Natural + Mente": "Su ecommerce activo lista productos y expone categorías de fitoterapia, nutrición y múltiples laboratorios (confirmado en la revisión de evidencia).",
  "Hotel Charleston Santa Teresa Spa": "Su página oficial describe masajes, faciales y rituales de bienestar en su spa de Cartagena.",
  "Habibi Plantitas": "Su página oficial ofrece regalos corporativos personalizados en toda Colombia, incluidas plantas, velas y bonsái.",
  "Funat": "Su tienda oficial ofrece productos naturales e incluye explícitamente tés e infusiones; página actualizada el 11 de junio de 2026.",
};
const PROVES_ES: Record<string, string> = {
  hospitality_spa: "Identidad y operación de hotelería/spa vigente: relevancia estructural de la ruta.",
  specialty_retail: "Operación de retail de productos naturales activa: adyacencia de categoría.",
  gifting: "Canal de kits o regalos corporativos: encaje para un producto terminado dentro de un kit.",
  regional_distribution: "Modelo de distribución identificado: aprendizaje de ruta.",
};
// Customer-safe reason each inactive account is not recommended now (grounded in
// the internal review verdicts; no negative language beyond the evidence gap).
const WHY_NOT_NOW: Record<string, string> = {
  "BioPlaza": "Retail natural consolidado y relevante, pero su compra centralizada y escala superan la accesibilidad de una primera prueba; se mantiene como aprendizaje de mayor volumen.",
  "Distribuidora DAM": "La ruta de distribución es coherente, pero economía, capacidad y volumen de apertura siguen sin resolverse; se conserva solo como referencia de ruta.",
  "Hotel Spa La Colina": "Salió de la primera secuencia porque la evidencia pública no confirmó una oferta de spa vigente ni comportamiento de retail de terceros; Éteka y Celestino cubren mejor el mismo aprendizaje.",
  "Tu Tienda Saludable": "La evidencia disponible apunta a un revendedor concentrado en una sola marca, no a un comprador multimarca diferenciado; inferior a Vitálica y Ser Saludable para el mismo objetivo.",
  "Somos Consiente": "No se estableció un mecanismo de compra recurrente más allá de una alineación de marca genérica; se reconsideraría solo si aparece un caso de compra repetible.",
};

// Spanish renderings for the route-review qualifiers (kept faithful to the English source).
const ES_EVIDENCE: Record<string, string> = { "moderate–strong": "moderada–alta", "uneven": "irregular", "moderate": "moderada", "low": "baja" };
const ES_MECHANISM: Record<string, string> = {
  "strong but use case unverified": "fuerte, con caso de uso por verificar",
  "strong and observable": "fuerte y observable",
  "promising but project-dependent": "prometedor, depende del proyecto",
  "conditioned": "condicionado",
};
const ES_CONCLUSION: Record<string, string> = {
  "partially supported": "parcialmente respaldada",
  "supported as easiest test route": "respaldada (ruta más fácil de probar)",
  "most conditioned": "la más condicionada",
};

const byName = (name: string) => AMOR_PHASE4_PORTFOLIO.find((x) => x.identity.commercial_name === name);
const RETRIEVED_ES = "3 de agosto de 2026";

const account = (name: string) => {
  const a = AMOR_PILOT1_FINAL.accounts.find((x) => x.name === name)!;
  const p = byName(name);
  const route = p?.route ?? "";
  const fact = p?.evidence.facts[0];
  return {
    name: a.name,
    group: a.group,
    route: ROUTE_ES[route] ?? a.route,
    route_key: route,
    why: a.why,
    test: a.test,
    unknown: a.unknown,
    next: a.next,
    evidence: {
      source: p?.identity.official_domain ?? null,
      fact: EVIDENCE_FACT_ES[name] ?? null,
      retrieved: RETRIEVED_ES,
      freshness: fact?.freshness ?? "unknown",
      proves: PROVES_ES[route] ?? "Relevancia estructural de la ruta.",
      not_proves: `${a.unknown} No hay evidencia de intención de compra ni de temporalidad (timing).`,
    },
  };
};

const accounts = AMOR_PILOT1_FINAL.accounts.map((a) => account(a.name));

// Rich, account-specific Action Briefs for the four first-validation accounts.
const BRIEF_ANGLE: Record<string, { thesis: string; buyer_hyp: string; procurement: string; cycle: string; objections: string[]; questions: string[]; prep: string[] }> = {
  "Éteka": {
    thesis: "Un hotel spa con rituales de bienestar vigentes puede probar un complemento botánico sellado como retail de spa o regalo para huéspedes, sin afirmaciones médicas.",
    buyer_hyp: "Gerencia general o responsable de spa / experiencia de huésped (función a confirmar, sin nombre).",
    procurement: "Propiedad única: decisión probablemente local, por confirmar.",
    cycle: "Corto si existe un caso de uso claro; sin evidencia de proceso de compra de terceros.",
    objections: ["No opera retail de terceros", "Manejo del envase de vidrio", "Riesgo de afirmaciones de salud", "Alta de proveedor"],
    questions: ["¿Venden productos de bienestar de terceros en el spa o la recepción?", "¿Qué ritual o momento del huésped podría usar un producto sellado de 50 ml?", "¿Quién decide las compras del spa?", "¿Qué cadencia de reposición sería realista?"],
    prep: ["Muestras de producto terminado", "Hoja de uso seguro (sin lenguaje médico)", "Condiciones mayoristas", "Dimensiones y logística del vidrio"],
  },
  "Celestino Hotel Boutique & Spa": {
    thesis: "Un hotel boutique con spa en Medellín permite conectar un producto con el regalo al huésped o la reventa boutique alrededor de las amenidades de bienestar existentes.",
    buyer_hyp: "Gerencia general, spa o experiencia de huésped (función a confirmar, sin nombre).",
    procurement: "Propiedad boutique: decisión probablemente concentrada, por confirmar.",
    cycle: "Potencialmente corto en una sola propiedad; frecuencia de consumo por validar.",
    objections: ["Sin retail de terceros verificado", "Baja frecuencia de consumo", "Incertidumbre de compras"],
    questions: ["¿Existe inventario de regalo al huésped o venta boutique?", "¿Quién es dueño de la decisión?", "¿Qué amenidad genera un uso recurrente?", "¿Puede una sola propiedad probar de forma independiente?"],
    prep: ["Colección de producto", "Concepto de regalo al huésped", "Copia de uso seguro", "Economía del piloto"],
  },
  "Sinergy On": {
    thesis: "Un proveedor de kits corporativos personalizados puede incorporar Amor de Gea como componente premium de bienestar dentro de un brief de cliente en curso.",
    buyer_hyp: "Dirección comercial, compras de gifting o alianzas (función a confirmar, sin nombre).",
    procurement: "Por proyecto: depende de un brief activo del cliente final.",
    cycle: "Dependiente de campaña; estacional o por proyecto.",
    objections: ["Puede requerir marca blanca", "Estacionalidad", "Costo de personalización", "Tiempos de entrega"],
    questions: ["¿Hay un brief activo compatible?", "¿Qué volúmenes y tiempos aplican?", "¿Se acepta co-branding con producto terminado?", "¿Con qué frecuencia se repiten los briefs de bienestar?"],
    prep: ["Kit de muestra", "Opciones de co-branding", "Escalas de volumen", "Hoja de tiempos de entrega"],
  },
  "Vitálica": {
    thesis: "Un e-commerce de productos naturales activo permite probar líquidos botánicos premium diferenciados junto al surtido actual y observar la reposición por sell-through.",
    buyer_hyp: "Comprador de categoría, propietario o compras (función a confirmar, sin nombre).",
    procurement: "Retail independiente: alta de categoría por confirmar.",
    cycle: "Observable vía sell-through; plazo por validar.",
    objections: ["Posible desajuste de formato", "Competencia de surtido", "Requisitos de documentación", "Margen"],
    questions: ["¿Qué líquidos comparables ya venden?", "¿Quién aprueba el alta de categoría?", "¿Qué margen y documentación se requieren?", "¿Cómo se mide el sell-through?"],
    prep: ["Muestras", "Ficha técnica de producto", "Posicionamiento seguro", "Condiciones mayoristas y de reposición"],
  },
};
const briefs = accounts.filter((a) => a.group === "Primera validación").map((a) => ({ ...a, ...BRIEF_ANGLE[a.name] }));

const data = {
  meta: {
    client: "Amor de Gea",
    pilot: "Piloto 1 · LeadLens",
    geography: "Colombia",
    generated_date: "2026-08-03",
    generated_label: "Agosto 2026 · Colombia",
    retrieved_label: RETRIEVED_ES,
  },
  portfolio: {
    first_validation: AMOR_PILOT1_FINAL.portfolio.first_validation,
    strategic_priority: AMOR_PILOT1_FINAL.portfolio.strategic_priority,
    investigate_selectively: AMOR_PILOT1_FINAL.portfolio.investigate_selectively,
  },
  group_es: {
    "Primera validación": "Primera secuencia de validación",
    "Prioridad estratégica": "Prioridad estratégica",
    "Investigar selectivamente": "Investigación selectiva",
  },
  relationship_disclosure: AMOR_PILOT1_FINAL.relationship_disclosure,
  accounts,
  excluded: AMOR_PILOT1_FINAL.portfolio.excluded.map((name) => ({ name, reason: WHY_NOT_NOW[name] })),
  readiness: {
    strengths: [
      "Portafolio de tres elixires botánicos terminados con presentación premium.",
      "Prueba inicial pequeña y compatible con la capacidad actual (cercana a 50 unidades).",
      "Tres rutas comerciales plausibles: retail especializado, hotelería/spa y regalos corporativos.",
      "Opciones de personalización, co-branding y kits de regalo.",
    ],
    validate: [
      "Rango de precio mayorista, margen y condiciones por canal.",
      "Documentación de soporte y lenguaje no médico para cada cuenta.",
      "Logística y manejo del envase de vidrio.",
      "Capacidad por pedido y alcance real de personalización.",
    ],
  },
  what_changed: {
    before: [
      "Negocios de bienestar genéricos en Colombia.",
      "Cuentas grandes o reconocibles por su nombre.",
      "Ideas amplias de distribución.",
      "Afinidad de categoría sin filtro operativo.",
      "Alianzas genéricas.",
    ],
    after: [
      "Pruebas iniciales manejables, con MOQ cercano a 50 unidades.",
      "Rango recurrente esperado de ~100–300 unidades como referencia.",
      "Rutas de gifting y co-branding con mecanismo de compra concreto.",
      "Estructuras de compra boutique y penalización de procurement complejo.",
      "Mecanismos de recompra explícitos y caminos de comprador más específicos.",
      "Restricciones de afirmaciones y encaje con la madurez del negocio.",
    ],
    narrative: AMOR_PHASE5A_WHAT_CHANGED.items,
  },
  market_map: AMOR_PHASE5A_MARKET_MAP.map((m) => ({ route: m.route === "Gifting / co-branding" ? "Regalos y co-branding" : m.route, summary: m.summary })),
  route_review: AMOR_PHASE45_ROUTE_REVIEW.map((r) => ({ route: ROUTE_ES[r.route] ?? r.route, evidence: ES_EVIDENCE[r.evidence_quality] ?? r.evidence_quality, mechanism: ES_MECHANISM[r.mechanism_strength] ?? r.mechanism_strength, conclusion: ES_CONCLUSION[r.conclusion] ?? r.conclusion })),
  success: {
    objective: AMOR_PHASE5A_SUCCESS_CONTRACT.objective,
    value: AMOR_PHASE5A_SUCCESS_CONTRACT.value_dimensions,
    no_guarantee: AMOR_PHASE5A_SUCCESS_CONTRACT.no_sales_guarantee,
  },
  prep_checklist: [
    "Confirmar relación previa o conflicto de cada cuenta antes de contactar.",
    "Preparar muestras, ficha de producto y lenguaje seguro (no médico).",
    "Definir condiciones mayoristas, margen mínimo y política de personalización.",
    "Confirmar documentación de soporte y capacidad por pedido.",
    "Fijar el máximo de unidades y personalización que se puede cumplir.",
  ],
  briefs,
  limitations: [
    "Las descripciones se apoyan en superficies públicas revisadas durante el piloto y en el contexto entregado por Amor de Gea.",
    "Una afinidad pública no demuestra interés, presupuesto, timing, margen ni autorización de compra.",
    "No se identifican compradores nominales sin verificación.",
    "Los casos de uso son hipótesis de validación, no hechos comerciales.",
    "No se atribuyen efectos de salud ni se recomienda lenguaje médico.",
    "La relación comercial previa con cada cuenta no está confirmada y debe capturarse antes del contacto.",
  ],
  agenda: AMOR_PILOT1_AGENDA,
  email: { subject: AMOR_PILOT1_EMAIL.subject, body: AMOR_PILOT1_EMAIL.body },
};

mkdirSync("output", { recursive: true });
const out = "output/amor-pilot1-deliverable.data.json";
writeFileSync(out, JSON.stringify(data, null, 2));
console.log(`wrote ${out} · ${accounts.length} accounts · ${briefs.length} briefs`);
