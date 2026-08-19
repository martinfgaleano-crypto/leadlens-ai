// ─── Portable deliverable — self-contained HTML generator ─────────────────────
// Renders a DeliverableViewModel into ONE self-contained .html file: inline CSS,
// inline vanilla JS (no React runtime, no CDN, no webfont), all panels
// pre-rendered as escaped HTML, and a tiny embedded payload holding only the two
// CSV exports. It opens by double-click (file://), works offline, and requires
// no login/server/API. Every string is escaped; every URL is http/https-checked.

import type { DeliverableViewModel, AccountBriefVM, DecisionState } from "../deliverable-view-model";
import { DECISION_TOKENS, STRENGTH_TOKENS, RELATION_TOKENS, decisionLabel } from "../deliverable-view-model";
import { portfolioCsv, evidenceCsv, deliverableFilename } from "../exports";
import { esc, safeUrl, jsonForScript, type PortableRuntimePayload, PORTABLE_FORMAT_VERSION } from "./portable-payload";

const ORDER: DecisionState[] = ["prioritize", "validate", "monitor", "hold"];

function L(es: boolean) {
  return {
    aoi: es ? "Inteligencia de Oportunidades de Cuenta" : "Account Opportunity Intelligence",
    portfolioTitle: es ? "Portafolio de Oportunidades" : "Opportunity Portfolio",
    preparedFor: es ? "Preparado para" : "Prepared for",
    generated: es ? "Generado" : "Generated",
    staticNote: es ? "Este portafolio refleja la evidencia disponible al momento de su generación." : "This portfolio reflects the evidence available at the time of generation.",
    tabs: { portfolio: es ? "Portafolio" : "Portfolio", accounts: es ? "Cuentas" : "Account Briefs", compare: es ? "Comparar" : "Compare", evidence: es ? "Evidencia" : "Evidence", method: es ? "Metodología" : "How to read" },
    accounts: es ? "Cuentas" : "Accounts",
    distribution: es ? "Distribución de decisiones" : "Decision distribution",
    whereFocus: es ? "Dónde enfocarte" : "Where to focus",
    validationQueue: es ? "Cola de validación" : "Validation queue",
    validationQueueLede: es ? "Lo que conviene resolver antes de actuar, por cuenta." : "What to resolve before acting, by account.",
    coverage: es ? "Cobertura de evidencia" : "Evidence coverage",
    withDated: es ? "con evidencia fechada" : "with dated evidence",
    withSources: es ? "con fuentes" : "with sources",
    corroborated: es ? "corroboradas" : "corroborated",
    grade: es ? "solidez de evidencia" : "evidence strength",
    commercialContext: es ? "Contexto comercial evaluado" : "Commercial context evaluated",
    ctxIndustries: es ? "Sectores" : "Industries",
    ctxRegions: es ? "Mercados" : "Markets",
    ctxCriteria: es ? "Criterios de oportunidad" : "Opportunity criteria",
    whatIsnt: es ? "Qué NO es este portafolio" : "What this portfolio isn't",
    thesis: es ? "Tesis de la cuenta" : "Account thesis",
    whyMatters: es ? "Por qué importa" : "Why it matters",
    whatChanged: es ? "Qué cambió" : "What changed",
    supportedBy: es ? "Respaldado por" : "Supported by",
    sources: es ? "fuentes" : "sources", dated: es ? "con fecha" : "dated", latest: es ? "más reciente" : "latest",
    counter: es ? "Contraseñales y riesgos" : "Counter-signals & risks",
    noCounter: es ? "No se identificaron contraseñales para esta cuenta." : "No counter-signals identified for this account.",
    limits: es ? "Qué limita la confianza" : "What limits confidence",
    validate: es ? "Validar antes de actuar" : "Validate before acting",
    decision: es ? "Decisión" : "Decision",
    nextStep: es ? "Siguiente paso recomendado" : "Recommended next step",
    ago: es ? "atrás" : "ago", notDated: es ? "sin fecha" : "not dated",
    noEvidence: es ? "Sin evidencia con fecha disponible todavía." : "No dated evidence available yet.",
    compareSelect: es ? "Cuentas comparadas" : "Accounts compared",
    compareInsight: es ? "Lectura de LeadLens" : "LeadLens read",
    cDecision: es ? "Decisión" : "Decision", cFit: "Fit", cTiming: "Timing", cEvidence: es ? "Evidencia" : "Evidence",
    cFreshness: es ? "Frescura" : "Freshness", cChanged: es ? "Qué cambió" : "What changed", cThesis: es ? "Tesis" : "Thesis",
    cLimiter: es ? "Límite principal" : "Primary limiter", cValidate: es ? "Validar" : "Validate next", cNext: es ? "Siguiente paso" : "Next step",
    evidenceAcross: es ? "Evidencia por cuenta" : "Evidence across accounts",
    evidenceLede: es ? "Cada conclusión es inspeccionable: fuente, fecha y qué establece." : "Every conclusion is inspectable: source, date, and what it establishes.",
    howToRead: es ? "Cómo leer este portafolio" : "How to read this portfolio",
    decisionStates: es ? "Estados de decisión" : "Decision states",
    evidenceRelations: es ? "Relación de la evidencia" : "Evidence relations",
    absenceNote: es ? "La ausencia de evidencia no es evidencia de ausencia: LeadLens muestra lo que sabe y lo que aún no." : "Absence of evidence is not evidence of absence: LeadLens shows what it knows and what it does not yet.",
    defP: es ? "la evidencia respalda dedicar atención ahora." : "evidence supports attention now.",
    defV: es ? "prometedor, pero queda una incertidumbre importante." : "promising, but an important uncertainty remains.",
    defM: es ? "relevante, pero la evidencia o el timing aún no bastan." : "relevant, but evidence or timing is not yet sufficient.",
    defH: es ? "no se justifica dedicar esfuerzo ahora." : "effort is not justified right now.",
    relDirect: es ? "Directa" : "Direct", relCorrob: es ? "Corroborante" : "Corroborating", relContext: es ? "Contexto" : "Context",
    defDirect: es ? "establece el cambio directamente." : "establishes the change directly.",
    defCorrob: es ? "respalda el cambio de forma independiente." : "independently supports the change.",
    defContext: es ? "aporta contexto de apoyo." : "provides supporting context.",
    savePortfolioCsv: es ? "Guardar CSV del portafolio" : "Save Portfolio CSV",
    saveEvidenceCsv: es ? "Guardar CSV de evidencia" : "Save Evidence CSV",
    printPdf: es ? "Imprimir / Guardar PDF" : "Print / Save as PDF",
  };
}
type T = ReturnType<typeof L>;

function badge(state: DecisionState, es: boolean): string {
  const s = DECISION_TOKENS[state];
  return `<span class="pt-badge" style="background:${s.bg};border-color:${s.border};color:${s.color}"><span class="pt-dot" style="background:${s.dot}"></span>${esc(decisionLabel(state, es))}</span>`;
}
function strengthSpan(v: string | null): string {
  if (!v) return `<span class="pt-muted">—</span>`;
  const tok = STRENGTH_TOKENS[v as keyof typeof STRENGTH_TOKENS] ?? STRENGTH_TOKENS.Moderate;
  return `<span style="font-weight:${tok.weight};color:${tok.color}">${esc(v)}</span>`;
}
const dimVal = (a: AccountBriefVM, label: string) => a.dimensions.find((d) => d.label === label)?.value ?? null;

// ─── Sections ─────────────────────────────────────────────────────────────────

/** Deterministic executive read — only from real counts (§9). No LLM prose. */
function executiveRead(vm: DeliverableViewModel, es: boolean): string | null {
  const c = vm.portfolio.counts; const total = vm.portfolio.total;
  if (!total) return null;
  const pri = c.prioritize, val = c.validate;
  const corr = vm.coverage?.corroborated ?? 0;
  if (es) {
    const a = pri > 0
      ? `${pri} de ${total} cuenta${total === 1 ? "" : "s"} merece${pri === 1 ? "" : "n"} atención prioritaria ahora`
      : `Ninguna cuenta merece atención prioritaria inmediata todavía`;
    const b = corr > 0 ? `; los casos más sólidos combinan cambio comercial reciente con evidencia corroborada` : ``;
    const d = val > 0 ? `. ${val} requiere${val === 1 ? "" : "n"} validación antes de aumentar la atención.` : `.`;
    return `${a}${b}${d}`;
  }
  const a = pri > 0
    ? `${pri} of ${total} account${total === 1 ? "" : "s"} currently merit${pri === 1 ? "s" : ""} priority attention`
    : `No account currently merits immediate priority attention`;
  const b = corr > 0 ? `, and the strongest cases combine recent commercial change with corroborated evidence` : ``;
  const d = val > 0 ? `. ${val} still require${val === 1 ? "s" : ""} validation before attention increases.` : `.`;
  return `${a}${b}${d}`;
}

function portfolioPanel(vm: DeliverableViewModel, t: T, es: boolean): string {
  const total = vm.portfolio.total || 1;
  const priority = vm.accounts.filter((a) => a.decision === "prioritize" || a.decision === "validate");
  const cc = vm.commercialContext;
  const exec = executiveRead(vm, es);
  const bar = ORDER.filter((k) => vm.portfolio.counts[k] > 0)
    .map((k) => `<div style="width:${(vm.portfolio.counts[k] / total) * 100}%;background:${DECISION_TOKENS[k].dot}"></div>`).join("");
  const legend = ORDER.map((k) => `<span class="pt-leg"><span class="pt-dot" style="background:${DECISION_TOKENS[k].dot}"></span><strong>${vm.portfolio.counts[k]}</strong> ${esc(decisionLabel(k, es).toLowerCase())}</span>`).join("");

  return `<section class="pt-panel" id="panel-portfolio">
    <div class="pt-cover">
      <div class="pt-cover-kick">${esc(t.aoi)}</div>
      ${vm.headline ? `<h1 class="pt-h1">${esc(vm.headline)}</h1>` : ""}
      ${vm.summary ? `<p class="pt-sub">${esc(vm.summary)}</p>` : ""}
    </div>
    ${exec ? `<div class="pt-exec"><span class="pt-exec-k">${esc(t.compareInsight)}</span><p class="pt-exec-t">${esc(exec)}</p></div>` : ""}
    ${cc && (cc.summary || cc.industries.length || cc.regions.length || cc.criteria.length) ? `<details class="pt-card pt-context"><summary class="pt-csum">${esc(t.commercialContext)}</summary><div class="pt-cbody">
      ${cc.summary ? `<p class="pt-p">${esc(cc.summary)}</p>` : ""}
      ${cc.industries.length ? `<div class="pt-row"><span class="pt-k">${esc(t.ctxIndustries)}</span><span class="pt-v">${esc(cc.industries.join(" · "))}</span></div>` : ""}
      ${cc.regions.length ? `<div class="pt-row"><span class="pt-k">${esc(t.ctxRegions)}</span><span class="pt-v">${esc(cc.regions.join(" · "))}</span></div>` : ""}
      ${cc.criteria.length ? `<div class="pt-row"><span class="pt-k">${esc(t.ctxCriteria)}</span><ul class="pt-crit">${cc.criteria.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>` : ""}
    </div></details>` : ""}
    <div class="pt-card"><p class="pt-label">${esc(t.distribution)}</p><div class="pt-bar">${bar}</div><div class="pt-legend">${legend}</div>
      ${vm.portfolio.allocation ? `<div class="pt-alloc"><div class="pt-alloc-l">${esc(vm.portfolio.allocation.line)}</div><p class="pt-alloc-d">${esc(vm.portfolio.allocation.detail)}</p></div>` : ""}
      ${vm.portfolio.note ? `<p class="pt-note">${esc(vm.portfolio.note)}</p>` : ""}
    </div>
    ${priority.length ? `<div class="pt-card"><p class="pt-label">${esc(t.whereFocus)}</p><div class="pt-focus">${priority.map((a) => `<button class="pt-focus-i" data-goacct="${esc(a.id)}"><span class="pt-focus-n">${a.rank ? esc(a.rank) + ". " : ""}${esc(a.company)}</span><span class="pt-focus-m">${badge(a.decision, es)}${a.freshness?.age ? `<span class="pt-focus-age">${esc(a.freshness.age)} ${esc(t.ago)}</span>` : ""}</span></button>`).join("")}</div></div>` : ""}
    ${vm.validationQueue.length ? `<div class="pt-card"><p class="pt-label">${esc(t.validationQueue)}</p><p class="pt-note" style="margin-top:0">${esc(t.validationQueueLede)}</p><div class="pt-vq">${vm.validationQueue.map((q) => `<div class="pt-vq-i"><button class="pt-vq-n" data-goacct="${esc(q.accountId)}"><span class="pt-dot" style="background:${DECISION_TOKENS[q.decision].dot}"></span>${esc(q.company)}</button><span class="pt-vq-f">${esc(q.items[0])}${q.items.length > 1 ? ` (+${q.items.length - 1})` : ""}</span></div>`).join("")}</div></div>` : ""}
    ${vm.coverage ? `<div class="pt-card"><p class="pt-label">${esc(t.coverage)}</p><div class="pt-cov">
      <div><span class="pt-cov-n">${vm.coverage.withDatedEvidence}</span><span class="pt-cov-l">${esc(t.withDated)}</span></div>
      <div><span class="pt-cov-n">${vm.coverage.withSources}</span><span class="pt-cov-l">${esc(t.withSources)}</span></div>
      ${vm.coverage.corroborated > 0 ? `<div><span class="pt-cov-n">${vm.coverage.corroborated}</span><span class="pt-cov-l">${esc(t.corroborated)}</span></div>` : ""}
      ${vm.coverage.grade ? `<div><span class="pt-cov-n">${esc(vm.coverage.grade)}</span><span class="pt-cov-l">${esc(t.grade)}</span></div>` : ""}
    </div>${vm.coverage.note ? `<p class="pt-note">${esc(vm.coverage.note)}</p>` : ""}</div>` : ""}
    ${vm.limitations.length ? `<div class="pt-card pt-limits"><p class="pt-label" style="color:#b45309">${esc(t.whatIsnt)}</p><ul class="pt-limlist">${vm.limitations.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div>` : ""}
  </section>`;
}

function briefHtml(a: AccountBriefVM, t: T, es: boolean): string {
  const dims = a.dimensions.map((d) => `<div><div class="pt-dim-k">${esc(d.label)}</div><div class="pt-dim-v">${strengthSpan(d.value)}</div>${d.note ? `<div class="pt-dim-n">${esc(d.note)}</div>` : ""}</div>`).join("");
  const changed = a.whatChanged.map((c) => `<div class="pt-chg"><span class="pt-chg-dot"></span><span class="pt-chg-e">${esc(c.event)}</span>${c.age ? `<span class="pt-chg-a">${esc(c.age)} ${esc(t.ago)}</span>` : ""}${c.source ? `<span class="pt-chg-s">· ${esc(c.source)}</span>` : ""}</div>`).join("");
  const evBits: string[] = [];
  if (a.evidence.sourceCount) evBits.push(`${a.evidence.sourceCount} ${t.sources}`);
  if (a.evidence.datedCount) evBits.push(`${a.evidence.datedCount} ${t.dated}`);
  if (a.evidence.latestAge) evBits.push(`${t.latest} ${a.evidence.latestAge} ${t.ago}`);
  const sources = a.sources.map((s, i) => {
    const rel = s.relation ? RELATION_TOKENS[s.relation] : null;
    const url = safeUrl(s.url);
    const label = url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(s.label)} ↗</a>` : `<span class="pt-src-l">${esc(s.label)}</span>`;
    return `<div class="pt-src"${i < a.sources.length - 1 ? ` style="border-bottom:1px solid #f1f5f9"` : ""}><div class="pt-src-h">${rel ? `<span class="pt-rel" style="color:${rel.color}">${esc(es ? rel.labelEs : rel.label)}</span>` : ""}${label}${s.age ? `<span class="pt-src-a">· ${esc(s.age)} ${esc(t.ago)}</span>` : ""}</div>${s.claim ? `<p class="pt-src-c">${esc(s.claim)}</p>` : ""}</div>`;
  }).join("");
  const bullets = (title: string, items: string[], color: string, empty?: string) =>
    (items.length || empty) ? `<div class="pt-card"><p class="pt-label">${esc(title)}</p>${items.length ? `<ul class="pt-bl">${items.map((x) => `<li><span class="pt-bl-d" style="background:${color}"></span><span>${esc(x)}</span></li>`).join("")}</ul>` : `<p class="pt-muted-p">${esc(empty!)}</p>`}</div>` : "";
  const s = DECISION_TOKENS[a.decision];

  return `<div class="pt-brief" data-brief="${esc(a.id)}">
    <div class="pt-card"><div class="pt-bh"><div><h2 class="pt-bh-name">${a.rank ? `<span class="pt-rank">${esc(a.rank)}.</span> ` : ""}${esc(a.company)}</h2><div class="pt-bh-sub">${esc([a.segment, a.geography].filter(Boolean).join(" · ")) || (es ? "Detalles de cuenta limitados" : "Account details limited")}</div></div><div class="pt-bh-r">${badge(a.decision, es)}${a.freshness?.age ? `<span class="pt-fresh">${esc(a.freshness.age)} ${esc(t.ago)}</span>` : ""}</div></div>${dims ? `<div class="pt-dims">${dims}</div>` : ""}</div>
    ${(a.thesis || a.whyItMatters) ? `<div class="pt-card">${a.thesis ? `<p class="pt-label">${esc(t.thesis)}</p><p class="pt-p">${esc(a.thesis)}</p>` : ""}${a.whyItMatters && a.whyItMatters !== a.thesis ? `<div class="pt-sep"><p class="pt-label">${esc(t.whyMatters)}</p><p class="pt-p">${esc(a.whyItMatters)}</p></div>` : ""}</div>` : ""}
    ${a.whatChanged.length ? `<div class="pt-card pt-signal"><p class="pt-label pt-label-accent">${esc(t.whatChanged)}</p><div class="pt-chgs">${changed}</div></div>` : ""}
    <div class="pt-card"><div class="pt-ev-h"><p class="pt-label" style="margin:0">${esc(t.supportedBy)}</p>${evBits.length ? `<span class="pt-ev-b">${esc(evBits.join(" · "))}</span>` : ""}</div>${a.sources.length ? `<div class="pt-srcs">${sources}</div>` : `<p class="pt-muted-p">${esc(t.noEvidence)}</p>`}</div>
    ${bullets(t.counter, a.counterSignals, "#dc2626", t.noCounter)}
    ${bullets(t.limits, a.limitations, "#b45309")}
    ${bullets(t.validate, a.validations, "#0284c7")}
    <div class="pt-card" style="border-left:4px solid ${s.dot};background:${s.bg}"><div class="pt-dec-h"><p class="pt-label" style="margin:0">${esc(t.decision)}</p>${badge(a.decision, es)}</div>${a.decisionNote ? `<p class="pt-p">${esc(a.decisionNote)}</p>` : ""}${a.nextStep ? `<div class="pt-sep"><div class="pt-dim-k">${esc(t.nextStep)}</div><p class="pt-p">${esc(a.nextStep)}</p></div>` : ""}</div>
  </div>`;
}

function accountsPanel(vm: DeliverableViewModel, t: T, es: boolean): string {
  const nav = vm.accounts.map((a, i) => `<button class="pt-nav-i${i === 0 ? " is-active" : ""}" data-acct="${esc(a.id)}"><span class="pt-nav-r">${a.rank ?? "·"}</span><span class="pt-nav-b"><span class="pt-nav-n">${esc(a.company)}</span><span class="pt-nav-s"><span class="pt-dot" style="background:${DECISION_TOKENS[a.decision].dot}"></span>${esc(decisionLabel(a.decision, es))}${a.freshness?.age ? ` · ${esc(a.freshness.age)}` : ""}</span></span></button>`).join("");
  const briefs = vm.accounts.map((a) => briefHtml(a, t, es)).join("");
  return `<section class="pt-panel pt-hidden" id="panel-accounts"><div class="pt-accts"><aside class="pt-nav"><div class="pt-nav-h">${esc(t.accounts)} · ${vm.accounts.length}</div><div class="pt-nav-l">${nav}</div></aside><div class="pt-briefs">${briefs}</div></div></section>`;
}

function comparePanel(vm: DeliverableViewModel, t: T, es: boolean): string {
  if (vm.accounts.length < 2) return "";
  const cols = vm.accounts;
  const defaultSel = new Set(vm.accounts.slice(0, Math.min(4, vm.accounts.length)).map((a) => a.id));
  const rows: [string, (a: AccountBriefVM) => string][] = [
    [t.cDecision, (a) => badge(a.decision, es)],
    [t.cFit, (a) => strengthSpan(dimVal(a, "Fit"))],
    [t.cTiming, (a) => strengthSpan(dimVal(a, "Timing"))],
    [t.cEvidence, (a) => strengthSpan(a.evidence.strength)],
    [t.cFreshness, (a) => a.freshness?.age ? `<span class="pt-cmp-t">${esc(a.freshness.age)} ${esc(t.ago)}</span>` : `<span class="pt-cmp-t">${esc(t.notDated)}</span>`],
    [t.cChanged, (a) => `<span class="pt-cmp-t">${esc(a.whatChanged[0]?.event ?? "—")}</span>`],
    [t.cThesis, (a) => `<span class="pt-cmp-t">${esc(a.thesis ?? "—")}</span>`],
    [t.cLimiter, (a) => `<span class="pt-cmp-t">${esc(a.limitations[0] ?? "—")}</span>`],
    [t.cValidate, (a) => `<span class="pt-cmp-t">${esc(a.validations[0] ?? "—")}</span>`],
    [t.cNext, (a) => `<span class="pt-cmp-t">${esc(a.nextStep ?? "—")}</span>`],
  ];
  const chips = cols.map((a) => `<button class="pt-chip${defaultSel.has(a.id) ? " is-active" : ""}" data-cmp="${esc(a.id)}"><span class="pt-dot" style="background:${DECISION_TOKENS[a.decision].dot}"></span>${esc(a.company)}</button>`).join("");
  const head = cols.map((a) => `<th class="pt-cmp-col" data-cmpcol="${esc(a.id)}"${defaultSel.has(a.id) ? "" : ` style="display:none"`}><button class="pt-cmp-name" data-goacct="${esc(a.id)}">${a.rank ? esc(a.rank) + ". " : ""}${esc(a.company)}</button><span class="pt-cmp-sub">${esc(a.segment ?? "")}</span></th>`).join("");
  const body = rows.map(([label, fn]) => `<tr><td class="pt-cmp-rh">${esc(label)}</td>${cols.map((a) => `<td class="pt-cmp-cell" data-cmpcol="${esc(a.id)}"${defaultSel.has(a.id) ? "" : ` style="display:none"`}>${fn(a)}</td>`).join("")}</tr>`).join("");
  const insight = compareInsight(vm.accounts, es);
  return `<section class="pt-panel pt-hidden" id="panel-compare">
    <div class="pt-card"><p class="pt-label">${esc(t.compareSelect)}</p><div class="pt-chips">${chips}</div></div>
    ${insight ? `<div class="pt-card pt-insight"><p class="pt-label" style="color:#0369a1">${esc(t.compareInsight)}</p><p class="pt-insight-t">${esc(insight)}</p></div>` : ""}
    <div class="pt-card pt-cmp-wrap"><table class="pt-cmp"><thead><tr><th class="pt-cmp-rh"></th>${head}</tr></thead><tbody>${body}</tbody></table></div>
  </section>`;
}

const DR: Record<DecisionState, number> = { prioritize: 0, validate: 1, monitor: 2, hold: 3 };
function compareInsight(accts: AccountBriefVM[], es: boolean): string | null {
  if (accts.length < 2) return null;
  const days = (a: AccountBriefVM) => { const d = a.freshness?.age; return d && /\d/.test(d) ? parseInt(d, 10) : 9999; };
  const sorted = [...accts].sort((a, b) => DR[a.decision] - DR[b.decision] || days(a) - days(b));
  const lead = sorted[0], next = sorted[1];
  const reason = lead.decisionNote || lead.thesis;
  const gap = next.limitations[0] || next.validations[0];
  if (!reason) return null;
  return es
    ? `${lead.company} merece atención antes que ${next.company}: ${reason}${gap ? ` En cambio, ${next.company} aún requiere resolver: ${gap}` : ""}`
    : `${lead.company} merits attention before ${next.company}: ${reason}${gap ? ` ${next.company}, by contrast, still needs to resolve: ${gap}` : ""}`;
}

function evidencePanel(vm: DeliverableViewModel, t: T, es: boolean): string {
  const withSources = vm.accounts.filter((a) => a.sources.length > 0);
  if (!withSources.length) return "";
  const blocks = withSources.map((a) => {
    const sources = a.sources.map((sv, i) => {
      const rel = sv.relation ? RELATION_TOKENS[sv.relation] : null;
      const url = safeUrl(sv.url);
      const label = url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(sv.label)} ↗</a>` : `<span class="pt-src-l">${esc(sv.label)}</span>`;
      return `<div class="pt-src"${i < a.sources.length - 1 ? ` style="border-bottom:1px solid #f1f5f9"` : ""}><div class="pt-src-h">${rel ? `<span class="pt-rel" style="color:${rel.color}">${esc(es ? rel.labelEs : rel.label)}</span>` : ""}${label}${sv.age ? `<span class="pt-src-a">· ${esc(sv.age)} ${esc(t.ago)}</span>` : ""}</div>${sv.claim ? `<p class="pt-src-c">${esc(sv.claim)}</p>` : ""}</div>`;
    }).join("");
    return `<div class="pt-card"><button class="pt-ev-head" data-goacct="${esc(a.id)}">${a.rank ? esc(a.rank) + ". " : ""}${esc(a.company)} ${badge(a.decision, es)}</button><div class="pt-srcs" style="margin-top:10px">${sources}</div></div>`;
  }).join("");
  return `<section class="pt-panel pt-hidden" id="panel-evidence"><div class="pt-card"><p class="pt-label">${esc(t.evidenceAcross)}</p><p class="pt-note" style="margin-top:0">${esc(t.evidenceLede)}</p></div>${blocks}</section>`;
}

function methodPanel(vm: DeliverableViewModel, t: T, es: boolean): string {
  const legend = `<ul class="pt-leg-l">
    <li>${badge("prioritize", es)} ${esc(t.defP)}</li><li>${badge("validate", es)} ${esc(t.defV)}</li>
    <li>${badge("monitor", es)} ${esc(t.defM)}</li><li>${badge("hold", es)} ${esc(t.defH)}</li></ul>`;
  const rels = `<ul class="pt-leg-l pt-leg-t">
    <li><strong style="color:#0284c7">${esc(t.relDirect)}</strong> — ${esc(t.defDirect)}</li>
    <li><strong style="color:#15803d">${esc(t.relCorrob)}</strong> — ${esc(t.defCorrob)}</li>
    <li><strong style="color:#94a3b8">${esc(t.relContext)}</strong> — ${esc(t.defContext)}</li></ul>`;
  const method = vm.capabilities.showMethodology && vm.methodology.length ? `<p class="pt-label" style="margin-top:12px">${es ? "Cómo se construyó" : "How this was built"}</p><ul class="pt-limlist" style="color:#475569;padding-left:18px">${vm.methodology.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>` : "";
  return `<section class="pt-panel pt-hidden" id="panel-method"><div class="pt-card"><p class="pt-label">${esc(t.decisionStates)}</p>${legend}<p class="pt-label" style="margin-top:14px">${esc(t.evidenceRelations)}</p>${rels}${method}<p class="pt-note">${esc(t.absenceNote)}</p></div></section>`;
}

// ─── Document ─────────────────────────────────────────────────────────────────

export function renderPortableHtml(vm: DeliverableViewModel): string {
  const es = vm.meta.language === "es";
  const t = L(es);
  const tabs: [string, string][] = [["portfolio", t.tabs.portfolio], ["accounts", t.tabs.accounts]];
  if (vm.capabilities.showCompareTab && vm.accounts.length >= 2) tabs.push(["compare", t.tabs.compare]);
  if (vm.capabilities.showEvidenceTab && vm.accounts.some((a) => a.sources.length)) tabs.push(["evidence", t.tabs.evidence]);
  tabs.push(["method", t.tabs.method]);

  const payload: PortableRuntimePayload = {
    formatVersion: PORTABLE_FORMAT_VERSION,
    portfolioCsv: portfolioCsv(vm),
    evidenceCsv: evidenceCsv(vm),
    portfolioCsvName: deliverableFilename(vm, "portfolio", "csv"),
    evidenceCsvName: deliverableFilename(vm, "evidence", "csv"),
    hasEvidenceCsv: vm.downloads.evidenceCsv,
  };
  const title = `LeadLens — ${t.portfolioTitle}${vm.meta.client ? ` — ${vm.meta.client}` : ""}`;
  const tabRow = tabs.map(([id, label], i) => `<button class="pt-tab${i === 0 ? " is-active" : ""}" data-tab="${id}">${esc(label)}</button>`).join("");
  const dl = `<div class="pt-dlbar">
    <button class="pt-dl" id="pt-dl-portfolio">${esc(t.savePortfolioCsv)}</button>
    ${payload.hasEvidenceCsv ? `<button class="pt-dl" id="pt-dl-evidence">${esc(t.saveEvidenceCsv)}</button>` : ""}
    <button class="pt-dl pt-dl-ghost" id="pt-print">${esc(t.printPdf)}</button>
  </div>`;

  return `<!doctype html>
<html lang="${es ? "es" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="pt-root">
  <header class="pt-top">
    <div class="pt-brand"><span class="pt-logo">Lead<span style="color:#38bdf8">Lens</span></span><span class="pt-kick">${esc(t.portfolioTitle)}</span></div>
    <div class="pt-meta">${vm.meta.client ? `<span>${esc(t.preparedFor)} <strong>${esc(vm.meta.client)}</strong></span>` : ""}${vm.meta.market ? `<span>· ${esc(vm.meta.market)}</span>` : ""}${vm.meta.tierLabel ? `<span class="pt-tier">${esc(vm.meta.tierLabel)}</span>` : ""}${vm.meta.generatedLabel ? `<span>· ${esc(t.generated)} ${esc(vm.meta.generatedLabel)}</span>` : ""}</div>
  </header>
  <nav class="pt-tabs" role="tablist">${tabRow}</nav>
  ${dl}
  <main class="pt-main">
    ${portfolioPanel(vm, t, es)}
    ${accountsPanel(vm, t, es)}
    ${comparePanel(vm, t, es)}
    ${evidencePanel(vm, t, es)}
    ${methodPanel(vm, t, es)}
  </main>
  <footer class="pt-foot">${esc(t.staticNote)} · LeadLens · ${esc(t.aoi)}${vm.meta.generatedLabel ? ` · ${esc(vm.meta.generatedLabel)}` : ""}</footer>
</div>
<script type="application/json" id="pt-data">${jsonForScript(payload)}</script>
<script>${JS}</script>
</body>
</html>`;
}

// ─── Inline CSS (system fonts only, no CDN, theme-stable) ─────────────────────
const CSS = `
*{box-sizing:border-box}
body{margin:0;background:#f4f7fb;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.pt-root{min-height:100vh}
.pt-top{background:linear-gradient(120deg,#0b1220,#12314f 62%,#0c4a6e);color:#fff;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.pt-brand{display:flex;align-items:baseline;gap:12px}
.pt-logo{font-size:18px;font-weight:800;letter-spacing:-.02em}
.pt-kick{font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#7dd3fc}
.pt-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:#cbd5e1}
.pt-meta strong{color:#fff}
.pt-tier{background:rgba(56,189,248,.16);color:#7dd3fc;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700}
.pt-tabs{position:sticky;top:0;z-index:20;display:flex;gap:2px;background:#fff;border-bottom:1px solid #e2e8f0;padding:0 16px;overflow-x:auto}
.pt-tab{appearance:none;background:none;border:none;border-bottom:2px solid transparent;padding:14px 16px;min-height:44px;font-size:13.5px;font-weight:700;color:#64748b;cursor:pointer;white-space:nowrap;font-family:inherit}
.pt-tab:hover{color:#0f172a}
.pt-tab.is-active{color:#0369a1;border-bottom-color:#0284c7}
.pt-dlbar{max-width:1100px;margin:0 auto;padding:14px 16px 0;display:flex;gap:10px;flex-wrap:wrap}
.pt-dl{appearance:none;background:#0284c7;color:#fff;border:none;border-radius:9px;padding:10px 16px;min-height:40px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
.pt-dl:hover{background:#0369a1}
.pt-dl-ghost{background:#fff;color:#0369a1;border:1px solid #bae6fd}
.pt-dl-ghost:hover{background:#f0f9ff}
.pt-main{max-width:1040px;margin:0 auto;padding:22px 16px 48px}
.pt-panel{display:flex;flex-direction:column;gap:16px}
.pt-hidden{display:none}
.pt-card{background:#fff;border:1px solid #edf1f6;border-radius:14px;padding:20px 24px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.pt-label{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#94a3b8;margin:0 0 11px}
.pt-label-accent{color:#0284c7}
/* Cover — editorial opening, not a marketing hero */
.pt-cover{padding:6px 2px 2px}
.pt-cover-kick{font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#0284c7;margin-bottom:8px}
/* Executive read — the one-line LeadLens portfolio verdict */
.pt-exec{background:linear-gradient(180deg,#f0f9ff,#f8fbff);border:1px solid #cfe9fb;border-left:4px solid #0ea5e9;border-radius:12px;padding:16px 20px}
.pt-exec-k{display:block;font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#0369a1;margin-bottom:6px}
.pt-exec-t{font-size:15.5px;line-height:1.55;color:#0c344e;margin:0;font-weight:500}
/* What Changed — LeadLens signature block */
.pt-signal{border-left:4px solid #0ea5e9;background:linear-gradient(180deg,#f7fcff,#fff)}
.pt-note{font-size:12px;color:#94a3b8;margin:8px 0 0;line-height:1.55}
.pt-muted{color:#94a3b8}
.pt-muted-p{font-size:12.5px;color:#94a3b8;margin:0}
.pt-h1{font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.2;margin:4px 2px 8px;max-width:42rem}
.pt-sub{font-size:14.5px;color:#475569;line-height:1.6;margin:0 2px 4px;max-width:46rem}
.pt-p{font-size:14px;line-height:1.6;color:#1e293b;margin:0}
.pt-sep{margin-top:12px;padding-top:12px;border-top:1px solid #f1f5f9}
.pt-bar{display:flex;height:10px;border-radius:6px;overflow:hidden;background:#eef2f7;margin-bottom:10px}
.pt-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;color:#475569}
.pt-leg{display:inline-flex;align-items:center;gap:6px}
.pt-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
.pt-alloc{margin-top:12px;padding-top:12px;border-top:1px solid #f1f5f9}
.pt-alloc-l{font-size:13px;font-weight:700;color:#0f172a}
.pt-alloc-d{font-size:12.5px;color:#475569;line-height:1.55;margin:4px 0 0}
.pt-focus{display:flex;flex-direction:column}
.pt-focus-i{appearance:none;background:none;border:none;border-top:1px solid #f1f5f9;padding:12px 4px;min-height:44px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;font-family:inherit;text-align:left;width:100%}
.pt-focus-i:first-child{border-top:none}
.pt-focus-i:hover{background:#f8fafc}
.pt-focus-n{font-size:14px;font-weight:700;color:#0f172a}
.pt-focus-m{display:inline-flex;align-items:center;gap:10px}
.pt-focus-age{font-size:11.5px;color:#94a3b8}
.pt-badge{display:inline-flex;align-items:center;gap:5px;border:1px solid;border-radius:999px;padding:3px 11px;font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
.pt-badge .pt-dot{width:6px;height:6px}
.pt-vq-i{display:flex;align-items:baseline;gap:12px;padding:9px 0;border-top:1px solid #f1f5f9;flex-wrap:wrap}
.pt-vq-i:first-child{border-top:none}
.pt-vq-n{appearance:none;background:none;border:none;cursor:pointer;font-family:inherit;font-size:13.5px;font-weight:700;color:#0f172a;display:inline-flex;align-items:center;gap:7px;padding:0;min-width:150px;text-align:left}
.pt-vq-n:hover{color:#0369a1}
.pt-vq-n .pt-dot{width:7px;height:7px}
.pt-vq-f{font-size:13px;color:#475569;flex:1;min-width:180px}
.pt-cov{display:flex;gap:28px;flex-wrap:wrap}
.pt-cov-n{display:block;font-size:22px;font-weight:800;color:#0f172a}
.pt-cov-l{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;font-weight:700}
.pt-limits{background:#fffbeb;border-color:#fde68a}
.pt-limlist{margin:0;padding-left:18px;font-size:12.5px;color:#92400e;line-height:1.6}
.pt-context>summary,.pt-context>summary{list-style:none;cursor:pointer}
.pt-context>summary::-webkit-details-marker{display:none}
.pt-csum{font-size:13px;font-weight:800;color:#0369a1;padding:2px 0}
.pt-csum::after{content:" ▾";color:#94a3b8;font-size:11px}
details[open]>.pt-csum::after{content:" ▴"}
.pt-cbody{margin-top:12px;padding-top:12px;border-top:1px solid #f1f5f9}
.pt-row{display:flex;gap:10px;padding:5px 0;flex-wrap:wrap}
.pt-k{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;width:120px;flex-shrink:0;padding-top:2px}
.pt-v{font-size:13px;color:#334155;flex:1;min-width:180px}
.pt-crit{margin:0;padding-left:16px;font-size:13px;color:#334155;line-height:1.6;flex:1;min-width:180px}
.pt-accts{display:grid;grid-template-columns:288px 1fr;gap:18px;align-items:start}
.pt-nav{position:sticky;top:57px;background:#fff;border:1px solid #e8edf3;border-radius:12px;padding:10px;max-height:calc(100vh - 80px);overflow-y:auto}
.pt-nav-h{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#94a3b8;padding:6px 8px 10px}
.pt-nav-l{display:flex;flex-direction:column;gap:3px}
.pt-nav-i{appearance:none;background:none;border:none;border-radius:9px;padding:9px 10px;min-height:44px;display:flex;align-items:center;gap:10px;cursor:pointer;font-family:inherit;text-align:left;width:100%}
.pt-nav-i:hover{background:#f1f5f9}
.pt-nav-i.is-active{background:#e0f2fe}
.pt-nav-r{font-size:12px;font-weight:800;color:#94a3b8;width:18px;flex-shrink:0;text-align:center}
.pt-nav-i.is-active .pt-nav-r{color:#0284c7}
.pt-nav-b{display:flex;flex-direction:column;min-width:0}
.pt-nav-n{font-size:13.5px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pt-nav-s{font-size:11px;color:#64748b;display:inline-flex;align-items:center;gap:5px;margin-top:1px}
.pt-nav-s .pt-dot{width:6px;height:6px}
.pt-briefs{min-width:0}
.pt-brief{display:flex;flex-direction:column;gap:14px}
.pt-bh{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}
.pt-bh-name{font-size:21px;font-weight:800;color:#0f172a;margin:0 0 4px;letter-spacing:-.01em;line-height:1.15}
.pt-rank{color:#cbd5e1}
.pt-bh-sub{font-size:12.5px;color:#94a3b8}
.pt-bh-r{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.pt-fresh{font-size:11px;color:#94a3b8;font-weight:600}
.pt-dims{display:flex;gap:22px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid #f1f5f9}
.pt-dim-k{font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8}
.pt-dim-v{font-size:15px;line-height:1.2}
.pt-dim-n{font-size:10.5px;color:#94a3b8}
.pt-chgs{display:flex;flex-direction:column;gap:8px}
.pt-chg{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.pt-chg-dot{width:7px;height:7px;border-radius:50%;background:#0ea5e9;flex-shrink:0;transform:translateY(2px)}
.pt-chg-e{flex:1;min-width:180px;font-weight:600;font-size:14px;color:#1e293b;line-height:1.5}
.pt-chg-a{font-size:11.5px;color:#94a3b8;font-weight:600;white-space:nowrap}
.pt-chg-s{font-size:11px;color:#cbd5e1}
.pt-ev-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.pt-ev-b{font-size:11.5px;color:#64748b;font-weight:600}
.pt-srcs{display:flex;flex-direction:column;gap:9px}
.pt-src{display:flex;flex-direction:column;gap:2px;padding-bottom:9px}
.pt-src-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pt-rel{font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
.pt-src a{font-size:13px;font-weight:600;color:#0369a1;text-decoration:none;word-break:break-word}
.pt-src-l{font-size:13px;font-weight:600;color:#334155;word-break:break-word}
.pt-src-a{font-size:11px;color:#94a3b8;white-space:nowrap}
.pt-src-c{font-size:12.5px;color:#475569;margin:0;line-height:1.5}
.pt-bl{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:7px}
.pt-bl li{display:flex;gap:9px;align-items:baseline}
.pt-bl-d{width:5px;height:5px;border-radius:50%;flex-shrink:0;transform:translateY(4px)}
.pt-bl li span:last-child{font-size:13px;line-height:1.55;color:#334155}
.pt-dec-h{display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap}
.pt-ev-head{appearance:none;background:none;border:none;width:100%;display:flex;align-items:center;justify-content:flex-start;gap:10px;cursor:pointer;font-family:inherit;font-size:15px;font-weight:800;color:#0f172a;padding:0}
.pt-chips{display:flex;flex-wrap:wrap;gap:6px}
.pt-chip{appearance:none;background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:5px 11px;min-height:30px;font-size:12px;font-weight:600;color:#475569;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:5px}
.pt-chip .pt-dot{width:6px;height:6px}
.pt-chip.is-active{background:#e0f2fe;border-color:#7dd3fc;color:#0369a1}
.pt-chip:disabled{opacity:.4;cursor:not-allowed}
.pt-insight{background:#f0f9ff;border-color:#bae6fd}
.pt-insight-t{font-size:14px;color:#0c4a6e;line-height:1.6;margin:0}
.pt-cmp-wrap{overflow-x:auto}
.pt-cmp{border-collapse:collapse;width:100%;min-width:520px}
.pt-cmp th,.pt-cmp td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid #f1f5f9}
.pt-cmp-rh{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#94a3b8;white-space:nowrap;background:#fafbfc;position:sticky;left:0}
.pt-cmp-col{border-bottom:2px solid #e2e8f0;min-width:150px}
.pt-cmp-name{appearance:none;background:none;border:none;cursor:pointer;font-family:inherit;font-size:14px;font-weight:800;color:#0f172a;padding:0;display:block;text-align:left}
.pt-cmp-sub{font-size:11px;color:#94a3b8;display:block;margin-top:2px}
.pt-cmp-t{font-size:12.5px;color:#475569;line-height:1.5}
.pt-leg-l{list-style:none;margin:6px 0 0;padding:0;display:flex;flex-direction:column;gap:8px;font-size:13px;color:#475569}
.pt-leg-l li{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.pt-leg-t li{display:block;line-height:1.55}
.pt-foot{text-align:center;font-size:10.5px;color:#cbd5e1;padding:8px 16px 26px;line-height:1.5}
@media (max-width:820px){.pt-accts{grid-template-columns:1fr;gap:12px}.pt-nav{position:static;max-height:none}.pt-nav-l{flex-direction:row;overflow-x:auto;gap:8px;padding-bottom:2px}.pt-nav-i{flex:0 0 auto;min-width:168px;border:1px solid #e8edf3}.pt-nav-i.is-active{border-color:#7dd3fc}}
@media (max-width:640px){.pt-main,.pt-dlbar{padding-left:12px;padding-right:12px}.pt-card{padding:15px 16px}.pt-h1{font-size:20px}.pt-top{padding:13px 16px}}
@media print{@page{margin:14mm}.pt-tabs,.pt-dlbar,.pt-nav,.pt-foot{display:none!important}.pt-hidden{display:flex!important}.pt-root{background:#fff}.pt-accts{grid-template-columns:1fr}.pt-card{box-shadow:none;break-inside:avoid;border-color:#d7dee7}.pt-cmp{min-width:0}.pt-brief{break-inside:avoid}h1,h2,.pt-label{break-after:avoid}}
`;

// ─── Inline runtime JS (vanilla, no eval, no network) ─────────────────────────
const JS = `(function(){
  "use strict";
  var data={};try{data=JSON.parse(document.getElementById("pt-data").textContent||"{}");}catch(e){}
  function $all(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function show(id){$all(".pt-panel").forEach(function(p){p.classList.toggle("pt-hidden",p.id!=="panel-"+id);});$all(".pt-tab").forEach(function(t){t.classList.toggle("is-active",t.getAttribute("data-tab")===id);});}
  // Tabs
  $all(".pt-tab").forEach(function(t){t.addEventListener("click",function(){show(t.getAttribute("data-tab"));});});
  // Account switching — hide all briefs but the selected one
  function selectAccount(id){
    $all(".pt-brief").forEach(function(b){b.style.display=b.getAttribute("data-brief")===id?"":"none";});
    $all(".pt-nav-i").forEach(function(n){n.classList.toggle("is-active",n.getAttribute("data-acct")===id);});
  }
  var firstNav=document.querySelector(".pt-nav-i");if(firstNav){selectAccount(firstNav.getAttribute("data-acct"));}
  $all(".pt-nav-i").forEach(function(n){n.addEventListener("click",function(){selectAccount(n.getAttribute("data-acct"));});});
  // Go-to-account links (portfolio / evidence / compare)
  $all("[data-goacct]").forEach(function(el){el.addEventListener("click",function(){show("accounts");selectAccount(el.getAttribute("data-goacct"));window.scrollTo(0,0);});});
  // Compare selection (max 4) — toggle column visibility
  function selectedCmp(){return $all(".pt-chip.is-active").map(function(c){return c.getAttribute("data-cmp");});}
  function applyCmp(){var sel=selectedCmp();$all("[data-cmpcol]").forEach(function(c){c.style.display=sel.indexOf(c.getAttribute("data-cmpcol"))>-1?"":"none";});
    var full=sel.length>=4;$all(".pt-chip").forEach(function(c){var on=c.classList.contains("is-active");c.disabled=full&&!on;});}
  $all(".pt-chip").forEach(function(c){c.addEventListener("click",function(){var on=c.classList.contains("is-active");if(!on&&selectedCmp().length>=4)return;c.classList.toggle("is-active");applyCmp();});});
  applyCmp();
  // CSV downloads from embedded data
  function dl(name,text){try{var blob=new Blob([text],{type:"text/csv;charset=utf-8"});var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);}catch(e){}}
  var pb=document.getElementById("pt-dl-portfolio");if(pb){pb.addEventListener("click",function(){dl(data.portfolioCsvName||"portfolio.csv",data.portfolioCsv||"");});}
  var eb=document.getElementById("pt-dl-evidence");if(eb){eb.addEventListener("click",function(){dl(data.evidenceCsvName||"evidence.csv",data.evidenceCsv||"");});}
  var pr=document.getElementById("pt-print");if(pr){pr.addEventListener("click",function(){window.print();});}
})();`;
