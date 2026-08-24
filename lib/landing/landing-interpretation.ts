import type { CommercialContextVM } from "@/lib/deliverable/deliverable-view-model";

export type LandingScenarioKey = "cybersecurity" | "logistics" | "packaging";
export type LandingInterpretationLocale = "en" | "es" | "pt" | "ja";

export interface LandingInterpretationProjection {
  inputSummary: string;
  commercialContext: CommercialContextVM;
  productCapability: string;
  problem: string;
  targetAccountDescriptors: string[];
  buyerHypotheses: string[];
  signalFamilies: string[];
  disqualifiers: string[];
  clarificationGaps: string[];
  scenarioKey: LandingScenarioKey | null;
  provenance: "deterministic_demo";
  illustrative: true;
}

type ScenarioDefinition = {
  key: LandingScenarioKey;
  terms: RegExp;
  productCapability: string;
  problem: string;
  targets: string[];
  functions: string[];
  signals: string[];
  industries: string[];
  criteria: string[];
};

const SCENARIOS: ScenarioDefinition[] = [
  {
    key: "cybersecurity",
    terms: /(cyber\s*security|cybersecurity|ciberseguridad|seguran[cç]a\s+cibern[eé]tica|サイバーセキュリティ)/i,
    productCapability: "Cybersecurity and risk protection",
    problem: "Protecting regulated operations and reducing exposure to security incidents",
    targets: ["Regulated financial institutions", "Organizations with security-sensitive digital operations"],
    functions: ["Security", "Technology", "Risk and compliance"],
    signals: ["Security modernization", "Regulatory pressure", "Cloud or digital expansion", "Material security incidents"],
    industries: ["Financial services", "Regulated digital businesses"],
    criteria: ["Security-sensitive operations", "A current change that can alter risk or compliance needs"],
  },
  {
    key: "logistics",
    terms: /(logistics?\s+software|software\s+(?:de\s+)?log[ií]stic[ao]|wms|warehouse|supply\s+chain|software\s+log[ií]stico|物流ソフトウェア)/i,
    productCapability: "Logistics planning and operational visibility",
    problem: "Coordinating inventory, facilities and distribution as operations become more complex",
    targets: ["Manufacturers with physical distribution", "Retailers, distributors and logistics operators"],
    functions: ["Operations", "Supply Chain", "Logistics"],
    signals: ["New distribution center", "Warehouse expansion", "Capacity investment", "Operational integration"],
    industries: ["Manufacturing", "Distribution", "Logistics"],
    criteria: ["Directly operated logistics infrastructure", "A material change in capacity or operational footprint"],
  },
  {
    key: "packaging",
    terms: /(industrial\s+packaging|packaging\s+industrial|empaque(?:s)?\s+industrial(?:es)?|embalagem\s+industrial|産業用包装)/i,
    productCapability: "Industrial packaging supply",
    problem: "Supporting production, protection and distribution requirements as manufacturing changes",
    targets: ["Manufacturers with material packaging demand", "Food and consumer-goods producers"],
    functions: ["Procurement", "Operations", "Supply Chain"],
    signals: ["Plant expansion", "New production line", "Capacity investment", "Distribution expansion"],
    industries: ["Manufacturing", "Food production"],
    criteria: ["Physical production operations", "A change that can alter packaging volume or specifications"],
  },
];

const SCENARIO_LOCALIZATION: Partial<Record<LandingInterpretationLocale, Record<LandingScenarioKey, Omit<ScenarioDefinition, "key" | "terms">>>> = {
  es: {
    cybersecurity: { productCapability: "Ciberseguridad y protección de riesgos", problem: "Proteger operaciones reguladas y reducir la exposición a incidentes de seguridad", targets: ["Entidades financieras reguladas", "Organizaciones con operaciones digitales sensibles"], functions: ["Seguridad", "Tecnología", "Riesgo y cumplimiento"], signals: ["Modernización de seguridad", "Presión regulatoria", "Expansión cloud o digital", "Incidentes materiales de seguridad"], industries: ["Servicios financieros", "Empresas digitales reguladas"], criteria: ["Operación sensible a seguridad", "Un cambio vigente que altere necesidades de riesgo o cumplimiento"] },
    logistics: { productCapability: "Planificación logística y visibilidad operativa", problem: "Coordinar inventario, instalaciones y distribución cuando la operación se vuelve más compleja", targets: ["Fabricantes con distribución física", "Retailers, distribuidores y operadores logísticos"], functions: ["Operaciones", "Supply Chain", "Logística"], signals: ["Nuevo centro de distribución", "Expansión de bodegas", "Inversión en capacidad", "Integración operativa"], industries: ["Manufactura", "Distribución", "Logística"], criteria: ["Infraestructura logística operada directamente", "Cambio material de capacidad o huella operativa"] },
    packaging: { productCapability: "Suministro de empaques industriales", problem: "Atender requisitos de producción, protección y distribución cuando cambia la manufactura", targets: ["Fabricantes con demanda material de empaques", "Productores de alimentos y consumo"], functions: ["Compras", "Operaciones", "Supply Chain"], signals: ["Expansión de planta", "Nueva línea de producción", "Inversión en capacidad", "Expansión de distribución"], industries: ["Manufactura", "Producción de alimentos"], criteria: ["Operación física de producción", "Cambio que altere el volumen o especificación del empaque"] },
  },
  pt: {
    cybersecurity: { productCapability: "Cibersegurança e proteção de riscos", problem: "Proteger operações reguladas e reduzir a exposição a incidentes de segurança", targets: ["Instituições financeiras reguladas", "Organizações com operações digitais sensíveis"], functions: ["Segurança", "Tecnologia", "Risco e conformidade"], signals: ["Modernização de segurança", "Pressão regulatória", "Expansão cloud ou digital", "Incidentes materiais de segurança"], industries: ["Serviços financeiros", "Empresas digitais reguladas"], criteria: ["Operação sensível à segurança", "Mudança atual que altere necessidades de risco ou conformidade"] },
    logistics: { productCapability: "Planejamento logístico e visibilidade operacional", problem: "Coordenar estoque, instalações e distribuição à medida que a operação se torna mais complexa", targets: ["Fabricantes com distribuição física", "Varejistas, distribuidores e operadores logísticos"], functions: ["Operações", "Supply Chain", "Logística"], signals: ["Novo centro de distribuição", "Expansão de armazém", "Investimento em capacidade", "Integração operacional"], industries: ["Manufatura", "Distribuição", "Logística"], criteria: ["Infraestrutura logística operada diretamente", "Mudança material de capacidade ou presença operacional"] },
    packaging: { productCapability: "Fornecimento de embalagens industriais", problem: "Atender requisitos de produção, proteção e distribuição quando a manufatura muda", targets: ["Fabricantes com demanda material de embalagens", "Produtores de alimentos e bens de consumo"], functions: ["Compras", "Operações", "Supply Chain"], signals: ["Expansão de fábrica", "Nova linha de produção", "Investimento em capacidade", "Expansão de distribuição"], industries: ["Manufatura", "Produção de alimentos"], criteria: ["Operação física de produção", "Mudança que altere volume ou especificação de embalagem"] },
  },
  ja: {
    cybersecurity: { productCapability: "サイバーセキュリティとリスク保護", problem: "規制対象業務を保護し、セキュリティ事故への露出を減らす", targets: ["規制対象の金融機関", "セキュリティ上重要なデジタル業務を持つ企業"], functions: ["セキュリティ", "テクノロジー", "リスク・コンプライアンス"], signals: ["セキュリティ刷新", "規制圧力", "クラウド・デジタル拡張", "重大なセキュリティ事故"], industries: ["金融サービス", "規制対象デジタル企業"], criteria: ["セキュリティ上重要な業務", "リスクやコンプライアンス需要を変える現在の変化"] },
    logistics: { productCapability: "物流計画とオペレーション可視化", problem: "業務の複雑化に伴う在庫・施設・配送の連携", targets: ["物流機能を持つ製造業", "小売・流通・物流事業者"], functions: ["オペレーション", "サプライチェーン", "物流"], signals: ["新しい物流センター", "倉庫拡張", "能力投資", "業務統合"], industries: ["製造", "流通", "物流"], criteria: ["自社運営の物流インフラ", "能力または業務拠点の重要な変化"] },
    packaging: { productCapability: "産業用包装の供給", problem: "製造変化に伴う生産・保護・流通要件への対応", targets: ["包装需要の大きい製造業", "食品・消費財メーカー"], functions: ["調達", "オペレーション", "サプライチェーン"], signals: ["工場拡張", "新しい生産ライン", "能力投資", "流通拡張"], industries: ["製造", "食品生産"], criteria: ["物理的な生産業務", "包装量または仕様を変える変化"] },
  },
};

const REGION_PATTERNS: Array<[RegExp, string]> = [
  [/\b(colombia|colombian[ao]s?)\b/i, "Colombia"],
  [/(?:\b(?:latin america|latam|am[eé]rica latina)\b|ラテンアメリカ)/i, "Latin America"],
  [/(?:\b(?:united states|usa|u\.s\.|estados unidos)\b|米国)/i, "United States"],
  [/(?:\b(?:brazil|brasil)\b|ブラジル)/i, "Brazil"],
  [/(?:\b(?:mexico|m[eé]xico)\b|メキシコ)/i, "Mexico"],
  [/(?:\b(?:europe|europa)\b|ヨーロッパ)/i, "Europe"],
];

const GENERIC_INPUT = /^(software|technology|consulting|services?|we help companies grow|ayudamos a (?:las )?empresas a crecer|tecnolog[ií]a|servicios?|ソフトウェア)$/i;

const CLARIFICATIONS: Record<LandingInterpretationLocale, { offerAndTarget: string; target: string; market: string }> = {
  en: { offerAndTarget: "What do you sell, and which type of company buys it?", target: "Which type of company do you sell to?", market: "Which market or geography matters most?" },
  es: { offerAndTarget: "¿Qué vendes y qué tipo de empresa lo compra?", target: "¿A qué tipo de empresa le vendes?", market: "¿Qué mercado o geografía es prioritario?" },
  pt: { offerAndTarget: "O que você vende e que tipo de empresa compra?", target: "Para que tipo de empresa você vende?", market: "Qual mercado ou geografia é prioritário?" },
  ja: { offerAndTarget: "何を販売し、どのような企業が購入しますか？", target: "どのような企業に販売していますか？", market: "最も重要な市場または地域はどこですか？" },
};

export function sanitizeLandingInput(value: string): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 280);
}

export function interpretLandingInput(value: string, locale: LandingInterpretationLocale = "en"): LandingInterpretationProjection {
  const inputSummary = sanitizeLandingInput(value);
  const scenario = SCENARIOS.find((item) => item.terms.test(inputSummary)) ?? null;
  const regions = REGION_PATTERNS.filter(([pattern]) => pattern.test(inputSummary)).map(([, region]) => region);
  const isAmbiguous = inputSummary.length < 18 || GENERIC_INPUT.test(inputSummary);

  if (!scenario || isAmbiguous) {
    return {
      inputSummary,
      commercialContext: {
        objective: null,
        clientDescription: inputSummary || null,
        summary: inputSummary || null,
        regions,
        industries: [],
        criteria: [],
      },
      productCapability: inputSummary || "Commercial offer not yet specified",
      problem: "Not enough detail to infer a specific operational problem",
      targetAccountDescriptors: [],
      buyerHypotheses: [],
      signalFamilies: [],
      disqualifiers: [],
      clarificationGaps: [scenario ? CLARIFICATIONS[locale].target : CLARIFICATIONS[locale].offerAndTarget],
      scenarioKey: null,
      provenance: "deterministic_demo",
      illustrative: true,
    };
  }

  const localized = SCENARIO_LOCALIZATION[locale]?.[scenario.key] ?? scenario;
  const targetText = inputSummary.match(/\b(?:to|for|a|para)\s+([^.,;]{3,80})/i)?.[1]
    ?.replace(/\s+(?:in|en|em|na)\s+(?:colombia|latin america|latam|am[eé]rica latina|brasil|brazil|mexico|m[eé]xico|united states|usa).*$/i, "")
    .trim() ?? null;
  const targets = targetText && !/^(companies|empresas|businesses)$/i.test(targetText)
    ? [targetText]
    : localized.targets;

  return {
    inputSummary,
    commercialContext: {
      objective: locale === "es" ? `Identificar cuentas donde un cambio reciente vuelva comercialmente relevante ${localized.productCapability.toLowerCase()}.` : locale === "pt" ? `Identificar contas onde uma mudança recente torne ${localized.productCapability.toLowerCase()} comercialmente relevante.` : locale === "ja" ? `最近の変化によって${localized.productCapability}が商業的に重要になる企業を特定する。` : `Identify accounts where a recent change can make ${localized.productCapability.toLowerCase()} commercially relevant.`,
      clientDescription: inputSummary,
      summary: `${localized.productCapability} · ${targets.join(" · ")}`,
      regions,
      industries: localized.industries,
      criteria: localized.criteria,
    },
    productCapability: localized.productCapability,
    problem: localized.problem,
    targetAccountDescriptors: targets,
    buyerHypotheses: localized.functions,
    signalFamilies: localized.signals,
    disqualifiers: ["No relevant operation", "Change belongs entirely to a third party"],
    clarificationGaps: regions.length ? [] : [CLARIFICATIONS[locale].market],
    scenarioKey: scenario.key,
    provenance: "deterministic_demo",
    illustrative: true,
  };
}

export const LANDING_INTERPRETATION_EXAMPLES = [
  "We sell cybersecurity software to banks in Latin America.",
  "We sell logistics software to manufacturers in Colombia.",
  "We sell industrial packaging to food manufacturers in Colombia.",
] as const;
