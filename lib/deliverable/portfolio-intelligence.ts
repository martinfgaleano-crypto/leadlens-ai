// ─── Portfolio Intelligence V1 — cross-account synthesis ──────────────────────
// Turns a set of structured Opportunity Cases (AccountBriefVM[]) into portfolio-
// level commercial intelligence. This is NOT summarization: every output is
// deterministic or gated, field-specific, provenance-backed, and uncertainty-
// aware. No output is inferred to fill a section (§65). The layer receives ONLY
// curated structured Case fields (§83) — never raw web results.
//
// Two tiers (§80): DETERMINISTIC metrics (counts/distributions/coverage) always
// render; GATED SYNTHESIS (patterns/tensions/validation themes/guidance/Read) is
// admitted only when field-specific eligibility + minimum support hold (§87).
//
// Localization (V1.1): customer-facing prose follows vm.meta.language via a
// structured message layer. Stable identifiers (`key` on patterns/themes, case
// ids) are canonical and locale-INDEPENDENT so the memory diff never depends on
// rendered copy (§59-60). An LLM may later normalize phrasing (§88) but can never
// create an unsupported pattern — the gates below remain the authority.
import type { AccountBriefVM, DecisionState, DeliverableViewModel, Strength } from "./deliverable-view-model";
import { opportunityTypeLabel } from "./deliverable-view-model";

export const PORTFOLIO_INTELLIGENCE_VERSION = "portfolio-intelligence-v1.1";

export type CoverageState = "rich" | "usable" | "limited";
export interface Provenance { caseIds: string[]; fieldTypes: string[]; counterCaseIds?: string[] }

export interface PortfolioPattern {
  kind: "opportunity_type" | "change_theme";
  key: string;                   // canonical, locale-independent (diff/memory key)
  label: string;                 // localized display
  summary: string;
  supportingCaseIds: string[];
  opposingCaseIds?: string[];
  coverage: CoverageState;
  notable: boolean;
  caveat?: string;
}
export interface ValidationTheme { key: string; theme: string; summary: string; caseIds: string[]; decisionCritical: boolean }
export interface PortfolioTension { caseId: string; company: string; positive: string; counter: string; meaning: string }
export interface CoverageGap { key: string; category: string; summary: string; caseIds: string[] }
export interface Guidance { kind: "Focus" | "Validate" | "Sequence" | "Monitor" | "Defer"; kindLabel: string; statement: string; provenance: Provenance }
export interface ReadStatement { text: string; provenance: Provenance }

export interface PortfolioIntelligenceVM {
  version: string;
  generatedAt: string;
  clientSubject: string | null;
  locale: "en" | "es";
  labels: Record<string, string>;   // section labels for renderers (localized)
  deterministic: {
    total: number;
    decisionCounts: Record<DecisionState, number>;
    fitDistribution: Record<Strength, number>;
    timingDistribution: Record<Strength | "Unknown", number>;
    evidenceDistribution: Record<Strength | "None", number>;
    verifiedChangeCount: number;
    independentSupportCount: number;
    counterevidenceCount: number;
    validationItemCount: number;
    coverageStates: Record<CoverageState, number>;
  };
  read: ReadStatement[];
  attention: { decision: DecisionState; caseIds: string[]; differentiator: string | null }[];
  opportunityPatterns: PortfolioPattern[];
  changePatterns: PortfolioPattern[];
  evidenceCoverage: { statements: string[]; states: Record<CoverageState, string[]> };
  coverageGaps: CoverageGap[];
  validationThemes: ValidationTheme[];
  tensions: PortfolioTension[];
  guidance: Guidance[];
  limitations: string[];
}

// ── canonical taxonomies (key = locale-independent; en/es = display) ──
const CHANGE_THEMES: Array<{ key: string; en: string; es: string; re: RegExp }> = [
  { key: "terminal", en: "Terminal network expansion", es: "Expansión de red de terminales", re: /terminal/ },
  { key: "dc", en: "Distribution / warehouse expansion", es: "Expansión de distribución / bodegas", re: /distribution cent|warehouse|logistics hub|\bdc\b|fulfil|bodega|centro de distribuci/ },
  { key: "hospital", en: "Healthcare facility expansion", es: "Expansión de instalaciones de salud", re: /hospital|clinic|rehabilitation|cl[ií]nic|instalaci[oó]n de salud/ },
  { key: "plant", en: "Plant / capacity expansion", es: "Expansión de planta / capacidad", re: /plant|factory|manufacturing|production line|capacity|planta|f[aá]brica|capacidad|producci[oó]n/ },
  { key: "acquisition", en: "Acquisition / integration", es: "Adquisición / integración", re: /acqui|merger|integration|adquisic|fusi[oó]n|integraci[oó]n/ },
  { key: "facility", en: "Facility / operations expansion", es: "Expansión de instalaciones / operaciones", re: /facilit|open|expan|instalaci|apertura|inaugura/ },
];
const VALIDATION_THEMES: Array<{ key: string; en: string; es: string; re: RegExp }> = [
  { key: "systems", en: "Current systems / vendor posture", es: "Sistemas actuales / postura de proveedor", re: /system|vendor|platform|stack|tooling|tms|wms|erp|sistema|proveedor|plataforma|herramienta/ },
  { key: "owner", en: "Operations / procurement ownership", es: "Responsable de operaciones / compras", re: /owner|ownership|decision.?maker|procurement|responsable|due[ñn]|compras|qui[eé]n/ },
  { key: "integration", en: "Integration / expansion scope", es: "Alcance de integración / expansión", re: /integrat|scope|post-close|onboard|integrac|alcance/ },
  { key: "fit", en: "Category / commercial fit", es: "Encaje de categoría / comercial", re: /\bfit\b|category|relevan|applicab|encaje|categor[ií]a/ },
  { key: "corroboration", en: "Evidence corroboration", es: "Corroboración de evidencia", re: /corroborat|second (source|origin)|independent|confirm|corrobora|independiente|confirmar|segunda fuente/ },
  { key: "timing", en: "Implementation / timing window", es: "Ventana de implementación / momento", re: /window|timeline|timing|when|moved from plan|build|ventana|cronograma|cu[aá]ndo|momento|plazo/ },
];

// ── field-specific eligibility (§10-11) ──
const isVerifiedChange = (a: AccountBriefVM): boolean => a.whatChanged.some(c => (c.kind === "true_change" || c.kind === "recent_event") && !!c.date);
const eligibleOpportunityType = (a: AccountBriefVM): boolean => !!a.opportunityType;
const dim = (a: AccountBriefVM, label: string): Strength | null => a.dimensions.find(d => d.label === label)?.value ?? null;
const eligibleCorroboration = (a: AccountBriefVM): boolean => a.evidence.corroborated === true;
const eligibleValidation = (a: AccountBriefVM): boolean => a.validations.length > 0;
const CONTRADICTORY = /\b(layoff|lay off|job cuts?|clos(e|es|ed|ure|ing)|shut|declin|decline|contract(ion|ing)?|loss(es)?|soft|muted|downturn|lawsuit|reduc(e|tion|ing)|cut(s|ting)?|despido|cierre|p[eé]rdida|recorte|demanda|ca[ií]da)\b/i;
const eligibleTension = (a: AccountBriefVM): boolean => isVerifiedChange(a) && a.counterSignals.some(s => CONTRADICTORY.test(s));

function coverageState(a: AccountBriefVM): CoverageState {
  if (isVerifiedChange(a) && a.evidence.corroborated === true) return "rich";
  if (isVerifiedChange(a) || a.evidence.datedCount > 0) return "usable";
  return "limited";
}

const DECISION_ORDER: DecisionState[] = ["prioritize", "validate", "monitor", "hold"];
const cid = (a: AccountBriefVM) => a.id;
const classify = (table: typeof CHANGE_THEMES, text: string) => table.find(e => e.re.test(text.toLowerCase())) ?? null;

// ── localized message layer (§32 — structured, not scattered) ──
function messages(es: boolean, decLabel: (d: DecisionState) => string) {
  const list = (xs: string[]) => xs.join(", ");
  return {
    labels: {
      title: es ? "Inteligencia del portafolio" : "Portfolio Intelligence",
      read: "LeadLens Read",
      focus: es ? "Dónde enfocar" : "Where to focus",
      patterns: es ? "Patrones de oportunidad" : "Opportunity patterns",
      changing: es ? "Qué está cambiando" : "What is changing",
      coverage: es ? "Cobertura de evidencia" : "Evidence coverage",
      themes: es ? "Qué validar (temas)" : "Validation themes",
      tensions: es ? "Tensiones del portafolio" : "Portfolio tensions",
      guidance: es ? "Dirección recomendada" : "Recommended direction",
      gaps: es ? "Brechas de cobertura" : "Coverage gaps",
      notable: es ? "caso notable" : "notable case",
      critical: es ? "crítico" : "decision-critical",
    },
    guidanceKind: (k: Guidance["kind"]) => es ? ({ Focus: "Enfocar", Validate: "Validar", Sequence: "Secuenciar", Monitor: "Monitorear", Defer: "Aplazar" }[k]) : k,
    oppPatternSummary: (label: string, n: number, notable: boolean) => notable
      ? (es ? `Una única oportunidad notable con forma de ${label}.` : `A single notable ${label} opportunity in the evaluated set.`)
      : (es ? `${n} oportunidades evaluadas comparten la forma de ${label}.` : `${n} evaluated opportunities share the ${label} shape.`),
    changeSummary: (label: string, n: number, notable: boolean) => notable
      ? (es ? `${label} aparece en una única oportunidad evaluada.` : `${label} appears in a single evaluated opportunity.`)
      : (es ? `${label} se repite en ${n} oportunidades evaluadas.` : `${label} recurs across ${n} evaluated opportunities.`),
    changeCaveat: es ? "Describe el conjunto de oportunidades evaluadas, no el mercado en general." : "Describes the evaluated opportunity set, not the wider market.",
    themeSummary: (n: number, dc: boolean) => es ? `Se repite en ${n} oportunidades${dc ? " (crítico para la decisión)" : ""}.` : `Recurs across ${n} opportunities${dc ? " (decision-critical)" : ""}.`,
    coverage: (verified: number, corr: number, none: number, total: number) => es ? [
      `${verified} de ${total} oportunidades tienen un desarrollo material reciente verificado.`,
      `${corr} de ${total} cuentan con respaldo independiente.`,
      `${none} de ${total} no tienen un cambio reciente verificado en la evidencia pública revisada.`,
    ] : [
      `${verified} of ${total} opportunities have a verified recent material development.`,
      `${corr} of ${total} have independent support.`,
      `${none} of ${total} have no verified recent change in the reviewed public evidence.`,
    ],
    gapNoChange: (n: number) => ({ category: es ? "Sin cambio reciente verificado" : "No verified recent change", summary: es ? `${n} oportunidades no muestran un desarrollo material reciente verificado en la evidencia pública revisada — no es señal de inactividad, solo de lo que aún no se ha establecido.` : `${n} opportunities show no verified recent material development in the reviewed public evidence — not evidence of inactivity, only of what is not yet established.` }),
    gapSingle: (n: number) => ({ category: es ? "Fuente única" : "Single-source only", summary: es ? `${n} cambio(s) verificado(s) se apoyan en un solo origen y requieren corroboración independiente.` : `${n} verified change(s) rest on a single origin and need independent corroboration.` }),
    gapDC: (n: number) => ({ category: es ? "Falta un hecho crítico" : "Missing decision-critical fact", summary: es ? `${n} oportunidades tienen una pregunta crítica para la decisión aún abierta.` : `${n} opportunities have a decision-critical question still open.` }),
    gapFootprint: (n: number) => ({ category: es ? "Huella pública limitada" : "Limited public footprint", summary: es ? `${n} oportunidades tienen evidencia pública observable limitada — la evaluación se apoya en el encaje estructural y la validación directa.` : `${n} opportunities have limited observable public evidence — evaluation leans on structural fit and direct validation.` }),
    attnPrioritize: (parts: string[]) => parts.length ? (es ? `Se distinguen por ${list(parts)}.` : `Set apart by ${list(parts)}.`) : null,
    attnParts: (nVer: number, nCorr: number, nStrong: number) => es
      ? [nVer ? `${nVer} con un cambio reciente verificado` : "", nCorr ? `${nCorr} con respaldo independiente` : "", nStrong ? `${nStrong} con encaje fuerte` : ""].filter(Boolean)
      : [nVer ? `${nVer} with a verified recent change` : "", nCorr ? `${nCorr} independently corroborated` : "", nStrong ? `${nStrong} with Strong fit` : ""].filter(Boolean),
    attnValidate: (dc: number) => dc ? (es ? `${dc} tienen una pregunta crítica para la decisión que condiciona la acción.` : `${dc} carry a decision-critical open question that gates action.`) : (es ? "Cada una necesita confirmar un hecho específico antes de asignar atención." : "Each needs a specific fact confirmed before allocation."),
    tensionMeaning: (d: DecisionState) => es ? `Coexisten expansión positiva y evidencia contradictoria material — el caso debe reconciliarse antes de ${d === "prioritize" ? "sostener la prioridad" : "elevar la atención"}.` : `Positive expansion and material contradictory evidence coexist — the Case must be reconciled before ${d === "prioritize" ? "sustaining priority" : "raising attention"}.`,
    gFocus: (n: number, names: string) => es ? `Trabaja primero las ${n} expansiones recientes corroboradas — ${names}.` : `Work the ${n} corroborated, recent expansions first — ${names}.`,
    gValidateTheme: (theme: string, n: number) => es ? `Resuelve "${theme}" — se repite en ${n} oportunidades y desbloquearía varias a la vez.` : `Resolve "${theme}" — it recurs across ${n} opportunities and would unlock several at once.`,
    gSequence: (name: string) => es ? `Empieza por ${name} (mejor momento + corroboración), luego el resto de cuentas prioritarias.` : `Lead with ${name} (strongest timing + corroboration), then the remaining priority accounts.`,
    gReconcile: (names: string) => es ? `Reconcilia ${names} antes de elevar — las señales de expansión y contracción entran en conflicto.` : `Reconcile ${names} before elevating — expansion and contraction signals conflict.`,
    gMonitor: (n: number) => es ? `Mantén ${n} oportunidades a la espera de un detonante fechado — hay encaje estructural pero no un cambio reciente verificado.` : `Hold ${n} opportunities for a dated trigger — structural fit is present but no verified recent change is established.`,
    readPriority: (n: number, total: number) => es ? `${n} de ${total} oportunidades ameritan prioridad ahora; las más fuertes combinan un cambio reciente verificado con corroboración independiente.` : `${n} of ${total} opportunities merit priority now; the strongest combine a recent verified change with independent corroboration.`,
    readChange: (label: string, n: number) => es ? `La condición comercial recurrente entre las oportunidades más fuertes es ${label.toLowerCase()} (${n} cuentas evaluadas).` : `The recurring commercial condition among stronger opportunities is ${label.toLowerCase()} (${n} evaluated accounts).`,
    readNoChange: (n: number, total: number) => es ? `${n} de ${total} no tienen un cambio reciente verificado en la evidencia pública revisada — es un límite de cobertura, no un juicio de calidad; requieren validación directa.` : `${n} of ${total} have no verified recent change in the reviewed public evidence — a coverage limit, not a quality judgment; these need direct validation.`,
    readTension: (names: string) => es ? `${names} muestran una tensión real — expansión genuina junto a evidencia contradictoria material.` : `${names} show genuine tension — real expansion alongside material contradictory evidence.`,
    limMarket: es ? "La Inteligencia del portafolio describe el conjunto de oportunidades evaluadas — no el mercado en general." : "Portfolio Intelligence describes the evaluated opportunity set — not the wider market.",
    limLimited: es ? "Algunas oportunidades tienen evidencia pública limitada; su inteligencia es de validación primero, no impulsada por cambios." : "Some opportunities have limited public evidence; their intelligence is validation-first rather than change-driven.",
  };
}

export function buildPortfolioIntelligence(vm: DeliverableViewModel): PortfolioIntelligenceVM {
  const accounts = vm.accounts;
  const total = accounts.length;
  const es = vm.meta.language === "es";
  const decLabel = (d: DecisionState) => {
    const map = { prioritize: ["Prioritize", "Priorizar"], validate: ["Validate", "Validar"], monitor: ["Monitor", "Monitorear"], hold: ["Hold", "En espera"] } as const;
    return map[d][es ? 1 : 0];
  };
  const M = messages(es, decLabel);

  // ── deterministic layer ──
  const decisionCounts = { prioritize: 0, validate: 0, monitor: 0, hold: 0 } as Record<DecisionState, number>;
  const fitDistribution = { Strong: 0, Moderate: 0, Limited: 0 } as Record<Strength, number>;
  const timingDistribution = { Strong: 0, Moderate: 0, Limited: 0, Unknown: 0 } as Record<Strength | "Unknown", number>;
  const evidenceDistribution = { Strong: 0, Moderate: 0, Limited: 0, None: 0 } as Record<Strength | "None", number>;
  const coverageStates = { rich: 0, usable: 0, limited: 0 } as Record<CoverageState, number>;
  for (const a of accounts) {
    decisionCounts[a.decision]++;
    const f = dim(a, "Fit"); if (f) fitDistribution[f]++;
    const tv = dim(a, "Timing"); timingDistribution[(tv ?? "Unknown") as Strength | "Unknown"]++;
    const ev = dim(a, "Evidence") ?? a.evidence.strength; evidenceDistribution[(ev ?? "None") as Strength | "None"]++;
    coverageStates[coverageState(a)]++;
  }
  const verified = accounts.filter(isVerifiedChange);
  const corroborated = accounts.filter(eligibleCorroboration);
  const withCounter = accounts.filter(a => a.counterSignals.length > 0);
  const validationItemCount = accounts.reduce((n, a) => n + a.validations.length, 0);

  // ── attention allocation ──
  const attention = DECISION_ORDER.filter(d => decisionCounts[d] > 0).map(d => {
    const group = accounts.filter(a => a.decision === d);
    let differentiator: string | null = null;
    if (d === "prioritize") differentiator = M.attnPrioritize(M.attnParts(group.filter(isVerifiedChange).length, group.filter(eligibleCorroboration).length, group.filter(a => dim(a, "Fit") === "Strong").length));
    else if (d === "validate") differentiator = M.attnValidate(group.filter(a => (a.validationDetails ?? []).some(v => v.decisionCritical)).length);
    return { decision: d, caseIds: group.map(cid), differentiator };
  });

  // ── opportunity patterns (by Opportunity Type; key = raw type) ──
  const byType = new Map<string, AccountBriefVM[]>();
  for (const a of accounts.filter(eligibleOpportunityType)) { const k = a.opportunityType as string; (byType.get(k) ?? byType.set(k, []).get(k)!).push(a); }
  const opportunityPatterns: PortfolioPattern[] = Array.from(byType.entries()).map(([type, g]) => {
    const notable = g.length < 2;
    const label = opportunityTypeLabel(type, es) ?? type;
    const cov = g.some(a => coverageState(a) === "rich") ? "rich" : g.some(a => coverageState(a) === "usable") ? "usable" : "limited";
    return { kind: "opportunity_type" as const, key: type, label, notable, summary: M.oppPatternSummary(label, g.length, notable), supportingCaseIds: g.map(cid), coverage: cov as CoverageState };
  }).sort((a, b) => b.supportingCaseIds.length - a.supportingCaseIds.length);

  // ── change patterns (verified only; key = canonical theme) ──
  const byTheme = new Map<string, { en: string; es: string; cases: AccountBriefVM[] }>();
  for (const a of verified) { const th = classify(CHANGE_THEMES, a.whatChanged.find(c => c.kind === "true_change" || c.kind === "recent_event")?.event ?? ""); if (!th) continue; const e = byTheme.get(th.key) ?? { en: th.en, es: th.es, cases: [] }; e.cases.push(a); byTheme.set(th.key, e); }
  const changePatterns: PortfolioPattern[] = Array.from(byTheme.entries()).map(([key, e]) => {
    const notable = e.cases.length < 2; const label = es ? e.es : e.en;
    return { kind: "change_theme" as const, key, label, notable, summary: M.changeSummary(label, e.cases.length, notable), supportingCaseIds: e.cases.map(cid), coverage: (e.cases.some(eligibleCorroboration) ? "rich" : "usable") as CoverageState, caveat: M.changeCaveat };
  }).sort((a, b) => b.supportingCaseIds.length - a.supportingCaseIds.length);

  // ── evidence coverage ──
  const statesMap: Record<CoverageState, string[]> = { rich: [], usable: [], limited: [] };
  for (const a of accounts) statesMap[coverageState(a)].push(cid(a));
  const noChange = accounts.filter(a => !isVerifiedChange(a));
  const evidenceCoverage = { states: statesMap, statements: M.coverage(verified.length, corroborated.length, noChange.length, total) };

  // ── coverage gaps ──
  const singleSource = accounts.filter(a => isVerifiedChange(a) && a.evidence.corroborated !== true && a.evidence.sourceCount <= 1);
  const missingDC = accounts.filter(a => (a.validationDetails ?? []).some(v => v.decisionCritical));
  const limitedFootprint = accounts.filter(a => coverageState(a) === "limited");
  const coverageGaps: CoverageGap[] = [
    noChange.length ? { key: "no_change", ...M.gapNoChange(noChange.length), caseIds: noChange.map(cid) } : null,
    singleSource.length ? { key: "single_source", ...M.gapSingle(singleSource.length), caseIds: singleSource.map(cid) } : null,
    missingDC.length ? { key: "missing_dc", ...M.gapDC(missingDC.length), caseIds: missingDC.map(cid) } : null,
    limitedFootprint.length ? { key: "limited_footprint", ...M.gapFootprint(limitedFootprint.length), caseIds: limitedFootprint.map(cid) } : null,
  ].filter(Boolean) as CoverageGap[];

  // ── validation themes (canonical key) ──
  const themeMap = new Map<string, { en: string; es: string; caseIds: Set<string>; decisionCritical: boolean }>();
  for (const a of accounts.filter(eligibleValidation)) {
    const seenKeys = new Set<string>();
    const details = a.validationDetails ?? a.validations.map(q => ({ question: q, decisionCritical: false, howToValidate: null, changesDecisionBecause: null }));
    for (const v of details) { const th = classify(VALIDATION_THEMES, v.question); if (!th || seenKeys.has(th.key)) continue; seenKeys.add(th.key);
      const e = themeMap.get(th.key) ?? { en: th.en, es: th.es, caseIds: new Set<string>(), decisionCritical: false }; e.caseIds.add(cid(a)); if (v.decisionCritical) e.decisionCritical = true; themeMap.set(th.key, e); }
  }
  const validationThemes: ValidationTheme[] = Array.from(themeMap.entries()).filter(([, e]) => e.caseIds.size >= 2)
    .map(([key, e]) => ({ key, theme: es ? e.es : e.en, summary: M.themeSummary(e.caseIds.size, e.decisionCritical), caseIds: Array.from(e.caseIds), decisionCritical: e.decisionCritical }))
    .sort((a, b) => Number(b.decisionCritical) - Number(a.decisionCritical) || b.caseIds.length - a.caseIds.length);

  // ── tensions ──
  const tensions: PortfolioTension[] = accounts.filter(eligibleTension).map(a => ({
    caseId: cid(a), company: a.company,
    positive: a.whatChanged.find(c => c.kind === "true_change" || c.kind === "recent_event")?.event ?? (es ? "expansión verificada" : "verified expansion"),
    counter: a.counterSignals.find(s => CONTRADICTORY.test(s)) ?? a.counterSignals[0],
    meaning: M.tensionMeaning(a.decision),
  }));

  // ── guidance ──
  const prioritized = accounts.filter(a => a.decision === "prioritize");
  const toValidate = accounts.filter(a => a.decision === "validate");
  const monitored = accounts.filter(a => a.decision === "monitor");
  const guidance: Guidance[] = [];
  const gk = (k: Guidance["kind"]): Pick<Guidance, "kind" | "kindLabel"> => ({ kind: k, kindLabel: M.guidanceKind(k) });
  if (prioritized.length) guidance.push({ ...gk("Focus"), statement: M.gFocus(prioritized.length, prioritized.slice(0, 4).map(a => a.company).join(", ")), provenance: { caseIds: prioritized.map(cid), fieldTypes: ["decision", "whatChanged", "evidence.corroborated"] } });
  if (validationThemes.length) { const top = validationThemes[0]; guidance.push({ ...gk("Validate"), statement: M.gValidateTheme(top.theme, top.caseIds.length), provenance: { caseIds: top.caseIds, fieldTypes: ["validations"] } }); }
  if (prioritized.length >= 2) { const seq = [...prioritized].sort((a, b) => (dim(b, "Timing") === "Strong" ? 1 : 0) - (dim(a, "Timing") === "Strong" ? 1 : 0)); guidance.push({ ...gk("Sequence"), statement: M.gSequence(seq[0].company), provenance: { caseIds: seq.map(cid), fieldTypes: ["decision", "dimensions.Timing", "evidence.corroborated"] } }); }
  if (tensions.length) guidance.push({ ...gk("Validate"), statement: M.gReconcile(tensions.map(t => t.company).join(", ")), provenance: { caseIds: tensions.map(t => t.caseId), fieldTypes: ["whatChanged", "counterSignals"], counterCaseIds: tensions.map(t => t.caseId) } });
  if (monitored.length) guidance.push({ ...gk("Monitor"), statement: M.gMonitor(monitored.length), provenance: { caseIds: monitored.map(cid), fieldTypes: ["decision", "whatChanged"] } });

  // ── LeadLens Read ──
  const read: ReadStatement[] = [];
  if (prioritized.length) read.push({ text: M.readPriority(prioritized.length, total), provenance: { caseIds: prioritized.map(cid), fieldTypes: ["decision", "whatChanged", "evidence.corroborated"] } });
  const strongChange = changePatterns.find(p => !p.notable);
  if (strongChange) read.push({ text: M.readChange(strongChange.label, strongChange.supportingCaseIds.length), provenance: { caseIds: strongChange.supportingCaseIds, fieldTypes: ["whatChanged"] } });
  if (noChange.length) read.push({ text: M.readNoChange(noChange.length, total), provenance: { caseIds: noChange.map(cid), fieldTypes: ["whatChanged", "evidence"] } });
  if (tensions.length) read.push({ text: M.readTension(tensions.map(t => t.company).join(", ")), provenance: { caseIds: tensions.map(t => t.caseId), fieldTypes: ["whatChanged", "counterSignals"] } });

  const limitations = [...(vm.limitations ?? []), M.limMarket, coverageStates.limited > 0 ? M.limLimited : ""].filter(Boolean) as string[];

  return {
    version: PORTFOLIO_INTELLIGENCE_VERSION, generatedAt: new Date().toISOString(), clientSubject: vm.meta.client, locale: es ? "es" : "en", labels: M.labels,
    deterministic: { total, decisionCounts, fitDistribution, timingDistribution, evidenceDistribution, verifiedChangeCount: verified.length, independentSupportCount: corroborated.length, counterevidenceCount: withCounter.length, validationItemCount, coverageStates },
    read, attention, opportunityPatterns, changePatterns, evidenceCoverage, coverageGaps, validationThemes, tensions, guidance, limitations,
  };
}

// ── Memory-ready snapshot diff (operates on canonical keys, NOT display copy §59-60) ──
export interface PortfolioSnapshotDiff {
  decisionChanges: Array<{ caseId: string; from: DecisionState; to: DecisionState }>;
  changePatterns: { new: string[]; persisting: string[]; disappeared: string[] };
  patternSupport: Array<{ key: string; from: number; to: number; direction: "strengthened" | "weakened" }>;
  coverage: { verifiedChange: { from: number; to: number }; independentSupport: { from: number; to: number } };
  validationsResolved: Array<{ caseId: string; resolved: string[] }>;
}

export function diffPortfolioIntelligence(
  prev: { pi: PortfolioIntelligenceVM; decisions: Record<string, DecisionState>; validations: Record<string, string[]> },
  next: { pi: PortfolioIntelligenceVM; decisions: Record<string, DecisionState>; validations: Record<string, string[]> },
): PortfolioSnapshotDiff {
  const decisionChanges = Object.keys(next.decisions).filter(id => prev.decisions[id] && prev.decisions[id] !== next.decisions[id]).map(id => ({ caseId: id, from: prev.decisions[id], to: next.decisions[id] }));
  const prevThemes = new Map(prev.pi.changePatterns.map(p => [p.key, p.supportingCaseIds.length]));   // canonical key
  const nextThemes = new Map(next.pi.changePatterns.map(p => [p.key, p.supportingCaseIds.length]));
  const changePatterns = {
    new: Array.from(nextThemes.keys()).filter(k => !prevThemes.has(k)),
    persisting: Array.from(nextThemes.keys()).filter(k => prevThemes.has(k)),
    disappeared: Array.from(prevThemes.keys()).filter(k => !nextThemes.has(k)),
  };
  const patternSupport = changePatterns.persisting.filter(k => nextThemes.get(k)! !== prevThemes.get(k)!)
    .map(k => ({ key: k, from: prevThemes.get(k)!, to: nextThemes.get(k)!, direction: (nextThemes.get(k)! > prevThemes.get(k)! ? "strengthened" : "weakened") as "strengthened" | "weakened" }));
  const validationsResolved = Object.keys(prev.validations).map(id => ({ caseId: id, resolved: (prev.validations[id] ?? []).filter(q => !(next.validations[id] ?? []).includes(q)) })).filter(x => x.resolved.length > 0);
  return {
    decisionChanges, changePatterns, patternSupport,
    coverage: { verifiedChange: { from: prev.pi.deterministic.verifiedChangeCount, to: next.pi.deterministic.verifiedChangeCount }, independentSupport: { from: prev.pi.deterministic.independentSupportCount, to: next.pi.deterministic.independentSupportCount } },
    validationsResolved,
  };
}
