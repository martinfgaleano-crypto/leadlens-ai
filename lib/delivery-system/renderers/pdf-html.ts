// ─── Delivery System V1 — PDF/snapshot renderer (print-ready HTML) ─────────────────────────────
// A frozen, print-friendly HTML artifact from a channel="pdf" PresentationModel. Renders exactly the
// sections ExportPolicy permits at the composed tier depth. Self-contained (inline styles); no
// scripts, no interactivity. Never invents content — empty sections are simply omitted.
import { DECISION_TOKENS } from "@/lib/deliverable/deliverable-view-model";
import type { PresentationModel } from "@/lib/delivery-system/presentation-model";
import type { AccountBriefVM } from "@/lib/delivery-system/delivery-document";
import { esc } from "@/lib/delivery-system/renderers/shared";

const S = {
  body: "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;line-height:1.55;max-width:760px;margin:0 auto;padding:32px;",
  h1: "font-size:22px;font-weight:800;letter-spacing:-.02em;margin:0 0 4px;",
  eyebrow: "font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0284c7;margin:0 0 8px;",
  meta: "font-size:12px;color:#64748b;margin:0 0 20px;",
  h2: "font-size:15px;font-weight:800;margin:26px 0 10px;border-top:1px solid #e2e8f0;padding-top:16px;",
  p: "font-size:13px;color:#334155;margin:0 0 8px;",
  card: "border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:0 0 12px;",
  badge: (d: keyof typeof DECISION_TOKENS) => `display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;color:${DECISION_TOKENS[d].color};background:${DECISION_TOKENS[d].bg};border:1px solid ${DECISION_TOKENS[d].border};`,
  dim: "display:inline-block;font-size:11px;color:#475569;margin-right:12px;",
  li: "font-size:12px;color:#475569;margin:2px 0;",
};

function accountHtml(a: AccountBriefVM, s: PresentationModel["policy"]["sections"]): string {
  const parts: string[] = [];
  parts.push(`<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;">
    <div style="font-size:15px;font-weight:800;">${a.rank != null ? `${esc(a.rank)}. ` : ""}${esc(a.company)}</div>
    <span style="${S.badge(a.decision)}">${esc(DECISION_TOKENS[a.decision].label)}</span></div>`);
  const sub = [a.segment, a.geography].filter(Boolean).map(esc).join(" · ");
  if (sub) parts.push(`<div style="font-size:11px;color:#94a3b8;margin-top:2px;">${sub}</div>`);
  if (a.decisionNote) parts.push(`<div style="${S.p};margin-top:8px;"><strong>Why:</strong> ${esc(a.decisionNote)}</div>`);
  if (s.accountDimensions && a.dimensions.length) parts.push(`<div style="margin:8px 0;">${a.dimensions.map((d) => `<span style="${S.dim}"><strong>${esc(d.label)}:</strong> ${esc(d.value)}</span>`).join("")}</div>`);
  if (s.accountThesis && a.thesis) parts.push(`<div style="${S.p}">${esc(a.thesis)}</div>`);
  if (s.accountEvidence) parts.push(`<div style="font-size:11px;color:#64748b;margin:6px 0;">Evidence: ${a.evidence.sourceCount} source(s), ${a.evidence.datedCount} dated${a.evidence.latestAge ? ` · latest ${esc(a.evidence.latestAge)}` : ""}${a.evidence.strength ? ` · ${esc(a.evidence.strength)}` : ""}</div>`);
  if (s.accountWhatChanged && a.whatChanged.length) parts.push(`<div style="margin:6px 0;"><div style="font-size:11px;font-weight:700;color:#334155;">What changed</div>${a.whatChanged.map((c) => `<div style="${S.li}">• ${esc(c.event)}${c.date ? ` (${esc(c.date)})` : ""}</div>`).join("")}</div>`);
  if (s.accountCounterSignals && a.counterSignals.length) parts.push(`<div style="margin:6px 0;"><div style="font-size:11px;font-weight:700;color:#b45309;">Counter-signals</div>${a.counterSignals.map((c) => `<div style="${S.li}">• ${esc(c)}</div>`).join("")}</div>`);
  if (s.accountValidations && a.validations.length) parts.push(`<div style="margin:6px 0;"><div style="font-size:11px;font-weight:700;color:#334155;">Validate before acting</div>${a.validations.map((v) => `<div style="${S.li}">• ${esc(v)}</div>`).join("")}</div>`);
  if (s.accountSources && a.sources.length) parts.push(`<div style="margin:6px 0;"><div style="font-size:11px;font-weight:700;color:#334155;">Sources</div>${a.sources.map((src) => `<div style="${S.li}">• ${esc(src.label)}${src.date ? ` (${esc(src.date)})` : ""}</div>`).join("")}</div>`);
  if (s.accountNextStep && a.nextStep) parts.push(`<div style="${S.p};margin-top:6px;"><strong>Next step:</strong> ${esc(a.nextStep)}</div>`);
  return `<div style="${S.card}">${parts.join("")}</div>`;
}

/** Premium-only: the executive decision-architecture block. Deterministic, computed from the accounts.
 *  Rendered only when the tier+policy include it AND a premium section exists (fail-closed otherwise). */
function premiumHtml(premium: NonNullable<PresentationModel["document"]["premium"]>): string {
  const { executivePortfolio: ep, decisionCriticalBriefs: briefs } = premium;
  if (ep.total === 0) return "";   // fail-closed: nothing to say
  const companyOf = new Map(ep.priorityMap.map((p) => [p.accountId, p.company]));
  const names = (ids: string[]) => ids.map((id) => esc(companyOf.get(id) ?? id)).join(", ");
  const out: string[] = [];
  out.push(`<h2 style="${S.h2}">Executive decision architecture <span style="font-size:10px;font-weight:700;color:#0284c7;">PREMIUM</span></h2>`);

  // Advanced synthesis
  const syn = ep.synthesis;
  const d = ep.decisionDistribution;
  out.push(`<p style="${S.p}">${ep.total} account(s) · ${d.prioritize} prioritize · ${d.validate} validate · ${d.monitor} monitor · ${d.hold} hold.</p>`);
  if (ep.topOpportunities.length) out.push(`<p style="${S.p}"><strong>Where attention goes first:</strong> ${names(ep.topOpportunities)}</p>`);
  if (syn.clusters.length) out.push(`<p style="${S.p}"><strong>Patterns:</strong> ${syn.clusters.map((c) => `${esc(c.kind === "decision" ? c.key : c.key)} (${c.accountIds.length})`).join(" · ")}</p>`);
  if (syn.contradictions.length) out.push(`<div style="margin:6px 0;"><div style="font-size:11px;font-weight:700;color:#b45309;">Tensions to resolve</div>${syn.contradictions.map((c) => `<div style="${S.li}">• ${esc(companyOf.get(c.accountId) ?? c.accountId)}: ${esc(c.note)}</div>`).join("")}</div>`);
  if (ep.validationPriorities.length) out.push(`<div style="margin:6px 0;"><div style="font-size:11px;font-weight:700;color:#334155;">Validation priorities</div>${ep.validationPriorities.slice(0, 6).map((v) => `<div style="${S.li}">• ${esc(v)}</div>`).join("")}</div>`);
  out.push(`<p style="font-size:11px;color:#64748b;">${esc(syn.scopeNote)}</p>`);

  // Optional research context (present only when a premium run produced + persisted it).
  const ctx = ep.context;
  if (ctx && ctx.benchmark.state === "PRESENT") {
    out.push(`<h2 style="${S.h2}">Commercial benchmark <span style="font-size:10px;font-weight:700;color:#0284c7;">PREMIUM</span></h2>`);
    const notes = [...ctx.benchmark.recurringNeeds, ...ctx.benchmark.offerPositioning, ...ctx.benchmark.differentiatedWhere];
    for (const n of notes.slice(0, 6)) out.push(`<div style="${S.li}">• ${esc(n.statement)}${n.stale ? ` <span style="color:#94a3b8;">(older evidence)</span>` : ""}</div>`);
    if (ctx.competitors.length) out.push(`<p style="${S.p};margin-top:8px;"><strong>Alternatives considered:</strong> ${ctx.competitors.map((c) => esc(c.entity)).join(", ")}</p>`);
    if (ctx.additionalOpportunities.length) out.push(`<p style="${S.p}"><strong>Additional opportunities to investigate:</strong> ${ctx.additionalOpportunities.map((o) => esc(o.entity)).join(", ")}</p>`);
    if (ctx.ecosystem.length) out.push(`<p style="${S.p}"><strong>Ecosystem actors:</strong> ${ctx.ecosystem.map((e) => esc(e.entity)).join(", ")}</p>`);
    out.push(`<p style="font-size:11px;color:#64748b;">${esc(ctx.benchmark.scopeNote)}</p>`);
  }

  // Decision-critical briefs (each carries a conditional pathway — never a predicted future Decision).
  if (briefs.length) {
    out.push(`<h2 style="${S.h2}">Decision-critical briefs <span style="font-size:10px;font-weight:700;color:#0284c7;">PREMIUM</span></h2>`);
    for (const b of briefs) {
      const p: string[] = [];
      p.push(`<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;"><div style="font-size:14px;font-weight:800;">${esc(b.company)}</div><span style="${S.badge(b.decision)}">${esc(DECISION_TOKENS[b.decision].label)}</span></div>`);
      if (b.whyMatters) p.push(`<div style="${S.p};margin-top:6px;">${esc(b.whyMatters)}</div>`);
      if (b.whyNow) p.push(`<div style="${S.p}"><strong>Why now:</strong> ${esc(b.whyNow)}</div>`);
      if (b.validationPriority.length) p.push(`<div style="margin:6px 0;"><div style="font-size:11px;font-weight:700;color:#334155;">Validate first</div>${b.validationPriority.map((v) => `<div style="${S.li}">• ${esc(v)}</div>`).join("")}</div>`);
      if (b.pathway.state === "OPEN") p.push(`<div style="font-size:11px;color:#64748b;margin-top:4px;">${esc(b.pathway.conditionalNote)}</div>`);
      p.push(`<div style="font-size:11px;color:#64748b;margin-top:4px;"><strong>What could change it:</strong> ${esc(b.whatCouldChange)}</div>`);
      out.push(`<div style="${S.card}">${p.join("")}</div>`);
    }
  }
  return out.join("\n");
}

export function renderPdfHtml(pm: PresentationModel): string {
  const { document: doc, policy, tierLabel } = pm;
  const s = policy.sections;
  const out: string[] = [];
  if (s.header) {
    out.push(`<p style="${S.eyebrow}">LeadLens · Account Opportunity Intelligence · ${esc(tierLabel)}</p>`);
    out.push(`<h1 style="${S.h1}">${esc(doc.headline ?? "Opportunity Portfolio")}</h1>`);
    const meta = [doc.meta.client, doc.meta.market, doc.meta.generatedLabel].filter(Boolean).map(esc).join(" · ");
    if (meta) out.push(`<p style="${S.meta}">${meta}</p>`);
    if (doc.summary) out.push(`<p style="${S.p}">${esc(doc.summary)}</p>`);
  }
  if (s.commercialContext && doc.commercialContext) {
    const c = doc.commercialContext;
    out.push(`<h2 style="${S.h2}">Commercial context</h2>`);
    if (c.objective) out.push(`<p style="${S.p}"><strong>Objective:</strong> ${esc(c.objective)}</p>`);
    if (c.summary) out.push(`<p style="${S.p}">${esc(c.summary)}</p>`);
    const facets = [c.regions.length ? `Regions: ${c.regions.map(esc).join(", ")}` : "", c.industries.length ? `Sectors: ${c.industries.map(esc).join(", ")}` : ""].filter(Boolean);
    if (facets.length) out.push(`<p style="font-size:11px;color:#64748b;">${facets.join(" · ")}</p>`);
  }
  if (s.portfolioSynthesis) {
    const p = doc.portfolioSynthesis;
    out.push(`<h2 style="${S.h2}">Portfolio</h2>`);
    out.push(`<p style="${S.p}">${p.total} account(s): ${p.counts.prioritize} prioritize · ${p.counts.validate} validate · ${p.counts.monitor} monitor · ${p.counts.hold} hold</p>`);
    if (p.allocation) out.push(`<p style="${S.p}"><strong>${esc(p.allocation.line)}</strong> ${esc(p.allocation.detail)}</p>`);
    if (p.note) out.push(`<p style="font-size:11px;color:#64748b;">${esc(p.note)}</p>`);
  }
  if (s.premiumArchitecture && doc.premium) {
    out.push(premiumHtml(doc.premium));
  }
  if (s.accounts && doc.accounts.length) {
    out.push(`<h2 style="${S.h2}">Accounts</h2>`);
    for (const a of doc.accounts) out.push(accountHtml(a, s));
  }
  if (s.validationQueue && doc.validationQueue.length) {
    out.push(`<h2 style="${S.h2}">Validation queue</h2>`);
    for (const q of doc.validationQueue) out.push(`<div style="${S.p}"><strong>${esc(q.company)}</strong> (${esc(DECISION_TOKENS[q.decision].label)}): ${q.items.map(esc).join("; ")}</div>`);
  }
  if (s.coverage && doc.coverage) {
    out.push(`<h2 style="${S.h2}">Evidence coverage</h2>`);
    out.push(`<p style="${S.p}">${doc.coverage.withSources} with sources · ${doc.coverage.withDatedEvidence} dated · ${doc.coverage.corroborated} corroborated${doc.coverage.grade ? ` · ${esc(doc.coverage.grade)}` : ""}</p>`);
  }
  if (s.methodology && doc.methodology.length) {
    out.push(`<h2 style="${S.h2}">Methodology</h2>${doc.methodology.map((m) => `<div style="${S.li}">• ${esc(m)}</div>`).join("")}`);
  }
  if (s.limitations && doc.limitations.length) {
    out.push(`<h2 style="${S.h2}">Limitations</h2>${doc.limitations.map((m) => `<div style="${S.li}">• ${esc(m)}</div>`).join("")}`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>LeadLens — ${esc(doc.meta.client ?? "Opportunity Portfolio")}</title></head><body style="${S.body}">${out.join("\n")}</body></html>`;
}
