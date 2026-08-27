// ─── Institutional Opportunity Report assembler ───────────────────────────────
// Pure transform: report_json snapshot → InstitutionalOpportunityReportV1.
// Reads only fields already present (resilient to pre- and post-Decision-Engine
// reports). Classifies every material statement by basis and never fabricates
// corporate facts or purchase-intent claims. Does not read or change ranking.

import {
  INSTITUTIONAL_REPORT_VERSION,
  type AccountDossier,
  type Claim,
  type EvidenceLink,
  type InstitutionalOpportunityReportV1,
} from "./institutional-report-types";
import { evaluateInstitutionalOpportunityCase } from "@/lib/intelligence/opportunity-case-intelligence";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

const clean = (s: unknown): string | null => {
  let t = typeof s === "string" ? s.trim() : "";
  // Model prose sometimes cites internal field NAMES (never payloads) —
  // customer-safe wording only.
  t = t.replace(/\braw[_ ]context\b/gi, "the source record").replace(/\bprocessed[_ ]leads\b/gi, "the report").replace(/\b_vault_generation\b/gi, "the generation record");
  return t.length >= 3 ? t : null;
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const d = Math.floor((Date.now() - t) / 86_400_000);
  return d >= 0 ? d : null;
}

function buildDossier(opp: Json, lead: Json | undefined, es = false, clientObjective: string | null = null, canonicalCase: Json | null = null): AccountDossier {
  const c = lead?.candidate ?? {};
  const e = lead?.enrichment ?? {};
  const q = lead?.qualification ?? {};
  const decision = opp?.decision ?? null;
  // Resolve the signal date from the candidate first, then the frozen feature
  // snapshot (Source Access Layer / Intelligence Foundation). Never invented.
  const fsnap = opp?.feature_snapshot ?? {};
  const signalDate: string | null = c.signal_date ?? fsnap.signal_date ?? null;
  const freshnessBucket: string | null = fsnap.freshness_bucket ?? null;
  const days = daysSince(signalDate);
  const freshLabel = freshnessBucket ? ` · ${es ? "señal" : "signal"} ${freshnessBucket}` : days !== null ? ` · ${days}d` : "";

  // Why now: a fact only when a dated, sourced signal exists; otherwise inference.
  const whyNowText = clean(decision?.why_now) ?? clean(e.why_now);
  const why_now: Claim = whyNowText
    ? { basis: days !== null && c.source_url ? "fact" : "inference", text: whyNowText, evidence: (c.source_url ?? null) ? `${es ? "fuente" : "source"}${signalDate ? ` · ${es ? "con fecha" : "dated"} ${signalDate}` : ""}` : (signalDate ? `${es ? "señal con fecha" : "signal dated"} ${signalDate}` : null) }
    : { basis: "unknown", text: es ? "No se capturó una señal con fecha — la recencia no está verificada." : "No dated timing signal was captured — recency is unverified.", evidence: null };

  const thesisText = clean(decision?.thesis) ?? clean(e.account_thesis) ?? clean(q.fit_reasons?.[0]);
  const thesis: Claim = thesisText
    ? { basis: "inference", text: thesisText, evidence: es ? "tesis de la cuenta" : "account thesis" }
    : { basis: "unknown", text: es ? "No se produjo una tesis para esta cuenta — trátala como un prospecto por validar." : "No account thesis was produced — treat as a lead to validate.", evidence: null };

  const whyCompanyText = clean(decision?.why_this_company) ?? (Array.isArray(q.fit_reasons) && q.fit_reasons.length ? q.fit_reasons.slice(0, 3).join(" · ") : null);
  const why_this_company: Claim = whyCompanyText
    ? { basis: "inference", text: whyCompanyText, evidence: es ? "evaluación de fit" : "fit assessment" }
    : { basis: "unknown", text: es ? "Fit inferido solo del perfil — sin razones específicas verificadas para esta empresa." : "Fit inferred from profile only — no company-specific reasons verified.", evidence: null };

  const whyQuarterText = clean(decision?.why_this_quarter) ?? clean(e.buying_window_reason);
  const why_this_quarter: Claim = whyQuarterText
    ? { basis: "inference", text: whyQuarterText, evidence: e.buying_window ? `${es ? "ventana de compra" : "buying window"}: ${e.buying_window}` : (es ? "razonamiento de ventana de compra" : "buying window reasoning") }
    : { basis: "unknown", text: es ? "No hay evidencia de urgencia a nivel de trimestre." : "No quarter-level urgency is evidenced.", evidence: null };

  const riskItems: string[] = [
    ...(decision?.risk_factors ?? []),
    ...(e.opportunity_risks ?? []),
    ...(e.risks_weaknesses ?? []),
  ].filter((x) => typeof x === "string").slice(0, 4);
  const risks: Claim[] = riskItems.length
    ? riskItems.map((r) => ({ basis: "inference" as const, text: r, evidence: es ? "evaluación de riesgo" : "risk assessment" }))
    : [{ basis: "unknown", text: es ? "No surgieron riesgos específicos — las incógnitas (presupuesto, proveedor actual, timing) son el riesgo." : "No specific risks surfaced — unknowns (budget, incumbent, timing) are the risk.", evidence: null }];

  const hypotheses: Claim[] = [
    clean(e.pain_hypothesis) && { basis: "hypothesis" as const, text: clean(e.pain_hypothesis)!, evidence: es ? "hipótesis de dolor (sin probar)" : "pain hypothesis (unproven)" },
    clean(e.inferred_pain) && clean(e.inferred_pain) !== clean(e.pain_hypothesis) && { basis: "hypothesis" as const, text: clean(e.inferred_pain)!, evidence: es ? "dolor inferido (sin probar)" : "inferred pain (unproven)" },
    clean(e.next_best_question) && { basis: "hypothesis" as const, text: `${es ? "Validar antes de contactar" : "Validate before contact"}: ${clean(e.next_best_question)}`, evidence: es ? "pregunta abierta" : "open question" },
  ].filter(Boolean) as Claim[];

  const evidence_chain: EvidenceLink[] = [];
  if (c.source_url) evidence_chain.push({ label: (clean(e.timing_signals?.[0]) ?? (es ? "Fuente principal" : "Primary source")) + freshLabel, url: c.source_url, date: signalDate, date_basis: signalDate ? "fact" : "unknown" });
  for (const ev of (Array.isArray(e.evidence) ? e.evidence : []).slice(0, 3)) {
    if (typeof ev === "string" && ev.trim()) evidence_chain.push({ label: (clean(ev) ?? "").slice(0, 160), url: null, date: null, date_basis: "unknown" });
  }

  const actionText = clean(decision?.recommended_action) ?? clean(e.recommended_action) ?? clean(opp?.recommended_action);
  const recommended_next_step: Claim = actionText
    ? { basis: "recommendation", text: (actionText).replace(/_/g, " "), evidence: clean(e.recommended_action_reason) ?? (es ? "acción recomendada por control de calidad" : "recommended action guardrail") }
    : { basis: "recommendation", text: es ? "Validar la señal y el fit antes de cualquier contacto." : "Validate the signal and fit before any outreach.", evidence: es ? "control por defecto" : "default guardrail" };

  const legacyAction = opp?.recommended_action ?? e.recommended_action ?? null;
  const canonicalAction = canonicalCase?.decision === "prioritize" ? "act_now"
    : canonicalCase?.decision === "validate" ? "validate_first"
    : canonicalCase?.decision === "hold" ? "exclude"
    : canonicalCase?.decision === "monitor" ? "monitor" : null;
  const actionabilityStatus = canonicalAction ?? opp?.actionability_status ?? (
    legacyAction === "send_outreach_now" ? "act_now" :
    legacyAction === "validate_source_first" || legacyAction === "enrich_manually" ? "validate_first" :
    legacyAction === "exclude" ? "exclude" :
    legacyAction ? "monitor" : null
  );
  const decisionState = canonicalCase?.decision ?? (actionabilityStatus === "act_now" ? "prioritize"
    : actionabilityStatus === "validate_first" ? "validate"
    : actionabilityStatus === "exclude" ? "hold" : "monitor");
  const materialSignal = signalDate && c.source_url && clean(e.timing_signals?.[0] ?? e.what_changed ?? e.material_change)
    ? { label: clean(e.timing_signals?.[0] ?? e.what_changed ?? e.material_change)!, date: signalDate, sourceLabel: (() => { try { return new URL(c.source_url).hostname.replace(/^www\./, ""); } catch { return "primary source"; } })(), url: c.source_url }
    : null;
  const opportunity_case = evaluateInstitutionalOpportunityCase({
    account: c.company ?? opp?.company ?? "Unknown account",
    clientObjective,
    explicitRole: clean(decision?.account_role ?? opp?.account_role),
    explicitType: clean(decision?.opportunity_type ?? opp?.opportunity_type),
    opportunityDescriptor: clean(decision?.opportunity_descriptor ?? opp?.opportunity_descriptor),
    fitScore: typeof (opp?.fit_score ?? q?.fit_score) === "number" ? (opp?.fit_score ?? q?.fit_score) : null,
    fitReasons: Array.isArray(q.fit_reasons) ? q.fit_reasons.filter((x: unknown): x is string => typeof x === "string") : [],
    signal: materialSignal,
    whyNow: whyNowText,
    sourceEvidence: evidence_chain.map((item) => ({ label: item.label, url: item.url, date: item.date })),
    explicitIndependentSupport: decision?.independent_support === true,
    risks: riskItems,
    blockers: Array.isArray(opp?.actionability_blockers) ? opp.actionability_blockers.filter((x: unknown): x is string => typeof x === "string") : [],
    openQuestions: hypotheses.map((item) => item.text),
    decision: decisionState,
    recommendedNextStep: actionText,
  });

  return {
    rank: opp?.rank ?? q?.rank ?? null,
    company: c.company ?? opp?.company ?? (es ? "Cuenta sin identificar" : "Unknown account"),
    industry: c.industry ?? null,
    location: c.location ?? null,
    domain: c.domain ?? null,
    tier: opp?.category ?? q?.category ?? "UNSCORED",
    actionability_status: actionabilityStatus,
    actionability_reasons: canonicalCase?.reasons ?? (Array.isArray(opp?.actionability_reasons) ? opp.actionability_reasons : []),
    actionability_blockers: Array.isArray(opp?.actionability_blockers) ? opp.actionability_blockers : [],
    fit_score: opp?.fit_score ?? q?.fit_score ?? null,
    thesis, why_now, why_this_company, why_this_quarter, risks,
    confidence_drivers: Array.isArray(decision?.confidence_drivers) ? decision.confidence_drivers : [],
    evidence_grounded: decision?.evidence_grounded ?? null,
    evidence_chain,
    hypotheses,
    recommended_next_step,
    playbook: opp?.playbook ?? null,
    opportunity_case,
  };
}

export function assembleInstitutionalReport(
  reportJson: Json,
  meta: { job_id: string; plan: string | null; search_id: string | null; customer_ref: string | null; created_at: string },
): InstitutionalOpportunityReportV1 {
  // Customer-facing language: Spanish reports must be Spanish end to end.
  const es = reportJson?.onboarding?.output_language === "es";
  const opps: Json[] = Array.isArray(reportJson.ranked_opportunities) ? reportJson.ranked_opportunities : [];
  const leadsById = new Map<string, Json>((reportJson.processed_leads ?? []).map((l: Json) => [l.id, l]));
  const canonicalById = new Map<string, Json>((reportJson.canonical_cases ?? []).map((c: Json) => [c.lead_id, c]));
  const commercialObjective = clean(reportJson?.onboarding?.commercial_objective ?? reportJson?.commercial_context?.objective ?? reportJson?.commercial_intent?.objective);
  const dossiers = opps.map((o) => buildDossier(o, leadsById.get(o.lead_id), es, commercialObjective, canonicalById.get(o.lead_id) ?? null)).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

  const regions = Array.from(new Set(dossiers.map((d) => d.location).filter(Boolean))) as string[];
  const industries = Array.from(new Set(dossiers.map((d) => d.industry).filter(Boolean))) as string[];
  const priority = dossiers.filter((d) => d.actionability_status === "act_now");

  const summaryText = clean(reportJson.executive_summary);
  const ri = reportJson.report_intelligence ?? null;
  const landscape = reportJson.market_landscape ?? null;

  return {
    schema_version: INSTITUTIONAL_REPORT_VERSION,
    metadata: {
      job_id: meta.job_id,
      generated_at: reportJson.created_at ?? meta.created_at,
      assembled_at: new Date().toISOString(),
      plan: meta.plan,
      search_id: meta.search_id,
      source_versions: reportJson._versions ?? null,
    },
    context: {
      customer_ref: meta.customer_ref,
      icp_summary: clean(reportJson.segment_insights?.[0]) ?? null,
      regions, industries,
    },
    executive_brief: {
      headline: priority.length > 0
        ? (es
          ? `${priority.length} ${priority.length === 1 ? "cuenta prioritaria identificada" : "cuentas prioritarias identificadas"} en ${regions.length || 1} ${regions.length === 1 ? "mercado" : "mercados"}`
          : `${priority.length} priority ${priority.length === 1 ? "account" : "accounts"} identified across ${regions.length || 1} ${regions.length === 1 ? "market" : "markets"}`)
        : (es
          ? `${dossiers.length} cuentas analizadas — ninguna alcanzó el umbral de prioridad en esta corrida`
          : `${dossiers.length} accounts analyzed — none met the priority bar this run`),
      summary: summaryText
        ? { basis: "inference", text: summaryText, evidence: "report executive summary" }
        : { basis: "unknown", text: "No executive summary available for this run.", evidence: null },
      priority_count: priority.length,
      total_accounts: dossiers.length,
    },
    portfolio_summary: {
      total: reportJson.total_leads ?? dossiers.length,
      hot: reportJson.hot_count ?? dossiers.filter((d) => d.tier === "HOT").length,
      warm: reportJson.warm_count ?? dossiers.filter((d) => d.tier === "WARM").length,
      cold: reportJson.cold_count ?? dossiers.filter((d) => d.tier === "COLD").length,
      discard: reportJson.discard_count ?? 0,
      avg_fit_score: typeof reportJson.avg_score === "number" ? reportJson.avg_score : null,
      tier_note: "Tiers are the pipeline's existing categories — unchanged by this presentation layer.",
      funnel: ri ? { considered: ri.companies_considered, rejected: ri.companies_rejected, selected: ri.companies_selected, rejection_reasons: ri.rejection_reasons ?? {} } : null,
    },
    market_landscape: landscape ? {
      category_query: clean(landscape.category_query) ?? (es ? "Categoría no registrada" : "Category not recorded"),
      geography: Array.isArray(landscape.geography) ? landscape.geography.filter((x: unknown) => typeof x === "string") : [],
      explanation: clean(landscape.explanation) ?? "",
      known_accounts_policy: clean(landscape.known_accounts_policy) ?? "",
      considered_count: Number(landscape.considered_count) || 0,
      investigated_count: Number(landscape.investigated_count) || 0,
      selected_count: Number(landscape.selected_count) || 0,
      accounts: (Array.isArray(landscape.accounts) ? landscape.accounts : []).slice(0, 40).map((account: Json) => ({
        company: clean(account.company) ?? (es ? "Empresa sin identificar" : "Unknown company"),
        domain: clean(account.domain),
        sector: clean(account.sector),
        origin: clean(account.origin) ?? "unknown",
        visibility: clean(account.visibility),
        role: clean(account.role),
        stage: ["known_reference", "investigated", "finalist", "preliminary"].includes(account.stage) ? account.stage : "investigated",
        fit_score: typeof account.fit_score === "number" ? account.fit_score : null,
        outcome_reason: clean(account.outcome_reason) ?? (es ? "Resultado no registrado." : "Outcome not recorded."),
      })),
    } : null,
    priority_opportunities: priority.map((d) => ({
      rank: d.rank, company: d.company, tier: d.tier,
      actionability_status: d.actionability_status,
      one_line: d.thesis.basis !== "unknown" ? d.thesis.text.slice(0, 140) : d.why_now.text.slice(0, 140),
    })),
    account_dossiers: dossiers,
    coverage: {
      accounts_with_dated_evidence: dossiers.filter((d) => d.evidence_chain.some((e) => e.date)).length,
      accounts_with_sources: dossiers.filter((d) => d.evidence_chain.some((e) => e.url)).length,
      regions_covered: regions,
      industries_covered: industries,
    },
    methodology: es ? [
      "La exploración comienza por categoría de producto + región para construir el universo de empresas antes de aplicar filtros y ranking.",
      "Las cuentas y señales provienen de fuentes públicas permitidas, con procedencia registrada; sin scraping autenticado.",
      "Las categorías, puntajes y el orden provienen sin cambios del proceso de análisis determinístico.",
      "Cada afirmación está etiquetada como hecho verificado, análisis, hipótesis, recomendación o sin datos.",
      "Las fechas de las señales se validan, nunca se infieren; la fecha de extracción no se trata como fecha de publicación.",
      "Las aprobaciones de señales pasan por revisión gobernada y pueden ser revisadas por IA (con origen registrado y confirmación humana pendiente); nunca se presentan como validadas por humanos cuando no lo están.",
    ] : [
      "Discovery begins with product category + region to construct the company universe before filtering and ranking.",
      "Accounts and signals were discovered from permitted public sources with provenance; no authenticated scraping.",
      "Tiers, scores and ordering come unchanged from the existing deterministic pipeline.",
      "Each statement is labeled fact, inference, hypothesis, recommendation or unknown.",
      "Signal dates are validated, never inferred; extraction time is not treated as publication time.",
      "Signal approvals are governed reviews and may be AI-reviewed (origin recorded, flagged for human confirmation); AI-reviewed approvals are never presented as human-validated.",
    ],
    limitations: es ? [
      "Este informe presenta una fotografía del análisis en una fecha concreta — no es un re-análisis en vivo.",
      "No se afirma intención de compra, presupuesto ni búsqueda activa de proveedor; el timing comercial se infiere de señales públicas.",
      "Las hipótesis e inferencias requieren validación antes de cualquier contacto comercial.",
      ...(!landscape ? ["Esta corrida no conservó un inventario auditable del universo de mercado considerado."] : []),
      ...(reportJson._versions ? [] : ["Esta versión es anterior al versionado de decisiones; los metadatos de procedencia son parciales."]),
    ] : [
      "This is an internal presentation layer over one report snapshot — not a live re-analysis.",
      "No purchase intent, budget, or vendor-search claims are made; commercial timing is inferred from public signals.",
      "Hypotheses and inferences require validation before outreach.",
      ...(!landscape ? ["This run did not preserve an auditable inventory of the market universe considered."] : []),
      ...(reportJson._versions ? [] : ["This snapshot predates decision-versioning; provenance metadata is partial."]),
    ],
    quality: (() => {
      const n = dossiers.length || 1;
      const withSrc = dossiers.filter((d) => d.evidence_chain.some((e) => e.url)).length;
      const withDate = dossiers.filter((d) => d.evidence_chain.some((e) => e.date)).length;
      const grounded = dossiers.filter((d) => d.evidence_grounded === true).length;
      const evPct = Math.round((withSrc / n) * 100);
      const datePct = Math.round((withDate / n) * 100);
      const groundedPct = Math.round((grounded / n) * 100);
      const grade = evPct >= 70 && datePct >= 50 ? "strong" : evPct >= 40 ? "moderate" : "developing";
      return {
        grade: grade as "strong" | "moderate" | "developing",
        evidence_coverage_pct: evPct, dated_coverage_pct: datePct, grounded_pct: groundedPct,
        note: `${withSrc}/${dossiers.length} accounts have a source link, ${withDate} have a validated date. Confidence reflects evidence coverage, not commercial certainty.`,
      };
    })(),
    versions: reportJson._versions ?? { report_schema: "legacy", institutional_report: INSTITUTIONAL_REPORT_VERSION },
  };
}
