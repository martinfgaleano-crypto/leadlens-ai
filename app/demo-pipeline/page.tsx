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
    navLanguage: "Language",
    navCTA: "Get started",
    navHow: "How it works",
    planDetails: "What's included",
    navSample: "Sample",
    navFaq: "FAQ",
    heroCuriosity: "Markets change.",
    heroCuriosityEmph: "Your priorities should too.",
    heroBadge: "Account Opportunity Intelligence · B2B",
    heroH1pre: "Find the B2B accounts",
    heroH1hi: "worth working now",
    heroH1post: ".",
    heroH2: "And the evidence behind every opportunity.",
    heroSub: "Turn market evidence into clearer account decisions.",
    heroValue: {
      label: "What LeadLens helps you decide",
      items: [
        { h: "Know where to focus", p: "The accounts that most deserve your team's commercial attention." },
        { h: "Understand what changed", p: "The recent market and account developments behind each opportunity." },
        { h: "Act with evidence", p: "What supports the case, what's uncertain, and what to validate next." },
      ],
    },
    heroCTA: "Get started",
    heroPriceNote: "From $7 · one-time.",
    heroSeeAll: "View sample",
    heroNote: "No contact databases. No email lists. Just commercial intelligence.",
    proofLabels: [["5","account briefs"],["6–8","buyer segments"],["24–48h","delivery"],["Evidence","+ counterevidence"]] as [string,string][],
    howTag: "How it works",
    howTitle: { pre: "From commercial context to ", emph: "accounts worth working", post: " — in three steps." },
    howTitlePostMobile: ".",
    how: {
      step1Title: "Set the context",
      step1Copy: "Tell LeadLens what you sell, who you serve and where you're trying to grow. Have an ICP? We'll use it. If not, we'll help structure the criteria.",
      step2Title: "Investigate",
      step2Copy: "LeadLens finds relevant accounts, identifies meaningful changes and evaluates the dated evidence behind them.",
      step3Title: "Decide",
      step3Copy: "Get a prioritized portfolio and Account Briefs showing where to focus, why and what to validate next.",
      vSell: "What you sell", vServe: "Who you serve", vGrow: "Where you want to grow",
      vCriteria: "Opportunity criteria",
      vChanged: "What changed", vChangedVal: "Regional expansion",
      vSupported: "Supported by", vSupportedVal: "3 dated sources",
      vLadder: ["Observed", "Confirmed", "Corroborated"],
      vDecideReason: "Expansion + strong fit, corroborated",
      vValidate: "Validate", vValidateVal: "Procurement ownership",
    },
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
    monthlySub: "Monthly refreshed opportunities, signal updates, weekly opportunity digest, and recurring briefs — for teams that need periodic account re-evaluation.",
    monitorSubMobile: "Periodic account re-evaluation — monthly refreshes and recurring briefs.",
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
      sample:   "Validates: is LeadLens useful for my commercial context?",
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
    footerCopy: "© 2026 LeadLens — Account Opportunity Intelligence for B2B. We analyze public signals, not personal data.",
    footerLinks: ["Privacy", "Terms", "Refund Policy", "Contact"],
    footerContact: "Questions? Email us: operations@leadlensintel.com",
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
    samplePreviewTitle: "See the reasoning behind the decision.",
    samplePreviewSub: "Every account arrives as an Account Brief — the change, the evidence and its limits, and the decision.",
    sampleSeePricing: "See pricing →",
    faqTag: "FAQ",
    faqMore: "More questions",
    faqTitle: "Common questions",
    faqs: [
      ["What exactly do I get?", "A prioritized Opportunity Portfolio of accounts for your commercial context — each with an Account Brief: what changed, why it fits, why the timing may matter, the evidence and counterevidence, and what to validate before you act. Delivered as PDF + CSV in 24–48h."],
      ["How is this different from Apollo or ZoomInfo?", "Apollo and ZoomInfo are contact databases — you filter and export records. LeadLens gives you commercial intelligence: which companies are showing signals for your specific offer right now, why they're a good opportunity, and how to approach them. You don't get a list — you get criterion and context."],
      ["How is this different from Clay?", "Clay is infrastructure — a powerful platform for building enrichment workflows. LeadLens is opinionated: you describe your commercial context, we do the research and deliver a prioritized brief. No setup, no workflows, no technical knowledge required."],
      ["Do you sell email lists or contact databases?", "No. LeadLens analyzes publicly available commercial information about companies. We do not sell email lists, phone databases, or personal contact records."],
      ["How long does delivery take?", "Typically 24–48 hours after you share your commercial context. Every Opportunity Portfolio is reviewed before delivery."],
      ["What if the opportunities don't match what I need?", "If the opportunities consistently miss what you're looking for and we can't resolve it, you're eligible for a refund within 7 days. See our refund policy."],
      ["Is there a subscription or contract?", "No. One-time payment per Opportunity Portfolio. No recurring charges, no commitments, no hidden fees."],
      ["What happens after I purchase?", "You share your commercial context. LeadLens researches your market, evaluates what changed and the evidence behind each opportunity, and delivers your Opportunity Portfolio via email in 24–48h."],
      ["Does the preview use real data?", "No. The free preview shows the format and structure of a real Opportunity Portfolio using sample data. For a real Opportunity Portfolio with researched companies and verified signals, purchase an Opportunity Portfolio."],
    ] as [string, string][],
    ctaTag: "Get started",
    ctaTitle: "Now find yours.",
    ctaSub: "See which accounts the evidence says deserve your team's attention — and why.",
    ctaCTA: "Get started — from $7 →",
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
    sampleTeaserText: "Want the full reasoning behind a decision? See a complete Account Brief — the change, the evidence and counterevidence, what to validate, and the decision.",
    sampleTeaserCTA: "View full sample →",
    sampleTeaserNote: "Illustrative synthetic sample — no real company data.",
    trustItems: ["Source-verified signals", "Human-reviewed output", "No contact databases", "7-day refund policy"] as string[],
    afterPurchaseTitle: "After you buy:",
    afterPurchaseSteps: [
      "Share your commercial context — ICP optional.",
      "LeadLens structures the opportunity criteria and investigates the market.",
      "It evaluates what changed, the evidence, and what limits confidence.",
      "You receive your Opportunity Portfolio in 24–48h.",
    ] as string[],
    afterPurchaseNote: "Typical delivery: 24–48h. Nothing is sent automatically. You review every brief before acting.",
    faqCtaBridge: "Want to see the format first?",
    resultsUpgradeTitle: "Ready for real commercial intelligence?",
    resultsUpgradeSub: "An Opportunity Portfolio delivers 5 company briefs with signals, opportunity scores, and outreach strategy — researched and reviewed by our team in 24–48h.",
    resultsUpgradeCTA: "Get your Opportunity Report — from $7 →",
    checkoutEarlyBanner: "Checkout is in final review. Preview the sample report format while you wait.",
    comparisonTag: "How we compare",
    comparisonTitle: "LeadLens is not a database. It's decision intelligence.",
    diffLede: { pre: "Databases tell you who exists. Signal tools tell you what happened. LeadLens builds the ", emph: "case", post: " for whether an account is worth your team's attention — and what supports it." },
    diffOldLabel: "Most tools give you",
    diffOldItems: ["Company", "Industry", "Size", "Contacts"],
    diffOldFoot: "Static account data.",
    diffNewLabel: "LeadLens adds",
    diffNewItems: ["What Changed", "Evidence & counterevidence", "Fit & Timing", "A decision + what to validate"],
    diffNewFoot: "The case for the account — and against.",
    diffProofBold: "Don't trust a score — inspect the reasoning.",
    diffProofRest: " Every priority comes with the evidence, its limits, and what to validate before you act.",
    comparisonHeaders: ["", "Google", "Apollo / ZoomInfo", "Clay", "LeadLens"] as string[],
    comparisonRows: [
      ["What you get", "Pages and links", "Contact records to filter", "Data infrastructure", "Prioritized opportunity briefs"],
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
    navLanguage: "Idioma",
    navCTA: "Comenzar",
    navHow: "Cómo funciona",
    planDetails: "Qué incluye",
    navSample: "Muestra",
    navFaq: "FAQ",
    heroCuriosity: "Los mercados cambian.",
    heroCuriosityEmph: "Tus prioridades también.",
    heroBadge: "Inteligencia de Oportunidades de Cuenta · B2B",
    heroH1pre: "Encuentra las cuentas B2B",
    heroH1hi: "que vale la pena trabajar ahora",
    heroH1post: ".",
    heroH2: "Y la evidencia detrás de cada oportunidad.",
    heroSub: "Convierte la evidencia del mercado en decisiones de cuenta más claras.",
    heroValue: {
      label: "Qué te ayuda a decidir LeadLens",
      items: [
        { h: "Dónde enfocarte", p: "Las cuentas que más merecen la atención comercial de tu equipo." },
        { h: "Qué cambió", p: "Los desarrollos recientes de mercado y cuenta detrás de cada oportunidad." },
        { h: "Actúa con evidencia", p: "Qué respalda el caso, qué es incierto y qué validar a continuación." },
      ],
    },
    heroCTA: "Comenzar",
    heroPriceNote: "Desde $7 · pago único.",
    heroSeeAll: "Ver muestra",
    heroNote: "Sin bases de datos de contactos. Sin listas de emails. Solo inteligencia comercial.",
    proofLabels: [["5","account briefs"],["6–8","segmentos de compradores"],["24–48h","entrega"],["Evidencia","+ contraevidencia"]] as [string,string][],
    howTag: "Cómo funciona",
    howTitle: { pre: "Del contexto comercial a las ", emph: "cuentas que vale la pena trabajar", post: " — en tres pasos." },
    howTitlePostMobile: ".",
    how: {
      step1Title: "Define el contexto",
      step1Copy: "Cuéntale a LeadLens qué vendes, a quién atiendes y dónde quieres crecer. ¿Ya tienes un ICP? Lo usamos. Si no, ayudamos a estructurar los criterios.",
      step2Title: "Investiga",
      step2Copy: "LeadLens encuentra cuentas relevantes, identifica cambios significativos y evalúa la evidencia fechada detrás de ellos.",
      step3Title: "Decide",
      step3Copy: "Recibe un portafolio priorizado y Account Briefs que muestran dónde enfocarte, por qué y qué validar a continuación.",
      vSell: "Qué vendes", vServe: "A quién atiendes", vGrow: "Dónde quieres crecer",
      vCriteria: "Criterios de oportunidad",
      vChanged: "Qué cambió", vChangedVal: "Expansión regional",
      vSupported: "Respaldado por", vSupportedVal: "3 fuentes fechadas",
      vLadder: ["Observado", "Confirmado", "Corroborado"],
      vDecideReason: "Expansión + buen fit, corroborado",
      vValidate: "Validar", vValidateVal: "Titularidad de compras",
    },
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
    monthlySub: "Oportunidades actualizadas mensualmente, señales nuevas, resumen semanal de oportunidades y briefs recurrentes — para equipos que necesitan reevaluación periódica de cuentas.",
    monitorSubMobile: "Reevaluación periódica de cuentas: actualizaciones mensuales y briefs recurrentes.",
    monitorCTA: "Unirse a la lista piloto",
    monitorPrice: "Desde $99/mes",
    planNames: { sample: "Preview", starter: "Brief", standard: "Intelligence", pro: "Premium" },
    planDescs: {
      sample:   "Comprueba si LeadLens encuentra oportunidades defendibles para tu negocio — valida la calidad antes de comprometerte.",
      starter:  "Obtén un conjunto enfocado de cuentas que vale la pena investigar ahora, comparadas y priorizadas.",
      standard: "Descubre qué cuentas merecen prioridad y cómo asignar tu esfuerzo comercial.",
      pro:      "Convierte la inteligencia de oportunidades en una estrategia comercial enfocada.",
    },
    planFeatures: {
      sample:   ["1 ICP · 1 región","2 oportunidades completas","Qué cambió + fechas del evento + fuentes","Calidad de evidencia, Por qué ahora, fit y timing","Riesgos, qué validar, próxima acción","Veredicto del ICP: continuar / refinar / detener"],
      starter:  ["Todo lo de Preview","1 ICP · 1 región","6 oportunidades completas","Priorización inicial + estados (Actuar ya / Investigar / Monitorear)","Comparación Fit × Timing","Riesgos clave + secuencia recomendada","Executive Opportunity Brief"],
      standard: ["Todo lo de Brief","1 ICP · hasta 2 regiones","12 oportunidades completas","Priorización completa del portafolio + asignación","Riesgo del portafolio + brechas de cobertura","Centro de evidencia con priorización explicada","Próxima mejor investigación y acción","Executive Intelligence Brief"],
      pro:      ["Todo lo de Intelligence","Hasta 2 ICPs · hasta 3 regiones","18 oportunidades completas","Corroboración reforzada en cuentas prioritarias","Contraevidencia sistemática","Clusters más profundos + patrones de mercado","Secuencia estratégica + fechas de revalidación","Strategic Executive Brief"],
    },
    planCTAs: { sample: "Comenzar", starter: "Comenzar", standard: "Comenzar", pro: "Comenzar" },
    planFor: {
      sample:   "Para equipos que quieren prueba antes de invertir presupuesto real.",
      starter:  "Para equipos que necesitan una lista corta y defendible esta semana.",
      standard: "Para equipos B2B decidiendo dónde concentrar su esfuerzo comercial.",
      pro:      "Para equipos que convierten un portafolio priorizado en estrategia de cuentas.",
    },
    planDiff: {
      sample:   "Valida: ¿es útil LeadLens para mi contexto comercial?",
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
    footerCopy: "© 2026 LeadLens — Inteligencia de Oportunidades de Cuenta para B2B. Analizamos señales públicas, no datos personales.",
    footerLinks: ["Privacidad", "Términos", "Política de devolución", "Contacto"],
    footerContact: "¿Preguntas? Escríbenos: operations@leadlensintel.com",
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
    samplePreviewTitle: "Mira el razonamiento detrás de la decisión.",
    samplePreviewSub: "Cada cuenta llega como un Account Brief — el cambio, la evidencia y sus límites, y la decisión.",
    sampleSeePricing: "Ver precios →",
    faqTag: "Preguntas frecuentes",
    faqMore: "Más preguntas",
    faqTitle: "Preguntas comunes",
    faqs: [
      ["¿Qué recibo exactamente?", "Un Opportunity Portfolio priorizado de cuentas para tu ICP — cada una con un Account Brief: qué cambió, por qué encaja, por qué el timing puede importar, la evidencia y la contraevidencia, y qué validar antes de actuar. Entregado como PDF + CSV en 24–48h."],
      ["¿En qué se diferencia de Apollo o ZoomInfo?", "Apollo y ZoomInfo son bases de datos de contactos — filtras y exportas registros. LeadLens te da inteligencia comercial: qué empresas están mostrando señales para tu oferta específica ahora mismo, por qué son una buena oportunidad y cómo acercarte. No recibes una lista — recibes criterio y contexto."],
      ["¿En qué se diferencia de Clay?", "Clay es infraestructura — una plataforma poderosa para construir flujos de enriquecimiento. LeadLens es opinionado: describes tu ICP, nosotros hacemos la investigación y entregamos un brief priorizado. Sin configuración, sin flujos de trabajo, sin conocimiento técnico requerido."],
      ["¿Venden listas de emails o bases de datos de contactos?", "No. LeadLens analiza información comercial públicamente disponible sobre empresas. No vendemos listas de emails, bases de datos telefónicas ni registros de contactos personales."],
      ["¿Cuánto tarda la entrega?", "Típicamente 24–48 horas después de compartir tu contexto comercial. Cada Opportunity Portfolio es revisado antes de la entrega."],
      ["¿Qué pasa si las oportunidades no coinciden con mi ICP?", "Si fallamos consistentemente y no podemos resolverlo, tienes derecho a un reembolso dentro de 7 días. Ver política de devoluciones."],
      ["¿Hay suscripción o contrato?", "No. Pago único por Opportunity Portfolio. Sin cargos recurrentes, sin compromisos, sin tarifas ocultas."],
      ["¿Qué pasa después de comprar?", "Compartes tu contexto comercial. LeadLens investiga tu mercado, evalúa qué cambió y la evidencia detrás de cada oportunidad, y entrega tu Opportunity Portfolio por email en 24–48h."],
      ["¿La vista previa usa datos reales?", "No. La vista previa gratuita muestra el formato y la estructura de un Opportunity Portfolio real usando datos de ejemplo. Para un Opportunity Portfolio real con empresas investigadas y señales verificadas, compra un Opportunity Portfolio."],
    ] as [string, string][],
    ctaTag: "Comenzar",
    ctaTitle: "Ahora encuentra las tuyas.",
    ctaSub: "Descubre qué cuentas merecen la atención de tu equipo — y por qué.",
    ctaCTA: "Comenzar — desde $7 →",
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
    sampleTeaserText: "¿Quieres el razonamiento completo detrás de una decisión? Mira un Account Brief completo — el cambio, la evidencia y la contraevidencia, qué validar y la decisión.",
    sampleTeaserCTA: "Ver muestra completa →",
    sampleTeaserNote: "Muestra sintética ilustrativa — sin datos de empresas reales.",
    trustItems: ["Señales verificadas en fuentes", "Output revisado por humanos", "Sin bases de datos de contactos", "Política de reembolso de 7 días"] as string[],
    afterPurchaseTitle: "Después de comprar:",
    afterPurchaseSteps: [
      "Comparte tu contexto comercial — ICP opcional.",
      "LeadLens estructura los criterios de oportunidad e investiga el mercado.",
      "Evalúa qué cambió, la evidencia y qué limita la confianza.",
      "Recibes tu Opportunity Portfolio en 24–48h.",
    ] as string[],
    afterPurchaseNote: "Entrega típica: 24–48h. Nada se envía automáticamente. Tú revisas cada brief antes de actuar.",
    faqCtaBridge: "¿Quieres ver el formato primero?",
    resultsUpgradeTitle: "¿Listo para inteligencia comercial real?",
    resultsUpgradeSub: "Un Opportunity Portfolio entrega 5 briefs de empresa con señales, scores de oportunidad y estrategia de outreach — investigado y revisado por nuestro equipo en 24–48h.",
    resultsUpgradeCTA: "Obtener tu Opportunity Report — desde $7 →",
    checkoutEarlyBanner: "El checkout está en revisión final. Puedes ver el formato del Opportunity Portfolio de muestra mientras esperas.",
    comparisonTag: "Cómo nos comparamos",
    comparisonTitle: "LeadLens no es una base de datos. Es inteligencia para decidir.",
    diffLede: { pre: "Las bases de datos te dicen quién existe. Las herramientas de señales te dicen qué pasó. LeadLens construye el ", emph: "caso", post: " sobre si una cuenta merece la atención de tu equipo — y qué lo respalda." },
    diffOldLabel: "La mayoría de herramientas te dan",
    diffOldItems: ["Empresa", "Industria", "Tamaño", "Contactos"],
    diffOldFoot: "Datos estáticos de la cuenta.",
    diffNewLabel: "LeadLens añade",
    diffNewItems: ["Qué cambió", "Evidencia y contraevidencia", "Fit y Timing", "Una decisión + qué validar"],
    diffNewFoot: "El caso a favor de la cuenta — y en contra.",
    diffProofBold: "No confíes en un puntaje — inspecciona el razonamiento.",
    diffProofRest: " Cada prioridad viene con la evidencia, sus límites y qué validar antes de actuar.",
    comparisonHeaders: ["", "Google", "Apollo / ZoomInfo", "Clay", "LeadLens"] as string[],
    comparisonRows: [
      ["Qué obtienes", "Páginas y enlaces", "Registros de contactos para filtrar", "Infraestructura de datos", "Briefs de oportunidad priorizados"],
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
    navLanguage: "Idioma",
    navCTA: "Começar",
    navHow: "Como funciona",
    planDetails: "O que inclui",
    navSample: "Amostra",
    navFaq: "FAQ",
    heroCuriosity: "Os mercados mudam.",
    heroCuriosityEmph: "Suas prioridades também.",
    heroBadge: "Inteligência de Oportunidades de Conta · B2B",
    heroH1pre: "Encontre as contas B2B",
    heroH1hi: "que valem a pena trabalhar agora",
    heroH1post: ".",
    heroH2: "E a evidência por trás de cada oportunidade.",
    heroSub: "Transforme a evidência do mercado em decisões de conta mais claras.",
    heroValue: {
      label: "O que a LeadLens ajuda você a decidir",
      items: [
        { h: "Onde focar", p: "As contas que mais merecem a atenção comercial da sua equipe." },
        { h: "O que mudou", p: "Os desenvolvimentos recentes de mercado e conta por trás de cada oportunidade." },
        { h: "Aja com evidência", p: "O que sustenta o caso, o que é incerto e o que validar em seguida." },
      ],
    },
    heroCTA: "Começar",
    heroPriceNote: "A partir de $7 · pagamento único.",
    heroSeeAll: "Ver amostra",
    heroNote: "Sem bancos de dados de contatos. Sem listas de e-mails. Apenas inteligência comercial.",
    proofLabels: [["5","account briefs"],["6–8","segmentos de compradores"],["24–48h","entrega"],["Evidência","+ contraevidência"]] as [string,string][],
    howTag: "Como funciona",
    howTitle: { pre: "Do contexto comercial às ", emph: "contas que valem o esforço", post: " — em três passos." },
    howTitlePostMobile: ".",
    how: {
      step1Title: "Defina o contexto",
      step1Copy: "Diga à LeadLens o que você vende, quem você atende e onde quer crescer. Já tem um ICP? Nós o usamos. Se não, ajudamos a estruturar os critérios.",
      step2Title: "Investigue",
      step2Copy: "A LeadLens encontra contas relevantes, identifica mudanças significativas e avalia a evidência datada por trás delas.",
      step3Title: "Decida",
      step3Copy: "Receba um portfólio priorizado e Account Briefs mostrando onde focar, por quê e o que validar em seguida.",
      vSell: "O que você vende", vServe: "Quem você atende", vGrow: "Onde quer crescer",
      vCriteria: "Critérios de oportunidade",
      vChanged: "O que mudou", vChangedVal: "Expansão regional",
      vSupported: "Sustentado por", vSupportedVal: "3 fontes datadas",
      vLadder: ["Observado", "Confirmado", "Corroborado"],
      vDecideReason: "Expansão + bom fit, corroborado",
      vValidate: "Validar", vValidateVal: "Responsável por compras",
    },
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
    monthlySub: "Oportunidades atualizadas mensalmente, novos sinais, resumo semanal e briefs recorrentes — para equipes que precisam de reavaliação periódica de contas.",
    monitorSubMobile: "Reavaliação periódica de contas: atualizações mensais e briefs recorrentes.",
    monitorCTA: "Entrar na lista piloto",
    monitorPrice: "A partir de $99/mês",
    planNames: { sample: "Preview", starter: "Brief", standard: "Intelligence", pro: "Premium" },
    planDescs: {
      sample:   "Veja se a LeadLens encontra oportunidades defensáveis para o seu negócio — valide a qualidade antes de se comprometer.",
      starter:  "Receba um conjunto focado de contas que vale a pena investigar agora, comparadas e priorizadas.",
      standard: "Descubra quais contas merecem prioridade e como alocar seu esforço comercial.",
      pro:      "Transforme a inteligência de oportunidades em uma estratégia comercial focada.",
    },
    planFeatures: {
      sample:   ["1 ICP · 1 região","2 oportunidades completas","O que mudou + datas do evento + fontes","Qualidade da evidência, Por que agora, fit e timing","Riscos, o que validar, próxima ação","Veredito do ICP: continuar / refinar / parar"],
      starter:  ["Tudo do Preview","1 ICP · 1 região","6 oportunidades completas","Priorização inicial + status (Agir agora / Investigar / Monitorar)","Comparação Fit × Timing","Riscos-chave + sequência recomendada","Executive Opportunity Brief"],
      standard: ["Tudo do Brief","1 ICP · até 2 regiões","12 oportunidades completas","Priorização completa do portfólio + alocação","Risco do portfólio + lacunas de cobertura","Centro de evidência com priorização explicada","Próxima melhor investigação e ação","Executive Intelligence Brief"],
      pro:      ["Tudo do Intelligence","Até 2 ICPs · até 3 regiões","18 oportunidades completas","Corroboração reforçada em contas prioritárias","Contraevidência sistemática","Clusters mais profundos + padrões de mercado","Sequência estratégica + datas de revalidação","Strategic Executive Brief"],
    },
    planCTAs: { sample: "Começar", starter: "Começar", standard: "Começar", pro: "Começar" },
    planFor: {
      sample: "Para equipes que querem prova antes de investir.",
      starter: "Para equipes que precisam de uma lista curta e defensável.",
      standard: "Para equipes B2B decidindo onde concentrar esforço.",
      pro: "Para equipes convertendo portfólio em estratégia.",
    },
    planDiff: {
      sample: "Valida: a LeadLens é útil para o meu contexto comercial?",
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
    footerCopy: "© 2026 LeadLens — Inteligência de Oportunidades de Conta para B2B. Analisamos sinais públicos, não dados pessoais.",
    footerLinks: ["Privacidade", "Termos", "Política de Reembolso", "Contato"],
    footerContact: "Dúvidas? Fale conosco: operations@leadlensintel.com",
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
    samplePreviewTitle: "Veja o raciocínio por trás da decisão.",
    samplePreviewSub: "Cada conta chega como um Account Brief — a mudança, a evidência e seus limites, e a decisão.",
    sampleSeePricing: "Ver preços →",
    faqTag: "Perguntas frequentes",
    faqMore: "Mais perguntas",
    faqTitle: "Dúvidas comuns",
    faqs: [
      ["O que exatamente eu recebo?", "Um Opportunity Portfolio priorizado de contas para o seu ICP — cada uma com um Account Brief: o que mudou, por que encaixa, por que o timing pode importar, a evidência e a contraevidência, e o que validar antes de agir. Entregue como PDF + CSV em 24–48h."],
      ["Como é diferente do Apollo ou ZoomInfo?", "Apollo e ZoomInfo são bancos de dados de contatos — você filtra e exporta registros. LeadLens te dá inteligência comercial: quais empresas mostram sinais relevantes para sua oferta específica agora, por que são uma boa oportunidade e como abordá-las. Você não recebe uma lista — recebe critério e contexto."],
      ["Como é diferente do Clay?", "Clay é infraestrutura — uma plataforma poderosa para construir fluxos de enriquecimento. LeadLens é opinativo: você descreve seu ICP, nós fazemos a pesquisa e entregamos um brief priorizado. Sem configuração, sem fluxos de trabalho, sem conhecimento técnico necessário."],
      ["Vocês vendem listas de e-mails ou bancos de dados de contatos?", "Não. LeadLens analisa informações comerciais publicamente disponíveis sobre empresas. Não vendemos listas de e-mails, bancos de dados telefônicos nem registros de contatos pessoais."],
      ["Quanto tempo demora a entrega?", "Tipicamente 24–48 horas após você enviar seu formulário de ICP. Cada Opportunity Portfolio é revisado antes da entrega."],
      ["E se as oportunidades não combinarem com meu ICP?", "Se falharmos consistentemente e não conseguirmos resolver, você tem direito a reembolso em 7 dias. Consulte nossa política de reembolso."],
      ["Há assinatura ou contrato?", "Não. Pagamento único por Opportunity Portfolio. Sem cobranças recorrentes, sem compromissos, sem taxas ocultas."],
      ["O que acontece após a compra?", "Você compartilha seu contexto comercial. A LeadLens pesquisa seu mercado, avalia o que mudou e a evidência por trás de cada oportunidade, e entrega seu Opportunity Portfolio por e-mail em 24–48h."],
      ["A prévia usa dados reais?", "Não. A prévia gratuita mostra o formato e a estrutura de um Opportunity Portfolio real usando dados de exemplo. Para um Opportunity Portfolio real com empresas pesquisadas e sinais verificados, compre um Opportunity Portfolio."],
    ] as [string, string][],
    ctaTag: "Começar",
    ctaTitle: "Agora encontre as suas.",
    ctaSub: "Descubra quais contas merecem a atenção da sua equipe — e por quê.",
    ctaCTA: "Começar — a partir de $7 →",
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
    sampleTeaserText: "Quer o raciocínio completo por trás de uma decisão? Veja um Account Brief completo — a mudança, a evidência e a contraevidência, o que validar e a decisão.",
    sampleTeaserCTA: "Ver amostra completa →",
    sampleTeaserNote: "Amostra sintética ilustrativa — sem dados de empresas reais.",
    trustItems: ["Sinais verificados em fontes", "Output revisado por humanos", "Sem bancos de dados de contatos", "Política de reembolso de 7 dias"] as string[],
    afterPurchaseTitle: "Após a compra:",
    afterPurchaseSteps: [
      "Compartilhe seu contexto comercial — ICP opcional.",
      "A LeadLens estrutura os critérios de oportunidade e investiga o mercado.",
      "Avalia o que mudou, a evidência e o que limita a confiança.",
      "Você recebe seu Opportunity Portfolio em 24–48h.",
    ] as string[],
    afterPurchaseNote: "Entrega típica: 24–48h. Nada é enviado automaticamente. Você revisa cada brief antes de agir.",
    faqCtaBridge: "Quer ver o formato primeiro?",
    resultsUpgradeTitle: "Pronto para inteligência comercial real?",
    resultsUpgradeSub: "Um Opportunity Portfolio entrega 5 briefs de empresa com sinais, scores de oportunidade e estratégia de outreach — pesquisado e revisado pela nossa equipe em 24–48h.",
    resultsUpgradeCTA: "Obter seu Opportunity Report — a partir de $7 →",
    checkoutEarlyBanner: "O checkout está em revisão final. Visualize o formato do Opportunity Portfolio de exemplo enquanto espera.",
    comparisonTag: "Como nos comparamos",
    comparisonTitle: "LeadLens não é um banco de dados. É inteligência para decidir.",
    diffLede: { pre: "Bancos de dados dizem quem existe. Ferramentas de sinais dizem o que aconteceu. A LeadLens constrói o ", emph: "caso", post: " sobre se uma conta merece a atenção da sua equipe — e o que o sustenta." },
    diffOldLabel: "A maioria das ferramentas te dá",
    diffOldItems: ["Empresa", "Indústria", "Tamanho", "Contatos"],
    diffOldFoot: "Dados estáticos da conta.",
    diffNewLabel: "A LeadLens adiciona",
    diffNewItems: ["O que mudou", "Evidência e contraevidência", "Fit e Timing", "Uma decisão + o que validar"],
    diffNewFoot: "O caso a favor da conta — e contra.",
    diffProofBold: "Não confie em uma pontuação — inspecione o raciocínio.",
    diffProofRest: " Cada prioridade vem com a evidência, seus limites e o que validar antes de agir.",
    comparisonHeaders: ["", "Google", "Apollo / ZoomInfo", "Clay", "LeadLens"] as string[],
    comparisonRows: [
      ["O que você recebe", "Páginas e links", "Registros de contatos para filtrar", "Infraestrutura de dados", "Briefs de oportunidade priorizados"],
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
    navLanguage: "言語",
    navCTA: "始める",
    navHow: "使い方",
    planDetails: "含まれるもの",
    navSample: "サンプル",
    navFaq: "FAQ",
    heroCuriosity: "市場は変化します。",
    heroCuriosityEmph: "優先順位も変えるべきです。",
    heroBadge: "アカウント機会インテリジェンス · B2B",
    heroH1pre: "今週コンタクトする価値のある",
    heroH1hi: "B2Bアカウントを見つけましょう",
    heroH1post: "。",
    heroH2: "そして、各機会の裏付けとなる根拠を。",
    heroSub: "市場のエビデンスを、より明確なアカウントの意思決定へ。",
    heroValue: {
      label: "LeadLensが意思決定を支援すること",
      items: [
        { h: "どこに注力すべきか", p: "チームの商業的注目に最も値するアカウント。" },
        { h: "何が変わったか", p: "各オポチュニティの背後にある最近の市場・アカウントの動き。" },
        { h: "エビデンスで行動", p: "何が根拠を支え、何が不確かで、次に何を検証すべきか。" },
      ],
    },
    heroCTA: "始める",
    heroPriceNote: "$7から · 一回払い。",
    heroSeeAll: "サンプルを見る",
    heroNote: "コンタクトデータベースなし。メールリストなし。コマーシャルインテリジェンスのみ。",
    proofLabels: [["5件","アカウントブリーフ"],["6〜8","購買者セグメント"],["24〜48h","納品"],["エビデンス","+ 反証"]] as [string,string][],
    howTag: "使い方",
    howTitle: { pre: "商業的コンテキストから、", emph: "取り組む価値のあるアカウント", post: "へ — 3ステップで。" },
    howTitlePostMobile: "へ。",
    how: {
      step1Title: "コンテキストを設定",
      step1Copy: "何を売り、誰に提供し、どこで成長したいかをLeadLensに伝えてください。ICPがあれば活用します。なければ、条件の整理をお手伝いします。",
      step2Title: "調査する",
      step2Copy: "LeadLensは関連アカウントを見つけ、重要な変化を特定し、その背後にある日付付きのエビデンスを評価します。",
      step3Title: "意思決定",
      step3Copy: "優先順位付けされたポートフォリオとAccount Briefを受け取り、どこに注力すべきか、その理由、次に検証すべきことがわかります。",
      vSell: "何を売るか", vServe: "誰に提供するか", vGrow: "どこで成長したいか",
      vCriteria: "オポチュニティ条件",
      vChanged: "変化", vChangedVal: "地域拡大",
      vSupported: "裏付け", vSupportedVal: "日付付き3ソース",
      vLadder: ["観測", "確認", "裏付け完了"],
      vDecideReason: "拡大＋高い適合、裏付けあり",
      vValidate: "検証", vValidateVal: "調達の責任所在",
    },
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
    monthlySub: "毎月更新されるオポチュニティ、シグナル更新、週次オポチュニティダイジェスト、定期ブリーフ — 定期的なアカウント再評価を必要とするチーム向け。",
    monitorSubMobile: "定期的なアカウント再評価 — 毎月の更新と定期ブリーフ。",
    monitorCTA: "パイロットウェイトリストに登録",
    monitorPrice: "$99/月から",
    planNames: { sample: "Preview", starter: "Brief", standard: "Intelligence", pro: "Premium" },
    planDescs: {
      sample:   "LeadLensがあなたのビジネスに根拠のあるオポチュニティを見つけられるか確認 — コミット前に品質を検証。",
      starter:  "今調査する価値のあるアカウントの集中セットを、比較・優先順位付けして取得。",
      standard: "どのアカウントを優先すべきか、商業リソースをどう配分するかを把握。",
      pro:      "オポチュニティ・インテリジェンスを、集中した商業戦略に変える。",
    },
    planFeatures: {
      sample:   ["1 ICP · 1地域","2件の完全なオポチュニティ","変化 + イベント日付 + ソース","エビデンスの質、なぜ今、フィットとタイミング","リスク、検証すべきこと、次のアクション","ICP判定：続行 / 調整 / 停止"],
      starter:  ["Previewの全内容","1 ICP · 1地域","6件の完全なオポチュニティ","初期の優先順位付け + ステータス（今すぐ対応 / 調査 / 監視）","フィット × タイミング比較","主要リスク + 推奨シーケンス","エグゼクティブ・オポチュニティ・ブリーフ"],
      standard: ["Briefの全内容","1 ICP · 最大2地域","12件の完全なオポチュニティ","ポートフォリオ全体の優先順位付け + 配分","ポートフォリオのリスク + カバレッジのギャップ","優先順位の根拠を示すエビデンスセンター","次善の調査とアクション","エグゼクティブ・インテリジェンス・ブリーフ"],
      pro:      ["Intelligenceの全内容","最大2 ICP · 最大3地域","18件の完全なオポチュニティ","優先アカウントでの強化されたコロボレーション","体系的な反証","より深いクラスタ + 市場パターン","戦略的シーケンス + 再検証日","ストラテジック・エグゼクティブ・ブリーフ"],
    },
    planCTAs: { sample: "始める", starter: "始める", standard: "始める", pro: "始める" },
    planFor: {
      sample: "本格投資の前に品質を確認したいチーム向け。",
      starter: "今週行動できる短く堅実なリストが必要なチーム向け。",
      standard: "限られた営業リソースの配分を決めるB2Bチーム向け。",
      pro: "ポートフォリオを戦略に変えるチーム向け。",
    },
    planDiff: {
      sample: "検証：自社の商業的コンテキストにLeadLensは役立つか？",
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
    footerCopy: "© 2026 LeadLens — B2B向けアカウント機会インテリジェンス。公開シグナルを分析します。個人データは使用しません。",
    footerLinks: ["プライバシー", "利用規約", "返金ポリシー", "お問い合わせ"],
    footerContact: "ご質問は: operations@leadlensintel.com",
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
    samplePreviewTitle: "意思決定の背後にある根拠をご覧ください。",
    samplePreviewSub: "各アカウントはAccount Briefとして届きます — 変化、エビデンスとその限界、そして意思決定。",
    sampleSeePricing: "料金を見る →",
    faqTag: "よくある質問",
    faqMore: "その他の質問",
    faqTitle: "よくいただく質問",
    faqs: [
      ["具体的に何が得られますか？", "ICPに合わせた、優先順位付けされたアカウントのOpportunity Portfolio — 各アカウントにAccount Brief：何が変わったか、なぜ適合するか、なぜタイミングが重要か、エビデンスと反証、行動前に検証すべきこと。PDF + CSVで24〜48時間以内に納品します。"],
      ["ApolloやZoomInfoと何が違いますか？", "ApolloやZoomInfoはコンタクトデータベースです。フィルタリングしてエクスポートするためのレコードを提供します。LeadLensはコマーシャルインテリジェンスを提供します：あなたの特定のオファーに対して今シグナルを示している企業はどこか、なぜ良いオポチュニティか、どうアプローチするか。リストではなく、判断基準とコンテキストをお届けします。"],
      ["Clayとは何が違いますか？", "Clayはインフラです — エンリッチメントワークフローを構築するための強力なプラットフォームです。LeadLensは意見を持ちます：ICPを説明するとリサーチを行い、優先順位付きブリーフをお届けします。セットアップ不要、ワークフロー不要、技術的な知識不要。"],
      ["メールリストやコンタクトデータベースを販売していますか？", "いいえ。LeadLensは企業に関する公開されているビジネス情報を分析します。メールリスト、電話データベース、個人の連絡先レコードは販売していません。"],
      ["納品までどのくらいかかりますか？", "ICPフォーム送信後、通常24〜48時間以内に納品します。各Opportunity Portfolioは納品前にレビューします。"],
      ["オポチュニティがICPに合わなかった場合は？", "継続的に失敗し解決できない場合、7日以内に返金を申請できます。返金ポリシーをご確認ください。"],
      ["サブスクリプションや契約はありますか？", "いいえ。Opportunity Portfolioごとの1回払いです。継続課金なし、コミットメントなし、隠れた費用もありません。"],
      ["購入後はどうなりますか？", "商業的コンテキストを共有します。LeadLensが市場を調査し、各オポチュニティの背後にある変化とエビデンスを評価して、24〜48時間以内にメールでOpportunity Portfolioをお届けします。"],
      ["プレビューは実際のデータを使っていますか？", "いいえ。無料プレビューはサンプルデータを使用して、実際のOpportunity Portfolioの形式と構造を示しています。調査された企業と検証済みシグナルを含む実際のOpportunity Portfolioには、Opportunity Portfolioをご購入ください。"],
    ] as [string, string][],
    ctaTag: "始める",
    ctaTitle: "次は、あなたのアカウントを。",
    ctaSub: "どのアカウントがチームの注力に値するか、その理由とともに。",
    ctaCTA: "始める — $7から →",
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
    sampleTeaserText: "意思決定の背後にある完全な根拠をご覧になりたいですか？完全なAccount Briefをご覧ください — 変化、エビデンスと反証、検証すべきこと、そして意思決定。",
    sampleTeaserCTA: "完全なサンプルを見る →",
    sampleTeaserNote: "説明用の合成サンプル — 実企業データは含みません。",
    trustItems: ["ソース検証済みシグナル", "人によるレビュー済み出力", "コンタクトデータベースなし", "7日間返金ポリシー"] as string[],
    afterPurchaseTitle: "購入後の流れ：",
    afterPurchaseSteps: [
      "商業的コンテキストを共有 — ICPは任意。",
      "LeadLensがオポチュニティ条件を整理し、市場を調査します。",
      "何が変わったか、エビデンス、そして確信を限定する要因を評価します。",
      "24〜48時間以内にOpportunity Portfolioが届きます。",
    ] as string[],
    afterPurchaseNote: "通常の納品時間：24〜48時間。自動送信は一切ありません。行動する前に各ブリーフをご確認いただけます。",
    faqCtaBridge: "まず形式をご覧になりますか？",
    resultsUpgradeTitle: "実際のコマーシャルインテリジェンスを試す準備ができましたか？",
    resultsUpgradeSub: "Opportunity Portfolioはシグナル、オポチュニティスコア、アウトリーチ戦略付きの5件の企業ブリーフをお届けします — チームによる調査とレビュー済み、24〜48時間で。",
    resultsUpgradeCTA: "Opportunity Report — $7から →",
    checkoutEarlyBanner: "チェックアウトはローンチ前の最終審査中です。お待ちの間、サンプルOpportunity Portfolioのフォーマットをご確認いただけます。",
    comparisonTag: "比較",
    comparisonTitle: "LeadLensはデータベースではありません。意思決定のツールです。",
    diffLede: { pre: "データベースは誰が存在するかを、シグナルツールは何が起きたかを教えます。LeadLensは、アカウントがチームの注目に値するか、そして何がそれを裏付けるかについて、", emph: "根拠", post: "を構築します。" },
    diffOldLabel: "ほとんどのツールが提供するもの",
    diffOldItems: ["企業", "業界", "規模", "連絡先"],
    diffOldFoot: "静的なアカウントデータ。",
    diffNewLabel: "LeadLensが加えるもの",
    diffNewItems: ["何が変わったか", "エビデンスと反証", "フィットとタイミング", "意思決定 + 検証すべきこと"],
    diffNewFoot: "アカウントに賛成 — そして反対の根拠。",
    diffProofBold: "スコアを鵜呑みにせず、根拠を検証してください。",
    diffProofRest: " すべての優先順位には、エビデンス、その限界、そして行動前に検証すべきことが付きます。",
    comparisonHeaders: ["", "Google", "Apollo / ZoomInfo", "Clay", "LeadLens"] as string[],
    comparisonRows: [
      ["取得できるもの", "ページとリンク", "フィルター用コンタクトレコード", "データインフラ", "優先順位付けされたオポチュニティブリーフ"],
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
  // After-you-buy: rendered open (SSR + desktop, so crawlers/desktop see it); collapses
  // on mount for phones so it no longer consumes a full mobile viewport (§50–54).
  const [afterOpen, setAfterOpen] = useState(true);
  useEffect(() => { if (typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches) setAfterOpen(false); }, []);
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

  // Motion foundation: reveal `.ll-reveal` elements as they enter view (once).
  // One observer for the whole page; reduced-motion users already see content
  // (CSS base state is visible), so this is purely additive polish.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".ll-reveal:not(.ll-in)"));
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.classList.add("ll-in"); io.unobserve(e.target); }
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [view]);

  function changeLang(l: OutputLanguage) {
    setLang(l);
    setForm(f => ({ ...f, output_language: l }));
    // Keep the document language in sync for accessibility / semantics (§25).
    if (typeof document !== "undefined") document.documentElement.lang = l;
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
      <style dangerouslySetInnerHTML={{ __html: `
        .ll-pricing-grid { display: grid; gap: 1.5rem; max-width: 56rem; margin: 0 auto; align-items: stretch; grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 900px) { .ll-pricing-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 580px) { .ll-pricing-grid { grid-template-columns: 1fr; gap: 1.25rem; padding-top: .875rem; } }
        .ll-hero-grid { display: grid; grid-template-columns: 1fr 1.1fr; gap: 3rem; align-items: center; }
        /* Mobile-only acquisition value layer — hidden on desktop (2-col hero carries value). */
        .ll-hero-value { display: none; }
        @media (max-width: 840px) { .ll-hero-grid { grid-template-columns: 1fr; gap: 1.25rem; } .ll-hero-left { text-align: center; display: flex; flex-direction: column; align-items: center; min-width: 0; } .ll-hero-mock { margin-top: 0; width: 100%; min-width: 0; } }
        @media (max-width: 480px) { .ll-hero-mock { overflow: hidden; max-width: 100%; } }
        /* Navbar: single row; section links collapse into a mobile menu (§18–23). */
        /* overflow-x:clip contains horizontal overflow WITHOUT creating a scroll
           container, so the sticky nav below actually pins (overflow-x:hidden
           silently breaks position:sticky by making .ll-root scrollable). */
        .ll-root { overflow-x: clip; }
        .ll-nav-r { flex-wrap: nowrap !important; min-width: 0; }
        .ll-nav-links { display: flex; }
        .ll-nav-lang { display: inline-flex; }
        .ll-nav-cta { white-space: nowrap; }
        .ll-nav-signin { white-space: nowrap; }
        .ll-nav-burger { display: none; }
        /* Anchor offset so the sticky nav never covers a section heading. */
        section[id], .ll-section { scroll-margin-top: 76px; }
        /* Pricing anchor lands the heading peek + the 2×2 cards together (§136–142).
           Larger top margin reveals the title/subhead above the grid while pulling
           the cards up into the viewport. Tuned smaller on short/mobile viewports. */
        /* Desktop composes the section (heading tail + cards prominent). Mobile uses a
           large offset so the anchor sits low in the viewport, revealing the section
           from its eyebrow down = section START (§163–166). Tuned by real render. */
        .ll-price-anchor { scroll-margin-top: 270px; }
        @media (max-width: 820px) { .ll-price-anchor { scroll-margin-top: 300px; } }
        @media (max-width: 580px) { .ll-price-anchor { scroll-margin-top: 300px; } }
        /* Sample Output product-proof layout: copy left, real Brief right on desktop;
           eyebrow → mini-brief → CTA stacked on mobile (§180/§188). */
        /* Mobile-first flex stack (DOM order head → proof → cta). Desktop uses
           LINE-based grid placement (not grid-template-areas, which this build
           pipeline strips) so copy sits left over two rows and the Brief spans
           the right column. */
        .ll-sample-grid { display: flex; flex-direction: column; gap: 1.25rem; }
        .ll-sample-proof { width: 100%; max-width: 30rem; margin: 0 auto; }
        /* FAQ accordion: hide native marker, rotate chevron on open, comfy tap target */
        .ll-faq-item summary::-webkit-details-marker { display: none; }
        .ll-faq-item summary { min-height: 44px; box-sizing: border-box; }
        .ll-faq-chev { transition: transform .18s ease; }
        .ll-faq-item[open] .ll-faq-chev { transform: rotate(180deg); }
        .ll-faq-item summary:focus-visible { outline: 2px solid #38bdf8; outline-offset: -2px; }
        @media (min-width: 841px) {
          .ll-sample-grid { display: grid; grid-template-columns: 1fr 1.05fr; column-gap: 2.75rem; row-gap: 1.5rem; align-items: start; }
          .ll-sample-head  { grid-column: 1; grid-row: 1; }
          .ll-sample-cta   { grid-column: 1; grid-row: 2; align-self: end; }
          .ll-sample-proof { grid-column: 2; grid-row: 1 / span 2; align-self: center; justify-self: end; width: 100%; max-width: 27rem; margin: 0; }
        }
        @media (max-width: 820px) {
          .ll-nav-links { display: none !important; }
          .ll-nav-signin { display: none !important; }
          .ll-nav-lang { display: none !important; }
          .ll-nav-burger { display: inline-flex !important; align-items: center; }
        }
        @media (max-width: 680px) {
          /* Tighter nav so the logo leads and the CTA supports the hero (§14–17). */
          .ll-nav-wrap nav { padding: .5rem 1rem !important; }
          .ll-nav-r { gap: .75rem !important; }
          .ll-nav-cta button { font-size: .8rem !important; padding: .45rem .9rem !important; }
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
        /* Signature account workspace: rail + panel on desktop/tablet, chips on phone */
        .ll-ws-body { display: grid; grid-template-columns: 164px 1fr; }
        .ll-ws-chips { display: none; }
        .ll-ws-rail button:focus-visible, .ll-ws-chips button:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
        @media (max-width: 560px) {
          .ll-ws-body { grid-template-columns: 1fr; }
          .ll-ws-rail { display: none !important; }
          .ll-ws-chips { display: flex !important; }
        }
        /* Client Opportunity Canvas sample: collapse spatial grids on phones */
        .ll-cc-tabs::-webkit-scrollbar { display: none; }
        .ll-cc-tabs { scrollbar-width: none; }
        @media (max-width: 640px) { .ll-cc-tabs { padding-right: 2.75rem !important; -webkit-mask-image: linear-gradient(to right,#000 0,#000 calc(100% - 1.75rem),transparent 100%); mask-image: linear-gradient(to right,#000 0,#000 calc(100% - 1.75rem),transparent 100%); } }
        .ll-cc-tabs button:focus-visible { outline: 2px solid #0284c7; outline-offset: -2px; }
        @media (max-width: 720px) {
          .ll-cc-overview { grid-template-columns: 1fr !important; }
          .ll-cc-cases { grid-template-columns: 1fr !important; }
          .ll-cc-caselist { flex-direction: row !important; overflow-x: auto; gap: .4rem !important; }
          .ll-cc-caselist button { flex: 0 0 auto; min-width: 9rem; border: 1px solid #e6ebf1 !important; }
        }
        @keyframes llwsfade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .ll-ws-fade { animation: llwsfade .22s ease; }
        /* ── Motion foundation (Sprint 1): semantic reveal on scroll-in. Base
           state is fully visible so no-JS / reduced-motion always see content.
           Only when motion is allowed do elements start hidden and reveal. ── */
        .ll-reveal { opacity: 1; }
        @media (prefers-reduced-motion: no-preference) {
          .ll-reveal { opacity: 0; transform: translateY(16px); transition: opacity .55s cubic-bezier(.22,.61,.36,1), transform .55s cubic-bezier(.22,.61,.36,1); }
          .ll-reveal.ll-in { opacity: 1; transform: none; }
          /* "Change detected" — distinct but restrained: a small slide from the
             left, the direction of an incoming signal (not a bounce/pulse). */
          .ll-reveal-x { transform: translateX(-10px); }
          .ll-reveal-x.ll-in { transform: none; }
          /* "Decision resolves" — the pill settles in last, quiet significance. */
          .ll-reveal-pop { transform: translateY(6px) scale(.96); }
          .ll-reveal-pop.ll-in { transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ll-ws-rail button, .ll-ws-chips button { transition: none !important; }
          .ll-ws-fade { animation: none !important; }
        }
        /* Pricing: balanced 2×2, single column on phones (fixes 3+1 orphan) */
        .ll-price-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 1.25rem; max-width: 46rem; margin: 0 auto; align-items: stretch; }
        @media (max-width: 560px) {
          /* Mobile pricing compaction (§20–40): tighter cards, smaller price, tighter
             gap — key info (name/price/purpose/differentiator/CTA) stays visible;
             desktop is untouched. */
          .ll-price-grid { grid-template-columns: 1fr; max-width: 24rem; gap: .85rem; }
          .ll-price-card { padding: 1.25rem 1.3rem !important; border-radius: .9rem !important; text-align: left !important; }
          .ll-price-value { font-size: 2rem !important; }
          .ll-price-head { margin-bottom: .6rem !important; }
          .ll-price-cta { padding: .7rem !important; }
          .ll-price-card > details { margin-top: .6rem !important; }
          /* §38: per-card "One-time payment" is redundant on mobile — the pricing intro
             already states "Four one-time products". Hide the repeat; keep it on desktop. */
          .ll-price-onetime { display: none !important; }
        }
        /* After You Buy: hide the native marker; on mobile it becomes a real disclosure
           with a chevron affordance (open on desktop/SSR, collapsed ≤640). §50–54 */
        .ll-afterbuy > summary { list-style: none; }
        .ll-afterbuy > summary::-webkit-details-marker { display: none; }
        @media (max-width: 640px) {
          .ll-afterbuy { padding: 1rem 1.15rem !important; }
          .ll-afterbuy > summary { display: flex; align-items: center; justify-content: space-between; min-height: 44px !important; margin-bottom: 0 !important; }
          .ll-afterbuy > summary::after { content: "⌄"; font-size: 1.1rem; color: #94a3b8; }
          .ll-afterbuy[open] > summary { margin-bottom: 1rem !important; }
          .ll-afterbuy[open] > summary::after { content: "⌃"; }
          /* Opportunity Monitor: compact, clearly secondary to the 4 one-time tiers (§41–48) */
          .ll-monitor { padding: 1rem 1.15rem !important; gap: .75rem !important; margin-top: 1.25rem !important; }
          .ll-monitor .ll-monitor-title { font-size: .95rem !important; }
          .ll-monitor .ll-monitor-copy-full { display: none !important; }
          .ll-monitor .ll-monitor-copy-mobile { display: block !important; }
          .ll-monitor .ll-monitor-cta { width: 100% !important; text-align: center !important; }
        }
        /* Differentiation contrast: side-by-side on desktop, stacked with a downward arrow on phones */
        @media (max-width: 620px) { .ll-diff-grid { grid-template-columns: 1fr !important; } .ll-diff-arrow { transform: rotate(90deg); } }
        /* How-it-works: desktop = three connected stages on one continuous line;
           mobile = a single vertical spine the stages attach to (§15–24). */
        .ll-how-desktop { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: stretch; max-width: 64rem; margin: 0 auto; }
        .ll-how-mobile  { display: none; }
        .ll-how-suffix-mobile { display: none; }
        .ll-how-card { background: #fff; border: 1px solid #eef2f7; border-radius: 1rem; padding: 1.4rem 1.35rem; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; }
        .ll-how-conn { display: flex; align-items: center; padding: 0 .55rem; }
        @media (max-width: 820px) {
          .ll-how-desktop { display: none; }
          .ll-how-mobile  { display: block; max-width: 30rem; margin: 0 auto; }
        }
        @media (max-width: 640px) {
          /* Sections */
          .ll-section { padding: 2.25rem 1rem !important; }
          .ll-problem-sec { padding: 3rem 1rem !important; }
          .ll-cta-sec { padding: 2.5rem 1rem !important; }
          .ll-hero-outer { padding: 1rem 1.1rem 0 !important; }
          .ll-faq-inner { padding: 0 1rem !important; }
          .ll-monthly-card { padding: 1.5rem 1.125rem !important; }
          /* Mobile hero recomposition (§7–31): remove the promo layers (banner,
             duplicate H2, reassurance pill), left-align into an editorial hierarchy,
             turn the eyebrow into a restrained inline category marker, put a compact
             primary + inline "View sample →" on one action row, and pull the product
             canvas near the screen edge right after the actions so the marketing turns
             into the product instead of a separate screenshot. */
          .ll-announce { display: none !important; }
          .ll-hero-h2  { display: none !important; }
          .ll-hero-note { display: none !important; }
          .ll-hero-left { text-align: left !important; align-items: flex-start !important; }
          .ll-hero-badge { background: none !important; border: none !important; box-shadow: none !important; padding: 0 !important; margin-bottom: .95rem !important; font-size: .7rem !important; font-weight: 700 !important; letter-spacing: .04em !important; text-transform: uppercase !important; color: #0284c7 !important; }
          .ll-hero-h1    { font-size: 2rem !important; line-height: 1.12 !important; letter-spacing: -.025em !important; margin-bottom: .55rem !important; }
          .ll-hero-sub   { font-size: .95rem !important; font-weight: 500 !important; line-height: 1.45 !important; color: #64748b !important; margin-bottom: 1.1rem !important; }
          .ll-hero-cta-row { flex-direction: row !important; align-items: center !important; flex-wrap: wrap !important; gap: 1rem !important; margin-bottom: .55rem !important; }
          .ll-hero-cta-row > button:first-child { width: auto !important; padding: .7rem 1.4rem !important; font-size: .95rem !important; white-space: nowrap !important; }
          .ll-hero-cta2 { width: auto !important; align-self: center !important; background: none !important; border: none !important; box-shadow: none !important; color: #0284c7 !important; padding: .35rem 0 !important; font-size: .92rem !important; font-weight: 600 !important; white-space: nowrap !important; }
          .ll-hero-cta2::after { content: " →"; }
          .ll-hero-price { font-size: .78rem !important; margin: 0 !important; }
          /* Acquisition value layer: shown between hero actions and the product. */
          .ll-hero-value { display: block !important; margin-top: 1.6rem !important; }
          .ll-hero-value-label { font-size: .68rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #94a3b8; margin-bottom: .7rem; }
          .ll-hero-value-row { display: grid; grid-template-columns: auto 1fr; gap: .7rem; padding: .7rem 0; border-top: 1px solid #cfe6fb; }
          .ll-hero-value-row:first-of-type { border-top: none; padding-top: .05rem; }
          .ll-hero-value-dot { width: 7px; height: 7px; border-radius: 50%; background: #0ea5e9; margin-top: .5rem; }
          .ll-hero-value-h { font-size: .95rem; font-weight: 700; color: #0f172a; line-height: 1.25; }
          .ll-hero-value-p { font-size: .82rem; color: #64748b; line-height: 1.45; margin-top: .12rem; }
          .ll-hero-mock  { margin: 1.6rem -.6rem 0 !important; }
          /* How-it-works H2 smaller on mobile so it no longer dominates a viewport (§28);
             the full headline is kept (hiding the suffix would break JA grammar). */
          .ll-how-h2 { font-size: 1.5rem !important; line-height: 1.22 !important; }
          /* §55: shorten the How-it-works headline on mobile (drop "— in three steps."
             per-locale; JA keeps its へ particle so grammar stays intact). */
          .ll-how-suffix { display: none !important; }
          .ll-how-suffix-mobile { display: inline !important; }
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
      ` }} />

      {/* Announcement bar — hidden on mobile (the hero already carries the proposition;
          it added a promotional layer before the product on phones). §11–13. */}
      <div className="ll-announce" style={{ background: "linear-gradient(135deg,#075985,#0284c7)", color: "#fff", textAlign: "center", padding: ".55rem 1rem", fontSize: ".8rem", fontWeight: 500, letterSpacing: ".01em" }}>
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
          <div id="ll-nav-panel" className="ll-nav-panel" style={{ borderTop: "1px solid #e8f4fd", background: "#fff", padding: ".5rem 1.25rem 1.1rem" }}>
            {NAV_SECTIONS.map(sx => (
              <button key={sx.id} onClick={() => goToSection(sx.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid #f1f5f9", padding: ".85rem .25rem", minHeight: "44px", fontSize: ".95rem", fontWeight: 600, color: "#334155", cursor: "pointer", fontFamily: "inherit" }}>{sx.label}</button>
            ))}
            <a href="/login" style={{ display: "flex", alignItems: "center", width: "100%", padding: ".85rem .25rem", minHeight: "44px", boxSizing: "border-box" as const, fontSize: ".95rem", fontWeight: 600, color: "#334155", textDecoration: "none", borderBottom: "1px solid #f1f5f9" }}>{copy.navSignIn}</a>
            <div style={{ marginTop: ".85rem" }}>
              <Btn onClick={() => { setNavOpen(false); goToForm("standard", "nav"); }}>{copy.navCTA}</Btn>
            </div>
            {/* Localized language selector — mobile only lives here (the top nav has no
                room). Full-width row of language buttons with a visible selected state
                and ≥44px touch targets (§17–22). */}
            <div style={{ marginTop: "1.1rem", borderTop: "1px solid #f1f5f9", paddingTop: ".9rem" }}>
              <div style={{ fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".05em", color: "#94a3b8", marginBottom: ".55rem" }}>{copy.navLanguage}</div>
              <div role="group" aria-label={copy.navLanguage} style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" as const }}>
                {LANG_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => changeLang(o.value as OutputLanguage)} aria-pressed={lang === o.value}
                    style={{ flex: "1 1 44%", minHeight: "44px", borderRadius: ".55rem", border: `1.5px solid ${lang === o.value ? "#0ea5e9" : "#e2e8f0"}`, background: lang === o.value ? "#e0f2fe" : "#fff", color: lang === o.value ? "#0284c7" : "#334155", fontWeight: lang === o.value ? 700 : 600, fontSize: ".85rem", cursor: "pointer", fontFamily: "inherit" }}>
                    {o.label}
                  </button>
                ))}
              </div>
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
              <p className="ll-hero-h2" style={{ fontSize: "clamp(1.25rem,2.5vw,1.75rem)", fontWeight: 700, color: "#334155", marginBottom: "1.25rem", letterSpacing: "-.02em", lineHeight: 1.2 }}>
                {copy.heroH2}
              </p>
              <p className="ll-hero-sub" style={{ fontSize: "1.1rem", color: "#475569", marginBottom: "2.25rem", lineHeight: 1.7, maxWidth: "34rem" }}>
                {copy.heroSub}
              </p>
              <div className="ll-hero-cta-row" style={{ display: "flex", gap: ".875rem", flexWrap: "wrap" as const, marginBottom: ".55rem" }}>
                <Btn lg onClick={() => goToForm("standard", "hero")}>{copy.heroCTA}</Btn>
                <BtnOutline lg className="ll-hero-cta2" onClick={() => { window.location.href = "/sample"; }}>{copy.heroSeeAll}</BtnOutline>
              </div>
              {/* Two concepts kept explicitly separate (§128–132): the paid entry
                  price, and that the public sample is free to view without a card.
                  A single redundant "Preview sample report" link was removed so the
                  hero has exactly one sample action — the "View sample" button. */}
              <p className="ll-hero-price" style={{ fontSize: ".8rem", color: "#94a3b8", margin: "0 0 1.1rem", lineHeight: 1.5 }}>{copy.heroPriceNote}</p>
              <p className="ll-hero-note" style={{ display: "inline-block", fontSize: ".82rem", color: "#64748b", background: "#f0f9ff", border: "1px solid #e0f2fe", borderRadius: 999, padding: ".375rem 1rem", marginBottom: ".75rem" }}>
                {copy.heroNote}
              </p>
              {/* Mobile acquisition value layer (§10–35): three compact outcome
                  statements between the hero and the product proof, so a first-time
                  visitor understands what LeadLens helps them decide before the
                  Opportunity Portfolio appears. Mobile-only (hidden on desktop, where the
                  2-column hero already carries value); maps to Portfolio / What Changed /
                  Evidence. Editorial rows with hairlines — not feature cards, not numbers
                  (kept distinct from How it works). */}
              <div className="ll-hero-value">
                <div className="ll-hero-value-label">{copy.heroValue.label}</div>
                {copy.heroValue.items.map((it, i) => (
                  <div key={i} className="ll-hero-value-row">
                    <span className="ll-hero-value-dot" aria-hidden />
                    <div>
                      <div className="ll-hero-value-h">{it.h}</div>
                      <div className="ll-hero-value-p">{it.p}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Right column — signature interactive account workspace */}
            <div className="ll-hero-mock">
              <ClientCanvasSample />
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

      {/* Market-transition band — an editorial pause between the product proof and
          How it works: "Markets change. Your priorities should too." (§29/§108). */}
      <div style={{ background: "#0f172a", color: "#fff", padding: "1.75rem 1.5rem", textAlign: "center" }}>
        <p style={{ maxWidth: "42rem", margin: "0 auto", fontSize: "clamp(1.3rem,3vw,1.75rem)", fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.3 }}>
          {copy.heroCuriosity} <span style={{ color: "#7dd3fc" }}>{copy.heroCuriosityEmph}</span>
        </p>
      </div>

      {/* How it works */}
      <section id="how-it-works" className="ll-section" style={{ ...sectionStyle, background: "#f8fafc" }}>
        {(() => {
          const steps = [
            { n: "01", title: copy.how.step1Title, body: copy.how.step1Copy, viz: <HowStep1Viz how={copy.how} /> },
            { n: "02", title: copy.how.step2Title, body: copy.how.step2Copy, viz: <HowStep2Viz how={copy.how} /> },
            { n: "03", title: copy.how.step3Title, body: copy.how.step3Copy, viz: <HowStep3Viz how={copy.how} /> },
          ];
          const num = (n: string) => (
            <div style={{ display: "flex", alignItems: "center", gap: ".55rem", marginBottom: ".55rem" }}>
              <span style={{ fontSize: ".8rem", fontWeight: 800, color: "#0ea5e9", letterSpacing: ".04em" }}>{n}</span>
              <span aria-hidden style={{ width: 24, height: 1, background: "#dbe4ee" }} />
            </div>
          );
          const stepInner = (s: typeof steps[number]) => (
            <>
              {num(s.n)}
              <h3 style={{ fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-.01em", margin: "0 0 .35rem" }}>{s.title}</h3>
              <p style={{ color: "#64748b", fontSize: ".85rem", lineHeight: 1.55, margin: 0 }}>{s.body}</p>
              {s.viz}
            </>
          );
          return (
            <div style={innerStyle}>
              <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
                <Tag>{copy.howTag}</Tag>
                <h2 style={sectionTitleStyle} className="ll-how-h2 ll-reveal">{copy.howTitle.pre}<span style={{ color: "#0ea5e9" }}>{copy.howTitle.emph}</span><span className="ll-how-suffix">{copy.howTitle.post}</span><span className="ll-how-suffix-mobile">{copy.howTitlePostMobile}</span></h2>
              </div>

              {/* Desktop: three connected stages on one continuous line */}
              <div className="ll-how-desktop">
                {steps.flatMap((s, i) => [
                  <div key={s.n} className="ll-how-card">{stepInner(s)}</div>,
                  i < 2 ? (
                    <div key={s.n + "-c"} className="ll-how-conn" aria-hidden>
                      <span style={{ flex: 1, height: 2, background: "linear-gradient(90deg,#e2e8f0,#bae6fd)" }} />
                      <span style={{ color: "#7dd3fc", fontSize: "1.05rem", fontWeight: 800, marginLeft: 2 }}>›</span>
                    </div>
                  ) : null,
                ])}
              </div>

              {/* Mobile: one vertical spine the stages attach to */}
              <div className="ll-how-mobile">
                {steps.map((s, i) => (
                  <div key={s.n} style={{ display: "grid", gridTemplateColumns: "16px 1fr", columnGap: ".85rem" }}>
                    <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
                      <span aria-hidden style={{ width: 11, height: 11, borderRadius: "50%", background: "#0ea5e9", marginTop: 3, zIndex: 1, boxShadow: "0 0 0 3px #f8fafc" }} />
                      {i < 2 && <span aria-hidden style={{ position: "absolute", top: 14, bottom: "-1.4rem", width: 2, background: "#dbe4ee" }} />}
                    </div>
                    <div style={{ paddingBottom: i < 2 ? "1.4rem" : 0, minWidth: 0 }}>{stepInner(s)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </section>

      {/* Sample output — product proof. SHOWS a real Account Brief (built from the
          same intelligence primitives as the hero canvas) beside a tight commercial
          block, rather than describing it. Desktop: copy left / brief right. Mobile:
          eyebrow → mini-brief → CTA (grid-template-areas reorder). §175–190, §216. */}
      <section id="sample" className="ll-section" style={{ ...sectionStyle, background: "#f8fafc" }}>
        <div style={innerStyle}>
          <div className="ll-sample-grid">
            <div className="ll-sample-head">
              <Tag>{copy.samplePreviewTag}</Tag>
              <h2 className="ll-reveal" style={{ ...sectionTitleStyle, maxWidth: "20rem", marginBottom: ".6rem" }}>{copy.samplePreviewTitle}</h2>
              <p style={{ color: "#64748b", fontSize: "1.02rem", maxWidth: "24rem", margin: 0, lineHeight: 1.6 }}>
                {copy.samplePreviewSub}
              </p>
            </div>

            <div className="ll-sample-proof"><SampleBriefCard /></div>

            <div className="ll-sample-cta">
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" as const }}>
                <a href="/sample" style={{ display: "inline-block", background: "#0ea5e9", color: "#fff", borderRadius: ".75rem", padding: ".8rem 1.6rem", fontWeight: 700, fontSize: ".9rem", textDecoration: "none", boxShadow: "0 8px 20px rgba(14,165,233,.22)" }}>{copy.sampleTeaserCTA}</a>
                <button onClick={() => goToSection("pricing")} style={{ background: "none", border: "none", color: "#0284c7", fontSize: ".85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{copy.sampleSeePricing}</button>
              </div>
              <div style={{ fontSize: ".72rem", color: "#94a3b8", marginTop: ".85rem" }}>{copy.sampleTeaserNote}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Visualizations */}

      {/* Pricing */}
      <section ref={pricingRef} className="ll-section" style={{ ...sectionStyle, background: "#f8fafc" }}>
        <div style={{ ...innerStyle, textAlign: "center" }}>
          <Tag>{copy.pricingTag}</Tag>
          <h2 className="ll-reveal" style={sectionTitleStyle}>{copy.pricingTitle}</h2>
          <p style={{ color: "#64748b", fontSize: "1.05rem", maxWidth: "36rem", margin: "0 auto 1.75rem", lineHeight: 1.6 }}>
            {copy.pricingSub}
          </p>

          {/* Scroll anchor: nav "Pricing" and direct /#pricing land here so the
              heading context AND the pricing cards enter the viewport together —
              scroll-margin-top clears the sticky nav plus a heading peek (§136–142). */}
          <span id="pricing" className="ll-price-anchor" aria-hidden style={{ display: "block" }} />

          {/* Pricing ladder — clean 2×2 (no 3+1 orphan) */}
          <div className="ll-price-grid">
            <PricingCard plan="sample"   featured={false} copy={copy} onSelect={goToForm} />
            <PricingCard plan="starter"  featured={false} copy={copy} onSelect={goToForm} />
            <PricingCard plan="standard" featured={true}  copy={copy} onSelect={goToForm} />
            <PricingCard plan="pro"      featured={false} copy={copy} onSelect={goToForm} />
          </div>
          <p style={{ fontSize: ".8rem", color: "#94a3b8", maxWidth: "40rem", margin: "1.25rem auto 0" }}>{copy.launchNote}</p>

          {/* Plan comparison — collapsed by default to reduce density */}
          <details className="ll-compare-details" style={{ maxWidth: "80rem", margin: "1.75rem auto 0" }}>
            <summary style={{ cursor: "pointer", listStyle: "none", textAlign: "center", fontSize: ".85rem", fontWeight: 700, color: "#0284c7", padding: ".6rem 0", userSelect: "none" as const }}>
              {copy.compareTitle} ↓
            </summary>
            <ComparisonTable copy={copy} />
          </details>

          {/* Opportunity Monitor strip — coming soon (compact + secondary on mobile) */}
          <div className="ll-monitor" style={{ marginTop: "2rem", maxWidth: "62rem", margin: "2rem auto 0", background: "linear-gradient(135deg,#f0f9ff,#e0f2fe)", border: "1px solid #bae6fd", borderRadius: "1.125rem", padding: "1.5rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" as const }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: ".625rem", marginBottom: ".625rem", flexWrap: "wrap" as const }}>
                <span style={{ display: "inline-block", background: "#0ea5e9", color: "#fff", fontSize: ".65rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", padding: ".2rem .65rem", borderRadius: 999 }}>
                  {copy.monthlyTag}
                </span>
                <span style={{ fontSize: ".8rem", fontWeight: 600, color: "#0284c7" }}>{copy.monitorPrice}</span>
              </div>
              <h3 className="ll-monitor-title" style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em", marginBottom: ".375rem" }}>{copy.monthlyTitle}</h3>
              <p className="ll-monitor-copy ll-monitor-copy-full" style={{ fontSize: ".875rem", color: "#475569", lineHeight: 1.6, margin: 0, maxWidth: "40rem" }}>{copy.monthlySub}</p>
              <p className="ll-monitor-copy ll-monitor-copy-mobile" style={{ fontSize: ".8rem", color: "#475569", lineHeight: 1.45, margin: 0, maxWidth: "40rem", display: "none" }}>{copy.monitorSubMobile}</p>
            </div>
            <button className="ll-monitor-cta" onClick={() => goToForm("sample", "monitor")}
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

          {/* After you buy — open on desktop/SSR, collapsible on mobile (§50–54) */}
          <details className="ll-afterbuy" open={afterOpen} onToggle={e => setAfterOpen(e.currentTarget.open)} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "1rem", padding: "1.5rem 2rem", maxWidth: "44rem", margin: "1.5rem auto 0", textAlign: "left" as const }}>
            <summary style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: "1rem", cursor: "pointer", listStyle: "none", minHeight: "24px" }}>
              {copy.afterPurchaseTitle}
            </summary>
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
          </details>
        </div>
      </section>

      {/* Problem — LeadLens blue/white premium */}

      {/* Comparison */}
      <section className="ll-section" style={{ ...sectionStyle, background: "#fff" }}>
        <div style={{ ...innerStyle }}>
          <Tag>{copy.comparisonTag}</Tag>
          <h2 className="ll-reveal" style={{ ...sectionTitleStyle, maxWidth: "36rem" }}>{copy.comparisonTitle}</h2>
          <p style={{ color: "#64748b", fontSize: "1.05rem", maxWidth: "38rem", margin: ".75rem 0 0", lineHeight: 1.6 }}>
            {copy.diffLede.pre}<strong style={{ color: "#0284c7" }}>{copy.diffLede.emph}</strong>{copy.diffLede.post}
          </p>
          <div className="ll-diff-grid" style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "1.25rem", alignItems: "stretch", maxWidth: "52rem", margin: "2.5rem auto 0", textAlign: "left" as const }}>
            <div style={{ background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: "1rem", padding: "1.5rem" }}>
              <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "#94a3b8", marginBottom: ".9rem" }}>{copy.diffOldLabel}</div>
              {copy.diffOldItems.map(x => (
                <div key={x} style={{ fontSize: ".92rem", color: "#64748b", padding: ".3rem 0" }}>{x}</div>
              ))}
              <div style={{ marginTop: ".8rem", fontSize: ".8rem", color: "#94a3b8", fontStyle: "italic" as const }}>{copy.diffOldFoot}</div>
            </div>
            <div className="ll-diff-arrow" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#0ea5e9", fontSize: "1.6rem", fontWeight: 800 }}>→</div>
            <div style={{ background: "linear-gradient(180deg,#f0f9ff,#fff)", border: "1.5px solid #bae6fd", borderRadius: "1rem", padding: "1.5rem", boxShadow: "0 8px 28px rgba(14,165,233,.10)" }}>
              <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "#0284c7", marginBottom: ".9rem" }}>{copy.diffNewLabel}</div>
              {copy.diffNewItems.map(x => (
                <div key={x} style={{ fontSize: ".92rem", color: "#0f172a", fontWeight: 600, padding: ".3rem 0", display: "flex", gap: ".5rem" }}><span style={{ color: "#0ea5e9", flexShrink: 0 }}>✓</span>{x}</div>
              ))}
              <div style={{ marginTop: ".8rem", fontSize: ".8rem", color: "#0369a1", fontWeight: 600 }}>{copy.diffNewFoot}</div>
            </div>
          </div>
          <p style={{ maxWidth: "40rem", margin: "2.25rem auto 0", fontSize: ".98rem", color: "#475569", lineHeight: 1.6 }}>
            <strong style={{ color: "#0f172a" }}>{copy.diffProofBold}</strong>{copy.diffProofRest}
          </p>
        </div>
      </section>

      {/* "What you receive" section removed (V3): the Opportunity Portfolio + Account
          Brief product proof already demonstrates the deliverables — no separate
          explanatory grid needed (redundant copy). Copy keys retained for reuse. */}

      {/* FAQ */}
      <section id="faq" className="ll-section" style={{ ...sectionStyle, background: "#fff" }}>
        <div className="ll-faq-inner" style={{ maxWidth: "46rem", margin: "0 auto", padding: "0 1.5rem" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <Tag>{copy.faqTag}</Tag>
            <h2 className="ll-reveal" style={sectionTitleStyle}>{copy.faqTitle}</h2>
          </div>
          {/* Each question is a collapsible accordion (first open) so the FAQ scans
              as a tight list on mobile instead of a wall of open answers; the rest
              collapse under a "More questions" disclosure (§56/§57/§114). */}
          {(() => {
            const faqRow = ([q, a]: [string, string], i: number, arr: [string, string][]) => (
              <details key={i} open={i === 0} className="ll-faq-item" style={{ borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none", background: i % 2 === 0 ? "#fff" : "#fafbfc" }}>
                <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", gap: ".75rem", alignItems: "flex-start", padding: "1.05rem 1.5rem", fontWeight: 700, fontSize: ".925rem", color: "#0f172a", userSelect: "none" as const }}>
                  <span style={{ color: "#0ea5e9", fontWeight: 800, flexShrink: 0, fontSize: ".85rem", marginTop: ".1rem" }}>Q</span>
                  <span style={{ flex: 1 }}>{q}</span>
                  <span aria-hidden className="ll-faq-chev" style={{ color: "#94a3b8", flexShrink: 0, fontSize: "1.1rem", lineHeight: 1, marginTop: ".05rem" }}>⌄</span>
                </summary>
                <div style={{ fontSize: ".875rem", color: "#64748b", lineHeight: 1.65, padding: "0 1.5rem 1.15rem 3.25rem" }}>{a}</div>
              </details>
            );
            const primary = copy.faqs.slice(0, 5);
            const rest = copy.faqs.slice(5);
            return (
              <>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: "1rem", overflow: "hidden" }}>
                  {primary.map((f, i) => faqRow(f, i, primary))}
                </div>
                {rest.length > 0 && (
                  <details style={{ marginTop: "1rem" }}>
                    <summary style={{ cursor: "pointer", listStyle: "none", textAlign: "center", fontSize: ".85rem", fontWeight: 700, color: "#0284c7", padding: ".6rem 0", userSelect: "none" as const }}>
                      {copy.faqMore} ↓
                    </summary>
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: "1rem", overflow: "hidden", marginTop: ".5rem" }}>
                      {rest.map((f, i) => faqRow(f, i, rest))}
                    </div>
                  </details>
                )}
              </>
            );
          })()}
          {/* FAQ → CTA bridge */}
          <div style={{ marginTop: "1.75rem", textAlign: "center" }}>
            <span style={{ fontSize: ".875rem", color: "#64748b" }}>{copy.faqCtaBridge}{" "}</span>
            <button onClick={() => { window.location.href = "/sample"; }} style={{ background: "none", border: "none", color: "#0ea5e9", fontSize: ".875rem", fontWeight: 600, cursor: "pointer", textDecoration: "underline", padding: 0, fontFamily: "inherit" }}>
              {copy.heroSeeAll} →
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
          {/* One dominant action + a light secondary text link (§71–73). */}
          <div style={{ display: "flex", gap: "1.4rem", justifyContent: "center", alignItems: "center", flexWrap: "wrap" as const }}>
            <button onClick={() => goToForm("starter", "final")}
              style={{ background: "#fff", color: "#0284c7", border: "none", borderRadius: ".75rem", padding: ".85rem 1.6rem", fontWeight: 700, fontSize: ".95rem", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,.15)", transition: "all .15s" }}
              onMouseOver={e => { e.currentTarget.style.background = "#f0f9ff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseOut={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = ""; }}
            >
              {copy.ctaCTA}
            </button>
            <button onClick={() => { window.location.href = "/sample"; }}
              style={{ background: "none", color: "#e0f2fe", border: "none", padding: ".35rem", fontWeight: 600, fontSize: ".95rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              {copy.heroSeeAll} →
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
            const hrefs = ["/privacy", "/terms", "/refund", "mailto:operations@leadlensintel.com"];
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
  const cell = (label: string, val: string) => {
    // Fallback keeps an unrecognized strength value from crashing the hero.
    const s = STRENGTH[val] ?? { color: "#475569", weight: 600 };
    return (
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: ".28rem" }}>
        <span style={{ fontSize: ".6rem", color: "#94a3b8", fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: ".03em" }}>{label}</span>
        <span style={{ fontSize: ".68rem", color: s.color, fontWeight: s.weight }}>{val}</span>
      </span>
    );
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: ".1rem .7rem", alignItems: "center" }}>
      {cell("Fit", fit)}{cell("Timing", timing)}{cell("Evidence", evidence)}
    </div>
  );
}

// ─── Signature interactive product experience (V4) ───────────────────────────
// A selected-account workspace: pick an account → see What Changed → Evidence →
// Counterevidence → Decision → What to Validate. Deterministic, local, keyboard-
// accessible; no API/provider. This is the homepage's signature product moment.
// Each account is a distinct analytical story: change → evidence (with source
// relations + a corroboration ladder) → confidence limiters (each paired to a
// validation) → decision. Synthetic/illustrative only.
type WsSource = { type: string; note: string; age: string; rel: "Direct" | "Corroborating" | "Context" };
type WsAccount = {
  rank: number; name: string; seg: string; state: string; fresh: string;
  role: string; oppType: string; thesis: string; whyNow: string;
  changed: string; changedAge: string; fit: string; timing: string; evidence: string;
  support: string;   // Independent Support summary (compressed evidence)
  ladder: 1 | 2 | 3; sources: WsSource[];
  limiters: { limit: string; validate: string }[]; decisionWhy: string; next: string;
};
const WS_ACCOUNTS: WsAccount[] = [
  { rank: 1, name: "Northstar Logistics", seg: "Mid-market logistics · US Midwest", state: "prioritize", fresh: "9d",
    role: "Potential Customer", oppType: "Operations Expansion",
    thesis: "Northstar is building out regional distribution — plausibly widening its supplier and tooling needs before it formalizes procurement, a window to engage ahead of an RFP.",
    whyNow: "Scaling distribution typically strains an existing supplier network before teams plan for it — the moment to enter is now, not after procurement closes.",
    changed: "Signed a regional distribution agreement", changedAge: "9d ago",
    fit: "Strong", timing: "Strong", evidence: "Strong", support: "Corroborated · 3 sources", ladder: 3,
    sources: [{ type: "Company announcement", note: "distribution agreement", age: "9d", rel: "Direct" }, { type: "Industry publication", note: "new distribution sites", age: "12d", rel: "Corroborating" }, { type: "Careers page", note: "4 operations roles", age: "15d", rel: "Context" }],
    limiters: [{ limit: "Procurement ownership not confirmed", validate: "Confirm whether regional purchasing is centralized at group level" }],
    decisionWhy: "Recent, corroborated expansion with strong fit and timing.",
    next: "Validate regional procurement ownership before outreach." },
  { rank: 2, name: "FreshRoute Foods", seg: "Regional food distribution · US Southeast", state: "validate", fresh: "14d",
    role: "Potential Customer", oppType: "Operations Expansion",
    thesis: "FreshRoute is expanding its distribution footprint — a plausible fit for new supply, but the change is only partly corroborated and the scope is not yet clear.",
    whyNow: "New sites usually reopen supplier decisions, but only if they touch your category — worth confirming before committing attention.",
    changed: "Opened two new distribution sites", changedAge: "14d ago",
    fit: "Strong", timing: "Moderate", evidence: "Moderate", support: "Partly corroborated · 2 sources", ladder: 2,
    sources: [{ type: "Regional press", note: "two new sites", age: "14d", rel: "Direct" }, { type: "Company blog", note: "expansion note", age: "19d", rel: "Context" }],
    limiters: [{ limit: "Only one direct corroboration; category scope unclear", validate: "Confirm the new sites affect your target category" }],
    decisionWhy: "Good fit, but the change is only partly corroborated.",
    next: "Corroborate and confirm scope before prioritizing." },
  { rank: 3, name: "Atlas Clinics Group", seg: "Multi-location healthcare · US West", state: "monitor", fresh: "21d",
    role: "Potential Customer", oppType: "Facility Expansion",
    thesis: "Atlas is opening clinic locations — a relevant operator, but with no recent operations or sourcing event the timing case is still thin.",
    whyNow: "Location growth can precede new sourcing, but without an operations signal the window is not open yet.",
    changed: "Announced two new clinic locations", changedAge: "21d ago",
    fit: "Moderate", timing: "Limited", evidence: "Limited", support: "Single-sourced · 2 sources", ladder: 1,
    sources: [{ type: "Local news", note: "two clinic locations", age: "21d", rel: "Direct" }, { type: "Company site", note: "locations page", age: "24d", rel: "Context" }],
    limiters: [{ limit: "No recent operations or sourcing event", validate: "Watch for an operations or vendor signal before acting" }],
    decisionWhy: "Relevant account, but timing evidence is thin.",
    next: "Monitor for a fresher timing signal before acting." },
];

const REL_COLOR: Record<string, string> = { Direct: "#0284c7", Corroborating: "#15803d", Context: "#94a3b8" };
const LADDER = ["Observed", "Confirmed", "Corroborated"];

// One connected analytical step on the canvas spine.
function CanvasStep({ dotColor, last, label, meta, children }: { dotColor: string; last?: boolean; label: string; meta?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "16px 1fr", columnGap: ".7rem" }}>
      <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: dotColor, marginTop: "1px", zIndex: 1, boxShadow: "0 0 0 3px #fff" }} />
        {!last && <span aria-hidden style={{ position: "absolute", top: 13, bottom: "-.7rem", width: 2, background: "#e4ebf3" }} />}
      </div>
      <div style={{ paddingBottom: last ? 0 : ".85rem", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: ".5rem", marginBottom: ".3rem" }}>
          <span style={{ fontSize: ".6rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#64748b" }}>{label}</span>
          {meta && <span style={{ fontSize: ".64rem", color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>{meta}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

// Synthetic CLIENT that is the subject of the sample canvas. The discovered
// accounts (WS_ACCOUNTS) are the opportunities that live INSIDE it. Illustrative.
const WS_CLIENT = {
  name: "Asteron Systems",
  objective: "Find enterprise accounts where operational expansion creates a credible near-term software opportunity.",
  market: "United States · Enterprise logistics & operations software",
  read: "Two accounts merit attention now on recent, corroborated operational expansion; one more needs validation of category scope. The strongest pattern is regional distribution build-outs creating near-term tooling needs.",
  patterns: ["All three accounts show operational expansion in the last 30 days.", "Distribution build-outs are the dominant trigger.", "Healthcare facility growth is early — no sourcing signal yet."],
  coverage: [["3/3", "with dated evidence"], ["2", "independently corroborated"], ["9d", "latest evidence"]] as [string, string][],
  strategy: [
    "Prioritize Northstar Logistics first — timing and evidence are strongest and the change is corroborated.",
    "Validate FreshRoute's category scope before allocating active attention.",
    "Monitor Atlas Clinics for an operations or sourcing signal before acting.",
  ],
};

// The Opportunity Case reasoning spine (frozen grammar) for one account — reused
// by the Opportunity Cases tab. Extracted from the previous hero canvas.
function CaseSpine({ a }: { a: WsAccount }) {
  const dstate = DECISION_STATES[a.state];
  return (
    <div>
      <div style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase" as const, color: "#0284c7", marginBottom: ".3rem" }}>{a.role} · {a.oppType}</div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: ".5rem" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: ".98rem", color: "#0f172a", letterSpacing: "-.02em", lineHeight: 1.15 }}>{a.name}</div>
          <div style={{ fontSize: ".66rem", color: "#64748b", marginTop: ".12rem" }}>{a.seg}</div>
        </div>
        <DecisionPill state={a.state} />
      </div>
      <p style={{ fontSize: ".76rem", color: "#475569", lineHeight: 1.5, margin: ".5rem 0 0", fontWeight: 500 }}>{a.thesis}</p>
      <div style={{ margin: ".55rem 0 .8rem", paddingTop: ".55rem", borderTop: "1px solid #eef2f7" }}><FTE fit={a.fit} timing={a.timing} evidence={a.evidence} /></div>
      <CanvasStep dotColor="#0ea5e9" label="What changed" meta={a.changedAge}>
        <div style={{ fontSize: ".86rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{a.changed}</div>
      </CanvasStep>
      <CanvasStep dotColor="#94a3b8" label="Why it matters now">
        <div style={{ fontSize: ".76rem", color: "#334155", lineHeight: 1.45 }}>{a.whyNow}</div>
      </CanvasStep>
      <CanvasStep dotColor="#0284c7" label="Evidence">
        <div style={{ display: "flex", alignItems: "baseline", gap: ".5rem", flexWrap: "wrap" as const, fontSize: ".72rem", color: "#475569", marginBottom: ".4rem" }}>
          <span style={{ fontWeight: 700, color: STRENGTH[a.evidence]?.color ?? "#0e7490" }}>{a.evidence}</span><span>· {a.support}</span><span>· latest {a.sources[0].age}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: ".3rem", marginBottom: ".4rem" }}>
          {LADDER.map((step, i) => { const reached = i < a.ladder; return (
            <span key={step} style={{ display: "inline-flex", alignItems: "center", gap: ".3rem" }}>
              <span style={{ fontSize: ".6rem", fontWeight: reached ? 700 : 500, color: reached ? "#0f172a" : "#cbd5e1" }}>{step}</span>
              {i < 2 && <span style={{ color: reached && i + 1 < a.ladder ? "#0284c7" : "#dbe3ec", fontSize: ".6rem" }}>→</span>}
            </span>); })}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem", fontSize: ".72rem" }}>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}><span style={{ fontWeight: 600, color: "#0f172a" }}>{a.sources[0].type}</span> <span style={{ color: "#64748b" }}>— {a.sources[0].note}</span></span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: ".25rem", fontSize: ".6rem", fontWeight: 700, color: REL_COLOR[a.sources[0].rel], flexShrink: 0 }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: REL_COLOR[a.sources[0].rel] }} />{a.sources[0].rel}</span>
        </div>
        {a.sources.length > 1 && <div style={{ fontSize: ".62rem", color: "#94a3b8", marginTop: ".25rem" }}>+{a.sources.length - 1} more source{a.sources.length > 2 ? "s" : ""} in the full Opportunity Case</div>}
      </CanvasStep>
      <CanvasStep dotColor="#d97706" label="What to validate">
        <div style={{ display: "flex", alignItems: "baseline", gap: ".4rem", flexWrap: "wrap" as const }}>
          <span style={{ fontSize: ".54rem", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#b45309", background: "#fffbeb", border: "1px solid #fde9c8", borderRadius: 4, padding: ".05rem .3rem" }}>Decision-critical</span>
          <span style={{ fontSize: ".76rem", color: "#0f172a", fontWeight: 600, lineHeight: 1.4 }}>{a.limiters[0].validate}</span>
        </div>
        <div style={{ fontSize: ".68rem", color: "#94a3b8", marginTop: ".25rem", lineHeight: 1.4 }}><span style={{ fontWeight: 700 }}>Still unknown</span> · {a.limiters[0].limit}</div>
      </CanvasStep>
      <CanvasStep dotColor={dstate.dot} last label="Decision">
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap", marginBottom: ".2rem" }}><DecisionPill state={a.state} /><span style={{ fontSize: ".72rem", color: "#475569" }}>{a.decisionWhy}</span></div>
        <div style={{ fontSize: ".78rem", color: "#0f172a", fontWeight: 600, lineHeight: 1.35, marginTop: ".2rem" }}>{a.next}</div>
      </CanvasStep>
    </div>
  );
}

const CC_TABS = ["overview", "cases", "evidence", "compare", "strategy"] as const;
type CcTab = typeof CC_TABS[number];
const CC_TAB_LABEL: Record<CcTab, string> = { overview: "Overview", cases: "Opportunity Cases", evidence: "Evidence", compare: "Compare", strategy: "Portfolio Intelligence" };
const zk: React.CSSProperties = { fontSize: ".58rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "#64748b", margin: "0 0 .5rem" };
const scard: React.CSSProperties = { border: "1px solid #e6ebf1", borderRadius: ".7rem", padding: ".7rem .8rem", background: "#fafbfc" };

// The signature LeadLens surface: CLIENT → Opportunity Canvas → Cases → Evidence
// → Compare → Portfolio Intelligence. Light, client-as-subject; opportunities live inside.
function ClientCanvasSample() {
  const [tab, setTab] = useState<CcTab>("overview");
  const [sel, setSel] = useState(0);
  const a = WS_ACCOUNTS[sel];
  const open = (i: number) => { setSel(i); setTab("cases"); };
  const onCanvasTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, current: CcTab) => {
    const index = CC_TABS.indexOf(current);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % CC_TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + CC_TABS.length) % CC_TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = CC_TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(CC_TABS[next]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  const dist = (["prioritize", "validate", "monitor", "hold"] as const).map(s => ({ s, n: WS_ACCOUNTS.filter(x => x.state === s).length })).filter(x => x.n > 0);

  return (
    <div style={{ background: "#fff", border: "1px solid #e6ebf1", borderTop: "3px solid #0b1220", borderRadius: ".9rem", boxShadow: "0 16px 44px rgba(15,23,42,.10)", overflow: "hidden" }}>
      {/* Persistent client header */}
      <div style={{ padding: "1rem 1.1rem .55rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem" }}>
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: ".5rem" }}>
            <span style={{ fontSize: ".82rem", fontWeight: 800, color: "#0b1220" }}>Lead<span style={{ color: "#0284c7" }}>Lens</span></span>
            <span style={{ fontSize: ".54rem", fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase" as const, color: "#94a3b8" }}>Account Opportunity Intelligence</span>
          </span>
          <span style={{ color: "#0369a1", background: "#f0f9ff", border: "1px solid #e0f2fe", fontSize: ".54rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" as const, padding: ".15rem .5rem", borderRadius: 999, flexShrink: 0 }}>Sample</span>
        </div>
        <div style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-.025em", color: "#0b1220", marginTop: ".45rem", lineHeight: 1.1 }}>{WS_CLIENT.name}</div>
        <div style={{ fontSize: ".72rem", color: "#475569", lineHeight: 1.45, marginTop: ".35rem" }}>
          <span style={{ fontSize: ".55rem", fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase" as const, color: "#0284c7", marginRight: ".4rem" }}>Objective</span>{WS_CLIENT.objective}
        </div>
        <div style={{ fontSize: ".62rem", color: "#94a3b8", marginTop: ".3rem" }}>{WS_CLIENT.market} · <strong style={{ color: "#475569" }}>{WS_ACCOUNTS.length}</strong> opportunities evaluated</div>
      </div>

      {/* Tab rail */}
      <div role="tablist" aria-label="LeadLens sample" className="ll-cc-tabs" style={{ display: "flex", gap: ".1rem", padding: "0 .8rem", borderBottom: "1px solid #eef2f6", overflowX: "auto" }}>
        {CC_TABS.map(tb => { const on = tb === tab; return (
          <button key={tb} role="tab" aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => setTab(tb)} onKeyDown={(event) => onCanvasTabKey(event, tb)}
            style={{ appearance: "none", background: "none", border: "none", borderBottom: `2px solid ${on ? "#0284c7" : "transparent"}`, padding: ".55rem .55rem", fontFamily: "inherit", fontSize: ".68rem", fontWeight: 700, color: on ? "#0369a1" : "#64748b", cursor: "pointer", whiteSpace: "nowrap" as const }}>
            {CC_TAB_LABEL[tb]}
          </button>); })}
      </div>

      <div key={tab} className="ll-ws-fade" style={{ padding: "1rem 1.1rem 1.1rem", minHeight: "18rem" }}>
        {/* OVERVIEW — the Client Opportunity Canvas */}
        {tab === "overview" && (
          <div>
            <div style={{ padding: ".1rem 0 .1rem .7rem", borderLeft: "3px solid #0284c7", marginBottom: ".9rem" }}>
              <div style={{ fontSize: ".55rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "#0284c7", marginBottom: ".25rem" }}>LeadLens Read</div>
              <div style={{ fontSize: ".82rem", color: "#0f172a", lineHeight: 1.5 }}>{WS_CLIENT.read}</div>
            </div>
            <div className="ll-cc-overview" style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: ".9rem", alignItems: "start" }}>
              <div>
                <div style={zk}>Where to focus · Opportunity landscape</div>
                <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
                  {WS_ACCOUNTS.map((acc, i) => { const primary = i === 0; return (
                    <button key={acc.name} onClick={() => open(i)} className={primary ? undefined : "ll-reveal"}
                      style={{ appearance: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit", border: `1px solid ${primary ? "#bae6fd" : "#e6ebf1"}`, borderRadius: ".6rem", padding: primary ? ".75rem .8rem" : ".6rem .7rem", background: primary ? "linear-gradient(180deg,#f5fbff,#fff 65%)" : "#fff", width: "100%", ...(primary ? { boxShadow: "0 4px 16px rgba(2,132,199,.08)" } : { transitionDelay: `${0.26 + (i - 1) * 0.09}s` }) }}>
                      <div style={{ display: "flex", alignItems: "center", gap: ".45rem" }}>
                        <span style={{ fontSize: ".64rem", fontWeight: 800, color: primary ? "#0284c7" : "#94a3b8", width: "1ch" }}>{acc.rank}</span>
                        <span style={{ fontSize: primary ? ".9rem" : ".82rem", fontWeight: 800, color: "#0f172a", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{acc.name}</span>
                        {primary
                          ? <span className="ll-reveal ll-reveal-pop" style={{ display: "inline-flex", transitionDelay: ".5s" }}><DecisionPill state={acc.state} small /></span>
                          : <DecisionPill state={acc.state} small />}
                      </div>
                      <div style={{ fontSize: ".6rem", color: primary ? "#64748b" : "#94a3b8", fontWeight: 600, paddingLeft: "1.3rem", marginTop: ".15rem" }}>{acc.role} · {acc.oppType}</div>
                      <div className={primary ? "ll-reveal" : undefined} style={{ paddingLeft: "1.3rem", marginTop: ".4rem", ...(primary ? { transitionDelay: ".16s" } : {}) }}><FTE fit={acc.fit} timing={acc.timing} evidence={acc.evidence} /></div>
                      <div className={primary ? "ll-reveal ll-reveal-x" : undefined} style={{ display: "flex", alignItems: "center", gap: ".4rem", fontSize: primary ? ".72rem" : ".68rem", fontWeight: primary ? 600 : 400, color: primary ? "#0f172a" : "#475569", paddingLeft: "1.3rem", marginTop: ".4rem", ...(primary ? { transitionDelay: ".34s" } : {}) }}>
                        <span style={{ width: primary ? 6 : 5, height: primary ? 6 : 5, borderRadius: "50%", background: "#0ea5e9", flexShrink: 0 }} />{acc.changed}<span style={{ color: "#94a3b8", marginLeft: "auto", fontWeight: 400 }}>{acc.fresh}</span>
                      </div>
                    </button>); })}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: ".7rem" }}>
                <div className="ll-reveal" style={{ ...scard, transitionDelay: ".5s" }}><div style={zk}>What&apos;s changing</div><ul style={{ margin: 0, paddingLeft: ".9rem", fontSize: ".68rem", color: "#475569", lineHeight: 1.55 }}>{WS_CLIENT.patterns.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
                <div className="ll-reveal" style={{ ...scard, transitionDelay: ".58s" }}><div style={zk}>Evidence coverage</div><div style={{ display: "flex", gap: ".9rem", flexWrap: "wrap" as const }}>{WS_CLIENT.coverage.map(([n, l], i) => <div key={i}><div style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0e7490", lineHeight: 1 }}>{n}</div><div style={{ fontSize: ".54rem", textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#64748b", fontWeight: 700 }}>{l}</div></div>)}</div></div>
                <div className="ll-reveal" style={{ ...scard, background: "#fffbeb", borderColor: "#fde9c8", transitionDelay: ".66s" }}><div style={zk}>What to validate</div><ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: ".4rem" }}>{WS_ACCOUNTS.map((acc, i) => <li key={i}><span style={{ display: "block", fontSize: ".58rem", fontWeight: 800, color: "#b45309" }}>{acc.name}</span><span style={{ fontSize: ".66rem", color: "#0f172a", lineHeight: 1.35 }}>{acc.limiters[0].validate}</span></li>)}</ul></div>
              </div>
            </div>
          </div>
        )}

        {/* OPPORTUNITY CASES — full reasoning spine per account */}
        {tab === "cases" && (
          <div className="ll-cc-cases" style={{ display: "grid", gridTemplateColumns: "10rem 1fr", gap: ".9rem", alignItems: "start" }}>
            <div className="ll-cc-caselist" role="tablist" aria-label="Opportunities" style={{ display: "flex", flexDirection: "column", gap: ".3rem" }}>
              {WS_ACCOUNTS.map((acc, i) => { const st = DECISION_STATES[acc.state]; const on = i === sel; return (
                <button key={acc.name} role="tab" aria-selected={on} onClick={() => setSel(i)} style={{ appearance: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit", border: `1px solid ${on ? "#bae6fd" : "transparent"}`, borderRadius: ".5rem", padding: ".4rem .5rem", background: on ? "#f0f9ff" : "transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: ".35rem" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot, flexShrink: 0 }} /><span style={{ fontSize: ".72rem", fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{acc.name}</span></div>
                  <div style={{ fontSize: ".56rem", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" as const, paddingLeft: ".95rem" }}>{st.label} · {acc.fresh}</div>
                </button>); })}
            </div>
            <div style={{ minWidth: 0 }}><CaseSpine a={a} /></div>
          </div>
        )}

        {/* EVIDENCE — claim-first, traceable basis */}
        {tab === "evidence" && (
          <div>
            <div style={zk}>Evidence across the portfolio · claim → source → freshness</div>
            <div style={{ display: "flex", flexDirection: "column", gap: ".55rem" }}>
              {WS_ACCOUNTS.map((acc) => acc.sources.map((src, j) => (
                <div key={acc.name + j} style={{ ...scard }}>
                  <div style={{ fontSize: ".74rem", color: "#0f172a", fontWeight: 600, lineHeight: 1.4 }}>{acc.name}: {src.note}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" as const, marginTop: ".3rem", fontSize: ".62rem" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: ".25rem", fontWeight: 800, color: REL_COLOR[src.rel], textTransform: "uppercase" as const, letterSpacing: ".03em" }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: REL_COLOR[src.rel] }} />{src.rel}</span>
                    <span style={{ color: "#475569", fontWeight: 600 }}>{src.type}</span>
                    <span style={{ color: "#94a3b8" }}>· {src.age} ago</span>
                    <span style={{ color: "#94a3b8", marginLeft: "auto" }}>{j === 0 ? "Observed" : "Supporting"}</span>
                  </div>
                </div>
              )))}
            </div>
          </div>
        )}

        {/* COMPARE — why A before B, decision-first, no blended ranking number */}
        {tab === "compare" && (
          <div style={{ overflowX: "auto" }}>
            <div style={zk}>Why work one account before another</div>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "32rem" }}>
              <thead><tr><th style={{ background: "#fafbfc" }} />{WS_ACCOUNTS.map(acc => <th key={acc.name} style={{ textAlign: "left", padding: ".5rem .6rem", borderBottom: "2px solid #e6ebf1", fontSize: ".72rem", fontWeight: 800, color: "#0f172a" }}>{acc.name.split(" ")[0]}<div style={{ marginTop: ".2rem" }}><DecisionPill state={acc.state} small /></div></th>)}</tr></thead>
              <tbody>
                {([["Fit", (x: WsAccount) => x.fit], ["Timing", (x: WsAccount) => x.timing], ["Evidence", (x: WsAccount) => x.evidence], ["Freshness", (x: WsAccount) => x.fresh], ["What changed", (x: WsAccount) => x.changed], ["Key unknown", (x: WsAccount) => x.limiters[0].limit], ["Validate", (x: WsAccount) => x.limiters[0].validate]] as [string, (x: WsAccount) => string][]).map(([label, fn]) => (
                  <tr key={label}>
                    <td style={{ padding: ".45rem .6rem", borderBottom: "1px solid #f1f5f9", fontSize: ".56rem", fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#94a3b8", whiteSpace: "nowrap" as const, background: "#fafbfc" }}>{label}</td>
                    {WS_ACCOUNTS.map(acc => <td key={acc.name} style={{ padding: ".45rem .6rem", borderBottom: "1px solid #f1f5f9", fontSize: ".68rem", color: "#334155", verticalAlign: "top" }}>{["Fit", "Timing", "Evidence"].includes(label) ? <span style={{ fontWeight: STRENGTH[fn(acc)]?.weight ?? 600, color: STRENGTH[fn(acc)]?.color ?? "#334155" }}>{fn(acc)}</span> : fn(acc)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* STRATEGY — portfolio-level commercial interpretation */}
        {tab === "strategy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: ".8rem" }}>
            <div style={{ padding: ".1rem 0 .1rem .7rem", borderLeft: "3px solid #0284c7" }}>
              <div style={{ fontSize: ".55rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "#0284c7", marginBottom: ".25rem" }}>Portfolio read</div>
              <div style={{ fontSize: ".8rem", color: "#0f172a", lineHeight: 1.5 }}>{WS_CLIENT.read}</div>
            </div>
            <div><div style={zk}>Recommended sequence</div><ol style={{ margin: 0, paddingLeft: "1.1rem", display: "flex", flexDirection: "column", gap: ".4rem" }}>{WS_CLIENT.strategy.map((s, i) => <li key={i} style={{ fontSize: ".74rem", color: "#334155", lineHeight: 1.5 }}>{s}</li>)}</ol></div>
            <div style={scard}><div style={zk}>Market patterns</div><ul style={{ margin: 0, paddingLeft: ".9rem", fontSize: ".7rem", color: "#475569", lineHeight: 1.55 }}>{WS_CLIENT.patterns.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
          </div>
        )}
      </div>

      <div style={{ color: "#94a3b8", fontSize: ".58rem", padding: ".5rem 1.1rem .8rem", lineHeight: 1.4, borderTop: "1px solid #f1f5f9" }}>Illustrative sample — synthetic client, accounts, events and sources.</div>
    </div>
  );
}

// Compact, real Account Brief built from the SAME primitives as the hero canvas
// (CanvasStep spine + DecisionPill + FTE + relation tags) and the same synthetic
// account — so the Sample Output section SHOWS the deliverable instead of
// describing it, and reads as one product with the hero and /sample (§178–182,216).
function SampleBriefCard() {
  const a = WS_ACCOUNTS[0]; // Northstar — the lead account across hero + /sample
  const src = a.sources[0];
  const lim = a.limiters[0];
  const dstate = DECISION_STATES[a.state];
  return (
    <div style={{ background: "#fff", border: "1px solid #e6eef6", borderRadius: "1rem", boxShadow: "0 20px 48px rgba(15,23,42,.10), 0 3px 12px rgba(15,23,42,.05)", overflow: "hidden", textAlign: "left" as const }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem", padding: ".6rem .9rem", borderBottom: "1px solid #eef2f7", background: "linear-gradient(180deg,#f8fbff,#fff)" }}>
        <span style={{ fontSize: ".58rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#94a3b8" }}>Account Brief</span>
        <span style={{ color: "#0284c7", background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: ".55rem", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", padding: ".12rem .5rem", borderRadius: 999 }}>Sample</span>
      </div>
      <div style={{ padding: ".85rem .95rem" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: ".5rem" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: ".98rem", color: "#0f172a", letterSpacing: "-.02em", lineHeight: 1.15 }}>{a.name}</div>
            <div style={{ fontSize: ".66rem", color: "#64748b", marginTop: ".12rem" }}>{a.seg}</div>
          </div>
          <DecisionPill state={a.state} />
        </div>
        <div style={{ margin: ".55rem 0 .8rem" }}><FTE fit={a.fit} timing={a.timing} evidence={a.evidence} /></div>
        <CanvasStep dotColor="#0f172a" label="What changed" meta={a.changedAge}>
          <div style={{ fontSize: ".82rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>{a.changed}</div>
        </CanvasStep>
        <CanvasStep dotColor="#0284c7" label="Supported by">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".5rem" }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: ".72rem" }}>
              <span style={{ fontWeight: 600, color: "#0f172a" }}>{src.type}</span> <span style={{ color: "#64748b" }}>— {src.note}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: ".25rem", fontSize: ".6rem", fontWeight: 700, color: REL_COLOR[src.rel], flexShrink: 0 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: REL_COLOR[src.rel] }} />{src.rel}
            </span>
          </div>
        </CanvasStep>
        <CanvasStep dotColor="#64748b" label="Limited by">
          <div style={{ fontSize: ".74rem", color: "#334155", fontWeight: 600, lineHeight: 1.35 }}>{lim.limit}</div>
          <div style={{ display: "flex", gap: ".35rem", marginTop: ".15rem", fontSize: ".7rem", color: "#0369a1", lineHeight: 1.35 }}>
            <span style={{ fontWeight: 700, flexShrink: 0 }}>Validate →</span><span style={{ minWidth: 0 }}>{lim.validate}</span>
          </div>
        </CanvasStep>
        <CanvasStep dotColor={dstate.dot} last label="Decision">
          <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexWrap: "wrap" as const }}>
            <DecisionPill state={a.state} />
            <span style={{ fontSize: ".76rem", color: "#0f172a", fontWeight: 600, lineHeight: 1.35 }}>{a.next}</span>
          </div>
        </CanvasStep>
      </div>
    </div>
  );
}

// ─── How it works — mini product visuals (reuse the real intelligence grammar) ──
// Each step carries a small, product-derived visual so the section SHOWS the
// context → investigation → decision transformation, not three generic cards.
type HowCopy = typeof COPY["en"]["how"];

function HowStep1Viz({ how }: { how: HowCopy }) {
  const row = (t: string) => (
    <div key={t} style={{ fontSize: ".72rem", color: "#475569", background: "#fff", border: "1px solid #e8edf3", borderRadius: ".45rem", padding: ".3rem .6rem", fontWeight: 600 }}>{t}</div>
  );
  return (
    <div style={{ marginTop: "1.1rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: ".3rem" }}>
        {[how.vSell, how.vServe, how.vGrow].map(row)}
      </div>
      <div aria-hidden style={{ textAlign: "center", color: "#cbd5e1", fontSize: ".95rem", lineHeight: 1, margin: ".35rem 0" }}>↓</div>
      <div style={{ fontSize: ".76rem", fontWeight: 700, color: "#0369a1", background: "linear-gradient(180deg,#f0f9ff,#e0f2fe)", border: "1px solid #bae6fd", borderRadius: ".45rem", padding: ".45rem .6rem", textAlign: "center" }}>{how.vCriteria}</div>
    </div>
  );
}

function HowStep2Viz({ how }: { how: HowCopy }) {
  const field = (label: string, val: string, strong = false) => (
    <div key={label}>
      <div style={{ fontSize: ".56rem", fontWeight: 800, letterSpacing: ".07em", textTransform: "uppercase" as const, color: "#94a3b8" }}>{label}</div>
      <div style={{ fontSize: ".8rem", fontWeight: strong ? 700 : 600, color: strong ? "#0f172a" : "#334155", lineHeight: 1.3 }}>{val}</div>
    </div>
  );
  return (
    <div style={{ marginTop: "1.1rem", display: "flex", flexDirection: "column", gap: ".5rem" }}>
      {field(how.vChanged, how.vChangedVal, true)}
      {field(how.vSupported, how.vSupportedVal)}
      <div style={{ display: "flex", alignItems: "center", gap: ".28rem", flexWrap: "wrap" as const }}>
        {how.vLadder.flatMap((s, i) => [
          <span key={s} style={{ fontSize: ".6rem", fontWeight: i === how.vLadder.length - 1 ? 700 : 500, color: i === how.vLadder.length - 1 ? "#0369a1" : "#94a3b8" }}>{s}</span>,
          i < how.vLadder.length - 1 ? <span key={s + "-a"} aria-hidden style={{ color: "#cbd5e1", fontSize: ".6rem" }}>→</span> : null,
        ])}
      </div>
    </div>
  );
}

function HowStep3Viz({ how }: { how: HowCopy }) {
  return (
    <div style={{ marginTop: "1.1rem", display: "flex", flexDirection: "column", gap: ".4rem", alignItems: "flex-start" }}>
      <DecisionPill state="prioritize" />
      <div style={{ fontSize: ".72rem", color: "#475569", lineHeight: 1.35 }}>{how.vDecideReason}</div>
      <div style={{ fontSize: ".72rem", color: "#0369a1", fontWeight: 600, lineHeight: 1.35 }}>{how.vValidate} → {how.vValidateVal}</div>
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
      className="ll-price-card"
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

      {/* Plan name + price */}
      <div className="ll-price-head" style={{ marginBottom: ".85rem" }}>
        <div style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".08em", color: featured ? "#0284c7" : "#94a3b8", marginBottom: ".5rem" }}>
          {copy.planNames[plan]}
        </div>
        <div className="ll-price-amount" style={{ display: "flex", alignItems: "baseline", gap: ".4rem", marginBottom: ".55rem" }}>
          <span className="ll-price-value" style={{ fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1, color: "#0f172a" }}>{p.price}</span>
          <span className="ll-price-onetime" style={{ fontSize: ".72rem", color: "#94a3b8" }}>{copy.oneBatch}</span>
        </div>
        <div style={{ fontSize: ".9rem", color: "#334155", lineHeight: 1.45, marginBottom: ".4rem" }}>{copy.planDescs[plan]}</div>
        <div style={{ fontSize: ".8rem", color: featured ? "#0369a1" : "#64748b", fontWeight: 600, lineHeight: 1.45 }}>{copy.planDiff[plan]}</div>
      </div>

      {/* CTA — visible without scrolling features */}
      <button
        onClick={() => onSelect(plan)}
        className="ll-price-cta"
        style={{
          width: "100%", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: ".75rem",
          padding: ".8rem", fontWeight: 700, fontSize: ".9rem", cursor: "pointer",
          transition: "background .15s, transform .15s",
          boxShadow: featured ? "0 4px 14px rgba(14,165,233,.35)" : "none",
        }}
        onMouseOver={e => { e.currentTarget.style.background = "#0284c7"; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseOut={e => { e.currentTarget.style.background = "#0ea5e9"; e.currentTarget.style.transform = ""; }}
      >
        {copy.planCTAs[plan]}
      </button>

      {/* Features — collapsed by default (progressive disclosure) */}
      <details className="ll-price-details" style={{ marginTop: ".9rem" }}>
        <summary style={{ cursor: "pointer", listStyle: "none", fontSize: ".78rem", fontWeight: 600, color: "#0284c7", padding: ".2rem 0", userSelect: "none" as const }}>
          {copy.planDetails} ↓
        </summary>
        <div style={{ marginTop: ".5rem", borderTop: `1px solid ${featured ? "#bae6fd" : "#f1f5f9"}`, paddingTop: ".6rem" }}>
          {copy.planFeatures[plan].map(f => (
            <div key={f} style={{ fontSize: ".82rem", color: "#64748b", padding: ".28rem 0", display: "flex", gap: ".55rem", alignItems: "flex-start", lineHeight: 1.45 }}>
              <span style={{ color: "#0ea5e9", fontWeight: 700, flexShrink: 0, marginTop: ".1rem" }}>✓</span>{f}
            </div>
          ))}
        </div>
      </details>
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

function BtnOutline({ children, onClick, lg, className }: { children: React.ReactNode; onClick?: () => void; lg?: boolean; className?: string }) {
  return (
    <button onClick={onClick} className={className}
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
