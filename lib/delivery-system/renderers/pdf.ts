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
// jsPDF's built-in fonts are Latin-1; normalize so accents/arrows/dashes render instead of tofu.
function ascii(v: string | number | null | undefined): string {
  return String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[—–]/g, "-").replace(/→/g, "->").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

// ── Palette (from the repo brand: sky accent #0284c7/#0ea5e9, slate ink) ──
const INK: RGB = [15, 23, 42], SUB: RGB = [51, 65, 85], MUTE: RGB = [100, 116, 139], FAINT: RGB = [148, 163, 184];
const LINE: RGB = [226, 232, 240], PANEL: RGB = [246, 249, 252], SKY: RGB = [2, 132, 199], SKY_LT: RGB = [14, 165, 233], INK_DK: RGB = [11, 18, 32];
const DEC_RGB: Record<DecisionState, RGB> = { prioritize: [2, 132, 199], validate: [217, 119, 6], monitor: [71, 85, 105], hold: [148, 163, 184] };
// Plain-language meaning — the SINGLE customer decision vocabulary (canonical Decisions only).
const DEC_MEANING: Record<DecisionState, string> = {
  prioritize: "Strongest case for attention now",
  validate: "Promising - a decision-critical question still needs confirming",
  monitor: "Relevant, but timing or evidence is not strong enough yet",
  hold: "Not enough evidence to justify attention now",
};
const DEC_ORDER: DecisionState[] = ["prioritize", "validate", "monitor", "hold"];

const M = 16;              // page margin (mm)
const W = 210, H = 297;    // A4
const CW = W - 2 * M;      // content width

// Customer-facing tier identity for the cover (maps the internal tierLabel → product identity).
const TIER_IDENTITY: Record<string, { eyebrow: string; kind: string }> = {
  Preview: { eyebrow: "PREVIEW", kind: "Opportunity preview" },
  Brief: { eyebrow: "OPPORTUNITY BRIEF", kind: "Focused shortlist brief" },
  Intelligence: { eyebrow: "OPPORTUNITY PORTFOLIO", kind: "Executive portfolio intelligence" },
  Premium: { eyebrow: "COMMERCIAL INTELLIGENCE DOSSIER", kind: "Portfolio intelligence + decision context" },
};

export function renderPdfBuffer(pm: PresentationModel): Buffer {
  const { document: doc, policy, tierLabel } = pm;
  const s = policy.sections;
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  let y = M;

  // ── Low-level helpers ──
  const setFill = (c: RGB) => pdf.setFillColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => pdf.setDrawColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => pdf.setTextColor(c[0], c[1], c[2]);
  const space = (need: number) => { if (y + need > H - 16) { newPage(); } };
  const text = (str: string, x: number, size: number, style: "normal" | "bold" = "normal", color: RGB = INK, maxW = CW) => {
    pdf.setFont("helvetica", style); pdf.setFontSize(size); setText(color);
    const lines = pdf.splitTextToSize(ascii(str), maxW) as string[];
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
    pdf.text("Account Opportunity Intelligence - confidential", M + 6 + lw + pdf.getTextWidth("Lens") + 3, H - 7.2);
    pdf.text(`${pageIndex - 1} / ${total - 1}`, W - M, H - 7.2, { align: "right" });
  };

  const newPage = () => { pdf.addPage(); y = M + 2; };

  // ── Section band (premium-feeling header) ──
  const band = (label: string, accent: RGB = SKY) => {
    space(16); gap(4);
    setFill(accent); pdf.rect(M, y - 3.4, 1.6, 5.2, "F");           // accent tick
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12.5); setText(INK);
    pdf.text(ascii(label), M + 4, y + 0.8);
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
      const label = ascii(DECISION_TOKENS[d].label);
      pdf.text(label, M + 5, y);
      const lw = pdf.getTextWidth(label);
      pdf.setFont("helvetica", "normal"); setText(MUTE);
      pdf.text(ascii(` (${counts[d]}) - ${DEC_MEANING[d]}`), M + 5 + lw, y);
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
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); setText(INK); pdf.text(ascii(stats[i].value), x + 3, y + 6.4);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.2); setText(MUTE);
      const lines = pdf.splitTextToSize(ascii(stats[i].label), cw - 6) as string[];
      pdf.text(lines[0] ?? "", x + 3, y + 10.6);
    }
    y += 16;
  };

  // ══════════════════════════════ COVER (page 1) ══════════════════════════════
  const identity = TIER_IDENTITY[tierLabel] ?? TIER_IDENTITY.Intelligence;
  const p = doc.portfolioSynthesis;
  {
    // top accent band
    setFill(INK_DK); pdf.rect(0, 0, W, 3, "F");
    setFill(SKY); pdf.rect(0, 0, W * 0.42, 3, "F");
    // brand lockup
    brandMark(M, 24, 9);
    wordmark(M + 12, 31, 20);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); setText(MUTE);
    pdf.text("ACCOUNT OPPORTUNITY INTELLIGENCE", M + 12.3, 36.2);

    // tier eyebrow chip
    let cy = 72;
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
    const eyeW = pdf.getTextWidth(identity.eyebrow) + 8;
    setFill(SKY); pdf.roundedRect(M, cy - 5.2, eyeW, 7.4, 1.4, 1.4, "F");
    setText([255, 255, 255]); pdf.text(identity.eyebrow, M + 4, cy);
    cy += 14;

    // title
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(30); setText(INK_DK);
    const titleLines = pdf.splitTextToSize(ascii(doc.headline ?? "Opportunity Portfolio"), CW) as string[];
    for (const ln of titleLines.slice(0, 3)) { pdf.text(ln, M, cy); cy += 11.5; }
    cy += 2;
    // meta
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(11); setText(MUTE);
    const meta = [doc.meta.client, doc.meta.market, doc.meta.generatedLabel].filter(Boolean).map(ascii).join("   -   ");
    if (meta) { pdf.text(meta, M, cy); cy += 10; }

    // decision headline + distribution bar (immediate portfolio understanding)
    const total = p.total || doc.accounts.length;
    if (total > 0) {
      cy += 4;
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); setText(SUB);
      const focus = p.counts.prioritize + p.counts.validate;
      pdf.text(ascii(`${total} account${total === 1 ? "" : "s"} evaluated - ${p.counts.prioritize} to prioritize, ${p.counts.validate} to validate`), M, cy);
      cy += 6;
      distributionBar(M, cy, CW, p.counts, total);
      cy += 10;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); setText(MUTE);
      const legend = DEC_ORDER.filter((d) => p.counts[d] > 0).map((d) => `${DECISION_TOKENS[d].label} ${p.counts[d]}`).join("    ");
      pdf.text(ascii(legend), M, cy);
      void focus;
    }

    // cover footer: kind + scope
    setFill(PANEL); pdf.rect(0, H - 34, W, 34, "F");
    setDraw(LINE); pdf.setLineWidth(0.2); pdf.line(0, H - 34, W, H - 34);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5); setText(INK);
    pdf.text(ascii(identity.kind), M, H - 22);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); setText(MUTE);
    pdf.text(ascii(doc.summary ? truncate(doc.summary, 180) : "Prepared by LeadLens - Account Opportunity Intelligence."), M, H - 16, { maxWidth: CW } as never);
  }

  // ══════════════════════════════ CONTENT (page 2+) ══════════════════════════════
  newPage();

  // ── Executive summary (decision-first) ──
  if (s.header) {
    band("Executive summary");
    if (doc.summary) text(doc.summary, M, 10, "normal", SUB);
    gap(1);
    const total = p.total || doc.accounts.length;
    if (total > 0) {
      text("Decision distribution", M, 8.5, "bold", [51, 65, 85]);
      gap(1);
      distributionBar(M, y, CW, p.counts, total); y += 9;
      decisionLegend(p.counts);
      gap(1);
      // where attention goes first — canonical decisions + company names (no competing status vocabulary)
      const focusFirst = [...doc.accounts]
        .filter((a) => a.decision === "prioritize" || a.decision === "validate")
        .slice(0, 4).map((a) => ascii(a.company));
      if (focusFirst.length) text(`Where attention goes first: ${focusFirst.join(", ")}`, M, 9.5, "bold", INK);
      if (p.allocation?.line) text(ascii(`${p.allocation.line}${p.allocation.detail ? ` ${sanitizeAllocation(p.allocation.detail)}` : ""}`), M, 9, "normal", SUB);
    }
  }

  // ── Commercial context ──
  if (s.commercialContext && doc.commercialContext) {
    const c = doc.commercialContext;
    band("Commercial context");
    if (c.objective) text(`Objective: ${c.objective}`, M, 9.5, "bold", INK);
    if (c.summary) text(c.summary, M, 9.5, "normal", SUB);
    const facets = [c.regions.length ? `Regions: ${c.regions.join(", ")}` : "", c.industries.length ? `Sectors: ${c.industries.join(", ")}` : ""].filter(Boolean);
    if (facets.length) text(facets.join("     "), M, 8.5, "normal", MUTE);
  }

  // ── Portfolio (table + coverage stats = portfolio-level understanding) ──
  if (s.portfolioSynthesis && doc.accounts.length) {
    band("Portfolio");
    if (doc.coverage) statRow([
      { label: "Accounts evaluated", value: String(p.total || doc.accounts.length) },
      { label: "With sources", value: String(doc.coverage.withSources) },
      { label: "Dated evidence", value: String(doc.coverage.withDatedEvidence) },
      { label: "Corroborated", value: String(doc.coverage.corroborated) },
    ]);
    // segment tally (truthful: counts of accounts by segment)
    const bySeg = new Map<string, number>();
    for (const a of doc.accounts) { const key = a.segment ?? "Unsegmented"; bySeg.set(key, (bySeg.get(key) ?? 0) + 1); }
    if (bySeg.size > 1) {
      const segLine = Array.from(bySeg.entries()).sort((x, z) => z[1] - x[1]).slice(0, 6).map(([k, v]) => `${ascii(k)} ${v}`).join("    ");
      text(`By segment: ${segLine}`, M, 8.5, "normal", MUTE);
      gap(1);
    }
    gap(1);
    autoTable(pdf, {
      startY: y, margin: { left: M, right: M }, styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2, textColor: [30, 41, 59], lineColor: [232, 238, 245], lineWidth: 0.1 },
      headStyles: { fillColor: INK_DK, textColor: 255, fontStyle: "bold", cellPadding: 2.2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 8, halign: "right" }, 2: { fontStyle: "bold" } },
      head: [["#", "Company", "Decision", "Fit", "Timing", "Evidence"]],
      body: doc.accounts.map((a, i) => [String(a.rank ?? i + 1), ascii(a.company), DECISION_TOKENS[a.decision].label, dimensionValue(a, "Fit") ?? "-", dimensionValue(a, "Timing") ?? "-", dimensionValue(a, "Evidence") ?? "-"]),
      didParseCell: (data: import("jspdf-autotable").CellHookData) => {
        if (data.section === "body" && data.column.index === 2) {
          const a = doc.accounts[data.row.index]; if (a) data.cell.styles.textColor = DEC_RGB[a.decision] as unknown as number;
        }
      },
    });
    // @ts-expect-error jspdf-autotable augments lastAutoTable at runtime
    y = (pdf.lastAutoTable?.finalY ?? y) + 4;
    if (p.note) text(ascii(p.note), M, 8, "normal", MUTE);
  }

  // ══ Premium — Decision Context dossier (premium tier only) ══
  if (s.premiumArchitecture && doc.premium && doc.premium.executivePortfolio.total > 0) {
    premiumDecisionContext();
  }

  // ── Opportunity Cases (accounts) ──
  if (s.accounts && doc.accounts.length) {
    band("Opportunity cases");
    for (const a of doc.accounts) accountCase(a, s);
  }

  // ── Validation queue ──
  if (s.validationQueue && doc.validationQueue.length) {
    band("Validation queue");
    for (const q of doc.validationQueue) {
      space(6);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); setText(INK);
      pdf.text(ascii(q.company), M, y);
      const cw = pdf.getTextWidth(ascii(q.company));
      pdf.setFont("helvetica", "normal"); setText(DEC_RGB[q.decision]); pdf.setFontSize(7.5);
      pdf.text(ascii(DECISION_TOKENS[q.decision].label.toUpperCase()), M + cw + 3, y);
      y += 4;
      text(q.items.map(ascii).join("; "), M + 2, 8.5, "normal", SUB);
      gap(0.5);
    }
  }
  // ── Coverage / methodology / limitations ──
  if (s.coverage && doc.coverage) { band("Evidence coverage"); text(`${doc.coverage.withSources} with sources, ${doc.coverage.withDatedEvidence} dated, ${doc.coverage.corroborated} corroborated${doc.coverage.grade ? `, overall ${doc.coverage.grade}` : ""}.`, M, 9.5, "normal", SUB); if (doc.coverage.note) text(ascii(doc.coverage.note), M, 8.5, "normal", MUTE); }
  if (s.methodology && doc.methodology.length) { band("Methodology"); bullets("", doc.methodology); }
  if (s.limitations && doc.limitations.length) { band("Scope & limitations"); bullets("", doc.limitations, MUTE); }

  // ── Footers (content pages only; cover stays clean) ──
  const pages = pdf.getNumberOfPages();
  for (let i = 2; i <= pages; i++) footer(i, pages);

  return Buffer.from(pdf.output("arraybuffer"));

  // ───────────────────────────── inner renderers ─────────────────────────────
  function premiumDecisionContext() {
    const ep = doc.premium!.executivePortfolio;
    const companyOf = new Map(ep.priorityMap.map((pm2) => [pm2.accountId, pm2.company]));
    const names = (ids: string[]) => ids.map((id) => ascii(companyOf.get(id) ?? id)).join(", ");

    // Distinct dossier divider so Premium does NOT read as "the same PDF but longer".
    space(30); gap(4);
    setFill(INK_DK); pdf.rect(M, y, CW, 15, "F");
    setFill(SKY); pdf.rect(M, y, 2.4, 15, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); setText([255, 255, 255]);
    pdf.text("DECISION CONTEXT", M + 6, y + 6.4);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); setText([203, 213, 225]);
    pdf.text("Premium - the commercial context around these decisions", M + 6, y + 11);
    y += 21;

    // Executive context
    text("Executive context", M, 10.5, "bold", INK);
    if (ep.topOpportunities.length) text(`Where attention goes first: ${names(ep.topOpportunities)}`, M, 9.5, "bold", SUB);
    if (ep.synthesis.clusters.length) text(`Portfolio patterns: ${ep.synthesis.clusters.map((c) => `${ascii(c.key)} (${c.accountIds.length})`).join("    ")}`, M, 9, "normal", SUB);
    if (ep.synthesis.contradictions.length) bullets("Tensions to resolve", ep.synthesis.contradictions.map((c) => `${ascii(companyOf.get(c.accountId) ?? c.accountId)}: ${ascii(c.note)}`), [217, 119, 6]);
    if (ep.validationPriorities.length) bullets("Validation priorities", ep.validationPriorities.slice(0, 6).map(ascii));
    text(ascii(ep.synthesis.scopeNote), M, 8, "normal", MUTE);

    // Commercial context / benchmark — only when the snapshot carries it (zero-result stays professional).
    const ctx = ep.context;
    if (ctx && ctx.benchmark.state === "PRESENT") {
      band("Commercial context", SKY);
      const notes = [...ctx.benchmark.recurringNeeds, ...ctx.benchmark.offerPositioning, ...ctx.benchmark.differentiatedWhere];
      bullets("What the commercial context shows", notes.slice(0, 6).map((n) => `${ascii(n.statement)}${n.stale ? " (older evidence)" : ""}`));
      if (ctx.competitors.length) text(`Relevant alternatives: ${ctx.competitors.map((c) => ascii(c.entity)).join(", ")}`, M, 9, "bold", SUB);
      if (ctx.additionalOpportunities.length) text(`Additional opportunities to investigate: ${ctx.additionalOpportunities.map((o) => ascii(o.entity)).join(", ")}`, M, 9, "normal", SUB);
      if (ctx.ecosystem.length) text(`Ecosystem routes: ${ctx.ecosystem.map((e) => ascii(e.entity)).join(", ")}`, M, 9, "normal", SUB);
      text(ascii(ctx.benchmark.scopeNote), M, 8, "normal", MUTE);
    } else {
      band("Commercial context", SKY);
      text("No additional commercial context was established from defensible public evidence for this portfolio. This is a valid result - LeadLens does not fill it with unsupported claims.", M, 9, "normal", MUTE);
    }

    // Decision-critical briefs — premium card presentation.
    const briefs = doc.premium!.decisionCriticalBriefs;
    if (briefs.length) {
      band("Decision-critical briefs", SKY);
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
    pdf.text(ascii(b.company), M + 4, y);
    const chip = ascii(DECISION_TOKENS[b.decision].label.toUpperCase());
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
    const cwid = pdf.getTextWidth(chip) + 6;
    setFill(DEC_RGB[b.decision]); pdf.roundedRect(W - M - cwid, top, cwid, 6, 1.2, 1.2, "F");
    setText([255, 255, 255]); pdf.text(chip, W - M - cwid + 3, top + 4.2);
    y += 4.5;
    if (b.whyMatters) text(b.whyMatters, M + 4, 9, "normal", SUB, CW - 4);
    if (b.whyNow) { pdf.setFont("helvetica", "bold"); text(`Why now: ${b.whyNow}`, M + 4, 9, "bold", INK, CW - 4); }
    if (b.validationPriority.length) bullets("What to validate next", b.validationPriority.map(ascii));
    if (b.pathway.state === "OPEN" && b.whatCouldChange) text(`What could change this decision: ${b.whatCouldChange}`, M + 4, 8.5, "normal", MUTE, CW - 4);
    gap(2.5);
  }

  function accountCase(a: AccountBriefVM, sec: typeof s) {
    space(30); gap(2.5);
    const top = y - 4.5;
    setFill(DEC_RGB[a.decision]); pdf.rect(M, top, 1.6, 6, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); setText(INK);
    pdf.text(ascii(`${a.rank != null ? `${a.rank}. ` : ""}${a.company}`), M + 4, y);
    const chip = ascii(DECISION_TOKENS[a.decision].label.toUpperCase());
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
    const cwid = pdf.getTextWidth(chip) + 6;
    setFill(DEC_RGB[a.decision]); pdf.roundedRect(W - M - cwid, top, cwid, 6, 1.2, 1.2, "F");
    setText([255, 255, 255]); pdf.text(chip, W - M - cwid + 3, top + 4.2);
    y += 5;
    const sub = [a.segment, a.geography].filter(Boolean).map(ascii).join("  -  ");
    if (sub) text(sub, M + 4, 8, "normal", FAINT);
    if (a.decisionNote) text(`Why: ${a.decisionNote}`, M + 4, 9.5, "normal", SUB, CW - 4);
    if (sec.accountDimensions && a.dimensions.length) {
      // Fit / Timing / Evidence inline chips
      space(6); let cx = M + 4;
      for (const d of a.dimensions) {
        const label = ascii(`${d.label} ${d.value}`);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5);
        const wch = pdf.getTextWidth(label) + 5;
        setFill([238, 242, 247]); pdf.roundedRect(cx, y - 3.2, wch, 5, 1, 1, "F");
        setText(SUB); pdf.text(label, cx + 2.5, y);
        cx += wch + 2.5;
      }
      y += 4;
    }
    if (sec.accountThesis && a.thesis) text(a.thesis, M + 4, 9.5, "normal", SUB, CW - 4);
    if (sec.accountEvidence) text(`Evidence: ${a.evidence.sourceCount} source(s), ${a.evidence.datedCount} dated${a.evidence.latestAge ? `, latest ${a.evidence.latestAge}` : ""}${a.evidence.strength ? `, ${a.evidence.strength}` : ""}`, M + 4, 8.5, "normal", MUTE, CW - 4);
    if (sec.accountWhatChanged) bullets("What changed", a.whatChanged.map((c) => `${ascii(c.event)}${c.date ? ` (${c.date})` : ""}`));
    if (sec.accountCounterSignals) bullets("Counter-signals", a.counterSignals.map(ascii), [217, 119, 6]);
    if (sec.accountValidations) bullets("Validate before acting", a.validations.map(ascii));
    if (sec.accountSources) bullets("Sources", a.sources.map((src) => `${ascii(src.label)}${src.date ? ` (${src.date})` : ""}${src.url ? ` - ${ascii(src.url)}` : ""}`));
    if (sec.accountNextStep && a.nextStep) text(`Next step: ${a.nextStep}`, M + 4, 9.5, "bold", INK, CW - 4);
    gap(2.5);
  }
}

function truncate(s: string, n: number): string { const t = s.trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; }
// Keep the allocation line in the canonical Decision vocabulary — strip any competing status labels
// (act now / investigate / reserve / reject) so the customer never sees two decision systems.
function sanitizeAllocation(detail: string): string {
  return detail.replace(/\b(act now|investigate|reserve|reject)\b/gi, (m) => ({ "act now": "prioritize", investigate: "validate", reserve: "monitor", reject: "hold" } as Record<string, string>)[m.toLowerCase()] ?? m);
}
