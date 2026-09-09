// ─── Delivery System V1 — REAL PDF renderer (application/pdf) ──────────────────────────────────
// Produces genuine PDF bytes (selectable text) from a channel="pdf" PresentationModel using jsPDF —
// the same pure-JS, Vercel-serverless-safe engine the internal pilot PDF already uses (no Chromium/
// Puppeteer). Honors ExportPolicy sections at the composed tier depth. Never invents content.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { DECISION_TOKENS } from "@/lib/deliverable/deliverable-view-model";
import type { PresentationModel } from "@/lib/delivery-system/presentation-model";
import type { AccountBriefVM, DecisionState } from "@/lib/delivery-system/delivery-document";
import { dimensionValue } from "@/lib/delivery-system/renderers/shared";

// jsPDF's built-in fonts are Latin-1; normalize so accents/arrows/dashes render instead of tofu.
function ascii(v: string | number | null | undefined): string {
  return String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[—–]/g, "-").replace(/→/g, "->").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}
const rgb: Record<DecisionState, [number, number, number]> = {
  prioritize: [3, 105, 161], validate: [180, 83, 9], monitor: [71, 85, 105], hold: [100, 116, 139],
};

const M = 16;              // page margin (mm)
const W = 210, H = 297;    // A4

export function renderPdfBuffer(pm: PresentationModel): Buffer {
  const { document: doc, policy, tierLabel } = pm;
  const s = policy.sections;
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true, putOnlyUsedFonts: true });
  let y = M;

  const space = (need: number) => { if (y + need > H - 18) { pdf.addPage(); y = M; } };
  const text = (str: string, x: number, size: number, style: "normal" | "bold" = "normal", color: [number, number, number] = [15, 23, 42], maxW = W - 2 * M) => {
    pdf.setFont("helvetica", style); pdf.setFontSize(size); pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(ascii(str), maxW) as string[];
    for (const ln of lines) { space(size * 0.5); pdf.text(ln, x, y); y += size * 0.42 + 1.2; }
  };
  const gap = (mm: number) => { y += mm; };
  const rule = () => { space(4); pdf.setDrawColor(226, 232, 240); pdf.line(M, y, W - M, y); y += 4; };
  const heading = (str: string) => { gap(3); rule(); text(str, M, 12, "bold"); gap(1); };
  const bullets = (title: string, items: string[], color: [number, number, number] = [71, 85, 105]) => {
    if (!items.length) return;
    text(title, M, 8.5, "bold", [51, 65, 85]);
    for (const it of items) text(`- ${it}`, M + 2, 9, "normal", color);
    gap(1);
  };

  // ── Header ──
  if (s.header) {
    text(`LEADLENS - ACCOUNT OPPORTUNITY INTELLIGENCE - ${tierLabel.toUpperCase()}`, M, 8, "bold", [2, 132, 199]);
    gap(1);
    text(doc.headline ?? "Opportunity Portfolio", M, 18, "bold");
    const meta = [doc.meta.client, doc.meta.market, doc.meta.generatedLabel].filter(Boolean).map(ascii).join("  -  ");
    if (meta) text(meta, M, 9, "normal", [100, 116, 139]);
    if (doc.summary) { gap(1); text(doc.summary, M, 10, "normal", [51, 65, 85]); }
    gap(2);
  }

  // ── Commercial context ──
  if (s.commercialContext && doc.commercialContext) {
    const c = doc.commercialContext;
    heading("Commercial context");
    if (c.objective) text(`Objective: ${c.objective}`, M, 9.5);
    if (c.summary) text(c.summary, M, 9.5, "normal", [71, 85, 105]);
    const facets = [c.regions.length ? `Regions: ${c.regions.join(", ")}` : "", c.industries.length ? `Sectors: ${c.industries.join(", ")}` : ""].filter(Boolean);
    if (facets.length) text(facets.join("   "), M, 8.5, "normal", [100, 116, 139]);
  }

  // ── Portfolio synthesis + table ──
  if (s.portfolioSynthesis) {
    const p = doc.portfolioSynthesis;
    heading("Portfolio");
    text(`${p.total} account(s): ${p.counts.prioritize} prioritize, ${p.counts.validate} validate, ${p.counts.monitor} monitor, ${p.counts.hold} hold`, M, 9.5);
    if (p.allocation) text(`${p.allocation.line} ${p.allocation.detail}`, M, 9.5, "bold");
    if (doc.accounts.length) {
      gap(2);
      autoTable(pdf, {
        startY: y, margin: { left: M, right: M }, styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.6 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
        head: [["#", "Company", "Decision", "Fit", "Timing", "Evidence"]],
        body: doc.accounts.map((a, i) => [String(a.rank ?? i + 1), ascii(a.company), DECISION_TOKENS[a.decision].label, dimensionValue(a, "Fit") ?? "-", dimensionValue(a, "Timing") ?? "-", dimensionValue(a, "Evidence") ?? "-"]),
      });
      // @ts-expect-error jspdf-autotable augments lastAutoTable at runtime
      y = (pdf.lastAutoTable?.finalY ?? y) + 4;
    }
  }

  // ── Premium decision architecture (premium tier only; deterministic, computed from the accounts) ──
  if (s.premiumArchitecture && doc.premium && doc.premium.executivePortfolio.total > 0) {
    const ep = doc.premium.executivePortfolio;
    const companyOf = new Map(ep.priorityMap.map((p) => [p.accountId, p.company]));
    const names = (ids: string[]) => ids.map((id) => ascii(companyOf.get(id) ?? id)).join(", ");
    heading("Executive decision architecture (Premium)");
    const d = ep.decisionDistribution;
    text(`${ep.total} account(s): ${d.prioritize} prioritize, ${d.validate} validate, ${d.monitor} monitor, ${d.hold} hold`, M, 9.5);
    if (ep.topOpportunities.length) text(`Where attention goes first: ${names(ep.topOpportunities)}`, M, 9.5, "bold", [51, 65, 85]);
    if (ep.synthesis.clusters.length) text(`Patterns: ${ep.synthesis.clusters.map((c) => `${ascii(c.key)} (${c.accountIds.length})`).join("   ")}`, M, 9, "normal", [71, 85, 105]);
    if (ep.synthesis.contradictions.length) bullets("Tensions to resolve", ep.synthesis.contradictions.map((c) => `${ascii(companyOf.get(c.accountId) ?? c.accountId)}: ${ascii(c.note)}`), [180, 83, 9]);
    if (ep.validationPriorities.length) bullets("Validation priorities", ep.validationPriorities.slice(0, 6).map(ascii));
    text(ep.synthesis.scopeNote, M, 8, "normal", [100, 116, 139]);

    // Optional research context — rendered only when a premium run produced + persisted it.
    const ctx = ep.context;
    if (ctx && ctx.benchmark.state === "PRESENT") {
      heading("Commercial benchmark (Premium)");
      const notes = [...ctx.benchmark.recurringNeeds, ...ctx.benchmark.offerPositioning, ...ctx.benchmark.differentiatedWhere];
      bullets("", notes.slice(0, 6).map((n) => `${ascii(n.statement)}${n.stale ? " (older evidence)" : ""}`));
      if (ctx.competitors.length) text(`Alternatives considered: ${ctx.competitors.map((c) => ascii(c.entity)).join(", ")}`, M, 9, "normal", [71, 85, 105]);
      if (ctx.additionalOpportunities.length) text(`Additional opportunities: ${ctx.additionalOpportunities.map((o) => ascii(o.entity)).join(", ")}`, M, 9, "normal", [71, 85, 105]);
      if (ctx.ecosystem.length) text(`Ecosystem actors: ${ctx.ecosystem.map((e) => ascii(e.entity)).join(", ")}`, M, 9, "normal", [71, 85, 105]);
      text(ctx.benchmark.scopeNote, M, 8, "normal", [100, 116, 139]);
    }

    // Decision-critical briefs — each carries a conditional pathway (never a predicted future Decision).
    const briefs = doc.premium.decisionCriticalBriefs;
    if (briefs.length) {
      heading("Decision-critical briefs (Premium)");
      for (const b of briefs) {
        space(20); gap(1);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(10.5); pdf.setTextColor(15, 23, 42);
        pdf.text(ascii(b.company), M, y);
        pdf.setFontSize(8.5); pdf.setTextColor(...rgb[b.decision]);
        pdf.text(DECISION_TOKENS[b.decision].label.toUpperCase(), W - M, y, { align: "right" });
        y += 5;
        if (b.whyMatters) text(b.whyMatters, M, 9, "normal", [51, 65, 85]);
        if (b.whyNow) text(`Why now: ${b.whyNow}`, M, 9, "normal", [51, 65, 85]);
        if (b.validationPriority.length) bullets("Validate first", b.validationPriority.map(ascii));
        if (b.pathway.state === "OPEN") text(b.pathway.conditionalNote, M, 8, "normal", [100, 116, 139]);
        if (b.whatCouldChange) text(`What could change it: ${b.whatCouldChange}`, M, 8, "normal", [100, 116, 139]);
        gap(1);
      }
    }
  }

  // ── Opportunity Cases (accounts) ──
  if (s.accounts && doc.accounts.length) {
    heading("Opportunity Cases");
    for (const a of doc.accounts) accountCase(a, s);
  }

  // ── Validation queue ──
  if (s.validationQueue && doc.validationQueue.length) {
    heading("Validation queue");
    for (const q of doc.validationQueue) text(`${ascii(q.company)} (${DECISION_TOKENS[q.decision].label}): ${q.items.map(ascii).join("; ")}`, M, 9);
  }
  // ── Coverage / methodology / limitations ──
  if (s.coverage && doc.coverage) { heading("Evidence coverage"); text(`${doc.coverage.withSources} with sources, ${doc.coverage.withDatedEvidence} dated, ${doc.coverage.corroborated} corroborated${doc.coverage.grade ? `, ${doc.coverage.grade}` : ""}`, M, 9.5); }
  if (s.methodology && doc.methodology.length) { heading("Methodology"); bullets("", doc.methodology); }
  if (s.limitations && doc.limitations.length) { heading("Limitations"); bullets("", doc.limitations); }

  // ── Footer: page X of Y + identity ──
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i); pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(148, 163, 184);
    pdf.text("LeadLens - Account Opportunity Intelligence", M, H - 8);
    pdf.text(`Page ${i} of ${pages}`, W - M, H - 8, { align: "right" });
  }
  return Buffer.from(pdf.output("arraybuffer"));

  function accountCase(a: AccountBriefVM, sec: typeof s) {
    space(24); gap(2);
    // Header line: rank + company (bold), decision label in decision color.
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(15, 23, 42);
    const title = ascii(`${a.rank != null ? `${a.rank}. ` : ""}${a.company}`);
    pdf.text(title, M, y);
    pdf.setFontSize(9); pdf.setTextColor(...rgb[a.decision]);
    pdf.text(DECISION_TOKENS[a.decision].label.toUpperCase(), W - M, y, { align: "right" });
    y += 5;
    const sub = [a.segment, a.geography].filter(Boolean).map(ascii).join(" - ");
    if (sub) text(sub, M, 8, "normal", [148, 163, 184]);
    if (a.decisionNote) text(`Why: ${a.decisionNote}`, M, 9.5, "normal", [51, 65, 85]);
    if (sec.accountDimensions && a.dimensions.length) text(a.dimensions.map((d) => `${d.label}: ${d.value}`).join("    "), M, 9, "bold", [71, 85, 105]);
    if (sec.accountThesis && a.thesis) text(a.thesis, M, 9.5, "normal", [51, 65, 85]);
    if (sec.accountEvidence) text(`Evidence: ${a.evidence.sourceCount} source(s), ${a.evidence.datedCount} dated${a.evidence.latestAge ? `, latest ${a.evidence.latestAge}` : ""}${a.evidence.strength ? `, ${a.evidence.strength}` : ""}`, M, 8.5, "normal", [100, 116, 139]);
    if (sec.accountWhatChanged) bullets("What changed", a.whatChanged.map((c) => `${ascii(c.event)}${c.date ? ` (${c.date})` : ""}`));
    if (sec.accountCounterSignals) bullets("Counter-signals", a.counterSignals.map(ascii), [180, 83, 9]);
    if (sec.accountValidations) bullets("Validate before acting", a.validations.map(ascii));
    if (sec.accountSources) bullets("Sources", a.sources.map((src) => `${ascii(src.label)}${src.date ? ` (${src.date})` : ""}${src.url ? ` - ${ascii(src.url)}` : ""}`));
    if (sec.accountNextStep && a.nextStep) text(`Next step: ${a.nextStep}`, M, 9.5, "bold", [51, 65, 85]);
    gap(2);
  }
}
