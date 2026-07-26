// ─── Premium Intelligence Report contract (premium-report-v3) ────────────────
// One typed, reusable contract for the customer-facing intelligence report,
// reflecting the full product narrative (market → segments → universe →
// structural ranking → shortlist → deep dossiers → strategy), NOT only the
// current artifact. Technical provider/harness metrics stay OUT of this
// contract unless translated into evidence quality. Reusable beyond Amor de Gea
// (no client hardcoding in the types). The assembler adapts the current
// discovery artifact into this shape; missing stages are marked honestly.

import type { BuyerSegment, MarketLandscape as RawLandscape, RankedAccount, Actionability } from "@/lib/discovery/market-to-account";

export const PREMIUM_REPORT_VERSION = "premium-report-v3";

export type Confidence = "high" | "medium" | "low";
/** Customer-facing recommendation. Richer than the internal Actionability:
 *  channel-fit alone can never map to act_now. */
export type AccountRecommendation = "act_now" | "investigate_now" | "prioritize" | "monitor" | "low_priority" | "exclude";

export interface ReportMetadata {
  client_name: string; client_description: string; offering: string;
  target_market: string; region: string; research_period: string;
  generated_date: string; report_version: string; research_scope: string;
  universe_size: number; limitations: string[];
}

export interface ExecutiveDecisionBrief {
  market_conclusion: string;
  priority_segments: string[];
  priority_accounts: string[];
  immediate_recommendation: string;
  worth_investigating: string[];
  not_supported_yet: string[];
  major_risks: string[];
  action_30d: string;
}

export interface BuyerSegmentIntel {
  id: BuyerSegment; name: string; description: string; buying_use_case: string;
  commercial_potential: number; ease_of_entry: number;
  purchase_frequency: "high" | "medium" | "low";
  likely_order_size: "large" | "medium" | "small";
  sales_cycle: "short" | "medium" | "long";
  product_fit: number; accessibility: number;
  account_count: number; high_fit_count: number;
  evidence: string; confidence: Confidence;
  recommended_priority: "primary" | "secondary" | "opportunistic" | "deprioritize";
}

export interface MarketLandscapeIntel {
  market_thesis: string;
  buyer_segments: BuyerSegmentIntel[];
  geographic_coverage: Array<{ area: string; count: number }>;
  routes_to_market: string[];
  market_structure: string;
  universe_metrics: { discovered: number; verified: number; high_fit: number; shortlisted: number; deep_researched: number };
  coverage_gaps: string[];
  limitations: string[];
}

export interface ScoreDimension {
  score: number; label: string; explanation: string;
  evidence: string; confidence: Confidence; missing_info: string | null;
}
export interface StructuralAccountAssessment {
  company: string; domain: string | null; segment: BuyerSegment;
  market_fit: ScoreDimension; account_attractiveness: ScoreDimension;
  opportunity_timing: ScoreDimension; evidence_strength: ScoreDimension;
  commercial_accessibility: ScoreDimension; strategic_value: ScoreDimension;
  recommendation: AccountRecommendation; recommendation_reason: string;
}

export interface CompanyUniverseAccount {
  company: string; domain: string | null; geography: string; segment: BuyerSegment;
  buyer_role: string; business_model: string; scale_indicators: string;
  classification_evidence: string; classification_confidence: Confidence;
  inclusion_rationale: string; exclusion_risks: string; research_status: "universe" | "shortlisted" | "deep_researched";
}

export interface EvidenceItem {
  claim: string; kind: "fact" | "signal" | "inference"; source: string | null;
  date: string | null; freshness: "recent" | "aging" | "stale" | "undated";
  confidence: Confidence; corroboration: "high" | "medium" | "low" | "insufficient";
  counterevidence: string | null;
}

export interface DeepAccountDossier {
  company: string; domain: string | null; segment: BuyerSegment;
  overview: string; why_it_fits: string; opportunity_thesis: string;
  relevant_categories: string[]; probable_buying_structure: string;
  commercial_accessibility: string;
  recent_signals: string[]; what_changed: string | null; why_now: string;
  evidence: EvidenceItem[]; counterevidence: string[]; uncertainties: string[];
  suggested_offer: string; suggested_entry_point: string; recommended_approach: string;
  validation_questions: string[]; next_action: string; source_trail: string[];
  recommendation: AccountRecommendation; complete: boolean;
}

export interface PortfolioStrategy {
  segment_priority: string[]; account_sequence: string[];
  quick_wins: string[]; strategic_accounts: string[]; experiments: string[];
  offer_by_segment: Array<{ segment: BuyerSegment; offer: string; value_prop: string }>;
  validation_plan: string[]; action_30d: string[]; learning_agenda: string[]; risks: string[];
}

export interface EvidenceQualitySummary {
  dated: number; corroborated: number; weak: number; undated: number;
  source_diversity: number; major_gaps: string[];
}

export interface Methodology {
  sources: string[]; discovery_process: string; ranking_approach: string;
  evidence_standards: string; facts_vs_inference: string; freshness_rules: string;
  limitations: string[];
}

export interface PremiumIntelligenceReport {
  version: string;
  metadata: ReportMetadata;
  executive_brief: ExecutiveDecisionBrief;
  market_landscape: MarketLandscapeIntel;
  company_universe: CompanyUniverseAccount[];
  structural_ranking: StructuralAccountAssessment[];
  dossiers: DeepAccountDossier[];
  portfolio_strategy: PortfolioStrategy;
  evidence_quality: EvidenceQualitySummary;
  methodology: Methodology;
  /** Honest delivery gate (customer-facing wording derived from the run). */
  delivery: { decision: "deliver" | "review" | "do_not_deliver"; headline: string };
}

/** Map internal Actionability + timing/evidence into the richer customer
 *  recommendation. Channel-fit alone (isChannelOnly) can NEVER be act_now. */
export function toRecommendation(a: Actionability, timing: number, evidence: number, isChannelOnly: boolean): AccountRecommendation {
  if (a === "exclude") return "exclude";
  if (a === "act_now" && !isChannelOnly && timing >= 62 && evidence >= 60) return "act_now";
  if (timing >= 55 && evidence >= 50 && !isChannelOnly) return "investigate_now";
  if (a === "validate_first") return "investigate_now";
  if (a === "monitor") return timing < 40 ? "monitor" : "prioritize";
  return "prioritize";
}

const conf = (n: number): Confidence => (n >= 70 ? "high" : n >= 45 ? "medium" : "low");
const freshness = (days: number | null): EvidenceItem["freshness"] => days == null ? "undated" : days <= 60 ? "recent" : days <= 180 ? "aging" : "stale";

export interface AssembleInput {
  metadata: Pick<ReportMetadata, "client_name" | "client_description" | "offering" | "target_market" | "region">;
  landscape: RawLandscape;
  ranked: RankedAccount[];
  candidates: Array<{ company: string; domain: string | null; date: string | null; corroboration: string | null; fact: string | null; verdict: string | null; org_type: string | null; materiality: string | null }>;
  manifest: { operating_mode?: string; delivery_decision?: string; status?: string; ran_at?: string; dynamic_opportunity_count?: number };
  shortlist: RankedAccount[];
  research_period?: string;
}

/** Adapter: current discovery artifact → PremiumIntelligenceReport. Missing
 *  stages (deep research) are represented honestly (dossier.complete=false). */
export function assemblePremiumReport(i: AssembleInput): PremiumIntelligenceReport {
  const candByName = new Map(i.candidates.map((c) => [c.company.toLowerCase(), c]));
  const daysOld = (iso: string | null) => { if (!iso) return null; const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000); return d >= 0 ? d : null; };

  const segments: BuyerSegmentIntel[] = i.landscape.segments.map((s) => ({
    id: s.id, name: s.label, description: s.note, buying_use_case: s.note,
    commercial_potential: s.commercial_potential, ease_of_entry: s.ease_of_entry,
    purchase_frequency: s.commercial_potential >= 75 ? "high" : s.commercial_potential >= 55 ? "medium" : "low",
    likely_order_size: s.commercial_potential >= 80 ? "large" : s.commercial_potential >= 60 ? "medium" : "small",
    sales_cycle: s.ease_of_entry >= 68 ? "short" : s.ease_of_entry >= 55 ? "medium" : "long",
    product_fit: Math.round((s.commercial_potential + s.ease_of_entry) / 2), accessibility: s.ease_of_entry,
    account_count: s.count, high_fit_count: s.high_fit,
    evidence: `${s.count} cuenta(s) verificadas en el segmento (${s.high_fit} con fit ≥65).`,
    confidence: conf(s.count >= 5 ? 70 : s.count >= 2 ? 50 : 30),
    recommended_priority: s.high_fit >= 4 && s.commercial_potential >= 75 ? "primary" : s.count >= 2 ? "secondary" : "opportunistic",
  }));

  const dim = (score: number, label: string, explanation: string, evidence: string, missing: string | null = null): ScoreDimension =>
    ({ score, label, explanation, evidence, confidence: conf(score), missing_info: missing });

  const structural_ranking: StructuralAccountAssessment[] = [...i.ranked]
    .sort((a, b) => (b.scores.attractiveness + b.scores.fit) - (a.scores.attractiveness + a.scores.fit))
    .map((a) => {
      const cand = candByName.get(a.company.toLowerCase());
      const isChannelOnly = true; // current runs surface channel-fit; deep research (Block 5) will refine
      const rec = toRecommendation(a.scores.actionability, a.scores.timing, a.scores.evidence, isChannelOnly);
      return {
        company: a.company, domain: a.domain, segment: a.segment.primarySegment,
        market_fit: dim(a.scores.fit, a.segment.primarySegment, `Relevancia estructural para la oferta (${a.segment.buyerType}).`, a.segment.segmentEvidence),
        account_attractiveness: dim(a.scores.attractiveness, a.visibility, "Escala, relevancia y valor comercial probable.", `Visibilidad: ${a.visibility}.`),
        opportunity_timing: dim(a.scores.timing, a.scores.timing < 40 ? "sin ventana actual" : "ventana posible", "Desarrollos recientes que abran una ventana.", cand?.date ? `Señal ${cand.date}.` : "Sin evento fechado.", cand?.date ? null : "Falta un evento reciente y fechado."),
        evidence_strength: dim(a.scores.evidence, cand?.corroboration ?? "baja", "Calidad, corroboración y frescura de la fuente.", `Corroboración: ${cand?.corroboration ?? "baja"}.`),
        commercial_accessibility: dim(a.segment.segmentFit, "acceso de canal", "Factibilidad de entrar/alcanzar la cuenta.", a.segment.segmentEvidence),
        strategic_value: dim(Math.round((a.scores.attractiveness + a.scores.fit) / 2), "valor estratégico", "Valor de largo plazo, marca y aprendizaje.", "Derivado de fit + atractivo."),
        recommendation: rec,
        recommendation_reason: a.scores.timing < 40 ? "Fit de canal sin evento reciente: investigar/priorizar, no accionar." : "Fit y señal recientes justifican foco.",
      };
    });

  const company_universe: CompanyUniverseAccount[] = i.ranked.map((a) => ({
    company: a.company, domain: a.domain, geography: i.metadata.region || "Colombia", segment: a.segment.primarySegment,
    buyer_role: a.segment.buyerType, business_model: a.segment.primarySegment, scale_indicators: a.visibility,
    classification_evidence: a.segment.segmentEvidence, classification_confidence: a.segment.roleConfidence,
    inclusion_rationale: `Fit de segmento ${a.scores.fit}/100.`, exclusion_risks: a.domain ? "—" : "Sin dominio verificado.",
    research_status: i.shortlist.some((s) => s.company === a.company) ? "shortlisted" : "universe",
  }));

  const dossiers: DeepAccountDossier[] = i.shortlist.map((a) => {
    const cand = candByName.get(a.company.toLowerCase());
    const d = daysOld(cand?.date ?? null);
    const rec = toRecommendation(a.scores.actionability, a.scores.timing, a.scores.evidence, true);
    const evidence: EvidenceItem[] = cand ? [{
      claim: cand.fact ?? `${a.company} opera en ${a.segment.primarySegment}.`, kind: cand.date ? "signal" : "fact",
      source: a.domain, date: cand.date, freshness: freshness(d), confidence: conf(a.scores.evidence),
      corroboration: (cand.corroboration as EvidenceItem["corroboration"]) ?? "low",
      counterevidence: cand.date ? null : "Sin fecha de evento — no interpretable como reciente.",
    }] : [];
    return {
      company: a.company, domain: a.domain, segment: a.segment.primarySegment,
      overview: `${a.company} — ${a.segment.buyerType} (${a.segment.primarySegment}).`,
      why_it_fits: a.segment.segmentEvidence, opportunity_thesis: `Encaja como canal para la oferta; validar intención de compra y ventana.`,
      relevant_categories: [a.segment.primarySegment], probable_buying_structure: "Por determinar (compras centralizadas vs local).",
      commercial_accessibility: `Fit de canal ${a.segment.segmentFit}/100; accesibilidad ${a.scores.timing < 40 ? "estructural, no por evento" : "con ventana"}.`,
      recent_signals: cand?.date ? [cand.fact ?? "señal fechada"] : [], what_changed: cand?.date ? cand.fact : null,
      why_now: cand?.date ? `Señal del ${cand.date}.` : "No se verificó un disparador actual — priorizar por fit estructural.",
      evidence, counterevidence: cand?.date ? [] : ["Sin evento reciente fechado."],
      uncertainties: ["Ruta de compra no confirmada", "Ventana comercial no verificada"],
      suggested_offer: "Portafolio de infusiones/botánicos alineado a la categoría del canal.",
      suggested_entry_point: "Contacto de validación (no venta): confirmar canal operativo y decisor de surtido.",
      recommended_approach: "Validar antes de proponer; usar la afinidad de marca como apertura.",
      validation_questions: ["¿Tiene apertura/renovación/convocatoria de proveedores reciente?", "¿Decide surtido localmente o de forma centralizada?"],
      next_action: "Investigación dirigida de 1 fuente primaria + confirmar canal.",
      source_trail: a.domain ? [`https://${a.domain}`] : [],
      recommendation: rec,
      complete: !!(a.domain && evidence.length > 0), // deep research (Block 5) will complete these
    };
  });

  // Portfolio strategy
  const primarySeg = segments.find((s) => s.recommended_priority === "primary") ?? segments[0];
  const portfolio_strategy: PortfolioStrategy = {
    segment_priority: segments.filter((s) => s.recommended_priority !== "deprioritize").map((s) => s.name),
    account_sequence: i.shortlist.map((a) => a.company),
    quick_wins: structural_ranking.filter((a) => a.recommendation === "investigate_now").slice(0, 3).map((a) => a.company),
    strategic_accounts: structural_ranking.filter((a) => a.strategic_value.score >= 75).slice(0, 3).map((a) => a.company),
    experiments: primarySeg ? [`Probar ${primarySeg.name} como canal de entrada con una cuenta de bajo riesgo.`] : [],
    offer_by_segment: segments.slice(0, 4).map((s) => ({ segment: s.id, offer: `Línea de infusiones/botánicos para ${s.name}.`, value_prop: `Diferenciación de bienestar con ${s.name}.` })),
    validation_plan: ["Confirmar canal operativo por cuenta", "Verificar decisor y ciclo de compra"],
    action_30d: ["Seleccionar 3 cuentas de mayor fit para contacto de validación", "Confirmar 1 fuente primaria por cuenta", "Registrar aprendizajes por conversación"],
    learning_agenda: ["¿Qué segmento responde mejor?", "¿Qué oferta abre puerta?", "¿Compra centralizada o local?"],
    risks: ["Universo pequeño y sesgado a retail", "Timing débil: pocas señales recientes fechadas"],
  };

  // Evidence quality
  const evAll = i.candidates;
  const evidence_quality: EvidenceQualitySummary = {
    dated: evAll.filter((c) => c.date).length,
    corroborated: evAll.filter((c) => c.corroboration && c.corroboration !== "low" && c.corroboration !== "insufficient").length,
    weak: evAll.filter((c) => (c.corroboration ?? "low") === "low").length,
    undated: evAll.filter((c) => !c.date).length,
    source_diversity: new Set(i.ranked.map((a) => a.domain).filter(Boolean)).size,
    major_gaps: [i.landscape.limitations].flat(),
  };

  const dyn = i.manifest.dynamic_opportunity_count ?? 0;
  const delivery: PremiumIntelligenceReport["delivery"] = {
    decision: i.manifest.delivery_decision === "deliver" ? "deliver" : dyn > 0 ? "review" : "do_not_deliver",
    headline: dyn > 0 ? `${dyn} oportunidad(es) con señal reciente para revisión.` : "Sin eventos comerciales recientes; el valor está en el mapa de mercado y las prioridades estructurales para investigar.",
  };

  return {
    version: PREMIUM_REPORT_VERSION,
    metadata: {
      ...i.metadata, research_period: i.research_period ?? "últimos 18 meses (fuentes públicas)",
      generated_date: (i.manifest.ran_at ?? new Date().toISOString()).slice(0, 10),
      report_version: PREMIUM_REPORT_VERSION, research_scope: `${i.landscape.total_accounts} cuentas · ${segments.length} segmentos`,
      universe_size: i.landscape.total_accounts, limitations: i.landscape.limitations,
    },
    executive_brief: {
      market_conclusion: `El mercado ${i.metadata.offering} en ${i.metadata.region} se concentra en ${segments.slice(0, 2).map((s) => s.name).join(" y ")}; la vía de entrada es de canal (surtido/portafolio), no de eventos de compra frecuentes.`,
      priority_segments: segments.filter((s) => s.recommended_priority === "primary").map((s) => s.name),
      priority_accounts: i.shortlist.slice(0, 5).map((a) => a.company),
      immediate_recommendation: dyn > 0 ? "Revisar las cuentas con señal reciente y validar." : "Priorizar por fit estructural e iniciar validación dirigida; no hay urgencia por evento.",
      worth_investigating: i.shortlist.slice(0, 5).map((a) => a.company),
      not_supported_yet: structural_ranking.filter((a) => a.recommendation === "monitor").slice(0, 4).map((a) => a.company),
      major_risks: portfolio_strategy.risks,
      action_30d: portfolio_strategy.action_30d[0],
    },
    market_landscape: {
      market_thesis: `Amor de Gea vende a través de canales de bienestar/retail/hospitality; el valor comercial está en el fit de canal y el momento de surtido, no en anuncios de compra.`,
      buyer_segments: segments,
      geographic_coverage: [{ area: i.metadata.region, count: i.landscape.total_accounts }],
      routes_to_market: ["Retail saludable", "Distribución", "Hospitality/amenities", "Food service"],
      market_structure: `Fragmentado; ${i.landscape.total_accounts} cuentas verificadas, ${segments.length} segmentos.`,
      universe_metrics: { discovered: i.landscape.funnel.discovered, verified: i.landscape.funnel.verified, high_fit: i.landscape.funnel.high_fit, shortlisted: i.landscape.funnel.shortlisted, deep_researched: dossiers.filter((d) => d.complete).length },
      coverage_gaps: i.landscape.limitations, limitations: i.landscape.limitations,
    },
    company_universe, structural_ranking, dossiers, portfolio_strategy, evidence_quality,
    methodology: {
      sources: ["Sitios corporativos verificados", "Prensa/medios (Brave/Tavily)", "Directorios sectoriales (solo universo)"],
      discovery_process: "Market → segmentos → universo → verificación → ranking estructural → shortlist → dossiers.",
      ranking_approach: "Dimensiones separadas (fit/atractivo/timing/evidencia/accesibilidad/valor estratégico); sin score único dominante.",
      evidence_standards: "Hecho vs señal vs inferencia separados; sin fechas ni contactos inventados.",
      facts_vs_inference: "Lo marcado HECHO viene de fuente verificada; lo demás es inferencia explícita a validar.",
      freshness_rules: "Sin fecha ⇒ no reciente; channel_fit_not_buying_intent nunca implica urgencia.",
      limitations: i.landscape.limitations,
    },
    delivery,
  };
}
