// ─── Client-facing context questionnaire (reusable across pilots) ────────────
// A professional client intake, NOT a database export. This model holds the
// rewritten, client-friendly questions (sections + 3-phase priority + answer
// options + units + confidence), plus HIDDEN internal keys/field mappings used
// only for a future import — never shown to the client. Renderers (XLSX / PDF /
// CSV) consume this; they never expose internal field names, roles, IDs or
// methodology. Answers are always blank (no fabrication).

export const CLIENT_QUESTIONNAIRE_SCHEMA_VERSION = "client-questionnaire-v1";

export type QuestionPhase = "essential" | "commercial" | "optional";
export const PHASE_LABEL: Record<QuestionPhase, string> = {
  essential: "Esencial para continuar",
  commercial: "Muy útil para mejorar el análisis",
  optional: "Información complementaria",
};
export const PHASE_ORDER: QuestionPhase[] = ["essential", "commercial", "optional"];

export type AnswerKind = "single_select" | "multi_select" | "numeric" | "range" | "text" | "structured";
export const CONFIDENCE_OPTIONS = ["Confirmado", "Estimado", "Por confirmar", "No aplica"] as const;

export interface ClientQuestion {
  /** Stable internal key (hidden from client; used by the future importer). */
  key: string;
  /** Internal context fields this answer maps to (hidden). Empty = strategic only. */
  internal_fields: string[];
  section_id: string;
  phase: QuestionPhase;
  question: string;          // client-facing Spanish
  why: string;               // why LeadLens needs it (client-facing)
  kind: AnswerKind;
  options?: string[];        // for selects
  units_or_examples?: string;
  subfields?: string[];      // for structured questions
  sensitive?: boolean;       // pricing/margin/capacity → confidentiality framing
}

export interface QuestionnaireSection { id: string; title: string; intro: string; }

export const SECTIONS: QuestionnaireSection[] = [
  { id: "A", title: "Oferta B2B", intro: "Qué productos y formatos puede ofrecer hoy a clientes B2B." },
  { id: "B", title: "Precios y condiciones comerciales", intro: "Rangos de precio, pedido mínimo y márgenes que hacen viable una oportunidad." },
  { id: "C", title: "Capacidad operativa y cobertura", intro: "Cuánto puede abastecer, a dónde entrega y con qué restricciones." },
  { id: "D", title: "Cumplimiento y documentación", intro: "Registros y certificaciones que respaldan la venta B2B." },
  { id: "E", title: "Estrategia comercial", intro: "Modelos, aliados y ciclo comercial que prefiere para este piloto." },
  { id: "F", title: "Etapa y prioridades", intro: "Momento de la empresa y objetivos de este piloto." },
];

// The 17 client questions. Overlaps resolved per the audit: the two delivery
// questions are merged (C9 → delivery_radius + distribution_capability); a
// strategic "objectives" question (F17) is added. Full internal-field coverage.
export const AMOR_QUESTIONS: ClientQuestion[] = [
  // ── A. Oferta B2B ──
  { key: "products_b2b", internal_fields: ["product_formats"], section_id: "A", phase: "essential", kind: "structured",
    question: "¿Qué productos están disponibles hoy para venta B2B?",
    why: "Define qué se puede ofrecer a cada cuenta y en qué formato entrar.",
    subfields: ["Producto o línea", "Formato/presentación", "Tamaño de unidad", "Unidades por caja", "Tipo de empaque", "Vida útil (si aplica)", "Disponible hoy (sí/no)"] },
  { key: "customization", internal_fields: ["customization_capacity"], section_id: "A", phase: "commercial", kind: "multi_select",
    question: "¿Puede Amor de Gea personalizar producto o empaque para un cliente B2B?",
    why: "Amplía o limita las rutas posibles (surtido, gifting, marca propia).",
    options: ["Sin personalización por ahora", "Ajustes de etiqueta o empaque", "Surtido a medida", "Regalo corporativo", "Marca propia", "Condicional / caso a caso", "Otro"] },
  { key: "private_label", internal_fields: ["white_label_capacity"], section_id: "A", phase: "optional", kind: "single_select",
    question: "¿La producción de marca blanca está disponible hoy?",
    why: "Habilita o descarta oportunidades de marca propia con distribuidores/retail.",
    options: ["Sí", "No", "Condicional", "En desarrollo", "No estoy seguro"] },
  // ── B. Precios y condiciones ──
  { key: "wholesale_price", internal_fields: ["price_positioning"], section_id: "B", phase: "essential", kind: "structured", sensitive: true,
    question: "¿Cuál es el rango de precio mayorista B2B actual?",
    why: "Sin un rango de precio no se puede evaluar viabilidad económica por cuenta.",
    units_or_examples: "Ej.: por unidad y por caja, con o sin IVA, en COP.",
    subfields: ["Producto/referencia", "Precio por unidad", "Precio por caja", "¿Incluye IVA?", "Moneda", "Vigencia"] },
  { key: "minimum_order", internal_fields: ["minimum_order"], section_id: "B", phase: "essential", kind: "structured", sensitive: true,
    question: "¿Cuál es el pedido mínimo B2B?",
    why: "Determina qué cuentas son operativamente viables y cómo diseñar un piloto.",
    units_or_examples: "Ej.: 50 unidades, o $500.000 COP por pedido.",
    subfields: ["Mínimo en unidades", "Mínimo en valor", "Mínimo por referencia", "Excepción para pedido piloto"] },
  { key: "margin", internal_fields: ["margins"], section_id: "B", phase: "essential", kind: "range", sensitive: true,
    question: "¿Qué margen o condición comercial debe preservarse para que una oportunidad sea viable?",
    why: "Filtra oportunidades que no sostienen la economía del negocio.",
    units_or_examples: "Puede responder un % exacto, un rango, o marcar «Confidencial — revisar verbalmente».",
    subfields: ["Margen mínimo propio", "Descuento/margen máximo para distribuidor"] },
  { key: "account_size", internal_fields: ["account_size_constraints"], section_id: "B", phase: "essential", kind: "single_select",
    question: "¿Qué tamaño de cuenta o pedido resulta comercialmente atractivo hoy?",
    why: "Orienta la secuencia y priorización de cuentas.",
    options: ["Piloto pequeño", "Cuenta pequeña recurrente", "Cuenta mayorista mediana", "Distribuidor o multi-sede", "Depende del producto o la ruta"] },
  // ── C. Capacidad y cobertura ──
  { key: "monthly_capacity", internal_fields: ["production_capacity"], section_id: "C", phase: "essential", kind: "structured", sensitive: true,
    question: "¿Qué volumen mensual puede abastecer de forma confiable a una sola cuenta B2B?",
    why: "Define qué tamaño de cuenta puede sostener sin riesgo de incumplimiento.",
    units_or_examples: "Ej.: 300 unidades/mes normal, 500 en pico, 15 días de lead time.",
    subfields: ["Capacidad mensual normal", "Capacidad en pico", "Lead time", "Restricciones", "¿Estimado o confirmado?"] },
  { key: "delivery_coverage", internal_fields: ["delivery_radius", "distribution_capability"], section_id: "C", phase: "essential", kind: "structured",
    question: "¿A dónde puede entregar de forma confiable hoy y con qué método?",
    why: "Determina qué cuentas son alcanzables geográfica y operativamente.",
    options: ["Cali", "Valle del Cauca", "Principales ciudades de Colombia", "Cobertura nacional", "Regiones seleccionadas", "Exportación", "Otro"],
    subfields: ["Regiones/ciudades", "Método de entrega", "Tiempo estimado de entrega", "Responsable del flete", "Restricciones"] },
  { key: "operational_constraints", internal_fields: ["fulfillment_constraints"], section_id: "C", phase: "essential", kind: "multi_select",
    question: "¿Qué restricciones operativas debería considerar LeadLens?",
    why: "Evita recomendar cuentas que la operación no puede atender hoy.",
    options: ["Inventario limitado", "Tiempo de producción", "Requiere temperatura/almacenamiento", "Empaque frágil", "Lote mínimo de producción", "Disponibilidad estacional", "Días de despacho", "Limitaciones del transportador"] },
  // ── D. Cumplimiento ──
  { key: "certifications", internal_fields: ["certifications"], section_id: "D", phase: "essential", kind: "structured",
    question: "¿Qué registros, certificaciones o documentos están disponibles hoy?",
    why: "Muchos clientes B2B (retail, hoteles) exigen documentación antes de comprar.",
    units_or_examples: "Ejemplos frecuentes (no todos obligatorios): registro sanitario/INVIMA, ficha técnica, información de etiquetado, RUT, cámara de comercio.",
    subfields: ["Documento o certificación", "Estado (activo/en trámite/vencido/no disponible/no aplica)", "Fecha de vencimiento", "Documento o enlace", "Notas"] },
  // ── E. Estrategia comercial ──
  { key: "current_models", internal_fields: ["business_model"], section_id: "E", phase: "commercial", kind: "multi_select",
    question: "¿Qué modelos comerciales B2B soporta Amor de Gea actualmente?",
    why: "Distingue lo que ya opera de lo que aún no.",
    options: ["Mayorista directo", "Abastecer a retail", "Distribuidor", "Pedido piloto o de prueba", "Regalo corporativo", "Hotelería o amenities", "Eventos", "Alianzas", "Marca propia", "Otro"] },
  { key: "preferred_models", internal_fields: ["preferred_deal_type"], section_id: "E", phase: "commercial", kind: "multi_select",
    question: "¿Qué modelos comerciales prefiere durante este piloto?",
    why: "Prioriza rutas alineadas con la estrategia, no solo con la capacidad.",
    units_or_examples: "Puede ordenar por preferencia: 1ª opción, 2ª opción, no deseado por ahora.",
    options: ["Mayorista directo", "Retail especializado", "Distribuidor", "Piloto o prueba", "Regalo corporativo", "Hotelería/amenities", "Alianzas", "Marca propia", "Otro"] },
  { key: "existing_partners", internal_fields: ["current_partnerships"], section_id: "E", phase: "commercial", kind: "structured",
    question: "¿Existen distribuidores, aliados o clientes B2B que LeadLens deba considerar?",
    why: "Evita conflictos de canal y aprovecha relaciones existentes. Comparta solo lo que sea cómodo.",
    subfields: ["Organización", "Tipo de relación", "Geografía", "Activo/inactivo", "Restricción u oportunidad relevante", "Nota confidencial"] },
  { key: "sales_cycle", internal_fields: ["sales_cycle_tolerance"], section_id: "E", phase: "commercial", kind: "single_select",
    question: "¿Qué ciclo comercial es aceptable antes de que una cuenta deje de ser práctica?",
    why: "Ayuda a priorizar cuentas por rapidez de cierre.",
    units_or_examples: "Además: ¿qué haría que valiera la pena un ciclo largo?",
    options: ["Menos de 30 días", "1–3 meses", "3–6 meses", "6–12 meses", "Más de 12 meses", "Depende del valor de la cuenta"] },
  // ── F. Etapa y prioridades ──
  { key: "company_stage", internal_fields: ["company_stage"], section_id: "F", phase: "optional", kind: "single_select",
    question: "¿Qué etapa describe mejor a Amor de Gea hoy?",
    why: "Contextualiza expectativas y ritmo del piloto.",
    options: ["Validando demanda B2B", "Primeros clientes B2B recurrentes", "Creciendo un canal B2B existente", "Expandiendo geográficamente", "Desarrollando distribuidores", "Consolidando operaciones", "Otro"] },
  { key: "pilot_objectives", internal_fields: [], section_id: "F", phase: "optional", kind: "multi_select",
    question: "¿Cuáles son los 3 objetivos más importantes de este piloto?",
    why: "Alinea las recomendaciones con lo que más le importa al negocio.",
    options: ["Generar ingresos a corto plazo", "Validar encaje producto-mercado", "Abrir retail especializado", "Encontrar distribuidores", "Entrar a hotelería", "Probar regalo corporativo", "Mejorar la oferta B2B", "Aprender requisitos de precio y MOQ", "Construir referencias comerciales", "Otro"] },
];

export interface QuestionnaireBrand {
  clientName: string; category: string; geography: string; accentHex: string;
}
export const AMOR_QUESTIONNAIRE_BRAND: QuestionnaireBrand = {
  clientName: "Amor de Gea", category: "infusiones botánicas", geography: "Colombia", accentHex: "9E7734",
};

export const INTRO_COPY = {
  title: "Cuestionario de contexto comercial",
  purpose: "Este cuestionario permite adaptar el análisis de cuentas y las recomendaciones de LeadLens a las capacidades comerciales reales de Amor de Gea. La información se utilizará exclusivamente para este piloto y no se interpretará como compromiso comercial.",
  time: "Tiempo estimado: 20–30 minutos. Puede completar primero la sección «Esencial» y devolvernos el documento sin terminar el resto.",
  instructions: [
    "Puede responder con valores exactos o con rangos.",
    "Elija «Por confirmar» cuando la información aún no esté disponible.",
    "Elija «No aplica» cuando la pregunta no corresponda.",
    "Adjunte o referencie documentos cuando sea útil.",
  ],
  privacy: "No incluya contraseñas, información bancaria, números de identificación personal ni información confidencial ajena al piloto.",
} as const;

// ── Rendered (client-safe) shape — no internal keys/fields leak here ──
export interface RenderedQuestion {
  number: number; sectionId: string; sectionTitle: string; phase: QuestionPhase; phaseLabel: string;
  question: string; why: string; kind: AnswerKind; options: string[]; unitsOrExamples: string;
  subfields: string[]; sensitive: boolean;
}

/** Deterministic client-facing render: phase-ordered (essential first), then by
 *  section, then original order. Numbering is 1..N in display order. */
export function renderQuestionnaire(questions: ClientQuestion[] = AMOR_QUESTIONS): RenderedQuestion[] {
  const sectionTitle = (id: string) => SECTIONS.find((s) => s.id === id)?.title ?? id;
  const withIdx = questions.map((q, i) => ({ q, i }));
  withIdx.sort((a, b) => PHASE_ORDER.indexOf(a.q.phase) - PHASE_ORDER.indexOf(b.q.phase)
    || a.q.section_id.localeCompare(b.q.section_id) || a.i - b.i);
  return withIdx.map(({ q }, i) => ({
    number: i + 1, sectionId: q.section_id, sectionTitle: sectionTitle(q.section_id),
    phase: q.phase, phaseLabel: PHASE_LABEL[q.phase], question: q.question, why: q.why, kind: q.kind,
    options: q.options ?? [], unitsOrExamples: q.units_or_examples ?? "", subfields: q.subfields ?? [], sensitive: !!q.sensitive,
  }));
}

export function essentialCount(questions: ClientQuestion[] = AMOR_QUESTIONS): number {
  return questions.filter((q) => q.phase === "essential").length;
}

/** Hidden import contract row (metadata sheet / hidden columns only). */
export interface ImportKeyRow { key: string; internal_fields: string; number: number; }
export function importKeyMap(questions: ClientQuestion[] = AMOR_QUESTIONS): ImportKeyRow[] {
  return renderQuestionnaire(questions).map((r, i) => {
    const q = questions.find((x) => x.question === r.question)!;
    return { key: q.key, internal_fields: q.internal_fields.join("|"), number: i + 1 };
  });
}
