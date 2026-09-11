"use client";

// LeadLens hero product object — the "focus board".
// One tactile commercial-intelligence surface: a small set of REAL-feeling companies, each with a
// canonical Decision (Prioritize / Validate / Monitor / Hold), a one-line reason, and inspectable
// evidence. Moving through the six lenses transforms the board — attention shifts to the justified
// focus, a dated change surfaces, the evidence trail opens, the set becomes comparable, an open
// question appears, a monitored company stays visible. No opaque scores, no fake activity: only the
// decision states and evidence the real product produces. Synthetic, illustrative companies.

import { useState } from "react";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./focus-board.module.css";

type Lens = "prioritize" | "why" | "evidence" | "compare" | "validate" | "monitor";
type Decision = "prioritize" | "validate" | "monitor" | "hold";
type Strength = 3 | 2 | 1; // Strong / Moderate / Limited

interface Company {
  id: string; name: string; segment: string; decision: Decision;
  why: string; change: string | null; question: string | null;
  fit: Strength; timing: Strength; evidence: Strength; sources: number;
  evidenceTrail: [string, string, string]; // source · fact · date
}

interface Copy {
  aria: string; brand: string; objective: string;
  lenses: Record<Lens, string>;
  decisions: Record<Decision, string>;
  dims: { fit: string; timing: string; evidence: string };
  readout: Record<Lens, string>;
  whyNow: string; evidenceLabel: string; validateLabel: string; monitorLabel: string;
  watching: string; sourcesLabel: (n: number) => string; companies: Company[];
  hint: string;
}

const EN: Copy = {
  aria: "LeadLens focus board — an interactive example",
  brand: "LeadLens", objective: "Objective: expanding US & LatAm operators",
  lenses: { prioritize: "Prioritize", why: "Why now", evidence: "Evidence", compare: "Compare", validate: "Validate", monitor: "Monitor" },
  decisions: { prioritize: "Prioritize", validate: "Validate", monitor: "Monitor", hold: "Hold" },
  dims: { fit: "Fit", timing: "Timing", evidence: "Evidence" },
  readout: {
    prioritize: "One company justifies attention first — the rest stay visible.",
    why: "A dated development changes what matters now.",
    evidence: "Every decision traces back to a dated source.",
    compare: "The same objective, applied across the set.",
    validate: "The open question that could change the decision.",
    monitor: "Still relevant — watched for material change.",
  },
  whyNow: "Why now", evidenceLabel: "Evidence trail", validateLabel: "Open question", monitorLabel: "Monitoring",
  watching: "Watching for a material change", sourcesLabel: (n) => `${n} source${n === 1 ? "" : "s"} · dated`,
  hint: "Move through the lenses",
  companies: [
    { id: "nw", name: "Northwind Logistics", segment: "Logistics · US", decision: "prioritize", why: "Expanding regional operations — the strongest current case.", change: "Signed a regional distribution deal · 9 days ago", question: null, fit: 3, timing: 3, evidence: 3, sources: 3, evidenceTrail: ["Company press release", "Distribution agreement", "9 days ago"] },
    { id: "cf", name: "Cascade Foods", segment: "Food distribution · US", decision: "validate", why: "Opened two sites — promising, but one question is unresolved.", change: "2 new distribution sites · 14 days ago", question: "Is procurement decided centrally, or per site?", fit: 3, timing: 2, evidence: 2, sources: 2, evidenceTrail: ["Regional business journal", "Two new sites", "14 days ago"] },
    { id: "at", name: "Atlas Clinics", segment: "Healthcare · LatAm", decision: "monitor", why: "Multi-site operator, but no operational change is visible yet.", change: null, question: null, fit: 2, timing: 1, evidence: 1, sources: 1, evidenceTrail: ["Company profile", "Multi-site footprint", "undated"] },
    { id: "mw", name: "Meridian Works", segment: "Manufacturing · US", decision: "hold", why: "Weak category fit on the current evidence.", change: null, question: null, fit: 1, timing: 1, evidence: 1, sources: 1, evidenceTrail: ["Directory listing", "Category mismatch", "undated"] },
  ],
};

const ES: Copy = {
  aria: "Tablero de enfoque de LeadLens — un ejemplo interactivo",
  brand: "LeadLens", objective: "Objetivo: operadores de EE. UU. y LatAm en expansión",
  lenses: { prioritize: "Priorizar", why: "Por qué ahora", evidence: "Evidencia", compare: "Comparar", validate: "Validar", monitor: "Monitorear" },
  decisions: { prioritize: "Priorizar", validate: "Validar", monitor: "Monitorear", hold: "Reservar" },
  dims: { fit: "Fit", timing: "Timing", evidence: "Evidencia" },
  readout: {
    prioritize: "Una empresa justifica la atención primero — las demás siguen visibles.",
    why: "Un cambio fechado altera lo que importa ahora.",
    evidence: "Cada decisión se remonta a una fuente con fecha.",
    compare: "El mismo objetivo, aplicado a todo el conjunto.",
    validate: "La pregunta abierta que podría cambiar la decisión.",
    monitor: "Sigue siendo relevante — en observación por cambios.",
  },
  whyNow: "Por qué ahora", evidenceLabel: "Rastro de evidencia", validateLabel: "Pregunta abierta", monitorLabel: "En observación",
  watching: "En observación por un cambio material", sourcesLabel: (n) => `${n} fuente${n === 1 ? "" : "s"} · con fecha`,
  hint: "Recorre los lentes",
  companies: [
    { id: "nw", name: "Northwind Logistics", segment: "Logística · EE. UU.", decision: "prioritize", why: "Amplía operaciones regionales — el caso más sólido hoy.", change: "Firmó un acuerdo de distribución regional · hace 9 días", question: null, fit: 3, timing: 3, evidence: 3, sources: 3, evidenceTrail: ["Comunicado de la empresa", "Acuerdo de distribución", "hace 9 días"] },
    { id: "cf", name: "Cascade Foods", segment: "Distribución de alimentos · EE. UU.", decision: "validate", why: "Abrió dos sedes — prometedor, pero queda una pregunta.", change: "2 nuevas sedes · hace 14 días", question: "¿Las compras se deciden de forma central o por sede?", fit: 3, timing: 2, evidence: 2, sources: 2, evidenceTrail: ["Diario de negocios regional", "Dos nuevas sedes", "hace 14 días"] },
    { id: "at", name: "Atlas Clinics", segment: "Salud · LatAm", decision: "monitor", why: "Operador multisede, pero aún no hay cambio operativo visible.", change: null, question: null, fit: 2, timing: 1, evidence: 1, sources: 1, evidenceTrail: ["Perfil de la empresa", "Presencia multisede", "sin fecha"] },
    { id: "mw", name: "Meridian Works", segment: "Manufactura · EE. UU.", decision: "hold", why: "Bajo encaje de categoría con la evidencia actual.", change: null, question: null, fit: 1, timing: 1, evidence: 1, sources: 1, evidenceTrail: ["Directorio", "Categoría no coincide", "sin fecha"] },
  ],
};

const COPY: Record<LandingLocale, Copy> = { en: EN, es: ES, pt: EN, ja: EN };
const LENS_ORDER: Lens[] = ["prioritize", "why", "evidence", "compare", "validate", "monitor"];

function Dots({ value }: { value: Strength }) {
  return <span className={styles.dots} aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} className={i <= value ? styles.on : ""} />)}</span>;
}

export function FocusBoard({ locale }: { locale: LandingLocale }) {
  const c = COPY[locale] ?? EN;
  const [lens, setLens] = useState<Lens>("prioritize");
  const [pinned, setPinned] = useState<string | null>(null);

  // Which company is the focus for this lens (or the one the visitor pinned).
  const lensFocus = lens === "validate" ? "cf" : lens === "monitor" ? "at" : "nw";
  const focusId = pinned ?? lensFocus;
  const focus = c.companies.find((x) => x.id === focusId) ?? c.companies[0];
  const others = c.companies.filter((x) => x.id !== focus.id);
  const compare = lens === "compare";

  const pick = (id: string) => { setPinned(id); const co = c.companies.find((x) => x.id === id); if (co) setLens(co.decision === "hold" ? "prioritize" : (co.decision as Lens)); };

  return (
    <section className={styles.board} data-lens={lens} aria-label={c.aria}>
      <header className={styles.head}>
        <span className={styles.brand}>{c.brand}</span>
        <p>{c.objective}</p>
      </header>

      <div className={styles.stage}>
        {/* Focus card — the justified attention */}
        <article className={`${styles.focus} ${styles[`d_${focus.decision}`]}`} aria-live="polite" key={focus.id + lens}>
          <div className={styles.focusTop}>
            <span className={styles.chip}>{c.decisions[focus.decision]}</span>
            <span className={styles.rank}>01</span>
          </div>
          <h3>{focus.name}</h3>
          <p className={styles.segment}>{focus.segment}</p>
          <p className={styles.why}>{focus.why}</p>

          {(lens === "why" || lens === "prioritize") && focus.change &&
            <div className={styles.ribbon}><span>{c.whyNow}</span><b>{focus.change}</b></div>}

          {lens === "evidence" &&
            <div className={styles.trail}><span>{c.evidenceLabel}</span>
              <ol>{focus.evidenceTrail.map((t, i) => <li key={i}>{t}</li>)}</ol>
              <small>{c.sourcesLabel(focus.sources)}</small>
            </div>}

          {lens === "validate" && focus.question &&
            <div className={styles.question}><span>{c.validateLabel}</span><b>{focus.question}</b></div>}

          {lens === "monitor" &&
            <div className={styles.watch}><span aria-hidden="true" className={styles.pulse} />{c.watching}</div>}

          {(compare || lens === "prioritize") &&
            <div className={styles.dims}>
              <div><em>{c.dims.fit}</em><Dots value={focus.fit} /></div>
              <div><em>{c.dims.timing}</em><Dots value={focus.timing} /></div>
              <div><em>{c.dims.evidence}</em><Dots value={focus.evidence} /></div>
            </div>}
        </article>

        {/* Supporting companies — visible, comparable, never hidden */}
        <ul className={styles.others}>
          {others.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => pick(o.id)} aria-label={`${o.name} — ${c.decisions[o.decision]}`}>
                <span className={`${styles.dot} ${styles[`d_${o.decision}`]}`} aria-hidden="true" />
                <span className={styles.oName}>{o.name}</span>
                <span className={styles.oSeg}>{o.segment}</span>
                {compare
                  ? <span className={styles.oDims}><Dots value={o.fit} /><Dots value={o.timing} /><Dots value={o.evidence} /></span>
                  : <span className={`${styles.oChip} ${styles[`d_${o.decision}`]}`}>{c.decisions[o.decision]}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Lens rail — the six ways LeadLens reasons about the set (not six identical pills) */}
      <div className={styles.rail} role="tablist" aria-label={c.hint}>
        {LENS_ORDER.map((l) => (
          <button key={l} role="tab" aria-selected={lens === l} className={lens === l ? styles.railOn : ""}
            onClick={() => { setLens(l); setPinned(null); }}>{c.lenses[l]}</button>
        ))}
      </div>
      <p className={styles.readout} aria-live="polite">{c.readout[lens]}</p>
    </section>
  );
}
