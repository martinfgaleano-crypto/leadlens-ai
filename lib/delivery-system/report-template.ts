// ─── Customer Deliverables — canonical report-template descriptor + representative sample ───────────
// A durable, versioned description of the four one-time report formats, plus a deterministic SAMPLE
// deliverable used by the Admin template-review surface. The sample is OBVIOUSLY SYNTHETIC (fictional
// companies, example.* sources) — it is never a real customer's private Intelligence, and rendering it
// consumes no research and no customer credit. Rendering is deterministic: the same template version +
// sample data produce materially equivalent output every time.
//
// V2.1 rebuild: the sample is a CURATED set of 18 genuinely differentiated commercial cases (varied
// sectors, decisions, evidence situations and sector-appropriate validation actions) so the template is
// reviewed against realistic variety rather than a repetitive template. Every recency label is computed
// from the case's actual event date relative to the report date, and each account's evidence counts
// reconcile with its listed sources.
import {
  type DeliverableViewModel, type AccountBriefVM, type DecisionState, type Strength, type ChangeVM, type SourceVM,
  orderByAttention,
} from "@/lib/deliverable/deliverable-view-model";
import type { DeliveryTier } from "@/lib/delivery-system/tier-composer";

export type TemplateApprovalState = "DRAFT" | "FOUNDER_REVIEW" | "APPROVED" | "RETIRED";

export interface ReportTemplateVersion {
  version: string;
  supersedes: string | null;
  approvalState: TemplateApprovalState;
  effectiveDate: string;
  renderingSystem: string;
  chartSystem: string[];
  brandTokens: { ink: string; cobalt: string; sky: string; paper: string; rule: string };
  languages: Array<"en" | "es">;
  tiers: Array<{ tier: DeliveryTier; label: string; maxAccounts: number; price: number }>;
  knownLimitations: string[];
  sourceCommit: string;
}

/** History of report-template versions (newest first) — preserved so the Admin registry shows lineage. */
export const TEMPLATE_HISTORY: Array<{ version: string; effectiveDate: string; note: string }> = [
  { version: "CUSTOMER_DELIVERABLES_V2_4", effectiveDate: "2026-09-26", note: "Final commercial acceptance + canonical freeze: deep dossiers rendered by composition (per-source provenance + what-would-change, Portfolio 4 / Premium 6); stakeholder FUNCTION hypotheses (inferred functional roles, never named people) rendered Premium-only; momentum/decay/market-patterns worded as truthful conditionals (freshness-now / Monitor-history / observed-clusters), never fabricated trends; tier-contract matrix marks deep-dossiers + stakeholder-functions as rendered. Presentation-only; product truth + economics frozen." },
  { version: "CUSTOMER_DELIVERABLES_V2_3", effectiveDate: "2026-09-25", note: "Contract fulfillment: coverage-gaps + portfolio-risk + commercial playbooks (derived from existing data); discovery-questions mapped to validations; momentum/decay honestly deferred to Monitor; canonical decision-consistency guard (John Deere class) applied at the delivery seam for all channels." },
  { version: "CUSTOMER_DELIVERABLES_V2_2", effectiveDate: "2026-09-25", note: "Product-identity cover (product name as title, decision distribution secondary); per-tier 'What's included' band + Admin tier-contract matrix; defect closure (Premium language leak, John Deere HOLD framing, Portfolio copy, clickable source links, on-target sample)." },
  { version: "CUSTOMER_DELIVERABLES_V2_1", effectiveDate: "2026-09-24", note: "Differentiated sample; tier-scoped metrics; computed recency; localized PDF labels; premium-tension grouping." },
  { version: "CUSTOMER_DELIVERABLES_V2", effectiveDate: "2026-09-24", note: "Premium dossiers, Fit×Timing chart, Admin template registry." },
];

export const REPORT_TEMPLATE: ReportTemplateVersion = {
  version: "CUSTOMER_DELIVERABLES_V2_4",
  supersedes: "CUSTOMER_DELIVERABLES_V2_3",
  // NOT founder-approved until the founder reviews the four PDFs (§64). Starts in review.
  approvalState: "FOUNDER_REVIEW",
  effectiveDate: "2026-09-26",
  renderingSystem: "DeliverableViewModel → TierComposer → PresentationModel → jsPDF (real application/pdf) / web / csv",
  chartSystem: [
    "Decision distribution bar (portfolio composition)",
    "Fit × Timing scatter (numbered dots keyed to the portfolio table; web + PDF)",
    "Evidence-coverage stat row (companies with sources / dated / corroborated — tier-scoped)",
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
    "Sample uses synthetic companies/sources (example.*) — representative of layout + variety only, not real Intelligence.",
    "PDF uses jsPDF standard fonts (WinAnsi/Latin-1): full coverage for English + Spanish (accents, ñ, ¿¡); non-Latin-1 scripts (e.g. CJK) are not yet supported and would require an embedded font.",
    "PDF evidence is summarized per account (source list + counts); the digital report additionally shows per-source Establishes/Observed/Affects relations.",
    "Deep dossiers are a COMPOSITION treatment (fuller per-source provenance + 'what would change the decision' for the top accounts), not additional research beyond the evaluated evidence.",
    "Stakeholder hypotheses are INFERRED FUNCTIONS (e.g. Operations, IT/Systems) derived from the account's own opportunity type — never named people, titles, emails or budget authority.",
    "Momentum/decay reflect current evidence freshness; a full trajectory requires observation history via Monitor. Market patterns are the observed portfolio clusters, never an extrapolation to the whole market.",
    "Not founder-approved until the four PDFs are reviewed (state = FOUNDER_REVIEW).",
  ],
  sourceCommit:
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_COMMIT_SHA ??
    "local",
};

/** Back-compat alias for callers importing the previous name. Points at the current template. */
export const REPORT_TEMPLATE_V2 = REPORT_TEMPLATE;

// ─── Curated differentiated sample (18 synthetic cases) ─────────────────────────────────────────────
const REPORT_DATE = "2026-09-24T00:00:00.000Z";
const REPORT_MS = Date.parse(REPORT_DATE);
const daysAgo = (dateIso: string): number => Math.max(0, Math.round((REPORT_MS - Date.parse(dateIso)) / 86_400_000));
const ageLabel = (dateIso: string, es: boolean): string => {
  const d = daysAgo(dateIso);
  if (d < 45) return es ? `hace ${d} d` : `${d}d ago`;
  const m = Math.round(d / 30);
  return es ? `hace ${m} m` : `${m}mo ago`;
};

type Lang = "en" | "es";
type Bi = { es: string; en: string };
const bi = (es: string, en: string): Bi => ({ es, en });
const pick = (b: Bi, lang: Lang) => (lang === "es" ? b.es : b.en);

interface Ev { date: string; event: Bi }
interface Src { label: Bi; url: string; date: string | null; relation: "direct" | "corroborating" | "context"; claim: Bi }
interface Case {
  company: string; segment: Bi; geography: string;
  role: Bi | null; opp: Bi | null;
  decision: DecisionState; fit: Strength; timing: Strength; evidence: Strength;
  onTarget: boolean;              // within the customer's stated objective/geography
  thesis: Bi; decisionNote: Bi;
  events: Ev[];                   // dated changes (may be empty = honest no-trigger)
  sources: Src[];                 // discovery sources (all listed)
  claimSupportingSources: number; // subset genuinely supporting the specific claim (≤ sources.length)
  corroborated: boolean | null;   // ≥2 independent origins genuinely supporting the claim
  counterSignals: Bi[]; validations: Bi[]; nextStep: Bi; limitations: Bi[];
}

// 18 distinct cases. Decision mix: 3 prioritize · 5 validate · 6 monitor · 4 hold.
const CASES: Case[] = [
  {
    company: "Aceros del Caribe S.A.", segment: bi("Manufactura siderúrgica", "Steel manufacturing"), geography: "Barranquilla, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: bi("Expansión de capacidad", "Capacity Expansion"),
    decision: "prioritize", fit: "Strong", timing: "Strong", evidence: "Strong", onTarget: true,
    thesis: bi("Aceros del Caribe encaja de lleno con la práctica de eficiencia operativa de la consultoría: es una siderúrgica de tamaño medio que acaba de anunciar una segunda línea de laminación. El anuncio, con fecha y corroborado por dos medios, abre una ventana concreta para asesorar el rediseño de flujo de planta antes de que se contraten los integradores.",
      "Aceros del Caribe fits the consultancy's operational-efficiency practice squarely: a mid-size steelmaker that just announced a second rolling line. The dated announcement, corroborated by two outlets, opens a concrete window to advise the plant-flow redesign before integrators are contracted."),
    decisionNote: bi("Encaje fuerte y evento fechado reciente y corroborado: el caso más sólido del portafolio para actuar ahora.", "Strong fit plus a recent, dated, corroborated event: the portfolio's strongest case to act now."),
    events: [
      { date: "2026-09-12", event: bi("Anunció una segunda línea de laminación con inversión declarada", "Announced a second rolling line with a stated investment") },
      { date: "2026-09-04", event: bi("Publicó una búsqueda de gerente de mejora continua", "Posted a continuous-improvement manager search") },
    ],
    sources: [
      { label: bi("Prensa económica (ejemplo)", "Business press (example)"), url: "https://example.com/aceros-linea", date: "2026-09-12", relation: "direct", claim: bi("Reporta la nueva línea", "Reports the new line") },
      { label: bi("Diario regional (ejemplo)", "Regional daily (example)"), url: "https://example.org/aceros-region", date: "2026-09-13", relation: "corroborating", claim: bi("Confirma el anuncio de forma independiente", "Independently confirms the announcement") },
      { label: bi("Portal de empleo (ejemplo)", "Job board (example)"), url: "https://example.net/aceros-empleo", date: "2026-09-04", relation: "corroborating", claim: bi("Evidencia la contratación de mejora continua", "Evidences the continuous-improvement hire") },
    ],
    claimSupportingSources: 3, corroborated: true,
    counterSignals: [bi("La inversión podría ejecutarse con los integradores ya contratados en la primera línea.", "The investment could run through integrators already contracted for the first line.")],
    validations: [bi("Confirmar si el rediseño de flujo de la nueva línea está adjudicado o aún abierto a asesoría externa.", "Confirm whether the new line's flow redesign is awarded or still open to external advice.")],
    nextStep: bi("Contactar a la gerencia de operaciones antes del cierre de la ingeniería de detalle.", "Reach operations management before detailed engineering closes."),
    limitations: [bi("Sin acceso al cronograma de contratación de la nueva línea.", "No access to the new line's contracting timeline.")],
  },
  {
    company: "TransCaribe Logística Ltda.", segment: bi("Logística de cadena de frío", "Cold-chain logistics"), geography: "Cartagena, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: bi("Expansión operativa", "Operations Expansion"),
    decision: "prioritize", fit: "Strong", timing: "Moderate", evidence: "Moderate", onTarget: true,
    thesis: bi("TransCaribe abrió un centro de frío nuevo en la zona portuaria: un cambio operativo real que suele traer reingeniería de rutas y de almacén, justo el terreno de la consultoría. La evidencia es sólida pero la ventana de decisión aún no está fechada, por eso el momento es moderado y no fuerte.",
      "TransCaribe opened a new cold-storage hub in the port zone: a real operational change that usually brings route and warehouse re-engineering, exactly the consultancy's ground. Evidence is solid but the decision window is not yet dated, so timing is moderate, not strong."),
    decisionNote: bi("Encaje fuerte con un cambio operativo confirmado; se prioriza aunque el momento exacto está por fechar.", "Strong fit with a confirmed operational change; prioritized even though the exact timing is still to be dated."),
    events: [{ date: "2026-08-28", event: bi("Inauguró un centro de cadena de frío en zona portuaria", "Opened a cold-chain hub in the port zone") }],
    sources: [
      { label: bi("Boletín logístico (ejemplo)", "Logistics bulletin (example)"), url: "https://example.com/transcaribe-frio", date: "2026-08-28", relation: "direct", claim: bi("Reporta la apertura del centro", "Reports the hub opening") },
      { label: bi("Cámara de comercio (ejemplo)", "Chamber of commerce (example)"), url: "https://example.org/transcaribe-registro", date: null, relation: "context", claim: bi("Establece tamaño y antigüedad", "Establishes size and age") },
    ],
    claimSupportingSources: 1, corroborated: null,
    counterSignals: [bi("La operación del centro podría gestionarse con el equipo interno sin asesoría externa.", "The hub could be run by the internal team without external advice.")],
    validations: [bi("Verificar si el diseño de rutas y slotting del nuevo centro ya está definido o se está evaluando.", "Verify whether the new hub's routing and slotting design is set or under evaluation.")],
    nextStep: bi("Ofrecer un diagnóstico corto de flujo de almacén como puerta de entrada.", "Offer a short warehouse-flow diagnostic as an entry point."),
    limitations: [bi("Una sola fuente directa; falta corroboración independiente del alcance.", "Single direct source; independent corroboration of scope is missing.")],
  },
  {
    company: "Distribuidora Magdalena", segment: bi("Distribución mayorista", "Wholesale distribution"), geography: "Santa Marta, Colombia",
    role: bi("Distribuidor", "Distributor"), opp: bi("Entrada a nuevo mercado", "New Market Entry"),
    decision: "validate", fit: "Moderate", timing: "Strong", evidence: "Moderate", onTarget: true,
    thesis: bi("Distribuidora Magdalena está entrando a la región de La Guajira, un movimiento de expansión de red con señal temporal fuerte y fechada. El encaje es moderado: la consultoría aporta en diseño de cobertura y territorios, no en la operación de distribución en sí, por lo que conviene validar el alcance del apoyo antes de priorizar.",
      "Distribuidora Magdalena is entering the La Guajira region — a network-expansion move with a strong, dated timing signal. Fit is moderate: the consultancy helps with coverage and territory design, not distribution operations per se, so the scope of support should be validated before prioritizing."),
    decisionNote: bi("Momento fuerte y fechado, pero el encaje del servicio con una distribuidora aún debe confirmarse.", "Strong dated timing, but the service's fit with a distributor still needs confirming."),
    events: [{ date: "2026-09-08", event: bi("Anunció apertura de operación en La Guajira", "Announced opening of operations in La Guajira") }],
    sources: [
      { label: bi("Prensa regional (ejemplo)", "Regional press (example)"), url: "https://example.com/magdalena-guajira", date: "2026-09-08", relation: "direct", claim: bi("Reporta la expansión regional", "Reports the regional expansion") },
      { label: bi("Nota gremial (ejemplo)", "Trade note (example)"), url: "https://example.org/magdalena-gremio", date: "2026-09-10", relation: "corroborating", claim: bi("Corrobora la apertura", "Corroborates the opening") },
    ],
    claimSupportingSources: 2, corroborated: true,
    counterSignals: [bi("La expansión de una distribuidora puede no requerir asesoría de operaciones industriales.", "A distributor's expansion may not need industrial-operations advice.")],
    validations: [bi("Confirmar si el diseño de cobertura y territorios en La Guajira está internalizado o abierto a apoyo externo.", "Confirm whether coverage/territory design in La Guajira is in-house or open to external support.")],
    nextStep: bi("Explorar un piloto de diseño de territorios antes de comprometer un mandato mayor.", "Explore a territory-design pilot before committing to a larger mandate."),
    limitations: [bi("Encaje del servicio con el modelo de distribución sin confirmar.", "Service fit with the distribution model unconfirmed.")],
  },
  {
    company: "Servicios Industriales Bolívar", segment: bi("Servicios de mantenimiento industrial", "Industrial maintenance services"), geography: "Cartagena, Colombia",
    role: bi("Socio estratégico", "Strategic Partner"), opp: bi("Alianza de canal", "Channel Partnership"),
    decision: "validate", fit: "Strong", timing: "Limited", evidence: "Limited", onTarget: true,
    thesis: bi("Servicios Industriales Bolívar tiene un encaje fuerte como socio de canal: atiende a las mismas plantas que la consultoría quiere alcanzar. El problema es la evidencia: no hay un evento reciente que confirme apetito de alianza, solo la lógica del mercado. Es un caso a validar por conversación, no por señal pública.",
      "Servicios Industriales Bolívar is a strong channel-partner fit: it serves the same plants the consultancy wants to reach. The gap is evidence — there is no recent event confirming partnership appetite, only market logic. This is a case to validate by conversation, not by public signal."),
    decisionNote: bi("Encaje fuerte de canal pero sin evidencia reciente: validar apetito directamente.", "Strong channel fit but no recent evidence: validate appetite directly."),
    events: [],
    sources: [
      { label: bi("Directorio industrial (ejemplo)", "Industrial directory (example)"), url: "https://example.com/bolivar-directorio", date: null, relation: "context", claim: bi("Establece cartera de clientes de planta", "Establishes plant client base") },
    ],
    claimSupportingSources: 0, corroborated: null,
    counterSignals: [bi("Podría preferir mantener sus servicios sin sumar un socio de consultoría.", "May prefer to keep its services without adding a consulting partner.")],
    validations: [bi("Sondear directamente el interés en una alianza de canal; no hay señal pública que lo confirme.", "Directly gauge interest in a channel partnership; no public signal confirms it.")],
    nextStep: bi("Reunión exploratoria de alianza; el caso no se resuelve con evidencia pública.", "Exploratory partnership meeting; this case is not resolved by public evidence."),
    limitations: [bi("Sin evento reciente ni fuente fechada; encaje inferido del mercado.", "No recent event or dated source; fit inferred from the market.")],
  },
  {
    company: "Vidrios del Magdalena", segment: bi("Materiales — vidrio", "Materials — glass"), geography: "Ciénaga, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: bi("Modernización tecnológica", "Technology Modernization"),
    decision: "validate", fit: "Strong", timing: "Moderate", evidence: "Moderate", onTarget: true,
    thesis: bi("Vidrios del Magdalena da señales contradictorias: una fuente reporta modernización de horno (que abriría trabajo de eficiencia energética), otra sugiere recorte de costos que podría posponerla. El encaje es fuerte; la contradicción es exactamente lo que hay que resolver antes de invertir esfuerzo comercial.",
      "Vidrios del Magdalena sends contradictory signals: one source reports a furnace modernization (which would open energy-efficiency work), another suggests cost-cutting that could postpone it. Fit is strong; the contradiction is precisely what to resolve before investing commercial effort."),
    decisionNote: bi("Encaje fuerte con evidencia contradictoria sobre el momento: validar cuál señal manda.", "Strong fit with contradictory evidence on timing: validate which signal governs."),
    events: [{ date: "2026-08-19", event: bi("Reportes de modernización de horno, no confirmados en firme", "Furnace-modernization reports, not firmly confirmed") }],
    sources: [
      { label: bi("Revista sectorial (ejemplo)", "Sector magazine (example)"), url: "https://example.com/vidrios-horno", date: "2026-08-19", relation: "direct", claim: bi("Reporta modernización de horno", "Reports furnace modernization") },
      { label: bi("Análisis financiero (ejemplo)", "Financial analysis (example)"), url: "https://example.org/vidrios-costos", date: "2026-08-22", relation: "context", claim: bi("Sugiere presión de costos que podría posponer inversión", "Suggests cost pressure that could postpone investment") },
    ],
    claimSupportingSources: 1, corroborated: null,
    counterSignals: [bi("La presión de costos podría aplazar cualquier inversión de modernización.", "Cost pressure could defer any modernization investment.")],
    validations: [bi("Confirmar si la modernización de horno sigue en pie pese a la presión de costos reportada.", "Confirm whether the furnace modernization stands despite the reported cost pressure.")],
    nextStep: bi("Pedir confirmación del estado de la inversión antes de preparar una propuesta.", "Ask for the investment's status before preparing a proposal."),
    limitations: [bi("Señales cruzadas; ninguna fuente confirma la decisión final.", "Crossed signals; no source confirms the final decision.")],
  },
  {
    company: "Astilleros Cartagena", segment: bi("Industria naval", "Shipbuilding"), geography: "Cartagena, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: bi("Expansión operativa", "Operations Expansion"),
    decision: "validate", fit: "Strong", timing: "Moderate", evidence: "Limited", onTarget: true,
    thesis: bi("Astilleros Cartagena encaja bien con la práctica de productividad, y hay indicios de un nuevo contrato de reparación que aumentaría la carga de taller. La evidencia es limitada —un solo reporte sin corroborar— así que el paso correcto es validar el contrato antes de tratarlo como oportunidad firme.",
      "Astilleros Cartagena fits the productivity practice well, and there are hints of a new repair contract that would raise shop load. Evidence is limited — a single uncorroborated report — so the right step is to validate the contract before treating it as a firm opportunity."),
    decisionNote: bi("Encaje fuerte con una señal prometedora pero sin corroborar: validar antes de priorizar.", "Strong fit with a promising but uncorroborated signal: validate before prioritizing."),
    events: [{ date: "2026-09-01", event: bi("Indicios de un nuevo contrato de reparación de gran calado", "Hints of a new deep-draft repair contract") }],
    sources: [
      { label: bi("Nota portuaria (ejemplo)", "Port note (example)"), url: "https://example.com/astilleros-contrato", date: "2026-09-01", relation: "direct", claim: bi("Menciona un posible contrato", "Mentions a possible contract") },
    ],
    claimSupportingSources: 1, corroborated: null,
    counterSignals: [bi("El contrato podría no materializarse o ejecutarse con capacidad instalada.", "The contract may not materialize or may run on existing capacity.")],
    validations: [bi("Confirmar si el contrato de reparación se adjudicó y si presiona la capacidad de taller.", "Confirm whether the repair contract was awarded and whether it strains shop capacity.")],
    nextStep: bi("Validar la carga de taller proyectada con el área de producción.", "Validate projected shop load with the production area."),
    limitations: [bi("Fuente única sin fecha de evento confirmada.", "Single source with no confirmed event date.")],
  },
  {
    company: "Energía Eólica Guajira", segment: bi("Energía renovable", "Renewable energy"), geography: "La Guajira, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: bi("Expansión de capacidad", "Capacity Expansion"),
    decision: "monitor", fit: "Strong", timing: "Limited", evidence: "Moderate", onTarget: true,
    thesis: bi("El parque de Energía Eólica Guajira encaja con la consultoría en gestión de proyectos de construcción, pero su expansión depende de una licencia ambiental aún en trámite. Hasta que haya una resolución, no hay ventana de decisión: es un caso para monitorear el hito regulatorio, no para actuar.",
      "The Energía Eólica Guajira farm fits the consultancy's construction-project management, but its expansion depends on an environmental permit still in process. Until there is a ruling, there is no decision window: this is a case to monitor the regulatory milestone, not to act."),
    decisionNote: bi("Encaje fuerte pero el momento está bloqueado por un trámite regulatorio: monitorear.", "Strong fit but timing is blocked by a regulatory process: monitor."),
    events: [{ date: "2026-07-30", event: bi("Solicitó licencia ambiental para ampliar el parque", "Applied for an environmental permit to expand the farm") }],
    sources: [
      { label: bi("Boletín ambiental (ejemplo)", "Environmental bulletin (example)"), url: "https://example.com/eolica-licencia", date: "2026-07-30", relation: "direct", claim: bi("Registra la solicitud de licencia", "Records the permit application") },
      { label: bi("Prensa energética (ejemplo)", "Energy press (example)"), url: "https://example.org/eolica-plan", date: "2026-08-02", relation: "corroborating", claim: bi("Describe el plan de ampliación", "Describes the expansion plan") },
    ],
    claimSupportingSources: 2, corroborated: true,
    counterSignals: [bi("La licencia puede negarse o demorarse meses, difiriendo cualquier obra.", "The permit may be denied or delayed months, deferring any works.")],
    validations: [bi("Seguir la resolución de la licencia ambiental como disparador de reevaluación.", "Track the environmental-permit ruling as the reassessment trigger.")],
    nextStep: bi("Reevaluar cuando la licencia se resuelva; hoy no hay ventana accionable.", "Reassess when the permit resolves; today there is no actionable window."),
    limitations: [bi("El calendario regulatorio es incierto y fuera del control de la empresa.", "The regulatory calendar is uncertain and outside the company's control.")],
  },
  {
    company: "Metalúrgica Sabanas", segment: bi("Metalmecánica", "Metalworking"), geography: "Sabanalarga, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: bi("Modernización tecnológica", "Technology Modernization"),
    decision: "monitor", fit: "Moderate", timing: "Moderate", evidence: "Strong", onTarget: true,
    thesis: bi("Metalúrgica Sabanas tiene la evidencia mejor corroborada del portafolio —tres fuentes independientes sobre una automatización de línea— pero el evento es de junio y no hay señal de que siga abierto. El encaje es moderado; conviene monitorear si la automatización deriva en una segunda fase donde la consultoría aporte.",
      "Metalúrgica Sabanas has the portfolio's best-corroborated evidence — three independent sources on a line automation — but the event is from June with no sign it is still open. Fit is moderate; worth monitoring whether the automation leads to a second phase where the consultancy can help."),
    decisionNote: bi("Evidencia fuerte pero ya no reciente; monitorear una posible segunda fase.", "Strong but no-longer-recent evidence; monitor for a possible second phase."),
    events: [{ date: "2026-06-15", event: bi("Completó la automatización de una línea de corte", "Completed automation of a cutting line") }],
    sources: [
      { label: bi("Revista industrial (ejemplo)", "Industry magazine (example)"), url: "https://example.com/sabanas-automatiza", date: "2026-06-15", relation: "direct", claim: bi("Reporta la automatización", "Reports the automation") },
      { label: bi("Nota gremial (ejemplo)", "Trade note (example)"), url: "https://example.org/sabanas-gremio", date: "2026-06-18", relation: "corroborating", claim: bi("Confirma el proyecto", "Confirms the project") },
      { label: bi("Caso de proveedor (ejemplo)", "Vendor case (example)"), url: "https://example.net/sabanas-proveedor", date: "2026-06-20", relation: "corroborating", claim: bi("Detalla el alcance técnico", "Details the technical scope") },
    ],
    claimSupportingSources: 3, corroborated: true,
    counterSignals: [bi("El proyecto parece cerrado; puede no haber una segunda fase pronto.", "The project appears closed; a second phase may not come soon.")],
    validations: [bi("Vigilar anuncios de una segunda fase de automatización o de nuevas líneas.", "Watch for announcements of a second automation phase or new lines.")],
    nextStep: bi("Mantener en observación; reactivar el contacto ante una nueva fase.", "Keep under observation; reactivate contact on a new phase."),
    limitations: [bi("La evidencia es sólida pero antigua (más de tres meses).", "Evidence is solid but old (over three months).")],
  },
  {
    company: "Alimentos del Atlántico", segment: bi("Alimentos procesados", "Processed foods"), geography: "Soledad, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: null,
    decision: "monitor", fit: "Moderate", timing: "Limited", evidence: "Limited", onTarget: true,
    thesis: bi("Desde la última revisión no hay cambio material en Alimentos del Atlántico: ni evento nuevo, ni fuente reciente. El encaje sectorial existe, pero sin un disparador la recomendación honesta es monitorear y no forzar una conclusión comercial que la evidencia no sostiene.",
      "Since the last review there is no material change at Alimentos del Atlántico: no new event, no recent source. Sector fit exists, but without a trigger the honest recommendation is to monitor and not force a commercial conclusion the evidence does not support."),
    decisionNote: bi("Sin cambio material desde la última revisión: monitorear, sin acción hoy.", "No material change since last review: monitor, no action today."),
    events: [],
    sources: [
      { label: bi("Perfil de empresa (ejemplo)", "Company profile (example)"), url: "https://example.com/atlantico-perfil", date: null, relation: "context", claim: bi("Establece sector y tamaño", "Establishes sector and size") },
    ],
    claimSupportingSources: 0, corroborated: null,
    counterSignals: [bi("Sin disparador reciente, cualquier acercamiento sería especulativo.", "Without a recent trigger, any outreach would be speculative.")],
    validations: [bi("Programar una nueva revisión en el próximo ciclo para detectar cambios.", "Schedule a fresh review next cycle to catch changes.")],
    nextStep: bi("Sin acción inmediata; volver a evaluar en la próxima revisión.", "No immediate action; re-evaluate at the next review."),
    limitations: [bi("Evidencia pública mínima y sin fechar.", "Minimal, undated public evidence.")],
  },
  {
    company: "Constructora Ribera", segment: bi("Construcción industrial", "Industrial construction"), geography: "Barranquilla, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: bi("Expansión operativa", "Operations Expansion"),
    decision: "monitor", fit: "Moderate", timing: "Moderate", evidence: "Moderate", onTarget: true,
    thesis: bi("Constructora Ribera se presentó a una licitación pública de infraestructura logística. Si la gana, habrá un pico de obra donde la consultoría aporta en planeación; si la pierde, no hay caso. El resultado aún no se conoce, por eso se monitorea el fallo de la licitación.",
      "Constructora Ribera bid on a public logistics-infrastructure tender. If it wins, there will be a works peak where the consultancy adds planning value; if it loses, there is no case. The outcome is unknown, so the tender award is monitored."),
    decisionNote: bi("El caso depende de un fallo de licitación aún no publicado: monitorear el resultado.", "The case hinges on a tender ruling not yet published: monitor the outcome."),
    events: [{ date: "2026-08-25", event: bi("Se presentó a una licitación de infraestructura logística", "Bid on a logistics-infrastructure tender") }],
    sources: [
      { label: bi("Portal de contratación (ejemplo)", "Procurement portal (example)"), url: "https://example.com/ribera-licitacion", date: "2026-08-25", relation: "direct", claim: bi("Registra la presentación a la licitación", "Records the tender submission") },
    ],
    claimSupportingSources: 1, corroborated: null,
    counterSignals: [bi("Si no gana la licitación, no habrá pico de obra ni caso.", "If it loses the tender, there is no works peak and no case.")],
    validations: [bi("Seguir la adjudicación de la licitación como disparador.", "Track the tender award as the trigger.")],
    nextStep: bi("Reevaluar tras el fallo; preparar un acercamiento condicional a que gane.", "Reassess after the ruling; prepare outreach conditional on a win."),
    limitations: [bi("El resultado depende de un tercero (la entidad contratante).", "The outcome depends on a third party (the contracting entity).")],
  },
  {
    company: "Frigoríficos Ciénaga", segment: bi("Cadena de frío alimentaria", "Food cold chain"), geography: "Ciénaga, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: bi("Expansión de capacidad", "Capacity Expansion"),
    decision: "monitor", fit: "Moderate", timing: "Moderate", evidence: "Limited", onTarget: true,
    thesis: bi("Frigoríficos Ciénaga menciona planes de ampliar cámaras frías, un cambio que encajaría con trabajo de eficiencia energética. La evidencia es débil —un comentario en un evento gremial, sin documento— así que el paso prudente es monitorear hasta que aparezca una señal más firme.",
      "Frigoríficos Ciénaga mentions plans to expand cold rooms, a change that would fit energy-efficiency work. Evidence is weak — a comment at a trade event, no document — so the prudent step is to monitor until a firmer signal appears."),
    decisionNote: bi("Señal débil y sin documento: monitorear a la espera de confirmación.", "Weak, undocumented signal: monitor pending confirmation."),
    events: [{ date: "2026-08-10", event: bi("Mencionó en un foro planes de ampliar cámaras frías", "Mentioned cold-room expansion plans at a forum") }],
    sources: [
      { label: bi("Cobertura de evento (ejemplo)", "Event coverage (example)"), url: "https://example.com/cienaga-foro", date: "2026-08-10", relation: "context", claim: bi("Recoge la mención en el foro", "Captures the forum mention") },
    ],
    claimSupportingSources: 0, corroborated: null,
    counterSignals: [bi("Una mención en foro no equivale a una decisión de inversión.", "A forum mention is not an investment decision.")],
    validations: [bi("Buscar un anuncio formal o documento que confirme la ampliación.", "Look for a formal announcement or document confirming the expansion.")],
    nextStep: bi("Vigilar señales formales; sin ellas, no hay caso accionable.", "Watch for formal signals; without them, there is no actionable case."),
    limitations: [bi("Evidencia anecdótica; sin fuente documental.", "Anecdotal evidence; no documentary source.")],
  },
  {
    company: "Reciclajes Barranquilla", segment: bi("Reciclaje industrial", "Industrial recycling"), geography: "Barranquilla, Colombia",
    role: null, opp: null,
    decision: "monitor", fit: "Limited", timing: "Limited", evidence: "Moderate", onTarget: true,
    thesis: bi("Reciclajes Barranquilla aparece en el radar sectorial, pero su encaje con una consultoría de operaciones industriales es limitado: su cadena de valor es distinta. Hay una nota sobre una nueva planta, así que se mantiene en monitoreo por si su operación se acerca al perfil de cliente.",
      "Reciclajes Barranquilla shows up on the sector radar, but its fit with an industrial-operations consultancy is limited: its value chain is different. There is a note about a new plant, so it stays on monitor in case its operation moves toward the client profile."),
    decisionNote: bi("Encaje limitado pese a un evento reciente: monitorear sin priorizar.", "Limited fit despite a recent event: monitor without prioritizing."),
    events: [{ date: "2026-09-05", event: bi("Anunció una nueva planta de clasificación", "Announced a new sorting plant") }],
    sources: [
      { label: bi("Prensa ambiental (ejemplo)", "Environmental press (example)"), url: "https://example.com/reciclajes-planta", date: "2026-09-05", relation: "direct", claim: bi("Reporta la nueva planta", "Reports the new plant") },
      { label: bi("Nota municipal (ejemplo)", "Municipal note (example)"), url: "https://example.org/reciclajes-municipio", date: "2026-09-06", relation: "corroborating", claim: bi("Confirma el proyecto", "Confirms the project") },
    ],
    claimSupportingSources: 2, corroborated: true,
    counterSignals: [bi("El modelo de negocio se aparta del perfil de cliente objetivo.", "The business model departs from the target client profile.")],
    validations: [bi("Evaluar si la nueva planta implica procesos industriales dentro del alcance del servicio.", "Assess whether the new plant implies in-scope industrial processes.")],
    nextStep: bi("Mantener en observación de bajo esfuerzo; encaje aún dudoso.", "Keep under low-effort observation; fit still doubtful."),
    limitations: [bi("El encaje del servicio con el reciclaje es incierto.", "Service fit with recycling is uncertain.")],
  },
  {
    company: "Envases Metálicos Barranquilla", segment: bi("Empaques metálicos", "Metal packaging"), geography: "Barranquilla, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: null,
    decision: "monitor", fit: "Moderate", timing: "Limited", evidence: "Limited", onTarget: true,
    thesis: bi("Envases Metálicos Barranquilla encaja con la práctica de eficiencia de línea, pero no hay un cambio operativo reciente y fechado: solo un rumor de renovación de maquinaria sin confirmar. Está dentro del foco (Caribe, industria), así que se mantiene en monitoreo a la espera de una señal firme.",
      "Envases Metálicos Barranquilla fits the line-efficiency practice, but there is no recent, dated operational change — only an unconfirmed machinery-renewal rumor. It is within focus (Caribbean, industry), so it stays on monitor pending a firm signal."),
    decisionNote: bi("Dentro del foco pero sin señal reciente y fechada: monitorear.", "Within focus but no recent, dated signal: monitor."),
    events: [],
    sources: [
      { label: bi("Directorio industrial (ejemplo)", "Industrial directory (example)"), url: "https://example.com/envases-directorio", date: null, relation: "context", claim: bi("Establece actividad de empaques metálicos", "Establishes metal-packaging activity") },
    ],
    claimSupportingSources: 0, corroborated: null,
    counterSignals: [bi("El rumor de renovación de maquinaria no está confirmado por ninguna fuente.", "The machinery-renewal rumor is not confirmed by any source.")],
    validations: [bi("Buscar un anuncio formal de inversión en línea o maquinaria antes de actuar.", "Look for a formal line/machinery investment announcement before acting.")],
    nextStep: bi("Vigilar señales formales de inversión; sin ellas, no hay caso accionable.", "Watch for formal investment signals; without them, there is no actionable case."),
    limitations: [bi("Sin evento fechado; señal solo por rumor.", "No dated event; signal is rumor-only.")],
  },
  {
    company: "Petroquímica del Norte", segment: bi("Petroquímica", "Petrochemicals"), geography: "Cartagena, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: bi("Modernización tecnológica", "Technology Modernization"),
    decision: "validate", fit: "Moderate", timing: "Moderate", evidence: "Moderate", onTarget: true,
    thesis: bi("Petroquímica del Norte comunicó una parada de mantenimiento mayor, que puede ser una oportunidad de optimización de proceso o simple rutina. El encaje es moderado y la señal es ambigua: hay que validar si la parada trae rediseño o solo mantenimiento programado.",
      "Petroquímica del Norte announced a major maintenance turnaround, which can be a process-optimization opportunity or plain routine. Fit is moderate and the signal is ambiguous: validate whether the turnaround brings redesign or just scheduled maintenance."),
    decisionNote: bi("Señal ambigua sobre el tipo de parada: validar si hay rediseño de proceso.", "Ambiguous signal on the turnaround type: validate whether there is process redesign."),
    events: [{ date: "2026-09-02", event: bi("Anunció una parada de mantenimiento mayor", "Announced a major maintenance turnaround") }],
    sources: [
      { label: bi("Prensa industrial (ejemplo)", "Industrial press (example)"), url: "https://example.com/petro-parada", date: "2026-09-02", relation: "direct", claim: bi("Reporta la parada de mantenimiento", "Reports the maintenance turnaround") },
      { label: bi("Aviso a proveedores (ejemplo)", "Supplier notice (example)"), url: "https://example.org/petro-proveedores", date: "2026-09-03", relation: "corroborating", claim: bi("Confirma la ventana de parada", "Confirms the turnaround window") },
    ],
    claimSupportingSources: 2, corroborated: true,
    counterSignals: [bi("Una parada rutinaria no genera trabajo de optimización de proceso.", "A routine turnaround generates no process-optimization work.")],
    validations: [bi("Confirmar si la parada incluye rediseño de proceso o es mantenimiento estándar.", "Confirm whether the turnaround includes process redesign or is standard maintenance.")],
    nextStep: bi("Preguntar por el alcance de la parada antes de proponer.", "Ask about the turnaround scope before proposing."),
    limitations: [bi("El tipo de parada no está claro en las fuentes.", "The turnaround type is unclear in the sources.")],
  },
  {
    company: "Textiles Soledad", segment: bi("Textil", "Textiles"), geography: "Soledad, Colombia",
    role: null, opp: null,
    decision: "hold", fit: "Limited", timing: "Limited", evidence: "Limited", onTarget: false,
    thesis: bi("Textiles Soledad no reúne condiciones para atención comercial hoy: encaje limitado con la práctica de operaciones industriales pesadas, sin evento reciente y con evidencia escasa. Es un HOLD honesto —no una mala empresa, sino una sin caso accionable para este cliente ahora.",
      "Textiles Soledad does not meet the conditions for commercial attention today: limited fit with the heavy-industrial-operations practice, no recent event, and thin evidence. This is an honest HOLD — not a bad company, just one without an actionable case for this client now."),
    decisionNote: bi("Encaje y evidencia insuficientes hoy: no asignar atención (HOLD).", "Insufficient fit and evidence today: allocate no attention (HOLD)."),
    events: [],
    sources: [
      { label: bi("Directorio sectorial (ejemplo)", "Sector directory (example)"), url: "https://example.com/textiles-directorio", date: null, relation: "context", claim: bi("Establece actividad textil", "Establishes textile activity") },
    ],
    claimSupportingSources: 0, corroborated: null,
    counterSignals: [bi("El perfil operativo se aparta del foco de la consultoría.", "The operational profile departs from the consultancy's focus.")],
    validations: [bi("No se requiere validación activa; reconsiderar solo ante un cambio material.", "No active validation required; reconsider only on a material change.")],
    nextStep: bi("Sin acción; el caso no justifica esfuerzo comercial hoy.", "No action; the case does not justify commercial effort today."),
    limitations: [bi("Encaje bajo y sin disparador reciente.", "Low fit and no recent trigger.")],
  },
  {
    company: "Plásticos Cartagena", segment: bi("Plásticos", "Plastics"), geography: "Cartagena, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: null,
    decision: "hold", fit: "Moderate", timing: "Limited", evidence: "Limited", onTarget: true,
    thesis: bi("Plásticos Cartagena tendría un encaje razonable, pero la evidencia disponible carece de fechas confiables: las fuentes no permiten fechar ningún cambio. Sin poder ubicar un evento en el tiempo, no hay base para una señal temporal, y la recomendación honesta es HOLD hasta conseguir evidencia fechada.",
      "Plásticos Cartagena would have a reasonable fit, but the available evidence lacks reliable dates: the sources do not let any change be dated. With no event placed in time, there is no basis for a timing signal, and the honest recommendation is HOLD until dated evidence is found."),
    decisionNote: bi("Evidencia sin fechas confiables: no hay base temporal, HOLD.", "Evidence without reliable dates: no timing basis, HOLD."),
    events: [],
    sources: [
      { label: bi("Nota sin fecha (ejemplo)", "Undated note (example)"), url: "https://example.com/plasticos-nota", date: null, relation: "context", claim: bi("Menciona actividad, sin fecha verificable", "Mentions activity, no verifiable date") },
      { label: bi("Foro industrial (ejemplo)", "Industrial forum (example)"), url: "https://example.org/plasticos-foro", date: null, relation: "context", claim: bi("Comentario sin fecha confiable", "Comment without a reliable date") },
    ],
    claimSupportingSources: 0, corroborated: null,
    counterSignals: [bi("Sin fechas, cualquier afirmación de recencia sería infundada.", "Without dates, any recency claim would be unfounded.")],
    validations: [bi("Conseguir al menos una fuente fechada antes de reconsiderar.", "Obtain at least one dated source before reconsidering.")],
    nextStep: bi("Sin acción; retomar solo con evidencia fechada.", "No action; revisit only with dated evidence."),
    limitations: [bi("Ninguna fuente aporta una fecha verificable.", "No source provides a verifiable date.")],
  },
  {
    company: "Farmacéutica Caribe", segment: bi("Farmacéutica", "Pharmaceuticals"), geography: "Cartagena, Colombia",
    role: null, opp: null,
    decision: "hold", fit: "Limited", timing: "Moderate", evidence: "Moderate", onTarget: false,
    thesis: bi("Farmacéutica Caribe tiene actividad reciente y fechada, pero opera en un entorno regulado (GMP) que se aleja de la práctica de operaciones industriales de la consultoría. Aunque el timing existe, el encaje bajo lleva a un HOLD honesto: no todo cambio reciente es una oportunidad para este cliente.",
      "Farmacéutica Caribe has recent, dated activity, but it operates in a regulated (GMP) environment far from the consultancy's industrial-operations practice. Even though timing exists, the low fit leads to an honest HOLD: not every recent change is an opportunity for this client."),
    decisionNote: bi("Timing presente pero encaje bajo por el entorno regulado: HOLD.", "Timing present but low fit due to the regulated environment: HOLD."),
    events: [{ date: "2026-09-10", event: bi("Anunció ampliación de línea de producción bajo GMP", "Announced a GMP production-line expansion") }],
    sources: [
      { label: bi("Prensa farmacéutica (ejemplo)", "Pharma press (example)"), url: "https://example.com/farma-linea", date: "2026-09-10", relation: "direct", claim: bi("Reporta la ampliación GMP", "Reports the GMP expansion") },
      { label: bi("Aviso regulatorio (ejemplo)", "Regulatory notice (example)"), url: "https://example.org/farma-regulatorio", date: "2026-09-11", relation: "corroborating", claim: bi("Confirma el marco GMP", "Confirms the GMP framework") },
    ],
    claimSupportingSources: 2, corroborated: true,
    counterSignals: [bi("El trabajo GMP exige experiencia regulatoria fuera del alcance de la consultoría.", "GMP work requires regulatory expertise outside the consultancy's scope.")],
    validations: [bi("No aplica atención activa; el encaje regulatorio no está en el alcance.", "No active attention applies; the regulatory fit is out of scope.")],
    nextStep: bi("Sin acción; el caso no encaja con la oferta actual.", "No action; the case does not fit the current offer."),
    limitations: [bi("Entorno regulado fuera de la práctica de la consultoría.", "Regulated environment outside the consultancy's practice.")],
  },
  {
    company: "Puerto Seco Galapa", segment: bi("Infraestructura logística", "Logistics infrastructure"), geography: "Galapa, Colombia",
    role: bi("Cliente potencial", "Potential Customer"), opp: bi("Expansión operativa", "Operations Expansion"),
    decision: "prioritize", fit: "Strong", timing: "Strong", evidence: "Moderate", onTarget: true,
    thesis: bi("Puerto Seco Galapa está escalando su operación de patio y aduana, con un evento fechado la semana pasada y encaje directo con la práctica de operaciones. Es un caso para priorizar: la ventana de rediseño de patio se abre justo ahora, antes de que se consoliden los procesos.",
      "Puerto Seco Galapa is scaling its yard and customs operation, with a dated event last week and a direct fit to the operations practice. It is a case to prioritize: the yard-redesign window is opening right now, before processes consolidate."),
    decisionNote: bi("Encaje fuerte y evento muy reciente y fechado: priorizar.", "Strong fit and a very recent, dated event: prioritize."),
    events: [{ date: "2026-09-17", event: bi("Amplió su operación de patio y servicios aduaneros", "Expanded its yard and customs services operation") }],
    sources: [
      { label: bi("Prensa logística (ejemplo)", "Logistics press (example)"), url: "https://example.com/galapa-patio", date: "2026-09-17", relation: "direct", claim: bi("Reporta la ampliación de patio", "Reports the yard expansion") },
      { label: bi("Boletín aduanero (ejemplo)", "Customs bulletin (example)"), url: "https://example.org/galapa-aduana", date: "2026-09-18", relation: "corroborating", claim: bi("Confirma los nuevos servicios aduaneros", "Confirms the new customs services") },
    ],
    claimSupportingSources: 2, corroborated: true,
    counterSignals: [bi("La ampliación podría gestionarse con el operador logístico actual.", "The expansion could be handled by the current logistics operator.")],
    validations: [bi("Confirmar si el rediseño de patio y flujo aduanero está abierto a asesoría externa.", "Confirm whether the yard/customs-flow redesign is open to external advice.")],
    nextStep: bi("Proponer un diagnóstico de flujo de patio esta misma semana.", "Propose a yard-flow diagnostic this week."),
    limitations: [bi("Falta una tercera fuente independiente sobre el alcance.", "A third independent source on the scope is missing.")],
  },
];

const decNote = (c: Case, lang: Lang): string => pick(c.decisionNote, lang);

function toAccount(c: Case, i: number, lang: Lang): AccountBriefVM {
  const es = lang === "es";
  const events: ChangeVM[] = c.events.map((e) => ({ event: pick(e.event, lang), date: e.date, age: ageLabel(e.date, es), source: null, kind: "recent_event" }));
  const sources: SourceVM[] = c.sources.map((s) => ({ label: pick(s.label, lang), url: s.url, date: s.date, age: s.date ? ageLabel(s.date, es) : null, relation: s.relation, claim: pick(s.claim, lang), observation: null, basis: s.date ? "observed" : "inferred", impacts: ["what_changed"] }));
  const datedCount = c.sources.filter((s) => s.date).length;
  const latestDated = c.sources.map((s) => s.date).filter(Boolean).sort().at(-1) ?? c.events.map((e) => e.date).sort().at(-1) ?? null;
  return {
    id: `sample-${i + 1}`, rank: i + 1, company: c.company, segment: pick(c.segment, lang), geography: c.geography, domain: null,
    accountRole: c.role ? pick(c.role, lang) : null,
    opportunityType: c.opp ? pick(c.opp, lang) : null,
    decision: c.decision, decisionNote: decNote(c, lang), thesis: pick(c.thesis, lang), whyItMatters: null,
    // Canonical (English) dimension labels — the renderer localizes them for display; keeping them
    // canonical lets dimensionValue()/charts resolve Fit/Timing/Evidence regardless of report language.
    dimensions: [
      { label: "Fit", value: c.fit, note: null },
      { label: "Timing", value: c.timing, note: null },
      { label: "Evidence", value: c.evidence, note: null },
    ],
    whatChanged: events,
    // Evidence counts RECONCILE with the listed sources: sourceCount = number of sources shown, so
    // "N fuentes" always matches the Fuentes list (§11 — the reviewer's mismatch is removed). The
    // discovery-vs-support distinction is carried honestly by `corroborated` (≥2 independent origins
    // genuinely supporting the claim) and by each source's relation label, not by a smaller count.
    evidence: { sourceCount: c.sources.length, datedCount, corroborated: c.corroborated, latestAge: latestDated ? ageLabel(latestDated, es) : null, strength: c.evidence },
    sources,
    counterSignals: c.counterSignals.map((b) => pick(b, lang)),
    limitations: c.limitations.map((b) => pick(b, lang)),
    validations: c.validations.map((b) => pick(b, lang)),
    nextStep: pick(c.nextStep, lang),
    freshness: latestDated ? { label: es ? "Reciente" : "Recent", age: ageLabel(latestDated, es) } : null,
    confidence: c.evidence,
  };
}

/** Deterministic representative deliverable (18 curated synthetic cases). Clearly labeled SAMPLE. */
export function buildSampleDeliverable(lang: Lang = "es"): DeliverableViewModel {
  const es = lang === "es";
  // Order by canonical attention (prioritize → validate → monitor → hold) and reassign ranks so tier
  // capping surfaces the strongest cases first (mirrors the real "ordered by attention upstream" DTO).
  const accounts = orderByAttention(CASES.map((c, i) => toAccount(c, i, lang))).map((a, i) => ({ ...a, rank: i + 1 }));
  const counts = accounts.reduce((m, a) => { m[a.decision]++; return m; }, { prioritize: 0, validate: 0, monitor: 0, hold: 0 } as Record<DecisionState, number>);
  // Honest headline derived from the actual decision distribution (never overstates).
  const headline = es
    ? `${counts.prioritize} cuentas para priorizar y ${counts.validate} por validar de ${accounts.length} evaluadas`
    : `${counts.prioritize} accounts to prioritize and ${counts.validate} to validate of ${accounts.length} evaluated`;
  const withDated = accounts.filter((a) => a.evidence.datedCount > 0).length;
  return {
    meta: {
      client: T(es, "Muestra de plantilla (datos sintéticos)", "Template sample (synthetic data)"),
      market: T(es, "Caribe colombiano · manufactura, logística e industria", "Colombian Caribbean · manufacturing, logistics & industry"),
      generatedAt: REPORT_DATE,
      generatedLabel: T(es, "24 de septiembre de 2026", "September 24, 2026"),
      tierLabel: "Premium", language: lang, schemaVersion: 1,
    },
    headline,
    summary: T(es,
      "Muestra de plantilla con casos sintéticos diferenciados para revisión de formato. Ningún evento de compra está confirmado — cada cuenta es una hipótesis de encaje y momento a validar según su evidencia.",
      "Template sample with differentiated synthetic cases for format review. No purchase event is confirmed — each account is a fit-and-timing hypothesis to validate on its own evidence."),
    portfolio: { total: accounts.length, counts, allocation: { line: T(es, "Dónde concentrar la atención primero", "Where attention goes first"), detail: T(es, "priorizar primero, luego validar", "prioritize first, then validate") }, funnel: { considered: 41, rejected: 23, selected: accounts.length }, note: T(es, "Orden por decisión canónica; sin puntaje sintético.", "Ordered by canonical decision; no synthetic score.") },
    accounts,
    commercialContext: { objective: T(es, "Ampliar la base de clientes industriales en el Caribe colombiano", "Grow the industrial client base in the Colombian Caribbean"), clientDescription: null, summary: T(es, "Consultoría de eficiencia operativa que vende a manufactura, logística e industria pesada.", "Operational-efficiency consultancy selling to manufacturing, logistics and heavy industry."), regions: [T(es, "Caribe colombiano", "Colombian Caribbean")], industries: ["Manufactura", "Logística", "Materiales", "Energía"], criteria: [T(es, "Cambio operativo reciente y fechado", "Recent, dated operational change"), T(es, "Dentro del Caribe colombiano", "Within the Colombian Caribbean")] },
    validationQueue: accounts.filter((a) => a.decision === "prioritize" || a.decision === "validate").slice(0, 8).map((a) => ({ accountId: a.id, company: a.company, decision: a.decision, items: a.validations })),
    coverage: { withDatedEvidence: withDated, withSources: accounts.filter((a) => a.evidence.sourceCount > 0).length, corroborated: accounts.filter((a) => a.evidence.corroborated === true).length, grade: "Moderate", note: T(es, "Cobertura por empresa, basada en evidencia pública fechada.", "Per-company coverage, based on dated public evidence.") },
    methodology: [T(es, "Recuperación de eventos públicos con fecha.", "Retrieval of dated public events."), T(es, "Síntesis de caso con decisión canónica por empresa.", "Per-company case synthesis with a canonical decision."), T(es, "Sin puntajes opacos ni probabilidades inventadas.", "No opaque scores or invented probabilities.")],
    limitations: [T(es, "Datos sintéticos de demostración — no es un cliente real.", "Synthetic demo data — not a real customer."), T(es, "Evidencia pública limitada y variable por empresa.", "Limited, variable public evidence per company.")],
    downloads: { pdf: true, portfolioCsv: true, evidenceCsv: true },
    capabilities: { showPortfolioTab: true, showCompareTab: true, showEvidenceTab: true, showDownloadsTab: true, showMethodology: true },
  };
}

function T(es: boolean, esS: string, enS: string) { return es ? esS : enS; }
