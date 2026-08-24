// ─── Deterministic Stage A extractor (no LLM, no research) ────────────────────
//
// A genuinely INPUT-DRIVEN extraction from commercial prose into a valid
// CompanyInterpretationV1 — different inputs produce different interpretations.
//
// Two roles (§7):
//   1. Safe fallback when the LLM is unavailable / fails / returns invalid data.
//   2. The keyless-dev path, so the live landing works without a model key.
//
// It is NOT a hardcoded-scenario matcher (that was lib/landing/landing-
// interpretation). It reads objective, business model, offer, target, geography,
// exclusions and change-triggers from the actual text. By construction it emits
// zero stageAViolations: only user_stated / inferred claims, only "hypothesis"
// signal families, never external verification, never invented accounts.

import type { SignalFamily } from "@/lib/discovery/needs-map";
import type {
  CompanyInterpretationV1,
  ContextClaim,
  ContextOrigin,
  OpportunityCondition,
  SignalHypothesis,
  SupportedObjectiveType,
  UnsupportedObjectiveType,
  TargetRelationship,
  BusinessModel,
} from "./company-interpretation";
import type { LandingInterpretationLocale } from "@/lib/landing/landing-interpretation";

const now = () => new Date().toISOString();

function claim<T>(value: T, origin: ContextOrigin, scope: ContextClaim<T>["scope"]): ContextClaim<T> {
  return { value, origin, verificationStatus: origin === "user_input" ? "user_stated" : "inferred", scope, recordedAt: now() };
}

const RELATIONSHIP: Record<SupportedObjectiveType, TargetRelationship> = {
  win_customers: "customer",
  business_development: "customer",
  identify_high_value_accounts: "customer",
  partnerships: "partner",
  advisory_opportunities: "advisory_client",
};

const UNSUPPORTED_REASON: Record<UnsupportedObjectiveType, string> = {
  investors: "LeadLens finds organizations to do commercial business with — not investors or capital.",
  m_and_a: "LeadLens is not an M&A or deal-sourcing tool.",
  acquisition_target: "LeadLens does not help you find a buyer for or sell your own company.",
  procurement: "LeadLens finds accounts to sell to or partner with — not suppliers to buy from.",
  hiring: "LeadLens is not a recruiting or candidate-search tool.",
  generic_research: "LeadLens investigates specific target organizations — it is not open-ended market research.",
  competitive_intelligence: "LeadLens is not a competitor-monitoring tool.",
};

const GEO_PATTERNS: Array<[RegExp, string]> = [
  [/\bcolombia\b/i, "Colombia"], [/\b(latin america|latam|am[eé]rica latina)\b|ラテンアメリカ/i, "Latin America"],
  [/\b(united states|usa|u\.s\.|estados unidos)\b|米国/i, "United States"], [/\b(brazil|brasil)\b|ブラジル/i, "Brazil"],
  [/\b(mexico|m[eé]xico)\b|メキシコ/i, "Mexico"], [/\b(europe|europa)\b|ヨーロッパ/i, "Europe"],
  [/\b(asia|asia[- ]pacific|apac)\b|アジア/i, "Asia"], [/\b(germany|alemania)\b/i, "Germany"], [/\b(uk|united kingdom|reino unido)\b/i, "United Kingdom"],
];

// change phrase → canonical SignalFamily (reused from needs-map)
const TRIGGER_PATTERNS: Array<[RegExp, SignalFamily, string]> = [
  [/new (facilit|plant|factory|warehouse|distribution cent|site)|nueva (planta|f[aá]brica|bodega|instalaci)|新(工場|施設|拠点)/i, "new_facility", "Opening new facilities"],
  [/acqui|merger|adquisici|fusi[oó]n|買収|統合/i, "acquisition", "Acquisition or integration activity"],
  [/expan|scal(e|ing)|growth of operations|ampliaci[oó]n|crecimiento operativo|拡大/i, "expansion", "Operational expansion"],
  [/new market|enter(ing)? (a )?new|international expansion|nuevo mercado|internacionaliz|新市場|海外展開/i, "new_market", "Entering new markets"],
  [/fund(ing|ed)|raised|investment round|inversi[oó]n|ronda|資金調達/i, "investment", "New funding or investment"],
  [/partner|alliance|channel|alianza|socio|distribu|提携|パートナー/i, "partnership", "New partnership or channel activity"],
  [/contract|tender|award|licitaci[oó]n|contrato|adjudicaci|契約|入札/i, "contract_award", "New contract or award"],
  [/regulat|compliance|regulaci[oó]n|cumplimiento|規制/i, "regulatory", "Regulatory change"],
  [/digital transformation|cloud migration|tech(nology)? change|migraci[oó]n|transformaci[oó]n digital|技術刷新/i, "technology_change", "Technology change"],
  [/operational (transformation|integration|restructur)|reestructur|integraci[oó]n operativa|業務改革/i, "operational_transformation", "Operational transformation"],
  [/fleet|vehicles|trucks|flota|車両/i, "fleet_growth", "Fleet growth"],
  [/capacity|production line|output|capacidad|l[ií]nea de producci[oó]n|生産能力/i, "capacity", "Capacity change"],
  [/infrastructure|infraestructura|インフラ/i, "infrastructure", "Infrastructure investment"],
];

function detectUnsupported(t: string): UnsupportedObjectiveType | null {
  if (/\b(investors?|venture capital|raise (capital|money|funding)|inversor|capital de riesgo|出資|投資家)\b/i.test(t)) return "investors";
  if (/\b(sell (my|our) (company|business)|find a buyer|be acquired|exit our|vender (mi|la) empresa)\b/i.test(t)) return "acquisition_target";
  if (/\b(m&a|mergers? and acquisitions?|deal[- ]sourcing)\b/i.test(t)) return "m_and_a";
  if (/\b(suppliers?|vendors? to buy|procurement|proveedor(es)?|comprar a)\b/i.test(t)) return "procurement";
  if (/\b(hir(e|ing)|recruit|candidates?|talent|contratar|reclutar|empleados)\b/i.test(t)) return "hiring";
  if (/\b(competitors?|competitive intelligence|competencia|monitor rivals)\b/i.test(t)) return "competitive_intelligence";
  if (/\b(market research|study the market|investigaci[oó]n de mercado)\b/i.test(t) && !/\b(sell|win|client|customer|partner|advis)/i.test(t)) return "generic_research";
  return null;
}

function detectSupported(t: string): SupportedObjectiveType | null {
  if (/\b(distribution partners?|channel partners?|strategic partners?|partnerships?|alianzas?|socios de|パートナー)\b/i.test(t)) return "partnerships";
  if (/\b(advis(e|ory|ing)|consult(ing|ancy)?|asesor|consultor[ií]a|professional services|コンサル)\b/i.test(t)) return "advisory_opportunities";
  if (/\b(high[- ]value|strategic accounts?|prioriti(ze|se)|identify companies|cuentas de alto valor|alto valor|重要(な)?(顧客|アカウント))\b/i.test(t)) return "identify_high_value_accounts";
  if (/\b(business development|new business|desarrollo de negocio|事業開発)\b/i.test(t)) return "business_development";
  if (/\b(sell|selling|win (new )?(customers?|clients?)|vender|conseguir clientes|customers?|clients?|顧客|販売)\b/i.test(t)) return "win_customers";
  return null;
}

function detectBusinessModel(t: string): BusinessModel | undefined {
  if (/\b(software|saas|platform software|app)\b/i.test(t)) return "software";
  if (/\b(consult|advis|agency|agencia|services?|servicios?|asesor)\b/i.test(t)) return "services";
  if (/\b(distribut|wholesale|reseller|distribuci)\b/i.test(t)) return "distribution";
  if (/\b(marketplace|platform|plataforma)\b/i.test(t)) return "platform";
  if (/\b(manufactur|product|equipment|hardware|goods|producto)\b/i.test(t)) return "product";
  return undefined;
}

function extractOffer(t: string): string | null {
  const m = t.match(/(?:we\s+)?(?:provide|sell|offer|supply|deliver|build|make|are a|run a|proporcionamos|vendemos|ofrecemos|somos una?)\s+([^.,;]{3,70}?)(?:\s+(?:to|for|para|a|that|which|and want|where|whose)\b|[.,;]|$)/i);
  return m?.[1]?.trim() || null;
}

function extractTarget(t: string): string | null {
  const m = t.match(/\b(?:to|for|with|para|a|con)\s+((?:mid[- ]sized |small |large |enterprise |regional )?[a-zñáéíóú][^.,;]{2,60}?)(?:\s+(?:in|en|where|whose|that|which|but|and want|con|donde)\b|[.,;]|$)/i);
  const cand = m?.[1]?.trim();
  if (!cand || /^(now|them|us|it|companies|empresas|businesses|organizations?)$/i.test(cand)) return null;
  return cand;
}

function extractExclusions(t: string): string[] {
  const out: string[] = [];
  const re = /\b(?:but not|except|excluding|not|no|pero no|excepto|sin)\s+([a-zñáéíóú][^.,;]{2,40}?)(?:[.,;]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) { const v = m[1].trim(); if (v && !/^(yet|sure|only)/i.test(v)) out.push(v); }
  return out.slice(0, 3);
}

const GENERIC = /^(software|technology|services?|consulting|we help companies grow|find companies|help companies|ayudamos a( las)? empresas|encontrar empresas|tecnolog[ií]a|servicios?)\.?$/i;

/** Deterministically extract a CompanyInterpretationV1 from prose. */
export function extractCompanyInterpretation(rawInput: string, locale: LandingInterpretationLocale = "en"): CompanyInterpretationV1 {
  const input = rawInput.replace(/\s+/g, " ").trim();
  const t = input.toLowerCase();
  const submittedAt = now();
  const base = {
    schemaVersion: "1" as const,
    source: { rawInputRef: "session", inputLanguage: locale, submittedAt },
  };

  // Unsupported objective — represented honestly, never normalized.
  const unsupported = detectUnsupported(t);
  const supported = detectSupported(t);
  if (unsupported && !(supported === "partnerships" || supported === "advisory_opportunities")) {
    return {
      ...base,
      companyContext: { companyDescription: input ? claim(input, "user_input", "customer_company") : undefined, offers: [], capabilities: [] },
      commercialObjective: { supported: false, requestedType: unsupported, rawObjective: input, reason: UNSUPPORTED_REASON[unsupported] },
      targetAccountProfile: { organizationTypes: [], inferredFromInput: false },
      opportunityConditions: [], signalHypotheses: [], disqualifiers: [], exclusions: [], constraints: [],
      clarification: { blockers: [], nonBlockingGaps: [], contradictions: [] },
      certainty: "clear", interpretationStatus: "unsupported_objective",
    };
  }

  const geographies = GEO_PATTERNS.filter(([re]) => re.test(input)).map(([, label]) => ({ label }));
  const offer = extractOffer(input);
  const target = extractTarget(input);
  const exclusions = extractExclusions(input);
  const businessModel = detectBusinessModel(t);

  // change triggers → conditions + signal hypotheses (dedup by family)
  const seen = new Set<SignalFamily>();
  const conditions: OpportunityCondition[] = [];
  const hypotheses: SignalHypothesis[] = [];
  for (const [re, family, desc] of TRIGGER_PATTERNS) {
    if (re.test(input) && !seen.has(family)) {
      seen.add(family);
      const id = `oc_${family}`;
      conditions.push({ id, type: "change_trigger", description: desc, effect: "increase_relevance", observable: true, suggestedSignalFamilies: [family], origin: "user_input" });
      hypotheses.push({ family, relevanceToObjective: desc, linkedConditionIds: [id], status: "hypothesis" });
    }
  }
  if (target) conditions.unshift({ id: "oc_structural", type: "structural", description: `Is ${/^(a|an|the)\b/i.test(target) ? target : "a " + target}`, effect: "required", observable: false, origin: "llm_interpretation" });

  const isGeneric = input.length < 18 || GENERIC.test(input);
  const objective = supported ?? (offer && target && !isGeneric ? "win_customers" : null);

  const blockers = [];
  if (!objective) blockers.push({ id: "b_obj", priority: "commercial_objective" as const, reason: "No clear commercial objective — who are you trying to reach, and why?" });
  if (!target && !isGeneric && objective) blockers.push({ id: "b_target", priority: "target_organization" as const, reason: "No target organization described — what kind of company should LeadLens investigate?" });
  if (isGeneric) blockers.push({ id: "b_target", priority: "target_organization" as const, reason: "Too general — describe your business, objective and the organizations that matter." });

  const nonBlockingGaps = [];
  if (objective && target && geographies.length === 0) nonBlockingGaps.push({ id: "g_geo", priority: "geography" as const, reason: "No geography stated; discovery can run broadly, but a region would sharpen it." });
  if (objective && target && conditions.filter((c) => c.type === "change_trigger").length === 0) nonBlockingGaps.push({ id: "g_trigger", priority: "opportunity_condition" as const, reason: "No change trigger yet — which developments should signal it is time to engage?" });

  const disqualifiers = exclusions.map((rule) => ({ type: "custom" as const, rule, severity: "exclude" as const, origin: "user_input" as ContextOrigin }));

  const status = blockers.length > 0 ? "needs_clarification" : "ready_for_confirmation";
  const certainty = blockers.length > 0 ? (offer || target ? "partially_clear" : "ambiguous") : (nonBlockingGaps.length ? "partially_clear" : "clear");

  const capabilities = offer ? [claim(offer, "user_input", "customer_company")] : [];

  return {
    ...base,
    companyContext: {
      companyDescription: input ? claim(input, "user_input", "customer_company") : undefined,
      businessModel: businessModel ? claim(businessModel, "llm_interpretation", "customer_company") : undefined,
      offers: offer ? [claim({ label: offer }, "user_input", "customer_company")] : [],
      capabilities,
    },
    commercialObjective: objective
      ? { supported: true, type: objective, description: input, targetRelationship: RELATIONSHIP[objective], userConfirmed: false }
      : { supported: false, requestedType: "unknown", rawObjective: input, reason: "The commercial objective is not yet clear enough to act on." },
    targetAccountProfile: {
      organizationTypes: target ? [target.replace(/^(a|an|the)\s+/i, "").replace(/^./, (c) => c.toUpperCase())] : [],
      geographies: geographies.length ? geographies : undefined,
      exclusions: exclusions.length ? exclusions : undefined,
      inferredFromInput: true,
    },
    opportunityConditions: objective ? conditions : [],
    signalHypotheses: objective ? hypotheses : [],
    disqualifiers,
    exclusions: [],
    constraints: [],
    clarification: {
      blockers,
      nonBlockingGaps,
      contradictions: [],
      nextQuestion: blockers.length ? { gapId: blockers[0].id, question: clarQuestion(blockers[0].priority, locale) } : undefined,
    },
    certainty,
    interpretationStatus: objective && blockers.length === 0 ? "ready_for_confirmation" : status,
  };
}

function clarQuestion(priority: "commercial_objective" | "target_organization" | "geography" | "opportunity_condition" | "hard_exclusion" | "other", locale: LandingInterpretationLocale): string {
  const Q: Record<string, Record<LandingInterpretationLocale, string>> = {
    commercial_objective: {
      en: "What are you trying to achieve — win customers, find partners, or advisory work?",
      es: "¿Qué buscas lograr: ganar clientes, encontrar socios o trabajo de asesoría?",
      pt: "O que você quer alcançar — ganhar clientes, encontrar parceiros ou consultoria?",
      ja: "目的は何ですか？新規顧客、パートナー探し、それともアドバイザリー業務ですか？",
    },
    target_organization: {
      en: "What kind of organization should LeadLens look at?",
      es: "¿Qué tipo de organización debería analizar LeadLens?",
      pt: "Que tipo de organização o LeadLens deve analisar?",
      ja: "LeadLensはどのような組織を対象にすべきですか？",
    },
  };
  return (Q[priority] ?? Q.target_organization)[locale];
}
