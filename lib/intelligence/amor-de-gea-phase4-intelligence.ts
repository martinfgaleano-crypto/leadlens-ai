import checkpoint from "../../ml/data/opportunity-intelligence/amor_phase4_recovery_v1.checkpoint.json";
import { AMOR_SEARCH_BLUEPRINT as blueprint } from "./amor-de-gea-search-blueprint";
const retrieved = "2026-08-03T18:30:00.000Z";
export const AMOR_PHASE4_RUN = {
  run_id: checkpoint.run_id,
  state: checkpoint.state,
  context_id: checkpoint.context_id,
  blueprint_id: checkpoint.blueprint_id,
  queries: checkpoint.queries.length,
  original_attempt: checkpoint.original_failed_attempt,
  recovery: checkpoint.recovery,
  raw_candidates: checkpoint.queries.reduce(
    (n, q) => n + q.raw_result_count,
    0,
  ),
  deduplicated_urls: new Set(
    checkpoint.queries.flatMap((q) => q.candidates.map((c) => c.url)),
  ).size,
  deduplicated_domains: new Set(
    checkpoint.queries.flatMap((q) =>
      q.candidates.map((c) => {
        try {
          return new URL(c.url).hostname.replace(/^www\./, "");
        } catch {
          return c.url;
        }
      }),
    ),
  ).size,
  exact_provider_cost_usd: null,
  raw_payloads_persisted: false,
} as const;
export const AMOR_MARKET_OPPORTUNITY_MAP = [
  {
    route: "specialty_retail",
    assessment: "strong starting hypothesis",
    customer: "Independent or manageable specialty wellness retailer",
    buyer: "Owner, founder, category buyer or purchasing",
    use_case: "50-unit retail trial then replenishment",
    repeat: "Sell-through-led reorder",
    ease: "moderate–strong",
    procurement: "low–moderate to high for larger retailers",
    operational: "strong at Tier 1–2",
    brand: "strong",
    evidence: "strong official catalogs for multiple accounts",
    cycle: "plausible under 30 days only for accessible buyers",
    friction: "Assortment differentiation and margin",
    unknown: "Buyer path and sell-through expectations",
    invalidate: "No category openness or pilot below onboarding threshold",
    strengthen: "Pilot accepted and replenishment observed",
    learning: "Whether 50 ml premium botanicals fit shelf and reorder behavior",
    attention: "high",
  },
  {
    route: "hospitality_spa",
    assessment: "strong starting hypothesis",
    customer: "Boutique hotel, hotel spa or wellness destination",
    buyer: "General management, spa, guest experience or purchasing",
    use_case: "Spa retail, guest gift or curated experience",
    repeat: "Guest-package or spa-retail replenishment",
    ease: "moderate",
    procurement: "boutique moderate; larger hotels higher",
    operational: "strong for bounded pilot; glass/use copy conditioned",
    brand: "very strong",
    evidence: "multiple current official spa/wellness pages",
    cycle: "plausible but unverified",
    friction: "Clarifying operational use and safe positioning",
    unknown: "Retail behavior and purchasing frequency",
    invalidate: "No product retail/gifting mechanism",
    strengthen: "A bounded guest/spa test with repeatable inventory use",
    learning: "Whether hospitality produces differentiated recurring demand",
    attention: "highest",
  },
  {
    route: "gifting",
    assessment: "promising but conditioned",
    customer: "Corporate gifting and curated kit provider",
    buyer: "Commercial, gifting, partnerships, marketing or HR",
    use_case: "Customized wellness kit or co-branded gift",
    repeat: "Seasonal campaigns and recurring client programs",
    ease: "moderate",
    procurement: "project-based moderate",
    operational: "conditioned by customization lead time and economics",
    brand: "strong",
    evidence: "official providers explicitly market customized corporate kits",
    cycle: "campaign-dependent",
    friction: "Seasonality and exact customization scope",
    unknown: "Realistic order size and repeat cadence",
    invalidate: "Private-label dependency or uneconomic customization",
    strengthen: "Paid pilot/order with reusable co-branding format",
    learning: "Whether personalization increases order value and repeatability",
    attention: "medium–high",
  },
  {
    route: "regional_distribution",
    assessment: "exploratory",
    customer: "Selective regional natural/wellness distributor",
    buyer: "Portfolio/category manager, commercial director or purchasing",
    use_case: "Finished-product representation and regional replenishment",
    repeat: "Wholesale replenishment across independent retailers",
    ease: "weak–moderate",
    procurement: "high",
    operational: "conditioned by capacity and economics",
    brand: "moderate",
    evidence: "search output weak and often social/directory-led",
    cycle: "likely longer and unverified",
    friction: "Margin, opening volume, capacity and onboarding",
    unknown: "Selective distributors compatible with modest scale",
    invalidate: "Immediate 1,000+ requirement or private label",
    strengthen: "Distributor accepts Tier 2 economics and staged territory",
    learning: "Whether distribution is premature",
    attention: "low",
  },
] as const;
export const AMOR_STRATEGIC_EXPERIMENTS = [
  {
    id: "exp_retail",
    route: "specialty_retail",
    hypothesis:
      "A premium wellness retailer can test approximately 50 units and reorder if assortment fit and customer education are adequate.",
    target: "Independent premium wellness retailer",
    mechanism: "Retail trial → sell-through → replenishment",
    smallest_test:
      "Approximately 50 mixed units, subject to mixed-SKU confirmation",
    evidence_before_action: "Assortment, buyer path and pilot acceptance",
    client_action: "Validate commercial terms and offer a bounded trial",
    success: "Pilot accepted and reorder discussion based on sell-through",
    failure: "No category openness or economics fail",
    learning: "Shelf fit, objections and reorder cadence",
    next_decision: "Continue, adapt positioning or deprioritize",
  },
  {
    id: "exp_hospitality",
    route: "hospitality_spa",
    hypothesis:
      "A boutique hospitality or spa account may create stronger differentiated fit through retail, gifting or guest experience.",
    target: "Boutique hotel or spa",
    mechanism: "Guest/spa use → inventory consumption → replenishment",
    smallest_test: "50-unit bounded spa retail or gifting pilot",
    evidence_before_action:
      "Operational use, safe copy, buyer area and glass handling",
    client_action: "Choose one use case and validate operational readiness",
    success: "Account accepts a recurring-use test",
    failure: "Only decorative/one-off interest or no safe use",
    learning: "Best hospitality mechanism and buyer",
    next_decision: "Scale route research or narrow use case",
  },
  {
    id: "exp_gifting",
    route: "gifting",
    hypothesis:
      "Customization and premium presentation may support meaningful project orders and seasonal repeat demand.",
    target: "Corporate gifting provider",
    mechanism: "Customized kit project → client campaign → repeat programs",
    smallest_test:
      "One bounded corporate kit proposal using finished product/co-branding",
    evidence_before_action:
      "Customization feasibility, lead time and buyer brief",
    client_action: "Confirm customization menu and project economics",
    success: "Provider includes the offer in a live client brief",
    failure: "Private label required or economics fail",
    learning: "Order size, seasonality and customization value",
    next_decision: "Standardize a gifting offer or deprioritize",
  },
  {
    id: "exp_distribution",
    route: "regional_distribution",
    hypothesis:
      "A selective regional distributor may extend reach only if capacity and channel economics remain manageable.",
    target: "Selective regional distributor",
    mechanism:
      "Portfolio listing → independent-retailer orders → wholesale replenishment",
    smallest_test: "Tier 2 territory-limited validation",
    evidence_before_action: "Opening volume, margin, territory and capacity",
    client_action: "Validate distributor economics before outreach",
    success: "Staged volume and terms fit readiness",
    failure: "Immediate high volume, private label or margin mismatch",
    learning: "Whether the route is premature",
    next_decision: "Proceed selectively or defer",
  },
] as const;
type AccountSpec = {
  name: string;
  domain: string;
  route: string;
  archetype: string;
  source: string;
  fact: string;
  mechanism: string;
  offer: string;
  test: string;
  buyer: string;
  repeat: string;
  risk: string;
  validation: string;
  actionability: "ACT NOW" | "INVESTIGATE NOW" | "PRIORITIZE" | "MONITOR";
  bucket: "work_first" | "priority" | "investigate_monitor";
  baseline: boolean;
  freshness: "fresh" | "current" | "unknown";
  signal: string | null;
};
const specs: AccountSpec[] = [
  {
    name: "Hotel Spa La Colina",
    domain: "hotelspalacolina.com",
    route: "hospitality_spa",
    archetype: "boutique hotel/spa",
    source: "https://hotelspalacolina.com/",
    fact: "Baseline identity and hospitality/spa thesis were previously verified.",
    mechanism: "Spa retail or guest wellness gift tied to a boutique stay",
    offer: "50 ml collection or curated guest/spa kit",
    test: "Approximately 50 mixed units",
    buyer: "general manager or spa/guest-experience manager",
    repeat: "Spa retail or guest-package inventory replenishment",
    risk: "Current retail behavior remains unverified",
    validation: "Verify active spa offer, buyer area, use model and conflict",
    actionability: "PRIORITIZE",
    bucket: "work_first",
    baseline: true,
    freshness: "unknown",
    signal: null,
  },
  {
    name: "Éteka",
    domain: "etekacartagena.com",
    route: "hospitality_spa",
    archetype: "wellness hotel/spa",
    source: "https://etekacartagena.com/hotel-spa-en-cartagena/",
    fact: "Official page describes a Cartagena hotel spa with wellness rituals and was modified 2026-07-05.",
    mechanism: "Spa retail, curated ritual gift or guest wellness add-on",
    offer: "Finished 50 ml products with safe experience copy",
    test: "One 50-unit spa retail or gifting pilot",
    buyer: "spa manager, guest experience or general management",
    repeat: "Ritual-linked retail or guest-package replenishment",
    risk: "No evidence yet of third-party product retail",
    validation:
      "Verify retail behavior, safe copy, glass handling and purchasing",
    actionability: "INVESTIGATE NOW",
    bucket: "work_first",
    baseline: false,
    freshness: "fresh",
    signal: "Current official spa content; not a buying signal",
  },
  {
    name: "Celestino Hotel Boutique & Spa",
    domain: "hotelcelestino.com",
    route: "hospitality_spa",
    archetype: "boutique hotel/spa",
    source: "https://hotelcelestino.com/es/hotel-celestino",
    fact: "Official site describes a Medellín boutique hotel and spa with sauna, jacuzzi and cold plunge.",
    mechanism:
      "Boutique retail or guest gifting adjacent to wellness amenities",
    offer: "Premium three-product collection or single-product guest gift",
    test: "Bounded 50-unit pilot",
    buyer: "general manager, spa or guest-experience manager",
    repeat: "Guest gift and boutique inventory replenishment",
    risk: "No verified product-retail behavior",
    validation: "Verify decision area, use frequency and procurement",
    actionability: "INVESTIGATE NOW",
    bucket: "work_first",
    baseline: false,
    freshness: "current",
    signal: null,
  },
  {
    name: "Natural + Mente",
    domain: "naturalmente.com.co",
    route: "specialty_retail",
    archetype: "wellness retailer",
    source: "https://naturalmente.com.co/",
    fact: "Baseline Colombian wellness-retail identity and structural fit were previously verified.",
    mechanism: "Retail assortment trial followed by sell-through replenishment",
    offer: "Three finished 50 ml botanical concentrates",
    test: "Approximately 50 units",
    buyer: "owner or category buyer",
    repeat: "Retail sell-through reorder",
    risk: "Current comparable assortment and buyer path remain unknown",
    validation: "Verify assortment, pilot openness, economics and conflict",
    actionability: "PRIORITIZE",
    bucket: "work_first",
    baseline: true,
    freshness: "unknown",
    signal: null,
  },
  {
    name: "Sinergy On",
    domain: "sinergyon.com",
    route: "gifting",
    archetype: "corporate gifting provider",
    source: "https://sinergyon.com/",
    fact: "Official site explicitly offers customized corporate and event kits in Bogotá.",
    mechanism:
      "Amor de Gea becomes a premium wellness component in customized corporate kits",
    offer: "Finished bottle or three-product co-branded assortment",
    test: "One live brief or bounded sample kit",
    buyer: "commercial director, gifting buyer or partnerships",
    repeat: "Recurring client campaigns and event programs",
    risk: "Customization economics and private-label expectations unknown",
    validation: "Verify active brief, volumes, co-branding scope and lead time",
    actionability: "INVESTIGATE NOW",
    bucket: "work_first",
    baseline: false,
    freshness: "current",
    signal: null,
  },
  {
    name: "Vitálica",
    domain: "tiendavitalica.com",
    route: "specialty_retail",
    archetype: "natural-products retailer",
    source: "https://www.tiendavitalica.com/",
    fact: "Official active e-commerce describes natural products, vitamins and supplements in Colombia.",
    mechanism:
      "Premium botanical assortment trial with online/retail replenishment",
    offer: "Finished Agua, Tierra and Éter assortment",
    test: "Tier 1 pilot around 50 units",
    buyer: "category buyer, owner or purchasing",
    repeat: "Sell-through-based reorder",
    risk: "Supplement-heavy assortment may not accept the differentiated format",
    validation: "Verify comparable liquids, category openness and onboarding",
    actionability: "PRIORITIZE",
    bucket: "priority",
    baseline: false,
    freshness: "current",
    signal: null,
  },
  {
    name: "Ser Saludable",
    domain: "tiendasersaludable.com",
    route: "specialty_retail",
    archetype: "natural-products retailer",
    source: "https://tiendasersaludable.com/",
    fact: "Official store describes natural medicine, vitamins, sports nutrition and wellness products.",
    mechanism:
      "Direct retail pilot with repeat replenishment if consumer fit appears",
    offer: "Three finished 50 ml products",
    test: "Approximately 50 units",
    buyer: "owner, category or purchasing",
    repeat: "Retail sell-through reorder",
    risk: "Regulated-health positioning may create claim requirements",
    validation:
      "Verify assortment, buyer path and non-medical positioning acceptance",
    actionability: "PRIORITIZE",
    bucket: "priority",
    baseline: false,
    freshness: "current",
    signal: null,
  },
  {
    name: "BioPlaza",
    domain: "bioplaza.org",
    route: "specialty_retail",
    archetype: "established natural/wellness retailer",
    source: "https://bioplaza.org/",
    fact: "Baseline Colombian natural-retail identity and category adjacency were previously verified.",
    mechanism: "Finished-product assortment pilot through established retail",
    offer: "Premium botanical retail collection",
    test: "Tier 1–2 pilot subject to onboarding",
    buyer: "category buyer or purchasing",
    repeat: "Multi-store or e-commerce replenishment",
    risk: "Procurement complexity, competition and scale",
    validation: "Verify onboarding, category gap, economics and capacity",
    actionability: "PRIORITIZE",
    bucket: "priority",
    baseline: true,
    freshness: "unknown",
    signal: null,
  },
  {
    name: "Masaya Collection",
    domain: "masaya-experience.com",
    route: "hospitality_spa",
    archetype: "boutique hospitality collection",
    source: "https://www.masaya-experience.com/collection/",
    fact: "Official page describes Colombian boutique stays centered on sophistication, wellness and connection; modified 2026-07-21.",
    mechanism: "Curated guest gift, boutique resale or experiential alliance",
    offer: "Premium collection or co-branded guest kit",
    test: "One property-level 50-unit test",
    buyer: "guest experience, partnerships, general management or purchasing",
    repeat: "Property guest inventory or seasonal experience replenishment",
    risk: "Decision centralization and product-retail behavior unknown",
    validation: "Verify property-level authority, use case and conflict",
    actionability: "PRIORITIZE",
    bucket: "priority",
    baseline: false,
    freshness: "fresh",
    signal: "Current official collection content; not procurement timing",
  },
  {
    name: "Hotel Charleston Santa Teresa Spa",
    domain: "hotelcharlestonsantateresa.com",
    route: "hospitality_spa",
    archetype: "luxury hotel spa",
    source: "https://www.hotelcharlestonsantateresa.com/es/santa-teresa-spa",
    fact: "Official page describes massages, facials and wellness rituals at its Cartagena spa.",
    mechanism: "Premium spa retail or curated wellness gift",
    offer: "50 ml finished product aligned to a specific safe ritual",
    test: "Bounded spa retail evaluation",
    buyer: "spa manager, wellness lead or purchasing",
    repeat: "Spa retail or guest gifting replenishment",
    risk: "Luxury-hotel procurement may be complex",
    validation:
      "Verify third-party retail, buyer route, onboarding and safe claims",
    actionability: "PRIORITIZE",
    bucket: "priority",
    baseline: false,
    freshness: "current",
    signal: null,
  },
  {
    name: "Tu Tienda Saludable",
    domain: "tutiendasaludable.com",
    route: "specialty_retail",
    archetype: "wellness retailer",
    source: "https://tutiendasaludable.com/",
    fact: "Baseline retail identity and direct use-case compatibility were previously verified.",
    mechanism: "Small retail trial followed by repeat purchasing",
    offer: "Finished 50 ml assortment",
    test: "Approximately 50 units",
    buyer: "owner or purchasing lead",
    repeat: "Sell-through reorder",
    risk: "Evidence depth and commercial differentiation",
    validation: "Verify active assortment, buyer access and economics",
    actionability: "PRIORITIZE",
    bucket: "priority",
    baseline: true,
    freshness: "unknown",
    signal: null,
  },
  {
    name: "Funat",
    domain: "funat.co",
    route: "specialty_retail",
    archetype: "natural-products retailer/brand",
    source: "https://funat.co/",
    fact: "Official store offers natural products and explicitly lists teas/infusions; page modified 2026-06-11.",
    mechanism:
      "Adjacent botanical category listing through existing natural-product commerce",
    offer: "Differentiated premium liquid concentrates",
    test: "Small category test only if third-party brands are accepted",
    buyer: "category or commercial management",
    repeat: "Retail sell-through",
    risk: "Potential competition/private-brand bias and more complex onboarding",
    validation: "Verify third-party assortment, cannibalization and buyer path",
    actionability: "MONITOR",
    bucket: "investigate_monitor",
    baseline: false,
    freshness: "fresh",
    signal: "Official store remained current in 2026; not buying intent",
  },
  {
    name: "Habibi Plantitas",
    domain: "habibiplantitas.com",
    route: "gifting",
    archetype: "corporate gifting provider",
    source: "https://www.habibiplantitas.com/pages/regalos-corporativos",
    fact: "Official page offers personalized corporate gifts across Colombia, including plants, candles and bonsai.",
    mechanism:
      "Add a premium wellness product to personalized corporate gifting",
    offer: "Finished bottle or co-branded three-item kit",
    test: "One bounded corporate-gift concept",
    buyer: "corporate gifting or commercial team",
    repeat: "Client appreciation and seasonal campaigns",
    risk: "Product-category fit beyond home/lifestyle gifts is unproven",
    validation: "Verify kit openness, volumes, lead time and economics",
    actionability: "INVESTIGATE NOW",
    bucket: "investigate_monitor",
    baseline: false,
    freshness: "current",
    signal: null,
  },
  {
    name: "Distribuidora DAM",
    domain: "distribuidoradam.com",
    route: "regional_distribution",
    archetype: "regional distributor",
    source: "https://distribuidoradam.com/",
    fact: "Baseline distributor identity and route thesis were previously verified.",
    mechanism:
      "Selective finished-product representation with staged regional scale",
    offer: "Tier 2 recurring wholesale assortment",
    test: "Economics and territory validation before any product test",
    buyer: "portfolio/category manager or commercial director",
    repeat: "Wholesale replenishment",
    risk: "Capacity, margin, opening volume and channel requirements unresolved",
    validation: "Validate economics, territory, volume, capacity and conflict",
    actionability: "MONITOR",
    bucket: "investigate_monitor",
    baseline: true,
    freshness: "unknown",
    signal: null,
  },
  {
    name: "Somos Consiente",
    domain: "somosconsiente.com",
    route: "gifting",
    archetype: "wellness collaboration brand",
    source: "https://somosconsiente.com/",
    fact: "Baseline brand-alignment and collaboration thesis were previously verified.",
    mechanism: "Experiential alliance, curated gifting or co-branding",
    offer: "Finished product within a bounded collaboration",
    test: "One small event or gifting experiment",
    buyer: "founder, partnerships or commercial lead",
    repeat: "Recurring events or curated programs",
    risk: "Repeatable purchasing model is unclear",
    validation: "Verify active model, order logic, buyer and conflict",
    actionability: "MONITOR",
    bucket: "investigate_monitor",
    baseline: true,
    freshness: "unknown",
    signal: null,
  },
];
const evidence = (a: AccountSpec) => ({
  facts: [
    {
      claim: a.fact,
      source_url: a.source,
      source_type: "official_or_prior_verified",
      source_date: a.freshness === "fresh" ? "2026" : null,
      retrieved_at: retrieved,
      freshness: a.freshness,
      confidence: a.baseline ? "moderate" : "strong",
    },
  ],
  signals: a.signal
    ? [
        {
          claim: a.signal,
          source_url: a.source,
          timing_impact: "none_without_procurement_evidence",
        },
      ]
    : [],
  inferences: [
    {
      claim: a.mechanism,
      confidence: "moderate",
      support: "Accepted context plus verified account type",
    },
  ],
  counterevidence: [
    { claim: a.risk, source: "comparative analysis / missing evidence" },
  ],
  uncertainties: [a.risk],
  validation_needs: [a.validation],
});
export const AMOR_PHASE4_PORTFOLIO = specs.map((a, index) => ({
  portfolio_id: `p4_${index + 1}`,
  identity: {
    commercial_name: a.name,
    normalized_name: a.name.toLowerCase(),
    official_domain: a.domain,
    official_profile: a.source,
    geography: "Colombia",
    identity_state: "resolved",
    activity_state:
      a.freshness === "unknown"
        ? "previously_verified"
        : "active_official_site",
  },
  route: a.route,
  archetype: a.archetype,
  baseline: a.baseline,
  opportunity_mechanism: {
    offer: a.offer,
    use: a.mechanism,
    likely_buying_function: a.buyer,
    initial_test: a.test,
    why_yes:
      "Brand/use-case alignment and bounded test compatible with accepted context",
    rejection: a.risk,
    repeat_purchase: a.repeat,
    validate_before_action: a.validation,
    strengthen: "A bounded test is accepted and produces a repeat discussion",
    invalidate:
      "No viable use case, hard procurement mismatch or context constraint",
  },
  evidence: evidence(a),
  qualification: {
    dimensions: blueprint.prioritization.dimensions.map((d) => ({
      dimension: d,
      state:
        d === "evidence_strength" && a.freshness === "unknown"
          ? "moderate"
          : d === "procurement_complexity" &&
              a.route === "regional_distribution"
            ? "weak"
            : "moderate",
      reason: `Assessed from ${a.route} mechanism and accepted context`,
      implication: "Human validation required before action",
    })),
    hard_blocker: false,
  },
  buyer_entry: {
    function: a.buyer,
    centralization:
      a.route === "specialty_retail"
        ? "unknown"
        : a.route === "hospitality_spa"
          ? "property_or_central_unknown"
          : "unknown",
    entry_path: "Official business channel followed by role verification",
    procurement_burden:
      a.route === "regional_distribution" ? "high" : "moderate",
    official_channel: true,
    conflict_check: "required",
  },
  timing: {
    state: "no timing evidence",
    reason: "No genuine current procurement or buying signal was found.",
  },
  actionability: a.actionability,
  actionability_reason:
    a.actionability === "MONITOR"
      ? "Material route/procurement uncertainty remains."
      : "Strong relative structural fit; complete named validation before outreach.",
  bucket: a.bucket,
  review_state: a.baseline ? "needs client conflict check" : "needs evidence",
  internal_only: true,
  customer_safe: false,
}));
export const AMOR_PHASE4_DEEP_RESEARCH = AMOR_PHASE4_PORTFOLIO.filter(
  (x) => x.bucket !== "investigate_monitor",
)
  .slice(0, 10)
  .concat(
    AMOR_PHASE4_PORTFOLIO.filter((x) =>
      ["Funat", "Habibi Plantitas"].includes(x.identity.commercial_name),
    ),
  )
  .slice(0, 12);
const rawDomains = Array.from(
  new Set(
    checkpoint.queries.flatMap((q) =>
      q.candidates.map((c) => {
        try {
          return new URL(c.url).hostname.replace(/^www\./, "");
        } catch {
          return c.url;
        }
      }),
    ),
  ),
);
const portfolioDomains = new Set(specs.map((x) => x.domain));
const qualifiedExtra = new Set([
  "diferentidea.com",
  "hotelvisus.com",
  "molinatural.com",
]);
const verifiedExtra = new Set([
  "hebevital.com.co",
  "markmelo.com",
  "promoactual.com",
  "beasoluciones.co",
  "colombiaregala.com",
  "tiendaspavivir.co",
]);
export const AMOR_PHASE4_CANDIDATE_UNIVERSE = rawDomains.map((domain) => ({
  domain,
  baseline: [
    "bioplaza.org",
    "distribuidoradam.com",
    "naturalmente.com.co",
    "tutiendasaludable.com",
    "hotelspalacolina.com",
    "somosconsiente.com",
  ].includes(domain),
  qualification_state: portfolioDomains.has(domain)
    ? "qualified_portfolio"
    : qualifiedExtra.has(domain)
      ? "qualified_hold"
      : verifiedExtra.has(domain)
        ? "identity_verified_hold"
        : "excluded",
  exclusion_reason:
    portfolioDomains.has(domain) ||
    qualifiedExtra.has(domain) ||
    verifiedExtra.has(domain)
      ? null
      : /instagram|facebook|wikipedia|dictionary|thesaurus|tripadvisor|trivago|getyourguide|spahotelsguide/.test(
            domain,
          )
        ? "directory/social/informational source only"
        : "No sufficiently specific approved-route opportunity mechanism or identity evidence",
  conflict_check: "required",
  query_provenance: checkpoint.queries
    .filter((q) =>
      q.candidates.some((c) => {
        try {
          return new URL(c.url).hostname.replace(/^www\./, "") === domain;
        } catch {
          return false;
        }
      }),
    )
    .map((q) => q.query_id),
}));
export const AMOR_PHASE4_FUNNEL = {
  raw: AMOR_PHASE4_RUN.raw_candidates,
  deduplicated: AMOR_PHASE4_RUN.deduplicated_domains,
  identity_verified: 24,
  qualified: 18,
  excluded: 38,
  deep_research: AMOR_PHASE4_DEEP_RESEARCH.length,
  portfolio: AMOR_PHASE4_PORTFOLIO.length,
  action_brief_candidates: 5,
} as const;
export const AMOR_ACTION_BRIEF_CANDIDATES = AMOR_PHASE4_PORTFOLIO.filter((x) =>
  [
    "Hotel Spa La Colina",
    "Éteka",
    "Celestino Hotel Boutique & Spa",
    "Natural + Mente",
    "Sinergy On",
  ].includes(x.identity.commercial_name),
).map((x) => ({
  account: x.identity.commercial_name,
  why: x.actionability_reason,
  mechanism: x.opportunity_mechanism,
  decision_area: x.buyer_entry.function,
  entry_hypothesis: x.opportunity_mechanism.use,
  suggested_offer: x.opportunity_mechanism.offer,
  meeting_questions: [
    `Is ${x.opportunity_mechanism.initial_test} operationally viable?`,
    `Who owns this decision and supplier approval?`,
    `What would make replenishment realistic?`,
  ],
  likely_objections: [x.evidence.counterevidence[0].claim],
  counterevidence: x.evidence.counterevidence,
  unknowns: x.evidence.uncertainties,
  documents: [
    "Verified regulatory/support documents relevant to the account",
    "Account-specific economics and logistics",
  ],
  next_action:
    "Human reviewer resolves validation and conflict check before any outreach",
  timing: x.timing,
  confidence: "moderate",
  customer_safe: false,
}));
const learning = (route: string, questions: string[]) =>
  questions.map((question, index) => ({
    id: `learn_${route}_${index + 1}`,
    route,
    question,
    evidence_needed: "Client action plus documented account response/outcome",
    client_action: "Run only an approved bounded account test",
    success_observation:
      "Explicit positive response or completed test consistent with the hypothesis",
    failure_observation:
      "Explicit rejection, non-response after approved process, or operational/economic mismatch",
    resulting_decision:
      "Maintain, adapt, deprioritize or stop the route based on observed outcomes",
    answered: false,
  }));
export const AMOR_LEARNING_AGENDA = [
  ...learning("retail", [
    "Will retailers test approximately 50 units?",
    "Which positioning creates interest?",
    "Does 50 ml fit shelf expectations?",
    "What replenishment cadence is plausible?",
    "What objections appear?",
  ]),
  ...learning("hospitality_spa", [
    "Is retail, guest gifting or experience integration strongest?",
    "Who owns purchasing?",
    "Is the format operationally compatible?",
    "Can demand repeat?",
  ]),
  ...learning("gifting", [
    "Does customization increase willingness to buy?",
    "What order size is realistic?",
    "Is demand seasonal or recurring?",
    "What lead time is required?",
  ]),
  ...learning("regional_distribution", [
    "What minimum capacity is required?",
    "Which channel economics matter?",
    "What portfolio requirements exist?",
    "Is the route premature?",
  ]),
] as const;
export const AMOR_HUMAN_REVIEW_QUEUE = AMOR_PHASE4_PORTFOLIO.map((x) => ({
  account: x.identity.commercial_name,
  route: x.route,
  opportunity_mechanism: x.opportunity_mechanism.use,
  actionability: x.actionability,
  evidence_quality:
    x.identity.activity_state === "active_official_site"
      ? "official_current"
      : "prior_verified",
  counterevidence: x.evidence.counterevidence[0].claim,
  uncertainty: x.evidence.uncertainties[0],
  conflict_check: "required",
  reviewer_decision: x.review_state,
  reviewer_note: "",
  allowed_states: [
    "approve",
    "revise",
    "reject",
    "needs evidence",
    "needs identity resolution",
    "needs client conflict check",
  ],
}));
export const AMOR_WHAT_CHANGED_V3 = {
  state: "internal_pending_human_review",
  retained: specs.filter((x) => x.baseline).map((x) => x.name),
  raised: ["Hotel Spa La Colina"],
  lowered: ["Distribuidora DAM"],
  removed: [],
  new_accounts: specs.filter((x) => !x.baseline).map((x) => x.name),
  routes_strengthened: ["hospitality_spa", "specialty_retail", "gifting"],
  routes_weakened: ["regional_distribution"],
  new_mechanisms: [
    "spa ritual-linked retail",
    "guest wellness gifting",
    "corporate wellness kit component",
  ],
  evidence_improvements:
    "Current official pages support nine new identities and route relevance.",
  unresolved_gaps: [
    "No buying timing",
    "Conflict checks pending",
    "Economics/capacity validation",
    "No observed outcomes",
  ],
  supported_hypotheses: [
    "Hospitality offers differentiated structural fit",
    "Independent retail remains testable",
    "Gifting has explicit customization channels",
  ],
  weakened_hypotheses: [
    "Broad generic concept-store query quality",
    "Regional distribution discovery quality",
  ],
  changed_preparation:
    "Prepare account-specific use case, buyer area, safe copy, economics and logistics before action.",
  changed_learning: "Test repeat mechanism, not just initial interest.",
} as const;
export const AMOR_PHASE4_ACCOUNTING = {
  original_tavily_calls: 15,
  recovery_tavily_calls: checkpoint.recovery.calls,
  total_historical_tavily_calls: 15 + checkpoint.recovery.calls,
  provider_errors: checkpoint.recovery.provider_errors,
  exact_provider_cost: "Exact provider cost unavailable.",
  automated_search_elapsed_ms: checkpoint.queries.reduce(
    (n, q) => n + (q.latency_ms ?? 0),
    0,
  ),
  manual_review_time: "Not instrumented separately; unavailable",
  identity_resolution_time: "Not instrumented separately; unavailable",
  deep_research_time: "Not instrumented separately; unavailable",
  total_phase_time: "Not reliably measured across interrupted sessions",
  candidates_per_query: AMOR_PHASE4_RUN.raw_candidates / 15,
  qualified_per_query: AMOR_PHASE4_FUNNEL.qualified / 15,
  qualified_per_provider: { tavily: AMOR_PHASE4_FUNNEL.qualified },
  cost_per_qualified_account: null,
  time_per_deep_research_account: null,
  time_per_portfolio_account: null,
} as const;
export const AMOR_PRELIMINARY_STRUCTURAL_CONCLUSIONS = {
  state: "internal_pre_outcome",
  conclusions: [
    "Boutique hospitality/spa is the strongest differentiated structural hypothesis, not a validated segment.",
    "Independent retail appears easier to test but may face assortment competition and onboarding.",
    "Gifting has explicit customization mechanisms but seasonality and economics remain open.",
    "Regional distribution is most conditioned and should remain exploratory.",
  ],
  allocation_recommendation: null,
  outcomes_observed: 0,
};
