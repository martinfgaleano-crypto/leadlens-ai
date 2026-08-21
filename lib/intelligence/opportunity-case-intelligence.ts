// Evidence-complete Opportunity Case intelligence contract.
//
// This is an evaluation/synthesis-layer object. Renderers and deliverable
// adapters may only carry these fields; they must not classify opportunities.
// Every optional field remains absent unless the supplied commercial context
// and evidence support it.

export const OPPORTUNITY_CASE_INTELLIGENCE_VERSION = "opportunity-case-v1";

export type ProvenanceBasis = "explicit" | "observed" | "inferred" | "unknown";
export type AccountRole = "Potential Customer" | "Supplier" | "Distributor" | "Strategic Partner";
export type OpportunityType =
  | "New Business"
  | "Operations Expansion"
  | "Technology Modernization"
  | "Enterprise Transformation"
  | "New Market Entry"
  | "Capacity Expansion"
  | "Vendor or Platform Change"
  | "Channel Partnership";
export type QualitativeStrength = "Strong" | "Moderate" | "Limited" | "Unknown";
export type EvidenceRelationV1 = "direct" | "supporting" | "context";
export type CaseImpact = "fit" | "timing" | "what_changed" | "why_now" | "decision" | "counter_case";

export interface ProvenancedValue<T> {
  value: T;
  basis: ProvenanceBasis;
  source: string;
  rationale: string;
}

export interface CaseEvidenceV1 {
  claim: string;
  observation: string;
  sourceLabel: string;
  url: string | null;
  date: string | null;
  relation: EvidenceRelationV1;
  basis: "observed" | "inferred";
  impacts: CaseImpact[];
  independenceKey: string | null;
}

export interface MaterialChangeV1 {
  event: string;
  date: string;
  sourceLabel: string;
  relevance: string;
}

export interface ValidationV1 {
  question: string;
  decisionCritical: boolean;
  howToValidate: string | null;
  changesDecisionBecause: string | null;
}

export interface OpportunityCaseIntelligenceV1 {
  version: typeof OPPORTUNITY_CASE_INTELLIGENCE_VERSION;
  classification: {
    accountRole: ProvenancedValue<AccountRole> | null;
    opportunityType: ProvenancedValue<OpportunityType> | null;
    opportunityDescriptor: string | null;
  };
  fit: ProvenancedValue<Exclude<QualitativeStrength, "Unknown">> | null;
  timing: ProvenancedValue<Exclude<QualitativeStrength, "Unknown">> | null;
  changes: MaterialChangeV1[];
  whyNow: ProvenancedValue<string> | null;
  evidence: CaseEvidenceV1[];
  independentSupport: boolean;
  weaknesses: ProvenancedValue<string>[];
  unknowns: ProvenancedValue<string>[];
  validations: ValidationV1[];
  decisionRationale: ProvenancedValue<string> | null;
  recommendedNextStep: ProvenancedValue<string> | null;
  revisitWhen: ProvenancedValue<string> | null;
  potentialValue: null;
  feasibility: null;
}

const ROLE_TYPE: Record<AccountRole, readonly OpportunityType[]> = {
  "Potential Customer": ["New Business", "Operations Expansion", "Technology Modernization", "Enterprise Transformation", "New Market Entry", "Capacity Expansion", "Vendor or Platform Change"],
  Supplier: ["New Business", "Operations Expansion", "New Market Entry", "Capacity Expansion"],
  Distributor: ["New Business", "New Market Entry", "Channel Partnership"],
  "Strategic Partner": ["New Business", "New Market Entry", "Channel Partnership", "Enterprise Transformation"],
};

export function isCoherentRoleType(role: AccountRole, type: OpportunityType): boolean {
  return ROLE_TYPE[role].includes(type);
}

export interface AmorCaseEvaluationInput {
  account: string;
  routeKey: string;
  routeLabel: string;
  group: string;
  clientObjective: string;
  structuralReason: string;
  proposedTest: string;
  unknown: string;
  nextStep: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  observedFact: string | null;
  proves: string | null;
}

const routeType = (route: string): { type: OpportunityType; descriptor: string } | null => {
  if (route === "specialty_retail") return { type: "New Business", descriptor: "Prueba de categoría y reposición en retail especializado" };
  if (route === "hospitality_spa") return { type: "New Business", descriptor: "Prueba de experiencia de huésped o retail de spa" };
  if (route === "gifting" || /regalos/i.test(route)) return { type: "New Business", descriptor: "Inclusión de producto terminado en un brief de regalos corporativos" };
  return null;
};

const decisionEs = (group: string): "Priorizar" | "Validar" | "Monitorear" =>
  /prioridad/i.test(group) ? "Priorizar" : /investigar/i.test(group) ? "Monitorear" : "Validar";

/**
 * Re-evaluates existing, immutable Amor evidence into a new derived Case object.
 * It never turns retrieval/page-update dates into event dates and therefore
 * emits no Timing or What Changed without a genuine supplied event.
 */
export function evaluateAmorOpportunityCase(input: AmorCaseEvaluationInput): OpportunityCaseIntelligenceV1 {
  const typed = routeType(input.routeKey);
  const role: ProvenancedValue<AccountRole> = {
    value: "Potential Customer",
    basis: "explicit",
    source: "client commercial objective + approved target-account portfolio",
    rationale: `La cuenta fue seleccionada para evaluar una posible relación comercial con ${input.account}, no como fuente, proveedor o actor del paisaje.`,
  };
  const type = typed && isCoherentRoleType(role.value, typed.type)
    ? { value: typed.type, basis: "inferred" as const, source: "commercial route + proposed test", rationale: `${input.routeLabel}: ${input.proposedTest}` }
    : null;
  const evidence: CaseEvidenceV1[] = input.sourceLabel && input.observedFact && input.proves ? [{
    claim: input.proves,
    observation: input.observedFact,
    sourceLabel: input.sourceLabel,
    url: input.sourceUrl,
    date: null,
    relation: "direct",
    basis: "observed",
    impacts: ["fit"],
    independenceKey: input.sourceLabel,
  }] : [];
  const fit = evidence.length ? {
    value: "Moderate" as const,
    basis: "inferred" as const,
    source: "commercial objective + route evidence + proposed test",
    rationale: `${input.structuralReason} La evidencia confirma relevancia estructural, pero no confirma compra de terceros, economía ni aceptación del formato.`,
  } : null;
  const decision = decisionEs(input.group);
  const rationale = fit ? {
    value: `${decision}: el encaje estructural es moderado y está respaldado por una fuente oficial, pero permanece sin confirmar: ${input.unknown.replace(/[.!?]+$/g, "").replace(/^./, (c) => c.toLowerCase())}. No existe evidencia de intención de compra ni de timing actual.`,
    basis: "inferred" as const,
    source: "fit + evidence + material unknown + existing portfolio decision",
    rationale: "Síntesis explícita sin puntaje agregado ni certeza de compra.",
  } : null;

  return {
    version: OPPORTUNITY_CASE_INTELLIGENCE_VERSION,
    classification: {
      accountRole: role,
      opportunityType: type,
      opportunityDescriptor: typed?.descriptor ?? null,
    },
    fit,
    timing: null,
    changes: [],
    whyNow: null,
    evidence,
    independentSupport: false,
    weaknesses: [],
    unknowns: [{ value: input.unknown, basis: "explicit", source: "approved account review", rationale: "Unresolved fact that may change the decision." }],
    validations: [{
      question: input.unknown,
      decisionCritical: true,
      howToValidate: input.proposedTest,
      changesDecisionBecause: `Resolver esta incógnita puede mover la cuenta entre Priorizar, Validar, Monitorear o En espera.`,
    }],
    decisionRationale: rationale,
    recommendedNextStep: { value: input.nextStep, basis: "explicit", source: "approved account review", rationale: "Next step follows the current decision and named unknown." },
    revisitWhen: null,
    potentialValue: null,
    feasibility: null,
  };
}

export interface InstitutionalCaseEvaluationInput {
  account: string;
  clientObjective: string | null;
  explicitRole: string | null;
  explicitType: string | null;
  opportunityDescriptor: string | null;
  fitScore: number | null;
  fitReasons: string[];
  signal: { label: string; date: string; sourceLabel: string; url: string } | null;
  whyNow: string | null;
  sourceEvidence: Array<{ label: string; url: string | null; date: string | null }>;
  explicitIndependentSupport: boolean;
  risks: string[];
  blockers: string[];
  openQuestions: string[];
  decision: "prioritize" | "validate" | "monitor" | "hold";
  recommendedNextStep: string | null;
}

const ROLES: readonly AccountRole[] = ["Potential Customer", "Supplier", "Distributor", "Strategic Partner"];
const TYPES: readonly OpportunityType[] = ["New Business", "Operations Expansion", "Technology Modernization", "Enterprise Transformation", "New Market Entry", "Capacity Expansion", "Vendor or Platform Change", "Channel Partnership"];

/** Builds only from already-structured pipeline fields. No keyword classifier. */
export function evaluateInstitutionalOpportunityCase(input: InstitutionalCaseEvaluationInput): OpportunityCaseIntelligenceV1 {
  const role = ROLES.includes(input.explicitRole as AccountRole) ? input.explicitRole as AccountRole : null;
  const type = TYPES.includes(input.explicitType as OpportunityType) ? input.explicitType as OpportunityType : null;
  const coherentType = role && type && isCoherentRoleType(role, type) ? type : null;
  const fitValue = input.fitScore === null ? null : input.fitScore >= 7 ? "Strong" : input.fitScore >= 4 ? "Moderate" : "Limited";
  const changes: MaterialChangeV1[] = input.signal ? [{
    event: input.signal.label,
    date: input.signal.date,
    sourceLabel: input.signal.sourceLabel,
    relevance: input.whyNow ?? "A dated material event was captured; commercial relevance still requires validation.",
  }] : [];
  const whyNow = input.signal && input.clientObjective && input.whyNow ? {
    value: input.whyNow,
    basis: "inferred" as const,
    source: "dated signal + client commercial objective",
    rationale: "Interpretation connects an observed event to the explicit client context; it is not buying intent.",
  } : null;
  const evidence: CaseEvidenceV1[] = input.sourceEvidence.map((e, index) => ({
    claim: index === 0 && input.signal ? input.signal.label : e.label,
    observation: e.label,
    sourceLabel: (() => { try { return e.url ? new URL(e.url).hostname.replace(/^www\./, "") : "stored evidence"; } catch { return "stored evidence"; } })(),
    url: e.url,
    date: e.date,
    relation: index === 0 ? "direct" : "context",
    basis: "observed",
    impacts: index === 0 && input.signal ? ["what_changed", "timing"] : ["fit"],
    independenceKey: e.url ? (() => { try { return new URL(e.url).hostname.replace(/^www\./, ""); } catch { return null; } })() : null,
  }));
  const validationQuestion = input.openQuestions[0] ?? input.blockers[0] ?? null;
  const evidenceText = input.explicitIndependentSupport ? "con soporte independiente explícito" : evidence.length === 1 ? "con una sola fuente" : evidence.length ? "sin independencia confirmada" : "sin fuente enlazada";
  const decisionRationale = fitValue ? {
    value: `${input.decision}: encaje ${fitValue.toLowerCase()}, ${changes.length ? "señal temporal verificada" : "sin señal temporal verificada"} y evidencia ${evidenceText}${validationQuestion ? `; queda por resolver: ${validationQuestion}` : ""}.`,
    basis: "inferred" as const,
    source: "fit + timing + evidence + uncertainty + existing decision",
    rationale: "Qualitative synthesis; no aggregate score and no purchase-intent claim.",
  } : null;
  return {
    version: OPPORTUNITY_CASE_INTELLIGENCE_VERSION,
    classification: {
      accountRole: role ? { value: role, basis: "explicit", source: "commercial opportunity context", rationale: "Explicit account relationship classification." } : null,
      opportunityType: coherentType ? { value: coherentType, basis: "explicit", source: "commercial opportunity context", rationale: "Controlled type accepted only after Role × Type coherence validation." } : null,
      opportunityDescriptor: coherentType ? input.opportunityDescriptor : null,
    },
    fit: fitValue ? { value: fitValue, basis: "inferred", source: "qualification.fit_score + fit_reasons", rationale: input.fitReasons.join(" · ") || "Existing commercial-alignment evaluation." } : null,
    timing: input.signal ? { value: "Moderate", basis: "inferred", source: "validated dated source signal", rationale: "A dated event makes present evaluation relevant but does not establish buying intent." } : null,
    changes,
    whyNow,
    evidence,
    independentSupport: input.explicitIndependentSupport,
    weaknesses: input.risks.map((value) => ({ value, basis: "inferred", source: "pipeline risk evaluation", rationale: "Material factor that can weaken the case." })),
    unknowns: input.blockers.map((value) => ({ value, basis: "explicit", source: "actionability blockers", rationale: "Unresolved fact, not counterevidence." })),
    validations: validationQuestion ? [{ question: validationQuestion, decisionCritical: input.decision === "validate", howToValidate: input.recommendedNextStep, changesDecisionBecause: input.decision === "validate" ? "Resolving this blocker determines whether active prioritization is justified." : null }] : [],
    decisionRationale,
    recommendedNextStep: input.recommendedNextStep ? { value: input.recommendedNextStep, basis: "explicit", source: "pipeline recommendation", rationale: "Action follows the existing decision." } : null,
    revisitWhen: null,
    potentialValue: null,
    feasibility: null,
  };
}
