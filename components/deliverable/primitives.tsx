// ─── Interactive deliverable — shared product primitives ──────────────────────
// Presentational, data-driven pieces of the Account Brief and portfolio. Every
// primitive renders from the typed view model and degrades gracefully when a
// section is absent (§79/§80: premium empty states, honest gaps — never invented
// certainty). Reused by the workspace and the dev preview; structured so the
// landing sample could eventually share the same grammar.

import type {
  AccountBriefVM, DecisionState, DimensionVM, SourceVM, Strength,
} from "@/lib/deliverable/deliverable-view-model";
import { DECISION_TOKENS, STRENGTH_TOKENS, RELATION_TOKENS, decisionLabel } from "@/lib/deliverable/deliverable-view-model";

export type Lang = "en" | "es";
const T = (es: boolean) => ({
  whatChanged: es ? "Qué cambió" : "What changed",
  recentSignal: es ? "Señal reciente" : "Recent signal",
  relevantSignal: es ? "Evidencia actual" : "Current evidence",
  inferredSignal: es ? "Interpretación" : "Interpretation",
  whyItMatters: es ? "Por qué importa" : "Why it matters",
  thesis: es ? "Tesis de la cuenta" : "Account thesis",
  evidence: es ? "Evidencia" : "Evidence",
  supportedBy: es ? "Respaldado por" : "Supported by",
  sources: es ? "fuentes" : "sources",
  dated: es ? "con fecha" : "dated",
  corroborated: es ? "Corroborada" : "Corroborated",
  latest: es ? "más reciente" : "latest",
  counter: es ? "Contraseñales y riesgos" : "Counter-signals & risks",
  limitedBy: es ? "Qué limita la confianza" : "What limits confidence",
  validate: es ? "Validar antes de actuar" : "Validate before acting",
  decision: es ? "Decisión" : "Decision",
  nextStep: es ? "Siguiente paso recomendado" : "Recommended next step",
  freshness: es ? "Frescura" : "Freshness",
  ago: es ? "atrás" : "ago",
  noCounter: es ? "No se identificaron contraseñales para esta cuenta." : "No counter-signals identified for this account.",
  noValidate: es ? "Sin acciones de validación registradas." : "No validation actions recorded.",
  noEvidence: es ? "Sin evidencia con fecha disponible todavía." : "No dated evidence available yet.",
  notEvaluated: es ? "no evaluada" : "not evaluated",
});

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e8edf3", borderRadius: 12, padding: "18px 20px" };
const label: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94a3b8", margin: "0 0 8px" };
const bodyText: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: "#1e293b", margin: 0 };

// ─── Decision badge ───────────────────────────────────────────────────────────
export function DecisionBadge({ state, es, small }: { state: DecisionState; es: boolean; small?: boolean }) {
  const s = DECISION_TOKENS[state];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.bg, border: `1px solid ${s.border}`, color: s.color, borderRadius: 999, padding: small ? "2px 8px" : "3px 11px", fontSize: small ? 10 : 11.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      {decisionLabel(state, es)}
    </span>
  );
}

// ─── Dimension strip (Fit / Timing / Evidence — never one opaque score) ───────
export function DimensionStrip({ dimensions, es = false }: { dimensions: DimensionVM[]; es?: boolean }) {
  if (dimensions.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 22, flexWrap: "wrap", margin: "2px 0" }}>
      {dimensions.map((d) => {
        const tok = STRENGTH_TOKENS[d.value as Strength] ?? STRENGTH_TOKENS.Moderate;
        return (
          <div key={d.label}>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8" }}>{es ? ({ Fit: "Encaje", Timing: "Momento", Evidence: "Evidencia" }[d.label] ?? d.label) : d.label}</div>
            <div style={{ fontSize: 15, fontWeight: tok.weight, color: tok.color, lineHeight: 1.2 }}>{es ? ({ Strong: "Sólida", Moderate: "Moderada", Limited: "Limitada" }[d.value] ?? d.value) : d.value}</div>
            {d.note && <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{d.note}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── What Changed ─────────────────────────────────────────────────────────────
export function WhatChangedSection({ a, es }: { a: AccountBriefVM; es: boolean }) {
  const t = T(es);
  if (a.whatChanged.length === 0) return null;
  const kinds = new Set(a.whatChanged.map((c) => c.kind ?? "unknown"));
  const sectionLabel = kinds.size === 1 && kinds.has("true_change") ? t.whatChanged
    : kinds.size === 1 && kinds.has("recent_event") ? t.recentSignal
    : kinds.size === 1 && kinds.has("inference") ? t.inferredSignal
    : t.relevantSignal;
  return (
    <div style={card}>
      <p style={label}>{sectionLabel}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {a.whatChanged.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#0ea5e9", flexShrink: 0, transform: "translateY(2px)" }} />
            <span style={{ ...bodyText, flex: 1, minWidth: 180, fontWeight: 600 }}>{c.event}</span>
            {c.age && <span style={{ fontSize: 11.5, color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>{c.age} {t.ago}</span>}
            {c.source && <span style={{ fontSize: 11, color: "#cbd5e1" }}>· {c.source}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Evidence summary + Supported-by source list ──────────────────────────────
export function EvidenceSummary({ a, es }: { a: AccountBriefVM; es: boolean }) {
  const t = T(es);
  const e = a.evidence;
  const bits: string[] = [];
  if (e.sourceCount > 0) bits.push(`${e.sourceCount} ${t.sources}`);
  if (e.datedCount > 0) bits.push(`${e.datedCount} ${t.dated}`);
  if (e.corroborated === true) bits.push(t.corroborated);
  if (e.latestAge) bits.push(`${t.latest} ${e.latestAge} ${t.ago}`);
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: a.sources.length ? 10 : 0 }}>
        <p style={{ ...label, margin: 0 }}>{t.supportedBy}</p>
        {bits.length > 0 && <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 600 }}>{bits.join(" · ")}</span>}
      </div>
      {a.sources.length > 0 ? <SourceList sources={a.sources} es={es} /> : <p style={{ fontSize: 12.5, color: "#94a3b8", margin: 0 }}>{t.noEvidence}</p>}
    </div>
  );
}

export function SourceList({ sources, es }: { sources: SourceVM[]; es: boolean }) {
  const t = T(es);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {sources.map((s, i) => {
        const rel = s.relation ? RELATION_TOKENS[s.relation] : null;
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2, paddingBottom: 9, borderBottom: i < sources.length - 1 ? "1px solid #f1f5f9" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {rel && <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: rel.color }}>{es ? rel.labelEs : rel.label}</span>}
              {s.url
                ? <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", textDecoration: "none", wordBreak: "break-word" }}>{s.label} ↗</a>
                : <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", wordBreak: "break-word" }}>{s.label}</span>}
              {s.age && <span style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>· {s.age} {t.ago}</span>}
            </div>
            {s.claim && <p style={{ fontSize: 12.5, color: "#475569", margin: 0, lineHeight: 1.5 }}>{s.claim}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Bullet section (counter-signals / limitations / validations) ─────────────
function BulletSection({ title, items, dotColor, empty }: { title: string; items: string[]; dotColor: string; empty?: string }) {
  if (items.length === 0 && !empty) return null;
  return (
    <div style={card}>
      <p style={label}>{title}</p>
      {items.length === 0
        ? <p style={{ fontSize: 12.5, color: "#94a3b8", margin: 0 }}>{empty}</p>
        : <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
            {items.map((it, i) => (
              <li key={i} style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor, flexShrink: 0, transform: "translateY(4px)" }} />
                <span style={{ fontSize: 13, lineHeight: 1.55, color: "#334155" }}>{it}</span>
              </li>
            ))}
          </ul>}
    </div>
  );
}

export function CounterSignals({ a, es }: { a: AccountBriefVM; es: boolean }) {
  const t = T(es);
  return <BulletSection title={t.counter} items={a.counterSignals} dotColor="#dc2626" empty={t.noCounter} />;
}
export function Limitations({ a, es }: { a: AccountBriefVM; es: boolean }) {
  const t = T(es);
  return <BulletSection title={t.limitedBy} items={a.limitations} dotColor="#b45309" />;
}
export function Validations({ a, es }: { a: AccountBriefVM; es: boolean }) {
  const t = T(es);
  return <BulletSection title={t.validate} items={a.validations} dotColor="#0284c7" empty={a.validations.length ? undefined : t.noValidate} />;
}

// ─── Decision + next step ─────────────────────────────────────────────────────
export function DecisionSection({ a, es }: { a: AccountBriefVM; es: boolean }) {
  const t = T(es);
  const s = DECISION_TOKENS[a.decision];
  return (
    <div style={{ ...card, borderLeft: `4px solid ${s.dot}`, background: s.bg }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
        <p style={{ ...label, margin: 0 }}>{t.decision}</p>
        <DecisionBadge state={a.decision} es={es} />
      </div>
      {a.decisionNote && <p style={{ ...bodyText, marginBottom: a.nextStep ? 10 : 0 }}>{a.decisionNote}</p>}
      {a.nextStep && (
        <div style={{ paddingTop: 10, borderTop: "1px solid rgba(15,23,42,0.06)" }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "#94a3b8", marginBottom: 3 }}>{t.nextStep}</div>
          <p style={bodyText}>{a.nextStep}</p>
        </div>
      )}
    </div>
  );
}

// ─── Full Account Brief (composition of primitives) ───────────────────────────
export function AccountBrief({ a, es }: { a: AccountBriefVM; es: boolean }) {
  const t = T(es);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Header */}
      <div style={{ ...card, padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 21, fontWeight: 800, color: "#0f172a", margin: "0 0 4px", letterSpacing: "-0.01em", lineHeight: 1.15 }}>
              {a.rank ? <span style={{ color: "#cbd5e1", fontWeight: 700 }}>{a.rank}. </span> : null}{a.company}
            </h2>
            <div style={{ fontSize: 12.5, color: "#94a3b8" }}>{[a.segment, a.geography].filter(Boolean).join(" · ") || (es ? "Detalles de cuenta limitados" : "Account details limited")}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <DecisionBadge state={a.decision} es={es} />
            {a.freshness?.age && <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>{a.freshness.age} {t.ago}</span>}
          </div>
        </div>
        {a.dimensions.length > 0 && <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}><DimensionStrip dimensions={a.dimensions} es={es} /></div>}
      </div>

      {/* Thesis / why it matters */}
      {(a.thesis || a.whyItMatters) && (
        <div style={card}>
          {a.thesis && <><p style={label}>{t.thesis}</p><p style={{ ...bodyText, marginBottom: a.whyItMatters ? 12 : 0 }}>{a.thesis}</p></>}
          {a.whyItMatters && a.whyItMatters !== a.thesis && (
            <div style={{ marginTop: a.thesis ? 12 : 0, paddingTop: a.thesis ? 12 : 0, borderTop: a.thesis ? "1px solid #f1f5f9" : "none" }}>
              <p style={label}>{t.whyItMatters}</p><p style={bodyText}>{a.whyItMatters}</p>
            </div>
          )}
        </div>
      )}

      <WhatChangedSection a={a} es={es} />
      <EvidenceSummary a={a} es={es} />
      <CounterSignals a={a} es={es} />
      <Limitations a={a} es={es} />
      <Validations a={a} es={es} />
      <DecisionSection a={a} es={es} />
    </div>
  );
}
