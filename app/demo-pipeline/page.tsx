"use client";

import { useState, useRef, useEffect, useId } from "react";
import type { LeadLensReport, ProcessedLead, PlanType, QCStatus, OutputLanguage, MarketRegion } from "@/types";
import { safeConversionPayload, type ConversionEvent, type ConversionMetadata } from "@/lib/analytics/conversion-events";

// ─── Localization dictionary ──────────────────────────────────────────────────

const COPY = {
  en: {
    announcement: "Account Opportunity Intelligence for B2B — know which accounts to work now, and why.",
    announcementCTA: "Get your Opportunity Preview →",
    navPricing: "Pricing",
    navSignIn: "Sign in",
    navCTA: "Get started",
    navHow: "How it works",
    navSample: "Sample",
    navFaq: "FAQ",
    heroCuriosity: "What changed in the accounts you're already watching?",
    heroBadge: "Account Opportunity Intelligence · B2B",
    heroH1pre: "Find the B2B accounts",
    heroH1hi: "worth working now",
    heroH1post: ".",
    heroH2: "And the evidence behind every opportunity.",
    heroSub: "LeadLens tells you which accounts fit, why they matter now, and the public evidence behind each opportunity — account-level intelligence, not a contact list.",
    heroCTA: "Get started",
    heroPriceNote: "From $7 · one-time · no card to explore the sample",
    heroSeeAll: "View sample",
    heroNote: "No contact databases. No email lists. Just commercial intelligence.",
    proofLabels: [["5","account briefs"],["6–8","buyer segments"],["24–48h","delivery"],["Evidence","+ counterevidence"]] as [string,string][],
    howTag: "How it works",
    howTitle: "ICP (Ideal Customer Profile) in. Commercial intelligence out.",
    steps: [
      ["1","Describe your ICP","Tell us what you sell, who you sell to, and what makes a great customer. Takes 5 minutes."],
      ["2","We map your market","LeadLens identifies 6–8 buyer segments — including ones you haven't considered. Then finds real companies in each."],
      ["3","We detect signals","Our system reads public data: job postings, funding news, expansions, leadership changes. We find companies showing active signals now."],
      ["4","You get ranked briefs","5 Opportunity Briefs — ranked by score. Each one explains why this company, why now, and how to approach them."],
    ] as [string,string,string][],
    pricingTag: "Pricing",
    pricingTitle: "Buy a decision, not a list.",
    pricingSub: "Four one-time products: validate the quality, select accounts, prioritize the portfolio, or build the strategy.",
    oneBatch: "One-time payment",
    monthlyTag: "Coming soon — Pilot access",
    monthlyTitle: "Opportunity Monitor",
    monthlySub: "Monthly refreshed opportunities, signal updates, weekly opportunity digest, and recurring briefs — for teams that need continuous market intelligence.",
    monitorCTA: "Join pilot waitlist",
    monitorPrice: "From $99/mo",
    planNames: { sample: "Preview", starter: "Brief", standard: "Intelligence", pro: "Premium" },
    planDescs: {
      sample:   "See whether LeadLens can find defensible opportunities for your business — validate the quality before committing.",
      starter:  "Get a focused set of accounts worth investigating now, compared and ranked.",
      standard: "Know which accounts deserve priority and how to allocate your commercial effort.",
      pro:      "Turn opportunity intelligence into a focused commercial strategy.",
    },
    planFor: {
      sample:   "For teams who want proof before spending real budget.",
      starter:  "For teams who need a short, defensible list to act on this week.",
      standard: "For B2B teams deciding where to concentrate limited commercial effort.",
      pro:      "For teams turning a prioritized portfolio into an account strategy.",
    },
    planDiff: {
      sample:   "Validates: is this worth it for my ICP?",
      starter:  "Adds selection: a compared set with initial ranking and statuses.",
      standard: "Adds prioritization: full portfolio ranking, allocation and risk.",
      pro:      "Adds strategy: deeper corroboration and strategic sequencing on priority accounts.",
    },
    planBadges: { sample: "Low-risk starting point", starter: "Focused opportunity set", standard: "Recommended · Best for focused B2B growth", pro: "Early access · Guided pilot only" },
    planFeatures: {
      sample:   ["1 ICP · 1 region","2 complete opportunities","What Changed + event dates + sources","Evidence quality, Why Now, fit & timing","Risks, what to validate, next action","ICP verdict: proceed / refine / stop"],
      starter:  ["Everything in Preview","1 ICP · 1 region","6 complete opportunities","Initial ranking + statuses (Act now / Investigate / Monitor)","Fit × Timing comparison","Key risks + recommended sequence","Executive Opportunity Brief"],
      standard: ["Everything in Brief","1 ICP · up to 2 regions","12 complete opportunities","Complete portfolio ranking + allocation","Portfolio risk + coverage gaps","Evidence center with explained ranking","Next best investigation & action","Executive Intelligence Brief"],
      pro:      ["Everything in Intelligence","Up to 2 ICPs · up to 3 regions","18 complete opportunities","Reinforced corroboration on priority accounts","Systematic counterevidence","Deeper clusters + market patterns","Strategic sequence + revalidation dates","Strategic Executive Brief"],
    },
    planCTAs: { sample: "Get started", starter: "Get started", standard: "Get started", pro: "Get started" },
    launchNote: "Founding launch pricing — these are early-access prices while LeadLens is in its first customer cohort.",
    compareTitle: "Compare plans",
    leadsFoundBy: (n: number) => `${n} opportunities found by LeadLens`,
    getStarted: "Start Opportunity Portfolio →",
    mostPopular: "Recommended",
    formTag: "Start your Opportunity Portfolio",
    formTitle: "Tell LeadLens about your business",
    formSub: "The more context you give, the better the opportunities and outreach strategy we can find for you.",
    step1: "1. Select plan",
    step2: "2. Describe your business",
    useSampleData: "Use sample data",
    fCompanyName: "Company name",
    fCompanyDesc: "What does your company do?",
    fOffer: "Your offer",
    fValue: "Your main value proposition",
    fCustomer: "Ideal customer description",
    fTicket: "Average deal size (optional)",
    fTone: "Message tone",
    fRegion: "Target market",
    fEmail: "Your email",
    toneDirect: "Direct — straight to the point, no fluff",
    toneConsultative: "Consultative — curious, asks questions",
    toneCasual: "Casual — conversational, warm",
    regionNA: "North America",
    regionLA: "Latin America",
    regionEU: "Europe",
    regionAS: "Asia",
    regionGL: "Global",
    submitBtn: (n: number) => `Get my ${n} opportunity briefs →`,
    backBtn: "← Back",
    processingTitle: "Building your Opportunity Portfolio…",
    processingNote: "Production: 24–48h. Preview: ~10 seconds.",
    processingStatus: "LeadLens is mapping your market and detecting signals.",
    agents: [
      "ICP Analysis — understanding your ideal customer profile",
      "Market Mapping — identifying 6–8 buyer segments",
      "Account Discovery — finding companies per segment",
      "Signal Detection — reading job postings, news, funding, expansions",
      "Opportunity Scoring — ranking accounts by fit and timing",
      "Brief Generation — writing context and strategy per account",
      "Outreach Writing — email, LinkedIn DM, cold call opener",
    ],
    reportReady: "Opportunity Portfolio ready",
    reportTitle: "Your Opportunity Portfolio",
    dlCSV: (n: number) => `⬇ Download CSV (${n} companies)`,
    dlMD: "⬇ Download Markdown",
    newRun: "← New run",
    statTotal: "Companies",
    statAvg: "Avg score",
    execSummary: "Market Overview",
    patternsObserved: "Patterns Found",
    recommendations: "Recommended Next Steps",
    leadBreakdown: "Opportunity Briefs",
    showingOf: (shown: number, total: number) => `Showing top ${shown} of ${total} opportunities. Export includes all.`,
    moreInExport: (n: number) => `+ ${n} more companies in the full export`,
    dlAll: (n: number) => `⬇ Download all ${n} companies as CSV`,
    mCompanySize: "Company size",
    mEmailStatus: "Signal quality",
    mConfidence: "Confidence",
    mSource: "Source",
    mLocation: "Location",
    mSourceUrl: "Source URL",
    mLinkedin: "Company page",
    sCompanyContext: "Company context",
    sTimingSignals: "Timing signals",
    sWhyFit: "Why good fit",
    sFlags: "Flags",
    sDataGaps: "Data gaps",
    sPersonalization: "Personalization trigger",
    sInitialEmail: "Outreach draft",
    sSubject: "Subject",
    sBody: "Body",
    sFullSequence: "Full outreach sequence",
    sLinkedinDM: "LinkedIn message",
    sFollowup1: "Follow-up 1 (day 3–4)",
    sFollowup2: "Follow-up 2 (day 7–8)",
    sQcNotes: "QC notes",
    sScoreBreakdown: "Score detail",
    sWhyNow: "Why now",
    sEvidenceDiscipline: "Evidence quality",
    sIntelligenceNotes: "Quality checks",
    sLearningMeta: "Learning signals",
    footerCopy: "© 2026 LeadLens AI — B2B Commercial Intelligence. We analyze public signals, not personal data.",
    footerLinks: ["Privacy", "Terms", "Refund Policy", "Contact"],
    footerContact: "Questions? Email us: martinfgaleano@gmail.com",
    expectationsTag: "What to expect",
    expectationsTitle: "Honest about what we deliver",
    expectationsItems: [
      "You receive an Opportunity Portfolio — not a contact database. We identify companies and signals, not personal contact lists.",
      "Outreach assets are drafts. You review and decide what to send, when, and to whom.",
      "Every signal is sourced from publicly available data. We cite sources in each brief.",
      "Typical delivery: 24–48 hours after you submit your ICP form.",
      "Nothing is sent automatically. You stay in full control.",
      "If the opportunities consistently miss your ICP, we'll work with you to resolve it or refund within 7 days.",
    ],
    tryDemoCTA: "Preview sample report",
    checkoutPendingTitle: "Online checkout is almost ready.",
    checkoutPendingBody: "Our checkout is currently in final review. Opportunity Portfolios are not yet available for purchase.",
    checkoutPendingDemoHint: "You can still preview the sample report format below.",
    switchToDemo: "Preview sample report format →",
    sampleBadge: "Sample report preview",
    sampleNote: "This preview uses sample data to show the format of a real Opportunity Portfolio. For a real Opportunity Portfolio with researched companies and verified signals, purchase an Opportunity Portfolio.",
    problemTag: "The challenge",
    problemTitle: "Your team has access to more signals than ever. The hard part is knowing which opportunities deserve attention first — and why now.",
    problemItems: [
      "Market data, job postings, funding news, LinkedIn activity — signals are everywhere. But they don't come pre-ranked for your ICP.",
      "Every week your team researches companies that turn out to be the wrong fit, the wrong timing, or already committed to another vendor.",
      "Generic outreach gets ignored because it isn't grounded in what's actually happening at that company right now.",
      "The gap isn't information — it's the analysis layer that turns scattered signals into a prioritized list of accounts worth calling.",
      "That's what LeadLens builds: a prioritized commercial brief, grounded in evidence, delivered before the first conversation.",
    ],
    receiveTag: "What you get",
    receiveTitle: "Every account comes with a decision — not just a name.",
    receiveItems: [
      ["Opportunity Portfolio", "Your accounts prioritized by decision — Prioritize, Validate, Monitor or Hold — not a single blended score."],
      ["What Changed", "The recent, dated public change behind each account — hiring, expansion, funding, leadership — with sources."],
      ["Fit · Timing · Evidence", "Each assessed separately (Strong / Moderate / Limited), so structural fit is never confused with timing."],
      ["Evidence & Counterevidence", "The sources and freshness behind the thesis — and what weakens it. Uncertainty is shown, not hidden."],
      ["What to Validate", "The specific checks to run before you act — decision scope, procurement, category fit."],
      ["Next Commercial Decision", "A clear next step per account, with optional outreach context — you decide what to send."],
    ] as [string, string][],
    samplePreviewTag: "Sample output",
    samplePreviewTitle: "This is what an Account Brief looks like",
    samplePreviewSub: "Every account comes with a full Account Brief — what changed, why it fits, why the timing may matter, the evidence and counterevidence, and what to validate before you act.",
    faqTag: "FAQ",
    faqTitle: "Common questions",
    faqs: [
      ["What exactly do I get?", "A prioritized Opportunity Portfolio of accounts for your ICP — each with an Account Brief: what changed, why it fits, why the timing may matter, the evidence and counterevidence, and what to validate before you act. Delivered as PDF + CSV in 24–48h."],
      ["How is this different from Apollo or ZoomInfo?", "Apollo and ZoomInfo are contact databases — you filter and export records. LeadLens gives you commercial intelligence: which companies are showing signals for your specific offer right now, why they're a good opportunity, and how to approach them. You don't get a list — you get criterion and context."],
      ["How is this different from Clay?", "Clay is infrastructure — a powerful platform for building enrichment workflows. LeadLens is opinionated: you describe your ICP, we do the research and deliver a prioritized brief. No setup, no workflows, no technical knowledge required."],
      ["Do you sell email lists or contact databases?", "No. LeadLens analyzes publicly available commercial information about companies. We do not sell email lists, phone databases, or personal contact records."],
      ["How long does delivery take?", "Typically 24–48 hours after you submit your ICP form. Every Opportunity Portfolio is reviewed before delivery."],
      ["What if the opportunities don't match my ICP?", "If we consistently miss your ICP and can't resolve it, you're eligible for a refund within 7 days. See our refund policy."],
      ["Is there a subscription or contract?", "No. One-time payment per Opportunity Portfolio. No recurring charges, no commitments, no hidden fees."],
      ["What happens after I purchase?", "You submit your ICP form (5 minutes). We research your market, detect signals, score accounts, and deliver your Opportunity Portfolio via email in 24–48h."],
      ["Does the preview use real data?", "No. The free preview shows the format and structure of a real Opportunity Portfolio using sample data. For a real Opportunity Portfolio with researched companies and verified signals, purchase an Opportunity Portfolio."],
    ] as [string, string][],
    ctaTag: "Get started",
    ctaTitle: "Know which accounts to call this week.",
    ctaSub: "One prioritized Opportunity Portfolio. 24–48h delivery. Real accounts, dated evidence, a decision you can defend.",
    ctaCTA: "Get your first Opportunity Preview — from $7 →",
    sampleTabs: ["Email", "LinkedIn DM", "Follow-up 1", "Follow-up 2"],
    pricePerLead: { sample: "One-time payment", starter: "One-time payment", standard: "One-time payment", pro: "One-time payment" },
    samplePackTitle: "Not ready to commit?",
    samplePackCopy: "Preview the sample report format first — free, no payment required.",
    samplePackBadge: "Free preview",
    samplePackCTA: "Preview sample report →",
    samplePackBridge: "Want the real thing? An Opportunity Portfolio delivers 5 researched company briefs with signals and outreach strategy.",
    sampleBridgeFreeDemo: "Preview the report format",
    sampleBridgeSamplePack: "Get an Opportunity Report — from $7",
    samplePreviewDisclaimer: "This preview uses sample data to show the report format. Real Opportunity Portfolios include researched companies, verified signals, and scored briefs.",
    trustItems: ["Source-verified signals", "Human-reviewed output", "No contact databases", "7-day refund policy"] as string[],
    afterPurchaseTitle: "After you buy:",
    afterPurchaseSteps: [
      "Submit your ICP — takes 5 minutes.",
      "LeadLens maps your market and identifies target segments.",
      "We detect signals and score each opportunity.",
      "You receive your Opportunity Portfolio in 24–48h.",
    ] as string[],
    afterPurchaseNote: "Typical delivery: 24–48h. Nothing is sent automatically. You review every brief before acting.",
    faqCtaBridge: "Still not sure? Preview the sample report format first — free, no payment required.",
    resultsUpgradeTitle: "Ready for real commercial intelligence?",
    resultsUpgradeSub: "An Opportunity Portfolio delivers 5 company briefs with signals, opportunity scores, and outreach strategy — researched and reviewed by our team in 24–48h.",
    resultsUpgradeCTA: "Get your Opportunity Report — from $7 →",
    checkoutEarlyBanner: "Checkout is in final review. Preview the sample report format while you wait.",
    comparisonTag: "How we compare",
    comparisonTitle: "LeadLens is not a database. It's a decision.",
    comparisonHeaders: ["", "Google", "Apollo / ZoomInfo", "Clay", "LeadLens"] as string[],
    comparisonRows: [
      ["What you get", "Pages and links", "Contact records to filter", "Data infrastructure", "Ranked opportunity briefs"],
      ["Signals", "You find them manually", "Basic intent data", "You build the workflow", "Auto-detected with sources"],
      ["Market mapping", "Manual research", "Industry filters only", "You configure it", "Automatic — 6–8 segments"],
      ["Outreach strategy", "None", "Email templates", "You build it", "Signal-led, per account"],
      ["Setup required", "None", "Learning curve", "Technical configuration", "5-min ICP form"],
    ] as string[][],
    b2cTeaserTag: "Coming soon",
    b2cTeaserTitle: "LeadLens for B2C and local businesses",
    b2cTeaserSub: "Customer acquisition playbooks with channel ideas, conversion tactics, competitor insights, and 30-day action plans — for consumer-facing businesses and local operators.",
    b2cTeaserNote: "B2B only for now. Join the waitlist to be notified when B2C launches.",
    b2cTeaserCTA: "Join B2C waitlist",
    vizTag: "From scattered signals to clear priorities",
    vizTitle: "Visual decision tools, not just data.",
    vizSub: "LeadLens turns public market signals into visual decision tools your team can act on before the first outreach.",
    complianceNote: "LeadLens analyzes publicly available company information and commercial signals. We do not sell contact databases, email lists, or personal data.",
    sFeedbackHook: "Was this opportunity useful?",
    sFeedbackSaved: "Feedback saved — thank you",
    sVaultMemory: "Vault Memory",
    sVaultValidated: "Validated pattern",
    sVaultCaution: "Caution pattern",
    sVaultInsufficient: "Insufficient feedback",
    sVaultPositiveText: "Similar opportunities have received positive feedback before.",
    sVaultNegativeText: "Similar opportunities have previously been marked as weak fit or not useful.",
    sVaultInsufficientText: "LeadLens is still collecting feedback for this segment.",
    sVaultConfidence: "Confidence",
    sVaultMatchedPatterns: "Matched patterns",
    sAccountMemory: "Account Memory",
    sAccountMemoryNew: "New opportunity",
    sAccountMemorySeen: "Seen before",
    sAccountMemoryRepeat: "Repeated — no new signal",
    sAccountMemoryReactivated: "Reactivated — new signal",
    sAccountMemoryUpgraded: "Upgraded",
    sAccountMemoryDowngraded: "Downgraded",
    sAccountMemoryDropped: "Dropped",
    sAccountMemoryTimesSeen: "times seen",
    sAccountMemoryLastCat: "Last",
    sEvidenceQuality: "Evidence Quality",
    sEvidenceHigh: "High",
    sEvidenceMedium: "Medium",
    sEvidenceLow: "Low",
    sEvidenceInsufficient: "Insufficient evidence",
    sEvidenceGuardrail: "Recommendation adjusted due to evidence quality.",
    sSourceLayer: "Sources",
    sSourceContextOnly: "Context only",
    sSourceTimingSignal: "Timing signal",
    sSourceNoDate: "No signal date",
    sSourceFreshLabel: "Freshness",
    sSourceLimitedCoverage: "Limited regional coverage",
    sSourceDiscovered: "Discovered",
  },
  es: {
    announcement: "Account Opportunity Intelligence para B2B — sabe qué cuentas trabajar ahora, y por qué.",
    announcementCTA: "Obtener mi Opportunity Preview →",
    navPricing: "Precios",
    navSignIn: "Iniciar sesión",
    navCTA: "Comenzar",
    navHow: "Cómo funciona",
    navSample: "Muestra",
    navFaq: "FAQ",
    heroCuriosity: "¿Qué cambió en las cuentas que ya observas?",
    heroBadge: "Inteligencia de Oportunidades de Cuenta · B2B",
    heroH1pre: "Encuentra las cuentas B2B",
    heroH1hi: "que vale la pena trabajar ahora",
    heroH1post: ".",
    heroH2: "Y la evidencia detrás de cada oportunidad.",
    heroSub: "LeadLens te dice qué cuentas encajan, por qué importan ahora y la evidencia pública detrás de cada oportunidad — inteligencia a nivel de cuenta, no una lista de contactos.",
    heroCTA: "Comenzar",
    heroPriceNote: "Desde $7 · pago único · sin tarjeta para ver la muestra",
    heroSeeAll: "Ver muestra",
    heroNote: "Sin bases de datos de contactos. Sin listas de emails. Solo inteligencia comercial.",
    proofLabels: [["5","account briefs"],["6–8","segmentos de compradores"],["24–48h","entrega"],["Evidencia","+ contraevidencia"]] as [string,string][],
    howTag: "Cómo funciona",
    howTitle: "ICP (Perfil de Cliente Ideal) adentro. Inteligencia comercial afuera.",
    steps: [
      ["1","Describe tu ICP","Cuéntanos qué vendes, a quién y qué hace un gran cliente. Toma 5 minutos."],
      ["2","Mapeamos tu mercado","LeadLens identifica 6–8 segmentos de compradores, incluidos algunos que quizás no habías considerado. Luego encuentra empresas reales en cada segmento."],
      ["3","Detectamos señales","Nuestro sistema lee datos públicos: ofertas de trabajo, noticias, expansiones, cambios de liderazgo. Identificamos empresas con señales activas ahora mismo."],
      ["4","Recibes briefs priorizados","5 Opportunity Briefs rankeados por score. Cada uno explica por qué esta empresa, por qué ahora y cómo acercarte."],
    ] as [string,string,string][],
    pricingTag: "Precios",
    pricingTitle: "Compra una decisión, no una lista.",
    pricingSub: "Cuatro productos de pago único: valida la calidad, selecciona cuentas, prioriza el portafolio o construye la estrategia.",
    oneBatch: "Pago único",
    monthlyTag: "Próximamente — Acceso piloto",
    monthlyTitle: "Opportunity Monitor",
    monthlySub: "Oportunidades actualizadas mensualmente, señales nuevas, resumen semanal de oportunidades y briefs recurrentes — para equipos que necesitan inteligencia de mercado continua.",
    monitorCTA: "Unirse a la lista piloto",
    monitorPrice: "Desde $99/mes",
    planNames: { sample: "Preview", starter: "Brief", standard: "Intelligence", pro: "Premium" },
    planDescs: {
      sample:   "Ve el formato — sin pago requerido.",
      starter:  "Un diagnóstico pagado que mapea tu mercado y te muestra dónde enfocarte antes de comprometerte con un reporte más profundo.",
      standard: "Un reporte enfocado que convierte un ICP en una lista de empresas rankeadas que vale la pena contactar — con señales, scores y estrategia.",
      pro:      "Un reporte más profundo para negocios que quieren mayor visibilidad de mercado, más oportunidades y una dirección estratégica más sólida.",
    },
    planFeatures: {
      sample:   ["Market Map de muestra","Briefs de empresa de muestra","Sin investigación real — solo formato","Ve el output antes de comprometerte"],
      starter:  ["1 ICP","5–8 segmentos de compradores","Ranking de segmentos","Señales a seguir por segmento","Tipos de oportunidades ejemplo","Primer segmento recomendado","Entrega en PDF"],
      standard: ["1 ICP","Market Map — 6–8 segmentos","10–15 oportunidades rankeadas","Top 5 Opportunity Briefs","Señales públicas con fuentes","Fit × Timing × Evidence por cuenta","Por qué ahora — análisis de timing","Qué validar por cuenta","Contexto de acercamiento opcional","Descarga PDF + CSV","Entrega en 24–48h"],
      pro:      ["1 ICP","Market Map ampliado","20–30 oportunidades rankeadas","Top 10 Opportunity Briefs","Recomendaciones por segmento","Lista de evidencias y fuentes","Secuencia recomendada por cuenta","Análisis de riesgos y debilidades","Descarga PDF + CSV","Entrega en 24–48h"],
    },
    planCTAs: { sample: "Comenzar", starter: "Comenzar", standard: "Comenzar", pro: "Comenzar" },
    planFor: {
      sample:   "Para equipos que quieren prueba antes de invertir presupuesto real.",
      starter:  "Para equipos que necesitan una lista corta y defendible esta semana.",
      standard: "Para equipos B2B decidiendo dónde concentrar su esfuerzo comercial.",
      pro:      "Para equipos que convierten un portafolio priorizado en estrategia de cuentas.",
    },
    planDiff: {
      sample:   "Valida: ¿vale la pena para mi ICP?",
      starter:  "Agrega selección: un set comparado con ranking inicial y estados.",
      standard: "Agrega priorización: ranking completo, asignación y riesgo de portafolio.",
      pro:      "Agrega estrategia: corroboración profunda y secuencia estratégica en cuentas prioritarias.",
    },
    planBadges: { sample: "Punto de entrada de bajo riesgo", starter: "Set enfocado de oportunidades", standard: "Recomendado · Ideal para crecimiento B2B enfocado", pro: "Acceso anticipado · Solo piloto guiado" },
    launchNote: "Precios de lanzamiento (founding pricing) — precios de acceso temprano durante la primera cohorte de clientes.",
    compareTitle: "Comparar planes",
    leadsFoundBy: (n: number) => `${n} oportunidades encontradas por LeadLens`,
    getStarted: "Iniciar Opportunity Portfolio →",
    mostPopular: "Recomendado",
    formTag: "Inicia tu Opportunity Portfolio",
    formTitle: "Cuéntale a LeadLens sobre tu negocio",
    formSub: "Cuanto más contexto des, mejores serán las oportunidades y la estrategia que encontremos para ti.",
    step1: "1. Selecciona tu plan",
    step2: "2. Describe tu negocio",
    useSampleData: "Usar datos de ejemplo",
    fCompanyName: "Nombre de la empresa",
    fCompanyDesc: "¿Qué hace tu empresa?",
    fOffer: "Tu oferta",
    fValue: "Tu propuesta de valor principal",
    fCustomer: "Descripción del cliente ideal",
    fTicket: "Tamaño promedio de negocio (opcional)",
    fTone: "Tono del mensaje",
    fRegion: "Mercado objetivo",
    fEmail: "Tu email",
    toneDirect: "Directo — al grano, sin rodeos",
    toneConsultative: "Consultivo — curioso, hace preguntas",
    toneCasual: "Casual — conversacional, cercano",
    regionNA: "Norteamérica",
    regionLA: "América Latina",
    regionEU: "Europa",
    regionAS: "Asia",
    regionGL: "Global",
    submitBtn: (n: number) => `Obtener mis ${n} briefs de oportunidad →`,
    backBtn: "← Volver",
    processingTitle: "Construyendo tu Opportunity Portfolio…",
    processingNote: "Producción: 24–48h. Vista previa: ~5 segundos.",
    processingStatus: "LeadLens está analizando tu mercado y detectando señales.",
    agents: [
      "Análisis de ICP — entendiendo tu perfil de cliente ideal",
      "Market Mapping — identificando 6–8 segmentos de compradores",
      "Account Discovery — encontrando empresas por segmento",
      "Signal Detection — analizando ofertas de trabajo, noticias, financiamiento y expansiones",
      "Opportunity Scoring — rankeando cuentas por fit y timing",
      "Brief Generation — redactando contexto y estrategia por cuenta",
      "Outreach Writing — email, LinkedIn DM y cold call opener",
    ],
    reportReady: "Opportunity Portfolio listo",
    reportTitle: "Tu Opportunity Portfolio está listo",
    dlCSV: (n: number) => `⬇ Descargar CSV (${n} empresas)`,
    dlMD: "⬇ Descargar Markdown",
    newRun: "← Nuevo análisis",
    statTotal: "Empresas",
    statAvg: "Score prom.",
    execSummary: "Panorama de mercado",
    patternsObserved: "Patrones detectados",
    recommendations: "Próximos pasos",
    leadBreakdown: "Opportunity Briefs",
    showingOf: (shown: number, total: number) => `Mostrando ${shown} de ${total} oportunidades. La exportación incluye las ${total}.`,
    moreInExport: (n: number) => `+ ${n} oportunidades más en tu exportación`,
    dlAll: (n: number) => `⬇ Descargar las ${n} oportunidades como CSV`,
    mCompanySize: "Tamaño de empresa",
    mEmailStatus: "Calidad de señal",
    mConfidence: "Confianza",
    mSource: "Fuente",
    mLocation: "Ubicación",
    mSourceUrl: "URL de fuente",
    mLinkedin: "Página de empresa",
    sCompanyContext: "Contexto de la empresa",
    sTimingSignals: "Señales",
    sWhyFit: "Por qué es una buena oportunidad",
    sFlags: "Alertas",
    sDataGaps: "Datos faltantes",
    sPersonalization: "Ángulo de venta recomendado",
    sInitialEmail: "Borrador de outreach",
    sSubject: "Asunto",
    sBody: "Cuerpo",
    sFullSequence: "Estrategia de outreach completa",
    sLinkedinDM: "LinkedIn message",
    sFollowup1: "Seguimiento 1 (día 3–4)",
    sFollowup2: "Seguimiento 2 (día 7–8)",
    sQcNotes: "Notas de revisión",
    sScoreBreakdown: "Detalle del score",
    sWhyNow: "Por qué ahora",
    sEvidenceDiscipline: "Calidad de evidencia",
    sIntelligenceNotes: "Control de calidad",
    sLearningMeta: "Señales de aprendizaje",
    footerCopy: "© 2026 LeadLens AI — Inteligencia Comercial B2B. Analizamos señales públicas, no datos personales.",
    footerLinks: ["Privacidad", "Términos", "Política de devolución", "Contacto"],
    footerContact: "¿Preguntas? Escríbenos: martinfgaleano@gmail.com",
    expectationsTag: "Qué esperar",
    expectationsTitle: "Honestos sobre lo que entregamos",
    expectationsItems: [
      "Recibes un Opportunity Portfolio — no una base de datos de contactos. Identificamos empresas y señales, no listas de emails.",
      "Los materiales de outreach son borradores. Tú revisas y decides qué enviar, cuándo y a quién.",
      "Cada señal proviene de datos públicamente disponibles. Citamos las fuentes en cada brief.",
      "Entrega típica: 24–48 horas después de que envíes tu formulario de ICP.",
      "Nada se envía automáticamente. Tú mantienes el control total.",
      "Si las oportunidades no coinciden con tu ICP de forma consistente, lo resolvemos o te reembolsamos dentro de 7 días.",
    ],
    tryDemoCTA: "Ver reporte de muestra",
    checkoutPendingTitle: "El checkout online está casi listo.",
    checkoutPendingBody: "Nuestro checkout está en revisión final antes del lanzamiento. Los Opportunity Portfolios aún no están disponibles para compra.",
    checkoutPendingDemoHint: "Mientras tanto, puedes ver el formato del Opportunity Portfolio abajo.",
    switchToDemo: "Ver formato del Opportunity Portfolio de muestra →",
    sampleBadge: "Vista previa del Opportunity Portfolio",
    sampleNote: "Este reporte usa datos de ejemplo para mostrar el formato. Para un Opportunity Portfolio real con señales verificadas, compra un Opportunity Portfolio.",
    problemTag: "El desafío",
    problemTitle: "Tu equipo tiene acceso a más señales que nunca. Lo difícil es saber qué oportunidades merecen atención primero — y por qué ahora.",
    problemItems: [
      "Datos de mercado, ofertas de trabajo, noticias de financiamiento, actividad en LinkedIn — las señales están en todos lados. Pero no vienen rankeadas para tu ICP.",
      "Cada semana tu equipo investiga empresas que resultan no ser el fit correcto, el momento incorrecto o ya comprometidas con otro proveedor.",
      "El outreach genérico se ignora porque no está fundamentado en lo que está pasando ahora mismo en esa empresa.",
      "El vacío no es información — es la capa de análisis que convierte señales dispersas en una lista priorizada de cuentas que vale la pena contactar.",
      "Eso es lo que LeadLens construye: un brief comercial priorizado, basado en evidencia, entregado antes de la primera conversación.",
    ],
    receiveTag: "Qué recibes",
    receiveTitle: "Cada cuenta viene con una decisión — no solo un nombre.",
    receiveItems: [
      ["Opportunity Portfolio", "Tus cuentas priorizadas por decisión — Prioritize, Validate, Monitor o Hold — no un único score combinado."],
      ["What Changed", "El cambio público reciente y fechado detrás de cada cuenta — contrataciones, expansión, financiación, liderazgo — con fuentes."],
      ["Fit · Timing · Evidence", "Cada uno evaluado por separado (Strong / Moderate / Limited), para no confundir el fit estructural con el timing."],
      ["Evidence & Counterevidence", "Las fuentes y la frescura detrás de la tesis — y lo que la debilita. La incertidumbre se muestra, no se oculta."],
      ["What to Validate", "Las verificaciones concretas antes de actuar — alcance de la decisión, compras, encaje de categoría."],
      ["Next Commercial Decision", "Un siguiente paso claro por cuenta, con contexto de acercamiento opcional — tú decides qué enviar."],
    ] as [string, string][],
    samplePreviewTag: "Ejemplo de salida",
    samplePreviewTitle: "Así se ve un Account Brief",
    samplePreviewSub: "Cada cuenta incluye un Account Brief completo — qué cambió, por qué encaja, por qué el timing puede importar, la evidencia y la contraevidencia, y qué validar antes de actuar.",
    faqTag: "Preguntas frecuentes",
    faqTitle: "Preguntas comunes",
    faqs: [
      ["¿Qué recibo exactamente?", "Un Opportunity Portfolio priorizado de cuentas para tu ICP — cada una con un Account Brief: qué cambió, por qué encaja, por qué el timing puede importar, la evidencia y la contraevidencia, y qué validar antes de actuar. Entregado como PDF + CSV en 24–48h."],
      ["¿En qué se diferencia de Apollo o ZoomInfo?", "Apollo y ZoomInfo son bases de datos de contactos — filtras y exportas registros. LeadLens te da inteligencia comercial: qué empresas están mostrando señales para tu oferta específica ahora mismo, por qué son una buena oportunidad y cómo acercarte. No recibes una lista — recibes criterio y contexto."],
      ["¿En qué se diferencia de Clay?", "Clay es infraestructura — una plataforma poderosa para construir flujos de enriquecimiento. LeadLens es opinionado: describes tu ICP, nosotros hacemos la investigación y entregamos un brief priorizado. Sin configuración, sin flujos de trabajo, sin conocimiento técnico requerido."],
      ["¿Venden listas de emails o bases de datos de contactos?", "No. LeadLens analiza información comercial públicamente disponible sobre empresas. No vendemos listas de emails, bases de datos telefónicas ni registros de contactos personales."],
      ["¿Cuánto tarda la entrega?", "Típicamente 24–48 horas después de enviar tu formulario de ICP. Cada Opportunity Portfolio es revisado antes de la entrega."],
      ["¿Qué pasa si las oportunidades no coinciden con mi ICP?", "Si fallamos consistentemente y no podemos resolverlo, tienes derecho a un reembolso dentro de 7 días. Ver política de devoluciones."],
      ["¿Hay suscripción o contrato?", "No. Pago único por Opportunity Portfolio. Sin cargos recurrentes, sin compromisos, sin tarifas ocultas."],
      ["¿Qué pasa después de comprar?", "Envías tu formulario de ICP (5 minutos). Investigamos tu mercado, detectamos señales, puntuamos cuentas y entregamos tu Opportunity Portfolio por email en 24–48h."],
      ["¿La vista previa usa datos reales?", "No. La vista previa gratuita muestra el formato y la estructura de un Opportunity Portfolio real usando datos de ejemplo. Para un Opportunity Portfolio real con empresas investigadas y señales verificadas, compra un Opportunity Portfolio."],
    ] as [string, string][],
    ctaTag: "Comenzar",
    ctaTitle: "Sabe qué cuentas llamar esta semana.",
    ctaSub: "Un Opportunity Portfolio priorizado. Entrega en 24–48h. Cuentas reales, evidencia fechada, una decisión que puedes defender.",
    ctaCTA: "Obtener tu primer Opportunity Preview — desde $7 →",
    sampleTabs: ["Email", "LinkedIn DM", "Seguimiento 1", "Seguimiento 2"],
    pricePerLead: { sample: "Pago único", starter: "Pago único", standard: "Pago único", pro: "Pago único" },
    samplePackTitle: "¿No estás listo para comprometerte?",
    samplePackCopy: "Ve primero el formato del Opportunity Portfolio — gratis, sin pago requerido.",
    samplePackBadge: "Vista previa gratuita",
    samplePackCTA: "Ver Opportunity Portfolio de muestra →",
    samplePackBridge: "¿Quieres el real? Un Opportunity Portfolio entrega 5 briefs de empresa investigados con señales y estrategia de outreach.",
    sampleBridgeFreeDemo: "Ver el formato del Opportunity Portfolio",
    sampleBridgeSamplePack: "Obtener Opportunity Report — desde $7",
    samplePreviewDisclaimer: "Esta vista previa usa datos de ejemplo para mostrar la estructura del Opportunity Portfolio. Para un Opportunity Portfolio real con señales verificadas, compra un Opportunity Portfolio.",
    trustItems: ["Señales verificadas en fuentes", "Output revisado por humanos", "Sin bases de datos de contactos", "Política de reembolso de 7 días"] as string[],
    afterPurchaseTitle: "Después de comprar:",
    afterPurchaseSteps: [
      "Envía tu ICP — toma 5 minutos.",
      "LeadLens mapea tu mercado e identifica segmentos objetivo.",
      "Detectamos señales y puntuamos cada oportunidad.",
      "Recibes tu Opportunity Portfolio en 24–48h.",
    ] as string[],
    afterPurchaseNote: "Entrega típica: 24–48h. Nada se envía automáticamente. Tú revisas cada brief antes de actuar.",
    faqCtaBridge: "¿Aún no estás seguro? Ve primero el formato del Opportunity Portfolio — gratis, sin pago requerido.",
    resultsUpgradeTitle: "¿Listo para inteligencia comercial real?",
    resultsUpgradeSub: "Un Opportunity Portfolio entrega 5 briefs de empresa con señales, scores de oportunidad y estrategia de outreach — investigado y revisado por nuestro equipo en 24–48h.",
    resultsUpgradeCTA: "Obtener tu Opportunity Report — desde $7 →",
    checkoutEarlyBanner: "El checkout está en revisión final. Puedes ver el formato del Opportunity Portfolio de muestra mientras esperas.",
    comparisonTag: "Cómo nos comparamos",
    comparisonTitle: "LeadLens no es una base de datos. Es una decisión.",
    comparisonHeaders: ["", "Google", "Apollo / ZoomInfo", "Clay", "LeadLens"] as string[],
    comparisonRows: [
      ["Qué obtienes", "Páginas y enlaces", "Registros de contactos para filtrar", "Infraestructura de datos", "Briefs de oportunidad rankeados"],
      ["Señales", "Las buscas manualmente", "Datos de intención básicos", "Construyes el flujo", "Auto-detectadas con fuentes"],
      ["Mapeo de mercado", "Investigación manual", "Solo filtros de industria", "Tú lo configuras", "Automático — 6–8 segmentos"],
      ["Estrategia de outreach", "Ninguna", "Plantillas de email", "Tú la construyes", "Liderada por señales, por cuenta"],
      ["Configuración requerida", "Ninguna", "Curva de aprendizaje", "Configuración técnica", "Formulario de ICP de 5 min"],
    ] as string[][],
    b2cTeaserTag: "Próximamente",
    b2cTeaserTitle: "LeadLens para negocios B2C y locales",
    b2cTeaserSub: "Playbooks de adquisición de clientes con ideas de canales, tácticas de conversión, análisis de competidores y planes de acción de 30 días — para negocios orientados al consumidor y operadores locales.",
    b2cTeaserNote: "Solo B2B por ahora. Únete a la lista de espera para ser notificado cuando se lance B2C.",
    b2cTeaserCTA: "Unirse a la lista de espera B2C",
    vizTag: "De señales dispersas a prioridades claras",
    vizTitle: "Herramientas visuales de decisión, no solo datos.",
    vizSub: "LeadLens convierte señales públicas de mercado en herramientas visuales que tu equipo puede usar antes del primer outreach.",
    complianceNote: "LeadLens analiza información empresarial y señales comerciales públicamente disponibles. No vendemos bases de datos de contactos, listas de emails ni datos personales.",
    sFeedbackHook: "¿Fue útil esta oportunidad?",
    sFeedbackSaved: "Feedback guardado — gracias",
    sVaultMemory: "Memoria Vault",
    sVaultValidated: "Patrón validado",
    sVaultCaution: "Patrón de precaución",
    sVaultInsufficient: "Feedback insuficiente",
    sVaultPositiveText: "Oportunidades similares han recibido feedback positivo anteriormente.",
    sVaultNegativeText: "Oportunidades similares fueron marcadas como poco adecuadas o no útiles.",
    sVaultInsufficientText: "LeadLens todavía está recopilando feedback para este segmento.",
    sVaultConfidence: "Confianza",
    sVaultMatchedPatterns: "Patrones coincidentes",
    sAccountMemory: "Account Memory",
    sAccountMemoryNew: "Nueva oportunidad",
    sAccountMemorySeen: "Vista anteriormente",
    sAccountMemoryRepeat: "Repetida — sin señal nueva",
    sAccountMemoryReactivated: "Reactivada — nueva señal",
    sAccountMemoryUpgraded: "Mejorada",
    sAccountMemoryDowngraded: "Bajó de prioridad",
    sAccountMemoryDropped: "Descartada",
    sAccountMemoryTimesSeen: "veces vista",
    sAccountMemoryLastCat: "Última categoría",
    sEvidenceQuality: "Calidad de evidencia",
    sEvidenceHigh: "Alta",
    sEvidenceMedium: "Media",
    sEvidenceLow: "Baja",
    sEvidenceInsufficient: "Evidencia insuficiente",
    sEvidenceGuardrail: "Recomendación ajustada por calidad de evidencia.",
    sSourceLayer: "Fuentes",
    sSourceContextOnly: "Solo contexto",
    sSourceTimingSignal: "Señal de timing",
    sSourceNoDate: "Sin fecha de señal",
    sSourceFreshLabel: "Frescura",
    sSourceLimitedCoverage: "Cobertura regional limitada",
    sSourceDiscovered: "Descubierto",
  },
  pt: {
    announcement: "Account Opportunity Intelligence para B2B — saiba quais contas trabalhar agora, e por quê.",
    announcementCTA: "Obter meu Opportunity Preview →",
    navPricing: "Preços",
    navSignIn: "Entrar",
    navCTA: "Começar",
    navHow: "Como funciona",
    navSample: "Amostra",
    navFaq: "FAQ",
    heroCuriosity: "O que mudou nas contas que você já acompanha?",
    heroBadge: "Inteligência de Oportunidades de Conta · B2B",
    heroH1pre: "Encontre as contas B2B",
    heroH1hi: "que valem a pena trabalhar agora",
    heroH1post: ".",
    heroH2: "E a evidência por trás de cada oportunidade.",
    heroSub: "A LeadLens diz quais contas se encaixam, por que importam agora e a evidência pública por trás de cada oportunidade — inteligência em nível de conta, não uma lista de contatos.",
    heroCTA: "Começar",
    heroPriceNote: "A partir de $7 · pagamento único · sem cartão para ver a amostra",
    heroSeeAll: "Ver amostra",
    heroNote: "Sem bancos de dados de contatos. Sem listas de e-mails. Apenas inteligência comercial.",
    proofLabels: [["5","account briefs"],["6–8","segmentos de compradores"],["24–48h","entrega"],["Evidência","+ contraevidência"]] as [string,string][],
    howTag: "Como funciona",
    howTitle: "ICP (Perfil de Cliente Ideal) dentro. Inteligência comercial fora.",
    steps: [
      ["1","Descreva seu ICP","Nos diga o que você vende, para quem e o que faz um ótimo cliente. Leva 5 minutos."],
      ["2","Mapeamos seu mercado","LeadLens identifica 6–8 segmentos de compradores — incluindo alguns que você talvez não tenha considerado. Depois encontra empresas reais em cada segmento."],
      ["3","Detectamos sinais","Nosso sistema lê dados públicos: vagas de emprego, notícias de financiamento, expansões, mudanças de liderança. Encontramos empresas com sinais ativos agora."],
      ["4","Você recebe briefs ranqueados","5 Opportunity Briefs — ranqueados por score. Cada um explica por que esta empresa, por que agora e como abordá-la."],
    ] as [string,string,string][],
    pricingTag: "Preços",
    pricingTitle: "Inteligência comercial em cada profundidade.",
    pricingSub: "Três produtos focados. Sem assinatura. Comece onde faz sentido para o seu negócio.",
    oneBatch: "Pagamento único",
    monthlyTag: "Em breve — Acesso piloto",
    monthlyTitle: "Opportunity Monitor",
    monthlySub: "Oportunidades atualizadas mensalmente, novos sinais, resumo semanal e briefs recorrentes — para equipes que precisam de inteligência de mercado contínua.",
    monitorCTA: "Entrar na lista piloto",
    monitorPrice: "A partir de $99/mês",
    planNames: { sample: "Preview", starter: "Brief", standard: "Intelligence", pro: "Premium" },
    planDescs: {
      sample:   "Veja o formato — sem pagamento necessário.",
      starter:  "Um diagnóstico pago que mapeia seu mercado e mostra onde focar antes de se comprometer com um relatório mais profundo.",
      standard: "Um relatório focado que transforma um ICP em uma lista ranqueada de empresas que valem a pena contatar — com sinais, scores e estratégia.",
      pro:      "Um relatório mais profundo para empresas que querem maior visibilidade de mercado, mais oportunidades e uma direção estratégica mais sólida.",
    },
    planFeatures: {
      sample:   ["Market Map de exemplo","Briefs de empresa de exemplo","Sem pesquisa real — apenas formato","Veja o output antes de se comprometer"],
      starter:  ["1 ICP","5–8 segmentos de compradores","Ranking de segmentos","Sinais a acompanhar por segmento","Tipos de oportunidades exemplo","Primeiro segmento recomendado","Entrega em PDF"],
      standard: ["1 ICP","Market Map — 6–8 segmentos","10–15 oportunidades ranqueadas","Top 5 Opportunity Briefs","Sinais públicos com fontes","Fit × Timing × Evidence por conta","Por que agora — análise de timing","O que validar por conta","Contexto de abordagem opcional","Download PDF + CSV","Entrega em 24–48h"],
      pro:      ["1 ICP","Market Map ampliado","20–30 oportunidades ranqueadas","Top 10 Opportunity Briefs","Recomendações por segmento","Lista de evidências e fontes","Sequência recomendada por conta","Análise de riscos e fraquezas","Download PDF + CSV","Entrega em 24–48h"],
    },
    planCTAs: { sample: "Começar", starter: "Começar", standard: "Começar", pro: "Começar" },
    planFor: {
      sample: "Para equipes que querem prova antes de investir.",
      starter: "Para equipes que precisam de uma lista curta e defensável.",
      standard: "Para equipes B2B decidindo onde concentrar esforço.",
      pro: "Para equipes convertendo portfólio em estratégia.",
    },
    planDiff: {
      sample: "Valida: vale a pena para meu ICP?",
      starter: "Adiciona seleção: um conjunto comparado com ranking inicial.",
      standard: "Adiciona priorização: ranking completo e alocação.",
      pro: "Adiciona estratégia: corroboração profunda em contas prioritárias.",
    },
    planBadges: { sample: "Ponto de entrada de baixo risco", starter: "Conjunto focado de oportunidades", standard: "Recomendado · Ideal para crescimento B2B focado", pro: "Acesso antecipado · Somente piloto guiado" },
    launchNote: "Preços de lançamento — acesso antecipado durante a primeira coorte de clientes.",
    compareTitle: "Comparar planos",
    leadsFoundBy: (n: number) => `${n} oportunidades encontradas pela LeadLens`,
    getStarted: "Iniciar Opportunity Portfolio →",
    mostPopular: "Recomendado",
    formTag: "Inicie seu Opportunity Portfolio",
    formTitle: "Conte à LeadLens sobre seu negócio",
    formSub: "Quanto mais contexto você der, melhores serão as oportunidades e a estratégia que encontraremos para você.",
    step1: "1. Selecione seu plano",
    step2: "2. Descreva seu negócio",
    useSampleData: "Usar dados de exemplo",
    fCompanyName: "Nome da empresa",
    fCompanyDesc: "O que sua empresa faz?",
    fOffer: "Sua oferta",
    fValue: "Sua proposta de valor principal",
    fCustomer: "Descrição do cliente ideal",
    fTicket: "Tamanho médio do negócio (opcional)",
    fTone: "Tom da mensagem",
    fRegion: "Mercado-alvo",
    fEmail: "Seu email",
    toneDirect: "Direto — sem rodeios",
    toneConsultative: "Consultivo — curioso, faz perguntas",
    toneCasual: "Casual — conversacional, acolhedor",
    regionNA: "América do Norte",
    regionLA: "América Latina",
    regionEU: "Europa",
    regionAS: "Ásia",
    regionGL: "Global",
    submitBtn: (n: number) => `Obter meus ${n} briefs de oportunidade →`,
    backBtn: "← Voltar",
    processingTitle: "Construindo seu Opportunity Portfolio…",
    processingNote: "Produção: 24–48h. Prévia: ~5 segundos.",
    processingStatus: "LeadLens está analisando seu mercado e detectando sinais.",
    agents: [
      "Análise de ICP — entendendo seu perfil de cliente ideal",
      "Market Mapping — identificando 6–8 segmentos de compradores",
      "Account Discovery — encontrando empresas por segmento",
      "Signal Detection — analisando vagas, notícias, financiamento e expansões",
      "Opportunity Scoring — ranqueando contas por fit e timing",
      "Brief Generation — escrevendo contexto e estratégia por conta",
      "Outreach Writing — e-mail, LinkedIn DM e cold call opener",
    ],
    reportReady: "Opportunity Portfolio pronto",
    reportTitle: "Seu Opportunity Portfolio está pronto",
    dlCSV: (n: number) => `⬇ Baixar CSV (${n} empresas)`,
    dlMD: "⬇ Baixar Markdown",
    newRun: "← Nova análise",
    statTotal: "Empresas",
    statAvg: "Score méd.",
    execSummary: "Panorama de mercado",
    patternsObserved: "Padrões detectados",
    recommendations: "Próximos passos",
    leadBreakdown: "Opportunity Briefs",
    showingOf: (shown: number, total: number) => `Mostrando ${shown} de ${total} oportunidades. A exportação inclui todas as ${total}.`,
    moreInExport: (n: number) => `+ ${n} oportunidades a mais na sua exportação`,
    dlAll: (n: number) => `⬇ Baixar todas as ${n} oportunidades como CSV`,
    mCompanySize: "Tamanho da empresa",
    mEmailStatus: "Qualidade do sinal",
    mConfidence: "Confiança",
    mSource: "Fonte",
    mLocation: "Localização",
    mSourceUrl: "URL da fonte",
    mLinkedin: "Página da empresa",
    sCompanyContext: "Contexto da empresa",
    sTimingSignals: "Sinais",
    sWhyFit: "Por que é uma boa oportunidade",
    sFlags: "Alertas",
    sDataGaps: "Lacunas de dados",
    sPersonalization: "Ângulo de venda recomendado",
    sInitialEmail: "Rascunho de outreach",
    sSubject: "Assunto",
    sBody: "Corpo",
    sFullSequence: "Estratégia de outreach completa",
    sLinkedinDM: "LinkedIn message",
    sFollowup1: "Follow-up 1 (dia 3–4)",
    sFollowup2: "Follow-up 2 (dia 7–8)",
    sQcNotes: "Notas de revisão",
    sScoreBreakdown: "Detalhe do score",
    sWhyNow: "Por que agora",
    sEvidenceDiscipline: "Qualidade da evidência",
    sIntelligenceNotes: "Controle de qualidade",
    sLearningMeta: "Sinais de aprendizado",
    footerCopy: "© 2026 LeadLens AI — Inteligência Comercial B2B. Analisamos sinais públicos, não dados pessoais.",
    footerLinks: ["Privacidade", "Termos", "Política de Reembolso", "Contato"],
    footerContact: "Dúvidas? Fale conosco: martinfgaleano@gmail.com",
    expectationsTag: "O que esperar",
    expectationsTitle: "Honestos sobre o que entregamos",
    expectationsItems: [
      "Você recebe um Opportunity Portfolio — não um banco de dados de contatos. Identificamos empresas e sinais, não listas de e-mails.",
      "Os materiais de outreach são rascunhos. Você revisa e decide o que enviar, quando e para quem.",
      "Cada sinal vem de dados publicamente disponíveis. Citamos as fontes em cada brief.",
      "Entrega típica: 24–48 horas após você enviar seu formulário de ICP.",
      "Nada é enviado automaticamente. Você mantém controle total.",
      "Se as oportunidades consistentemente não combinarem com seu ICP, resolvemos ou reembolsamos em 7 dias.",
    ],
    tryDemoCTA: "Visualizar relatório de exemplo",
    checkoutPendingTitle: "O checkout online está quase pronto.",
    checkoutPendingBody: "Nosso checkout está em revisão final antes do lançamento. Os Opportunity Portfolios ainda não estão disponíveis para compra.",
    checkoutPendingDemoHint: "Você ainda pode visualizar o formato do Opportunity Portfolio abaixo.",
    switchToDemo: "Visualizar formato do Opportunity Portfolio →",
    sampleBadge: "Prévia do Opportunity Portfolio",
    sampleNote: "Este relatório usa dados de exemplo para mostrar o formato. Para um Opportunity Portfolio real com sinais verificados, compre um Opportunity Portfolio.",
    problemTag: "O desafio",
    problemTitle: "Sua equipe tem acesso a mais sinais do que nunca. O difícil é saber quais oportunidades merecem atenção primeiro — e por quê agora.",
    problemItems: [
      "Dados de mercado, vagas, notícias de financiamento, atividade no LinkedIn — sinais estão em todo lugar. Mas não chegam ranqueados para seu ICP.",
      "Toda semana sua equipe pesquisa empresas que acabam sendo o fit errado, o momento errado ou já comprometidas com outro fornecedor.",
      "Outreach genérico é ignorado porque não está fundamentado no que está acontecendo agora naquela empresa.",
      "A lacuna não é informação — é a camada de análise que transforma sinais dispersos em uma lista priorizada de contas que valem a pena contatar.",
      "É isso que a LeadLens constrói: um brief comercial priorizado, baseado em evidências, entregue antes da primeira conversa.",
    ],
    receiveTag: "O que você recebe",
    receiveTitle: "Cada conta vem com uma decisão — não apenas um nome.",
    receiveItems: [
      ["Opportunity Portfolio", "Suas contas priorizadas por decisão — Prioritize, Validate, Monitor ou Hold — não um único score combinado."],
      ["What Changed", "A mudança pública recente e datada por trás de cada conta — contratações, expansão, financiamento, liderança — com fontes."],
      ["Fit · Timing · Evidence", "Cada um avaliado separadamente (Strong / Moderate / Limited), para não confundir o fit estrutural com o timing."],
      ["Evidence & Counterevidence", "As fontes e a atualidade por trás da tese — e o que a enfraquece. A incerteza é mostrada, não escondida."],
      ["What to Validate", "As verificações concretas antes de agir — escopo da decisão, compras, encaixe de categoria."],
      ["Next Commercial Decision", "Um próximo passo claro por conta, com contexto de abordagem opcional — você decide o que enviar."],
    ] as [string, string][],
    samplePreviewTag: "Exemplo de saída",
    samplePreviewTitle: "É assim que um Account Brief se parece",
    samplePreviewSub: "Cada conta inclui um Account Brief completo — o que mudou, por que encaixa, por que o timing pode importar, a evidência e a contraevidência, e o que validar antes de agir.",
    faqTag: "Perguntas frequentes",
    faqTitle: "Dúvidas comuns",
    faqs: [
      ["O que exatamente eu recebo?", "Um Opportunity Portfolio priorizado de contas para o seu ICP — cada uma com um Account Brief: o que mudou, por que encaixa, por que o timing pode importar, a evidência e a contraevidência, e o que validar antes de agir. Entregue como PDF + CSV em 24–48h."],
      ["Como é diferente do Apollo ou ZoomInfo?", "Apollo e ZoomInfo são bancos de dados de contatos — você filtra e exporta registros. LeadLens te dá inteligência comercial: quais empresas mostram sinais relevantes para sua oferta específica agora, por que são uma boa oportunidade e como abordá-las. Você não recebe uma lista — recebe critério e contexto."],
      ["Como é diferente do Clay?", "Clay é infraestrutura — uma plataforma poderosa para construir fluxos de enriquecimento. LeadLens é opinativo: você descreve seu ICP, nós fazemos a pesquisa e entregamos um brief priorizado. Sem configuração, sem fluxos de trabalho, sem conhecimento técnico necessário."],
      ["Vocês vendem listas de e-mails ou bancos de dados de contatos?", "Não. LeadLens analisa informações comerciais publicamente disponíveis sobre empresas. Não vendemos listas de e-mails, bancos de dados telefônicos nem registros de contatos pessoais."],
      ["Quanto tempo demora a entrega?", "Tipicamente 24–48 horas após você enviar seu formulário de ICP. Cada Opportunity Portfolio é revisado antes da entrega."],
      ["E se as oportunidades não combinarem com meu ICP?", "Se falharmos consistentemente e não conseguirmos resolver, você tem direito a reembolso em 7 dias. Consulte nossa política de reembolso."],
      ["Há assinatura ou contrato?", "Não. Pagamento único por Opportunity Portfolio. Sem cobranças recorrentes, sem compromissos, sem taxas ocultas."],
      ["O que acontece após a compra?", "Você envia seu formulário de ICP (5 minutos). Pesquisamos seu mercado, detectamos sinais, pontuamos contas e entregamos seu Opportunity Portfolio por e-mail em 24–48h."],
      ["A prévia usa dados reais?", "Não. A prévia gratuita mostra o formato e a estrutura de um Opportunity Portfolio real usando dados de exemplo. Para um Opportunity Portfolio real com empresas pesquisadas e sinais verificados, compre um Opportunity Portfolio."],
    ] as [string, string][],
    ctaTag: "Começar",
    ctaTitle: "Saiba quais contas ligar esta semana.",
    ctaSub: "Um Opportunity Portfolio priorizado. Entrega em 24–48h. Contas reais, evidência datada, uma decisão que você pode defender.",
    ctaCTA: "Obter seu primeiro Opportunity Preview — a partir de $7 →",
    sampleTabs: ["Email", "LinkedIn DM", "Follow-up 1", "Follow-up 2"],
    pricePerLead: { sample: "Pagamento único", starter: "Pagamento único", standard: "Pagamento único", pro: "Pagamento único" },
    samplePackTitle: "Ainda não está pronto para se comprometer?",
    samplePackCopy: "Veja o formato do Opportunity Portfolio primeiro — gratuito, sem pagamento necessário.",
    samplePackBadge: "Prévia gratuita",
    samplePackCTA: "Ver Opportunity Portfolio de exemplo →",
    samplePackBridge: "Quer o real? Um Opportunity Portfolio entrega 5 briefs de empresa pesquisados com sinais e estratégia de outreach.",
    sampleBridgeFreeDemo: "Visualizar o formato do Opportunity Portfolio",
    sampleBridgeSamplePack: "Obter Opportunity Report — a partir de $7",
    samplePreviewDisclaimer: "Esta prévia usa dados de exemplo para mostrar a estrutura do Opportunity Portfolio. Para um Opportunity Portfolio real com sinais verificados, compre um Opportunity Portfolio.",
    trustItems: ["Sinais verificados em fontes", "Output revisado por humanos", "Sem bancos de dados de contatos", "Política de reembolso de 7 dias"] as string[],
    afterPurchaseTitle: "Após a compra:",
    afterPurchaseSteps: [
      "Envie seu ICP — leva 5 minutos.",
      "LeadLens mapeia seu mercado e identifica segmentos-alvo.",
      "Detectamos sinais e pontuamos cada oportunidade.",
      "Você recebe seu Opportunity Portfolio em 24–48h.",
    ] as string[],
    afterPurchaseNote: "Entrega típica: 24–48h. Nada é enviado automaticamente. Você revisa cada brief antes de agir.",
    faqCtaBridge: "Ainda não tem certeza? Veja o formato do Opportunity Portfolio primeiro — gratuito, sem pagamento necessário.",
    resultsUpgradeTitle: "Pronto para inteligência comercial real?",
    resultsUpgradeSub: "Um Opportunity Portfolio entrega 5 briefs de empresa com sinais, scores de oportunidade e estratégia de outreach — pesquisado e revisado pela nossa equipe em 24–48h.",
    resultsUpgradeCTA: "Obter seu Opportunity Report — a partir de $7 →",
    checkoutEarlyBanner: "O checkout está em revisão final. Visualize o formato do Opportunity Portfolio de exemplo enquanto espera.",
    comparisonTag: "Como nos comparamos",
    comparisonTitle: "LeadLens não é um banco de dados. É uma decisão.",
    comparisonHeaders: ["", "Google", "Apollo / ZoomInfo", "Clay", "LeadLens"] as string[],
    comparisonRows: [
      ["O que você recebe", "Páginas e links", "Registros de contatos para filtrar", "Infraestrutura de dados", "Briefs de oportunidade ranqueados"],
      ["Sinais", "Você busca manualmente", "Dados de intenção básicos", "Você constrói o fluxo", "Auto-detectados com fontes"],
      ["Mapeamento de mercado", "Pesquisa manual", "Apenas filtros de indústria", "Você configura", "Automático — 6–8 segmentos"],
      ["Estratégia de outreach", "Nenhuma", "Templates de e-mail", "Você constrói", "Liderada por sinais, por conta"],
      ["Configuração necessária", "Nenhuma", "Curva de aprendizado", "Configuração técnica", "Formulário de ICP de 5 min"],
    ] as string[][],
    b2cTeaserTag: "Em breve",
    b2cTeaserTitle: "LeadLens para negócios B2C e locais",
    b2cTeaserSub: "Playbooks de aquisição de clientes com ideias de canais, táticas de conversão, análise de concorrentes e planos de ação de 30 dias — para negócios voltados ao consumidor e operadores locais.",
    b2cTeaserNote: "Apenas B2B por agora. Entre na lista de espera para ser notificado quando o B2C for lançado.",
    b2cTeaserCTA: "Entrar na lista de espera B2C",
    vizTag: "De sinais dispersos a prioridades claras",
    vizTitle: "Ferramentas visuais de decisão, não apenas dados.",
    vizSub: "LeadLens transforma sinais públicos de mercado em ferramentas visuais que sua equipe pode usar antes do primeiro outreach.",
    complianceNote: "LeadLens analisa informações empresariais e sinais comerciais publicamente disponíveis. Não vendemos bancos de dados de contatos, listas de e-mails nem dados pessoais.",
    sFeedbackHook: "Esta oportunidade foi útil?",
    sFeedbackSaved: "Feedback salvo — obrigado",
    sVaultMemory: "Memória Vault",
    sVaultValidated: "Padrão validado",
    sVaultCaution: "Padrão de cautela",
    sVaultInsufficient: "Feedback insuficiente",
    sVaultPositiveText: "Oportunidades semelhantes receberam feedback positivo anteriormente.",
    sVaultNegativeText: "Oportunidades semelhantes foram marcadas como inadequadas ou não úteis.",
    sVaultInsufficientText: "O LeadLens ainda está coletando feedback para este segmento.",
    sVaultConfidence: "Confiança",
    sVaultMatchedPatterns: "Padrões correspondentes",
    sAccountMemory: "Account Memory",
    sAccountMemoryNew: "Nova oportunidade",
    sAccountMemorySeen: "Vista anteriormente",
    sAccountMemoryRepeat: "Repetida — sem novo sinal",
    sAccountMemoryReactivated: "Reativada — novo sinal",
    sAccountMemoryUpgraded: "Melhorada",
    sAccountMemoryDowngraded: "Rebaixada",
    sAccountMemoryDropped: "Descartada",
    sAccountMemoryTimesSeen: "vezes vista",
    sAccountMemoryLastCat: "Última cat.",
    sEvidenceQuality: "Qualidade de evidência",
    sEvidenceHigh: "Alta",
    sEvidenceMedium: "Média",
    sEvidenceLow: "Baixa",
    sEvidenceInsufficient: "Evidência insuficiente",
    sEvidenceGuardrail: "Recomendação ajustada pela qualidade de evidência.",
    sSourceLayer: "Fontes",
    sSourceContextOnly: "Apenas contexto",
    sSourceTimingSignal: "Sinal de timing",
    sSourceNoDate: "Sem data de sinal",
    sSourceFreshLabel: "Frescor",
    sSourceLimitedCoverage: "Cobertura regional limitada",
    sSourceDiscovered: "Descoberto",
  },
  ja: {
    announcement: "B2B向けAccount Opportunity Intelligence — 今どのアカウントに取り組むべきか、その理由も。",
    announcementCTA: "Opportunity Previewを取得 →",
    navPricing: "料金",
    navSignIn: "ログイン",
    navCTA: "始める",
    navHow: "使い方",
    navSample: "サンプル",
    navFaq: "FAQ",
    heroCuriosity: "すでに注視しているアカウントで、何が変わったか？",
    heroBadge: "アカウント機会インテリジェンス · B2B",
    heroH1pre: "今週コンタクトする価値のある",
    heroH1hi: "B2Bアカウントを見つけましょう",
    heroH1post: "。",
    heroH2: "そして、各機会の裏付けとなる根拠を。",
    heroSub: "LeadLensは、どのアカウントが適合し、なぜ今重要で、各機会の裏付けとなる公開情報をお伝えします — 連絡先リストではなく、アカウント単位のインテリジェンス。",
    heroCTA: "始める",
    heroPriceNote: "$7から · 一回払い · サンプルはカード不要",
    heroSeeAll: "サンプルを見る",
    heroNote: "コンタクトデータベースなし。メールリストなし。コマーシャルインテリジェンスのみ。",
    proofLabels: [["5件","アカウントブリーフ"],["6〜8","購買者セグメント"],["24〜48h","納品"],["エビデンス","+ 反証"]] as [string,string][],
    howTag: "使い方",
    howTitle: "ICP（理想顧客プロファイル）を入力。コマーシャルインテリジェンスを出力。",
    steps: [
      ["1","ICPを入力","何を販売し、誰に販売し、優れた顧客とは何かをお伝えください。5分で完了します。"],
      ["2","市場をマッピング","LeadLensは6〜8の購買者セグメントを特定します — まだ検討していないものも含めて。各セグメントの実在する企業を見つけます。"],
      ["3","シグナルを検出","求人情報、資金調達ニュース、事業拡大、リーダーシップ変更などの公開データを読み取ります。今まさに活発なシグナルを示している企業を見つけます。"],
      ["4","ランク付きブリーフを受け取る","スコアでランク付けされた5件のOpportunity Brief。各ブリーフは、この企業が選ばれた理由、今なぜか、どうアプローチするかを説明します。"],
    ] as [string,string,string][],
    pricingTag: "料金",
    pricingTitle: "それぞれの深さで提供するコマーシャルインテリジェンス。",
    pricingSub: "3つの集中型プロダクト。サブスクリプションなし。自分のステージに合ったところから始めましょう。",
    oneBatch: "1回払い",
    monthlyTag: "近日公開 — パイロットアクセス",
    monthlyTitle: "Opportunity Monitor",
    monthlySub: "毎月更新されるオポチュニティ、シグナル更新、週次オポチュニティダイジェスト、定期ブリーフ — 継続的な市場インテリジェンスを必要とするチーム向け。",
    monitorCTA: "パイロットウェイトリストに登録",
    monitorPrice: "$99/月から",
    planNames: { sample: "Preview", starter: "Brief", standard: "Intelligence", pro: "Premium" },
    planDescs: {
      sample:   "フォーマットを確認 — 支払い不要。",
      starter:  "より深いレポートにコミットする前に、市場をマッピングしてどこに集中すべきかを示す有料の診断ツール。",
      standard: "1つのICPを、コンタクトする価値のある企業のランク付きリストに変える集中型レポート — シグナル・スコア・戦略付き。",
      pro:      "より広い市場の可視性、より多くのオポチュニティ、より強い戦略的方向性を必要とするビジネス向けの深いレポート。",
    },
    planFeatures: {
      sample:   ["サンプルマーケットマップ","サンプル企業ブリーフ","実際の調査なし — フォーマットのみ","コミットする前に出力を確認"],
      starter:  ["1 ICP","5〜8購買者セグメント","セグメントランキングプレビュー","セグメントごとの注目シグナル","オポチュニティタイプ例","テスト推奨の最初のセグメント","PDF納品"],
      standard: ["1 ICP","マーケットマップ — 6〜8セグメント","ランク付きオポチュニティ10〜15件","トップ5オポチュニティブリーフ","ソース付き公開シグナル","Fit × Timing × Evidence（各アカウント）","今なぜか — タイミング分析","各アカウントで検証すべきこと","任意のアウトリーチ文脈","PDF + CSVダウンロード","24〜48時間で納品"],
      pro:      ["1 ICP","拡張マーケットマップ","ランク付きオポチュニティ20〜30件","トップ10オポチュニティブリーフ","セグメントレベルの推奨","証拠とソースリスト","推奨シーケンス","リスクと弱点分析","PDF + CSVダウンロード","24〜48時間で納品"],
    },
    planCTAs: { sample: "始める", starter: "始める", standard: "始める", pro: "始める" },
    planFor: {
      sample: "本格投資の前に品質を確認したいチーム向け。",
      starter: "今週行動できる短く堅実なリストが必要なチーム向け。",
      standard: "限られた営業リソースの配分を決めるB2Bチーム向け。",
      pro: "ポートフォリオを戦略に変えるチーム向け。",
    },
    planDiff: {
      sample: "検証：自社ICPに価値があるか？",
      starter: "選定を追加：初期ランキング付きの比較セット。",
      standard: "優先順位付けを追加：完全なランキングと配分。",
      pro: "戦略を追加：優先アカウントの深い裏付けと戦略的シーケンス。",
    },
    planBadges: { sample: "低リスクの出発点", starter: "焦点を絞った機会セット", standard: "おすすめ · 集中型B2B成長に最適", pro: "早期アクセス · ガイド付きパイロットのみ" },
    launchNote: "ローンチ価格 — 初期顧客コホート期間中のアーリーアクセス価格です。",
    compareTitle: "プラン比較",
    leadsFoundBy: (n: number) => `${n}件のオポチュニティをLeadLensが発見`,
    getStarted: "Opportunity Portfolioを開始 →",
    mostPopular: "おすすめ",
    formTag: "Opportunity Portfolioを開始",
    formTitle: "LeadLensにビジネスについて教えてください",
    formSub: "詳しく入力するほど、より質の高いオポチュニティと戦略が見つかります。",
    step1: "1. プランを選択",
    step2: "2. ビジネスについて入力",
    useSampleData: "サンプルデータを使用",
    fCompanyName: "会社名",
    fCompanyDesc: "会社の概要",
    fOffer: "提供サービス",
    fValue: "主な価値提案",
    fCustomer: "理想の顧客像",
    fTicket: "平均取引額（任意）",
    fTone: "メッセージのトーン",
    fRegion: "ターゲット市場",
    fEmail: "メールアドレス",
    toneDirect: "ダイレクト — 簡潔に要点を伝える",
    toneConsultative: "コンサルタティブ — 質問を通じて関心を示す",
    toneCasual: "カジュアル — 親しみやすい会話スタイル",
    regionNA: "北米",
    regionLA: "ラテンアメリカ",
    regionEU: "ヨーロッパ",
    regionAS: "アジア",
    regionGL: "グローバル",
    submitBtn: (n: number) => `${n}件のオポチュニティブリーフを取得 →`,
    backBtn: "← 戻る",
    processingTitle: "Opportunity Portfolioを構築中…",
    processingNote: "本番環境: 24〜48時間。プレビュー: 約5秒。",
    processingStatus: "LeadLensが市場を分析し、シグナルを検出しています。",
    agents: [
      "ICP分析 — 理想の顧客プロフィールを理解",
      "マーケットマッピング — 6〜8の購買者セグメントを特定",
      "アカウントディスカバリー — セグメントごとに企業を発見",
      "シグナル検出 — 求人、ニュース、資金調達、事業拡大を分析",
      "オポチュニティスコアリング — フィットとタイミングでアカウントをランク付け",
      "ブリーフ作成 — アカウントごとにコンテキストと戦略を作成",
      "アウトリーチライティング — メール、LinkedIn DM、コールドコールオープナー",
    ],
    reportReady: "Opportunity Portfolio完成",
    reportTitle: "Opportunity Portfolioが完成しました",
    dlCSV: (n: number) => `⬇ CSVをダウンロード（${n}社）`,
    dlMD: "⬇ Markdownをダウンロード",
    newRun: "← 新規分析",
    statTotal: "企業数",
    statAvg: "平均スコア",
    execSummary: "市場概況",
    patternsObserved: "検出されたパターン",
    recommendations: "次のステップ",
    leadBreakdown: "Opportunity Briefs",
    showingOf: (shown: number, total: number) => `${total}件中${shown}件を表示。エクスポートには全${total}件が含まれます。`,
    moreInExport: (n: number) => `他${n}件はエクスポートに含まれます`,
    dlAll: (n: number) => `⬇ 全${n}件をCSVでダウンロード`,
    mCompanySize: "企業規模",
    mEmailStatus: "シグナル品質",
    mConfidence: "信頼度",
    mSource: "ソース",
    mLocation: "所在地",
    mSourceUrl: "ソースURL",
    mLinkedin: "企業ページ",
    sCompanyContext: "企業コンテキスト",
    sTimingSignals: "シグナル",
    sWhyFit: "なぜ良いオポチュニティか",
    sFlags: "フラグ",
    sDataGaps: "データ不足",
    sPersonalization: "推奨セールスアングル",
    sInitialEmail: "アウトリーチ下書き",
    sSubject: "件名",
    sBody: "本文",
    sFullSequence: "アウトリーチ戦略全体",
    sLinkedinDM: "LinkedIn message",
    sFollowup1: "フォローアップ1（3〜4日目）",
    sFollowup2: "フォローアップ2（7〜8日目）",
    sQcNotes: "レビューメモ",
    sScoreBreakdown: "スコア詳細",
    sWhyNow: "なぜ今か",
    sEvidenceDiscipline: "エビデンス品質",
    sIntelligenceNotes: "品質チェック",
    sLearningMeta: "学習シグナル",
    footerCopy: "© 2026 LeadLens AI — B2Bコマーシャルインテリジェンス。公開シグナルを分析します。個人データは使用しません。",
    footerLinks: ["プライバシー", "利用規約", "返金ポリシー", "お問い合わせ"],
    footerContact: "ご質問は: martinfgaleano@gmail.com",
    expectationsTag: "期待できること",
    expectationsTitle: "提供内容について正直にお伝えします",
    expectationsItems: [
      "お届けするのはOpportunity Portfolio — コンタクトデータベースではありません。企業とシグナルを特定します。メールリストではありません。",
      "アウトリーチ素材はドラフトです。何を、いつ、誰に送るかはあなたが判断します。",
      "すべてのシグナルは公開データから取得しています。各ブリーフにソースを記載します。",
      "通常の納品時間：ICPフォーム送信後24〜48時間。",
      "自動送信は一切ありません。完全にコントロールを維持できます。",
      "オポチュニティが継続的にICPに合わない場合、解決するか7日以内に返金します。",
    ],
    tryDemoCTA: "サンプルOpportunity Portfolioを見る",
    checkoutPendingTitle: "オンライン決済はまもなく利用可能になります。",
    checkoutPendingBody: "現在チェックアウトはローンチ前の最終審査中です。Opportunity Portfolioはまだ購入できません。",
    checkoutPendingDemoHint: "以下でOpportunity Portfolioのフォーマットをご確認いただけます。",
    switchToDemo: "サンプルOpportunity Portfolio形式を見る →",
    sampleBadge: "Opportunity Portfolioプレビュー",
    sampleNote: "このレポートはサンプルデータを使用してフォーマットを示しています。検証済みシグナル付きの実際のOpportunity Portfolioには、Opportunity Portfolioをご購入ください。",
    problemTag: "課題",
    problemTitle: "チームはこれまで以上に多くのシグナルにアクセスできます。難しいのは、どのオポチュニティを最初に優先すべきか、そして今なぜかを知ることです。",
    problemItems: [
      "市場データ、求人情報、資金調達ニュース、LinkedIn活動 — シグナルはどこにでもあります。しかし、あなたのICPに合わせてランク付けされてはいません。",
      "毎週、チームはフィットが悪かった、タイミングが悪かった、または既に他社と契約済みだった企業を調査することになります。",
      "汎用的なアウトリーチが無視されるのは、今その企業で実際に起きていることに基づいていないからです。",
      "ギャップは情報ではありません — 散在するシグナルを、コンタクトする価値のあるアカウントのランク付きリストに変える分析レイヤーです。",
      "それがLeadLensの提供するものです：エビデンスに基づいた優先順位付けされたコマーシャルブリーフ、最初の会話の前に届きます。",
    ],
    receiveTag: "受け取るもの",
    receiveTitle: "すべてのアカウントに、名前だけでなく意思決定を。",
    receiveItems: [
      ["Opportunity Portfolio", "アカウントを意思決定で優先順位付け — Prioritize / Validate / Monitor / Hold — 単一の合成スコアではありません。"],
      ["What Changed", "各アカウントの最近の日付付き公開変化 — 採用、事業拡大、資金調達、経営陣 — ソース付き。"],
      ["Fit · Timing · Evidence", "それぞれを個別に評価（Strong / Moderate / Limited）。構造的なフィットとタイミングを混同しません。"],
      ["Evidence & Counterevidence", "仮説の根拠となるソースと鮮度 — そしてそれを弱める要素。不確実性は隠さず提示します。"],
      ["What to Validate", "行動する前に確認すべき具体的なチェック — 意思決定範囲、調達、カテゴリ適合。"],
      ["Next Commercial Decision", "アカウントごとの明確な次のステップと任意のアウトリーチ文脈 — 何を送るかはあなたが決めます。"],
    ] as [string, string][],
    samplePreviewTag: "サンプル出力",
    samplePreviewTitle: "Account Briefはこのような内容です",
    samplePreviewSub: "各アカウントに完全なAccount Briefが付きます — 何が変わったか、なぜ適合するか、なぜタイミングが重要か、エビデンスと反証、そして行動前に検証すべきこと。",
    faqTag: "よくある質問",
    faqTitle: "よくいただく質問",
    faqs: [
      ["具体的に何が得られますか？", "ICPに合わせた、優先順位付けされたアカウントのOpportunity Portfolio — 各アカウントにAccount Brief：何が変わったか、なぜ適合するか、なぜタイミングが重要か、エビデンスと反証、行動前に検証すべきこと。PDF + CSVで24〜48時間以内に納品します。"],
      ["ApolloやZoomInfoと何が違いますか？", "ApolloやZoomInfoはコンタクトデータベースです。フィルタリングしてエクスポートするためのレコードを提供します。LeadLensはコマーシャルインテリジェンスを提供します：あなたの特定のオファーに対して今シグナルを示している企業はどこか、なぜ良いオポチュニティか、どうアプローチするか。リストではなく、判断基準とコンテキストをお届けします。"],
      ["Clayとは何が違いますか？", "Clayはインフラです — エンリッチメントワークフローを構築するための強力なプラットフォームです。LeadLensは意見を持ちます：ICPを説明するとリサーチを行い、優先順位付きブリーフをお届けします。セットアップ不要、ワークフロー不要、技術的な知識不要。"],
      ["メールリストやコンタクトデータベースを販売していますか？", "いいえ。LeadLensは企業に関する公開されているビジネス情報を分析します。メールリスト、電話データベース、個人の連絡先レコードは販売していません。"],
      ["納品までどのくらいかかりますか？", "ICPフォーム送信後、通常24〜48時間以内に納品します。各Opportunity Portfolioは納品前にレビューします。"],
      ["オポチュニティがICPに合わなかった場合は？", "継続的に失敗し解決できない場合、7日以内に返金を申請できます。返金ポリシーをご確認ください。"],
      ["サブスクリプションや契約はありますか？", "いいえ。Opportunity Portfolioごとの1回払いです。継続課金なし、コミットメントなし、隠れた費用もありません。"],
      ["購入後はどうなりますか？", "ICPフォームを送信します（5分）。市場を調査し、シグナルを検出し、アカウントをスコアリングして、24〜48時間以内にメールでOpportunity Portfolioをお届けします。"],
      ["プレビューは実際のデータを使っていますか？", "いいえ。無料プレビューはサンプルデータを使用して、実際のOpportunity Portfolioの形式と構造を示しています。調査された企業と検証済みシグナルを含む実際のOpportunity Portfolioには、Opportunity Portfolioをご購入ください。"],
    ] as [string, string][],
    ctaTag: "始める",
    ctaTitle: "今週コンタクトすべきアカウントを把握しましょう。",
    ctaSub: "優先順位付けされたOpportunity Portfolio 1件。24〜48時間で納品。実際のアカウント、日付付きの根拠、確かな意思決定。",
    ctaCTA: "最初のOpportunity Preview — $7から →",
    sampleTabs: ["メール", "LinkedIn DM", "フォローアップ 1", "フォローアップ 2"],
    pricePerLead: { sample: "一回払い", starter: "1回払い", standard: "1回払い", pro: "1回払い" },
    samplePackTitle: "コミットする準備ができていませんか？",
    samplePackCopy: "まずOpportunity Portfolioの形式を確認してください — 無料、支払い不要。",
    samplePackBadge: "無料プレビュー",
    samplePackCTA: "サンプルOpportunity Portfolioを見る →",
    samplePackBridge: "本物をご希望ですか？Opportunity Portfolioはシグナルとアウトリーチ戦略付きの5件の調査済み企業ブリーフをお届けします。",
    sampleBridgeFreeDemo: "Opportunity Portfolio形式を確認する",
    sampleBridgeSamplePack: "Opportunity Report — $7から",
    samplePreviewDisclaimer: "このプレビューはサンプルデータを使用してOpportunity Portfolioの構造を示しています。検証済みシグナル付きの実際のOpportunity Portfolioには、Opportunity Portfolioをご購入ください。",
    trustItems: ["ソース検証済みシグナル", "人によるレビュー済み出力", "コンタクトデータベースなし", "7日間返金ポリシー"] as string[],
    afterPurchaseTitle: "購入後の流れ：",
    afterPurchaseSteps: [
      "ICPを送信します — 5分で完了。",
      "LeadLensが市場をマッピングし、ターゲットセグメントを特定します。",
      "シグナルを検出し、各オポチュニティをスコアリングします。",
      "24〜48時間以内にOpportunity Portfolioが届きます。",
    ] as string[],
    afterPurchaseNote: "通常の納品時間：24〜48時間。自動送信は一切ありません。行動する前に各ブリーフをご確認いただけます。",
    faqCtaBridge: "まだ迷っていますか？まずOpportunity Portfolioの形式をご確認ください — 無料、支払い不要です。",
    resultsUpgradeTitle: "実際のコマーシャルインテリジェンスを試す準備ができましたか？",
    resultsUpgradeSub: "Opportunity Portfolioはシグナル、オポチュニティスコア、アウトリーチ戦略付きの5件の企業ブリーフをお届けします — チームによる調査とレビュー済み、24〜48時間で。",
    resultsUpgradeCTA: "Opportunity Report — $7から →",
    checkoutEarlyBanner: "チェックアウトはローンチ前の最終審査中です。お待ちの間、サンプルOpportunity Portfolioのフォーマットをご確認いただけます。",
    comparisonTag: "比較",
    comparisonTitle: "LeadLensはデータベースではありません。意思決定のツールです。",
    comparisonHeaders: ["", "Google", "Apollo / ZoomInfo", "Clay", "LeadLens"] as string[],
    comparisonRows: [
      ["取得できるもの", "ページとリンク", "フィルター用コンタクトレコード", "データインフラ", "ランク付きオポチュニティブリーフ"],
      ["シグナル", "手動で探す", "基本的なインテントデータ", "ワークフローを自体で構築", "ソース付きで自動検出"],
      ["市場マッピング", "手動調査", "業界フィルターのみ", "自分で設定", "自動 — 6〜8セグメント"],
      ["アウトリーチ戦略", "なし", "メールテンプレート", "自分で構築", "シグナルベース、アカウントごと"],
      ["必要な設定", "なし", "学習曲線あり", "技術的な設定", "5分のICPフォーム"],
    ] as string[][],
    b2cTeaserTag: "近日公開",
    b2cTeaserTitle: "LeadLens B2C・地域ビジネス向け",
    b2cTeaserSub: "チャネルアイデア、コンバージョン戦術、競合分析、30日アクションプランを含む顧客獲得プレイブック — 消費者向けビジネスおよびローカルオペレーター向け。",
    b2cTeaserNote: "現在はB2Bのみ。B2Cのローンチ時に通知を受け取るにはウェイトリストにご登録ください。",
    b2cTeaserCTA: "B2Cウェイトリストに登録",
    vizTag: "散在するシグナルから明確な優先順位へ",
    vizTitle: "データだけでなく、視覚的な意思決定ツール。",
    vizSub: "LeadLensは公開市場シグナルを、最初のアウトリーチ前にチームが活用できる視覚的な意思決定ツールに変換します。",
    complianceNote: "LeadLensは公開されている企業情報とビジネスシグナルを分析します。コンタクトデータベース、メールリスト、個人データは販売していません。",
    sFeedbackHook: "この機会は役に立ちましたか？",
    sFeedbackSaved: "フィードバックを保存しました",
    sVaultMemory: "Vault メモリ",
    sVaultValidated: "検証済みパターン",
    sVaultCaution: "注意パターン",
    sVaultInsufficient: "フィードバック不足",
    sVaultPositiveText: "類似の機会について以前にポジティブなフィードバックがあります。",
    sVaultNegativeText: "類似の機会は以前、適合しないまたは有用でないとマークされました。",
    sVaultInsufficientText: "LeadLensはこのセグメントのフィードバックを収集中です。",
    sVaultConfidence: "信頼度",
    sVaultMatchedPatterns: "一致したパターン",
    sAccountMemory: "アカウントメモリ",
    sAccountMemoryNew: "新規オポチュニティ",
    sAccountMemorySeen: "以前に確認済み",
    sAccountMemoryRepeat: "繰り返し — 新シグナルなし",
    sAccountMemoryReactivated: "再活性化 — 新シグナル検出",
    sAccountMemoryUpgraded: "優先度アップ",
    sAccountMemoryDowngraded: "優先度ダウン",
    sAccountMemoryDropped: "対象外へ",
    sAccountMemoryTimesSeen: "回確認",
    sAccountMemoryLastCat: "前回カテゴリ",
    sEvidenceQuality: "エビデンス品質",
    sEvidenceHigh: "高",
    sEvidenceMedium: "中",
    sEvidenceLow: "低",
    sEvidenceInsufficient: "エビデンス不十分",
    sEvidenceGuardrail: "エビデンス品質に基づいて推奨アクションを調整しました。",
    sSourceLayer: "ソース",
    sSourceContextOnly: "コンテキストのみ",
    sSourceTimingSignal: "タイミングシグナル",
    sSourceNoDate: "シグナル日付なし",
    sSourceFreshLabel: "鮮度",
    sSourceLimitedCoverage: "地域カバレッジ限定",
    sSourceDiscovered: "発見",
  },
};

type Copy = typeof COPY["en"];

// ─── Constants ────────────────────────────────────────────────────────────────

// Internal build marker — not rendered publicly. Check browser console (dev only) or grep this file to identify deployed version.
const LANDING_VERSION = "landing-integration-v2-fix-copy";

// Display prices mirror the versioned catalog (lib/products/catalog.ts,
// launch_tier_architecture_v0). The server resolves the REAL price — these are
// presentation only. Launch/founding prices, not permanent.
const PLANS = {
  sample:   { price: "$7",   productCode: "preview_launch_v0" },
  starter:  { price: "$25",  productCode: "brief_launch_v0" },
  standard: { price: "$59",  productCode: "intelligence_launch_v0" },
  pro:      { price: "$129", productCode: "premium_launch_v0" },
} as const;

// Checkout links are public direct-pay URLs from Lemon Squeezy's product "Share" button.
// NEXT_PUBLIC_* is intentional and safe — these URLs contain no secrets; they are the
// same links you would paste in a tweet. No API key or webhook is needed for this flow.
const PUBLIC_PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true";
const LS_URLS: Partial<Record<PlanType, string>> = PUBLIC_PAYMENTS_ENABLED ? {
  sample:   process.env.NEXT_PUBLIC_LEMONSQUEEZY_SAMPLE_URL || undefined,
  starter:  process.env.NEXT_PUBLIC_LEMONSQUEEZY_STARTER_URL || undefined,
  standard: process.env.NEXT_PUBLIC_LEMONSQUEEZY_STANDARD_URL || undefined,
  pro:      process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRO_URL || undefined,
} : {};

// Fire-and-forget product analytics (see app/api/events/route.ts).
function track(event: string, data: Record<string, unknown> = {}) {
  try { void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, ...data }), keepalive: true }); } catch { /* never block UX */ }
}

function trackConversion(event: ConversionEvent, metadata: ConversionMetadata = {}) {
  track(event, safeConversionPayload(event, metadata));
}

const LANG_OPTIONS: { value: OutputLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
  { value: "ja", label: "日本語" },
];

const SAMPLE = {
  company_name: "GrowthForge Studio",
  company_description: "We help B2B SaaS companies improve outbound conversion with better lead research and personalized cold outreach.",
  offer_description: "Done-for-you outbound research and personalized email sequences for B2B SaaS and agencies.",
  value_proposition: "We help founders and VP Sales build a qualified pipeline without hiring a full-time SDR.",
  target_customer_description: "Founders, CEOs, and VP Sales at B2B SaaS companies and software agencies selling high-ticket services ($2k–10k/month).",
  average_ticket: "$2,000–$10,000/month",
  tone: "direct" as const,
  contact_email: "demo@growthforge.io",
  output_language: "en" as OutputLanguage,
  target_market_region: "north_america" as MarketRegion,
};

const EMPTY = {
  company_name: "",
  company_description: "",
  offer_description: "",
  value_proposition: "",
  target_customer_description: "",
  average_ticket: "",
  tone: "direct" as const,
  contact_email: "",
  output_language: "en" as OutputLanguage,
  target_market_region: "global" as MarketRegion,
};

type View = "landing" | "form" | "processing" | "results";

function catInfo(score: number) {
  if (score >= 8) return { label: "HOT",     emoji: "🔥", bg: "#fee2e2", color: "#991b1b" };
  if (score >= 6) return { label: "WARM",    emoji: "🟡", bg: "#fef3c7", color: "#92400e" };
  if (score >= 4) return { label: "COLD",    emoji: "🔵", bg: "#dbeafe", color: "#1e40af" };
  return             { label: "DISCARD", emoji: "⛔", bg: "#f1f5f9", color: "#64748b" };
}

const QC_META: Record<QCStatus, { icon: string; color: string }> = {
  APPROVED:      { icon: "✅", color: "#16a34a" },
  REVIEW_NEEDED: { icon: "⚠️", color: "#d97706" },
  FAILED:        { icon: "❌", color: "#dc2626" },
};

// ─── Root page ────────────────────────────────────────────────────────────────

export default function DemoPipelinePage() {
  const [lang, setLang]           = useState<OutputLanguage>("en");
  const [view, setView]           = useState<View>("landing");
  const [plan, setPlan]           = useState<PlanType>("starter");
  const [form, setForm]           = useState(SAMPLE);
  // Tier-adaptive onboarding (progressive disclosure) — optional, per product.
  const [tierExtras, setTierExtras] = useState<Record<string, string>>({});
  const [agentStep, setStep]      = useState(-1);
  const [progress, setProg]       = useState(0);
  const [report, setReport]       = useState<LeadLensReport | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExp]        = useState<number | null>(null);
  const [formMode, setFormMode]   = useState<"paid_batch" | "sample_demo">("paid_batch");
  const [isSampleDemo, setIsSampleDemo] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const pricingRef = useRef<HTMLElement>(null);
  const pricingSeen = useRef(false);

  // Smooth-scroll to a landing section anchor and close the mobile menu.
  function goToSection(id: string) {
    setNavOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const copy = COPY[lang];

  useEffect(() => { trackConversion("landing_view"); }, []);
  useEffect(() => {
    const node = pricingRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !pricingSeen.current) {
        pricingSeen.current = true;
        trackConversion("pricing_view");
        observer.disconnect();
      }
    }, { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function changeLang(l: OutputLanguage) {
    setLang(l);
    setForm(f => ({ ...f, output_language: l }));
  }

  function goToForm(p: PlanType, source: ConversionMetadata["source_cta"] = "pricing") {
    if (source === "hero") trackConversion("hero_cta_click", { plan: p, source_cta: source });
    if (source === "nav") trackConversion("nav_cta_click", { plan: p, source_cta: source });
    trackConversion("pricing_plan_select", { plan: p, source_cta: source });
    track("tier_selected", { product_code: PLANS[p].productCode, product_version: "launch_v0", launch_price: true, tier: p });
    const lsUrl = LS_URLS[p];
    if (lsUrl) {
      track("checkout_started", { product_code: PLANS[p].productCode, product_version: "launch_v0" });
      window.location.href = lsUrl;
      return;
    }
    track("onboarding_started", { product_code: PLANS[p].productCode, product_version: "launch_v0" });
    trackConversion("onboarding_start", { plan: p, source_cta: source });
    setPlan(p);
    setFormMode("paid_batch");
    setView("form");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function goToDemo() {
    trackConversion("onboarding_start", { plan, source_cta: "demo" });
    setFormMode("sample_demo");
    setIsSampleDemo(false);
    setView("form");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function runPipeline(e: React.FormEvent) {
    e.preventDefault();
    // Payment gate: never run pipeline for paid_batch mode without a checkout link
    if (formMode === "paid_batch") {
      trackConversion("onboarding_error", { plan, error_category: "unavailable" });
      return;
    }
    trackConversion("onboarding_step_complete", { plan, step: 1 });
    trackConversion("onboarding_submit", { plan, step: 1 });
    setError(null);
    setIsSampleDemo(true);
    setView("processing");
    setStep(0);
    setProg(0);

    for (let i = 0; i < copy.agents.length; i++) {
      await delay(620);
      setStep(i);
      setProg(Math.round(((i + 1) / copy.agents.length) * 100));
    }

    try {
      const demoOnboarding = {
        company_name: form.company_name,
        company_description: form.company_description,
        offer_description: form.offer_description,
        value_proposition: form.value_proposition,
        target_customer_description: form.target_customer_description,
        average_ticket: form.average_ticket,
        tone: form.tone,
        contact_email: form.contact_email,
        output_language: form.output_language,
        target_market_region: form.target_market_region,
      };
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, onboarding: demoOnboarding }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      if (!data.report) throw new Error("No report returned from server");
      setReport(data.report as LeadLensReport);
      await delay(300);
      setView("results");
      trackConversion("onboarding_success", { plan });
      setExp(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      trackConversion("onboarding_error", { plan, error_category: "server" });
      setView("form");
    }
  }

  function dlCSV() {
    if (!report) return;
    import("@/lib/utils/export").then(({ exportToCSV }) =>
      saveFile(exportToCSV(report), `leadlens-${report.job_id}.csv`, "text/csv")
    );
  }

  function dlMD() {
    if (!report) return;
    import("@/lib/utils/export").then(({ exportToMarkdown }) =>
      saveFile(exportToMarkdown(report), `leadlens-${report.job_id}.md`, "text/markdown")
    );
  }

  // Shared lang selector rendered in each view's nav
  const LangSelect = () => (
    <select
      aria-label="Language"
      value={lang}
      onChange={e => changeLang(e.target.value as OutputLanguage)}
      style={{ background: "transparent", border: "1px solid #e2e8f0", color: "#64748b", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: ".82rem", fontFamily: "inherit" }}
    >
      {LANG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  // ─── LANDING ──────────────────────────────────────────────────────────────
  if (view === "landing") return (
    <div className="ll-root" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#0f172a", background: "#fff", lineHeight: 1.5 }}>
      <style>{`
        .ll-pricing-grid { display: grid; gap: 1.5rem; max-width: 56rem; margin: 0 auto; align-items: stretch; grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 900px) { .ll-pricing-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 580px) { .ll-pricing-grid { grid-template-columns: 1fr; gap: 1.25rem; padding-top: .875rem; } }
        .ll-hero-grid { display: grid; grid-template-columns: 1fr 1.1fr; gap: 3rem; align-items: center; }
        @media (max-width: 840px) { .ll-hero-grid { grid-template-columns: 1fr; gap: 1.25rem; } .ll-hero-left { text-align: center; display: flex; flex-direction: column; align-items: center; min-width: 0; } .ll-hero-mock { margin-top: 0; width: 100%; min-width: 0; } }
        @media (max-width: 480px) { .ll-hero-mock { overflow: hidden; max-width: 100%; } }
        /* Navbar: single row; section links collapse into a mobile menu (§18–23). */
        .ll-root { overflow-x: hidden; }
        .ll-nav-r { flex-wrap: nowrap !important; min-width: 0; }
        .ll-nav-links { display: flex; }
        .ll-nav-lang { display: inline-flex; }
        .ll-nav-cta { white-space: nowrap; }
        .ll-nav-signin { white-space: nowrap; }
        .ll-nav-burger { display: none; }
        /* Anchor offset so the sticky nav never covers a section heading. */
        section[id], .ll-section { scroll-margin-top: 76px; }
        @media (max-width: 820px) {
          .ll-nav-links { display: none !important; }
          .ll-nav-signin { display: none !important; }
          .ll-nav-lang { display: none !important; }
          .ll-nav-burger { display: inline-flex !important; align-items: center; }
        }
        @media (max-width: 680px) {
          .ll-nav-wrap nav { padding: .625rem 1rem !important; }
          .ll-nav-r { gap: .75rem !important; }
          .ll-nav-cta { font-size: .82rem !important; padding: .5rem .8rem !important; }
        }
        @media (max-width: 380px) {
          .ll-nav-wrap nav { padding: .5rem .75rem !important; }
          .ll-nav-r { gap: .5rem !important; }
          .ll-nav-cta { font-size: .78rem !important; padding: .45rem .65rem !important; }
        }
        @media (max-width: 600px) {
          .ll-proof-outer { flex-wrap: wrap; }
          .ll-proof-item { width: 50%; justify-content: center; }
          .ll-proof-div { display: none; }
          .ll-proof-stat { padding: .75rem .625rem !important; }
          .ll-proof-label { white-space: normal !important; text-align: center; font-size: .72rem; }
          .ll-proof-val { font-size: 1.375rem !important; }
        }
        /* Desktop: show full mockup, hide mobile card */
        .ll-hero-mock-desktop { display: block; }
        .ll-hero-mock-mobile  { display: none; }
        @media (max-width: 640px) {
          /* Sections */
          .ll-section { padding: 2.25rem 1rem !important; }
          .ll-problem-sec { padding: 3rem 1rem !important; }
          .ll-cta-sec { padding: 2.5rem 1rem !important; }
          .ll-hero-outer { padding: 1.75rem 1rem 1.5rem !important; }
          .ll-faq-inner { padding: 0 1rem !important; }
          .ll-monthly-card { padding: 1.5rem 1.125rem !important; }
          /* Hero text */
          .ll-hero-badge   { margin-bottom: .875rem !important; font-size: .74rem !important; padding: .3rem .875rem .3rem .55rem !important; }
          .ll-hero-h1      { font-size: 1.875rem !important; line-height: 1.15 !important; letter-spacing: -.02em !important; margin-bottom: .75rem !important; }
          .ll-hero-sub     { font-size: .9rem !important; line-height: 1.55 !important; margin-bottom: 1rem !important; }
          .ll-hero-cta-row { flex-direction: column !important; gap: .5rem !important; margin-bottom: .75rem !important; }
          .ll-hero-cta-row button { width: 100% !important; justify-content: center !important; box-sizing: border-box !important; padding-left: 1rem !important; padding-right: 1rem !important; white-space: normal !important; }
          .ll-hero-note    { font-size: .75rem !important; padding: .275rem .875rem !important; margin-bottom: .4rem !important; }
          .ll-hero-demo-link { font-size: .78rem !important; }
          /* Swap mockups */
          .ll-hero-mock-desktop { display: none !important; }
          .ll-hero-mock-mobile  { display: block !important; }
        }
        @media (max-width: 430px) {
          .ll-hero-h1  { font-size: 1.75rem !important; }
          .ll-hero-sub { font-size: .875rem !important; }
        }
        @media (max-width: 375px) {
          .ll-hero-h1  { font-size: 1.625rem !important; }
          .ll-hero-sub { font-size: .85rem !important; }
        }
      `}</style>

      {/* Announcement bar */}
      <div style={{ background: "linear-gradient(135deg,#075985,#0284c7)", color: "#fff", textAlign: "center", padding: ".55rem 1rem", fontSize: ".8rem", fontWeight: 500, letterSpacing: ".01em" }}>
        {copy.announcement}{" "}
        <button onClick={() => goToForm("standard", "announcement")} style={{ background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.3)", color: "#fff", fontSize: ".78rem", fontWeight: 700, borderRadius: 5, padding: "2px 12px", cursor: "pointer", marginLeft: 8, transition: "background .15s" }}
          onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,.28)")}
          onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,.18)")}
        >
          {copy.announcementCTA}
        </button>
      </div>

      {/* Nav */}
      {(() => {
      const NAV_SECTIONS = [
        { id: "how-it-works", label: copy.navHow },
        { id: "sample", label: copy.navSample },
        { id: "pricing", label: copy.navPricing },
        { id: "faq", label: copy.navFaq },
      ];
      return (
      <div className="ll-nav-wrap" style={{ borderBottom: "1px solid #e8f4fd", position: "sticky", top: 0, background: "rgba(255,255,255,.96)", backdropFilter: "blur(12px)", zIndex: 40, boxShadow: "0 1px 0 #e8f4fd" }}>
        <nav style={{ padding: ".875rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "72rem", margin: "0 auto", gap: "1rem" }}>
          <span style={{ fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-.03em", color: "#0f172a", flexShrink: 0 }}>
            Lead<span style={{ color: "#0ea5e9" }}>Lens</span>
          </span>
          {/* Desktop section links */}
          <div className="ll-nav-links" style={{ display: "flex", alignItems: "center", gap: "1.75rem" }}>
            {NAV_SECTIONS.map(sx => (
              <button key={sx.id} onClick={() => goToSection(sx.id)} style={navLinkStyle}>{sx.label}</button>
            ))}
          </div>
          <div className="ll-nav-r" style={{ display: "flex", alignItems: "center", gap: "1.1rem" }}>
            <a className="ll-nav-signin" href="/login" style={{ ...navLinkStyle, textDecoration: "none" }}>
              {copy.navSignIn}
            </a>
            <span className="ll-nav-lang"><LangSelect /></span>
            <span className="ll-nav-cta"><Btn onClick={() => goToForm("standard", "nav")}>{copy.navCTA}</Btn></span>
            <button
              className="ll-nav-burger"
              aria-label="Menu"
              aria-expanded={navOpen}
              aria-controls="ll-nav-panel"
              onClick={() => setNavOpen(o => !o)}
              style={{ display: "none", background: "none", border: "none", cursor: "pointer", fontSize: "1.35rem", lineHeight: 1, color: "#0f172a", padding: ".25rem .35rem" }}
            >
              {navOpen ? "✕" : "☰"}
            </button>
          </div>
        </nav>
        {/* Mobile dropdown panel */}
        {navOpen && (
          <div id="ll-nav-panel" className="ll-nav-panel" style={{ borderTop: "1px solid #e8f4fd", background: "#fff", padding: ".5rem 1.25rem 1rem" }}>
            {NAV_SECTIONS.map(sx => (
              <button key={sx.id} onClick={() => goToSection(sx.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", padding: ".7rem .25rem", fontSize: ".95rem", fontWeight: 600, color: "#334155", cursor: "pointer", fontFamily: "inherit" }}>{sx.label}</button>
            ))}
            <a href="/login" style={{ display: "block", width: "100%", padding: ".7rem .25rem", fontSize: ".95rem", fontWeight: 600, color: "#334155", textDecoration: "none", borderBottom: "1px solid #f1f5f9" }}>{copy.navSignIn}</a>
            <div style={{ marginTop: ".85rem" }}>
              <Btn onClick={() => { setNavOpen(false); goToForm("standard", "nav"); }}>{copy.navCTA}</Btn>
            </div>
          </div>
        )}
      </div>
      );
      })()}

      {/* Hero */}
      <div style={{ background: "linear-gradient(170deg,#e0f2fe 0%,#f0f9ff 35%,#fff 75%)" }}>
        <div className="ll-hero-outer" style={{ maxWidth: "74rem", margin: "0 auto", padding: "3.25rem 1.5rem 2.75rem" }}>
          <div className="ll-hero-grid">
            {/* Left column — text + CTAs */}
            <div className="ll-hero-left">
              <div className="ll-hero-badge" style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", background: "#fff", border: "1px solid #bae6fd", borderRadius: 999, padding: ".35rem 1rem .35rem .6rem", fontSize: ".8rem", fontWeight: 600, color: "#0284c7", marginBottom: "1.75rem", boxShadow: "0 2px 8px rgba(14,165,233,.12)" }}>
                <span style={{ width: ".5rem", height: ".5rem", background: "#16a34a", borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
                {copy.heroBadge}
              </div>
              <h1 className="ll-hero-h1" style={{ fontSize: "clamp(2.1rem,4.5vw,3.5rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: ".5rem", letterSpacing: "-.03em" }}>
                {copy.heroH1pre}<br />
                <span style={{ color: "#0ea5e9" }}>{copy.heroH1hi}</span>{copy.heroH1post}
              </h1>
              <p style={{ fontSize: "clamp(1.25rem,2.5vw,1.75rem)", fontWeight: 700, color: "#334155", marginBottom: "1.25rem", letterSpacing: "-.02em", lineHeight: 1.2 }}>
                {copy.heroH2}
              </p>
              <p className="ll-hero-sub" style={{ fontSize: "1.1rem", color: "#475569", marginBottom: "2.25rem", lineHeight: 1.7, maxWidth: "34rem" }}>
                {copy.heroSub}
              </p>
              <div className="ll-hero-cta-row" style={{ display: "flex", gap: ".875rem", flexWrap: "wrap" as const, marginBottom: ".55rem" }}>
                <Btn lg onClick={() => goToForm("standard", "hero")}>{copy.heroCTA}</Btn>
                <BtnOutline lg onClick={() => goToSection("sample")}>{copy.heroSeeAll}</BtnOutline>
              </div>
              <p style={{ fontSize: ".8rem", color: "#94a3b8", margin: "0 0 1.1rem" }}>{copy.heroPriceNote}</p>
              <p className="ll-hero-note" style={{ display: "inline-block", fontSize: ".82rem", color: "#64748b", background: "#f0f9ff", border: "1px solid #e0f2fe", borderRadius: 999, padding: ".375rem 1rem", marginBottom: ".75rem" }}>
                {copy.heroNote}
              </p>
              <button className="ll-hero-demo-link" onClick={goToDemo} style={{ display: "block", background: "none", border: "none", color: "#94a3b8", fontSize: ".82rem", cursor: "pointer", textDecoration: "underline", padding: ".25rem 0" }}>
                {copy.tryDemoCTA} →
              </button>
            </div>
            {/* Right column — product mockup (desktop) / preview card (mobile) */}
            <div className="ll-hero-mock">
              <div className="ll-hero-mock-desktop"><LeadMockupHero /></div>
              <div className="ll-hero-mock-mobile"><LeadMockupMobile /></div>
            </div>
          </div>
        </div>
      </div>

      {/* Proof bar */}
      <div style={{ background: "#fff", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0", padding: "1.75rem 1.5rem" }}>
        <div className="ll-proof-outer" style={{ maxWidth: "56rem", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: "0" }}>
          {copy.proofLabels.map(([v, l], i) => (
            <div key={l} className="ll-proof-item" style={{ display: "flex", alignItems: "center" }}>
              <div className="ll-proof-stat" style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: ".2rem", padding: "0 2.25rem" }}>
                <span className="ll-proof-val" style={{ fontSize: "1.625rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em", lineHeight: 1 }}>{v}</span>
                <span className="ll-proof-label" style={{ fontSize: ".78rem", color: "#64748b", fontWeight: 500, whiteSpace: "nowrap" as const }}>{l}</span>
              </div>
              {i < copy.proofLabels.length - 1 && (
                <div className="ll-proof-div" style={{ width: "1px", height: "2rem", background: "#e2e8f0", flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Curiosity band */}
      <div style={{ background: "#0f172a", color: "#fff", padding: "2.5rem 1.5rem", textAlign: "center" }}>
        <p style={{ maxWidth: "42rem", margin: "0 auto", fontSize: "clamp(1.35rem,3vw,1.85rem)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.25 }}>
          {copy.heroCuriosity}
        </p>
        <p style={{ margin: ".7rem auto 0", color: "#7dd3fc", fontSize: ".9rem", fontWeight: 600 }}>{copy.heroBadge}</p>
      </div>

      {/* How it works */}
      <section id="how-it-works" className="ll-section" style={{ ...sectionStyle, background: "#f8fafc" }}>
        <div style={innerStyle}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <Tag>{copy.howTag}</Tag>
            <h2 style={sectionTitleStyle}>{copy.howTitle}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "1.5rem" }}>
            {copy.steps.map(([n, t, d]) => (
              <div key={n} style={{ textAlign: "center" }}>
                <div style={{ width: "3rem", height: "3rem", background: "#0ea5e9", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.15rem", fontWeight: 800, margin: "0 auto 1rem", boxShadow: "0 4px 12px rgba(14,165,233,.35)" }}>{n}</div>
                <h3 style={{ fontWeight: 700, marginBottom: ".4rem", fontSize: ".975rem" }}>{t}</h3>
                <p style={{ color: "#64748b", fontSize: ".865rem", lineHeight: 1.55 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sample report preview */}
      <section id="sample" className="ll-section" style={{ ...sectionStyle, background: "#fff" }}>
        <div style={{ ...innerStyle, textAlign: "center" }}>
          <Tag>{copy.samplePreviewTag}</Tag>
          <h2 style={sectionTitleStyle}>{copy.samplePreviewTitle}</h2>
          <p style={{ color: "#64748b", fontSize: "1.05rem", maxWidth: "36rem", margin: "0 auto 3rem", lineHeight: 1.6 }}>
            {copy.samplePreviewSub}
          </p>
          {/* Sample data disclaimer */}
          <p style={{ fontSize: ".8rem", color: "#94a3b8", maxWidth: "36rem", margin: "0 auto 1.5rem", lineHeight: 1.55, background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: ".5rem", padding: ".5rem .875rem", display: "inline-block" }}>
            ℹ️ {copy.samplePreviewDisclaimer}
          </p>

          {/* Report Preview / Sample Pack bridge */}
          <div style={{ display: "flex", gap: ".75rem", justifyContent: "center", flexWrap: "wrap" as const, marginBottom: "2rem" }}>
            <button onClick={goToDemo} style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", background: "#f0f9ff", border: "1.5px solid #bae6fd", color: "#0284c7", borderRadius: 999, padding: ".4rem 1.125rem", fontSize: ".8rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              📄 {copy.sampleBridgeFreeDemo} →
            </button>
            <button onClick={() => goToForm("sample", "sample_bridge")} style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", background: "#fffbeb", border: "1.5px solid #fde68a", color: "#92400e", borderRadius: 999, padding: ".4rem 1.125rem", fontSize: ".8rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              ⭐ {copy.sampleBridgeSamplePack} →
            </button>
          </div>

          {/* Sample Account Brief */}
          <div style={{ maxWidth: "56rem", margin: "0 auto", background: "#fff", border: "2px solid #e2e8f0", borderRadius: "1.25rem", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.07)", textAlign: "left" as const }}>

            {/* Brief header */}
            <div style={{ padding: "1.125rem 1.5rem", borderBottom: "1px solid #f1f5f9", background: "linear-gradient(180deg,#f8fafc 0%,#fff 100%)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "1rem" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginBottom: ".35rem", flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", background: "#e0f2fe", color: "#0284c7", padding: ".15rem .5rem", borderRadius: 999 }}>Sample · Illustrative data</span>
                  <span style={{ fontSize: ".65rem", color: "#94a3b8" }}>Account Brief</span>
                </div>
                <div style={{ fontWeight: 800, fontSize: "1.2rem", color: "#0f172a", letterSpacing: "-.02em", lineHeight: 1.2 }}>Northstar Logistics</div>
                <div style={{ fontSize: ".8rem", color: "#64748b", marginTop: ".2rem" }}>Mid-market logistics · regional freight · United States (Midwest)</div>
                <div style={{ fontSize: ".72rem", color: "#94a3b8", marginTop: ".25rem" }}>
                  Account resolved · parent: Northstar Group · commercial unit: Logistics division
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: ".4rem", flexShrink: 0 }}>
                <DecisionPill state="prioritize" />
                <div style={{ fontSize: ".68rem", color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap" as const }}>Evidence refreshed 9d ago</div>
                <div style={{ fontSize: ".68rem", color: "#94a3b8", whiteSpace: "nowrap" as const }}>Decision scope: <span style={{ color: "#475569", fontWeight: 600 }}>Regional</span> <span style={{ color: "#cbd5e1" }}>(corporate unconfirmed)</span></div>
              </div>
            </div>

            {/* Opportunity Thesis */}
            <div style={{ padding: "1.25rem 1.5rem 0" }}>
              <BriefSection label="Opportunity Thesis">
                <div style={{ background: "#f0f9ff", border: "1px solid #e0f2fe", borderLeft: "3px solid #0ea5e9", borderRadius: "0 .5rem .5rem 0", padding: ".8rem .95rem", fontSize: ".875rem", color: "#0f172a", lineHeight: 1.6 }}>
                  Northstar is expanding regional distribution while adding operations capacity — a combination that plausibly increases supplier and tooling needs. The evidence is recent and partly corroborated, but <strong>no procurement event is confirmed</strong>, so this is a fit-and-timing thesis worth validating, not a confirmed signal.
                </div>
              </BriefSection>
            </div>

            {/* What Changed — fact vs interpretation */}
            <div style={{ padding: "1.25rem 1.5rem 0" }}>
              <BriefSection label="What Changed">
                <div style={{ display: "flex", flexDirection: "column" as const, gap: ".3rem", marginBottom: ".65rem" }}>
                  {[
                    ["Signed a regional distribution agreement", "company announcement · 9d ago"],
                    ["Opened 2 new distribution sites", "regional press · 14d ago"],
                    ["Posted 4 operations roles", "company careers page · 12d ago"],
                  ].map(([fact, meta], i) => (
                    <div key={i} style={{ display: "flex", gap: ".55rem", alignItems: "baseline", fontSize: ".845rem", color: "#334155", lineHeight: 1.5 }}>
                      <span style={{ fontSize: ".56rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#0369a1", background: "#f0f9ff", border: "1px solid #e0f2fe", borderRadius: ".25rem", padding: ".05rem .3rem", flexShrink: 0 }}>Observed</span>
                      <span style={{ minWidth: 0 }}>{fact} <span style={{ color: "#94a3b8", fontSize: ".72rem" }}>— {meta}</span></span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#fafafa", border: "1px dashed #e2e8f0", borderRadius: ".5rem", padding: ".6rem .8rem", fontSize: ".8rem", color: "#64748b", lineHeight: 1.55 }}>
                  <span style={{ fontSize: ".56rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#b45309", marginRight: ".4rem" }}>Interpretation</span>
                  Regional expansion may increase supplier complexity and creates a plausible timing window — worth validating, not evidence of active buying.
                </div>
              </BriefSection>
            </div>

            {/* Fit + Timing */}
            <div style={{ padding: "1.25rem 1.5rem 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "1.5rem" }}>
              <BriefSection label="Fit">
                <div style={{ fontSize: ".845rem", color: "#334155", lineHeight: 1.6 }}>
                  Growing logistics operator in active regional expansion. Operations-led growth aligns with the commercial context — the kind of account where new vendor and tooling needs typically emerge.
                  <div style={{ marginTop: ".4rem", fontSize: ".72rem", color: "#94a3b8" }}>Fit strength: <span style={{ color: "#0f172a", fontWeight: 700 }}>Strong</span></div>
                </div>
              </BriefSection>
              <BriefSection label="Timing">
                <div style={{ fontSize: ".845rem", color: "#334155", lineHeight: 1.6 }}>
                  Expansion and hiring occurred within the last two weeks. Recent change creates a plausible timing window — not a confirmed procurement cycle.
                  <div style={{ marginTop: ".4rem", fontSize: ".72rem", color: "#94a3b8" }}>Timing strength: <span style={{ color: "#0f172a", fontWeight: 700 }}>Strong</span></div>
                </div>
              </BriefSection>
            </div>

            {/* Evidence */}
            <div style={{ padding: "1.25rem 1.5rem 0" }}>
              <BriefSection label="Evidence">
                <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" as const, marginBottom: ".55rem" }}>
                  <span style={{ fontSize: ".72rem", color: "#475569" }}>Strength: <span style={{ color: "#0f172a", fontWeight: 700 }}>Strong</span></span>
                  <span style={{ color: "#cbd5e1" }}>·</span>
                  <span style={{ fontSize: ".72rem", color: "#475569" }}>3 sources</span>
                  <span style={{ color: "#cbd5e1" }}>·</span>
                  <span style={{ fontSize: ".72rem", color: "#16a34a", fontWeight: 600 }}>2 corroborate the expansion</span>
                </div>
                {[
                  ["Company announcement", "distribution agreement", "9d ago"],
                  ["Company careers page", "operations roles", "12d ago"],
                  ["Industry publication", "new distribution sites", "21d ago"],
                ].map(([type, what, date], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem", fontSize: ".8rem", color: "#334155", padding: ".28rem 0", borderTop: i === 0 ? "none" : "1px solid #f8fafc", lineHeight: 1.4 }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontSize: ".62rem", fontWeight: 600, color: "#94a3b8", fontStyle: "italic" as const, marginRight: ".4rem" }}>Illustrative source</span>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>{type}</span> <span style={{ color: "#64748b" }}>— {what}</span>
                    </span>
                    <span style={{ fontSize: ".7rem", color: "#94a3b8", whiteSpace: "nowrap" as const, flexShrink: 0 }}>{date}</span>
                  </div>
                ))}
              </BriefSection>
            </div>

            {/* Counterevidence / Uncertainty */}
            <div style={{ padding: "1.25rem 1.5rem 0" }}>
              <BriefSection label="Counterevidence & Uncertainty">
                <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", borderLeft: "3px solid #d97706", borderRadius: "0 .5rem .5rem 0", padding: ".75rem .9rem" }}>
                  {[
                    "No procurement event or vendor evaluation confirmed",
                    "Distribution expansion may relate to a different division",
                    "Timing evidence is more recent than the fit evidence",
                    "Decision scope (corporate vs regional) is unresolved",
                  ].map((c, i) => (
                    <div key={i} style={{ display: "flex", gap: ".5rem", fontSize: ".82rem", color: "#92400e", padding: ".15rem 0", lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 700, flexShrink: 0 }}>–</span>{c}
                    </div>
                  ))}
                </div>
              </BriefSection>
            </div>

            {/* Decision dimensions (secondary) */}
            <div style={{ padding: "1.25rem 1.5rem 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "1rem" }}>
              {[
                ["Account Attractiveness", "Strong", "#0f172a"],
                ["Commercial Accessibility", "Partial", "#475569"],
                ["Strategic Value", "Moderate", "#475569"],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: ".6rem", padding: ".6rem .75rem" }}>
                  <div style={{ fontSize: ".6rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".05em", color: "#94a3b8", marginBottom: ".2rem" }}>{label}</div>
                  <div style={{ fontSize: ".875rem", fontWeight: 700, color }}>{val}</div>
                </div>
              ))}
            </div>

            {/* What to Validate + Next Commercial Decision */}
            <div style={{ padding: "1.25rem 1.5rem 1.375rem", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "1.5rem" }}>
              <BriefSection label="What to Validate">
                {[
                  "Confirm whether procurement is centralized at group level",
                  "Check whether new sites use the same supplier network",
                  "Verify the expansion affects your target category",
                ].map((v, i) => (
                  <div key={i} style={{ display: "flex", gap: ".5rem", fontSize: ".845rem", color: "#334155", padding: ".2rem 0", lineHeight: 1.5 }}>
                    <span style={{ color: "#0284c7", fontWeight: 700, flexShrink: 0 }}>→</span>{v}
                  </div>
                ))}
              </BriefSection>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: ".75rem" }}>
                <BriefSection label="Next Commercial Decision">
                  <div style={{ background: "#f0f9ff", border: "1px solid #e0f2fe", borderRadius: ".6rem", padding: ".7rem .85rem", fontSize: ".845rem", color: "#0f172a", lineHeight: 1.55 }}>
                    <DecisionPill state="prioritize" small /> <span style={{ margin: "0 .2rem", color: "#94a3b8" }}>→</span>
                    validate procurement scope before any outreach.
                  </div>
                </BriefSection>
                <div style={{ fontSize: ".72rem", color: "#94a3b8", lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600, color: "#64748b" }}>Optional commercial angle:</span> if validated, reference the regional-expansion context rather than a generic pitch.
                </div>
              </div>
            </div>

            {/* Footer — sample honesty */}
            <div style={{ padding: ".8rem 1.5rem", background: "#f8fafc", borderTop: "1px solid #f1f5f9", fontSize: ".7rem", color: "#94a3b8", lineHeight: 1.5 }}>
              Illustrative example — synthetic company, events, dates and sources shown to demonstrate the format of a real Account Brief. LeadLens grounds every conclusion in dated public evidence and states what remains unconfirmed.
            </div>
          </div>
        </div>
      </section>

      {/* Visualizations */}

      {/* Pricing */}
      <section id="pricing" ref={pricingRef} className="ll-section" style={{ ...sectionStyle, background: "#f8fafc" }}>
        <div style={{ ...innerStyle, textAlign: "center" }}>
          <Tag>{copy.pricingTag}</Tag>
          <h2 style={sectionTitleStyle}>{copy.pricingTitle}</h2>
          <p style={{ color: "#64748b", fontSize: "1.05rem", maxWidth: "36rem", margin: "0 auto 3rem", lineHeight: 1.6 }}>
            {copy.pricingSub}
          </p>

          {/* Pricing ladder — 4 tiers: validate → select → prioritize → strategize */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(255px,1fr))", gap: "1.25rem", maxWidth: "80rem", margin: "0 auto", alignItems: "stretch" }}>
            <PricingCard plan="sample"   featured={false} copy={copy} onSelect={goToForm} />
            <PricingCard plan="starter"  featured={false} copy={copy} onSelect={goToForm} />
            <PricingCard plan="standard" featured={true}  copy={copy} onSelect={goToForm} />
            <PricingCard plan="pro"      featured={false} copy={copy} onSelect={goToForm} />
          </div>
          <p style={{ fontSize: ".8rem", color: "#94a3b8", maxWidth: "40rem", margin: "1.25rem auto 0" }}>{copy.launchNote}</p>

          {/* Plan comparison */}
          <ComparisonTable copy={copy} />

          {/* Opportunity Monitor strip — coming soon */}
          <div style={{ marginTop: "2rem", maxWidth: "62rem", margin: "2rem auto 0", background: "linear-gradient(135deg,#f0f9ff,#e0f2fe)", border: "1px solid #bae6fd", borderRadius: "1.125rem", padding: "1.5rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" as const }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: ".625rem", marginBottom: ".625rem", flexWrap: "wrap" as const }}>
                <span style={{ display: "inline-block", background: "#0ea5e9", color: "#fff", fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", padding: ".2rem .65rem", borderRadius: 999 }}>
                  {copy.monthlyTag}
                </span>
                <span style={{ fontSize: ".8rem", fontWeight: 600, color: "#0284c7" }}>{copy.monitorPrice}</span>
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em", marginBottom: ".375rem" }}>{copy.monthlyTitle}</h3>
              <p style={{ fontSize: ".875rem", color: "#475569", lineHeight: 1.6, margin: 0, maxWidth: "40rem" }}>{copy.monthlySub}</p>
            </div>
            <button onClick={() => goToForm("sample", "monitor")}
              style={{ background: "none", border: "1.5px solid #0ea5e9", color: "#0284c7", borderRadius: ".75rem", padding: ".7rem 1.375rem", fontWeight: 600, fontSize: ".875rem", cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0, transition: "all .15s", fontFamily: "inherit" }}
              onMouseOver={e => { e.currentTarget.style.background = "#e0f2fe"; }}
              onMouseOut={e => { e.currentTarget.style.background = "none"; }}
            >
              {copy.monitorCTA}
            </button>
          </div>

          {/* Trust row */}
          <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", flexWrap: "wrap" as const, marginTop: "2rem" }}>
            {copy.trustItems.map((item, i) => (
              <span key={i} style={{ fontSize: ".78rem", color: "#64748b", display: "flex", alignItems: "center", gap: ".3rem" }}>
                <span style={{ color: "#16a34a", fontWeight: 700 }}>✓</span>{item}
              </span>
            ))}
          </div>

          {/* After you buy */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "1rem", padding: "1.5rem 2rem", maxWidth: "44rem", margin: "1.5rem auto 0", textAlign: "left" as const }}>
            <p style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: "1rem" }}>
              {copy.afterPurchaseTitle}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: ".875rem" }}>
              {copy.afterPurchaseSteps.map((step, i) => (
                <div key={i} style={{ display: "flex", gap: ".625rem", alignItems: "flex-start" }}>
                  <span style={{ width: "1.375rem", height: "1.375rem", minWidth: "1.375rem", background: "#0ea5e9", color: "#fff", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".68rem", fontWeight: 800 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: ".83rem", color: "#475569", lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: ".78rem", color: "#94a3b8", marginTop: "1rem", marginBottom: 0, textAlign: "center" as const, lineHeight: 1.5 }}>
              {copy.afterPurchaseNote}
            </p>
          </div>
        </div>
      </section>

      {/* Problem — LeadLens blue/white premium */}

      {/* Comparison */}
      <section className="ll-section" style={{ ...sectionStyle, background: "#fff" }}>
        <div style={{ ...innerStyle }}>
          <Tag>{copy.comparisonTag}</Tag>
          <h2 style={{ ...sectionTitleStyle, maxWidth: "36rem" }}>{copy.comparisonTitle}</h2>
          <div style={{ overflowX: "auto" as const, marginTop: "2.5rem", borderRadius: "1rem", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const, minWidth: "520px", fontSize: ".875rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  {copy.comparisonHeaders.map((h, i) => (
                    <th key={i} style={{
                      padding: ".875rem 1.125rem",
                      textAlign: i === 0 ? "left" as const : "center" as const,
                      fontWeight: 700,
                      color: i === copy.comparisonHeaders.length - 1 ? "#0284c7" : "#475569",
                      fontSize: i === copy.comparisonHeaders.length - 1 ? ".875rem" : ".8rem",
                      letterSpacing: ".03em",
                      background: i === copy.comparisonHeaders.length - 1 ? "#f0f9ff" : "transparent",
                      borderLeft: i === copy.comparisonHeaders.length - 1 ? "2px solid #bae6fd" : "none",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {copy.comparisonRows.map((row, ri) => (
                  <tr key={ri} style={{ borderBottom: ri < copy.comparisonRows.length - 1 ? "1px solid #f1f5f9" : "none", background: ri % 2 === 0 ? "#fff" : "#fafbfc" }}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{
                        padding: ".875rem 1.125rem",
                        textAlign: ci === 0 ? "left" as const : "center" as const,
                        color: ci === 0 ? "#0f172a" : ci === row.length - 1 ? "#0f172a" : "#94a3b8",
                        fontWeight: ci === 0 ? 600 : ci === row.length - 1 ? 600 : 400,
                        background: ci === row.length - 1 ? "#f0f9ff" : "transparent",
                        borderLeft: ci === row.length - 1 ? "2px solid #bae6fd" : "none",
                        fontSize: ".875rem",
                        lineHeight: 1.5,
                      }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* What you receive */}
      <section className="ll-section" style={{ ...sectionStyle, background: "#fff" }}>
        <div style={{ ...innerStyle, textAlign: "center" }}>
          <Tag>{copy.receiveTag}</Tag>
          <h2 style={sectionTitleStyle}>{copy.receiveTitle}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: ".875rem", marginTop: "2.5rem", textAlign: "left" }}>
            {copy.receiveItems.map(([title, desc], i) => (
              <div key={i} style={{ display: "flex", gap: ".75rem", alignItems: "flex-start", background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: ".75rem", padding: "1rem 1.125rem" }}>
                <div style={{ width: "1.5rem", height: "1.5rem", background: "#0ea5e9", color: "#fff", borderRadius: ".4rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".68rem", fontWeight: 800, flexShrink: 0, marginTop: ".05rem" }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: ".855rem", color: "#0f172a", marginBottom: ".15rem" }}>{title}</div>
                  <div style={{ fontSize: ".8rem", color: "#64748b", lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Beta delivery expectations */}

      {/* FAQ */}
      <section id="faq" className="ll-section" style={{ ...sectionStyle, background: "#fff" }}>
        <div className="ll-faq-inner" style={{ maxWidth: "46rem", margin: "0 auto", padding: "0 1.5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <Tag>{copy.faqTag}</Tag>
            <h2 style={sectionTitleStyle}>{copy.faqTitle}</h2>
          </div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: "1rem", overflow: "hidden" }}>
            {copy.faqs.map(([q, a], i) => (
              <div key={i} style={{ padding: "1.25rem 1.5rem", borderBottom: i < copy.faqs.length - 1 ? "1px solid #f1f5f9" : "none", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                <div style={{ fontWeight: 700, fontSize: ".925rem", color: "#0f172a", marginBottom: ".5rem", display: "flex", gap: ".75rem", alignItems: "flex-start" }}>
                  <span style={{ color: "#0ea5e9", fontWeight: 800, flexShrink: 0, fontSize: ".85rem", marginTop: ".1rem" }}>Q</span>
                  {q}
                </div>
                <div style={{ fontSize: ".875rem", color: "#64748b", lineHeight: 1.65, paddingLeft: "1.375rem" }}>{a}</div>
              </div>
            ))}
          </div>
          {/* FAQ → CTA bridge */}
          <div style={{ marginTop: "1.75rem", textAlign: "center" }}>
            <span style={{ fontSize: ".875rem", color: "#64748b" }}>{copy.faqCtaBridge}{" "}</span>
            <button onClick={goToDemo} style={{ background: "none", border: "none", color: "#0ea5e9", fontSize: ".875rem", fontWeight: 600, cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>
              {copy.tryDemoCTA} →
            </button>
          </div>
        </div>
      </section>

      {/* B2C Teaser */}

      {/* Final CTA */}
      <section className="ll-cta-sec" style={{ background: "linear-gradient(135deg,#0c4a6e 0%,#0284c7 100%)", padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: "42rem", margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "rgba(255,255,255,.15)", color: "#e0f2fe", fontSize: ".75rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".06em", padding: ".25rem .875rem", borderRadius: 999, marginBottom: "1.25rem" }}>
            {copy.ctaTag}
          </div>
          <h2 style={{ fontSize: "clamp(1.75rem,4vw,2.5rem)", fontWeight: 800, color: "#fff", letterSpacing: "-.02em", marginBottom: "1rem", lineHeight: 1.15 }}>
            {copy.ctaTitle}
          </h2>
          <p style={{ fontSize: "1.1rem", color: "#bae6fd", marginBottom: "2.5rem", lineHeight: 1.6 }}>
            {copy.ctaSub}
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" as const }}>
            <button onClick={() => goToForm("starter", "final")}
              style={{ background: "#fff", color: "#0284c7", border: "none", borderRadius: ".75rem", padding: "1rem 2rem", fontWeight: 700, fontSize: "1rem", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,.15)", transition: "all .15s" }}
              onMouseOver={e => { e.currentTarget.style.background = "#f0f9ff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseOut={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = ""; }}
            >
              {copy.ctaCTA}
            </button>
            <button onClick={goToDemo}
              style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1.5px solid rgba(255,255,255,.3)", borderRadius: ".75rem", padding: "1rem 2rem", fontWeight: 600, fontSize: "1rem", cursor: "pointer", transition: "all .15s" }}
              onMouseOver={e => { e.currentTarget.style.background = "rgba(255,255,255,.22)"; }}
              onMouseOut={e => { e.currentTarget.style.background = "rgba(255,255,255,.15)"; }}
            >
              {copy.tryDemoCTA} →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #f1f5f9", padding: "2.5rem 1.5rem", textAlign: "center" }}>
        <p style={{ color: "#94a3b8", fontSize: ".875rem", marginBottom: ".35rem" }}>
          {copy.footerCopy}
        </p>
        <p style={{ color: "#94a3b8", fontSize: ".82rem", marginBottom: ".875rem", overflowWrap: "break-word" as const }}>
          {copy.footerContact}
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          {copy.footerLinks.map((l, i) => {
            const hrefs = ["/privacy", "/terms", "/refund", "mailto:martinfgaleano@gmail.com"];
            return (
              <a key={l} href={hrefs[i] ?? "#"} style={{ color: "#94a3b8", fontSize: ".82rem", textDecoration: "none" }}
                onMouseOver={e => (e.currentTarget.style.color = "#64748b")}
                onMouseOut={e => (e.currentTarget.style.color = "#94a3b8")}
              >{l}</a>
            );
          })}
        </div>
        <p style={{ color: "#cbd5e1", fontSize: ".75rem", marginTop: "1.25rem", maxWidth: "38rem", margin: "1.25rem auto 0", lineHeight: 1.6 }}>
          {copy.complianceNote}
        </p>
      </footer>
    </div>
  );

  // ─── FORM ─────────────────────────────────────────────────────────────────
  if (view === "form") return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#0f172a" }}>
      {/* Top bar */}
      <div style={{ background: "linear-gradient(135deg,#0c4a6e,#0284c7)", color: "#fff", textAlign: "center", padding: ".5rem 1rem", fontSize: ".8rem", fontWeight: 500 }}>
        {copy.announcement}
      </div>
      <header style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: ".875rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 30 }}>
        <button onClick={() => setView("landing")} style={{ fontWeight: 800, fontSize: "1.1rem", background: "none", border: "none", cursor: "pointer", letterSpacing: "-.02em" }}>
          Lead<span style={{ color: "#0ea5e9" }}>Lens</span>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <select
            aria-label="Language"
            value={lang}
            onChange={e => changeLang(e.target.value as OutputLanguage)}
            style={{ background: "transparent", border: "1px solid #e2e8f0", color: "#64748b", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: ".82rem", fontFamily: "inherit" }}
          >
            {LANG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={() => setView("landing")} style={navLinkStyle}>{copy.backBtn}</button>
        </div>
      </header>

      <div style={{ maxWidth: "42rem", margin: "0 auto", padding: "3rem 1.5rem" }} ref={formRef}>
        {/* Checkout pending early notice — shown before form when no LS URL */}
        {formMode === "paid_batch" && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: ".75rem", padding: ".75rem 1rem", marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: ".625rem" }}>
            <span style={{ flexShrink: 0, fontSize: ".9rem" }}>⏳</span>
            <div>
              <span style={{ fontSize: ".85rem", fontWeight: 700, color: "#92400e" }}>{copy.checkoutPendingTitle}{" "}</span>
              <span style={{ fontSize: ".82rem", color: "#78350f" }}>{copy.checkoutEarlyBanner}</span>
            </div>
          </div>
        )}

        {/* Sample demo badge — shown when in demo mode */}
        {formMode === "sample_demo" && (
          <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: ".75rem", padding: ".75rem 1rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: ".625rem" }}>
            <span style={{ fontSize: ".85rem", fontWeight: 700, color: "#713f12" }}>Preview</span>
            <span style={{ fontSize: ".82rem", color: "#713f12" }}>{copy.sampleNote}</span>
          </div>
        )}

        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <div style={{ display: "inline-block", background: "#e0f2fe", color: "#0284c7", fontSize: ".75rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".06em", padding: ".25rem .75rem", borderRadius: 999, marginBottom: "1rem" }}>
            {copy.formTag}
          </div>
          <h1 style={{ fontSize: "clamp(1.75rem,4vw,2.25rem)", fontWeight: 800, letterSpacing: "-.02em", marginBottom: ".75rem" }}>
            {copy.formTitle}
          </h1>
          <p style={{ color: "#64748b", fontSize: "1rem", lineHeight: 1.6 }}>
            {copy.formSub}
          </p>
        </div>

        {/* Plan pills */}
        <div style={{ background: "#fff", borderRadius: "1rem", border: "1px solid #e2e8f0", padding: "1.5rem", marginBottom: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
          <p style={{ fontSize: ".84rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: ".06em", marginBottom: "1rem" }}>{copy.step1}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: ".625rem" }}>
            {(Object.entries(PLANS) as [PlanType, typeof PLANS.starter][]).map(([key, p]) => (
              <button key={key} type="button" onClick={() => { setPlan(key); trackConversion("pricing_plan_select", { plan: key, source_cta: "pricing" }); }} aria-pressed={plan === key}
                style={{ border: `1.5px solid ${plan === key ? "#0ea5e9" : "#e2e8f0"}`, borderRadius: ".75rem", padding: ".75rem .5rem", textAlign: "center" as const, cursor: "pointer", transition: "all .15s", background: plan === key ? "#e0f2fe" : "#fff" }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>{p.price}</div>
                <div style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#94a3b8", marginTop: ".2rem" }}>{copy.planNames[key]}</div>
                <div style={{ fontSize: ".78rem", color: "#0284c7", fontWeight: 600, marginTop: ".3rem" }}>{copy.oneBatch}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={runPipeline}>
          <div style={{ background: "#fff", borderRadius: "1rem", border: "1px solid #e2e8f0", padding: "1.5rem", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <p style={{ fontSize: ".84rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: ".06em" }}>{copy.step2}</p>
              <button type="button" onClick={() => setForm({ ...SAMPLE, output_language: lang })}
                style={{ fontSize: ".78rem", fontWeight: 600, color: "#0ea5e9", background: "#e0f2fe", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer" }}>
                {copy.useSampleData}
              </button>
            </div>

            {error && (
              <div role="alert" style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: ".75rem", padding: "1rem", marginBottom: "1.25rem", fontSize: ".875rem", color: "#dc2626" }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            <FormField required label={copy.fCompanyName} value={form.company_name} onChange={v => setForm(f => ({ ...f, company_name: v }))} placeholder="e.g. GrowthForge Studio" />
            <FormField required label={copy.fCompanyDesc} value={form.company_description} onChange={v => setForm(f => ({ ...f, company_description: v }))} multiline placeholder="2–3 sentences about your business" />
            <FormField required label={copy.fOffer} value={form.offer_description} onChange={v => setForm(f => ({ ...f, offer_description: v }))} multiline placeholder="What exactly are you selling and at what price?" />
            <FormField required label={copy.fValue} value={form.value_proposition} onChange={v => setForm(f => ({ ...f, value_proposition: v }))} multiline placeholder="What specific outcome do you deliver?" />
            <FormField required label={copy.fCustomer} value={form.target_customer_description} onChange={v => setForm(f => ({ ...f, target_customer_description: v }))} multiline placeholder="Company size, titles, industries, signals..." />
            <FormField label={copy.fTicket} value={form.average_ticket ?? ""} onChange={v => setForm(f => ({ ...f, average_ticket: v }))} placeholder="e.g. $3,000/month" />

            {/* Tier-adaptive onboarding — progressive disclosure, all optional */}
            {formMode === "paid_batch" && plan !== "sample" && (
              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "1rem", marginTop: ".5rem" }}>
                <div style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".06em", color: "#94a3b8", marginBottom: ".75rem" }}>
                  {lang === "es" ? `Contexto adicional para tu ${copy.planNames[plan]} (opcional)` : `Extra context for your ${copy.planNames[plan]} (optional)`}
                </div>
                <FormField label={lang === "es" ? "Objetivo de la campaña" : "Campaign objective"} value={tierExtras.campaign_objective ?? ""} onChange={v => setTierExtras(t => ({ ...t, campaign_objective: v }))} placeholder={lang === "es" ? "¿Qué quieres lograr con estas cuentas?" : "What do you want these accounts for?"} />
                <FormField label={lang === "es" ? "Restricciones o exclusiones" : "Restrictions or exclusions"} value={tierExtras.restrictions ?? ""} onChange={v => setTierExtras(t => ({ ...t, restrictions: v }))} placeholder={lang === "es" ? "Industrias, competidores o cuentas a excluir" : "Industries, competitors or accounts to exclude"} />
                {(plan === "standard" || plan === "pro") && (<>
                  <FormField label={lang === "es" ? "Capacidad comercial" : "Sales capacity"} value={tierExtras.sales_capacity ?? ""} onChange={v => setTierExtras(t => ({ ...t, sales_capacity: v }))} placeholder={lang === "es" ? "¿Cuántas cuentas puede trabajar tu equipo a la vez?" : "How many accounts can your team work at once?"} />
                  <FormField label={lang === "es" ? "Preferencias de priorización" : "Prioritization preferences"} value={tierExtras.prioritization_preferences ?? ""} onChange={v => setTierExtras(t => ({ ...t, prioritization_preferences: v }))} placeholder={lang === "es" ? "¿Qué pesa más: fit, timing o tamaño?" : "What matters more: fit, timing or size?"} />
                </>)}
                {plan === "pro" && (<>
                  <FormField label={lang === "es" ? "Prioridades estratégicas" : "Strategic priorities"} value={tierExtras.strategic_priorities ?? ""} onChange={v => setTierExtras(t => ({ ...t, strategic_priorities: v }))} multiline placeholder={lang === "es" ? "Objetivos por región o segmento, ángulos preferidos" : "Regional/segment objectives, preferred angles"} />
                  <FormField label={lang === "es" ? "Objeciones conocidas" : "Known objections"} value={tierExtras.known_objections ?? ""} onChange={v => setTierExtras(t => ({ ...t, known_objections: v }))} placeholder={lang === "es" ? "¿Qué suelen objetar tus prospectos?" : "What do prospects usually object to?"} />
                </>)}
              </div>
            )}

            {/* Refinements collapsed by default (safe defaults: tone=direct, region=global) — fewer visible fields, no data removed. */}
            <details style={{ borderTop: "1px solid #f1f5f9", paddingTop: "1rem", marginTop: ".25rem", marginBottom: "1rem" }}>
              <summary style={{ fontSize: ".82rem", fontWeight: 600, color: "#0284c7", cursor: "pointer", listStyle: "none", userSelect: "none" }}>
                {lang === "es" ? "Ajustar tono e idioma de mercado (opcional)" : lang === "pt" ? "Ajustar tom e mercado-alvo (opcional)" : lang === "ja" ? "トーンと対象市場を調整（任意）" : "Adjust tone & target market (optional)"}
              </summary>
              <div style={{ marginTop: "1rem" }}>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={labelStyle}>{copy.fTone}</label>
                  <select value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value as typeof f.tone }))} style={inputStyle}>
                    <option value="direct">{copy.toneDirect}</option>
                    <option value="consultative">{copy.toneConsultative}</option>
                    <option value="casual">{copy.toneCasual}</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{copy.fRegion}</label>
                  <select value={form.target_market_region ?? "global"} onChange={e => setForm(f => ({ ...f, target_market_region: e.target.value as MarketRegion }))} style={inputStyle}>
                    <option value="north_america">{copy.regionNA}</option>
                    <option value="latin_america">{copy.regionLA}</option>
                    <option value="europe">{copy.regionEU}</option>
                    <option value="asia">{copy.regionAS}</option>
                    <option value="global">{copy.regionGL}</option>
                  </select>
                </div>
              </div>
            </details>

            <FormField required label={copy.fEmail} value={form.contact_email} onChange={v => setForm(f => ({ ...f, contact_email: v }))} type="email" placeholder="you@company.com" />

            {formMode === "paid_batch" ? (
              /* Checkout-pending gate — no LS URL set yet */
              <div style={{ marginTop: ".5rem" }}>
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: ".75rem", padding: "1rem 1.125rem", marginBottom: "1rem" }}>
                  <p style={{ fontWeight: 700, fontSize: ".9rem", color: "#92400e", marginBottom: ".35rem" }}>{copy.checkoutPendingTitle}</p>
                  <p style={{ fontSize: ".85rem", color: "#78350f", lineHeight: 1.55, marginBottom: ".5rem" }}>{copy.checkoutPendingBody}</p>
                  <p style={{ fontSize: ".82rem", color: "#92400e" }}>{copy.checkoutPendingDemoHint}</p>
                </div>
                <button type="button" onClick={() => setFormMode("sample_demo")}
                  style={{ width: "100%", background: "#f8fafc", color: "#334155", border: "1.5px solid #e2e8f0", borderRadius: ".75rem", padding: "1rem 1.5rem", fontSize: "1rem", fontWeight: 600, cursor: "pointer", transition: "background .15s" }}
                  onMouseOver={e => (e.currentTarget.style.background = "#f1f5f9")}
                  onMouseOut={e => (e.currentTarget.style.background = "#f8fafc")}
                >
                  {copy.switchToDemo}
                </button>
              </div>
            ) : (
              /* Sample demo submit */
              <button type="submit"
                style={{ width: "100%", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: ".75rem", padding: "1rem 1.5rem", fontSize: "1.05rem", fontWeight: 700, cursor: "pointer", marginTop: ".5rem", boxShadow: "0 4px 14px rgba(14,165,233,.35)", transition: "background .15s" }}
                onMouseOver={e => (e.currentTarget.style.background = "#0284c7")}
                onMouseOut={e => (e.currentTarget.style.background = "#0ea5e9")}
              >
                {copy.planCTAs[plan]}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );

  // ─── PROCESSING ───────────────────────────────────────────────────────────
  if (view === "processing") return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: "30rem", width: "100%" }}>
        <div style={{ fontSize: "3.5rem", marginBottom: "1.25rem" }}>⚙️</div>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-.02em", marginBottom: ".6rem" }}>{copy.processingTitle}</h1>
        <p style={{ color: "#64748b", fontSize: ".9rem", marginBottom: ".35rem" }}>
          {copy.planNames[plan]}
        </p>
        <p style={{ color: "#94a3b8", fontSize: ".82rem", marginBottom: ".5rem" }}>{copy.processingStatus}</p>
        <p style={{ color: "#94a3b8", fontSize: ".8rem", marginBottom: "2rem" }}>{copy.processingNote}</p>

        {/* Progress bar */}
        <div style={{ background: "#e2e8f0", borderRadius: 999, height: ".625rem", overflow: "hidden", marginBottom: "1.5rem" }}>
          <div style={{ height: "100%", background: "linear-gradient(90deg,#0ea5e9,#38bdf8)", borderRadius: 999, transition: "width .5s ease", width: `${progress}%` }} />
        </div>

        {/* Agent steps */}
        <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: ".875rem", padding: ".75rem 1rem", textAlign: "left" }}>
          {copy.agents.map((agent, i) => {
            const done   = i < agentStep;
            const active = i === agentStep;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: ".75rem", padding: ".5rem 0", borderBottom: i < copy.agents.length - 1 ? "1px solid #f8fafc" : "none" }}>
                <div style={{ width: "1.375rem", height: "1.375rem", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".68rem", fontWeight: 700, flexShrink: 0, background: done ? "#16a34a" : active ? "#0ea5e9" : "#f1f5f9", color: done || active ? "#fff" : "#94a3b8" }}>
                  {done ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: ".875rem", color: done ? "#64748b" : active ? "#0284c7" : "#94a3b8", fontWeight: active ? 600 : 400 }}>
                  {agent}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ─── RESULTS ──────────────────────────────────────────────────────────────
  if (view === "results" && report) {
    const sorted       = [...report.processed_leads].sort((a, b) => b.qualification.fit_score - a.qualification.fit_score);
    const visibleLeads = sorted.slice(0, 20);
    const hiddenCount  = sorted.length - visibleLeads.length;

    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", color: "#0f172a" }}>
        {/* Header */}
        <header style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "1rem 1.5rem", position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ maxWidth: "58rem", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-.02em" }}>Lead<span style={{ color: "#0ea5e9" }}>Lens</span></span>
              <span style={{ marginLeft: ".75rem", fontSize: ".78rem", background: "#f0fdf4", color: "#16a34a", fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{copy.reportReady}</span>
            </div>
            <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={lang}
                onChange={e => changeLang(e.target.value as OutputLanguage)}
                style={{ background: "transparent", border: "1px solid #e2e8f0", color: "#64748b", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: ".82rem", fontFamily: "inherit" }}
              >
                {LANG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={dlCSV} style={{ background: "#fff", border: "1.5px solid #e2e8f0", color: "#334155", borderRadius: ".625rem", padding: ".55rem 1rem", fontSize: ".875rem", fontWeight: 600, cursor: "pointer" }}>
                {copy.dlCSV(report.total_leads)}
              </button>
              <button onClick={dlMD} style={{ background: "#0ea5e9", border: "none", color: "#fff", borderRadius: ".625rem", padding: ".55rem 1rem", fontSize: ".875rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(14,165,233,.3)" }}>
                {copy.dlMD}
              </button>
              <button onClick={() => { setView("landing"); setReport(null); }} style={{ background: "none", border: "1.5px solid #e2e8f0", color: "#64748b", borderRadius: ".625rem", padding: ".55rem 1rem", fontSize: ".875rem", cursor: "pointer" }}>
                {copy.newRun}
              </button>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: "58rem", margin: "0 auto", padding: "2.5rem 1.5rem" }}>

          {/* Sample demo banner */}
          {isSampleDemo && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: ".875rem", padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "flex-start", gap: ".75rem" }}>
              <span style={{ fontSize: "1rem", flexShrink: 0 }}>⚠️</span>
              <div>
                <strong style={{ fontSize: ".875rem", color: "#92400e" }}>{copy.sampleBadge}</strong>
                <span style={{ fontSize: ".82rem", color: "#78350f", marginLeft: ".5rem" }}>{copy.sampleNote}</span>
              </div>
            </div>
          )}

          {/* Title */}
          <div style={{ marginBottom: "2rem" }}>
            <h1 style={{ fontSize: "1.875rem", fontWeight: 800, letterSpacing: "-.02em", marginBottom: ".25rem" }}>{copy.reportTitle}</h1>
            <p style={{ color: "#64748b", fontSize: ".9rem" }}>
              {report.total_leads} opportunities · {copy.planNames[report.plan as PlanType] ?? report.plan} · {new Date(report.created_at).toLocaleString()}
            </p>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: ".875rem", marginBottom: "1.75rem" }}>
            {[
              { label: copy.statTotal,   val: report.total_leads,          color: "#0f172a" },
              { label: "HOT 🔥",         val: report.hot_count,            color: "#991b1b" },
              { label: "WARM 🟡",        val: report.warm_count,           color: "#92400e" },
              { label: "COLD 🔵",        val: report.cold_count,           color: "#1e40af" },
              { label: "Discard",        val: report.discard_count,        color: "#64748b" },
              { label: copy.statAvg,     val: `${report.avg_score}/10`,    color: "#0284c7" },
            ].map(s => (
              <div key={s.label} style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: ".875rem", padding: "1rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-.02em", color: s.color }}>{s.val}</div>
                <div style={{ fontSize: ".78rem", color: "#94a3b8", marginTop: ".2rem" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Executive summary */}
          <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: ".875rem", padding: "1.25rem", marginBottom: "1rem" }}>
            <h3 style={{ fontWeight: 700, fontSize: ".875rem", marginBottom: ".75rem", color: "#334155" }}>{copy.execSummary}</h3>
            <p style={{ fontSize: ".9rem", color: "#64748b", lineHeight: 1.65 }}>{report.executive_summary}</p>
          </div>

          {/* Patterns + Recommendations */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
            <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: ".875rem", padding: "1.25rem" }}>
              <h3 style={{ fontWeight: 700, fontSize: ".875rem", marginBottom: ".875rem", color: "#334155" }}>{copy.patternsObserved}</h3>
              {report.patterns_observed.map((p, i) => (
                <div key={i} style={{ fontSize: ".85rem", color: "#64748b", display: "flex", gap: ".5rem", padding: ".3rem 0", lineHeight: 1.5 }}>
                  <span style={{ color: "#0ea5e9", fontWeight: 700, flexShrink: 0 }}>→</span>{p}
                </div>
              ))}
            </div>
            <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: ".875rem", padding: "1.25rem" }}>
              <h3 style={{ fontWeight: 700, fontSize: ".875rem", marginBottom: ".875rem", color: "#334155" }}>{copy.recommendations}</h3>
              {report.recommendations.map((r, i) => (
                <div key={i} style={{ fontSize: ".85rem", color: "#64748b", display: "flex", gap: ".5rem", padding: ".3rem 0", lineHeight: 1.5 }}>
                  <span style={{ color: "#16a34a", fontWeight: 700, flexShrink: 0 }}>✓</span>{r}
                </div>
              ))}
            </div>
          </div>

          {/* Export row */}
          <div style={{ display: "flex", gap: ".75rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
            <button onClick={dlCSV} style={{ background: "#fff", border: "1.5px solid #e2e8f0", color: "#334155", borderRadius: ".625rem", padding: ".65rem 1.25rem", fontSize: ".875rem", fontWeight: 600, cursor: "pointer" }}>
              {copy.dlCSV(report.total_leads)}
            </button>
            <button onClick={dlMD} style={{ background: "#0ea5e9", border: "none", color: "#fff", borderRadius: ".625rem", padding: ".65rem 1.25rem", fontSize: ".875rem", fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(14,165,233,.3)" }}>
              {copy.dlMD}
            </button>
          </div>

          {/* Lead cards */}
          <div style={{ marginBottom: ".5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "-.01em" }}>
              {copy.leadBreakdown}{" "}
              {hiddenCount > 0 && <span style={{ fontSize: ".8rem", fontWeight: 400, color: "#64748b" }}>({visibleLeads.length} / {sorted.length})</span>}
            </h2>
          </div>

          {hiddenCount > 0 && (
            <div style={{ background: "#e0f2fe", border: "1px solid #bae6fd", borderRadius: ".75rem", padding: ".875rem 1.25rem", marginBottom: "1rem", fontSize: ".875rem", color: "#0284c7" }}>
              ℹ️ {copy.showingOf(visibleLeads.length, sorted.length)}
            </div>
          )}

          <div>
            {visibleLeads.map((lead, i) => (
              <LeadCard key={lead.id} lead={lead} index={i} isOpen={expanded === i} onToggle={() => setExp(expanded === i ? null : i)} copy={copy} jobId={report?.job_id} />
            ))}
          </div>

          {hiddenCount > 0 && (
            <div style={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: ".875rem", padding: "1.5rem", textAlign: "center", marginTop: "1rem" }}>
              <p style={{ color: "#64748b", fontSize: ".9rem", marginBottom: "1rem" }}>
                {copy.moreInExport(hiddenCount)}
              </p>
              <button onClick={dlCSV} style={{ background: "#0ea5e9", color: "#fff", border: "none", borderRadius: ".625rem", padding: ".65rem 1.5rem", fontWeight: 700, fontSize: ".9rem", cursor: "pointer" }}>
                {copy.dlAll(sorted.length)}
              </button>
            </div>
          )}

          {/* Upgrade CTA — shown only after free preview */}
          {isSampleDemo && (
            <div style={{ background: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "1.5px solid #fde68a", borderRadius: "1rem", padding: "1.5rem 2rem", marginTop: "2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.25rem", flexWrap: "wrap" as const }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 800, fontSize: ".95rem", color: "#92400e", marginBottom: ".25rem" }}>
                  {copy.resultsUpgradeTitle}
                </p>
                <p style={{ fontSize: ".84rem", color: "#78350f", lineHeight: 1.6, margin: 0 }}>
                  {copy.resultsUpgradeSub}
                </p>
              </div>
              <button onClick={() => { setView("landing"); setTimeout(() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }), 100); }}
                style={{ background: "#d97706", color: "#fff", border: "none", borderRadius: ".75rem", padding: ".8rem 1.5rem", fontWeight: 700, fontSize: ".9rem", cursor: "pointer", whiteSpace: "nowrap" as const, flexShrink: 0, boxShadow: "0 2px 10px rgba(217,119,6,.3)" }}>
                {copy.resultsUpgradeCTA}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

// ─── Lead card ────────────────────────────────────────────────────────────────

// ─── Feedback button config ───────────────────────────────────────────────────

const PRIMARY_FEEDBACK: { signal: import("@/types").FeedbackSignal; label: string }[] = [
  { signal: "useful",       label: "👍 Useful"       },
  { signal: "not_useful",   label: "👎 Not useful"   },
  { signal: "wrong_fit",    label: "❌ Wrong fit"    },
  { signal: "generic",      label: "📋 Too generic"  },
  { signal: "add_to_vault", label: "📌 Watchlist"    },
];

const SECONDARY_FEEDBACK: { signal: import("@/types").FeedbackSignal; label: string }[] = [
  { signal: "contacted",     label: "Contacted"      },
  { signal: "replied",       label: "Replied"        },
  { signal: "meeting_booked",label: "Meeting booked" },
  { signal: "exclude_similar",label: "Exclude similar"},
];

function LeadCard({ lead, index, isOpen, onToggle, copy, jobId }: {
  lead: ProcessedLead; index: number; isOpen: boolean; onToggle: () => void; copy: Copy; jobId?: string;
}) {
  const { candidate: c, qualification: q, outreach: o, enrichment: e } = lead;
  const cat      = catInfo(q.fit_score);
  const qcMeta   = QC_META[o.qc_status];
  const isDiscard = q.fit_score < 4;

  // Feedback state — local per card, resets if card is closed/reopened
  const [feedbackSent, setFeedbackSent] = useState<import("@/types").FeedbackSignal | null>(null);
  const [feedbackPending, setFeedbackPending] = useState(false);

  async function sendFeedback(signal: import("@/types").FeedbackSignal) {
    if (feedbackPending || feedbackSent) return;
    setFeedbackPending(true);
    try {
      await fetch("/api/feedback/opportunity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id:             jobId ?? undefined,
          company:            c.company,
          domain:             c.domain,
          industry:           c.industry,
          opportunity_score:  q.fit_score,
          category:           q.category,
          recommended_action: e.recommended_action,
          signal_patterns:    lead.learning?.signal_patterns?.slice(0, 5),
          buying_window:      e.buying_window,
          feedback_signal:    signal,
        }),
      });
    } catch {
      // Best-effort — don't block UI on network errors
    } finally {
      setFeedbackSent(signal);
      setFeedbackPending(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: ".875rem", overflow: "hidden", marginBottom: ".75rem", transition: "box-shadow .15s" }}
      onMouseOver={el => (el.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.07)")}
      onMouseOut={el => (el.currentTarget.style.boxShadow = "none")}
    >
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", cursor: "pointer", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".875rem", minWidth: 0 }}>
          <span style={{ fontSize: ".78rem", color: "#cbd5e1", fontFamily: "monospace", fontWeight: 700, minWidth: "1.5rem" }}>#{index + 1}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: ".95rem" }}>
              {c.company ?? "Unknown"}
            </div>
            <div style={{ fontSize: ".82rem", color: "#94a3b8", marginTop: ".1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {[c.industry, c.location].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: ".875rem", flexShrink: 0 }}>
          <span style={{ display: "inline-block", padding: ".25rem .75rem", borderRadius: 999, fontSize: ".78rem", fontWeight: 700, background: cat.bg, color: cat.color }}>
            {cat.emoji} {cat.label}
          </span>
          <span style={{ fontSize: ".875rem", color: "#94a3b8", fontWeight: 600 }}>{q.fit_score}/10</span>
          <span style={{ fontSize: ".8rem", color: qcMeta.color }}>{qcMeta.icon}</span>
          <span style={{ color: "#cbd5e1", fontSize: ".75rem" }}>{isOpen ? "▲" : "▼"}</span>
        </div>
      </div>

      {isOpen && (
        <div style={{ borderTop: "1px solid #f1f5f9", padding: "1.5rem" }}>
          {/* Meta grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: ".75rem", marginBottom: "1.25rem" }}>
            <MetaCell label={copy.mCompanySize} val={c.company_size ?? "?"} />
            <MetaCell label={copy.mEmailStatus} val={`${Math.round(e.research_confidence * 100)}%`} />
            <MetaCell label={copy.mConfidence}  val={`${Math.round(c.confidence_score * 100)}%`} />
            <MetaCell label={copy.mSource}       val={c.source} />
            {c.location    && <MetaCell label={copy.mLocation}  val={c.location} />}
            {c.source_url  && <MetaCell label={copy.mSourceUrl} val={<a href={c.source_url} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9", textDecoration: "none", fontSize: ".82rem" }}>{c.source_url.slice(0, 35)}…</a>} />}
            {c.website_url && <MetaCell label={copy.mLinkedin} val={<a href={c.website_url} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9", textDecoration: "none", fontSize: ".82rem" }}>Visit</a>} />}
          </div>

          {/* Score breakdown — multi-axis dimensions */}
          {q.score_dimensions && (() => {
            const dims = q.score_dimensions!;
            const axes: [string, number, boolean][] = [
              ["ICP Fit",       dims.icp_fit,              false],
              ["Signal",        dims.signal_strength,      false],
              ["Timing",        dims.timing,               false],
              ["Evidence",      dims.evidence_quality,     false],
              ["Strategic",     dims.strategic_value,      false],
              ["Confidence",    dims.confidence,           false],
              ["Disqual. Risk", dims.disqualification_risk, true],
            ];
            return (
              <LeadSection title={copy.sScoreBreakdown}>
                <div style={{ display: "flex", flexDirection: "column" as const, gap: ".35rem" }}>
                  {axes.map(([label, val, isRisk]) => {
                    const color = isRisk
                      ? (val > 60 ? "#ef4444" : val > 35 ? "#f59e0b" : "#22c55e")
                      : (val >= 70 ? "#22c55e" : val >= 45 ? "#f59e0b" : "#94a3b8");
                    return (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: ".625rem" }}>
                        <div style={{ fontSize: ".7rem", color: "#64748b", width: "88px", flexShrink: 0 }}>{label}</div>
                        <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 999, height: 4, overflow: "hidden" }}>
                          <div style={{ width: `${val}%`, height: "100%", background: color, borderRadius: 999, transition: "width .4s" }} />
                        </div>
                        <div style={{ fontSize: ".7rem", fontWeight: 700, color, width: "26px", textAlign: "right" as const, flexShrink: 0 }}>{val}</div>
                      </div>
                    );
                  })}
                </div>
                {q.score_explanation && (
                  <p style={{ fontSize: ".78rem", color: "#94a3b8", marginTop: ".625rem", lineHeight: 1.55, fontStyle: "italic" as const }}>{q.score_explanation}</p>
                )}
              </LeadSection>
            );
          })()}

          {e.company_summary && (
            <LeadSection title={copy.sCompanyContext}>
              <p style={{ fontSize: ".875rem", color: "#64748b", lineHeight: 1.65 }}>{e.company_summary}</p>
              {e.role_relevance && <p style={{ fontSize: ".875rem", color: "#94a3b8", lineHeight: 1.65, marginTop: ".5rem", fontStyle: "italic" }}>{e.role_relevance}</p>}
            </LeadSection>
          )}

          {e.timing_signals.length > 0 && (
            <LeadSection title={copy.sTimingSignals}>
              {e.timing_signals.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: ".5rem", fontSize: ".875rem", color: "#64748b", padding: ".2rem 0" }}>
                  <span style={{ color: "#d97706" }}>⚡</span>{s}
                </div>
              ))}
            </LeadSection>
          )}

          {/* Why Now */}
          {e.why_now && (
            <LeadSection title={copy.sWhyNow}>
              <p style={{ fontSize: ".875rem", color: "#334155", lineHeight: 1.65, borderLeft: "3px solid #d97706", paddingLeft: ".75rem", margin: 0 }}>{e.why_now}</p>
            </LeadSection>
          )}

          {q.fit_reasons.length > 0 && (
            <LeadSection title={copy.sWhyFit}>
              {q.fit_reasons.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: ".5rem", fontSize: ".875rem", color: "#334155", padding: ".25rem 0" }}>
                  <span style={{ color: "#16a34a", fontWeight: 700, flexShrink: 0 }}>✓</span>{r}
                </div>
              ))}
            </LeadSection>
          )}

          {q.disqualification_reasons.length > 0 && (
            <LeadSection title={copy.sFlags}>
              {q.disqualification_reasons.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: ".5rem", fontSize: ".875rem", color: "#dc2626", padding: ".2rem 0" }}>
                  <span>⚠</span>{r}
                </div>
              ))}
            </LeadSection>
          )}

          {o.qc_notes.length > 0 && (
            <div style={{ background: o.qc_status === "APPROVED" ? "#f0fdf4" : o.qc_status === "REVIEW_NEEDED" ? "#fffbeb" : "#fef2f2", border: `1px solid ${o.qc_status === "APPROVED" ? "#bbf7d0" : o.qc_status === "REVIEW_NEEDED" ? "#fde68a" : "#fecaca"}`, borderRadius: ".625rem", padding: ".875rem 1rem", fontSize: ".875rem", color: o.qc_status === "APPROVED" ? "#16a34a" : o.qc_status === "REVIEW_NEEDED" ? "#92400e" : "#dc2626", marginBottom: "1.25rem" }}>
              {qcMeta.icon} {o.qc_notes.join(" · ")}
            </div>
          )}

          {e.missing_data.length > 0 && (
            <div style={{ fontSize: ".78rem", color: "#94a3b8", borderTop: "1px solid #f1f5f9", paddingTop: ".875rem", marginBottom: "1.25rem" }}>
              <strong>{copy.sDataGaps}:</strong> {e.missing_data.join(" · ")}
            </div>
          )}

          {/* Evidence Discipline */}
          {e.evidence_discipline && e.evidence_discipline.length > 0 && (
            <LeadSection title={copy.sEvidenceDiscipline}>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: ".3rem" }}>
                {e.evidence_discipline.map((claim, i) => {
                  const meta: Record<string, { label: string; bg: string; color: string }> = {
                    verified_public_signal: { label: "Verified",  bg: "#f0fdf4", color: "#16a34a" },
                    inferred_from_context:  { label: "Inferred",  bg: "#eff6ff", color: "#2563eb" },
                    weak_inference:         { label: "Weak",      bg: "#fffbeb", color: "#d97706" },
                    missing_evidence:       { label: "Missing",   bg: "#f8fafc", color: "#94a3b8" },
                  };
                  const m = meta[claim.type] ?? meta.missing_evidence;
                  return (
                    <div key={i} style={{ display: "flex", gap: ".5rem", alignItems: "flex-start" }}>
                      <span style={{ fontSize: ".65rem", fontWeight: 700, background: m.bg, color: m.color, border: `1px solid ${m.color}30`, borderRadius: ".25rem", padding: ".1rem .4rem", flexShrink: 0, whiteSpace: "nowrap" as const }}>{m.label}</span>
                      <span style={{ fontSize: ".82rem", color: "#475569", lineHeight: 1.45 }}>{claim.claim}</span>
                    </div>
                  );
                })}
              </div>
              {lead.learning?.evidence_discipline_summary && (
                <div style={{ marginTop: ".625rem", fontSize: ".72rem", color: "#64748b" }}>
                  Summary: <strong style={{ color: lead.learning.evidence_discipline_summary === "verified" ? "#16a34a" : lead.learning.evidence_discipline_summary === "weak" ? "#d97706" : "#2563eb" }}>{lead.learning.evidence_discipline_summary.replace(/_/g, " ")}</strong>
                </div>
              )}
            </LeadSection>
          )}

          {/* Quality Checks — specificity, claim risk, evidence coverage, role clarity */}
          {(o.improvement_notes?.length || o.genericness_risk || o.hallucination_risk || o.buyer_seller_confusion_risk) && (
            <LeadSection title={copy.sIntelligenceNotes}>
              <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" as const, marginBottom: o.improvement_notes?.length ? ".625rem" : 0 }}>
                {([
                  { label: "Specificity", val: o.genericness_risk },
                  { label: "Claim risk",  val: o.hallucination_risk },
                  { label: "Evidence gap", val: o.evidence_weakness },
                  { label: "Role clarity", val: o.buyer_seller_confusion_risk },
                ] as { label: string; val: string | undefined }[]).filter(r => r.val).map(({ label, val }) => {
                  const riskColor = val === "high"   ? { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" }
                                  : val === "medium" ? { bg: "#fffbeb", color: "#d97706", border: "#fde68a" }
                                  :                   { bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" };
                  return (
                    <span key={label} style={{ fontSize: ".65rem", fontWeight: 600, background: riskColor.bg, color: riskColor.color, border: `1px solid ${riskColor.border}`, borderRadius: ".375rem", padding: ".175rem .55rem" }}>
                      {label} <span style={{ opacity: .75 }}>·</span> {val}
                    </span>
                  );
                })}
              </div>
              {o.improvement_notes && o.improvement_notes.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: ".3rem" }}>
                  {o.improvement_notes.slice(0, 3).map((note, i) => (
                    <div key={i} style={{ display: "flex", gap: ".5rem", fontSize: ".82rem", color: "#64748b", lineHeight: 1.55 }}>
                      <span style={{ color: "#94a3b8", flexShrink: 0, marginTop: ".1rem" }}>›</span>
                      <span>{note}</span>
                    </div>
                  ))}
                </div>
              )}
            </LeadSection>
          )}

          {/* Learning Signals — reusable pattern + confirmed signal history */}
          {lead.learning && (lead.learning.signal_patterns.length > 0 || lead.learning.reusable_pattern) && (
            <LeadSection title={copy.sLearningMeta}>
              {lead.learning.reusable_pattern && (
                <div style={{ fontSize: ".82rem", color: "#334155", marginBottom: ".5rem", lineHeight: 1.5 }}>
                  <span style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".05em", color: "#0284c7", marginRight: ".4rem" }}>Pattern</span>
                  {lead.learning.reusable_pattern}
                </div>
              )}
              {lead.learning.signal_patterns.slice(0, 3).map((s, i) => (
                <div key={i} style={{ display: "flex", gap: ".4rem", fontSize: ".82rem", color: "#475569", padding: ".1rem 0" }}>
                  <span style={{ color: "#16a34a", flexShrink: 0 }}>✓</span>{s}
                </div>
              ))}
              <div style={{ fontSize: ".7rem", color: "#94a3b8", marginTop: ".5rem" }}>
                Analysis confidence: <strong style={{ color: "#64748b" }}>{Math.round(lead.learning.agent_confidence * 100)}%</strong>
              </div>
            </LeadSection>
          )}

          {/* ── Vault Memory — subtle hint from accumulated feedback ─────────── */}
          {lead.learning?.vault_hint_applied && (() => {
            const vl = lead.learning!;
            const isPositive    = vl.vault_positive_match && !vl.vault_negative_match;
            const isNegative    = vl.vault_negative_match;
            const isInsufficient = !isPositive && !isNegative;
            const conf          = vl.vault_confidence ?? "low";
            const confColor     = conf === "high" ? "#15803d" : conf === "medium" ? "#92400e" : "#64748b";

            return (
              <div style={{ border: "1px solid #e2e8f0", borderRadius: ".625rem", padding: ".75rem 1rem", marginBottom: ".5rem", background: isPositive ? "#f0fdf4" : isNegative ? "#fff7f7" : "#f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: ".5rem", marginBottom: ".4rem" }}>
                  <span style={{ fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8" }}>{copy.sVaultMemory}</span>
                  <span style={{
                    fontSize: ".65rem", fontWeight: 700, borderRadius: 999,
                    padding: ".12rem .5rem",
                    background: isPositive ? "#dcfce7" : isNegative ? "#fee2e2" : "#f1f5f9",
                    color:      isPositive ? "#15803d" : isNegative ? "#dc2626" : "#64748b",
                  }}>
                    {isPositive ? copy.sVaultValidated : isNegative ? copy.sVaultCaution : copy.sVaultInsufficient}
                  </span>
                </div>

                <div style={{ fontSize: ".8rem", color: "#475569", lineHeight: 1.5, marginBottom: ".35rem" }}>
                  {isPositive
                    ? copy.sVaultPositiveText
                    : isNegative
                    ? copy.sVaultNegativeText
                    : copy.sVaultInsufficientText}
                </div>

                {vl.vault_reason && !isInsufficient && (
                  <div style={{ fontSize: ".75rem", color: "#64748b", fontStyle: "italic", marginBottom: ".35rem" }}>
                    {vl.vault_reason}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: ".75rem", flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: ".7rem", color: "#94a3b8" }}>
                    {copy.sVaultConfidence}: <strong style={{ color: confColor }}>{conf.replace(/_/g, " ")}</strong>
                  </span>
                  {vl.vault_matched_patterns && vl.vault_matched_patterns.length > 0 && (
                    <span style={{ fontSize: ".7rem", color: "#94a3b8" }}>
                      {copy.sVaultMatchedPatterns}: {vl.vault_matched_patterns.join(", ")}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── Account Memory — novelty / repetition badge ──────────────────── */}
          {lead.learning?.account_memory_state && lead.learning.account_memory_state !== "new_opportunity" && (() => {
            const amState = lead.learning!.account_memory_state!;
            const timesSeen = lead.learning!.account_memory_times_seen ?? 0;
            const lastCat   = lead.learning!.account_memory_last_category;

            const AM_META: Record<string, { label: string; bg: string; color: string; border: string }> = {
              previously_seen:               { label: copy.sAccountMemorySeen,        bg: "#f8fafc", color: "#64748b", border: "#e2e8f0" },
              repeated_without_new_signal:   { label: copy.sAccountMemoryRepeat,      bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
              reactivated_with_new_signal:   { label: copy.sAccountMemoryReactivated, bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
              upgraded_priority:             { label: copy.sAccountMemoryUpgraded,    bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
              downgraded_priority:           { label: copy.sAccountMemoryDowngraded,  bg: "#fff7ed", color: "#9a3412", border: "#fed7aa" },
              dropped:                       { label: copy.sAccountMemoryDropped,     bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
            };

            const meta = AM_META[amState];
            if (!meta) return null;

            return (
              <div style={{ border: `1px solid ${meta.border}`, borderRadius: ".5rem", padding: ".5rem .875rem", marginBottom: ".5rem", background: meta.bg, display: "flex", alignItems: "center", gap: ".625rem", flexWrap: "wrap" as const }}>
                <span style={{ fontSize: ".6rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", flexShrink: 0 }}>{copy.sAccountMemory}</span>
                <span style={{ fontSize: ".7rem", fontWeight: 700, color: meta.color }}>{meta.label}</span>
                {timesSeen > 0 && (
                  <span style={{ fontSize: ".68rem", color: "#94a3b8" }}>{timesSeen} {copy.sAccountMemoryTimesSeen}</span>
                )}
                {lastCat && (
                  <span style={{ fontSize: ".68rem", color: "#94a3b8" }}>{copy.sAccountMemoryLastCat}: <strong style={{ color: "#64748b" }}>{lastCat}</strong></span>
                )}
              </div>
            );
          })()}

          {/* ── Source Layer — source type / freshness badge ─────────────── */}
          {lead.learning?.source_layer_applied && (() => {
            const sl = lead.learning!;
            const isContextOnly   = sl.is_context_only;
            const isTimingSignal  = sl.is_timing_signal;
            const isLimitedRegion = sl.limited_region_coverage;
            const freshLabel      = sl.freshness_label;
            const sourceTypes     = sl.source_types ?? [];
            const primaryType     = sl.source_type ?? "unknown";
            const displayTypes    = sourceTypes.filter(t => t !== "unknown").slice(0, 3);
            const typeStr         = displayTypes.length > 0
              ? displayTypes.map(t => t.replace(/_/g, " ")).join(", ")
              : primaryType.replace(/_/g, " ");

            return (
              <div style={{ border: "1px solid #e2e8f0", borderRadius: ".5rem", padding: ".45rem .875rem", marginBottom: ".5rem", background: "#f8fafc", display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" as const }}>
                <span style={{ fontSize: ".6rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", flexShrink: 0 }}>{copy.sSourceLayer}</span>
                <span style={{ fontSize: ".68rem", color: "#475569" }}>{typeStr}</span>
                {isContextOnly && !isTimingSignal && (
                  <span style={{ fontSize: ".62rem", color: "#94a3b8", background: "#f1f5f9", borderRadius: 999, padding: ".1rem .45rem" }}>{copy.sSourceContextOnly}</span>
                )}
                {isTimingSignal && (
                  <span style={{ fontSize: ".62rem", color: "#15803d", background: "#f0fdf4", borderRadius: 999, padding: ".1rem .45rem" }}>{copy.sSourceTimingSignal}</span>
                )}
                {freshLabel && (
                  <span style={{ fontSize: ".62rem", color: "#64748b" }}>· {freshLabel}</span>
                )}
                {isLimitedRegion && (
                  <span style={{ fontSize: ".62rem", color: "#92400e", background: "#fffbeb", borderRadius: 999, padding: ".1rem .45rem" }}>{copy.sSourceLimitedCoverage}</span>
                )}
              </div>
            );
          })()}

          {/* ── Evidence Quality — guardrail badge ──────────────────────────── */}
          {lead.learning?.evidence_quality && (() => {
            const eq = lead.learning!.evidence_quality!;
            const guardrailApplied = lead.learning!.recommended_action_guardrail_applied;

            const EQ_META: Record<string, { label: string; bg: string; color: string; border: string }> = {
              high:         { label: copy.sEvidenceHigh,        bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
              medium:       { label: copy.sEvidenceMedium,      bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
              low:          { label: copy.sEvidenceLow,         bg: "#fff7ed", color: "#9a3412", border: "#fed7aa" },
              insufficient: { label: copy.sEvidenceInsufficient, bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
            };

            const meta = EQ_META[eq];
            if (!meta) return null;

            return (
              <div style={{ border: `1px solid ${meta.border}`, borderRadius: ".5rem", padding: ".5rem .875rem", marginBottom: ".5rem", background: meta.bg, display: "flex", alignItems: "center", gap: ".625rem", flexWrap: "wrap" as const }}>
                <span style={{ fontSize: ".6rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", flexShrink: 0 }}>{copy.sEvidenceQuality}</span>
                <span style={{ fontSize: ".7rem", fontWeight: 700, color: meta.color }}>{meta.label}</span>
                {guardrailApplied && (
                  <span style={{ fontSize: ".68rem", color: "#94a3b8", fontStyle: "italic" }}>{copy.sEvidenceGuardrail}</span>
                )}
              </div>
            );
          })()}

          {/* ── Feedback — Learning hook ─────────────────────────────────────── */}
          <div style={{ background: "#f8fafc", borderRadius: ".625rem", padding: ".875rem 1rem", marginTop: ".5rem" }}>
            {feedbackSent === null ? (
              <div>
                <div style={{ fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: ".6rem" }}>
                  {copy.sFeedbackHook}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: ".35rem", marginBottom: ".35rem" }}>
                  {PRIMARY_FEEDBACK.map(({ signal, label }) => (
                    <button
                      key={signal}
                      onClick={() => sendFeedback(signal)}
                      disabled={feedbackPending}
                      style={{ padding: ".28rem .65rem", fontSize: ".78rem", fontWeight: 500, borderRadius: 999, border: "1px solid #e2e8f0", background: "#fff", color: "#334155", cursor: feedbackPending ? "wait" : "pointer", transition: "background .12s, border-color .12s" }}
                      onMouseOver={el => { el.currentTarget.style.background = "#f1f5f9"; el.currentTarget.style.borderColor = "#94a3b8"; }}
                      onMouseOut={el => { el.currentTarget.style.background = "#fff"; el.currentTarget.style.borderColor = "#e2e8f0"; }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap" as const, gap: ".3rem" }}>
                  {SECONDARY_FEEDBACK.map(({ signal, label }) => (
                    <button
                      key={signal}
                      onClick={() => sendFeedback(signal)}
                      disabled={feedbackPending}
                      style={{ padding: ".2rem .55rem", fontSize: ".72rem", fontWeight: 400, borderRadius: 999, border: "1px solid #e2e8f0", background: "transparent", color: "#94a3b8", cursor: feedbackPending ? "wait" : "pointer", transition: "color .12s, border-color .12s" }}
                      onMouseOver={el => { el.currentTarget.style.color = "#475569"; el.currentTarget.style.borderColor = "#94a3b8"; }}
                      onMouseOut={el => { el.currentTarget.style.color = "#94a3b8"; el.currentTarget.style.borderColor = "#e2e8f0"; }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: ".8rem", color: "#16a34a", display: "flex", alignItems: "center", gap: ".4rem" }}>
                <span>✓</span>
                <span>{copy.sFeedbackSaved}</span>
                <span style={{ color: "#94a3b8", fontSize: ".72rem", marginLeft: ".25rem" }}>({feedbackSent.replace(/_/g, " ")})</span>
              </div>
            )}
          </div>

          {!isDiscard && (
            <>
              <LeadSection title={copy.sPersonalization}>
                <div style={{ background: "#e0f2fe", borderLeft: "3px solid #0ea5e9", borderRadius: "0 .5rem .5rem 0", padding: ".875rem 1rem", fontSize: ".9rem", color: "#0284c7", fontStyle: "italic" }}>
                  {o.personalization_trigger}
                </div>
              </LeadSection>

              <LeadSection title={copy.sInitialEmail}>
                <div style={{ background: "#f8fafc", borderRadius: ".625rem", padding: "1rem 1.1rem" }}>
                  <div style={{ fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: ".4rem" }}>{copy.sSubject}</div>
                  <div style={{ fontSize: ".85rem", fontWeight: 700, color: "#0284c7", marginBottom: ".875rem", background: "#fff", border: "1px solid #e2e8f0", borderRadius: ".375rem", padding: ".4rem .625rem" }}>
                    {o.subject}
                  </div>
                  <div style={{ fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: ".4rem" }}>{copy.sBody}</div>
                  <div style={{ fontSize: ".875rem", color: "#334155", whiteSpace: "pre-line" as const, lineHeight: 1.65 }}>{o.email_body}</div>
                </div>
              </LeadSection>

              <LeadSection title={copy.sFullSequence}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: ".75rem" }}>
                  {[
                    { label: copy.sLinkedinDM,  content: o.linkedin_dm },
                    { label: copy.sFollowup1, content: o.followup_1 },
                    { label: copy.sFollowup2, content: o.followup_2 },
                  ].map(item => (
                    <div key={item.label} style={{ background: "#f8fafc", borderRadius: ".625rem", padding: ".875rem" }}>
                      <div style={{ fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: ".4rem" }}>{item.label}</div>
                      <div style={{ fontSize: ".82rem", color: "#334155", whiteSpace: "pre-line" as const, lineHeight: 1.65 }}>{item.content}</div>
                    </div>
                  ))}
                </div>
              </LeadSection>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Hero product mockup ──────────────────────────────────────────────────────

// Decision-state system (conservative, decision-oriented — NOT lead temperature).
// Prioritize / Validate / Monitor / Hold communicate a commercial decision, not
// buying intent. Restrained hues, no traffic-light scoring.
const DECISION_STATES: Record<string, { label: string; color: string; dot: string; bg: string; border: string }> = {
  prioritize: { label: "Prioritize", color: "#0369a1", dot: "#0284c7", bg: "#f0f9ff", border: "#e0f2fe" },
  validate:   { label: "Validate",   color: "#b45309", dot: "#d97706", bg: "#fffbeb", border: "#fef3c7" },
  monitor:    { label: "Monitor",    color: "#475569", dot: "#94a3b8", bg: "#f8fafc", border: "#eef2f6" },
  hold:       { label: "Hold",       color: "#64748b", dot: "#cbd5e1", bg: "#f8fafc", border: "#eef2f6" },
};
// Strength encoded by typographic weight/darkness, not numbers or dots.
const STRENGTH: Record<string, { color: string; weight: number }> = {
  Strong:   { color: "#0f172a", weight: 700 },
  Moderate: { color: "#475569", weight: 600 },
  Limited:  { color: "#94a3b8", weight: 500 },
};

function DecisionPill({ state, small }: { state: string; small?: boolean }) {
  const s = DECISION_STATES[state];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: ".3rem", background: s.bg, border: `1px solid ${s.border}`, color: s.color, borderRadius: 999, padding: small ? ".1rem .45rem" : ".2rem .6rem", fontSize: small ? ".6rem" : ".68rem", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />{s.label}
    </span>
  );
}

function FTE({ fit, timing, evidence }: { fit: string; timing: string; evidence: string }) {
  const cell = (label: string, val: string) => (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: ".28rem" }}>
      <span style={{ fontSize: ".6rem", color: "#94a3b8", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: ".03em" }}>{label}</span>
      <span style={{ fontSize: ".68rem", color: STRENGTH[val].color, fontWeight: STRENGTH[val].weight }}>{val}</span>
    </span>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: ".1rem .7rem", alignItems: "center" }}>
      {cell("Fit", fit)}{cell("Timing", timing)}{cell("Evidence", evidence)}
    </div>
  );
}

function OpportunityMockupHero() {
  const accounts = [
    { name: "Northstar Logistics", segment: "Mid-market logistics", state: "prioritize",
      changed: "Signed regional distribution agreement", fresh: "9d ago",
      fit: "Strong", timing: "Strong", evidence: "Strong",
      uncertainty: "No procurement event confirmed" },
    { name: "FreshRoute Foods", segment: "Regional food distribution", state: "validate",
      changed: "Opened 2 new distribution sites", fresh: "14d ago",
      fit: "Strong", timing: "Moderate", evidence: "Moderate",
      uncertainty: "Decision scope may be regional" },
    { name: "Atlas Clinics Group", segment: "Multi-location healthcare", state: "monitor",
      changed: "Announced 2 new clinic locations", fresh: "21d ago",
      fit: "Moderate", timing: "Limited", evidence: "Moderate",
      uncertainty: "Only one source confirms expansion" },
    { name: "Pinebridge Advisors", segment: "Mid-market financial services", state: "validate",
      changed: "Appointed new COO", fresh: "6w ago",
      fit: "Moderate", timing: "Moderate", evidence: "Limited",
      uncertainty: "Vendor review not confirmed" },
    { name: "Clearpoint Builders", segment: "Commercial construction", state: "hold",
      changed: "Announced 3 new project contracts", fresh: "24d ago",
      fit: "Strong", timing: "Limited", evidence: "Limited",
      uncertainty: "No operations change observed yet" },
  ];

  return (
    <div style={{ background: "#fff", border: "1px solid #e0f2fe", borderRadius: "1rem", boxShadow: "0 24px 64px rgba(14,165,233,.10), 0 4px 20px rgba(0,0,0,.06), 0 1px 4px rgba(0,0,0,.04)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(180deg,#f0f9ff 0%,#fff 100%)", borderBottom: "1px solid #e0f2fe", padding: ".75rem 1.125rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", minWidth: 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 2px #dcfce7", flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: ".8rem", color: "#0f172a", letterSpacing: "-.01em" }}>Opportunity Portfolio</span>
          <span style={{ fontSize: ".72rem", color: "#94a3b8", fontWeight: 400 }}>· 5 accounts prioritized</span>
        </div>
        <span style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#3b82f6", fontSize: ".62rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" as const, padding: ".175rem .55rem", borderRadius: 999, flexShrink: 0 }}>Sample</span>
      </div>

      {/* Sub-caption (replaces lead-scoring metrics strip) */}
      <div style={{ padding: ".45rem 1.125rem", background: "#f8fafc", borderBottom: "1px solid #f1f5f9", fontSize: ".64rem", color: "#64748b", fontWeight: 500 }}>
        Ranked by decision priority · what changed in the last 30 days
      </div>

      {/* Account rows */}
      {accounts.map((a, i) => (
        <div key={a.name} style={{ padding: ".7rem 1.125rem", borderBottom: i < accounts.length - 1 ? "1px solid #f8fafc" : "none", background: "#fff" }}>
          {/* Account + decision state */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: ".5rem", marginBottom: ".35rem" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: ".825rem", color: "#0f172a", lineHeight: 1.25 }}>{a.name}</div>
              <div style={{ fontSize: ".68rem", marginTop: ".1rem", color: "#64748b" }}>{a.segment}</div>
            </div>
            <DecisionPill state={a.state} />
          </div>
          {/* What Changed + freshness (most prominent evidence element) */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem", background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: ".4rem", padding: ".3rem .55rem", marginBottom: ".35rem" }}>
            <span style={{ fontSize: ".7rem", color: "#334155", minWidth: 0, lineHeight: 1.35 }}>
              <span style={{ fontSize: ".58rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#94a3b8", marginRight: ".4rem" }}>Changed</span>
              {a.changed}
            </span>
            <span style={{ fontSize: ".64rem", color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{a.fresh}</span>
          </div>
          {/* Fit / Timing / Evidence + key uncertainty */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem", flexWrap: "wrap" as const }}>
            <FTE fit={a.fit} timing={a.timing} evidence={a.evidence} />
            <span style={{ fontSize: ".62rem", color: "#94a3b8", fontStyle: "italic" as const, minWidth: 0 }}>
              <span style={{ fontStyle: "normal" as const, fontWeight: 600, color: "#b45309", marginRight: ".25rem" }}>Validate:</span>{a.uncertainty}
            </span>
          </div>
        </div>
      ))}

      {/* Legend (replaces deliverables strip) */}
      <div style={{ padding: ".5rem 1.125rem", background: "#f8fafc", borderTop: "1px solid #f1f5f9", fontSize: ".6rem", color: "#94a3b8", fontWeight: 500 }}>
        Fit · Timing · Evidence rated <span style={{ color: "#0f172a", fontWeight: 700 }}>Strong</span> / <span style={{ color: "#475569", fontWeight: 600 }}>Moderate</span> / <span style={{ color: "#94a3b8" }}>Limited</span> — each grounded in dated public evidence
      </div>
    </div>
  );
}

const LeadMockupHero = OpportunityMockupHero;

// ─── Mobile hero preview card (replaces full mockup on small screens) ─────────

function OpportunityMockupMobile() {
  const accounts = [
    { name: "Northstar Logistics", segment: "Logistics",     state: "prioritize", changed: "Signed regional distribution deal", fresh: "9d ago",  fit: "Strong",   timing: "Strong",   evidence: "Strong",   uncertainty: "No procurement event confirmed" },
    { name: "FreshRoute Foods",    segment: "Food dist.",     state: "validate",   changed: "Opened 2 new distribution sites",   fresh: "14d ago", fit: "Strong",   timing: "Moderate", evidence: "Moderate", uncertainty: "Decision scope may be regional" },
    { name: "Atlas Clinics Group", segment: "Healthcare",     state: "monitor",    changed: "Announced 2 new clinic locations",  fresh: "21d ago", fit: "Moderate", timing: "Limited",  evidence: "Moderate", uncertainty: "Only one source on expansion" },
    { name: "Pinebridge Advisors", segment: "Fin. services",  state: "validate",   changed: "Appointed new COO",                 fresh: "6w ago",  fit: "Moderate", timing: "Moderate", evidence: "Limited",  uncertainty: "Vendor review not confirmed" },
  ];

  return (
    // maxWidth caps the card to the true viewport content width so it never clips
    // on the content-sized hero grid track at ≤384px (self-contained; no hero-layout change).
    <div style={{ background: "#fff", border: "1px solid #e0f2fe", borderRadius: "1rem", boxShadow: "0 8px 28px rgba(14,165,233,.08)", overflow: "hidden", maxWidth: "calc(100vw - 2rem)", boxSizing: "border-box" as const }}>
      <div style={{ background: "linear-gradient(180deg,#f0f9ff,#fff)", borderBottom: "1px solid #e0f2fe", padding: ".6rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: ".4rem", minWidth: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: ".78rem", color: "#0f172a" }}>Opportunity Portfolio</span>
        </div>
        <span style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" as const, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#3b82f6", padding: ".15rem .475rem", borderRadius: 999, flexShrink: 0 }}>Sample</span>
      </div>

      {accounts.map((a, i) => (
        <div key={a.name} style={{ padding: ".6rem 1rem", borderBottom: i < accounts.length - 1 ? "1px solid #f8fafc" : "none" }}>
          {/* Account + decision state */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: ".5rem", marginBottom: ".3rem" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: ".75rem", color: "#0f172a", lineHeight: 1.2 }}>{a.name}</div>
              <div style={{ fontSize: ".64rem", marginTop: ".08rem", color: "#64748b" }}>{a.segment}</div>
            </div>
            <DecisionPill state={a.state} small />
          </div>
          {/* What Changed + freshness */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".4rem", fontSize: ".64rem", color: "#334155", marginBottom: ".28rem", lineHeight: 1.35 }}>
            <span style={{ minWidth: 0 }}>{a.changed}</span>
            <span style={{ fontSize: ".6rem", color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap" as const, flexShrink: 0 }}>{a.fresh}</span>
          </div>
          {/* Fit / Timing / Evidence */}
          <FTE fit={a.fit} timing={a.timing} evidence={a.evidence} />
          {/* Key uncertainty */}
          <div style={{ fontSize: ".6rem", color: "#94a3b8", marginTop: ".22rem", lineHeight: 1.35 }}>
            <span style={{ fontWeight: 600, color: "#b45309", marginRight: ".25rem" }}>Validate:</span>{a.uncertainty}
          </div>
        </div>
      ))}

      <div style={{ padding: ".45rem 1rem", background: "#f8fafc", borderTop: "1px solid #f1f5f9", fontSize: ".58rem", color: "#94a3b8", fontWeight: 500, lineHeight: 1.4 }}>
        Fit · Timing · Evidence: <span style={{ color: "#0f172a", fontWeight: 700 }}>Strong</span> / <span style={{ color: "#475569", fontWeight: 600 }}>Moderate</span> / <span style={{ color: "#94a3b8" }}>Limited</span>
      </div>
    </div>
  );
}

// Keep old name as alias
const LeadMockupMobile = OpportunityMockupMobile;

// ─── Plan comparison table (launch_tier_architecture_v0) ─────────────────────
// Capability progression, not volume. Counts appear once as operating scope.
const COMPARE_ROWS: { label: string; v: [string, string, string, string] }[] = [
  { label: "Scope", v: ["1 ICP · 1 region · 2 opportunities", "1 ICP · 1 region · 6 opportunities", "1 ICP · 1–2 regions · 12 opportunities", "1–2 ICPs · 2–3 regions · 18 opportunities"] },
  { label: "What Changed + sources + freshness", v: ["✓", "✓", "✓", "✓"] },
  { label: "Evidence quality", v: ["Standard", "Standard", "Full", "Reinforced"] },
  { label: "Why Now + fit + timing", v: ["Per account", "Basic comparison", "Complete", "Advanced"] },
  { label: "Portfolio statuses & allocation", v: ["—", "Basic", "Complete", "Advanced"] },
  { label: "Opportunity clusters", v: ["—", "Summary", "Complete", "Deep"] },
  { label: "Portfolio risk & coverage gaps", v: ["—", "Basic risk", "Complete", "Advanced"] },
  { label: "Momentum & decay", v: ["—", "—", "Initial", "Detailed"] },
  { label: "Counterevidence", v: ["When found", "When found", "Included", "Systematic"] },
  { label: "Strategic sequence & playbooks", v: ["—", "Basic sequence", "Complete sequence", "Playbooks + advanced sequence"] },
  { label: "Executive report", v: ["Mini + ICP verdict", "Opportunity Brief", "Intelligence Brief", "Strategic Brief"] },
];

function ComparisonTable({ copy }: { copy: Copy }) {
  const th: React.CSSProperties = { padding: ".6rem .75rem", fontSize: ".78rem", fontWeight: 800, color: "#0f172a", textAlign: "left", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: ".55rem .75rem", fontSize: ".8rem", color: "#475569", borderBottom: "1px solid #f1f5f9", textAlign: "left", lineHeight: 1.4 };
  return (
    <div style={{ maxWidth: "80rem", margin: "2.5rem auto 0", textAlign: "left" }}>
      <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", marginBottom: ".75rem", textAlign: "center" }}>{copy.compareTitle}</h3>
      <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "1rem" }} role="region" aria-label={copy.compareTitle} tabIndex={0}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th}></th>
              {(["sample", "starter", "standard", "pro"] as const).map((k) => (
                <th key={k} style={{ ...th, color: k === "standard" ? "#0284c7" : "#0f172a" }}>{copy.planNames[k]} · {PLANS[k].price}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => (
              <tr key={row.label}>
                <td style={{ ...td, fontWeight: 600, color: "#334155" }}>{row.label}</td>
                {row.v.map((cell, i) => <td key={i} style={{ ...td, background: i === 2 ? "#f0f9ff" : undefined }}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pricing card ─────────────────────────────────────────────────────────────

function PricingCard({ plan, featured, copy, onSelect }: {
  plan: PlanType; featured: boolean; copy: Copy; onSelect: (p: PlanType) => void;
}) {
  const p = PLANS[plan];
  const featuredShadow = "0 4px 24px rgba(14,165,233,.18)";
  return (
    <div
      style={{
        border: `1.5px solid ${featured ? "#0ea5e9" : "#e2e8f0"}`,
        borderRadius: "1.125rem",
        padding: "2rem",
        background: featured ? "linear-gradient(180deg,#f0f9ff 0%,#fff 55%)" : "#fff",
        position: "relative" as const,
        transition: "box-shadow .2s, transform .2s",
        display: "flex",
        flexDirection: "column" as const,
        height: "100%",
        boxSizing: "border-box" as const,
        boxShadow: featured ? featuredShadow : "none",
      }}
      onMouseOver={el => {
        el.currentTarget.style.boxShadow = featured ? "0 8px 36px rgba(14,165,233,.26)" : "0 8px 24px rgba(0,0,0,.09)";
        el.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseOut={el => {
        el.currentTarget.style.boxShadow = featured ? featuredShadow : "none";
        el.currentTarget.style.transform = "";
      }}
    >
      {featured && (
        <div style={{ position: "absolute" as const, top: -13, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#0ea5e9,#0284c7)", color: "#fff", fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", padding: ".3rem 1rem", borderRadius: 999, whiteSpace: "nowrap" as const, boxShadow: "0 2px 8px rgba(14,165,233,.35)" }}>
          {copy.mostPopular}
        </div>
      )}
      {!featured && (
        <div style={{ fontSize: ".66rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".06em", color: "#94a3b8", marginBottom: ".6rem" }}>
          {copy.planBadges[plan]}
        </div>
      )}

      {/* Plan name + price block */}
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".08em", color: featured ? "#0284c7" : "#94a3b8", marginBottom: ".625rem" }}>
          {copy.planNames[plan]}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: ".25rem", marginBottom: ".2rem" }}>
          <span style={{ fontSize: "2.75rem", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1, color: "#0f172a" }}>{p.price}</span>
        </div>
        <div style={{ fontSize: ".72rem", color: "#94a3b8", marginBottom: ".5rem", letterSpacing: "-.01em" }}>
          {copy.pricePerLead[plan]}
        </div>
        <div style={{ fontSize: ".875rem", color: "#64748b", lineHeight: 1.45, marginBottom: ".5rem" }}>{copy.planDescs[plan]}</div>
        <div style={{ fontSize: ".78rem", color: "#94a3b8", lineHeight: 1.45, marginBottom: ".5rem" }}>{copy.planFor[plan]}</div>
        <div style={{ fontSize: ".78rem", color: featured ? "#0369a1" : "#64748b", fontWeight: 600, lineHeight: 1.45, marginBottom: ".875rem" }}>{copy.planDiff[plan]}</div>
        <div style={{ display: "inline-block", fontSize: ".7rem", fontWeight: 600, color: featured ? "#0284c7" : "#64748b", background: featured ? "#e0f2fe" : "#f1f5f9", borderRadius: ".375rem", padding: "3px 10px" }}>
          {copy.oneBatch}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${featured ? "#bae6fd" : "#f1f5f9"}`, marginBottom: "1rem" }} />

      {/* Features — flex:1 pushes button to bottom */}
      <div style={{ flex: 1, marginBottom: "1.5rem" }}>
        {copy.planFeatures[plan].map(f => (
          <div key={f} style={{ fontSize: ".855rem", color: "#64748b", padding: ".3rem 0", display: "flex", gap: ".6rem", alignItems: "flex-start", lineHeight: 1.45 }}>
            <span style={{ color: "#0ea5e9", fontWeight: 700, flexShrink: 0, marginTop: ".1rem" }}>✓</span>{f}
          </div>
        ))}
      </div>

      {/* CTA — always at bottom */}
      <button
        onClick={() => onSelect(plan)}
        style={{
          width: "100%",
          background: "#0ea5e9",
          color: "#fff",
          border: "none",
          borderRadius: ".75rem",
          padding: ".9rem",
          fontWeight: 700,
          fontSize: ".9rem",
          cursor: "pointer",
          transition: "background .15s, transform .15s",
          boxShadow: featured ? "0 4px 14px rgba(14,165,233,.35)" : "none",
          marginTop: "auto",
        }}
        onMouseOver={e => { e.currentTarget.style.background = "#0284c7"; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseOut={e => { e.currentTarget.style.background = "#0ea5e9"; e.currentTarget.style.transform = ""; }}
      >
        {copy.planCTAs[plan]}
      </button>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function BriefSection({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <div style={{ fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: ".5rem" }}>{label}</div>
      {children}
    </div>
  );
}

// ─── Visualization components ─────────────────────────────────────────────────

function VizLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: ".3rem" }}>
      {children}
    </div>
  );
}

function MarketMapMatrix() {
  const segments = [
    { label: "Mid-market logistics",      x: 72, y: 81, priority: "hot"     },
    { label: "Regional food distributors", x: 65, y: 74, priority: "hot"     },
    { label: "Multi-location clinics",     x: 58, y: 66, priority: "warm"    },
    { label: "B2B agencies",               x: 79, y: 51, priority: "warm"    },
    { label: "Industrial suppliers",       x: 37, y: 70, priority: "monitor" },
  ];
  const colors = {
    hot:     { bg: "#fef2f2", border: "#fca5a5", dot: "#ef4444", text: "#b91c1c" },
    warm:    { bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b", text: "#92400e" },
    monitor: { bg: "#f0f9ff", border: "#bae6fd", dot: "#0ea5e9", text: "#0369a1" },
  };
  const legend = [
    { key: "hot",     label: "Priority — attack first"    },
    { key: "warm",    label: "Secondary — build pipeline" },
    { key: "monitor", label: "Monitor — watch signals"    },
  ] as const;

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "1.125rem", padding: "1.5rem", boxShadow: "0 2px 12px rgba(0,0,0,.04)" }}>
      <VizLabel>Market Map — Segment Matrix</VizLabel>
      <div style={{ fontSize: ".9rem", fontWeight: 700, color: "#0f172a", marginBottom: ".2rem" }}>Which segment to attack first?</div>
      <div style={{ fontSize: ".78rem", color: "#64748b", marginBottom: "1rem" }}>Segments plotted by commercial potential vs. ease of entry</div>

      <div style={{ position: "relative" as const, height: 260, background: "linear-gradient(180deg,#f8fafc 0%,#fff 100%)", border: "1px solid #f1f5f9", borderRadius: ".75rem", overflow: "hidden" as const }}>
        {/* Grid lines */}
        <div style={{ position: "absolute" as const, left: "50%", top: 0, bottom: 0, width: 1, background: "#f1f5f9" }} />
        <div style={{ position: "absolute" as const, top: "50%", left: 0, right: 0, height: 1, background: "#f1f5f9" }} />

        {/* Corner labels */}
        <div style={{ position: "absolute" as const, left: 6, top: 5, fontSize: ".58rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: ".04em" }}>High potential ↑</div>
        <div style={{ position: "absolute" as const, left: 6, bottom: 5, fontSize: ".58rem", fontWeight: 600, color: "#cbd5e1", textTransform: "uppercase" as const, letterSpacing: ".04em" }}>Lower potential</div>
        <div style={{ position: "absolute" as const, right: 6, bottom: 5, fontSize: ".58rem", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: ".04em" }}>Easier to enter →</div>
        <div style={{ position: "absolute" as const, left: 6, bottom: 5, fontSize: ".58rem", fontWeight: 600, color: "#cbd5e1", textTransform: "uppercase" as const, letterSpacing: ".04em", lineHeight: 1.3, paddingBottom: "1rem" }}>← Harder</div>

        {/* HOT zone hint */}
        <div style={{ position: "absolute" as const, right: 0, top: 0, width: "50%", height: "50%", background: "rgba(239,68,68,.04)", pointerEvents: "none" as const }}>
          <div style={{ position: "absolute" as const, right: 7, top: 5, fontSize: ".6rem", fontWeight: 700, color: "#ef4444", opacity: .5, textTransform: "uppercase" as const, letterSpacing: ".04em" }}>Priority zone</div>
        </div>

        {/* Segment bubbles */}
        {segments.map(s => {
          const c = colors[s.priority as keyof typeof colors];
          return (
            <div key={s.label} style={{ position: "absolute" as const, left: `${s.x}%`, top: `${100 - s.y}%`, transform: "translate(-50%,-50%)" }}>
              <div style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: "2rem", padding: ".28rem .65rem", whiteSpace: "nowrap" as const, boxShadow: "0 2px 8px rgba(0,0,0,.07)", display: "flex", alignItems: "center", gap: ".3rem" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
                <span style={{ fontSize: ".64rem", fontWeight: 600, color: c.text, lineHeight: 1.2 }}>{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: "1rem", marginTop: ".875rem", flexWrap: "wrap" as const }}>
        {legend.map(l => {
          const c = colors[l.key];
          return (
            <div key={l.key} style={{ display: "flex", alignItems: "center", gap: ".35rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
              <span style={{ fontSize: ".72rem", color: "#64748b" }}>{l.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScoreBreakdown() {
  const dims = [
    { label: "ICP Fit",          score: 88 },
    { label: "Timing",           score: 86 },
    { label: "Signal Strength",  score: 82 },
    { label: "Strategic Value",  score: 79 },
    { label: "Confidence",       score: 78 },
    { label: "Evidence Quality", score: 74 },
  ];
  const overall = Math.round(dims.reduce((sum, d) => sum + d.score, 0) / dims.length);
  const barColor = (s: number) => s >= 85 ? "#22c55e" : s >= 75 ? "#0ea5e9" : "#f59e0b";
  const textColor = (s: number) => s >= 85 ? "#16a34a" : s >= 75 ? "#0284c7" : "#d97706";

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "1.125rem", padding: "1.5rem", boxShadow: "0 2px 12px rgba(0,0,0,.04)" }}>
      <VizLabel>Opportunity Score Breakdown</VizLabel>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: ".75rem", marginBottom: "1.25rem" }}>
        <div>
          <div style={{ fontSize: ".9rem", fontWeight: 700, color: "#0f172a" }}>Northstar Logistics</div>
          <div style={{ fontSize: ".75rem", color: "#64748b", marginTop: ".15rem" }}>Sample account · Mid-market logistics</div>
        </div>
        <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0284c7", letterSpacing: "-.04em", lineHeight: 1 }}>{overall}</div>
          <div style={{ fontSize: ".62rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: ".04em" }}>Overall</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" as const, gap: ".6rem" }}>
        {dims.map(d => (
          <div key={d.label}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: ".2rem" }}>
              <span style={{ fontSize: ".8rem", color: "#475569", fontWeight: 500 }}>{d.label}</span>
              <span style={{ fontSize: ".8rem", fontWeight: 700, color: textColor(d.score) }}>{d.score}</span>
            </div>
            <div style={{ background: "#f1f5f9", borderRadius: 999, height: 6, overflow: "hidden" as const }}>
              <div style={{ background: barColor(d.score), height: "100%", width: `${d.score}%`, borderRadius: 999 }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "1rem", padding: ".6rem .875rem", background: "#f0f9ff", border: "1px solid #e0f2fe", borderRadius: ".625rem" }}>
        <div style={{ fontSize: ".75rem", color: "#0369a1", lineHeight: 1.55 }}>
          <span style={{ fontWeight: 700 }}>Strong ICP Fit + Timing</span> — this account is a priority for immediate outreach. Evidence Quality at 74 suggests verifying one additional source before contacting.
        </div>
      </div>
    </div>
  );
}

function PriorityQuadrant() {
  const accounts = [
    { name: "Northstar",  x: 82, y: 84, color: "#ef4444" },
    { name: "FreshRoute", x: 76, y: 79, color: "#ef4444" },
    { name: "Atlas",      x: 71, y: 61, color: "#f59e0b" },
    { name: "Pinebridge", x: 62, y: 55, color: "#f59e0b" },
    { name: "Clearpoint", x: 44, y: 38, color: "#94a3b8" },
  ];
  const quadrants = [
    { label: "HOT",          sub: "Act now",         top: "0",    left: "50%", right: "0",    bottom: "50%", bg: "rgba(239,68,68,.04)",   tc: "#b91c1c" },
    { label: "WARM",         sub: "Build pipeline",  top: "0",    left: "0",   right: "50%",  bottom: "50%", bg: "rgba(245,158,11,.03)",  tc: "#92400e" },
    { label: "MONITOR",      sub: "Watch signals",   top: "50%",  left: "50%", right: "0",    bottom: "0",   bg: "rgba(14,165,233,.03)",  tc: "#0369a1" },
    { label: "LOW PRIORITY", sub: "Deprioritize",    top: "50%",  left: "0",   right: "50%",  bottom: "0",   bg: "rgba(148,163,184,.04)", tc: "#94a3b8" },
  ];

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "1.125rem", padding: "1.5rem", boxShadow: "0 2px 12px rgba(0,0,0,.04)" }}>
      <VizLabel>Priority Quadrant</VizLabel>
      <div style={{ fontSize: ".9rem", fontWeight: 700, color: "#0f172a", marginBottom: ".2rem" }}>Where do your accounts land?</div>
      <div style={{ fontSize: ".78rem", color: "#64748b", marginBottom: "1rem" }}>ICP Fit × Signal Strength / Timing — sample data</div>

      <div style={{ position: "relative" as const, height: 256, border: "1px solid #e2e8f0", borderRadius: ".625rem", overflow: "hidden" as const }}>
        {quadrants.map(q => (
          <div key={q.label} style={{ position: "absolute" as const, top: q.top, left: q.left, right: q.right, bottom: q.bottom, background: q.bg }}>
            <div style={{ position: "absolute" as const, top: 5, left: 5 }}>
              <div style={{ fontSize: ".6rem", fontWeight: 700, color: q.tc, textTransform: "uppercase" as const, letterSpacing: ".04em" }}>{q.label}</div>
              <div style={{ fontSize: ".56rem", color: q.tc, opacity: .7 }}>{q.sub}</div>
            </div>
          </div>
        ))}

        {/* Axis dividers */}
        <div style={{ position: "absolute" as const, left: "50%", top: 0, bottom: 0, width: 1, background: "#e2e8f0", pointerEvents: "none" as const }} />
        <div style={{ position: "absolute" as const, top: "50%",  left: 0, right: 0, height: 1, background: "#e2e8f0", pointerEvents: "none" as const }} />

        {/* Axis labels */}
        <div style={{ position: "absolute" as const, bottom: 4, left: "50%", transform: "translateX(-50%)", fontSize: ".57rem", color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap" as const, pointerEvents: "none" as const }}>← ICP Fit →</div>
        <div style={{ position: "absolute" as const, top: "50%", left: 3, transform: "translateY(-50%) rotate(-90deg)", transformOrigin: "center center", fontSize: ".57rem", color: "#94a3b8", fontWeight: 500, whiteSpace: "nowrap" as const, pointerEvents: "none" as const }}>Signal</div>

        {/* Account dots */}
        {accounts.map(a => (
          <div key={a.name} style={{ position: "absolute" as const, left: `${a.x}%`, top: `${100 - a.y}%`, transform: "translate(-50%,-50%)", zIndex: 2 }}>
            <div style={{ position: "relative" as const }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: a.color, border: "2px solid #fff", boxShadow: "0 1px 5px rgba(0,0,0,.22)" }} />
              <div style={{ position: "absolute" as const, left: "50%", bottom: "calc(100% + 3px)", transform: "translateX(-50%)", background: "#1e293b", color: "#fff", fontSize: ".56rem", fontWeight: 600, padding: ".15rem .35rem", borderRadius: ".25rem", whiteSpace: "nowrap" as const, pointerEvents: "none" as const }}>
                {a.name}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: ".875rem", marginTop: ".75rem", flexWrap: "wrap" as const }}>
        {[{ c: "#ef4444", l: "HOT" }, { c: "#f59e0b", l: "WARM" }, { c: "#94a3b8", l: "MONITOR / LOW" }].map(l => (
          <div key={l.l} style={{ display: "flex", alignItems: "center", gap: ".3rem" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.c, flexShrink: 0 }} />
            <span style={{ fontSize: ".7rem", color: "#64748b" }}>{l.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Btn({ children, onClick, lg }: { children: React.ReactNode; onClick?: () => void; lg?: boolean }) {
  return (
    <button onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", padding: lg ? "1rem 2rem" : ".6rem 1.2rem", borderRadius: lg ? ".75rem" : ".6rem", fontWeight: 600, fontSize: lg ? "1.05rem" : ".9rem", cursor: "pointer", border: "none", background: "#0ea5e9", color: "#fff", transition: "all .15s", whiteSpace: "nowrap" as const }}
      onMouseOver={e => { e.currentTarget.style.background = "#0284c7"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(14,165,233,.4)"; }}
      onMouseOut={e => { e.currentTarget.style.background = "#0ea5e9"; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      {children}
    </button>
  );
}

function BtnOutline({ children, onClick, lg }: { children: React.ReactNode; onClick?: () => void; lg?: boolean }) {
  return (
    <button onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: ".4rem", padding: lg ? "1rem 2rem" : ".6rem 1.2rem", borderRadius: lg ? ".75rem" : ".6rem", fontWeight: 600, fontSize: lg ? "1.05rem" : ".9rem", cursor: "pointer", border: "1.5px solid #e2e8f0", background: "#fff", color: "#334155", transition: "all .15s", whiteSpace: "nowrap" as const }}
      onMouseOver={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
      onMouseOut={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
    >
      {children}
    </button>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "inline-block", background: "#e0f2fe", color: "#0284c7", fontSize: ".75rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".06em", padding: ".25rem .75rem", borderRadius: 999, marginBottom: "1rem" }}>
      {children}
    </div>
  );
}

function FormField({ label, value, onChange, multiline, type = "text", placeholder = "", required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; type?: string; placeholder?: string; required?: boolean;
}) {
  const id = useId();
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label htmlFor={id} style={labelStyle}>{label}{required ? " *" : ""}</label>
      {multiline
        ? <textarea id={id} required={required} value={value} onChange={e => onChange(e.target.value)} rows={2} placeholder={placeholder} style={inputStyle} />
        : <input id={id} required={required} type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
      }
    </div>
  );
}

function LeadSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: ".625rem" }}>{title}</div>
      {children}
    </div>
  );
}

function MetaCell({ label, val }: { label: string; val: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".06em", color: "#94a3b8", marginBottom: ".2rem" }}>{label}</div>
      <div style={{ fontSize: ".85rem", color: "#334155" }}>{val}</div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const sectionStyle:      React.CSSProperties = { padding: "3.25rem 1.5rem" };
const innerStyle:        React.CSSProperties = { maxWidth: "64rem", margin: "0 auto" };
const sectionTitleStyle: React.CSSProperties = { fontSize: "clamp(1.75rem,3.5vw,2.25rem)", fontWeight: 800, marginBottom: ".75rem", letterSpacing: "-.02em" };
const navLinkStyle:      React.CSSProperties = { fontSize: ".875rem", color: "#64748b", textDecoration: "none", cursor: "pointer", background: "none", border: "none" };
const labelStyle:        React.CSSProperties = { display: "block", fontSize: ".84rem", fontWeight: 600, color: "#334155", marginBottom: ".35rem" };
const inputStyle:        React.CSSProperties = { width: "100%", border: "1.5px solid #e2e8f0", borderRadius: ".625rem", padding: ".65rem .875rem", fontSize: ".9rem", fontFamily: "inherit", color: "#0f172a", outline: "none", background: "#fff", boxSizing: "border-box" as const, resize: "vertical" as const };

// ─── Utils ────────────────────────────────────────────────────────────────────

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function saveFile(content: string, name: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
}
