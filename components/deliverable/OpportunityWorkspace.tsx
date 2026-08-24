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
import type { DeliverableViewModel, DecisionState, AccountBriefVM } from "@/lib/deliverable/deliverable-view-model";
import { DECISION_TOKENS, STRENGTH_TOKENS, decisionLabel, orderByAttention, accountRoleLabel, opportunityTypeLabel } from "@/lib/deliverable/deliverable-view-model";
import { portfolioCsv, evidenceCsv, deliverableFilename } from "@/lib/deliverable/exports";
import { toClientCanvasVM } from "@/lib/deliverable/client-canvas-vm";
import { buildPortfolioIntelligence } from "@/lib/deliverable/portfolio-intelligence";
import { snapshotAccountReview, diffAccountCase, sinceLastReview, type AccountReviewSnapshot } from "@/lib/deliverable/account-memory";
import { AccountBrief, DecisionBadge, SourceList } from "./primitives";

/** Optional Account Memory input for a second-or-later review (§68). Dormant when
 *  absent or on first review — no fake history (§65/§77). Diffs canonical
 *  structured state only (locale-independent). */
export interface WorkspaceMemory { current: { reviewId: string; reviewedAt: string; contextVersion: string }; previousById: Record<string, AccountReviewSnapshot> }

function SinceLastReview({ a, memory, es }: { a: AccountBriefVM; memory?: WorkspaceMemory; es: boolean }) {
  if (!memory) return null;
  const prev = memory.previousById[a.id]; if (!prev) return null;
  const summary = sinceLastReview(diffAccountCase(prev, snapshotAccountReview(a, memory.current)), es);
  if (!summary) return null;
  return (
    <div className="dlv-card dlv-mem">
      <p className="dlv-label">{summary.title}</p>
      <ul className="dlv-mem-l">{summary.items.map((it, i) => <li key={i} className={it.kind === "decision" ? "dlv-mem-decision" : undefined}>{it.text}</li>)}</ul>
    </div>
  );
}

type Tab = "portfolio" | "accounts" | "evidence" | "compare" | "intelligence";
const DECISION_ORDER: DecisionState[] = ["prioritize", "validate", "monitor", "hold"];

/** Client-side download of a text blob (customer action; no server round-trip). */
function downloadText(filename: string, text: string, mime: string) {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* download unavailable in this context */ }
}

export default function OpportunityWorkspace({ vm, memory }: { vm: DeliverableViewModel; memory?: WorkspaceMemory }) {
  const es = vm.meta.language === "es";
  const t = useMemo(() => LABELS(es), [es]);
  const cc = useMemo(() => toClientCanvasVM(vm), [vm]);   // client is the subject

  const tabs = useMemo<Tab[]>(() => {
    const list: Tab[] = [];
    if (vm.capabilities.showPortfolioTab) list.push("portfolio");
    list.push("accounts");
    if (vm.capabilities.showEvidenceTab) list.push("evidence");
    if (vm.capabilities.showCompareTab) list.push("compare");
    list.push("intelligence");
    return list;
  }, [vm]);

  const [tab, setTab] = useState<Tab>(tabs[0] ?? "accounts");
  const [accountId, setAccountId] = useState<string>(vm.accounts[0]?.id ?? "");
  const [decisionFilter, setDecisionFilter] = useState<DecisionState | "all">("all");

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
  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>, current: Tab) => {
    const index = tabs.indexOf(current);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    goTab(tabs[next]);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  };
  const openAccount = (id: string) => { setAccountId(id); setTab("accounts"); sync("accounts", id); };

  const active = vm.accounts.find((a) => a.id === accountId) ?? vm.accounts[0] ?? null;

  return (
    <div className="dlv-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Client header — the client is the subject; accounts are opportunities
          evaluated for that client. Light composition (no large dark header),
          in parity with the landing + portable Client Opportunity Canvas. */}
      <header className="dlv-topbar">
        <div className="dlv-brandline">
          <span className="dlv-logo">Lead<span style={{ color: "#0284c7" }}>Lens</span></span>
          <span className="dlv-kicker">{t.aoi}</span>
          {cc.tierLabel && <span className="dlv-tier">{cc.tierLabel}</span>}
        </div>
        <h1 className="dlv-client">{cc.subject}</h1>
        {cc.objective && <div className="dlv-obj"><span className="dlv-obj-k">{es ? "Objetivo comercial" : "Commercial objective"}</span> {cc.objective}</div>}
        <div className="dlv-clientmeta">
          {[cc.market, `${cc.opportunityCount} ${es ? "oportunidades evaluadas" : "opportunities evaluated"}`, cc.generatedLabel ? `${t.generated} ${cc.generatedLabel}` : null].filter(Boolean).join(" · ")}
        </div>
      </header>

      {/* Tabs — meaningful navigation, not an endless scroll (§57) */}
      <nav className="dlv-tabs" role="tablist" aria-label={t.sections}>
        {tabs.map((tb) => (
          <button key={tb} role="tab" aria-selected={tab === tb} tabIndex={tab === tb ? 0 : -1} className={`dlv-tab ${tab === tb ? "is-active" : ""}`} onClick={() => goTab(tb)} onKeyDown={(event) => onTabKey(event, tb)}>
            {t.tab[tb]}
          </button>
        ))}
      </nav>

      <main className="dlv-main" role="tabpanel">
        {tab === "portfolio" && vm.capabilities.showPortfolioTab && <PortfolioTab vm={vm} t={t} es={es} onOpen={openAccount} onExplorePI={() => goTab("intelligence")} />}

        {tab === "accounts" && (
          <div className="dlv-accounts">
            <AccountNav vm={vm} activeId={active?.id ?? ""} onSelect={openAccount} es={es} t={t} filter={decisionFilter} onFilter={setDecisionFilter} />
            <section className="dlv-brief">
              {active ? <><SinceLastReview a={active} memory={memory} es={es} /><AccountBrief a={active} es={es} /></> : <Empty text={t.emptyPortfolio} />}
            </section>
          </div>
        )}

        {tab === "compare" && vm.capabilities.showCompareTab && <CompareTab vm={vm} t={t} es={es} onOpen={openAccount} />}

        {tab === "evidence" && vm.capabilities.showEvidenceTab && <EvidenceTab vm={vm} t={t} es={es} onOpen={openAccount} />}

        {tab === "intelligence" && <PortfolioIntelligenceTab vm={vm} t={t} es={es} onOpen={openAccount} />}
      </main>

      <UtilityBar vm={vm} t={t} es={es} />

      {/* Print/PDF-only: the full deliverable stacked in a stable reading order.
          Hidden on screen; the interactive main is hidden in print (§86–90). */}
      <PrintDocument vm={vm} t={t} es={es} />

      <footer className="dlv-footer">
        LeadLens · {t.aoi}{vm.meta.schemaVersion ? ` · brief v${vm.meta.schemaVersion}` : ""}{vm.meta.generatedLabel ? ` · ${vm.meta.generatedLabel}` : ""}
      </footer>
    </div>
  );
}

// ─── Print/PDF document — deliberate LeadLens export, not a screenshot ─────────
function PrintDocument({ vm, t, es }: { vm: DeliverableViewModel; t: L; es: boolean }) {
  return (
    <div className="dlv-print" aria-hidden>
      <div className="dlv-print-cover">
        <div className="dlv-logo" style={{ fontSize: 22 }}>Lead<span style={{ color: "#0284c7" }}>Lens</span></div>
        <div className="dlv-print-kicker">{t.portfolioTitle}{vm.meta.tierLabel ? ` · ${vm.meta.tierLabel}` : ""}</div>
        <div className="dlv-print-meta">{[vm.meta.client, vm.meta.market, vm.meta.generatedLabel].filter(Boolean).join(" · ")}</div>
        {vm.headline && <h1 className="dlv-print-h1">{vm.headline}</h1>}
        {vm.summary && <p className="dlv-print-sub">{vm.summary}</p>}
      </div>

      {/* Portfolio summary */}
      <div className="dlv-print-sec">
        <h2 className="dlv-print-h2">{t.distribution}</h2>
        <p className="dlv-cmp-txt">{DECISION_ORDER.map((k) => `${vm.portfolio.counts[k]} ${decisionLabel(k, es).toLowerCase()}`).join(" · ")}</p>
        {vm.portfolio.allocation && <p className="dlv-cmp-txt" style={{ marginTop: 6 }}>{vm.portfolio.allocation.detail}</p>}
      </div>

      {/* Account briefs */}
      {vm.accounts.map((a) => (
        <div key={a.id} className="dlv-print-brief">
          <AccountBrief a={a} es={es} />
        </div>
      ))}

      <div className="dlv-print-foot">{t.absenceNote} · LeadLens · {vm.meta.generatedLabel ?? ""}</div>
    </div>
  );
}

// ─── Portfolio navigator (desktop sidebar / mobile horizontal switcher) ───────
function AccountNav({ vm, activeId, onSelect, es, t, filter, onFilter }: { vm: DeliverableViewModel; activeId: string; onSelect: (id: string) => void; es: boolean; t: L; filter: DecisionState | "all"; onFilter: (f: DecisionState | "all") => void }) {
  const filters: (DecisionState | "all")[] = ["all", ...DECISION_ORDER.filter((d) => vm.accounts.some((a) => a.decision === d))];
  const ordered = orderByAttention(vm.accounts);
  const shown = filter === "all" ? ordered : ordered.filter((a) => a.decision === filter);
  return (
    <aside className="dlv-nav" aria-label={t.accounts}>
      <div className="dlv-nav-head">{t.accounts} · {shown.length}{filter !== "all" ? `/${vm.accounts.length}` : ""}</div>
      {vm.accounts.length > 3 && (
        <div className="dlv-nav-filter" role="group" aria-label={t.filterByDecision}>
          {filters.map((f) => (
            <button key={f} className={`dlv-filter-chip ${filter === f ? "is-active" : ""}`} aria-pressed={filter === f} onClick={() => onFilter(f)}>
              {f === "all" ? t.all : decisionLabel(f, es)}
            </button>
          ))}
        </div>
      )}
      <div className="dlv-nav-list" role="listbox" aria-label={t.accounts}>
        {shown.map((a) => {
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
function PortfolioTab({ vm, t, es, onOpen, onExplorePI }: { vm: DeliverableViewModel; t: L; es: boolean; onOpen: (id: string) => void; onExplorePI: () => void }) {
  const total = vm.portfolio.total || 1;
  const priority = orderByAttention(vm.accounts).filter((a) => a.decision === "prioritize" || a.decision === "validate");
  // Compact Portfolio Intelligence preview (§13-16): one cross-account signal +
  // one coverage statement + top theme/tension → invites the fifth tab. Depth
  // stays in the tab (§16/§63). Omitted when nothing is supported.
  const pi = buildPortfolioIntelligence(vm);
  const previewPattern = pi.changePatterns.find((p) => !p.notable) ?? pi.opportunityPatterns.find((p) => !p.notable) ?? null;
  const previewTension = pi.tensions[0] ?? null;
  const previewTheme = pi.validationThemes[0] ?? null;
  const coverageLine = pi.evidenceCoverage.statements[0] ?? null;
  const hasPreview = !!(previewPattern || coverageLine || previewTension || previewTheme);
  return (
    <div className="dlv-panel">
      {(vm.headline || vm.summary) && (
        <div className="dlv-hero">
          {vm.headline && <h1 className="dlv-hero-h1">{vm.headline}</h1>}
          {vm.summary && <p className="dlv-hero-sub">{vm.summary}</p>}
        </div>
      )}

      {hasPreview && (
        <div className="dlv-card dlv-intel-read">
          <p className="dlv-label">{pi.labels.title}</p>
          <ul className="dlv-limits-list" style={{ marginTop: 4 }}>
            {previewPattern && <li>{previewPattern.summary}</li>}
            {coverageLine && <li>{coverageLine}</li>}
            {previewTension && <li>{es ? `Tensión: ${previewTension.company}` : `Tension: ${previewTension.company}`} — {previewTension.meaning}</li>}
            {!previewTension && previewTheme && <li>{previewTheme.theme} · {previewTheme.summary}</li>}
          </ul>
          <button className="dlv-chip" style={{ marginTop: 8 }} onClick={onExplorePI}>{es ? "Explorar Inteligencia del portafolio →" : "Explore Portfolio Intelligence →"}</button>
        </div>
      )}

      {/* Commercial context — what LeadLens evaluated against (§62–65) */}
      {vm.commercialContext && (vm.commercialContext.clientDescription || vm.commercialContext.summary || vm.commercialContext.regions.length > 0 || vm.commercialContext.industries.length > 0 || vm.commercialContext.criteria.length > 0) && (
        <details className="dlv-card dlv-context">
          <summary className="dlv-context-summary">{t.commercialContext}</summary>
          <div className="dlv-context-body">
            {vm.commercialContext.clientDescription && <p className="dlv-context-p">{vm.commercialContext.clientDescription}</p>}
            {vm.commercialContext.summary && <p className="dlv-context-p">{vm.commercialContext.summary}</p>}
            {vm.commercialContext.industries.length > 0 && <div className="dlv-ctx-row"><span className="dlv-ctx-k">{t.ctxIndustries}</span><span className="dlv-ctx-v">{vm.commercialContext.industries.join(" · ")}</span></div>}
            {vm.commercialContext.regions.length > 0 && <div className="dlv-ctx-row"><span className="dlv-ctx-k">{t.ctxRegions}</span><span className="dlv-ctx-v">{vm.commercialContext.regions.join(" · ")}</span></div>}
            {vm.commercialContext.criteria.length > 0 && (
              <div className="dlv-ctx-row"><span className="dlv-ctx-k">{t.ctxCriteria}</span><ul className="dlv-ctx-crit">{vm.commercialContext.criteria.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
            )}
          </div>
        </details>
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

      {/* Validation queue — the portfolio as an actionable decision queue (§24–26) */}
      {vm.validationQueue.length > 0 && (
        <div className="dlv-card">
          <p className="dlv-label">{t.validationQueue}</p>
          <p className="dlv-note" style={{ marginTop: 0, marginBottom: 10 }}>{t.validationQueueLede}</p>
          <div className="dlv-vq">
            {vm.validationQueue.map((q) => (
              <div key={q.accountId} className="dlv-vq-item">
                <button className="dlv-vq-name" onClick={() => onOpen(q.accountId)}>
                  <span className="dlv-nav-dot" style={{ background: DECISION_TOKENS[q.decision].dot }} />
                  {q.company}
                </button>
                <span className="dlv-vq-first">{q.items[0]}{q.items.length > 1 ? ` (+${q.items.length - 1})` : ""}</span>
              </div>
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
            {vm.coverage.corroborated > 0 && <div><span className="dlv-cov-num">{vm.coverage.corroborated}</span><span className="dlv-cov-lbl">{t.corroboratedCov}</span></div>}
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

// ─── Portfolio Intelligence V1.1 — real cross-account synthesis (localized) ────
// Presentation only: consumes the deterministic + gated PortfolioIntelligenceVM.
// No pattern detection here (§66). Supporting accounts are inspectable via the
// same account navigation (§67-70). Empty sections are omitted (§9/§65).
function PortfolioIntelligenceTab({ vm, es, onOpen }: { vm: DeliverableViewModel; t: L; es: boolean; onOpen: (id: string) => void }) {
  const pi = buildPortfolioIntelligence(vm);
  const L = pi.labels;
  const nameOf = (id: string) => vm.accounts.find((a) => a.id === id)?.company ?? id;
  const Chips = ({ ids }: { ids: string[] }) => (
    <div className="dlv-chips">{ids.slice(0, 6).map((id) => <button key={id} className="dlv-chip" onClick={() => onOpen(id)}>{nameOf(id)}</button>)}{ids.length > 6 && <span className="dlv-note" style={{ margin: 0 }}>+{ids.length - 6}</span>}</div>
  );
  return (
    <div className="dlv-panel">
      {pi.read.length > 0 && (
        <div className="dlv-card dlv-intel-read"><p className="dlv-label">{L.read}</p>{pi.read.map((r, i) => <p key={i} className="dlv-intel-copy" style={{ marginTop: i ? ".4rem" : 0 }}>{r.text}</p>)}</div>
      )}
      <div className="dlv-card"><p className="dlv-label">{L.focus}</p>
        <div className="dlv-distlegend">{DECISION_ORDER.filter((d) => vm.portfolio.counts[d] > 0).map((decision) => <span key={decision} className="dlv-distitem"><span className="dlv-nav-dot" style={{ background: DECISION_TOKENS[decision].dot }} /><strong>{vm.portfolio.counts[decision]}</strong> {decisionLabel(decision, es).toLowerCase()}</span>)}</div>
        {pi.attention.filter((a) => a.differentiator).map((a) => <p key={a.decision} className="dlv-note" style={{ marginTop: ".4rem" }}><strong>{decisionLabel(a.decision, es)}:</strong> {a.differentiator}</p>)}
      </div>
      {pi.opportunityPatterns.length > 0 && (
        <div className="dlv-card"><p className="dlv-label">{L.patterns}</p>{pi.opportunityPatterns.map((p) => <div key={p.key} className="dlv-pat"><div className="dlv-pat-h">{p.label}{p.notable ? <span className="dlv-tagm">{L.notable}</span> : <span className="dlv-tag">{p.supportingCaseIds.length}</span>}</div><Chips ids={p.supportingCaseIds} /></div>)}</div>
      )}
      {pi.changePatterns.some((p) => !p.notable) && (
        <div className="dlv-card"><p className="dlv-label">{L.changing}</p>{pi.changePatterns.filter((p) => !p.notable).map((p) => <div key={p.key} className="dlv-pat"><div className="dlv-pat-h">{p.label} <span className="dlv-tag">{p.supportingCaseIds.length}</span></div><p className="dlv-note" style={{ margin: ".2rem 0" }}>{p.summary}{p.caveat ? " " + p.caveat : ""}</p><Chips ids={p.supportingCaseIds} /></div>)}</div>
      )}
      <div className="dlv-card"><p className="dlv-label">{L.coverage}</p><ul className="dlv-limits-list">{pi.evidenceCoverage.statements.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
      {pi.validationThemes.length > 0 && (
        <div className="dlv-card"><p className="dlv-label">{L.themes}</p>{pi.validationThemes.map((th) => <div key={th.key} className="dlv-pat"><div className="dlv-pat-h">{th.theme}{th.decisionCritical && <span className="dlv-tagc">{L.critical}</span>} <span className="dlv-tag">{th.caseIds.length}</span></div><Chips ids={th.caseIds} /></div>)}</div>
      )}
      {pi.tensions.length > 0 && (
        <div className="dlv-card"><p className="dlv-label">{L.tensions}</p>{pi.tensions.map((tn) => <div key={tn.caseId} className="dlv-pat"><div className="dlv-pat-h"><button className="dlv-chip" onClick={() => onOpen(tn.caseId)}>{tn.company}</button></div><p className="dlv-note" style={{ margin: ".25rem 0" }}><strong>+</strong> {tn.positive}</p><p className="dlv-note" style={{ margin: ".25rem 0" }}><strong>−</strong> {tn.counter}</p><p className="dlv-note" style={{ margin: ".25rem 0", color: "#475569" }}>{tn.meaning}</p></div>)}</div>
      )}
      {pi.guidance.length > 0 && (
        <div className="dlv-card"><p className="dlv-label">{L.guidance}</p>{pi.guidance.map((g, i) => <div key={i} className="dlv-guide"><span className="dlv-gk">{g.kindLabel}</span><span>{g.statement}</span></div>)}</div>
      )}
      {pi.coverageGaps.length > 0 && (
        <div className="dlv-card dlv-honest-empty"><p className="dlv-label">{L.gaps}</p>{pi.coverageGaps.map((g) => <p key={g.key} className="dlv-note" style={{ margin: ".2rem 0" }}><strong>{g.category}.</strong> {g.summary}</p>)}</div>
      )}
    </div>
  );
}

function UtilityBar({ vm, t, es }: { vm: DeliverableViewModel; t: L; es: boolean }) {
  return (
    <aside className="dlv-utilities" aria-label={t.utilities}>
      <details className="dlv-utility"><summary>{t.howToRead}</summary><div className="dlv-utility-body"><p>{t.absenceNote}</p>{vm.methodology.length > 0 && <ul>{vm.methodology.map((item, i) => <li key={i}>{item}</li>)}</ul>}<p>{decisionLabel("prioritize", es)} → {decisionLabel("validate", es)} → {decisionLabel("monitor", es)} → {decisionLabel("hold", es)}</p></div></details>
      {vm.capabilities.showDownloadsTab && <details className="dlv-utility"><summary>{t.downloads}</summary><div className="dlv-utility-body"><DownloadsTab vm={vm} t={t} /></div></details>}
    </aside>
  );
}

// ─── Compare tab — why Account A before Account B (no aggregate score) ────────
const DECISION_RANK: Record<DecisionState, number> = { prioritize: 0, validate: 1, monitor: 2, hold: 3 };

function CompareTab({ vm, t, es, onOpen }: { vm: DeliverableViewModel; t: L; es: boolean; onOpen: (id: string) => void }) {
  // Default: the top (up to 4) accounts by portfolio order. Customer can retune.
  const orderedAccounts = useMemo(() => orderByAttention(vm.accounts), [vm.accounts]);
  const [selected, setSelected] = useState<string[]>(() => orderedAccounts.slice(0, Math.min(4, orderedAccounts.length)).map((a) => a.id));
  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]);
  const cols = orderedAccounts.filter((a) => selected.includes(a.id));

  const dimVal = (a: AccountBriefVM, label: string) => a.dimensions.find((d) => d.label === label)?.value ?? null;
  const rows: { label: string; render: (a: AccountBriefVM) => React.ReactNode }[] = [
    { label: t.cDecision, render: (a) => <DecisionBadge state={a.decision} es={es} small /> },
    { label: es ? "Rol comercial" : "Account role", render: (a) => <span className="dlv-cmp-txt">{accountRoleLabel(a.accountRole, es) ?? "—"}</span> },
    { label: es ? "Tipo de oportunidad" : "Opportunity type", render: (a) => <span className="dlv-cmp-txt">{opportunityTypeLabel(a.opportunityType, es) ?? "—"}</span> },
    { label: t.cFit, render: (a) => <Strengthy v={dimVal(a, "Fit")} es={es} /> },
    { label: t.cTiming, render: (a) => <Strengthy v={dimVal(a, "Timing")} es={es} /> },
    { label: t.cEvidence, render: (a) => <Strengthy v={a.evidence.strength} es={es} /> },
    { label: t.cFreshness, render: (a) => <span className="dlv-cmp-txt">{a.freshness?.age ? `${a.freshness.age} ${t.ago}` : t.notDated}</span> },
    { label: t.cChanged, render: (a) => <span className="dlv-cmp-txt">{a.whatChanged[0]?.event ?? "—"}</span> },
    { label: t.cThesis, render: (a) => <span className="dlv-cmp-txt">{a.thesis ?? "—"}</span> },
    { label: t.cLimiter, render: (a) => <span className="dlv-cmp-txt">{a.limitations[0] ?? t.noneListed}</span> },
    { label: t.cValidate, render: (a) => <span className="dlv-cmp-txt">{a.validations[0] ?? "—"}</span> },
    { label: t.cNext, render: (a) => <span className="dlv-cmp-txt">{a.nextStep ?? "—"}</span> },
  ];

  const insight = compareInsight(cols, es);

  return (
    <div className="dlv-panel">
      <div className="dlv-card">
        <p className="dlv-label">{t.compareSelect} ({cols.length}/4)</p>
        <div className="dlv-cmp-chips">
          {orderedAccounts.map((a) => (
            <button key={a.id} className={`dlv-filter-chip ${selected.includes(a.id) ? "is-active" : ""}`} aria-pressed={selected.includes(a.id)} onClick={() => toggle(a.id)} disabled={!selected.includes(a.id) && selected.length >= 4}>
              <span className="dlv-nav-dot" style={{ background: DECISION_TOKENS[a.decision].dot, width: 6, height: 6, borderRadius: "50%", marginRight: 5 }} />{a.company}
            </button>
          ))}
        </div>
      </div>

      {insight && (
        <div className="dlv-card dlv-cmp-insight">
          <p className="dlv-label" style={{ color: "#0369a1" }}>{t.compareInsight}</p>
          <p className="dlv-cmp-insight-txt">{insight}</p>
        </div>
      )}

      {cols.length >= 2 ? (
        <div className="dlv-card" style={{ overflowX: "auto" }}>
          <table className="dlv-cmp-table">
            <thead>
              <tr>
                <th className="dlv-cmp-rowhead" />
                {cols.map((a) => (
                  <th key={a.id} className="dlv-cmp-colhead">
                    <button className="dlv-cmp-name" onClick={() => onOpen(a.id)}>{a.rank ? `${a.rank}. ` : ""}{a.company}</button>
                    <span className="dlv-cmp-sub">{a.segment ?? ""}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="dlv-cmp-rowhead">{r.label}</td>
                  {cols.map((a) => <td key={a.id} className="dlv-cmp-cell">{r.render(a)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty text={t.compareNeedTwo} />
      )}
    </div>
  );
}

function Strengthy({ v, es }: { v: string | null; es: boolean }) {
  if (!v) return <span className="dlv-cmp-txt">—</span>;
  const tok = STRENGTH_TOKENS[v as keyof typeof STRENGTH_TOKENS] ?? STRENGTH_TOKENS.Moderate;
  return <span style={{ fontWeight: tok.weight, color: tok.color, fontSize: 13 }}>{es ? ({ Strong: "Sólida", Moderate: "Moderada", Limited: "Limitada" }[v] ?? v) : v}</span>;
}

/** Deterministic, non-fabricated comparison insight: order by decision priority
 *  then evidence freshness, and phrase the lead using the account's OWN fields. */
function compareInsight(cols: AccountBriefVM[], es: boolean): string | null {
  if (cols.length < 2) return null;
  const days = (a: AccountBriefVM) => { const d = a.freshness?.age; return d && /\d/.test(d) ? parseInt(d, 10) : 9999; };
  const sorted = [...cols].sort((a, b) => DECISION_RANK[a.decision] - DECISION_RANK[b.decision] || days(a) - days(b));
  const lead = sorted[0], next = sorted[1];
  if (lead.decision === next.decision && lead.decisionNote === next.decisionNote && !lead.freshness) return null;
  const leadReason = lead.decisionNote || lead.thesis;
  const nextGap = next.limitations[0] || next.validations[0];
  if (!leadReason) return null;
  if (es) {
    return `${lead.company} merece atención antes que ${next.company}: ${leadReason}${nextGap ? ` En cambio, ${next.company} aún requiere resolver: ${nextGap}` : ""}`;
  }
  return `${lead.company} merits attention before ${next.company}: ${leadReason}${nextGap ? ` ${next.company}, by contrast, still needs to resolve: ${nextGap}` : ""}`;
}

// ─── Evidence tab — cross-account provenance (§61/§77) ────────────────────────
function EvidenceTab({ vm, t, es, onOpen }: { vm: DeliverableViewModel; t: L; es: boolean; onOpen: (id: string) => void }) {
  const withSources = orderByAttention(vm.accounts).filter((a) => a.sources.length > 0);
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

// ─── Downloads tab — portable exports (§84–101). Only real capabilities. ──────
function DownloadsTab({ vm, t }: { vm: DeliverableViewModel; t: L }) {
  const items: { title: string; desc: string; action: () => void }[] = [];
  if (vm.downloads.pdf) items.push({ title: t.dlPdf, desc: t.dlPdfDesc, action: () => window.print() });
  if (vm.downloads.portfolioCsv) items.push({ title: t.dlPortfolioCsv, desc: t.dlPortfolioCsvDesc, action: () => downloadText(deliverableFilename(vm, "portfolio", "csv"), portfolioCsv(vm), "text/csv;charset=utf-8") });
  if (vm.downloads.evidenceCsv) items.push({ title: t.dlEvidenceCsv, desc: t.dlEvidenceCsvDesc, action: () => downloadText(deliverableFilename(vm, "evidence", "csv"), evidenceCsv(vm), "text/csv;charset=utf-8") });
  return (
    <div className="dlv-panel">
      <div className="dlv-card">
        <p className="dlv-label">{t.downloads}</p>
        <p className="dlv-note" style={{ marginTop: 0, marginBottom: 14 }}>{t.downloadsLede}</p>
        <div className="dlv-dl-grid">
          {items.length === 0 && <span className="dlv-note">{t.noDownloads}</span>}
          {items.map((it) => (
            <button key={it.title} className="dlv-dl-card" onClick={it.action}>
              <span className="dlv-dl-title">{it.title}</span>
              <span className="dlv-dl-desc">{it.desc}</span>
            </button>
          ))}
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
      portfolio: es ? "Resumen" : "Overview",
      accounts: es ? "Casos de oportunidad" : "Opportunity Cases",
      evidence: es ? "Evidencia" : "Evidence",
      compare: es ? "Comparar" : "Compare",
      intelligence: es ? "Inteligencia del portafolio" : "Portfolio Intelligence",
    } as Record<Tab, string>,
    filterByDecision: es ? "Filtrar por decisión" : "Filter by decision",
    all: es ? "Todas" : "All",
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
    downloadsLede: es ? "El producto interactivo es la experiencia principal; la exportación es para compartir y para uso interno." : "The interactive product is the primary experience; exports are for sharing and internal use.",
    noDownloads: es ? "Sin exportaciones disponibles para este informe." : "No exports available for this report.",
    dlPdf: es ? "PDF del portafolio" : "Portfolio PDF",
    dlPdfDesc: es ? "Documento LeadLens con resumen, briefs y evidencia — para reuniones." : "LeadLens document with summary, briefs and evidence — for meetings.",
    dlPortfolioCsv: es ? "CSV del portafolio" : "Portfolio CSV",
    dlPortfolioCsvDesc: es ? "Una fila por cuenta: decisión, dimensiones, límite y validación — para Excel/CRM." : "One row per account: decision, dimensions, limiter and validation — for Excel/CRM.",
    dlEvidenceCsv: es ? "CSV de evidencia" : "Evidence CSV",
    dlEvidenceCsvDesc: es ? "Una fila por fuente: afirmación, relación, fecha y enlace." : "One row per source: claim, relation, date and link.",
    emptyPortfolio: es ? "Este portafolio no contiene cuentas todavía." : "This portfolio contains no accounts yet.",
    ago: es ? "atrás" : "ago",
    // Commercial context
    commercialContext: es ? "Contexto comercial evaluado" : "Commercial context evaluated",
    ctxIndustries: es ? "Sectores" : "Industries",
    ctxRegions: es ? "Mercados" : "Markets",
    ctxCriteria: es ? "Criterios de oportunidad" : "Opportunity criteria",
    // Validation queue
    validationQueue: es ? "Cola de validación" : "Validation queue",
    validationQueueLede: es ? "Lo que conviene resolver antes de actuar, por cuenta." : "What to resolve before acting, by account.",
    corroboratedCov: es ? "corroboradas" : "corroborated",
    // Compare
    compareSelect: es ? "Selecciona cuentas para comparar" : "Select accounts to compare",
    compareInsight: es ? "Lectura de LeadLens" : "LeadLens read",
    compareNeedTwo: es ? "Selecciona al menos dos cuentas para comparar." : "Select at least two accounts to compare.",
    notDated: es ? "sin fecha" : "not dated",
    noneListed: es ? "ninguno indicado" : "none listed",
    cDecision: es ? "Decisión" : "Decision",
    cFit: es ? "Encaje" : "Fit",
    cTiming: es ? "Momento" : "Timing",
    cEvidence: es ? "Evidencia" : "Evidence",
    cFreshness: es ? "Frescura" : "Freshness",
    cChanged: es ? "Señal relevante" : "Relevant signal",
    cThesis: es ? "Tesis" : "Thesis",
    cLimiter: es ? "Límite principal" : "Primary limiter",
    cValidate: es ? "Validar" : "Validate next",
    cNext: es ? "Siguiente paso" : "Next step",
    // How to read this
    howToRead: es ? "Cómo leer este portafolio" : "How to read this portfolio",
    decisionStates: es ? "Estados de decisión" : "Decision states",
    defPrioritize: es ? "la evidencia respalda dedicar atención ahora." : "evidence supports attention now.",
    defValidate: es ? "prometedor, pero queda una incertidumbre importante." : "promising, but an important uncertainty remains.",
    defMonitor: es ? "relevante, pero la evidencia o el timing aún no bastan." : "relevant, but evidence or timing is not yet sufficient.",
    defHold: es ? "no se justifica dedicar esfuerzo ahora." : "effort is not justified right now.",
    evidenceRelations: es ? "Relación de la evidencia" : "Evidence relations",
    relDirect: es ? "Directa" : "Direct",
    relCorrob: es ? "Corroborante" : "Corroborating",
    relContext: es ? "Contexto" : "Context",
    defDirect: es ? "establece el cambio directamente." : "establishes the change directly.",
    defCorrob: es ? "respalda el cambio de forma independiente." : "independently supports the change.",
    defContext: es ? "aporta contexto de apoyo." : "provides supporting context.",
    howBuilt: es ? "Cómo se construyó" : "How this was built",
    absenceNote: es ? "La ausencia de evidencia no es evidencia de ausencia: LeadLens muestra lo que sabe y lo que aún no." : "Absence of evidence is not evidence of absence: LeadLens shows what it knows and what it does not yet.",
    utilities: es ? "Utilidades" : "Utilities",
    decisionLandscape: es ? "Panorama de decisiones" : "Decision landscape",
    sequence: es ? "Secuencia recomendada" : "Recommended sequence",
    validationAgenda: es ? "Agenda de validación" : "Validation agenda",
    portfolioPatterns: es ? "Patrones del portafolio" : "Portfolio patterns",
    noPortfolioPatterns: es ? "Todavía no se establecieron patrones transversales con evidencia suficiente. No se infieren para llenar este espacio." : "No cross-account patterns have been established with sufficient evidence yet. None are inferred to fill this space.",
    noIndependentSupport: es ? "No se identificó soporte independiente corroborante." : "No independently corroborating support was identified.",
  };
}

const CSS = `
.dlv-root { background: #f4f7fb; min-height: 100vh; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color: #0f172a; }
/* Client header — light; the client is the subject (no large dark header) */
.dlv-topbar { background: #fff; border-top: 3px solid #0b1220; border-bottom: 1px solid #eef2f6; padding: 18px 24px 16px; }
.dlv-brandline { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.dlv-logo { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: #0b1220; }
.dlv-kicker { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #94a3b8; }
.dlv-client { font-size: 30px; font-weight: 800; letter-spacing: -0.025em; color: #0b1220; margin: 10px 0 0; line-height: 1.1; }
.dlv-obj { font-size: 13.5px; color: #475569; line-height: 1.5; margin-top: 8px; max-width: 52rem; }
.dlv-obj-k { font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #0284c7; margin-right: 8px; }
.dlv-clientmeta { font-size: 12px; color: #94a3b8; margin-top: 7px; }
.dlv-tier { background: #f0f9ff; border: 1px solid #e0f2fe; color: #0369a1; border-radius: 999px; padding: 2px 10px; font-size: 11px; font-weight: 700; }
.dlv-tabs { position: sticky; top: 0; z-index: 20; display: flex; gap: 2px; background: #fff; border-bottom: 1px solid #e2e8f0; padding: 0 16px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.dlv-tabs::-webkit-scrollbar { display: none; }
.dlv-tab { appearance: none; background: none; border: none; border-bottom: 2px solid transparent; padding: 14px 16px; min-height: 44px; font-size: 13.5px; font-weight: 700; color: #64748b; cursor: pointer; white-space: nowrap; font-family: inherit; }
.dlv-tab:hover { color: #0f172a; }
.dlv-tab.is-active { color: #0369a1; border-bottom-color: #0284c7; }
.dlv-main { max-width: 1100px; margin: 0 auto; padding: 22px 16px 40px; }
.dlv-utilities { max-width: 1100px; margin: -22px auto 30px; padding: 0 16px; display: flex; gap: 10px; flex-wrap: wrap; }
.dlv-utility { background: #fff; border: 1px solid #e8edf3; border-radius: 10px; color: #64748b; font-size: 12px; }
.dlv-utility summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; padding: 0 14px; font-weight: 700; color: #475569; }
.dlv-utility-body { padding: 0 14px 14px; max-width: 48rem; line-height: 1.55; }
.dlv-utility-body .dlv-panel { display: block; }
.dlv-utility-body .dlv-card { border: 0; box-shadow: none; padding: 4px 0; }
.dlv-intel-read { border-left: 4px solid #0ea5e9; background: #f8fcff; }
.dlv-intel-copy { margin: 0; color: #0c4a6e; line-height: 1.6; font-size: 14px; }
.dlv-honest-empty { border-style: dashed; box-shadow: none; }
.dlv-mem { border-left: 4px solid #0ea5e9; background: #f8fcff; }
.dlv-mem-l { margin: 4px 0 0; padding-left: 16px; font-size: 13px; color: #334155; line-height: 1.5; }
.dlv-mem-l li { margin: 2px 0; }
.dlv-mem-decision { font-weight: 700; color: #0f172a; }
.dlv-pat { padding: 8px 0; border-top: 1px solid #f1f5f9; }
.dlv-pat:first-of-type { border-top: none; }
.dlv-pat-h { font-size: 13.5px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.dlv-tag { font-size: 10.5px; font-weight: 800; color: #0369a1; background: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 20px; padding: 1px 8px; }
.dlv-tagm { font-size: 9.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #64748b; background: #f8fafc; border: 1px solid #eef2f6; border-radius: 4px; padding: 1px 6px; }
.dlv-tagc { font-size: 9.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #b45309; background: #fffbeb; border: 1px solid #fef3c7; border-radius: 4px; padding: 1px 6px; }
.dlv-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.dlv-chip { appearance: none; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 600; color: #0f172a; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 3px 10px; }
.dlv-chip:hover { border-color: #0284c7; color: #0369a1; }
.dlv-guide { display: flex; gap: 9px; align-items: baseline; padding: 6px 0; border-top: 1px solid #f1f5f9; }
.dlv-guide:first-of-type { border-top: none; }
.dlv-gk { flex: none; font-size: 10px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: #0369a1; background: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 4px; padding: 2px 7px; min-width: 64px; text-align: center; }
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
.dlv-footer { text-align: center; font-size: 10.5px; color: #cbd5e1; padding: 8px 16px 26px; }

/* Decision filter + compare selection chips */
.dlv-nav-filter { display: flex; flex-wrap: wrap; gap: 5px; padding: 0 8px 8px; }
.dlv-cmp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.dlv-filter-chip { appearance: none; background: #fff; border: 1px solid #e2e8f0; border-radius: 999px; padding: 5px 11px; min-height: 30px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; }
.dlv-filter-chip:hover { border-color: #cbd5e1; }
.dlv-filter-chip.is-active { background: #e0f2fe; border-color: #7dd3fc; color: #0369a1; }
.dlv-filter-chip:disabled { opacity: 0.4; cursor: not-allowed; }

/* Validation queue */
.dlv-vq { display: flex; flex-direction: column; }
.dlv-vq-item { display: flex; align-items: baseline; gap: 12px; padding: 9px 0; border-top: 1px solid #f1f5f9; flex-wrap: wrap; }
.dlv-vq-item:first-child { border-top: none; }
.dlv-vq-name { appearance: none; background: none; border: none; cursor: pointer; font-family: inherit; font-size: 13.5px; font-weight: 700; color: #0f172a; display: inline-flex; align-items: center; gap: 7px; padding: 0; min-width: 150px; text-align: left; }
.dlv-vq-name:hover { color: #0369a1; }
.dlv-vq-name .dlv-nav-dot { width: 7px; height: 7px; border-radius: 50%; }
.dlv-vq-first { font-size: 13px; color: #475569; flex: 1; min-width: 180px; }

/* Commercial context + methodology disclosures */
.dlv-context > summary, .dlv-method > summary { list-style: none; cursor: pointer; }
.dlv-context > summary::-webkit-details-marker, .dlv-method > summary::-webkit-details-marker { display: none; }
.dlv-context-summary { font-size: 13px; font-weight: 800; color: #0369a1; padding: 2px 0; display: flex; align-items: center; gap: 6px; }
.dlv-context-summary::after { content: "▾"; color: #94a3b8; font-size: 11px; }
details[open] > .dlv-context-summary::after { content: "▴"; }
.dlv-context-body { margin-top: 12px; padding-top: 12px; border-top: 1px solid #f1f5f9; }
.dlv-context-p { font-size: 13.5px; color: #334155; line-height: 1.6; margin: 0 0 10px; }
.dlv-ctx-row { display: flex; gap: 10px; padding: 5px 0; flex-wrap: wrap; }
.dlv-ctx-k { font-size: 10px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #94a3b8; width: 120px; flex-shrink: 0; padding-top: 2px; }
.dlv-ctx-v { font-size: 13px; color: #334155; flex: 1; min-width: 180px; }
.dlv-ctx-crit { margin: 0; padding-left: 16px; font-size: 13px; color: #334155; line-height: 1.6; flex: 1; min-width: 180px; }
.dlv-legend { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #475569; }
.dlv-legend li { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.dlv-legend-text li { display: block; line-height: 1.55; }

/* Compare table */
.dlv-cmp-insight { background: #f0f9ff; border-color: #bae6fd; }
.dlv-cmp-insight-txt { font-size: 14px; color: #0c4a6e; line-height: 1.6; margin: 0; }
.dlv-cmp-table { border-collapse: collapse; width: 100%; min-width: 520px; }
.dlv-cmp-table th, .dlv-cmp-table td { text-align: left; vertical-align: top; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
.dlv-cmp-rowhead { font-size: 10px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: #94a3b8; white-space: nowrap; background: #fafbfc; position: sticky; left: 0; }
.dlv-cmp-colhead { border-bottom: 2px solid #e2e8f0; min-width: 150px; }
.dlv-cmp-name { appearance: none; background: none; border: none; cursor: pointer; font-family: inherit; font-size: 14px; font-weight: 800; color: #0f172a; padding: 0; display: block; text-align: left; }
.dlv-cmp-name:hover { color: #0369a1; }
.dlv-cmp-sub { font-size: 11px; color: #94a3b8; display: block; margin-top: 2px; }
.dlv-cmp-cell { font-size: 13px; color: #334155; }
.dlv-cmp-txt { font-size: 12.5px; color: #475569; line-height: 1.5; }

/* Downloads */
.dlv-dl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.dlv-dl-card { appearance: none; text-align: left; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; min-height: 44px; cursor: pointer; font-family: inherit; display: flex; flex-direction: column; gap: 4px; }
.dlv-dl-card:hover { border-color: #7dd3fc; background: #f8fafc; }
.dlv-dl-title { font-size: 14px; font-weight: 700; color: #0369a1; }
.dlv-dl-desc { font-size: 12px; color: #64748b; line-height: 1.45; }

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
  .dlv-tabs { padding-right: 44px; -webkit-mask-image: linear-gradient(to right,#000 0,#000 calc(100% - 30px),transparent 100%); mask-image: linear-gradient(to right,#000 0,#000 calc(100% - 30px),transparent 100%); }
  .dlv-utilities { padding: 0 12px; }
  .dlv-card { padding: 15px 16px; }
  .dlv-hero-h1 { font-size: 20px; }
  .dlv-topbar { padding: 13px 16px; }
  .dlv-cov { gap: 20px; }
}
/* Deliberate print / PDF: a LeadLens document, not broken tab UI (§86–92).
   The print stylesheet reveals ALL panels stacked in a stable reading order and
   suppresses interactive chrome; page breaks avoid orphaned headings/decisions. */
/* Print document — hidden on screen, shown (and the only thing shown) in print */
.dlv-print { display: none; }
.dlv-print-cover { padding: 0 0 16px; border-bottom: 2px solid #0f172a; margin-bottom: 18px; }
.dlv-print-kicker { font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #0284c7; margin-top: 6px; }
.dlv-print-meta { font-size: 12px; color: #475569; margin-top: 4px; }
.dlv-print-h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin: 12px 0 6px; }
.dlv-print-sub { font-size: 13px; color: #475569; line-height: 1.55; margin: 0; }
.dlv-print-sec { margin-bottom: 16px; }
.dlv-print-h2 { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; margin: 0 0 6px; }
.dlv-print-brief { margin-bottom: 18px; }
.dlv-print-foot { font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 10px; }

@media print {
  @page { margin: 14mm; }
  .dlv-topbar, .dlv-tabs, .dlv-main, .dlv-utilities, .dlv-footer { display: none !important; }
  .dlv-root { background: #fff; }
  .dlv-print { display: block !important; }
  .dlv-print .dlv-card { box-shadow: none; break-inside: avoid; border-color: #d7dee7; }
  .dlv-print-brief { break-inside: avoid; }
  h2, .dlv-label, .dlv-print-h2 { break-after: avoid; }
  a[href]::after { content: ""; } /* keep source labels clean; links stay clickable */
}
`;
