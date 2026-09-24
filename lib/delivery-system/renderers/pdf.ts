// ─── Delivery System V1 — REAL PDF renderer (application/pdf), Presentation V1 ──────────────────
// Produces genuine PDF bytes (selectable text, native vector graphics) from a channel="pdf"
// PresentationModel using jsPDF — pure-JS, Vercel-serverless-safe (no Chromium/Puppeteer). Honors
// ExportPolicy sections at the composed tier depth. PRESENTATION ONLY: it never invents content,
// numbers, scores, or metrics — every mark is drawn from data already in the immutable snapshot.
//
// Presentation V1 adds: a tier-appropriate branded COVER, an executive summary with a truthful vector
// decision-distribution bar + a single canonical DECISION legend (so the customer sees ONE decision
// vocabulary), portfolio-level visual summary, a distinct Premium "Decision Context" dossier section,
// stronger Decision-Critical Brief cards, and a branded footer. The LeadLens identity (Lead+Lens
// wordmark, rounded "L" mark, sky accent) is reproduced natively from the repo's brand — no new logo.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { DECISION_TOKENS } from "@/lib/deliverable/deliverable-view-model";
import type { PresentationModel } from "@/lib/delivery-system/presentation-model";
import type { AccountBriefVM, DecisionState } from "@/lib/delivery-system/delivery-document";
import { dimensionValue } from "@/lib/delivery-system/renderers/shared";

type RGB = [number, number, number];
// jsPDF's built-in fonts render Latin-1 / WinAnsi (which INCLUDES á é í ó ú ñ ü Á-Ú Ñ ¿ ¡). The old
// implementation decomposed (NFD) and stripped combining marks, destroying every Spanish accent
// ("señal" → "senal", "café" → "cafe") — a P0 defect in the accepted Colombia market. This preserves
// all Latin-1 characters (accents + ñ) and only maps the few common typographic characters OUTSIDE
// Latin-1 (em/en dash, arrows, smart quotes, ellipsis) to safe equivalents; anything still outside
// Latin-1 (emoji/CJK) is dropped last so it can never render as tofu.
function latin1(v: string | number | null | undefined): string {
  return String(v ?? "")
    .normalize("NFC")
    .replace(/[—–]/g, "-")
    .replace(/→/g, "->")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[^\x00-\xff]/g, "");
}

// ── Palette (from the repo brand: sky accent #0284c7/#0ea5e9, slate ink) ──
const INK: RGB = [15, 23, 42], SUB: RGB = [51, 65, 85], MUTE: RGB = [100, 116, 139], FAINT: RGB = [148, 163, 184];
const LINE: RGB = [226, 232, 240], PANEL: RGB = [246, 249, 252], SKY: RGB = [2, 132, 199], SKY_LT: RGB = [14, 165, 233], INK_DK: RGB = [11, 18, 32];
const DEC_RGB: Record<DecisionState, RGB> = { prioritize: [2, 132, 199], validate: [217, 119, 6], monitor: [71, 85, 105], hold: [148, 163, 184] };
// Plain-language meaning — the SINGLE customer decision vocabulary (canonical Decisions only), localized.
const DEC_MEANING_L: Record<"en" | "es", Record<DecisionState, string>> = {
  en: {
    prioritize: "Strongest case for attention now",
    validate: "Promising - a decision-critical question still needs confirming",
    monitor: "Relevant, but timing or evidence is not strong enough yet",
    hold: "Not enough evidence to justify attention now",
  },
  es: {
    prioritize: "El caso más sólido para atención ahora",
    validate: "Prometedor - queda una pregunta crítica por confirmar",
    monitor: "Relevante, pero el momento o la evidencia aún no bastan",
    hold: "Evidencia insuficiente para justificar atención ahora",
  },
};
const DEC_ORDER: DecisionState[] = ["prioritize", "validate", "monitor", "hold"];

// Canonical ordinal Strength, localized for customer-facing display (values still come from data).
const STRENGTH_L: Record<"en" | "es", Record<string, string>> = {
  en: { Strong: "Strong", Moderate: "Moderate", Limited: "Limited" },
  es: { Strong: "Fuerte", Moderate: "Moderado", Limited: "Limitado" },
};
const locStrength = (v: string | null | undefined, es: boolean): string | null =>
  v == null ? null : (STRENGTH_L[es ? "es" : "en"][v] ?? v);

const M = 16;              // page margin (mm)
const W = 210, H = 297;    // A4
const CW = W - 2 * M;      // content width

// Customer-facing tier identity for the cover (maps the internal tierLabel → product identity), localized.
const TIER_IDENTITY_L: Record<"en" | "es", Record<string, { eyebrow: string; kind: string }>> = {
  en: {
    Preview: { eyebrow: "PREVIEW", kind: "Opportunity preview" },
    Brief: { eyebrow: "OPPORTUNITY BRIEF", kind: "Focused shortlist brief" },
    Intelligence: { eyebrow: "OPPORTUNITY PORTFOLIO", kind: "Executive portfolio intelligence" },
    Premium: { eyebrow: "COMMERCIAL INTELLIGENCE DOSSIER", kind: "Portfolio intelligence + decision context" },
  },
  es: {
    Preview: { eyebrow: "VISTA PREVIA", kind: "Vista previa de oportunidades" },
    Brief: { eyebrow: "INFORME DE OPORTUNIDADES", kind: "Informe corto y enfocado" },
    Intelligence: { eyebrow: "PORTAFOLIO DE OPORTUNIDADES", kind: "Inteligencia de portafolio ejecutiva" },
    Premium: { eyebrow: "DOSIER DE INTELIGENCIA COMERCIAL", kind: "Inteligencia de portafolio + contexto de decisión" },
  },
};

// Localize the small set of FIXED English synthesis strings emitted by the frozen premium-decision-
// architecture (lib/intelligence/premium). We never edit that layer; we only present its known outputs
// in the report language. Unknown strings pass through unchanged (English), never fabricated.
function locFrozen(sIn: string, es: boolean): string {
  if (!es) return sIn;
  const s = sIn.replace(/[—–]/g, "-").trim();
  if (/thin\/uncorroborated evidence/i.test(s)) return "Encaje fuerte pero evidencia limitada o sin corroborar - validar antes de comprometer esfuerzo";
  if (/Patterns describe only the evaluated portfolio/i.test(s)) return "Los patrones describen solo el portafolio evaluado y su evidencia disponible - no todo el mercado.";
  return sIn;
}

// Customer-facing template labels, localized. Canonical decision codes stay via DECISION_TOKENS.labelEs.
function labelsFor(es: boolean) {
  const L = (esS: string, enS: string) => (es ? esS : enS);
  return {
    execSummary: L("Resumen ejecutivo", "Executive summary"),
    decisionDistribution: L("Distribución de decisiones", "Decision distribution"),
    whereAttentionFirst: L("Dónde concentrar la atención primero", "Where attention goes first"),
    commercialContext: L("Contexto comercial", "Commercial context"),
    portfolio: L("Portafolio", "Portfolio"),
    accountsEvaluated: L("Cuentas evaluadas", "Accounts evaluated"),
    withSources: L("Con fuentes", "With sources"),
    datedEvidence: L("Evidencia fechada", "Dated evidence"),
    corroborated: L("Corroboradas", "Corroborated"),
    bySegment: L("Por segmento", "By segment"),
    opportunityCases: L("Casos de oportunidad", "Opportunity cases"),
    validationQueue: L("Cola de validación", "Validation queue"),
    evidenceCoverage: L("Cobertura de evidencia", "Evidence coverage"),
    methodology: L("Metodología", "Methodology"),
    limitations: L("Alcance y limitaciones", "Scope & limitations"),
    decisionContext: L("CONTEXTO DE DECISIÓN", "DECISION CONTEXT"),
    decisionContextSub: L("Premium - el contexto comercial alrededor de estas decisiones", "Premium - the commercial context around these decisions"),
    executiveContext: L("Contexto ejecutivo", "Executive context"),
    tensionsToResolve: L("Tensiones por resolver", "Tensions to resolve"),
    validationPriorities: L("Prioridades de validación", "Validation priorities"),
    portfolioPatterns: L("Patrones del portafolio", "Portfolio patterns"),
    whatContextShows: L("Lo que muestra el contexto comercial", "What the commercial context shows"),
    relevantAlternatives: L("Alternativas relevantes", "Relevant alternatives"),
    additionalOpportunities: L("Oportunidades adicionales a investigar", "Additional opportunities to investigate"),
    ecosystemRoutes: L("Rutas del ecosistema", "Ecosystem routes"),
    noCommercialContext: L("No se estableció contexto comercial adicional a partir de evidencia pública defendible para este portafolio. Es un resultado válido - LeadLens no lo rellena con afirmaciones sin sustento.", "No additional commercial context was established from defensible public evidence for this portfolio. This is a valid result - LeadLens does not fill it with unsupported claims."),
    decisionCriticalBriefs: L("Informes críticos de decisión", "Decision-critical briefs"),
    why: L("Por qué", "Why"),
    whyNow: L("Por qué ahora", "Why now"),
    whatToValidateNext: L("Qué validar a continuación", "What to validate next"),
    whatCouldChange: L("Qué podría cambiar esta decisión", "What could change this decision"),
    evidence: L("Evidencia", "Evidence"),
    source: (n: number) => L(`${n} fuente(s)`, `${n} source(s)`),
    dated: L("fechada(s)", "dated"),
    latest: L("más reciente", "latest"),
    whatChanged: L("Qué cambió", "What changed"),
    counterSignals: L("Señales en contra", "Counter-signals"),
    validateBeforeActing: L("Validar antes de actuar", "Validate before acting"),
    sources: L("Fuentes", "Sources"),
    nextStep: L("Siguiente paso", "Next step"),
    objective: L("Objetivo", "Objective"),
    regions: L("Regiones", "Regions"),
    sectors: L("Sectores", "Sectors"),
    olderEvidence: L(" (evidencia más antigua)", " (older evidence)"),
    overall: L("global", "overall"),
    confidential: L("Inteligencia de Oportunidades de Cuenta - confidencial", "Account Opportunity Intelligence - confidential"),
    preparedBy: L("Preparado por LeadLens - Inteligencia de Oportunidades de Cuenta.", "Prepared by LeadLens - Account Opportunity Intelligence."),
    aoiEyebrow: L("INTELIGENCIA DE OPORTUNIDADES DE CUENTA", "ACCOUNT OPPORTUNITY INTELLIGENCE"),
    tableHead: [L("N.º", "#"), L("Empresa", "Company"), L("Decisión", "Decision"), L("Encaje", "Fit"), L("Momento", "Timing"), L("Evidencia", "Evidence")],
    accountsWord: (n: number) => L(`${n} cuenta${n === 1 ? "" : "s"} evaluada${n === 1 ? "" : "s"}`, `${n} account${n === 1 ? "" : "s"} evaluated`),
    toPrioritize: (n: number) => L(`${n} para priorizar`, `${n} to prioritize`),
    toValidate: (n: number) => L(`${n} por validar`, `${n} to validate`),
  };
}

export function renderPdfBuffer(pm: PresentationModel): Buffer {
  const { document: doc, policy, tierLabel } = pm;
  const s = policy.sections;
  const es = doc.meta.language === "es";
  const L = labelsFor(es);
  const DEC_MEANING = DEC_MEANING_L[es ? "es" : "en"];
  const decLabel = (d: DecisionState) => (es ? DECISION_TOKENS[d].labelEs : DECISION_TOKENS[d].label);
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  let y = M;

  // ── Low-level helpers ──
  const setFill = (c: RGB) => pdf.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => pdf.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
  const space = (need: number) => { if (y + need > H - 16) { newPage(); } };
  const text = (str: string, x: number, size: number, style: "normal" | "bold" = "normal", color: RGB = INK, maxW = CW) => {
    pdf.setFont("helvetica", style); pdf.setFontSize(size); setText(color);
    const lines = pdf.splitTextToSize(latin1(str), maxW) as string[];
    for (const ln of lines) { space(size * 0.5); pdf.text(ln, x, y); y += size * 0.42 + 1.3; }
  };
  const gap = (mm: number) => { y += mm; };

  // ── Brand identity (native vector + selectable text; no image asset) ──
  const brandMark = (x: number, yTop: number, size: number) => {
    setFill(SKY); pdf.roundedRect(x, yTop, size, size, size * 0.19, size * 0.19, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(size * 2.7); setText([255, 255, 255]);
    pdf.text("L", x + size * 0.26, yTop + size * 0.74);
  };
  const wordmark = (x: number, baseline: number, size: number) => {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(size);
    setText(INK_DK); pdf.text("Lead", x, baseline);
    const lw = pdf.getTextWidth("Lead");
    setText(SKY); pdf.text("Lens", x + lw, baseline);
    return lw + pdf.getTextWidth("Lens");
  };

  const footer = (pageIndex: number, total: number) => {
    pdf.setPage(pageIndex);
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]); pdf.setLineWidth(0.2); pdf.line(M, H - 12, W - M, H - 12);
    // small mark + wordmark
    brandMark(M, H - 10.4, 4.4);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); setText(INK_DK); pdf.text("Lead", M + 6, H - 7.2);
    const lw = pdf.getTextWidth("Lead"); setText(SKY); pdf.text("Lens", M + 6 + lw, H - 7.2);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.2); setText(FAINT);
    pdf.text(latin1(L.confidential), M + 6 + lw + pdf.getTextWidth("Lens") + 3, H - 7.2);
    pdf.text(`${pageIndex - 1} / ${total - 1}`, W - M, H - 7.2, { align: "right" });
  };

  const newPage = () => { pdf.addPage(); y = M + 2; };

  // ── Section band (premium-feeling header) ──
  // Reserve enough room that a heading landing near the page bottom moves to the next page WITH its
  // first content, instead of orphaning the heading alone above dead space.
  const band = (label: string, accent: RGB = SKY) => {
    space(34); gap(4);
    setFill(accent); pdf.rect(M, y - 3.4, 1.6, 5.2, "F");           // accent tick
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12.5); setText(INK);
    pdf.text(latin1(label), M + 4, y + 0.8);
    y += 4.2;
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]); pdf.setLineWidth(0.2); pdf.line(M, y, W - M, y);
    y += 4;
  };
  const bullets = (title: string, items: string[], color: RGB = SUB) => {
    if (!items.length) return;
    if (title) text(title, M, 8.5, "bold", [51, 65, 85]);
    for (const it of items) {
      space(5);
      setFill(color); pdf.circle(M + 1.4, y - 1.1, 0.5, "F");
      text(it, M + 4, 9, "normal", color, CW - 4);
    }
    gap(1.2);
  };

  // ── Truthful decision-distribution bar (vector; proportions from real counts) ──
  const distributionBar = (x: number, yTop: number, width: number, counts: Record<DecisionState, number>, total: number) => {
    const h = 6;
    if (total <= 0) return h;
    setFill([237, 242, 247]); pdf.roundedRect(x, yTop, width, h, 1, 1, "F");
    let cx = x;
    for (const d of DEC_ORDER) {
      const c = counts[d]; if (!c) continue;
      const w = (width * c) / total;
      setFill(DEC_RGB[d]); pdf.rect(cx, yTop, w, h, "F");
      cx += w;
    }
    // re-round the outer corners by overlaying rounded stroke
    pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0);
    return h;
  };

  // ── Canonical decision legend (the ONE customer decision vocabulary) ──
  const decisionLegend = (counts: Record<DecisionState, number>) => {
    for (const d of DEC_ORDER) {
      space(5.5);
      setFill(DEC_RGB[d]); pdf.circle(M + 1.6, y - 1.2, 1.4, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); setText(INK);
      const label = latin1(decLabel(d));
      pdf.text(label, M + 5, y);
      const lw = pdf.getTextWidth(label);
      pdf.setFont("helvetica", "normal"); setText(MUTE);
      pdf.text(latin1(` (${counts[d]}) - ${DEC_MEANING[d]}`), M + 5 + lw, y);
      y += 5.2;
    }
  };

  // A compact stat chip row (truthful counts only).
  const statRow = (stats: Array<{ label: string; value: string }>) => {
    const gapx = 3, n = stats.length, cw = (CW - gapx * (n - 1)) / n;
    space(16);
    for (let i = 0; i < n; i++) {
      const x = M + i * (cw + gapx);
      setFill(PANEL); setDraw(LINE); pdf.setLineWidth(0.2); pdf.roundedRect(x, y, cw, 13, 1.4, 1.4, "FD");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); setText(INK); pdf.text(latin1(stats[i].value), x + 3, y + 6.4);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.2); setText(MUTE);
      const lines = pdf.splitTextToSize(latin1(stats[i].label), cw - 6) as string[];
      pdf.text(lines[0] ?? "", x + 3, y + 10.6);
    }
    y += 16;
  };

  // ══════════════════════════════ COVER (page 1) ══════════════════════════════
  const tierId = TIER_IDENTITY_L[es ? "es" : "en"];
  const identity = tierId[tierLabel] ?? tierId.Intelligence;
  const p = doc.portfolioSynthesis;
  {
    // top accent band
    setFill(INK_DK); pdf.rect(0, 0, W, 3, "F");
    setFill(SKY); pdf.rect(0, 0, W * 0.42, 3, "F");
    // brand lockup
    brandMark(M, 24, 9);
    wordmark(M + 12, 31, 20);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); setText(MUTE);
    pdf.text(latin1(L.aoiEyebrow), M + 12.3, 36.2);

    // tier eyebrow chip
    let cy = 72;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    const eyeW = pdf.getTextWidth(identity.eyebrow) + 8;
    setFill(SKY); pdf.roundedRect(M, cy - 5.2, eyeW, 7.4, 1.4, 1.4, "F");
    setText([255, 255, 255]); pdf.text(identity.eyebrow, M + 4, cy);
    cy += 14;

    // title
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(30); setText(INK_DK);
    const titleLines = pdf.splitTextToSize(latin1(doc.headline ?? "Opportunity Portfolio"), CW) as string[];
    for (const ln of titleLines.slice(0, 3)) { pdf.text(ln, M, cy); cy += 11.5; }
    cy += 2;
    // meta (wrap within content width so a long client/market never clips at the page edge)
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); setText(MUTE);
    const meta = [doc.meta.client, doc.meta.market, doc.meta.generatedLabel].filter(Boolean).map(latin1).join("   -   ");
    if (meta) { for (const ln of pdf.splitTextToSize(meta, CW) as string[]) { pdf.text(ln, M, cy); cy += 6; } cy += 4; }

    // decision headline + distribution bar (immediate portfolio understanding)
    const total = p.total || doc.accounts.length;
    if (total > 0) {
      cy += 4;
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); setText(SUB);
      pdf.text(latin1(`${L.accountsWord(total)} - ${L.toPrioritize(p.counts.prioritize)}, ${L.toValidate(p.counts.validate)}`), M, cy);
      cy += 6;
      distributionBar(M, cy, CW, p.counts, total);
      cy += 10;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); setText(MUTE);
      const legend = DEC_ORDER.filter((d) => p.counts[d] > 0).map((d) => `${decLabel(d)} ${p.counts[d]}`).join("    ");
      pdf.text(latin1(legend), M, cy);
    }

    // cover footer: kind + scope
    setFill(PANEL); pdf.rect(0, H - 34, W, 34, "F");
    setDraw(LINE); pdf.setLineWidth(0.2); pdf.line(0, H - 34, W, H - 34);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5); setText(INK);
    pdf.text(latin1(identity.kind), M, H - 22);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); setText(MUTE);
    pdf.text(latin1(doc.summary ? firstSentence(doc.summary, 200) : L.preparedBy), M, H - 16, { maxWidth: CW } as never);
  }

  // ══════════════════════════════ CONTENT (page 2+) ══════════════════════════════
  newPage();

  // ── Executive summary (decision-first) ──
  if (s.header) {
    band(L.execSummary);
    if (doc.summary) text(doc.summary, M, 10, "normal", SUB);
    gap(1);
    const total = p.total || doc.accounts.length;
    if (total > 0) {
      text(L.decisionDistribution, M, 8.5, "bold", [51, 65, 85]);
      gap(1);
      distributionBar(M, y, CW, p.counts, total); y += 9;
      decisionLegend(p.counts);
      gap(1);
      // where attention goes first — canonical decisions + company names (no competing status vocabulary)
      const focusFirst = [...doc.accounts]
        .filter((a) => a.decision === "prioritize" || a.decision === "validate")
        .slice(0, 4).map((a) => latin1(a.company));
      if (focusFirst.length) text(`${L.whereAttentionFirst}: ${focusFirst.join(", ")}`, M, 9.5, "bold", INK);
      if (p.allocation?.line) text(latin1(`${p.allocation.line}${p.allocation.detail ? ` ${sanitizeAllocation(p.allocation.detail)}` : ""}`), M, 9, "normal", SUB);
    }
  }

  // ── Commercial context ──
  if (s.commercialContext && doc.commercialContext) {
    const c = doc.commercialContext;
    band(L.commercialContext);
    if (c.objective) text(`${L.objective}: ${c.objective}`, M, 9.5, "bold", INK);
    if (c.summary) text(c.summary, M, 9.5, "normal", SUB);
    const facets = [c.regions.length ? `${L.regions}: ${c.regions.join(", ")}` : "", c.industries.length ? `${L.sectors}: ${c.industries.join(", ")}` : ""].filter(Boolean);
    if (facets.length) text(facets.join("     "), M, 8.5, "normal", MUTE);
  }

  // ── Portfolio (table + coverage stats = portfolio-level understanding) ──
  if (s.portfolioSynthesis && doc.accounts.length) {
    band(L.portfolio);
    if (doc.coverage) statRow([
      { label: L.accountsEvaluated, value: String(p.total || doc.accounts.length) },
      { label: L.withSources, value: String(doc.coverage.withSources) },
      { label: L.datedEvidence, value: String(doc.coverage.withDatedEvidence) },
      { label: L.corroborated, value: String(doc.coverage.corroborated) },
    ]);
    // segment tally (truthful: counts of accounts by segment)
    const bySeg = new Map<string, number>();
    for (const a of doc.accounts) { const key = a.segment ?? (es ? "Sin segmento" : "Unsegmented"); bySeg.set(key, (bySeg.get(key) ?? 0) + 1); }
    if (bySeg.size > 1) {
      const segLine = Array.from(bySeg.entries()).sort((x, z) => z[1] - x[1]).slice(0, 6).map(([k, v]) => `${latin1(k)} ${v}`).join("    ");
      text(`${L.bySegment}: ${segLine}`, M, 8.5, "normal", MUTE);
      gap(1);
    }
    gap(1);
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: [30, 41, 59], lineColor: [232, 238, 245], lineWidth: 0.1 },
      headStyles: { fillColor: INK_DK, textColor: 255, fontStyle: "bold", cellPadding: 2.2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 8, halign: "right" }, 2: { fontStyle: "bold" } },
      head: [L.tableHead],
      body: doc.accounts.map((a, i) => [String(a.rank ?? i + 1), latin1(a.company), decLabel(a.decision), locStrength(dimensionValue(a, "Fit"), es) ?? "-", locStrength(dimensionValue(a, "Timing"), es) ?? "-", locStrength(dimensionValue(a, "Evidence"), es) ?? "-"]),
      didParseCell: (data: import("jspdf-autotable").CellHookData) => {
        if (data.section === "body" && data.column.index === 2) {
          const a = doc.accounts[data.row.index]; if (a) data.cell.styles.textColor = DEC_RGB[a.decision] as unknown as number;
        }
      },
    });
    // @ts-expect-error jspdf-autotable augments lastAutoTable at runtime
    y = (pdf.lastAutoTable?.finalY ?? y) + 4;
    if (p.note) text(latin1(p.note), M, 8, "normal", MUTE);
    // Fit × Timing scatter — the signature portfolio visual, matching the web report. Only when there
    // are enough accounts to be meaningful (Preview's 2 don't warrant a scatter; §39).
    if (doc.accounts.length >= 4) fitTimingChart();
  }

  // ══ Premium — Decision Context dossier (premium tier only) ══
  if (s.premiumArchitecture && doc.premium && doc.premium.executivePortfolio.total > 0) {
    premiumDecisionContext();
  }

  // ── Opportunity Cases (accounts) ──
  if (s.accounts && doc.accounts.length) {
    band(L.opportunityCases);
    for (const a of doc.accounts) accountCase(a, s);
  }

  // ── Validation queue ──
  if (s.validationQueue && doc.validationQueue.length) {
    band(L.validationQueue);
    for (const q of doc.validationQueue) {
      space(6);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); setText(INK);
      pdf.text(latin1(q.company), M, y);
      const cw = pdf.getTextWidth(latin1(q.company));
      pdf.setFont("helvetica", "normal"); setText(DEC_RGB[q.decision]); pdf.setFontSize(7.5);
      pdf.text(latin1(decLabel(q.decision).toUpperCase()), M + cw + 3, y);
      y += 4;
      text(q.items.map(latin1).join("; "), M + 2, 8.5, "normal", SUB);
      gap(0.5);
    }
  }
  // ── Coverage / methodology / limitations ──
  if (s.coverage && doc.coverage) { band(L.evidenceCoverage); text(`${doc.coverage.withSources} ${L.withSources.toLowerCase()}, ${doc.coverage.withDatedEvidence} ${L.dated}, ${doc.coverage.corroborated} ${L.corroborated.toLowerCase()}${doc.coverage.grade ? `, ${L.overall} ${locStrength(doc.coverage.grade, es)}` : ""}.`, M, 9.5, "normal", SUB); if (doc.coverage.note) text(latin1(doc.coverage.note), M, 8.5, "normal", MUTE); }
  if (s.methodology && doc.methodology.length) { band(L.methodology); bullets("", doc.methodology); }
  if (s.limitations && doc.limitations.length) { band(L.limitations); bullets("", doc.limitations, MUTE); }

  // ── Footers (content pages only; cover stays clean) ──
  const pages = pdf.getNumberOfPages();
  for (let i = 2; i <= pages; i++) footer(i, pages);

  return Buffer.from(pdf.output("arraybuffer"));

  // ───────────────────────────── inner renderers ─────────────────────────────
  function premiumDecisionContext() {
    const ep = doc.premium!.executivePortfolio;
    const companyOf = new Map(ep.priorityMap.map((pm2) => [pm2.accountId, pm2.company]));
    const names = (ids: string[]) => ids.map((id) => latin1(companyOf.get(id) ?? id)).join(", ");

    // Distinct dossier divider so Premium does NOT read as "the same PDF but longer".
    space(30); gap(4);
    setFill(INK_DK); pdf.rect(M, y, CW, 15, "F");
    setFill(SKY); pdf.rect(M, y, 2.4, 15, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); setText([255, 255, 255]);
    pdf.text(latin1(L.decisionContext), M + 6, y + 6.4);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); setText([203, 213, 225]);
    pdf.text(latin1(L.decisionContextSub), M + 6, y + 11);
    y += 21;

    // Executive context. NOTE: the synthesis text (cluster keys, tension notes, scope note) is produced
    // by the FROZEN premium-decision-architecture in canonical English. We do not modify that layer; we
    // present it better here — decision cluster keys use the localized decision label, and the known
    // frozen template strings are localized + GROUPED so one shared pattern lists its companies once
    // (§45) instead of repeating an identical bullet per company.
    text(L.executiveContext, M, 10.5, "bold", INK);
    if (ep.topOpportunities.length) text(`${L.whereAttentionFirst}: ${names(ep.topOpportunities)}`, M, 9.5, "bold", SUB);
    if (ep.synthesis.clusters.length) text(`${L.portfolioPatterns}: ${ep.synthesis.clusters.map((c) => `${latin1(c.kind === "decision" ? decLabel(c.key as DecisionState) : c.key)} (${c.accountIds.length})`).join("    ")}`, M, 9, "normal", SUB);
    if (ep.synthesis.contradictions.length) {
      const byNote = new Map<string, string[]>();
      for (const c of ep.synthesis.contradictions) {
        const co = companyOf.get(c.accountId) ?? c.accountId;
        if (!byNote.has(c.note)) byNote.set(c.note, []);
        byNote.get(c.note)!.push(co);
      }
      const tensionLines = Array.from(byNote.entries()).map(([note, cos]) => `${locFrozen(note, es)} (${cos.length}): ${cos.map(latin1).join(", ")}`);
      bullets(L.tensionsToResolve, tensionLines, [217, 119, 6]);
    }
    if (ep.validationPriorities.length) bullets(L.validationPriorities, ep.validationPriorities.slice(0, 6).map(latin1));
    text(latin1(locFrozen(ep.synthesis.scopeNote, es)), M, 8, "normal", MUTE);

    // Commercial context / benchmark — only when the snapshot carries it (zero-result stays professional).
    const ctx = ep.context;
    if (ctx && ctx.benchmark.state === "PRESENT") {
      band(L.commercialContext, SKY);
      const notes = [...ctx.benchmark.recurringNeeds, ...ctx.benchmark.offerPositioning, ...ctx.benchmark.differentiatedWhere];
      bullets(L.whatContextShows, notes.slice(0, 6).map((n) => `${latin1(n.statement)}${n.stale ? L.olderEvidence : ""}`));
      if (ctx.competitors.length) text(`${L.relevantAlternatives}: ${ctx.competitors.map((c) => latin1(c.entity)).join(", ")}`, M, 9, "bold", SUB);
      if (ctx.additionalOpportunities.length) text(`${L.additionalOpportunities}: ${ctx.additionalOpportunities.map((o) => latin1(o.entity)).join(", ")}`, M, 9, "normal", SUB);
      if (ctx.ecosystem.length) text(`${L.ecosystemRoutes}: ${ctx.ecosystem.map((e) => latin1(e.entity)).join(", ")}`, M, 9, "normal", SUB);
      text(latin1(ctx.benchmark.scopeNote), M, 8, "normal", MUTE);
    } else {
      band(L.commercialContext, SKY);
      text(L.noCommercialContext, M, 9, "normal", MUTE);
    }

    // Decision-critical briefs — premium card presentation.
    const briefs = doc.premium!.decisionCriticalBriefs;
    if (briefs.length) {
      band(L.decisionCriticalBriefs, SKY);
      for (const b of briefs) briefCard(b);
    }
  }

  function briefCard(b: NonNullable<typeof doc.premium>["decisionCriticalBriefs"][number]) {
    // measure-ish: reserve space; jsPDF has no auto-measure so we guard page breaks per line.
    space(34); gap(1.5);
    const top = y - 4.5;
    // left accent + company + decision chip
    setFill(DEC_RGB[b.decision]); pdf.rect(M, top, 1.6, 6, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); setText(INK);
    pdf.text(latin1(b.company), M + 4, y);
    const chip = latin1(decLabel(b.decision).toUpperCase());
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
    const cwid = pdf.getTextWidth(chip) + 6;
    setFill(DEC_RGB[b.decision]); pdf.roundedRect(W - M - cwid, top, cwid, 6, 1.2, 1.2, "F");
    setText([255, 255, 255]); pdf.text(chip, W - M - cwid + 3, top + 4.2);
    y += 4.5;
    if (b.whyMatters) text(b.whyMatters, M + 4, 9, "normal", SUB, CW - 4);
    if (b.whyNow) { pdf.setFont("helvetica", "bold"); text(`${L.whyNow}: ${b.whyNow}`, M + 4, 9, "bold", INK, CW - 4); }
    if (b.validationPriority.length) bullets(L.whatToValidateNext, b.validationPriority.map(latin1));
    if (b.pathway.state === "OPEN" && b.whatCouldChange) text(`${L.whatCouldChange}: ${b.whatCouldChange}`, M + 4, 8.5, "normal", MUTE, CW - 4);
    gap(2.5);
  }

  function accountCase(a: AccountBriefVM, sec: typeof s) {
    // Keep the company header with its first lines (reserve room so it never orphans at a page bottom).
    space(46); gap(6);
    // Per-company divider so each dossier reads as a deliberate, distinct unit (premium separation).
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]); pdf.setLineWidth(0.3); pdf.line(M, y - 3, W - M, y - 3);
    gap(3);
    // Tinted header strip behind the company row.
    const stripTop = y - 4.6, stripH = 8.6;
    setFill(PANEL); pdf.rect(M, stripTop, CW, stripH, "F");
    setFill(DEC_RGB[a.decision]); pdf.rect(M, stripTop, 1.8, stripH, "F");   // decision accent bar
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12.5); setText(INK);
    pdf.text(latin1(`${a.rank != null ? `${a.rank}. ` : ""}${a.company}`), M + 4.5, y + 0.6);
    const chip = latin1(decLabel(a.decision).toUpperCase());
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
    const cwid = pdf.getTextWidth(chip) + 6;
    setFill(DEC_RGB[a.decision]); pdf.roundedRect(W - M - cwid - 1.5, stripTop + 1.4, cwid, 5.8, 1.2, 1.2, "F");
    setText([255, 255, 255]); pdf.text(chip, W - M - cwid + 1.5, stripTop + 5.4);
    y += stripH - 2.2;
    const sub = [a.segment, a.geography, a.accountRole, a.opportunityType].filter(Boolean).map((v) => latin1(String(v))).join("   -   ");
    if (sub) text(sub, M + 4, 8, "normal", MUTE);
    gap(1);
    if (a.decisionNote) text(`${L.why}: ${a.decisionNote}`, M + 4, 9.5, "normal", SUB, CW - 4);
    if (sec.accountDimensions && a.dimensions.length) {
      // Fit / Timing / Evidence inline chips — label + value both localized for display.
      gap(2); space(7); let cx = M + 4;
      const dimLoc: Record<string, string> = es ? { Fit: "Encaje", Timing: "Momento", Evidence: "Evidencia" } : {};
      for (const d of a.dimensions) {
        const label = latin1(`${dimLoc[d.label] ?? d.label}: ${locStrength(d.value, es) ?? d.value}`);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
        const wch = pdf.getTextWidth(label) + 6;
        setFill([237, 242, 248]); setDraw(LINE); pdf.setLineWidth(0.15); pdf.roundedRect(cx, y - 3.4, wch, 5.4, 1.1, 1.1, "FD");
        setText(SUB); pdf.text(label, cx + 3, y);
        cx += wch + 2.5;
      }
      y += 5;
    }
    if (sec.accountThesis && a.thesis) text(a.thesis, M + 4, 9.5, "normal", SUB, CW - 4);
    if (sec.accountEvidence) text(`${L.evidence}: ${L.source(a.evidence.sourceCount)}, ${a.evidence.datedCount} ${L.dated}${a.evidence.latestAge ? `, ${L.latest} ${a.evidence.latestAge}` : ""}${a.evidence.strength ? `, ${locStrength(a.evidence.strength, es)}` : ""}`, M + 4, 8.5, "normal", MUTE, CW - 4);
    if (sec.accountWhatChanged) bullets(L.whatChanged, a.whatChanged.map((c) => `${latin1(c.event)}${c.date ? ` (${c.date})` : ""}`));
    if (sec.accountCounterSignals) bullets(L.counterSignals, a.counterSignals.map(latin1), [217, 119, 6]);
    if (sec.accountValidations) bullets(L.validateBeforeActing, a.validations.map(latin1));
    if (sec.accountSources) bullets(L.sources, a.sources.map((src) => `${latin1(src.label)}${src.date ? ` (${src.date})` : ""}${src.url ? ` - ${latin1(src.url)}` : ""}`));
    if (sec.accountNextStep && a.nextStep) text(`${L.nextStep}: ${a.nextStep}`, M + 4, 9.5, "bold", INK, CW - 4);
    gap(2.5);
  }

  // Fit × Timing scatter (vector; selectable text). Positions each account by the ORDINAL strength of
  // its fit (x) against its timing (y) — the exact strengths Research already produced, never a
  // fabricated numeric score. Each point carries the account's RANK NUMBER (matching the "#" column of
  // the Portfolio table directly above) instead of a long company label, so 12–18 accounts stay legible
  // and nothing collides. Colour follows the canonical decision (never the only signal — the number
  // identifies the account and the axes are named). Accounts missing either strength are listed
  // honestly as "not positioned" rather than dropped at a made-up coordinate.
  function fitTimingChart() {
    const es = doc.meta.language === "es";
    const rankOf = (a: AccountBriefVM, labels: string[]): number | null => {
      const v = a.dimensions.find((d) => labels.includes(d.label))?.value;
      return v === "Strong" ? 3 : v === "Moderate" ? 2 : v === "Limited" ? 1 : null;
    };
    const placed = doc.accounts
      .map((a, i) => ({ a, n: a.rank ?? i + 1, fx: rankOf(a, ["Fit", "Encaje"]), ty: rankOf(a, ["Timing", "Momento"]) }))
      .filter((r): r is { a: AccountBriefVM; n: number; fx: number; ty: number } => r.fx != null && r.ty != null);
    if (placed.length < 4) return;
    const missing = doc.accounts.filter((a) => !placed.some((p2) => p2.a.id === a.id));

    band(es ? "Encaje x Momento" : "Fit x Timing", SKY);
    text(es ? "Cada punto es una cuenta, ubicada por la fuerza de su encaje y de su momento; el número corresponde a la tabla anterior."
           : "Each point is an account, placed by the strength of its fit and timing; the number matches the table above.", M, 7.6, "normal", MUTE);
    gap(1);
    space(72);
    const plotX = M + 14, plotW = 92, plotTop = y + 2, plotH = 50;
    const padIn = 6; // keep extreme points off the axes/title
    const ticks = es ? ["Limitado", "Moderado", "Fuerte"] : ["Limited", "Moderate", "Strong"];
    const xAt = (v: number) => plotX + padIn + ((v - 1) / 2) * (plotW - 2 * padIn);
    const yAt = (v: number) => plotTop + padIn + (1 - (v - 1) / 2) * (plotH - 2 * padIn);
    // gridlines
    setDraw([238, 242, 246]); pdf.setLineWidth(0.2);
    for (const v of [1, 2, 3]) { pdf.line(xAt(v), plotTop, xAt(v), plotTop + plotH); pdf.line(plotX, yAt(v), plotX + plotW, yAt(v)); }
    // axes
    setDraw(FAINT); pdf.setLineWidth(0.3);
    pdf.line(plotX, plotTop + plotH, plotX + plotW, plotTop + plotH);
    pdf.line(plotX, plotTop, plotX, plotTop + plotH);
    // tick labels
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.2); setText(MUTE);
    for (let i = 0; i < 3; i++) {
      pdf.text(latin1(ticks[i]), xAt(i + 1), plotTop + plotH + 3.4, { align: "center" } as never);
      pdf.text(latin1(ticks[i]), plotX - 2, yAt(i + 1) + 1, { align: "right" } as never);
    }
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(6.8); setText(INK);
    pdf.text(latin1(es ? "Encaje ->" : "Fit ->"), plotX + plotW / 2, plotTop + plotH + 7, { align: "center" } as never);
    pdf.text(latin1(es ? "Momento ->" : "Timing ->"), plotX - 9, plotTop + plotH / 2, { align: "center", angle: 90 } as never);
    // points — numbered dots (jitter co-located cells)
    const cell = new Map<string, number>();
    for (const pnt of placed) {
      const key = `${pnt.fx}-${pnt.ty}`; const k = cell.get(key) ?? 0; cell.set(key, k + 1);
      const ang = k * 2.3, rad = k === 0 ? 0 : 3 + k * 0.9;
      const cx = xAt(pnt.fx) + Math.cos(ang) * rad, cy = yAt(pnt.ty) + Math.sin(ang) * rad;
      setFill(DEC_RGB[pnt.a.decision]); setDraw([255, 255, 255]); pdf.setLineWidth(0.4);
      pdf.circle(cx, cy, 2.3, "FD");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(6); setText([255, 255, 255]);
      pdf.text(String(pnt.n), cx, cy + 1.05, { align: "center" } as never);
    }
    // legend (right of plot)
    let ly = plotTop + 3; const lx = plotX + plotW + 10;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(6.6); setText(MUTE); pdf.text(latin1(es ? "Decision" : "Decision"), lx, ly); ly += 4.4;
    for (const d of DEC_ORDER) {
      setFill(DEC_RGB[d]); pdf.circle(lx + 1.2, ly - 1, 1.3, "F");
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.6); setText(INK);
      pdf.text(latin1(es ? DECISION_TOKENS[d].labelEs : DECISION_TOKENS[d].label), lx + 3.8, ly); ly += 4.1;
    }
    y = plotTop + plotH + 10;
    if (missing.length) text(latin1(`${es ? "Sin posicionar (encaje o momento no evaluado): " : "Not positioned (fit or timing not evaluated): "}${missing.map((a) => a.company).join(", ")}`), M, 7.5, "normal", MUTE);
    gap(2);
  }
}

function truncate(s: string, n: number): string { const t = s.trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; }
// A clean, complete opening for the cover teaser: the first sentence when it fits, else a tidy trim —
// never a mid-word cut ending in an ellipsis (§29).
function firstSentence(s: string, max: number): string {
  const t = s.trim();
  const dot = t.indexOf(". ");
  if (dot > 0 && dot + 1 <= max) return t.slice(0, dot + 1);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + ".";
}
// Keep the allocation line in the canonical Decision vocabulary — strip any competing status labels
// (act now / investigate / reserve / reject) so the customer never sees two decision systems.
function sanitizeAllocation(detail: string): string {
  return detail.replace(/\b(act now|investigate|reserve|reject)\b/gi, (m) => ({ "act now": "prioritize", investigate: "validate", reserve: "monitor", reject: "hold" } as Record<string, string>)[m.toLowerCase()] ?? m);
}
