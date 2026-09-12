"use client";

// LeadLens Product surface — "the decision brief you receive".
// Not an example company card: the deliverable itself. The DECISION is the protagonist; the company is
// an anonymized archetype (relevance without a meaningless name). Every brief shows the full structure a
// buyer receives — Decision, Why now, Evidence trail, what stays Uncertain, and what to Validate next.
// The lens rail lets a visitor inspect any company across the researched set. No opaque scores, no fake
// activity — only the decision states and dated evidence the real product produces. Synthetic, illustrative.

import { useState } from "react";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./focus-board.module.css";

type Lens = "prioritize" | "why" | "evidence" | "compare" | "validate" | "monitor";
type Decision = "prioritize" | "validate" | "monitor" | "hold";
type Strength = 3 | 2 | 1;

interface Company {
  id: string; archetype: string; region: string; decision: Decision;
  headline: string; change: string | null; evidenceTrail: [string, string, string]; sources: number;
  uncertainty: string; validate: string; fit: Strength; timing: Strength; evidence: Strength;
}

interface Copy {
  aria: string; eyebrow: string; objective: string;
  lenses: Record<Lens, string>; decisions: Record<Decision, string>;
  dims: { fit: string; timing: string; evidence: string };
  labels: { whyNow: string; evidence: string; uncertainty: string; validate: string; rest: string; sources: (n: number) => string };
  readout: Record<Lens, string>; hint: string; companies: Company[];
}

const EN: Copy = {
  aria: "A LeadLens decision brief — an interactive example of what you receive",
  eyebrow: "The decision brief you receive", objective: "Objective: expanding US & LatAm operators",
  lenses: { prioritize: "Prioritize", why: "Why now", evidence: "Evidence", compare: "Compare", validate: "Validate", monitor: "Monitor" },
  decisions: { prioritize: "Prioritize", validate: "Validate", monitor: "Monitor", hold: "Hold" },
  dims: { fit: "Fit", timing: "Timing", evidence: "Evidence" },
  labels: { whyNow: "Why now", evidence: "Evidence", uncertainty: "What stays uncertain", validate: "Validate next", rest: "The rest of your set", sources: (n) => `${n} dated source${n === 1 ? "" : "s"}` },
  readout: {
    prioritize: "One company justifies attention first — with the reasoning attached.",
    why: "A dated development is what makes it worth pursuing now.",
    evidence: "Every decision traces back to a dated source you can inspect.",
    compare: "The same objective, applied consistently across the set.",
    validate: "The open question that should be resolved before you commit.",
    monitor: "Still relevant — kept in view, watched for a material change.",
  },
  hint: "Inspect any company in the set",
  companies: [
    { id: "nw", archetype: "Regional logistics operator", region: "US", decision: "prioritize", headline: "Worth pursuing now — expanding regional operations with a dated, corroborated change.", change: "Signed a regional distribution agreement · 9 days ago", evidenceTrail: ["Company press release", "Distribution agreement", "9 days ago"], sources: 3, uncertainty: "Whether procurement is decided centrally or per region is not yet confirmed.", validate: "Confirm where purchasing authority sits before outreach.", fit: 3, timing: 3, evidence: 3 },
    { id: "cf", archetype: "Multi-site food distributor", region: "US", decision: "validate", headline: "Promising, but one question should be resolved before you commit effort.", change: "Opened two new distribution sites · 14 days ago", evidenceTrail: ["Regional business journal", "Two new sites", "14 days ago"], sources: 2, uncertainty: "The scope of the decision — regional or group-wide — is unclear.", validate: "Confirm whether procurement is decided centrally or per site.", fit: 3, timing: 2, evidence: 2 },
    { id: "at", archetype: "Multi-site clinics group", region: "LatAm", decision: "monitor", headline: "Relevant, but no dated operational change is visible yet — worth watching.", change: null, evidenceTrail: ["Company profile", "Multi-site footprint", "undated"], sources: 1, uncertainty: "No recent, dated change ties this to your objective right now.", validate: "Revisit if an expansion or operational change is announced.", fit: 2, timing: 1, evidence: 1 },
    { id: "mw", archetype: "Specialty manufacturer", region: "US", decision: "hold", headline: "Weak category fit on the current evidence — not worth effort today.", change: null, evidenceTrail: ["Directory listing", "Category mismatch", "undated"], sources: 1, uncertainty: "The offer-to-need fit is weak on what is observable.", validate: "Hold unless the category fit materially changes.", fit: 1, timing: 1, evidence: 1 },
  ],
};

const ES: Copy = {
  aria: "Un informe de decisión de LeadLens — un ejemplo interactivo de lo que recibes",
  eyebrow: "El informe de decisión que recibes", objective: "Objetivo: operadores de EE. UU. y LatAm en expansión",
  lenses: { prioritize: "Priorizar", why: "Por qué ahora", evidence: "Evidencia", compare: "Comparar", validate: "Validar", monitor: "Monitorear" },
  decisions: { prioritize: "Priorizar", validate: "Validar", monitor: "Monitorear", hold: "Reservar" },
  dims: { fit: "Fit", timing: "Timing", evidence: "Evidencia" },
  labels: { whyNow: "Por qué ahora", evidence: "Evidencia", uncertainty: "Qué queda incierto", validate: "Validar después", rest: "El resto de tu conjunto", sources: (n) => `${n} fuente${n === 1 ? "" : "s"} con fecha` },
  readout: {
    prioritize: "Una empresa justifica la atención primero — con el razonamiento adjunto.",
    why: "Un cambio fechado es lo que la hace merecer atención ahora.",
    evidence: "Cada decisión se remonta a una fuente con fecha que puedes revisar.",
    compare: "El mismo objetivo, aplicado de forma consistente a todo el conjunto.",
    validate: "La pregunta abierta que conviene resolver antes de comprometer esfuerzo.",
    monitor: "Sigue siendo relevante — en observación por un cambio material.",
  },
  hint: "Revisa cualquier empresa del conjunto",
  companies: [
    { id: "nw", archetype: "Operador de logística regional", region: "EE. UU.", decision: "prioritize", headline: "Vale la pena perseguirla ahora — amplía operaciones regionales con un cambio fechado y corroborado.", change: "Firmó un acuerdo de distribución regional · hace 9 días", evidenceTrail: ["Comunicado de la empresa", "Acuerdo de distribución", "hace 9 días"], sources: 3, uncertainty: "No está confirmado si las compras se deciden de forma central o por región.", validate: "Confirma dónde reside la autoridad de compras antes del contacto.", fit: 3, timing: 3, evidence: 3 },
    { id: "cf", archetype: "Distribuidor de alimentos multisede", region: "EE. UU.", decision: "validate", headline: "Prometedora, pero conviene resolver una pregunta antes de invertir esfuerzo.", change: "Abrió dos nuevas sedes · hace 14 días", evidenceTrail: ["Diario de negocios regional", "Dos nuevas sedes", "hace 14 días"], sources: 2, uncertainty: "El alcance de la decisión — regional o de todo el grupo — no está claro.", validate: "Confirma si las compras se deciden de forma central o por sede.", fit: 3, timing: 2, evidence: 2 },
    { id: "at", archetype: "Grupo de clínicas multisede", region: "LatAm", decision: "monitor", headline: "Relevante, pero aún no hay un cambio operativo fechado — vale la pena observarla.", change: null, evidenceTrail: ["Perfil de la empresa", "Presencia multisede", "sin fecha"], sources: 1, uncertainty: "Ningún cambio reciente y fechado la conecta con tu objetivo ahora.", validate: "Revisar si se anuncia una expansión o cambio operativo.", fit: 2, timing: 1, evidence: 1 },
    { id: "mw", archetype: "Fabricante especializado", region: "EE. UU.", decision: "hold", headline: "Bajo encaje de categoría con la evidencia actual — hoy no vale el esfuerzo.", change: null, evidenceTrail: ["Directorio", "Categoría no coincide", "sin fecha"], sources: 1, uncertainty: "El encaje entre oferta y necesidad es débil con lo observable.", validate: "Reservar salvo que el encaje de categoría cambie de forma material.", fit: 1, timing: 1, evidence: 1 },
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

  const lensFocus = lens === "validate" ? "cf" : lens === "monitor" ? "at" : "nw";
  const focusId = pinned ?? lensFocus;
  const focus = c.companies.find((x) => x.id === focusId) ?? c.companies[0];
  const others = c.companies.filter((x) => x.id !== focus.id);

  const pick = (id: string) => { setPinned(id); const co = c.companies.find((x) => x.id === id); if (co) setLens(co.decision === "hold" ? "prioritize" : (co.decision as Lens)); };

  return (
    <section className={styles.board} data-decision={focus.decision} aria-label={c.aria}>
      <header className={styles.head}>
        <span className={styles.brand}>{c.eyebrow}</span>
        <p>{c.objective}</p>
      </header>

      {/* The decision brief — the deliverable. Decision is the protagonist; the company is context. */}
      <article className={`${styles.focus} ${styles[`d_${focus.decision}`]}`} aria-live="polite" key={focus.id + lens}>
        <div className={styles.focusTop}>
          <span className={styles.chip}>{c.decisions[focus.decision]}</span>
          <span className={styles.archetype}>{focus.archetype} · {focus.region}</span>
        </div>
        <h3 className={styles.headline}>{focus.headline}</h3>

        <div className={styles.brief}>
          <div className={styles.briefRow}><span>{c.labels.whyNow}</span><p>{focus.change ?? "—"}</p></div>
          <div className={styles.briefRow}><span>{c.labels.evidence}</span>
            <div className={styles.eviVal}><ol className={styles.trail}>{focus.evidenceTrail.map((t, i) => <li key={i}>{t}</li>)}</ol><small>{c.labels.sources(focus.sources)}</small></div>
          </div>
          <div className={styles.briefRow}><span>{c.labels.uncertainty}</span><p className={styles.soft}>{focus.uncertainty}</p></div>
          <div className={`${styles.briefRow} ${styles.validateRow}`}><span>{c.labels.validate}</span><p>{focus.validate}</p></div>
        </div>

        <div className={styles.dims}>
          <div><em>{c.dims.fit}</em><Dots value={focus.fit} /></div>
          <div><em>{c.dims.timing}</em><Dots value={focus.timing} /></div>
          <div><em>{c.dims.evidence}</em><Dots value={focus.evidence} /></div>
        </div>
      </article>

      {/* The rest of the researched set — visible, comparable, never hidden. */}
      <div className={styles.restWrap}>
        <span className={styles.restLabel}>{c.labels.rest}</span>
        <ul className={styles.others}>
          {others.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => pick(o.id)} aria-label={`${o.archetype} — ${c.decisions[o.decision]}`}>
                <span className={`${styles.dot} ${styles[`d_${o.decision}`]}`} aria-hidden="true" />
                <span className={styles.oName}>{o.archetype}</span>
                <span className={`${styles.oChip} ${styles[`d_${o.decision}`]}`}>{c.decisions[o.decision]}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Lens rail — inspect the set the way LeadLens reasons about it (not six identical pills). */}
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
