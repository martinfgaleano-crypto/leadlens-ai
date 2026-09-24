// ─── Customer Deliverables — canonical report-template descriptor + representative sample ───────────
// A durable, versioned description of the four one-time report formats, plus a deterministic SAMPLE
// deliverable used by the Admin template-review surface. The sample is OBVIOUSLY SYNTHETIC (fictional
// companies, example.* sources) — it is never a real customer's private Intelligence, and rendering it
// consumes no research and no customer credit. Rendering is deterministic: the same template version +
// sample data produce materially equivalent output every time.
import type {
  DeliverableViewModel, AccountBriefVM, DecisionState, Strength,
} from "@/lib/deliverable/deliverable-view-model";
import type { DeliveryTier } from "@/lib/delivery-system/tier-composer";

export type TemplateApprovalState = "DRAFT" | "FOUNDER_REVIEW" | "APPROVED" | "RETIRED";

export interface ReportTemplateVersion {
  version: string;                 // canonical identifier
  approvalState: TemplateApprovalState;
  effectiveDate: string;           // ISO date the version entered its current state
  renderingSystem: string;         // how the artifacts are produced
  chartSystem: string[];           // the visualizations the template can render
  brandTokens: { ink: string; cobalt: string; sky: string; paper: string; rule: string };
  languages: Array<"en" | "es">;
  tiers: Array<{ tier: DeliveryTier; label: string; maxAccounts: number; price: number }>;
  knownLimitations: string[];
  // The building commit is resolved at runtime (Vercel injects it); "local" off-platform.
  sourceCommit: string;
}

export const REPORT_TEMPLATE_V2: ReportTemplateVersion = {
  version: "CUSTOMER_DELIVERABLES_V2",
  // NOT founder-approved until the founder reviews the four PDFs (§30/§33). Starts in review.
  approvalState: "FOUNDER_REVIEW",
  effectiveDate: "2026-09-24",
  renderingSystem: "DeliverableViewModel → TierComposer → PresentationModel → jsPDF (real application/pdf) / web / csv",
  chartSystem: [
    "Decision distribution bar (portfolio composition)",
    "Fit × Timing scatter (numbered dots keyed to the portfolio table; web + PDF)",
    "Evidence-coverage stat row (accounts / with-sources / dated / corroborated)",
  ],
  brandTokens: { ink: "#0F172A", cobalt: "#0284C7", sky: "#0EA5E9", paper: "#F6F9FC", rule: "#E2E8F0" },
  languages: ["en", "es"],
  tiers: [
    { tier: "preview", label: "Preview", maxAccounts: 2, price: 7 },
    { tier: "brief", label: "Brief", maxAccounts: 6, price: 25 },
    { tier: "intelligence", label: "Portfolio", maxAccounts: 12, price: 59 },
    { tier: "premium", label: "Premium", maxAccounts: 18, price: 129 },
  ],
  knownLimitations: [
    "Sample uses synthetic companies/sources — representative of layout only, not real Intelligence.",
    "PDF uses jsPDF standard fonts (WinAnsi/Latin-1): full coverage for English + Spanish (accents, ñ, ¿¡); non-Latin-1 scripts (e.g. CJK) are not yet supported and would require an embedded font.",
    "PDF evidence is summarized per account (source list + counts); the digital report additionally shows per-source Establishes/Observed/Affects relations.",
    "Not founder-approved until the four PDFs are reviewed (state = FOUNDER_REVIEW).",
  ],
  sourceCommit:
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_COMMIT_SHA ??
    "local",
};

// ─── Representative SAMPLE deliverable (synthetic; 18 accounts → capped per tier by the composer) ────
const NAMES: Array<[string, string, string]> = [
  ["Aceros del Caribe S.A.", "Manufactura", "Barranquilla, Colombia"],
  ["Logística Peñalosa Ltda.", "Logística", "Bogotá, Colombia"],
  ["Cementos Montañez", "Materiales", "Medellín, Colombia"],
  ["Café San Andrés Export", "Agroindustria", "Armenia, Colombia"],
  ["Química Ríohacha", "Químicos", "Riohacha, Colombia"],
  ["Textiles Muñoz Hermanos", "Textil", "Pereira, Colombia"],
  ["Distribuidora Ñandú", "Distribución", "Cali, Colombia"],
  ["Energía Solar Guajira", "Energía", "La Guajira, Colombia"],
  ["Puerto Verde Operaciones", "Portuario", "Cartagena, Colombia"],
  ["Alimentos Bocagrande", "Alimentos", "Cartagena, Colombia"],
  ["Maquinaria Andina", "Equipos", "Bucaramanga, Colombia"],
  ["Plásticos del Valle", "Plásticos", "Cali, Colombia"],
  ["Constructora Peña & Díaz", "Construcción", "Bogotá, Colombia"],
  ["Farmacéutica Bolívar", "Farma", "Cartagena, Colombia"],
  ["Vidrios Sabanalarga", "Materiales", "Atlántico, Colombia"],
  ["Transportes Güicán", "Transporte", "Boyacá, Colombia"],
  ["Pesquera Tumaco", "Pesca", "Nariño, Colombia"],
  ["Minerales Chocó", "Minería", "Chocó, Colombia"],
];
const DECISIONS: DecisionState[] = ["prioritize", "validate", "monitor", "hold"];
const STR: Strength[] = ["Strong", "Moderate", "Limited"];
const ROLES = ["Potential Customer", "Supplier", "Distributor", "Strategic Partner"];
const TYPES = ["Operations Expansion", "Capacity Expansion", "New Market Entry", "Vendor or Platform Change"];

type L = "en" | "es";
const T = (es: boolean, esS: string, enS: string) => (es ? esS : enS);

function sampleAccount(i: number, lang: L): AccountBriefVM {
  const es = lang === "es";
  const [company, segment, geography] = NAMES[i];
  const decision = DECISIONS[i % 4];
  const fit = STR[i % 3], timing = STR[(i + 1) % 3], ev = STR[(i + 2) % 3];
  const dated = i % 5 !== 0;
  return {
    id: `sample-${i + 1}`, rank: i + 1, company, segment, geography, domain: null,
    accountRole: i % 3 === 0 ? null : ROLES[i % 4],
    opportunityType: i % 4 === 0 ? null : TYPES[i % 4],
    decision,
    decisionNote: T(es,
      `${company} muestra un cambio público reciente que podría aumentar la necesidad de proveedores; la señal temporal aún debe confirmarse antes de comprometer esfuerzo comercial.`,
      `${company} shows a recent, dated public change that plausibly raises supplier need; the timing signal still needs confirming before committing effort.`),
    thesis: T(es,
      `La tesis para ${company}: el encaje con la oferta es ${fit.toLowerCase()} y hay una posible ventana de decisión abierta por la expansión reciente. Aún no hay un evento de compra confirmado — tratar como hipótesis de encaje y momento a validar, no como una señal de compra.`,
      `Thesis for ${company}: fit with the offer is ${fit.toLowerCase()} and a decision window may be open from the recent expansion. No purchase event is confirmed — treat as a fit-and-timing hypothesis to validate, not a buying signal.`),
    whyItMatters: null,
    dimensions: [
      { label: es ? "Encaje" : "Fit", value: fit, note: null },
      { label: es ? "Momento" : "Timing", value: timing, note: null },
      { label: es ? "Evidencia" : "Evidence", value: ev, note: null },
    ],
    whatChanged: dated ? [
      { event: T(es, `Anunció una ampliación de planta en ${geography.split(",")[0]}`, `Announced a plant expansion in ${geography.split(",")[0]}`), date: `2026-08-${String((i % 27) + 1).padStart(2, "0")}`, age: `${(i % 27) + 3}d`, source: "example.com", kind: "recent_event" },
    ] : [],
    evidence: { sourceCount: dated ? 3 : 1, datedCount: dated ? 2 : 0, corroborated: i % 2 === 0 ? true : null, latestAge: dated ? `${(i % 27) + 3}d` : null, strength: ev },
    sources: [
      { label: T(es, "Prensa sectorial (ejemplo)", "Sector press (example)"), url: "https://example.com/sector-note", date: dated ? "2026-08-10" : null, age: dated ? "9d" : null, relation: "direct", claim: T(es, "Reporta la ampliación", "Reports the expansion"), observation: null, basis: "observed", impacts: ["what_changed", "timing"] },
      { label: T(es, "Registro mercantil (ejemplo)", "Business registry (example)"), url: "https://example.org/registry", date: null, age: null, relation: "context", claim: T(es, "Establece tamaño", "Establishes size"), observation: null, basis: "inferred", impacts: ["fit"] },
    ],
    counterSignals: [T(es, `No hay confirmación de un proceso de compra abierto en ${company}.`, `No confirmed open purchasing process at ${company}.`)],
    limitations: [T(es, "Evidencia pública limitada; sin acceso a datos internos.", "Limited public evidence; no internal data.")],
    validations: [T(es, `Confirmar con ${company} si la ampliación implica nuevas compras en el próximo trimestre.`, `Confirm with ${company} whether the expansion implies new purchases next quarter.`)],
    nextStep: T(es, `Contactar al área de operaciones de ${company} para validar la ventana de decisión.`, `Contact ${company}'s operations team to validate the decision window.`),
    freshness: dated ? { label: es ? "Reciente" : "Recent", age: `${(i % 27) + 3}d` } : null,
    confidence: ev,
  };
}

/** Deterministic representative deliverable (18 synthetic accounts). Clearly labeled SAMPLE. */
export function buildSampleDeliverable(lang: L = "es"): DeliverableViewModel {
  const es = lang === "es";
  const accounts = Array.from({ length: 18 }, (_, i) => sampleAccount(i, lang));
  const counts = accounts.reduce((m, a) => { m[a.decision]++; return m; }, { prioritize: 0, validate: 0, monitor: 0, hold: 0 } as Record<DecisionState, number>);
  return {
    meta: {
      client: T(es, "Muestra de plantilla (datos sintéticos)", "Template sample (synthetic data)"),
      market: T(es, "Caribe colombiano · manufactura y logística", "Colombian Caribbean · manufacturing & logistics"),
      generatedAt: "2026-09-24T00:00:00.000Z",
      generatedLabel: T(es, "24 de septiembre de 2026", "September 24, 2026"),
      tierLabel: "Premium", language: lang, schemaVersion: 1,
    },
    headline: T(es, "1 cuenta prioritaria identificada (muestra)", "1 priority account identified (sample)"),
    summary: T(es,
      "Muestra de plantilla con datos sintéticos para revisión de formato. Ningún evento de compra está confirmado — cada cuenta es una hipótesis de encaje y momento a validar.",
      "Template sample with synthetic data for format review. No purchase event is confirmed — each account is a fit-and-timing hypothesis to validate."),
    portfolio: { total: 18, counts, allocation: { line: T(es, "Dónde concentrar la atención primero", "Where attention goes first"), detail: T(es, "prioritize primero, luego validate", "prioritize first, then validate") }, funnel: { considered: 40, rejected: 22, selected: 18 }, note: T(es, "Orden por decisión canónica; sin puntaje sintético.", "Ordered by canonical decision; no synthetic score.") },
    accounts,
    commercialContext: { objective: T(es, "Ampliar la base de clientes industriales", "Grow the industrial client base"), clientDescription: null, summary: T(es, "Consultoría de operaciones que vende a manufactura y logística.", "Operations consultancy selling to manufacturing & logistics."), regions: [T(es, "Caribe colombiano", "Colombian Caribbean")], industries: ["Manufactura", "Logística", "Materiales"], criteria: [T(es, "Cambio operativo reciente", "Recent operational change")] },
    validationQueue: accounts.filter((a) => a.decision === "prioritize" || a.decision === "validate").slice(0, 6).map((a) => ({ accountId: a.id, company: a.company, decision: a.decision, items: a.validations })),
    coverage: { withDatedEvidence: accounts.filter((a) => a.evidence.datedCount > 0).length, withSources: accounts.length, corroborated: accounts.filter((a) => a.evidence.corroborated === true).length, grade: "Moderate", note: T(es, "Cobertura basada solo en evidencia pública fechada.", "Coverage based only on dated public evidence.") },
    methodology: [T(es, "Recuperación de eventos públicos con fecha.", "Retrieval of dated public events."), T(es, "Síntesis de caso con decisión canónica.", "Case synthesis with canonical decision."), T(es, "Sin puntajes opacos ni probabilidades inventadas.", "No opaque scores or invented probabilities.")],
    limitations: [T(es, "Datos sintéticos de demostración — no es un cliente real.", "Synthetic demo data — not a real customer."), T(es, "Evidencia pública limitada por cuenta.", "Limited public evidence per account.")],
    downloads: { pdf: true, portfolioCsv: true, evidenceCsv: true },
    capabilities: { showPortfolioTab: true, showCompareTab: true, showEvidenceTab: true, showDownloadsTab: true, showMethodology: true },
  };
}
