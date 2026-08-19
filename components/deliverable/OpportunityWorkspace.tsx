"use client";
// ─── LeadLens Opportunity Portfolio — interactive customer deliverable ─────────
// The premium, application-style customer experience: a portfolio navigator +
// dynamic Account Brief + meaningful section tabs. Receives an ALREADY-ASSEMBLED,
// ALREADY-AUTHORIZED DeliverableViewModel (never the raw report snapshot, never a
// fetch) — the curated view model is the only thing that reaches the browser.
// Generic by construction — it renders any report the adapters normalize, not a
// specific customer. Desktop = app layout with a persistent navigator; mobile =
// horizontal account switcher + scrollable tabs + progressive disclosure.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeliverableViewModel, DecisionState } from "@/lib/deliverable/deliverable-view-model";
import { DECISION_TOKENS, decisionLabel } from "@/lib/deliverable/deliverable-view-model";
import { AccountBrief, DecisionBadge, SourceList } from "./primitives";

type Tab = "portfolio" | "accounts" | "evidence" | "downloads";
const DECISION_ORDER: DecisionState[] = ["prioritize", "validate", "monitor", "hold"];

export default function OpportunityWorkspace({ vm }: { vm: DeliverableViewModel }) {
  const es = vm.meta.language === "es";
  const t = useMemo(() => LABELS(es), [es]);

  const tabs = useMemo<Tab[]>(() => {
    const list: Tab[] = [];
    if (vm.capabilities.showPortfolioTab) list.push("portfolio");
    list.push("accounts");
    if (vm.capabilities.showEvidenceTab) list.push("evidence");
    if (vm.capabilities.showDownloadsTab) list.push("downloads");
    return list;
  }, [vm]);

  const [tab, setTab] = useState<Tab>(tabs[0] ?? "accounts");
  const [accountId, setAccountId] = useState<string>(vm.accounts[0]?.id ?? "");

  // Hydrate selection from the URL (deep-link), then keep the URL in sync via
  // replaceState — reload-free, and it does not spam browser history (§101/§102).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const qTab = p.get("tab") as Tab | null;
    const qAcc = p.get("account");
    if (qTab && tabs.includes(qTab)) setTab(qTab);
    if (qAcc && vm.accounts.some((a) => a.id === qAcc)) setAccountId(qAcc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = useCallback((nextTab: Tab, nextAcc: string) => {
    try {
      const p = new URLSearchParams(window.location.search);
      p.set("tab", nextTab);
      if (nextAcc) p.set("account", nextAcc);
      window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
    } catch { /* SSR / restricted history — selection still works in-memory */ }
  }, []);

  const goTab = (nx: Tab) => { setTab(nx); sync(nx, accountId); };
  const openAccount = (id: string) => { setAccountId(id); setTab("accounts"); sync("accounts", id); };

  const active = vm.accounts.find((a) => a.id === accountId) ?? vm.accounts[0] ?? null;

  return (
    <div className="dlv-root">
      <style>{CSS}</style>

      {/* Top bar — institutional identity, subtle branding (§74/§75) */}
      <header className="dlv-topbar">
        <div className="dlv-brand">
          <span className="dlv-logo">Lead<span style={{ color: "#38bdf8" }}>Lens</span></span>
          <span className="dlv-kicker">{t.portfolioTitle}</span>
        </div>
        <div className="dlv-meta">
          {vm.meta.client && <span><strong>{vm.meta.client}</strong></span>}
          {vm.meta.market && <span>· {vm.meta.market}</span>}
          {vm.meta.tierLabel && <span className="dlv-tier">{vm.meta.tierLabel}</span>}
          {vm.meta.generatedLabel && <span>· {t.generated} {vm.meta.generatedLabel}</span>}
        </div>
      </header>

      {/* Tabs — meaningful navigation, not an endless scroll (§57) */}
      <nav className="dlv-tabs" role="tablist" aria-label={t.sections}>
        {tabs.map((tb) => (
          <button key={tb} role="tab" aria-selected={tab === tb} className={`dlv-tab ${tab === tb ? "is-active" : ""}`} onClick={() => goTab(tb)}>
            {t.tab[tb]}
          </button>
        ))}
      </nav>

      <main className="dlv-main" role="tabpanel">
        {tab === "portfolio" && vm.capabilities.showPortfolioTab && <PortfolioTab vm={vm} t={t} es={es} onOpen={openAccount} />}

        {tab === "accounts" && (
          <div className="dlv-accounts">
            <AccountNav vm={vm} activeId={active?.id ?? ""} onSelect={openAccount} es={es} t={t} />
            <section className="dlv-brief">
              {active ? <AccountBrief a={active} es={es} /> : <Empty text={t.emptyPortfolio} />}
            </section>
          </div>
        )}

        {tab === "evidence" && vm.capabilities.showEvidenceTab && <EvidenceTab vm={vm} t={t} es={es} onOpen={openAccount} />}

        {tab === "downloads" && vm.capabilities.showDownloadsTab && <DownloadsTab vm={vm} t={t} />}
      </main>

      <footer className="dlv-footer">
        LeadLens · {t.aoi}{vm.meta.schemaVersion ? ` · brief v${vm.meta.schemaVersion}` : ""}{vm.meta.generatedLabel ? ` · ${vm.meta.generatedLabel}` : ""}
      </footer>
    </div>
  );
}

// ─── Portfolio navigator (desktop sidebar / mobile horizontal switcher) ───────
function AccountNav({ vm, activeId, onSelect, es, t }: { vm: DeliverableViewModel; activeId: string; onSelect: (id: string) => void; es: boolean; t: L }) {
  return (
    <aside className="dlv-nav" aria-label={t.accounts}>
      <div className="dlv-nav-head">{t.accounts} · {vm.accounts.length}</div>
      <div className="dlv-nav-list" role="listbox" aria-label={t.accounts}>
        {vm.accounts.map((a) => {
          const s = DECISION_TOKENS[a.decision];
          const on = a.id === activeId;
          return (
            <button key={a.id} role="option" aria-selected={on} className={`dlv-nav-item ${on ? "is-active" : ""}`} onClick={() => onSelect(a.id)}>
              <span className="dlv-nav-rank">{a.rank ?? "·"}</span>
              <span className="dlv-nav-body">
                <span className="dlv-nav-name">{a.company}</span>
                <span className="dlv-nav-sub">
                  <span className="dlv-nav-dot" style={{ background: s.dot }} />
                  {decisionLabel(a.decision, es)}{a.freshness?.age ? ` · ${a.freshness.age}` : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

// ─── Portfolio tab — "where should I focus?" ──────────────────────────────────
function PortfolioTab({ vm, t, es, onOpen }: { vm: DeliverableViewModel; t: L; es: boolean; onOpen: (id: string) => void }) {
  const total = vm.portfolio.total || 1;
  const priority = vm.accounts.filter((a) => a.decision === "prioritize" || a.decision === "validate");
  return (
    <div className="dlv-panel">
      {(vm.headline || vm.summary) && (
        <div className="dlv-hero">
          {vm.headline && <h1 className="dlv-hero-h1">{vm.headline}</h1>}
          {vm.summary && <p className="dlv-hero-sub">{vm.summary}</p>}
        </div>
      )}

      {/* Decision distribution */}
      <div className="dlv-card">
        <p className="dlv-label">{t.distribution}</p>
        <div className="dlv-distbar">
          {DECISION_ORDER.map((k) => {
            const v = vm.portfolio.counts[k];
            return v > 0 ? <div key={k} title={`${decisionLabel(k, es)}: ${v}`} style={{ width: `${(v / total) * 100}%`, background: DECISION_TOKENS[k].dot }} /> : null;
          })}
        </div>
        <div className="dlv-distlegend">
          {DECISION_ORDER.map((k) => (
            <span key={k} className="dlv-distitem">
              <span className="dlv-nav-dot" style={{ background: DECISION_TOKENS[k].dot }} />
              <strong>{vm.portfolio.counts[k]}</strong> {decisionLabel(k, es).toLowerCase()}
            </span>
          ))}
        </div>
        {vm.portfolio.allocation && (
          <div className="dlv-alloc">
            <div className="dlv-alloc-line">{vm.portfolio.allocation.line}</div>
            <p className="dlv-alloc-detail">{vm.portfolio.allocation.detail}</p>
          </div>
        )}
        {vm.portfolio.funnel && (
          <p className="dlv-funnel"><strong>{vm.portfolio.funnel.considered}</strong> {t.considered} → <strong>{vm.portfolio.funnel.rejected}</strong> {t.filtered} → <strong style={{ color: "#0369a1" }}>{vm.portfolio.funnel.selected}</strong> {t.selected}</p>
        )}
        {vm.portfolio.note && <p className="dlv-note">{vm.portfolio.note}</p>}
      </div>

      {/* Where to focus */}
      {priority.length > 0 && (
        <div className="dlv-card">
          <p className="dlv-label">{t.whereFocus}</p>
          <div className="dlv-focus-list">
            {priority.map((a) => (
              <button key={a.id} className="dlv-focus-item" onClick={() => onOpen(a.id)}>
                <span className="dlv-focus-name">{a.rank ? `${a.rank}. ` : ""}{a.company}</span>
                <span className="dlv-focus-meta">
                  <DecisionBadge state={a.decision} es={es} small />
                  {a.freshness?.age && <span className="dlv-focus-age">{a.freshness.age} {t.ago}</span>}
                  <span className="dlv-focus-arrow">→</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Coverage */}
      {vm.coverage && (
        <div className="dlv-card">
          <p className="dlv-label">{t.coverage}</p>
          <div className="dlv-cov">
            <div><span className="dlv-cov-num">{vm.coverage.withDatedEvidence}</span><span className="dlv-cov-lbl">{t.withDated}</span></div>
            <div><span className="dlv-cov-num">{vm.coverage.withSources}</span><span className="dlv-cov-lbl">{t.withSources}</span></div>
            {vm.coverage.grade && <div><span className="dlv-cov-num">{vm.coverage.grade}</span><span className="dlv-cov-lbl">{t.evidenceGrade}</span></div>}
          </div>
          {vm.coverage.note && <p className="dlv-note">{vm.coverage.note}</p>}
        </div>
      )}

      {vm.limitations.length > 0 && (
        <div className="dlv-card dlv-limits">
          <p className="dlv-label" style={{ color: "#b45309" }}>{t.whatIsnt}</p>
          <ul className="dlv-limits-list">{vm.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ─── Evidence tab — cross-account provenance (§61/§77) ────────────────────────
function EvidenceTab({ vm, t, es, onOpen }: { vm: DeliverableViewModel; t: L; es: boolean; onOpen: (id: string) => void }) {
  const withSources = vm.accounts.filter((a) => a.sources.length > 0);
  return (
    <div className="dlv-panel">
      <div className="dlv-card">
        <p className="dlv-label">{t.evidenceAcross}</p>
        <p className="dlv-note" style={{ marginTop: 0 }}>{t.evidenceLede}</p>
      </div>
      {withSources.map((a) => (
        <div key={a.id} className="dlv-card">
          <button className="dlv-ev-head" onClick={() => onOpen(a.id)}>
            <span>{a.rank ? `${a.rank}. ` : ""}{a.company}</span>
            <DecisionBadge state={a.decision} es={es} small />
          </button>
          <div style={{ marginTop: 10 }}><SourceList sources={a.sources} es={es} /></div>
        </div>
      ))}
    </div>
  );
}

// ─── Downloads tab — portable exports (§62/§63). Only real capabilities. ──────
function DownloadsTab({ vm, t }: { vm: DeliverableViewModel; t: L }) {
  return (
    <div className="dlv-panel">
      <div className="dlv-card">
        <p className="dlv-label">{t.downloads}</p>
        <p className="dlv-note" style={{ marginTop: 0 }}>{t.downloadsLede}</p>
        <div className="dlv-dl-actions">
          {vm.downloads.pdf && <button className="dlv-dl-btn" onClick={() => window.print()}>{t.printPdf}</button>}
          {vm.downloads.csv && <span className="dlv-dl-note">CSV</span>}
          {!vm.downloads.pdf && !vm.downloads.csv && <span className="dlv-note">{t.noDownloads}</span>}
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="dlv-card"><p className="dlv-note" style={{ margin: 0 }}>{text}</p></div>;
}

// ─── i18n (UI chrome only — report content keeps its source language, §72/§73) ─
type L = ReturnType<typeof LABELS>;
function LABELS(es: boolean) {
  return {
    portfolioTitle: es ? "Portafolio de Oportunidades" : "Opportunity Portfolio",
    aoi: es ? "Inteligencia de Oportunidades de Cuenta" : "Account Opportunity Intelligence",
    generated: es ? "generado" : "generated",
    sections: es ? "Secciones" : "Sections",
    accounts: es ? "Cuentas" : "Accounts",
    tab: {
      portfolio: es ? "Portafolio" : "Portfolio",
      accounts: es ? "Cuentas" : "Account Briefs",
      evidence: es ? "Evidencia" : "Evidence",
      downloads: es ? "Descargas" : "Downloads",
    } as Record<Tab, string>,
    distribution: es ? "Distribución de decisiones" : "Decision distribution",
    whereFocus: es ? "Dónde enfocarte" : "Where to focus",
    coverage: es ? "Cobertura de evidencia" : "Evidence coverage",
    withDated: es ? "con evidencia fechada" : "with dated evidence",
    withSources: es ? "con fuentes" : "with sources",
    evidenceGrade: es ? "solidez de evidencia" : "evidence strength",
    considered: es ? "consideradas" : "considered",
    filtered: es ? "filtradas" : "filtered out",
    selected: es ? "seleccionadas" : "selected",
    whatIsnt: es ? "Qué NO es este portafolio" : "What this portfolio isn't",
    evidenceAcross: es ? "Evidencia por cuenta" : "Evidence across accounts",
    evidenceLede: es ? "Cada conclusión es inspeccionable: fuente, fecha y qué establece." : "Every conclusion is inspectable: source, date, and what it establishes.",
    downloads: es ? "Exportar" : "Export",
    downloadsLede: es ? "El producto interactivo es la experiencia principal; la exportación es para compartir." : "The interactive product is the primary experience; export is for sharing.",
    printPdf: es ? "Imprimir / Guardar PDF" : "Print / Save as PDF",
    noDownloads: es ? "Sin exportaciones disponibles para este informe." : "No exports available for this report.",
    emptyPortfolio: es ? "Este portafolio no contiene cuentas todavía." : "This portfolio contains no accounts yet.",
    ago: es ? "atrás" : "ago",
  };
}

const CSS = `
.dlv-root { background: #f4f7fb; min-height: 100vh; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color: #0f172a; }
.dlv-topbar { background: linear-gradient(120deg,#0b1220,#12314f 62%,#0c4a6e); color: #fff; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.dlv-brand { display: flex; align-items: baseline; gap: 12px; }
.dlv-logo { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
.dlv-kicker { font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #7dd3fc; }
.dlv-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: #cbd5e1; }
.dlv-meta strong { color: #fff; }
.dlv-tier { background: rgba(56,189,248,0.16); color: #7dd3fc; border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 700; }
.dlv-tabs { position: sticky; top: 0; z-index: 20; display: flex; gap: 2px; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 0 16px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.dlv-tabs::-webkit-scrollbar { display: none; }
.dlv-tab { appearance: none; background: none; border: none; border-bottom: 2px solid transparent; padding: 14px 16px; min-height: 44px; font-size: 13.5px; font-weight: 700; color: #64748b; cursor: pointer; white-space: nowrap; font-family: inherit; }
.dlv-tab:hover { color: #0f172a; }
.dlv-tab.is-active { color: #0369a1; border-bottom-color: #0284c7; }
.dlv-main { max-width: 1100px; margin: 0 auto; padding: 22px 16px 40px; }
.dlv-panel { display: flex; flex-direction: column; gap: 14px; }
.dlv-card { background: #fff; border: 1px solid #e8edf3; border-radius: 12px; padding: 18px 20px; box-shadow: 0 1px 2px rgba(15,23,42,0.03); }
.dlv-label { font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #94a3b8; margin: 0 0 10px; }
.dlv-note { font-size: 12px; color: #94a3b8; margin: 8px 0 0; line-height: 1.55; }
.dlv-hero { padding: 4px 2px 2px; }
.dlv-hero-h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; margin: 0 0 8px; max-width: 42rem; }
.dlv-hero-sub { font-size: 14.5px; color: #475569; line-height: 1.6; margin: 0; max-width: 46rem; }
.dlv-distbar { display: flex; height: 10px; border-radius: 6px; overflow: hidden; background: #eef2f7; margin-bottom: 10px; }
.dlv-distlegend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12.5px; color: #475569; }
.dlv-distitem { display: inline-flex; align-items: center; gap: 6px; }
.dlv-nav-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; flex-shrink: 0; }
.dlv-alloc { margin-top: 12px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
.dlv-alloc-line { font-size: 13px; font-weight: 700; color: #0f172a; }
.dlv-alloc-detail { font-size: 12.5px; color: #475569; line-height: 1.55; margin: 4px 0 0; }
.dlv-funnel { font-size: 12.5px; color: #475569; margin: 12px 0 0; padding-top: 12px; border-top: 1px solid #f1f5f9; }
.dlv-focus-list { display: flex; flex-direction: column; }
.dlv-focus-item { appearance: none; background: none; border: none; border-top: 1px solid #f1f5f9; padding: 12px 4px; min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; font-family: inherit; text-align: left; width: 100%; }
.dlv-focus-item:first-child { border-top: none; }
.dlv-focus-item:hover { background: #f8fafc; }
.dlv-focus-name { font-size: 14px; font-weight: 700; color: #0f172a; }
.dlv-focus-meta { display: inline-flex; align-items: center; gap: 10px; }
.dlv-focus-age { font-size: 11.5px; color: #94a3b8; }
.dlv-focus-arrow { color: #cbd5e1; font-weight: 700; }
.dlv-cov { display: flex; gap: 28px; flex-wrap: wrap; }
.dlv-cov-num { display: block; font-size: 22px; font-weight: 800; color: #0f172a; }
.dlv-cov-lbl { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; font-weight: 700; }
.dlv-limits { background: #fffbeb; border-color: #fde68a; }
.dlv-limits-list { margin: 0; padding-left: 18px; font-size: 12.5px; color: #92400e; line-height: 1.6; }
.dlv-ev-head { appearance: none; background: none; border: none; width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 800; color: #0f172a; padding: 0; }
.dlv-dl-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
.dlv-dl-btn { appearance: none; background: #0284c7; color: #fff; border: none; border-radius: 9px; padding: 11px 18px; min-height: 44px; font-size: 13.5px; font-weight: 700; cursor: pointer; font-family: inherit; }
.dlv-dl-btn:hover { background: #0369a1; }
.dlv-footer { text-align: center; font-size: 10.5px; color: #cbd5e1; padding: 8px 16px 26px; }

/* Accounts layout: desktop = persistent left navigator + brief; mobile = top switcher */
.dlv-accounts { display: grid; grid-template-columns: 288px 1fr; gap: 18px; align-items: start; }
.dlv-nav { position: sticky; top: 57px; background: #fff; border: 1px solid #e8edf3; border-radius: 12px; padding: 10px; max-height: calc(100vh - 80px); overflow-y: auto; }
.dlv-nav-head { font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #94a3b8; padding: 6px 8px 10px; }
.dlv-nav-list { display: flex; flex-direction: column; gap: 3px; }
.dlv-nav-item { appearance: none; background: none; border: none; border-radius: 9px; padding: 9px 10px; min-height: 44px; display: flex; align-items: center; gap: 10px; cursor: pointer; font-family: inherit; text-align: left; width: 100%; }
.dlv-nav-item:hover { background: #f1f5f9; }
.dlv-nav-item.is-active { background: #e0f2fe; }
.dlv-nav-rank { font-size: 12px; font-weight: 800; color: #94a3b8; width: 18px; flex-shrink: 0; text-align: center; }
.dlv-nav-item.is-active .dlv-nav-rank { color: #0284c7; }
.dlv-nav-body { display: flex; flex-direction: column; min-width: 0; }
.dlv-nav-name { font-size: 13.5px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dlv-nav-sub { font-size: 11px; color: #64748b; display: inline-flex; align-items: center; gap: 5px; margin-top: 1px; }
.dlv-nav-sub .dlv-nav-dot { width: 6px; height: 6px; border-radius: 50%; }
.dlv-brief { min-width: 0; }

@media (max-width: 820px) {
  .dlv-accounts { grid-template-columns: 1fr; gap: 12px; }
  .dlv-nav { position: static; max-height: none; padding: 8px; }
  .dlv-nav-head { padding: 4px 6px 8px; }
  .dlv-nav-list { flex-direction: row; overflow-x: auto; -webkit-overflow-scrolling: touch; gap: 8px; scrollbar-width: none; padding-bottom: 2px; }
  .dlv-nav-list::-webkit-scrollbar { display: none; }
  .dlv-nav-item { flex: 0 0 auto; min-width: 168px; border: 1px solid #e8edf3; }
  .dlv-nav-item.is-active { border-color: #7dd3fc; }
}
@media (max-width: 640px) {
  .dlv-main { padding: 14px 12px 32px; }
  .dlv-card { padding: 15px 16px; }
  .dlv-hero-h1 { font-size: 20px; }
  .dlv-topbar { padding: 13px 16px; }
  .dlv-cov { gap: 20px; }
}
@media print {
  .dlv-tabs, .dlv-nav, .dlv-dl-actions, .dlv-footer { display: none !important; }
  .dlv-root { background: #fff; }
  .dlv-accounts { grid-template-columns: 1fr; }
  .dlv-card { box-shadow: none; break-inside: avoid; }
}
`;
