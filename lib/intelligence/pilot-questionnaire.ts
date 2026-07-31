// ─── Pilot client-context questionnaire export (reusable across pilots) ──────
// Turns a pilot's canonical intake questions into a client-fillable CSV the
// owner can send out. Pure + deterministic + provider-free. Driven entirely by
// the questions the workspace already exposes, so it works for ANY pilot — no
// per-client hardcoding. It NEVER emits answers; the answer columns are blank
// for the client to complete (preserving the "no fabricated answers" invariant).

export const PILOT_QUESTIONNAIRE_VERSION = "pilot-questionnaire-v1";

// Spanish question text per canonical context field (shared 17-field META).
// Falls back to the question's own text for any field not listed here.
const QUESTION_ES: Record<string, string> = {
  price_positioning: "¿Cuál es el rango de precio mayorista verificable y el posicionamiento de la oferta B2B actual?",
  minimum_order: "¿Cuál es el pedido mínimo (en unidades o valor) para una cuenta B2B?",
  fulfillment_constraints: "¿Qué restricciones de inventario, despacho o transporte aplican a pedidos B2B?",
  certifications: "¿Qué registros, certificaciones y documentos de cumplimiento pueden demostrarse hoy?",
  product_formats: "¿Qué formatos y presentaciones están disponibles actualmente para venta B2B?",
  distribution_capability: "¿Con qué geografías y métodos de entrega puede cumplir pedidos B2B de forma confiable?",
  production_capacity: "¿Qué volumen mensual máximo puede abastecer de forma confiable a una sola cuenta?",
  account_size_constraints: "¿Qué tamaño de cuenta o rango de pedido resulta comercialmente viable hoy?",
  margins: "¿Qué margen bruto o margen para distribuidor debe cumplir una oportunidad B2B?",
  delivery_radius: "¿Qué ciudades, departamentos o zonas nacionales pueden atenderse de forma confiable hoy?",
  business_model: "¿Qué modelo de negocio B2B soporta la empresa actualmente?",
  company_stage: "¿Qué etapa describe mejor a la empresa hoy?",
  customization_capacity: "¿Qué personalización de producto o empaque está disponible operativamente hoy?",
  current_partnerships: "¿Qué distribuidores, aliados de canal o referencias B2B actuales pueden afectar el acceso a cuentas?",
  preferred_deal_type: "¿Qué modalidad comercial se prefiere: mayorista directo, distribuidor, piloto, gifting o alianza?",
  sales_cycle_tolerance: "¿Qué duración de ciclo comercial B2B es aceptable antes de descartar una cuenta?",
  white_label_capacity: "¿La producción de marca blanca está disponible, no disponible o condicionada?",
};

const CATEGORY_ES: Record<string, string> = {
  offer: "Oferta B2B", operational: "Capacidad y operación", economic: "Precios y márgenes",
  compliance: "Cumplimiento y certificaciones", commercial: "Estrategia comercial",
  strategic: "Estrategia y etapa", disqualifier: "Descalificadores",
};

const PRIORITY_ES: Record<string, string> = {
  critical_blocker: "Crítica", high_leverage: "Alta", important: "Importante",
  useful: "Útil", low_priority: "Baja", not_needed_now: "No necesaria ahora",
};
const PRIORITY_ORDER = ["critical_blocker", "high_leverage", "important", "useful", "low_priority", "not_needed_now"];

const FORMAT_ES: Record<string, string> = {
  range: "rango", numeric: "número", "free text": "texto libre", "multi-select": "opción múltiple",
  enum: "una opción", "document upload": "adjuntar documento",
};

export interface QuestionnaireQuestion {
  field?: string; category?: string; priority?: string; text?: string;
  who_should_answer?: string; answer_format?: string; document_can_answer?: boolean;
}

export interface QuestionnaireRow {
  n: number; prioridad: string; categoria: string; campo: string; pregunta: string;
  quien_responde: string; formato: string; evidencia_requerida: string;
}

/** Deterministic, priority-ordered rows. Pure — safe to unit test. */
export function buildPilotQuestionnaireRows(questions: QuestionnaireQuestion[]): QuestionnaireRow[] {
  const sorted = [...questions].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority ?? "important");
    const pb = PRIORITY_ORDER.indexOf(b.priority ?? "important");
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || (a.field ?? "").localeCompare(b.field ?? "");
  });
  return sorted.map((q, i) => ({
    n: i + 1,
    prioridad: PRIORITY_ES[q.priority ?? ""] ?? "Importante",
    categoria: CATEGORY_ES[q.category ?? ""] ?? (q.category ?? ""),
    campo: q.field ?? "",
    pregunta: (q.field && QUESTION_ES[q.field]) || q.text || "",
    quien_responde: q.who_should_answer ?? "",
    formato: FORMAT_ES[q.answer_format ?? ""] ?? (q.answer_format ?? ""),
    evidencia_requerida: q.document_can_answer ? "Documento o confirmación del cliente" : "Confirmación explícita del cliente",
  }));
}

function csvCell(value: string): string {
  const v = String(value ?? "");
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Build the client-fillable CSV (UTF-8 BOM for Excel). Answer columns are
 *  intentionally blank for the client to complete. */
export function buildPilotQuestionnaireCsv(input: { clientName: string; questions: QuestionnaireQuestion[] }): string {
  const rows = buildPilotQuestionnaireRows(input.questions);
  const header = [
    "#", "Prioridad", "Categoría", "Campo", "Pregunta",
    "Quién responde", "Formato de respuesta", "Evidencia requerida",
    "Respuesta del cliente", "Evidencia (documento o URL)", "¿No aplica / No sé?", "Notas",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push([
      String(r.n), r.prioridad, r.categoria, r.campo, r.pregunta,
      r.quien_responde, r.formato, r.evidencia_requerida,
      "", "", "", "", // client-fillable columns, blank by design
    ].map(csvCell).join(","));
  }
  // Leading BOM so Excel opens accents correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Safe download filename slug for a client name. */
export function questionnaireFilename(clientName: string, isoDate: string): string {
  const slug = clientName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "piloto";
  return `leadlens-${slug}-cuestionario-contexto-${isoDate}.csv`;
}
