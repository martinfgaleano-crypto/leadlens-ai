"use client";

import { useState, useRef } from "react";
import type { LeadLensReport, ProcessedLead, PlanType, QCStatus, OutputLanguage, MarketRegion } from "@/types";

// ─── Localization dictionary ──────────────────────────────────────────────────

const COPY = {
  en: {
    announcement: "Beta access open — request your first lead batch.",
    announcementCTA: "Request your batch →",
    navPricing: "Pricing",
    navCTA: "Get started — $29",
    heroBadge: "Beta open — limited spots",
    heroH1pre: "Tell us your ideal customer.",
    heroH1hi: "We find the leads",
    heroH1post: " and write the outreach.",
    heroSub: "LeadLens researches qualified B2B leads that match your offer and writes personalized emails, DMs, and follow-ups for each one. You review and send.",
    heroCTA: "Start with one batch — $29 →",
    heroSeeAll: "See all plans",
    heroNote: "10 qualified leads + full outreach sequences. No long-term contracts.",
    proofLabels: [["48h","delivery"],["1","batch to start"],["7","AI agents"],["100%","human-reviewed"]] as [string,string][],
    howTag: "How it works",
    howTitle: "Four steps. No integrations. No installs.",
    steps: [
      ["1","Describe your offer","Tell us who you sell to and what you offer. Takes 5 minutes."],
      ["2","We find the leads","Our system identifies qualified B2B leads that match your ICP — no list needed."],
      ["3","AI writes outreach","7 specialized agents research, qualify, and write personalized sequences per lead."],
      ["4","You get the report","CSV + Markdown with everything ready. You decide who to contact and when."],
    ] as [string,string,string][],
    pricingTag: "Beta Batch Pricing",
    pricingTitle: "Start with one batch. Upgrade to monthly when ready.",
    pricingSub: "No long-term contracts. Use LeadLens once, or run monthly lead batches when your team needs ongoing pipeline.",
    oneBatch: "One-time beta batch",
    monthlyTitle: "Need leads every month?",
    monthlySub: "Monthly plans are coming for agencies, SaaS teams, and consultants that need recurring lead batches, multi-market campaigns, and priority review.",
    monthlyTag: "Monthly plans coming soon",
    planNames: { starter: "Beta Starter", standard: "Beta Standard", pro: "Beta Pro" },
    planDescs: { starter: "Try the service risk-free.", standard: "Run a small campaign.", pro: "Full campaign + 2 angles." },
    planFeatures: {
      starter:  ["HOT / WARM / COLD qualification","Fit reason per lead","Personalization trigger","Email + LinkedIn DM","2 follow-ups per lead","CSV + Markdown export","Delivery in 24–48h"],
      standard: ["Everything in Starter","Higher volume for campaigns","A/B testing messages","Executive summary + patterns","CSV + Markdown export","Delivery in 24–48h"],
      pro:      ["Everything in Standard","2 campaign angles","Priority manual review","CSV + Markdown export","Delivery in 24–48h"],
    },
    leadsFoundBy: (n: number) => `${n} leads found by LeadLens`,
    getStarted: "Start beta batch",
    mostPopular: "Most popular",
    formTag: "Start your campaign",
    formTitle: "Tell LeadLens about your business",
    formSub: "The more context you give, the better the leads and outreach.",
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
    submitBtn: (n: number) => `Generate ${n} leads →`,
    backBtn: "← Back",
    processingTitle: "Generating your lead report…",
    processingNote: "Production: 15–45 min. Preview: ~5 seconds.",
    processingStatus: "LeadLens is researching and scoring your leads.",
    agents: [
      "ICP Analysis — mapping your ideal customer profile",
      "Lead Discovery — sourcing qualified prospects",
      "Research — investigating each company",
      "Qualification — scoring ICP fit (0–10)",
      "Personalization — writing unique triggers",
      "Outreach — drafting emails & DMs",
      "Quality Check + Report — final review & export",
    ],
    reportReady: "Report ready",
    reportTitle: "Your report is ready",
    dlCSV: (n: number) => `⬇ Download CSV (${n} leads)`,
    dlMD: "⬇ Download Markdown",
    newRun: "← New run",
    statTotal: "Total",
    statAvg: "Avg score",
    execSummary: "Executive Summary",
    patternsObserved: "Patterns Observed",
    recommendations: "Recommendations",
    leadBreakdown: "Lead-by-lead breakdown",
    showingOf: (shown: number, total: number) => `Showing first ${shown} of ${total} generated leads. Export includes all ${total} leads.`,
    moreInExport: (n: number) => `+ ${n} more leads in your export`,
    dlAll: (n: number) => `⬇ Download all ${n} leads as CSV`,
    mCompanySize: "Company size",
    mEmailStatus: "Email status",
    mConfidence: "Confidence",
    mSource: "Source",
    mLocation: "Location",
    mSourceUrl: "Source URL",
    mLinkedin: "LinkedIn",
    sCompanyContext: "Company context",
    sTimingSignals: "Timing signals",
    sWhyFit: "Why good fit",
    sFlags: "Flags",
    sDataGaps: "Data gaps",
    sPersonalization: "Personalization trigger",
    sInitialEmail: "Initial email",
    sSubject: "Subject",
    sBody: "Body",
    sFullSequence: "Full outreach sequence",
    sLinkedinDM: "LinkedIn DM",
    sFollowup1: "Follow-up 1 (day 3–4)",
    sFollowup2: "Follow-up 2 (day 7–8)",
    sQcNotes: "QC notes",
    footerCopy: "© 2026 LeadLens AI. Human-reviewed. No automatic sending. You review and approve every message.",
    footerLinks: ["Privacy", "Terms", "Refund Policy", "Contact"],
    footerContact: "Questions? Email us: martinfgaleano@gmail.com",
    expectationsTag: "Beta delivery",
    expectationsTitle: "What to expect from your batch",
    expectationsItems: [
      "We process your form and build your ICP profile.",
      "Our AI agents research and qualify leads that match your offer.",
      "Each lead gets a personalized email, LinkedIn DM, and 2 follow-ups.",
      "You receive a CSV + Markdown report ready to review and use.",
      "Typical delivery: 24–48 hours after submission.",
      "You review every message before sending — nothing goes out automatically.",
    ],
    tryDemoCTA: "Try sample demo",
    checkoutPendingTitle: "Online checkout is almost ready.",
    checkoutPendingBody: "Lemon Squeezy is currently reviewing our store. This beta batch cannot be purchased yet.",
    checkoutPendingDemoHint: "You can still try a sample demo report below.",
    switchToDemo: "Try sample demo instead →",
    sampleBadge: "Sample demo report",
    sampleNote: "This is a sample output. Paid beta batches are delivered after checkout and manual review.",
    problemTag: "The problem",
    problemTitle: "Most B2B teams waste time on outreach that doesn't work",
    problemItems: [
      "Hours lost researching prospects that turn out to be a poor fit for your offer.",
      "Generic cold emails get ignored or flagged as spam — hurting your sender reputation.",
      "No time to personalize at scale without a dedicated SDR.",
      "Expensive lead lists that are stale before you even open them.",
      "No clear signal on which prospects are actually worth pursuing right now.",
    ],
    receiveTag: "What you receive",
    receiveTitle: "Everything you need to start outreach — in one report",
    receiveItems: [
      ["HOT / WARM / COLD score", "0–10 ICP fit score + tier label so you know where to focus first."],
      ["Fit reason", "A clear explanation of why this specific lead matches your offer."],
      ["Personalization trigger", "A unique hook based on real context: news, growth signals, tech stack."],
      ["Initial cold email", "Subject line + full body, written in your tone and ready to send."],
      ["LinkedIn DM", "A concise message built for direct connection requests."],
      ["Follow-up 1 (day 3–4)", "A value-add nudge — not just 'just checking in'."],
      ["Follow-up 2 (day 7–8)", "A well-timed final touch before you move on."],
      ["Executive summary", "Overview of batch quality, best segments, and next steps."],
      ["Patterns observed", "What LeadLens noticed across the batch — helps refine your ICP."],
      ["CSV + Markdown export", "Full report in two formats, ready to use in any tool immediately."],
    ] as [string, string][],
    samplePreviewTag: "Sample output",
    samplePreviewTitle: "This is what your report looks like",
    samplePreviewSub: "Every lead in your batch includes full qualification, personalized outreach, and a complete sequence — ready to review before you send anything.",
    faqTag: "FAQ",
    faqTitle: "Common questions",
    faqs: [
      ["What exactly do I get?", "A CSV + Markdown report with 10–100 leads (by plan). Each lead includes a fit score, fit reason, personalization trigger, cold email (subject + body), LinkedIn DM, and 2 follow-ups. Plus an executive summary and batch-level patterns."],
      ["How long does delivery take?", "Typically 24–48 hours after you submit your onboarding form. Every batch is reviewed manually before delivery."],
      ["Do you send the emails for me?", "No. You receive draft messages you review and send yourself. Nothing goes out automatically. You stay in full control."],
      ["How are leads sourced?", "Our agents identify prospects matching your ICP using publicly available business data. No personal data is used beyond what's publicly accessible."],
      ["What if the leads don't match my ICP?", "If leads consistently miss your ICP and we can't resolve it, you're eligible for a refund within 7 days. See our refund policy."],
      ["Is there a subscription or contract?", "No. Beta batches are one-time purchases. No recurring charges, no commitments, no hidden fees."],
      ["What happens after I purchase?", "We collect your onboarding details (if not already submitted), process your batch, and deliver via email within 24–48 hours."],
      ["Can I target a specific industry or region?", "Yes. The onboarding form lets you specify your ICP, target market region, tone, and any specific constraints — and we optimize the batch accordingly."],
    ] as [string, string][],
    ctaTag: "Get started",
    ctaTitle: "Ready to fill your pipeline?",
    ctaSub: "One batch. 24–48h delivery. You review every message before sending.",
    ctaCTA: "Start your first batch — $29 →",
    sampleTabs: ["Email", "LinkedIn DM", "Follow-up 1", "Follow-up 2"],
    pricePerLead: { starter: "$2.90 / lead", standard: "$1.94 / lead", pro: "$1.64 / lead" },
  },
  es: {
    announcement: "Acceso beta abierto — solicita tu primer lote de leads.",
    announcementCTA: "Solicitar mi lote →",
    navPricing: "Precios",
    navCTA: "Comenzar — $29",
    heroBadge: "Beta abierta — cupos limitados",
    heroH1pre: "Cuéntanos cuál es tu cliente ideal.",
    heroH1hi: "Encontramos los leads",
    heroH1post: " y redactamos el outreach.",
    heroSub: "LeadLens investiga leads B2B calificados que coinciden con tu oferta y redacta correos, DMs y seguimientos personalizados para cada uno. Tú revisas y decides cuándo enviar.",
    heroCTA: "Empezar con un lote — $29 →",
    heroSeeAll: "Ver todos los planes",
    heroNote: "10 leads calificados + secuencias de outreach completas. Sin contratos largos.",
    proofLabels: [["48h","entrega"],["1","lote para empezar"],["7","agentes IA"],["100%","revisión humana"]] as [string,string][],
    howTag: "Cómo funciona",
    howTitle: "Cuatro pasos. Sin integraciones. Sin instalaciones.",
    steps: [
      ["1","Describe tu oferta","Cuéntanos a quién le vendes y qué ofreces. Toma 5 minutos."],
      ["2","Encontramos los leads","Nuestro sistema identifica leads B2B calificados que coinciden con tu ICP. Sin listas."],
      ["3","La IA redacta el outreach","7 agentes especializados investigan, califican y crean secuencias personalizadas por lead."],
      ["4","Recibes el reporte","CSV + Markdown listo para usar. Tú decides a quién contactar y cuándo."],
    ] as [string,string,string][],
    pricingTag: "Precios Beta por Lote",
    pricingTitle: "Empieza con un lote. Pasa a un plan mensual cuando estés listo.",
    pricingSub: "Sin contratos largos. Usa LeadLens una vez o genera lotes mensuales cuando tu equipo necesite pipeline recurrente.",
    oneBatch: "Lote beta de pago único",
    monthlyTitle: "¿Necesitas leads todos los meses?",
    monthlySub: "Pronto habrá planes mensuales para agencias, equipos SaaS y consultores que necesitan lotes recurrentes de leads, campañas en varios mercados y revisión prioritaria.",
    monthlyTag: "Planes mensuales próximamente",
    planNames: { starter: "Beta Inicial", standard: "Beta Estándar", pro: "Beta Pro" },
    planDescs: { starter: "Prueba el servicio sin riesgo.", standard: "Ejecuta una campaña pequeña.", pro: "Campaña completa + 2 ángulos." },
    planFeatures: {
      starter:  ["Calificación HOT / WARM / COLD","Motivo de fit por lead","Trigger de personalización","Correo + LinkedIn DM","2 seguimientos por lead","Exportación CSV + Markdown","Entrega en 24–48h"],
      standard: ["Todo lo de Beta Inicial","Mayor volumen para campañas","Test A/B de mensajes","Resumen ejecutivo + patrones","Exportación CSV + Markdown","Entrega en 24–48h"],
      pro:      ["Todo lo de Beta Estándar","2 ángulos de campaña","Revisión manual prioritaria","Exportación CSV + Markdown","Entrega en 24–48h"],
    },
    leadsFoundBy: (n: number) => `${n} leads encontrados por LeadLens`,
    getStarted: "Iniciar lote beta",
    mostPopular: "Más popular",
    formTag: "Inicia tu campaña",
    formTitle: "Cuéntale a LeadLens sobre tu negocio",
    formSub: "Cuanto más contexto des, mejores serán los leads y el outreach.",
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
    submitBtn: (n: number) => `Generar ${n} leads →`,
    backBtn: "← Volver",
    processingTitle: "Generando tu reporte de leads…",
    processingNote: "Producción: 15–45 min. Vista previa: ~5 segundos.",
    processingStatus: "LeadLens está investigando y calificando tus leads.",
    agents: [
      "Análisis de cliente ideal — definiendo tu perfil",
      "Búsqueda de leads — identificando prospectos calificados",
      "Investigación — analizando cada empresa",
      "Calificación — puntuando el fit ICP (0–10)",
      "Personalización — creando triggers únicos",
      "Outreach — redactando emails y DMs",
      "Revisión de calidad + Reporte — revisión final y exportación",
    ],
    reportReady: "Reporte listo",
    reportTitle: "Tu reporte está listo",
    dlCSV: (n: number) => `⬇ Descargar CSV (${n} leads)`,
    dlMD: "⬇ Descargar Markdown",
    newRun: "← Nueva búsqueda",
    statTotal: "Total",
    statAvg: "Puntaje prom.",
    execSummary: "Resumen ejecutivo",
    patternsObserved: "Patrones observados",
    recommendations: "Recomendaciones",
    leadBreakdown: "Desglose por lead",
    showingOf: (shown: number, total: number) => `Mostrando ${shown} de ${total} leads generados. La exportación incluye los ${total} leads.`,
    moreInExport: (n: number) => `+ ${n} leads más en tu exportación`,
    dlAll: (n: number) => `⬇ Descargar los ${n} leads como CSV`,
    mCompanySize: "Tamaño de empresa",
    mEmailStatus: "Estado del email",
    mConfidence: "Confianza",
    mSource: "Fuente",
    mLocation: "Ubicación",
    mSourceUrl: "URL de fuente",
    mLinkedin: "LinkedIn",
    sCompanyContext: "Contexto de la empresa",
    sTimingSignals: "Señales de timing",
    sWhyFit: "Por qué es un buen fit",
    sFlags: "Alertas",
    sDataGaps: "Datos faltantes",
    sPersonalization: "Trigger de personalización",
    sInitialEmail: "Email inicial",
    sSubject: "Asunto",
    sBody: "Cuerpo",
    sFullSequence: "Secuencia de outreach completa",
    sLinkedinDM: "LinkedIn DM",
    sFollowup1: "Seguimiento 1 (día 3–4)",
    sFollowup2: "Seguimiento 2 (día 7–8)",
    sQcNotes: "Notas de QC",
    footerCopy: "© 2026 LeadLens AI. Revisión humana. Sin envíos automáticos. Tú revisas y apruebas cada mensaje.",
    footerLinks: ["Privacidad", "Términos", "Política de devolución", "Contacto"],
    footerContact: "¿Preguntas? Escríbenos: martinfgaleano@gmail.com",
    expectationsTag: "Entrega beta",
    expectationsTitle: "Qué esperar de tu lote",
    expectationsItems: [
      "Procesamos tu formulario y construimos tu perfil de cliente ideal.",
      "Nuestros agentes de IA investigan y califican leads que coincidan con tu oferta.",
      "Cada lead recibe un correo personalizado, LinkedIn DM y 2 seguimientos.",
      "Recibes un reporte en CSV + Markdown listo para revisar y usar.",
      "Entrega típica: 24–48 horas después del envío.",
      "Tú revisas cada mensaje antes de enviarlo — nada se envía automáticamente.",
    ],
    tryDemoCTA: "Probar demo de muestra",
    checkoutPendingTitle: "El checkout online está casi listo.",
    checkoutPendingBody: "Lemon Squeezy está revisando nuestra tienda. Este lote beta todavía no se puede comprar.",
    checkoutPendingDemoHint: "Mientras tanto, puedes probar un reporte demo de muestra abajo.",
    switchToDemo: "Probar demo de muestra →",
    sampleBadge: "Reporte demo de muestra",
    sampleNote: "Este es un resultado de muestra. Los lotes beta pagos se entregan después del checkout y revisión.",
    problemTag: "El problema",
    problemTitle: "La mayoría de los equipos B2B pierden tiempo en outreach que no funciona",
    problemItems: [
      "Horas perdidas investigando prospectos que no encajan con tu oferta.",
      "Correos genéricos ignorados o marcados como spam — dañando tu reputación de envío.",
      "Sin tiempo para personalizar a escala sin un SDR dedicado.",
      "Listas de leads costosas que ya están desactualizadas cuando las abres.",
      "Sin señales claras de qué prospectos vale la pena perseguir ahora mismo.",
    ],
    receiveTag: "Qué recibes",
    receiveTitle: "Todo lo que necesitas para empezar outreach — en un solo reporte",
    receiveItems: [
      ["Calificación HOT / WARM / COLD", "Puntaje de fit ICP de 0–10 + etiqueta de categoría para saber dónde enfocarte primero."],
      ["Motivo de fit", "Explicación clara de por qué este lead específico encaja con tu oferta."],
      ["Trigger de personalización", "Un gancho único basado en contexto real: noticias, señales de crecimiento, stack tecnológico."],
      ["Correo frío inicial", "Asunto + cuerpo completo, escrito en tu tono y listo para enviar."],
      ["LinkedIn DM", "Mensaje conciso diseñado para solicitudes de conexión directa."],
      ["Seguimiento 1 (día 3–4)", "Un recordatorio que aporta valor — no solo 'te escribo para saber si lo viste'."],
      ["Seguimiento 2 (día 7–8)", "Un último contacto bien cronometrado antes de pasar al siguiente prospecto."],
      ["Resumen ejecutivo", "Visión general de la calidad del lote, mejores segmentos y próximos pasos."],
      ["Patrones observados", "Lo que LeadLens detectó en el lote — útil para refinar tu ICP."],
      ["Exportación CSV + Markdown", "Reporte completo en dos formatos, listo para usar en cualquier herramienta."],
    ] as [string, string][],
    samplePreviewTag: "Ejemplo de salida",
    samplePreviewTitle: "Así se ve tu reporte",
    samplePreviewSub: "Cada lead en tu lote incluye calificación completa, outreach personalizado y una secuencia completa — para revisar antes de enviar cualquier cosa.",
    faqTag: "Preguntas frecuentes",
    faqTitle: "Preguntas comunes",
    faqs: [
      ["¿Qué recibo exactamente?", "Un reporte en CSV + Markdown con 10–100 leads (según el plan). Cada lead incluye puntaje de fit, motivo de fit, trigger de personalización, correo frío (asunto + cuerpo), LinkedIn DM y 2 seguimientos. Más un resumen ejecutivo y patrones del lote."],
      ["¿Cuánto tarda la entrega?", "Típicamente 24–48 horas después de enviar tu formulario de onboarding. Cada lote es revisado manualmente antes de la entrega."],
      ["¿Envían los correos por mí?", "No. Recibes borradores que revisas y envías tú mismo. Nada se envía automáticamente. Tú tienes el control total."],
      ["¿Cómo se obtienen los leads?", "Nuestros agentes identifican prospectos que coinciden con tu ICP usando datos empresariales públicos. No se usan datos personales más allá de lo que es públicamente accesible."],
      ["¿Qué pasa si los leads no encajan con mi ICP?", "Si los leads no coinciden con tu ICP de forma consistente y no podemos resolverlo, tienes derecho a un reembolso dentro de 7 días. Ver política de devoluciones."],
      ["¿Hay suscripción o contrato?", "No. Los lotes beta son compras de pago único. Sin cargos recurrentes, sin compromisos, sin tarifas ocultas."],
      ["¿Qué pasa después de comprar?", "Recopilamos los detalles de tu onboarding (si no los enviaste), procesamos tu lote y entregamos por correo en 24–48 horas."],
      ["¿Puedo apuntar a una industria o región específica?", "Sí. El formulario de onboarding te permite especificar tu ICP, región objetivo, tono y cualquier criterio adicional — y optimizamos el lote con esos parámetros."],
    ] as [string, string][],
    ctaTag: "Comenzar",
    ctaTitle: "¿Listo para llenar tu pipeline?",
    ctaSub: "Un lote. Entrega en 24–48h. Tú revisas cada mensaje antes de enviarlo.",
    ctaCTA: "Inicia tu primer lote — $29 →",
    sampleTabs: ["Email", "LinkedIn DM", "Seguimiento 1", "Seguimiento 2"],
    pricePerLead: { starter: "$2.90 / lead", standard: "$1.94 / lead", pro: "$1.64 / lead" },
  },
  pt: {
    announcement: "Acesso beta aberto — solicite seu primeiro lote de leads.",
    announcementCTA: "Solicitar meu lote →",
    navPricing: "Preços",
    navCTA: "Começar — $29",
    heroBadge: "Beta aberta — vagas limitadas",
    heroH1pre: "Diga quem é seu cliente ideal.",
    heroH1hi: "Encontramos os leads",
    heroH1post: " e escrevemos as mensagens.",
    heroSub: "LeadLens pesquisa leads B2B qualificados que combinam com sua oferta e escreve e-mails, DMs e follow-ups personalizados para cada um. Você revisa e decide quando enviar.",
    heroCTA: "Começar com um lote — $29 →",
    heroSeeAll: "Ver todos os planos",
    heroNote: "10 leads qualificados + sequências de outreach completas. Sem contratos longos.",
    proofLabels: [["48h","entrega"],["1","lote para começar"],["7","agentes de IA"],["100%","revisão humana"]] as [string,string][],
    howTag: "Como funciona",
    howTitle: "Quatro passos. Sem integrações. Sem instalações.",
    steps: [
      ["1","Descreva sua oferta","Nos diga para quem você vende e o que oferece. Leva 5 minutos."],
      ["2","Encontramos os leads","Nosso sistema identifica leads B2B qualificados que combinam com seu ICP. Sem listas."],
      ["3","A IA escreve o outreach","7 agentes especializados pesquisam, qualificam e criam sequências personalizadas por lead."],
      ["4","Você recebe o relatório","CSV + Markdown pronto para usar. Você decide com quem falar e quando."],
    ] as [string,string,string][],
    pricingTag: "Preços Beta por Lote",
    pricingTitle: "Comece com um lote. Migre para um plano mensal quando estiver pronto.",
    pricingSub: "Sem contratos longos. Use a LeadLens uma vez ou gere lotes mensais quando sua equipe precisar de pipeline recorrente.",
    oneBatch: "Lote beta de pagamento único",
    monthlyTitle: "Precisa de leads todos os meses?",
    monthlySub: "Em breve teremos planos mensais para agências, equipes SaaS e consultores que precisam de lotes recorrentes de leads, campanhas em vários mercados e revisão prioritária.",
    monthlyTag: "Planos mensais em breve",
    planNames: { starter: "Beta Inicial", standard: "Beta Padrão", pro: "Beta Pro" },
    planDescs: { starter: "Experimente o serviço sem risco.", standard: "Execute uma campanha pequena.", pro: "Campanha completa + 2 ângulos." },
    planFeatures: {
      starter:  ["Qualificação HOT / WARM / COLD","Motivo de fit por lead","Trigger de personalização","Email + LinkedIn DM","2 follow-ups por lead","Exportação CSV + Markdown","Entrega em 24–48h"],
      standard: ["Tudo do Beta Inicial","Maior volume para campanhas","Teste A/B de mensagens","Resumo executivo + padrões","Exportação CSV + Markdown","Entrega em 24–48h"],
      pro:      ["Tudo do Beta Padrão","2 ângulos de campanha","Revisão manual prioritária","Exportação CSV + Markdown","Entrega em 24–48h"],
    },
    leadsFoundBy: (n: number) => `${n} leads encontrados pela LeadLens`,
    getStarted: "Iniciar lote beta",
    mostPopular: "Mais popular",
    formTag: "Inicie sua campanha",
    formTitle: "Conte à LeadLens sobre seu negócio",
    formSub: "Quanto mais contexto você der, melhores serão os leads e o outreach.",
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
    submitBtn: (n: number) => `Gerar ${n} leads →`,
    backBtn: "← Voltar",
    processingTitle: "Gerando seu relatório de leads…",
    processingNote: "Produção: 15–45 min. Prévia: ~5 segundos.",
    processingStatus: "A LeadLens está pesquisando e qualificando seus leads.",
    agents: [
      "Análise do cliente ideal — mapeando seu perfil",
      "Busca de leads — identificando prospects qualificados",
      "Pesquisa — investigando cada empresa",
      "Qualificação — pontuando o fit ICP (0–10)",
      "Personalização — criando triggers únicos",
      "Outreach — redigindo emails e DMs",
      "Revisão de qualidade + Relatório — revisão final e exportação",
    ],
    reportReady: "Relatório pronto",
    reportTitle: "Seu relatório está pronto",
    dlCSV: (n: number) => `⬇ Baixar CSV (${n} leads)`,
    dlMD: "⬇ Baixar Markdown",
    newRun: "← Nova busca",
    statTotal: "Total",
    statAvg: "Pontuação méd.",
    execSummary: "Resumo executivo",
    patternsObserved: "Padrões observados",
    recommendations: "Recomendações",
    leadBreakdown: "Detalhamento por lead",
    showingOf: (shown: number, total: number) => `Mostrando ${shown} de ${total} leads gerados. A exportação inclui todos os ${total} leads.`,
    moreInExport: (n: number) => `+ ${n} leads a mais na sua exportação`,
    dlAll: (n: number) => `⬇ Baixar todos os ${n} leads como CSV`,
    mCompanySize: "Tamanho da empresa",
    mEmailStatus: "Status do email",
    mConfidence: "Confiança",
    mSource: "Fonte",
    mLocation: "Localização",
    mSourceUrl: "URL da fonte",
    mLinkedin: "LinkedIn",
    sCompanyContext: "Contexto da empresa",
    sTimingSignals: "Sinais de timing",
    sWhyFit: "Por que é um bom fit",
    sFlags: "Alertas",
    sDataGaps: "Lacunas de dados",
    sPersonalization: "Trigger de personalização",
    sInitialEmail: "Email inicial",
    sSubject: "Assunto",
    sBody: "Corpo",
    sFullSequence: "Sequência de outreach completa",
    sLinkedinDM: "LinkedIn DM",
    sFollowup1: "Follow-up 1 (dia 3–4)",
    sFollowup2: "Follow-up 2 (dia 7–8)",
    sQcNotes: "Notas de QC",
    footerCopy: "© 2026 LeadLens AI. Revisão humana. Sem envio automático. Você revisa e aprova cada mensagem.",
    footerLinks: ["Privacidade", "Termos", "Política de Reembolso", "Contato"],
    footerContact: "Dúvidas? Fale conosco: martinfgaleano@gmail.com",
    expectationsTag: "Entrega beta",
    expectationsTitle: "O que esperar do seu lote",
    expectationsItems: [
      "Processamos seu formulário e construímos seu perfil de cliente ideal.",
      "Nossos agentes de IA pesquisam e qualificam leads que combinam com sua oferta.",
      "Cada lead recebe um e-mail personalizado, LinkedIn DM e 2 follow-ups.",
      "Você recebe um relatório em CSV + Markdown pronto para revisar e usar.",
      "Entrega típica: 24–48 horas após o envio.",
      "Você revisa cada mensagem antes de enviar — nada é enviado automaticamente.",
    ],
    tryDemoCTA: "Testar demo de exemplo",
    checkoutPendingTitle: "O checkout online está quase pronto.",
    checkoutPendingBody: "A Lemon Squeezy está revisando nossa loja. Este lote beta ainda não pode ser comprado.",
    checkoutPendingDemoHint: "Você ainda pode testar um relatório demo de exemplo abaixo.",
    switchToDemo: "Testar demo de exemplo →",
    sampleBadge: "Relatório demo de exemplo",
    sampleNote: "Este é um resultado de exemplo. Lotes beta pagos são entregues após o checkout e revisão.",
    problemTag: "O problema",
    problemTitle: "A maioria das equipes B2B perde tempo com outreach que não funciona",
    problemItems: [
      "Horas perdidas pesquisando prospects que não se encaixam na sua oferta.",
      "E-mails genéricos ignorados ou marcados como spam — prejudicando sua reputação de envio.",
      "Sem tempo para personalizar em escala sem um SDR dedicado.",
      "Listas de leads caras que já estão desatualizadas quando você as abre.",
      "Sem sinais claros de quais prospects valem a pena agora.",
    ],
    receiveTag: "O que você recebe",
    receiveTitle: "Tudo que você precisa para começar o outreach — em um único relatório",
    receiveItems: [
      ["Pontuação HOT / WARM / COLD", "Score de fit ICP de 0–10 + rótulo de categoria para saber onde focar primeiro."],
      ["Motivo do fit", "Explicação clara de por que este lead específico se encaixa na sua oferta."],
      ["Trigger de personalização", "Um gancho único baseado em contexto real: notícias, sinais de crescimento, stack tecnológico."],
      ["E-mail frio inicial", "Assunto + corpo completo, escrito no seu tom e pronto para enviar."],
      ["LinkedIn DM", "Mensagem concisa projetada para pedidos de conexão direta."],
      ["Follow-up 1 (dia 3–4)", "Um lembrete que agrega valor — não apenas 'só passando para checar'."],
      ["Follow-up 2 (dia 7–8)", "Um toque final bem cronometrado antes de avançar para o próximo prospect."],
      ["Resumo executivo", "Visão geral da qualidade do lote, melhores segmentos e próximos passos."],
      ["Padrões observados", "O que a LeadLens detectou no lote — útil para refinar seu ICP."],
      ["Exportação CSV + Markdown", "Relatório completo em dois formatos, pronto para usar em qualquer ferramenta."],
    ] as [string, string][],
    samplePreviewTag: "Exemplo de saída",
    samplePreviewTitle: "É assim que seu relatório parece",
    samplePreviewSub: "Cada lead no seu lote inclui qualificação completa, outreach personalizado e uma sequência completa — para revisar antes de enviar qualquer coisa.",
    faqTag: "Perguntas frequentes",
    faqTitle: "Dúvidas comuns",
    faqs: [
      ["O que exatamente eu recebo?", "Um relatório em CSV + Markdown com 10–100 leads (por plano). Cada lead inclui score de fit, motivo de fit, trigger de personalização, e-mail frio (assunto + corpo), LinkedIn DM e 2 follow-ups. Mais um resumo executivo e padrões do lote."],
      ["Quanto tempo demora a entrega?", "Tipicamente 24–48 horas após enviar seu formulário de onboarding. Cada lote é revisado manualmente antes da entrega."],
      ["Vocês enviam os e-mails por mim?", "Não. Você recebe rascunhos que revisa e envia você mesmo. Nada é enviado automaticamente. Você mantém controle total."],
      ["Como os leads são obtidos?", "Nossos agentes identificam prospects que combinam com seu ICP usando dados empresariais públicos. Nenhum dado pessoal é usado além do que é publicamente acessível."],
      ["E se os leads não combinarem com meu ICP?", "Se os leads consistentemente não combinarem com seu ICP e não conseguirmos resolver, você tem direito a reembolso em 7 dias. Consulte nossa política de reembolso."],
      ["Há assinatura ou contrato?", "Não. Lotes beta são compras únicas. Sem cobranças recorrentes, sem compromissos, sem taxas ocultas."],
      ["O que acontece após a compra?", "Coletamos seus detalhes de onboarding (se ainda não enviados), processamos seu lote e entregamos por e-mail em 24–48 horas."],
      ["Posso segmentar uma indústria ou região específica?", "Sim. O formulário de onboarding permite especificar seu ICP, região-alvo, tom e qualquer critério adicional — e otimizamos o lote com esses parâmetros."],
    ] as [string, string][],
    ctaTag: "Começar",
    ctaTitle: "Pronto para preencher seu pipeline?",
    ctaSub: "Um lote. Entrega em 24–48h. Você revisa cada mensagem antes de enviar.",
    ctaCTA: "Inicie seu primeiro lote — $29 →",
    sampleTabs: ["Email", "LinkedIn DM", "Follow-up 1", "Follow-up 2"],
    pricePerLead: { starter: "$2.90 / lead", standard: "$1.94 / lead", pro: "$1.64 / lead" },
  },
  ja: {
    announcement: "ベータ版アクセス公開中 — 最初のリードバッチをリクエストできます。",
    announcementCTA: "バッチをリクエスト →",
    navPricing: "料金",
    navCTA: "開始する — $29",
    heroBadge: "ベータ版公開中 — 限定枠",
    heroH1pre: "理想の顧客像を入力してください。",
    heroH1hi: "LeadLensが見込み客を発掘し、",
    heroH1post: "営業メッセージを作成します。",
    heroSub: "LeadLensはあなたのオファーに合う質の高いB2Bリードを調査し、各リードに合わせたメール・DM・フォローアップを作成します。送信前に内容をご確認いただけます。",
    heroCTA: "1回のバッチから始める — $29 →",
    heroSeeAll: "すべてのプランを見る",
    heroNote: "10件の厳選リード + 完全なアウトリーチシーケンス。長期契約なし。",
    proofLabels: [["48h","配信"],["1回","バッチから"],["7","AIエージェント"],["100%","人による確認"]] as [string,string][],
    howTag: "使い方",
    howTitle: "4ステップ。連携不要。インストール不要。",
    steps: [
      ["1","オファーを入力","売り先と提供内容を入力してください。約5分で完了します。"],
      ["2","リードを探索","ICPに合う質の高いB2Bリードを自動で特定します。リスト不要。"],
      ["3","AIがメッセージを作成","7つの専門エージェントが各リードを調査・評価し、パーソナライズされたシーケンスを作成。"],
      ["4","レポートを受け取る","CSV＋Markdownですぐに使えます。誰に・いつ連絡するかはあなたが決めます。"],
    ] as [string,string,string][],
    pricingTag: "ベータ版バッチ料金",
    pricingTitle: "まずは1回のリードバッチから。必要になったら月額プランへ。",
    pricingSub: "長期契約は不要です。LeadLensを1回だけ使うことも、継続的なパイプラインが必要になったら月次バッチに移行することもできます。",
    oneBatch: "1回限りのベータ版バッチ",
    monthlyTitle: "毎月リードが必要ですか？",
    monthlySub: "継続的なリードバッチ、複数市場向けキャンペーン、優先レビューが必要な代理店、SaaSチーム、コンサルタント向けに月額プランを準備中です。",
    monthlyTag: "月額プラン近日公開",
    planNames: { starter: "Beta スターター", standard: "Beta スタンダード", pro: "Beta プロ" },
    planDescs: { starter: "リスクなしでお試し。", standard: "小規模キャンペーンを実行。", pro: "フルキャンペーン + 2つのアングル。" },
    planFeatures: {
      starter:  ["HOT/WARM/COLD評価","各リードのfit理由","パーソナライズトリガー","メール + LinkedIn DM","各リードに2回フォローアップ","CSV + Markdownエクスポート","24〜48時間で納品"],
      standard: ["スターターの全機能","キャンペーン向け大容量","A/Bテストメッセージ","エグゼクティブサマリー","CSV + Markdownエクスポート","24〜48時間で納品"],
      pro:      ["スタンダードの全機能","2つのキャンペーンアングル","優先マニュアルレビュー","CSV + Markdownエクスポート","24〜48時間で納品"],
    },
    leadsFoundBy: (n: number) => `${n}件のリードをLeadLensが発掘`,
    getStarted: "ベータバッチを開始",
    mostPopular: "最も人気",
    formTag: "キャンペーンを開始",
    formTitle: "LeadLensにビジネスについて教えてください",
    formSub: "詳しく入力するほど、より質の高いリードとメッセージが生成されます。",
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
    submitBtn: (n: number) => `${n}件のリードを生成 →`,
    backBtn: "← 戻る",
    processingTitle: "リードレポートを生成中…",
    processingNote: "本番環境: 15〜45分。プレビュー: 約5秒。",
    processingStatus: "LeadLensが見込み客を調査し、スコアリングしています。",
    agents: [
      "理想顧客分析 — プロフィールのマッピング",
      "リード探索 — 見込み客の発掘",
      "調査 — 各企業の情報収集",
      "評価 — ICPフィットスコアリング（0〜10）",
      "パーソナライズ — 独自トリガーの作成",
      "メッセージ作成 — メール・DM下書き",
      "品質チェック + レポート — 最終確認とエクスポート",
    ],
    reportReady: "レポート完成",
    reportTitle: "レポートが完成しました",
    dlCSV: (n: number) => `⬇ CSVをダウンロード（${n}件）`,
    dlMD: "⬇ Markdownをダウンロード",
    newRun: "← 新規実行",
    statTotal: "合計",
    statAvg: "平均スコア",
    execSummary: "エグゼクティブサマリー",
    patternsObserved: "観察されたパターン",
    recommendations: "推奨事項",
    leadBreakdown: "リード別詳細",
    showingOf: (shown: number, total: number) => `${total}件中${shown}件を表示。エクスポートには全${total}件が含まれます。`,
    moreInExport: (n: number) => `他${n}件はエクスポートに含まれます`,
    dlAll: (n: number) => `⬇ 全${n}件をCSVでダウンロード`,
    mCompanySize: "企業規模",
    mEmailStatus: "メール状況",
    mConfidence: "信頼度",
    mSource: "ソース",
    mLocation: "所在地",
    mSourceUrl: "ソースURL",
    mLinkedin: "LinkedIn",
    sCompanyContext: "企業コンテキスト",
    sTimingSignals: "タイミングシグナル",
    sWhyFit: "フィットする理由",
    sFlags: "フラグ",
    sDataGaps: "データ不足",
    sPersonalization: "パーソナライズトリガー",
    sInitialEmail: "初回メール",
    sSubject: "件名",
    sBody: "本文",
    sFullSequence: "アウトリーチシーケンス全体",
    sLinkedinDM: "LinkedIn DM",
    sFollowup1: "フォローアップ1（3〜4日目）",
    sFollowup2: "フォローアップ2（7〜8日目）",
    sQcNotes: "QCメモ",
    footerCopy: "© 2026 LeadLens AI. 人による確認あり。自動送信なし。すべてのメッセージを確認してから使用できます。",
    footerLinks: ["プライバシー", "利用規約", "返金ポリシー", "お問い合わせ"],
    footerContact: "ご質問は: martinfgaleano@gmail.com",
    expectationsTag: "ベータ版の納品について",
    expectationsTitle: "リードバッチに期待できること",
    expectationsItems: [
      "フォームの内容を処理し、理想の顧客プロフィールを作成します。",
      "AIエージェントがあなたのオファーに合うリードを調査・評価します。",
      "各リードにパーソナライズされたメール・LinkedIn DM・フォローアップ2通を作成します。",
      "CSV＋Markdownのレポートが届きます。すぐに確認してご利用いただけます。",
      "通常の納品時間：送信後24〜48時間。",
      "送信前にすべてのメッセージをご確認いただけます。自動送信は一切行いません。",
    ],
    tryDemoCTA: "サンプルデモを試す",
    checkoutPendingTitle: "オンライン決済はまもなく利用可能になります。",
    checkoutPendingBody: "現在 Lemon Squeezy がストアを審査中のため、このベータバッチはまだ購入できません。",
    checkoutPendingDemoHint: "代わりに、以下でサンプルデモレポートをお試しいただけます。",
    switchToDemo: "サンプルデモを試す →",
    sampleBadge: "サンプルデモレポート",
    sampleNote: "これはサンプル出力です。有料ベータバッチはチェックアウトと確認後に納品されます。",
    problemTag: "問題点",
    problemTitle: "多くのB2Bチームが機能しないアウトリーチに時間を無駄にしています",
    problemItems: [
      "自社オファーに合わないプロスペクトの調査に何時間も費やしてしまう。",
      "汎用的なコールドメールが無視されるかスパム判定され、送信者評価を傷つける。",
      "専任SDRなしではスケールでのパーソナライズが困難。",
      "購入時には既に古くなっている高価なリード一覧。",
      "今すぐ追うべきプロスペクトが誰なのかを判断できる明確なシグナルがない。",
    ],
    receiveTag: "受け取るもの",
    receiveTitle: "アウトリーチを始めるのに必要なものすべてが1つのレポートに",
    receiveItems: [
      ["HOT / WARM / COLD スコア", "0〜10のICPフィットスコアとティアラベルで、どこに優先的に集中すべきかがわかります。"],
      ["フィット理由", "この特定のリードがなぜあなたのオファーに合っているのかの明確な説明。"],
      ["パーソナライズトリガー", "ニュース、成長シグナル、テックスタックなど実際のコンテキストに基づくユニークなフック。"],
      ["初回コールドメール", "件名＋本文一式。あなたのトーンで書かれ、送信準備完了。"],
      ["LinkedIn DM", "ダイレクトコネクションリクエスト向けの簡潔なメッセージ。"],
      ["フォローアップ1（3〜4日目）", "「確認のため連絡」ではなく、価値を追加するリマインダー。"],
      ["フォローアップ2（7〜8日目）", "次のプロスペクトに移る前の、タイミング良い最後の連絡。"],
      ["エグゼクティブサマリー", "バッチ品質、ベストセグメント、次のステップの概要。"],
      ["観察されたパターン", "LeadLensがバッチ全体で気づいたこと — ICPの絞り込みに活用できます。"],
      ["CSV + Markdownエクスポート", "2つの形式で提供されるフルレポート。どんなツールでもすぐに使えます。"],
    ] as [string, string][],
    samplePreviewTag: "サンプル出力",
    samplePreviewTitle: "レポートはこのような内容です",
    samplePreviewSub: "バッチ内の各リードには、完全な評価、パーソナライズされたアウトリーチ、シーケンス全体が含まれます — 何かを送信する前に必ず確認できます。",
    faqTag: "よくある質問",
    faqTitle: "よくいただく質問",
    faqs: [
      ["具体的に何が届きますか？", "CSV＋Markdownレポートに10〜100件のリード（プランによる）。各リードにフィットスコア、フィット理由、パーソナライズトリガー、コールドメール（件名＋本文）、LinkedIn DM、フォローアップ2通が含まれます。エグゼクティブサマリーとバッチ全体のパターン分析も付属します。"],
      ["納品までどのくらいかかりますか？", "オンボーディングフォーム送信後、通常24〜48時間以内に納品します。全バッチを手動でレビューしてから納品します。"],
      ["メールを代わりに送ってもらえますか？", "いいえ。お届けするのは下書きです。確認・送信はご自身で行っていただきます。自動送信は一切ありません。完全にコントロールを維持できます。"],
      ["リードはどのように調達しますか？", "公開されているビジネスデータを使用して、ICPに合致するプロスペクトを特定します。公開情報以外の個人データは使用しません。"],
      ["リードが自社のICPに合わなかった場合は？", "リードが一貫してICPに合わず解決できない場合、7日以内に返金を申請できます。返金ポリシーをご確認ください。"],
      ["サブスクリプションや契約はありますか？", "いいえ。ベータバッチは1回限りの購入です。継続課金なし、コミットメントなし、隠れた費用もありません。"],
      ["購入後はどうなりますか？", "オンボーディング情報を収集し（未提出の場合）、バッチを処理して、24〜48時間以内にメールで納品します。"],
      ["特定の業界や地域を指定できますか？", "はい。オンボーディングフォームでICP、ターゲット市場、トーン、その他の条件を指定でき、それに合わせてバッチを最適化します。"],
    ] as [string, string][],
    ctaTag: "始める",
    ctaTitle: "パイプラインを埋める準備ができましたか？",
    ctaSub: "1回のバッチ。24〜48時間で納品。送信前に全メッセージを確認できます。",
    ctaCTA: "最初のバッチを始める — $29 →",
    sampleTabs: ["メール", "LinkedIn DM", "フォローアップ 1", "フォローアップ 2"],
    pricePerLead: { starter: "$2.90 / リード", standard: "$1.94 / リード", pro: "$1.64 / リード" },
  },
};

type Copy = typeof COPY["en"];

// ─── Constants ────────────────────────────────────────────────────────────────

const PLANS = {
  starter:  { price: "$29",  leads: 10  },
  standard: { price: "$97",  leads: 50  },
  pro:      { price: "$197", leads: 100 },
} as const;

// Checkout links are public direct-pay URLs from Lemon Squeezy's product "Share" button.
// NEXT_PUBLIC_* is intentional and safe — these URLs contain no secrets; they are the
// same links you would paste in a tweet. No API key or webhook is needed for this flow.
const LS_URLS: Partial<Record<PlanType, string>> = {
  starter:  process.env.NEXT_PUBLIC_LEMONSQUEEZY_STARTER_URL || undefined,
  standard: process.env.NEXT_PUBLIC_LEMONSQUEEZY_STANDARD_URL || undefined,
  pro:      process.env.NEXT_PUBLIC_LEMONSQUEEZY_PRO_URL || undefined,
};

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
  const [agentStep, setStep]      = useState(-1);
  const [progress, setProg]       = useState(0);
  const [report, setReport]       = useState<LeadLensReport | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [expanded, setExp]        = useState<number | null>(null);
  const [formMode, setFormMode]   = useState<"paid_batch" | "sample_demo">("paid_batch");
  const [isSampleDemo, setIsSampleDemo] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const copy = COPY[lang];

  function changeLang(l: OutputLanguage) {
    setLang(l);
    setForm(f => ({ ...f, output_language: l }));
  }

  function goToForm(p: PlanType) {
    const lsUrl = LS_URLS[p];
    if (lsUrl) {
      window.location.href = lsUrl;
      return;
    }
    setPlan(p);
    setFormMode("paid_batch");
    setView("form");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function goToDemo() {
    setFormMode("sample_demo");
    setIsSampleDemo(false);
    setView("form");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  async function runPipeline(e: React.FormEvent) {
    e.preventDefault();
    // Payment gate: never run pipeline for paid_batch mode without a checkout link
    if (formMode === "paid_batch") return;
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
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, onboarding: form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
      if (!data.report) throw new Error("No report returned from server");
      setReport(data.report as LeadLensReport);
      await delay(300);
      setView("results");
      setExp(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
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
      value={lang}
      onChange={e => changeLang(e.target.value as OutputLanguage)}
      style={{ background: "transparent", border: "1px solid #e2e8f0", color: "#64748b", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: ".82rem", fontFamily: "inherit" }}
    >
      {LANG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  // ─── LANDING ──────────────────────────────────────────────────────────────
  if (view === "landing") return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#0f172a", background: "#fff", lineHeight: 1.5 }}>
      <style>{`
        .ll-pricing-grid { display: grid; gap: 1.5rem; max-width: 56rem; margin: 0 auto; align-items: stretch; grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 900px) { .ll-pricing-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 580px) { .ll-pricing-grid { grid-template-columns: 1fr; gap: 1.25rem; padding-top: .875rem; } }
        .ll-hero-grid { display: grid; grid-template-columns: 1fr 1.1fr; gap: 3rem; align-items: center; }
        @media (max-width: 840px) { .ll-hero-grid { grid-template-columns: 1fr; gap: 2rem; } .ll-hero-left { text-align: center; display: flex; flex-direction: column; align-items: center; } .ll-hero-mock { margin-top: .5rem; width: 100%; } }
        @media (max-width: 480px) { .ll-hero-mock { overflow: hidden; max-width: 100%; } }
        @media (max-width: 520px) { .ll-nav-pricing { display: none; } .ll-nav-r { gap: .75rem !important; } }
        @media (max-width: 600px) {
          .ll-proof-outer { flex-wrap: wrap; }
          .ll-proof-item { width: 50%; justify-content: center; }
          .ll-proof-div { display: none; }
          .ll-proof-stat { padding: .75rem .625rem !important; }
          .ll-proof-label { white-space: normal !important; text-align: center; font-size: .72rem; }
          .ll-proof-val { font-size: 1.375rem !important; }
        }
        @media (max-width: 640px) {
          .ll-section { padding: 3rem 1rem !important; }
          .ll-problem-sec { padding: 3rem 1rem !important; }
          .ll-cta-sec { padding: 3.5rem 1rem !important; }
          .ll-hero-outer { padding: 2.5rem 1rem 2rem !important; }
          .ll-faq-inner { padding: 0 1rem !important; }
          .ll-monthly-card { padding: 1.5rem 1.125rem !important; }
        }
      `}</style>

      {/* Announcement bar */}
      <div style={{ background: "linear-gradient(135deg,#075985,#0284c7)", color: "#fff", textAlign: "center", padding: ".55rem 1rem", fontSize: ".8rem", fontWeight: 500, letterSpacing: ".01em" }}>
        {copy.announcement}{" "}
        <button onClick={() => goToForm("starter")} style={{ background: "rgba(255,255,255,.18)", border: "1px solid rgba(255,255,255,.3)", color: "#fff", fontSize: ".78rem", fontWeight: 700, borderRadius: 5, padding: "2px 12px", cursor: "pointer", marginLeft: 8, transition: "background .15s" }}
          onMouseOver={e => (e.currentTarget.style.background = "rgba(255,255,255,.28)")}
          onMouseOut={e => (e.currentTarget.style.background = "rgba(255,255,255,.18)")}
        >
          {copy.announcementCTA}
        </button>
      </div>

      {/* Nav */}
      <div style={{ borderBottom: "1px solid #e8f4fd", position: "sticky", top: 0, background: "rgba(255,255,255,.96)", backdropFilter: "blur(12px)", zIndex: 40, boxShadow: "0 1px 0 #e8f4fd" }}>
        <nav style={{ padding: ".875rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "72rem", margin: "0 auto" }}>
          <span style={{ fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-.03em", color: "#0f172a" }}>
            Lead<span style={{ color: "#0ea5e9" }}>Lens</span><span style={{ color: "#94a3b8", fontWeight: 500, fontSize: ".9rem", marginLeft: ".25rem" }}>AI</span>
          </span>
          <div className="ll-nav-r" style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" as const }}>
            <button className="ll-nav-pricing" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} style={navLinkStyle}>
              {copy.navPricing}
            </button>
            <LangSelect />
            <Btn onClick={() => goToForm("starter")}>{copy.navCTA}</Btn>
          </div>
        </nav>
      </div>

      {/* Hero */}
      <div style={{ background: "linear-gradient(170deg,#e0f2fe 0%,#f0f9ff 35%,#fff 75%)" }}>
        <div className="ll-hero-outer" style={{ maxWidth: "74rem", margin: "0 auto", padding: "4.5rem 1.5rem 4rem" }}>
          <div className="ll-hero-grid">
            {/* Left column — text + CTAs */}
            <div className="ll-hero-left">
              <div style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", background: "#fff", border: "1px solid #bae6fd", borderRadius: 999, padding: ".35rem 1rem .35rem .6rem", fontSize: ".8rem", fontWeight: 600, color: "#0284c7", marginBottom: "1.75rem", boxShadow: "0 2px 8px rgba(14,165,233,.12)" }}>
                <span style={{ width: ".5rem", height: ".5rem", background: "#16a34a", borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
                {copy.heroBadge}
              </div>
              <h1 style={{ fontSize: "clamp(2.1rem,4.5vw,3.5rem)", fontWeight: 800, lineHeight: 1.1, marginBottom: "1.25rem", letterSpacing: "-.03em" }}>
                {copy.heroH1pre}<br />
                <span style={{ color: "#0ea5e9" }}>{copy.heroH1hi}</span>{copy.heroH1post}
              </h1>
              <p style={{ fontSize: "1.1rem", color: "#475569", marginBottom: "2.25rem", lineHeight: 1.7, maxWidth: "34rem" }}>
                {copy.heroSub}
              </p>
              <div style={{ display: "flex", gap: ".875rem", flexWrap: "wrap" as const, marginBottom: "1rem" }}>
                <Btn lg onClick={() => goToForm("starter")}>{copy.heroCTA}</Btn>
                <BtnOutline lg onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>{copy.heroSeeAll}</BtnOutline>
              </div>
              <p style={{ display: "inline-block", fontSize: ".82rem", color: "#64748b", background: "#f0f9ff", border: "1px solid #e0f2fe", borderRadius: 999, padding: ".375rem 1rem", marginBottom: ".75rem" }}>
                {copy.heroNote}
              </p>
              <button onClick={goToDemo} style={{ display: "block", background: "none", border: "none", color: "#94a3b8", fontSize: ".82rem", cursor: "pointer", textDecoration: "underline", padding: ".25rem 0" }}>
                {copy.tryDemoCTA} →
              </button>
            </div>
            {/* Right column — product mockup */}
            <div className="ll-hero-mock">
              <LeadMockupHero />
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

      {/* How it works */}
      <section className="ll-section" style={{ ...sectionStyle, background: "#f8fafc" }}>
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
      <section className="ll-section" style={{ ...sectionStyle, background: "#fff" }}>
        <div style={{ ...innerStyle, textAlign: "center" }}>
          <Tag>{copy.samplePreviewTag}</Tag>
          <h2 style={sectionTitleStyle}>{copy.samplePreviewTitle}</h2>
          <p style={{ color: "#64748b", fontSize: "1.05rem", maxWidth: "36rem", margin: "0 auto 3rem", lineHeight: 1.6 }}>
            {copy.samplePreviewSub}
          </p>
          {/* Decorative message tabs */}
          <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" as const, maxWidth: "52rem", margin: "0 auto 1rem" }}>
            {copy.sampleTabs.map((tab, i) => (
              <div key={tab} style={{ padding: ".4rem 1rem", borderRadius: ".625rem", fontSize: ".78rem", fontWeight: 600, background: i === 0 ? "#0ea5e9" : "#f1f5f9", color: i === 0 ? "#fff" : "#64748b", whiteSpace: "nowrap" as const }}>
                {tab}
              </div>
            ))}
          </div>
          {/* Mock lead card */}
          <div style={{ maxWidth: "52rem", margin: "0 auto", background: "#fff", border: "2px solid #e2e8f0", borderRadius: "1.25rem", overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.08)", textAlign: "left" }}>
            {/* Card header */}
            <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: ".75rem", background: "#fff" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a" }}>
                  Sarah Chen <span style={{ fontWeight: 400, color: "#64748b" }}>— Momentum Analytics</span>
                </div>
                <div style={{ fontSize: ".8rem", color: "#94a3b8", marginTop: ".2rem", overflowWrap: "break-word" as const, wordBreak: "break-all" as const }}>
                  VP Sales · sarah.chen@momentumanalytics.io · SaaS / Analytics · 38 employees
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: ".75rem", flexShrink: 0 }}>
                <span style={{ padding: ".3rem .875rem", borderRadius: 999, fontSize: ".78rem", fontWeight: 700, background: "#fee2e2", color: "#991b1b" }}>🔥 HOT</span>
                <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: ".25rem" }}>
                  <span style={{ fontSize: ".9rem", fontWeight: 700, color: "#0284c7", lineHeight: 1 }}>9/10</span>
                  <div style={{ width: "3.5rem", background: "#e0f2fe", borderRadius: 999, height: 5, overflow: "hidden" }}>
                    <div style={{ background: "#0ea5e9", height: "100%", width: "90%", borderRadius: 999 }} />
                  </div>
                </div>
                <span style={{ fontSize: ".85rem", color: "#16a34a" }}>✅ APPROVED</span>
              </div>
            </div>
            {/* Card body */}
            <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "1.5rem" }}>
              {/* Why fit */}
              <div>
                <div style={{ fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: ".625rem" }}>Why good fit</div>
                {[
                  "Scaling outbound — posted 3 SDR job openings this month.",
                  "VP Sales at 38-person SaaS, exact ICP size ($3k–8k/month range).",
                  "No outbound tooling visible — likely running a manual process.",
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: ".5rem", fontSize: ".855rem", color: "#334155", padding: ".2rem 0", lineHeight: 1.5 }}>
                    <span style={{ color: "#16a34a", fontWeight: 700, flexShrink: 0 }}>✓</span>{r}
                  </div>
                ))}
              </div>
              {/* Personalization trigger */}
              <div>
                <div style={{ fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: ".625rem" }}>Personalization trigger</div>
                <div style={{ background: "#e0f2fe", borderLeft: "3px solid #0ea5e9", borderRadius: "0 .5rem .5rem 0", padding: ".875rem 1rem", fontSize: ".855rem", color: "#0284c7", fontStyle: "italic" as const, lineHeight: 1.6 }}>
                  Sarah posted about hiring 3 SDRs and said the team is &ldquo;finally ready to go outbound.&rdquo; Perfect timing window — active buying intent.
                </div>
              </div>
            </div>
            {/* Email preview */}
            <div style={{ padding: "0 1.5rem 1.5rem" }}>
              <div style={{ fontSize: ".7rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: ".625rem" }}>Initial cold email</div>
              <div style={{ background: "#f8fafc", borderRadius: ".75rem", padding: "1rem 1.125rem", border: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: ".3rem" }}>Subject</div>
                <div style={{ fontSize: ".875rem", fontWeight: 700, color: "#0284c7", marginBottom: ".875rem", background: "#fff", border: "1px solid #e2e8f0", borderRadius: ".375rem", padding: ".4rem .625rem", overflowWrap: "break-word" as const }}>
                  Re: scaling outbound at Momentum — a shortcut on the research side
                </div>
                <div style={{ fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", color: "#94a3b8", marginBottom: ".4rem" }}>Body</div>
                <div style={{ position: "relative" as const, overflow: "hidden", maxHeight: "5.5rem" }}>
                  <div style={{ fontSize: ".875rem", color: "#334155", lineHeight: 1.7 }}>
                    Hi Sarah,<br /><br />
                    Saw you&rsquo;re hiring SDRs at Momentum — great signal that outbound is becoming a priority. The problem most teams hit at your stage: SDRs spend 60% of their time on research, not selling...
                  </div>
                  <div style={{ position: "absolute" as const, bottom: 0, left: 0, right: 0, height: "2.5rem", background: "linear-gradient(transparent,#f8fafc)", pointerEvents: "none" as const }} />
                </div>
                <div style={{ marginTop: ".625rem", fontSize: ".78rem", color: "#0284c7", fontWeight: 600 }}>+ LinkedIn DM · Follow-up 1 · Follow-up 2 included in full report</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="ll-section" style={{ ...sectionStyle, background: "#f8fafc" }}>
        <div style={{ ...innerStyle, textAlign: "center" }}>
          <Tag>{copy.pricingTag}</Tag>
          <h2 style={sectionTitleStyle}>{copy.pricingTitle}</h2>
          <p style={{ color: "#64748b", fontSize: "1.05rem", maxWidth: "36rem", margin: "0 auto 3rem", lineHeight: 1.6 }}>
            {copy.pricingSub}
          </p>
          <div className="ll-pricing-grid">
            {(["starter", "standard", "pro"] as PlanType[]).map(p => (
              <PricingCard key={p} plan={p} featured={p === "standard"} copy={copy} onSelect={goToForm} />
            ))}
          </div>

          {/* Monthly plans coming soon */}
          <div className="ll-monthly-card" style={{ marginTop: "3rem", background: "linear-gradient(135deg,#f0f9ff,#e0f2fe)", border: "1px solid #bae6fd", borderRadius: "1.25rem", padding: "2rem 2.5rem", textAlign: "center", maxWidth: "44rem", margin: "3rem auto 0" }}>
            <span style={{ display: "inline-block", background: "#0ea5e9", color: "#fff", fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".07em", padding: ".2rem .75rem", borderRadius: 999, marginBottom: "1rem" }}>
              {copy.monthlyTag}
            </span>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-.02em", marginBottom: ".75rem", color: "#0f172a" }}>{copy.monthlyTitle}</h3>
            <p style={{ color: "#64748b", fontSize: ".9rem", lineHeight: 1.7, maxWidth: "32rem", margin: "0 auto" }}>{copy.monthlySub}</p>
          </div>
        </div>
      </section>

      {/* Problem — LeadLens blue/white premium */}
      <section className="ll-problem-sec" style={{ background: "#eff6ff", padding: "5rem 1.5rem" }}>
        <div style={{ ...innerStyle, textAlign: "center" }}>
          <div style={{ display: "inline-block", background: "#dbeafe", color: "#1d4ed8", fontSize: ".75rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".06em", padding: ".25rem .875rem", borderRadius: 999, marginBottom: "1.25rem" }}>
            {copy.problemTag}
          </div>
          <h2 style={{ fontSize: "clamp(1.75rem,3.5vw,2.25rem)", fontWeight: 800, color: "#0f172a", letterSpacing: "-.02em", maxWidth: "38rem", margin: "0 auto 3rem" }}>
            {copy.problemTitle}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "1rem", textAlign: "left" }}>
            {copy.problemItems.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: ".875rem", alignItems: "flex-start", background: "#fff", border: "1px solid #bfdbfe", borderRadius: ".875rem", padding: "1.25rem 1.375rem", boxShadow: "0 1px 4px rgba(14,165,233,.07)" }}>
                <span style={{ color: "#f87171", fontWeight: 700, flexShrink: 0, fontSize: ".95rem", marginTop: ".1rem" }}>✗</span>
                <span style={{ fontSize: ".9rem", color: "#334155", lineHeight: 1.6 }}>{item}</span>
              </div>
            ))}
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
      <section className="ll-section" style={{ ...sectionStyle, background: "#f8fafc" }}>
        <div style={{ ...innerStyle, maxWidth: "48rem" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <Tag>{copy.expectationsTag}</Tag>
            <h2 style={{ ...sectionTitleStyle, fontSize: "clamp(1.5rem,3vw,1.875rem)" }}>{copy.expectationsTitle}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: ".75rem" }}>
            {copy.expectationsItems.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: ".75rem", alignItems: "flex-start", background: "#fff", border: "1px solid #e2e8f0", borderRadius: ".75rem", padding: "1rem 1.125rem" }}>
                <span style={{ color: "#0ea5e9", fontWeight: 700, flexShrink: 0, fontSize: ".875rem" }}>✓</span>
                <span style={{ fontSize: ".875rem", color: "#64748b", lineHeight: 1.55 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="ll-section" style={{ ...sectionStyle, background: "#fff" }}>
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
        </div>
      </section>

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
            <button onClick={() => goToForm("starter")}
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
          Lead<span style={{ color: "#0ea5e9" }}>Lens</span> AI
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <select
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
        {/* Sample demo badge — shown when in demo mode */}
        {formMode === "sample_demo" && (
          <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: ".75rem", padding: ".75rem 1rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: ".625rem" }}>
            <span style={{ fontSize: ".85rem", fontWeight: 700, color: "#713f12" }}>Demo</span>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: ".625rem" }}>
            {(Object.entries(PLANS) as [PlanType, typeof PLANS.starter][]).map(([key, p]) => (
              <button key={key} type="button" onClick={() => setPlan(key)}
                style={{ border: `1.5px solid ${plan === key ? "#0ea5e9" : "#e2e8f0"}`, borderRadius: ".75rem", padding: ".75rem .5rem", textAlign: "center" as const, cursor: "pointer", transition: "all .15s", background: plan === key ? "#e0f2fe" : "#fff" }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>{p.price}</div>
                <div style={{ fontSize: ".72rem", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".04em", color: "#94a3b8", marginTop: ".2rem" }}>{copy.planNames[key]}</div>
                <div style={{ fontSize: ".78rem", color: "#0284c7", fontWeight: 600, marginTop: ".3rem" }}>{p.leads} leads</div>
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
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: ".75rem", padding: "1rem", marginBottom: "1.25rem", fontSize: ".875rem", color: "#dc2626" }}>
                <strong>Error:</strong> {error}
              </div>
            )}

            <FormField label={copy.fCompanyName} value={form.company_name} onChange={v => setForm(f => ({ ...f, company_name: v }))} placeholder="e.g. GrowthForge Studio" />
            <FormField label={copy.fCompanyDesc} value={form.company_description} onChange={v => setForm(f => ({ ...f, company_description: v }))} multiline placeholder="2–3 sentences about your business" />
            <FormField label={copy.fOffer} value={form.offer_description} onChange={v => setForm(f => ({ ...f, offer_description: v }))} multiline placeholder="What exactly are you selling and at what price?" />
            <FormField label={copy.fValue} value={form.value_proposition} onChange={v => setForm(f => ({ ...f, value_proposition: v }))} multiline placeholder="What specific outcome do you deliver?" />
            <FormField label={copy.fCustomer} value={form.target_customer_description} onChange={v => setForm(f => ({ ...f, target_customer_description: v }))} multiline placeholder="Company size, titles, industries, signals..." />
            <FormField label={copy.fTicket} value={form.average_ticket ?? ""} onChange={v => setForm(f => ({ ...f, average_ticket: v }))} placeholder="e.g. $3,000/month" />

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>{copy.fTone}</label>
              <select value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value as typeof f.tone }))} style={inputStyle}>
                <option value="direct">{copy.toneDirect}</option>
                <option value="consultative">{copy.toneConsultative}</option>
                <option value="casual">{copy.toneCasual}</option>
              </select>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={labelStyle}>{copy.fRegion}</label>
              <select value={form.target_market_region ?? "global"} onChange={e => setForm(f => ({ ...f, target_market_region: e.target.value as MarketRegion }))} style={inputStyle}>
                <option value="north_america">{copy.regionNA}</option>
                <option value="latin_america">{copy.regionLA}</option>
                <option value="europe">{copy.regionEU}</option>
                <option value="asia">{copy.regionAS}</option>
                <option value="global">{copy.regionGL}</option>
              </select>
            </div>

            <FormField label={copy.fEmail} value={form.contact_email} onChange={v => setForm(f => ({ ...f, contact_email: v }))} type="email" placeholder="you@company.com" />

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
                {copy.submitBtn(PLANS[plan].leads)}
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
          {PLANS[plan].leads} leads · {copy.planNames[plan]}
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
              <span style={{ fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-.02em" }}>Lead<span style={{ color: "#0ea5e9" }}>Lens</span> AI</span>
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
              {report.total_leads} leads · {copy.planNames[report.plan as PlanType] ?? report.plan} · {new Date(report.created_at).toLocaleString()}
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
              <LeadCard key={lead.id} lead={lead} index={i} isOpen={expanded === i} onToggle={() => setExp(expanded === i ? null : i)} copy={copy} />
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
        </div>
      </div>
    );
  }

  return null;
}

// ─── Lead card ────────────────────────────────────────────────────────────────

function LeadCard({ lead, index, isOpen, onToggle, copy }: {
  lead: ProcessedLead; index: number; isOpen: boolean; onToggle: () => void; copy: Copy;
}) {
  const { candidate: c, qualification: q, outreach: o, enrichment: e } = lead;
  const cat      = catInfo(q.fit_score);
  const qcMeta   = QC_META[o.qc_status];
  const isDiscard = q.fit_score < 4;

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
              {c.name ?? "Unknown"} <span style={{ fontWeight: 400, color: "#64748b" }}>— {c.company}</span>
            </div>
            <div style={{ fontSize: ".82rem", color: "#94a3b8", marginTop: ".1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.title ?? "?"} · {c.email ?? "no email"} · {c.industry ?? "?"}
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
            <MetaCell label={copy.mEmailStatus} val={c.email_status ?? "?"} />
            <MetaCell label={copy.mConfidence}  val={`${Math.round(c.confidence_score * 100)}%`} />
            <MetaCell label={copy.mSource}       val={c.source} />
            {c.location    && <MetaCell label={copy.mLocation}  val={c.location} />}
            {c.source_url  && <MetaCell label={copy.mSourceUrl} val={<a href={c.source_url} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9", textDecoration: "none", fontSize: ".82rem" }}>{c.source_url.slice(0, 35)}…</a>} />}
            {c.linkedin_url && <MetaCell label={copy.mLinkedin} val={<a href={`https://${c.linkedin_url.replace(/^https?:\/\//,"")}`} target="_blank" rel="noreferrer" style={{ color: "#0ea5e9", textDecoration: "none", fontSize: ".82rem" }}>View profile</a>} />}
          </div>

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

function LeadMockupHero() {
  const rows = [
    { name: "Sarah Chen",   co: "Momentum Analytics", role: "VP Sales",      score: 9, badge: "HOT",  bg: "#fee2e2", color: "#991b1b", trigger: "Hiring 3 SDRs — outbound intent"   },
    { name: "David Park",   co: "Scalify Inc.",        role: "Head of Growth", score: 8, badge: "HOT",  bg: "#fee2e2", color: "#991b1b", trigger: "Raised Series A — team expanding" },
    { name: "Maria Santos", co: "CloudBase Pro",       role: "CEO",            score: 7, badge: "WARM", bg: "#fef3c7", color: "#92400e", trigger: "Launched new product line"         },
  ];
  return (
    <div style={{ background: "#fff", border: "1.5px solid #bae6fd", borderRadius: "1.25rem", boxShadow: "0 20px 60px rgba(14,165,233,.12), 0 4px 16px rgba(0,0,0,.06)", overflow: "hidden" }}>
      {/* Header bar */}
      <div style={{ background: "linear-gradient(135deg,#075985,#0284c7)", padding: ".75rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: ".875rem", letterSpacing: "-.01em" }}>LeadLens Report</span>
        <span style={{ background: "rgba(255,255,255,.18)", color: "#bae6fd", fontSize: ".68rem", fontWeight: 600, padding: ".2rem .625rem", borderRadius: 999 }}>Preview</span>
      </div>
      {/* Lead rows */}
      {rows.map((r, i) => (
        <div key={r.name} style={{ padding: ".875rem 1.25rem", borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : "none" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: ".375rem", gap: ".5rem" }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: ".875rem", color: "#0f172a" }}>{r.name}</span>
              <span style={{ color: "#94a3b8", fontSize: ".78rem" }}> · {r.co}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: ".5rem", flexShrink: 0 }}>
              <span style={{ padding: ".2rem .625rem", borderRadius: 999, fontSize: ".7rem", fontWeight: 700, background: r.bg, color: r.color }}>{r.badge}</span>
              <span style={{ fontSize: ".78rem", fontWeight: 700, color: "#0284c7" }}>{r.score}/10</span>
            </div>
          </div>
          <div style={{ background: "#e0f2fe", borderRadius: 999, height: 4, marginBottom: ".35rem", overflow: "hidden" }}>
            <div style={{ background: "#0ea5e9", height: "100%", width: `${r.score * 10}%`, borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: ".75rem", color: "#64748b" }}>{r.role} · {r.trigger}</div>
        </div>
      ))}
      {/* Footer */}
      <div style={{ padding: ".625rem 1.25rem", background: "#f8fafc", borderTop: "1px solid #f1f5f9", fontSize: ".72rem", color: "#94a3b8" }}>
        Email · LinkedIn DM · 2 Follow-ups per lead
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
        <div style={{ fontSize: ".875rem", color: "#64748b", lineHeight: 1.45, marginBottom: ".875rem" }}>{copy.planDescs[plan]}</div>
        <div style={{ display: "inline-block", fontSize: ".7rem", fontWeight: 600, color: "#64748b", background: "#f1f5f9", borderRadius: ".375rem", padding: "3px 10px" }}>
          {copy.oneBatch}
        </div>
      </div>

      {/* Divider + lead count */}
      <div style={{ borderTop: `1px solid ${featured ? "#bae6fd" : "#f1f5f9"}`, paddingTop: "1.125rem", marginBottom: "1rem" }}>
        <div style={{ fontSize: ".9rem", fontWeight: 700, color: "#0284c7" }}>{copy.leadsFoundBy(p.leads)}</div>
      </div>

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
        {copy.getStarted} — {p.price} →
      </button>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

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

function FormField({ label, value, onChange, multiline, type = "text", placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label style={labelStyle}>{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} placeholder={placeholder} style={inputStyle} />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
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

const sectionStyle:      React.CSSProperties = { padding: "5rem 1.5rem" };
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
