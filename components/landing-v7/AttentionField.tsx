"use client";

// LeadLens hero — the "Attention Instrument".
// A dark, instrument-grade decision surface (not cards in a pale panel). A commercial objective sits
// over a ledger of commercial possibilities; attention concentrates from the broad set onto one
// justified decision, with the recent change, the inspectable evidence and the open question in view.
// Changing the objective re-ranks the ledger and re-reads the focus. No opaque scores, no company
// names, no fake AI — an honest depiction of how LeadLens reasons.

import { useEffect, useMemo, useRef, useState } from "react";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./attention-field.module.css";

type Phase = "release" | "research" | "focus";
type Reading = { focus: number; validate: number; change: string; evidence: [string, string, string]; open: string };

interface Copy {
  aria: string; objectiveLabel: string; objectives: string[]; objectivesShort: string[]; tryHint: string; sectors: string[];
  chips: { prioritize: string; validate: string }; cueLabels: { monitor: string; hold: string };
  whyNow: string; evidence: string; openQuestion: string; setLabel: string;
  readout: Record<Phase, string>;
  readings: Reading[];
}

const EN: Copy = {
  aria: "How LeadLens concentrates attention — an interactive decision surface",
  objectiveLabel: "Pick a commercial objective",
  objectives: ["Expand into a new market", "Find new partners", "Win new clients", "Prioritize target accounts"],
  objectivesShort: ["New market", "New partners", "New clients", "Target accounts"], tryHint: "Switch the objective — the reading changes",
  sectors: ["Regional logistics", "Multi-site healthcare", "Specialty manufacturing", "Food distribution", "Industrial services", "Field services"],
  chips: { prioritize: "Prioritize", validate: "Validate" }, cueLabels: { monitor: "Monitor", hold: "Hold" },
  whyNow: "Why now", evidence: "Evidence", openQuestion: "Open question", setLabel: "The considered set",
  readout: {
    release: "Start from your objective and the full set of commercial possibilities.",
    research: "Research adds evidence — a recent change reorders what matters.",
    focus: "Attention concentrates: here is where it belongs, and why.",
  },
  readings: [
    { focus: 0, validate: 3, change: "Opened a regional hub · 9 days ago", evidence: ["Company announcement", "New regional hub", "9 days ago"], open: "Is the expansion run centrally, or per region?" },
    { focus: 2, validate: 1, change: "New production certification · 12 days ago", evidence: ["Trade registry", "Certification added", "12 days ago"], open: "Is sourcing decided at group level?" },
    { focus: 5, validate: 4, change: "Won a large service contract · 6 days ago", evidence: ["Regional press", "Contract award", "6 days ago"], open: "Is the budget owner identified?" },
    { focus: 1, validate: 0, change: "Announced two new sites · 15 days ago", evidence: ["Business journal", "Two new sites", "15 days ago"], open: "Does the change affect your category?" },
  ],
};

const ES: Copy = {
  aria: "Cómo LeadLens concentra la atención — una superficie de decisión interactiva",
  objectiveLabel: "Elige un objetivo comercial",
  objectives: ["Entrar a un nuevo mercado", "Encontrar socios", "Ganar nuevos clientes", "Priorizar cuentas objetivo"],
  objectivesShort: ["Nuevo mercado", "Socios", "Clientes", "Cuentas objetivo"], tryHint: "Cambia el objetivo — la lectura cambia",
  sectors: ["Logística regional", "Salud multisede", "Manufactura especializada", "Distribución de alimentos", "Servicios industriales", "Servicios de campo"],
  chips: { prioritize: "Priorizar", validate: "Validar" }, cueLabels: { monitor: "Monitorear", hold: "Reservar" },
  whyNow: "Por qué ahora", evidence: "Evidencia", openQuestion: "Pregunta abierta", setLabel: "El conjunto considerado",
  readout: {
    release: "Parte de tu objetivo y del conjunto completo de posibilidades comerciales.",
    research: "La investigación añade evidencia — un cambio reciente reordena lo que importa.",
    focus: "La atención se concentra: aquí es dónde corresponde, y por qué.",
  },
  readings: [
    { focus: 0, validate: 3, change: "Abrió un hub regional · hace 9 días", evidence: ["Anuncio de la empresa", "Nuevo hub regional", "hace 9 días"], open: "¿La expansión se gestiona central o por región?" },
    { focus: 2, validate: 1, change: "Nueva certificación de producción · hace 12 días", evidence: ["Registro comercial", "Certificación añadida", "hace 12 días"], open: "¿Las compras se deciden a nivel de grupo?" },
    { focus: 5, validate: 4, change: "Ganó un contrato de servicios grande · hace 6 días", evidence: ["Prensa regional", "Adjudicación", "hace 6 días"], open: "¿Está identificado quién decide el presupuesto?" },
    { focus: 1, validate: 0, change: "Anunció dos nuevas sedes · hace 15 días", evidence: ["Diario de negocios", "Dos nuevas sedes", "hace 15 días"], open: "¿El cambio afecta tu categoría?" },
  ],
};

const COPY: Record<LandingLocale, Copy> = { en: EN, es: ES, pt: EN, ja: EN };

// Considered-set cues (relative standing) — one per sector, deterministic + illustrative.
const CUE: { d: "monitor" | "hold"; ev: number }[] = [
  { d: "monitor", ev: 2 }, { d: "monitor", ev: 1 }, { d: "monitor", ev: 2 },
  { d: "hold", ev: 1 }, { d: "monitor", ev: 1 }, { d: "hold", ev: 1 },
];

export function AttentionField({ locale }: { locale: LandingLocale }) {
  const c = COPY[locale] ?? EN;
  const [obj, setObj] = useState(0);
  const [phase, setPhase] = useState<Phase>("focus");
  const reduce = useRef(false);
  const r = c.readings[obj];

  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) { setPhase("focus"); return; }
    setPhase("release");
    const t1 = setTimeout(() => setPhase("research"), 240);
    const t2 = setTimeout(() => setPhase("focus"), 820);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [obj]);

  const concentrated = phase === "focus";

  // Role + decision label for each ledger row.
  const rows = useMemo(() => c.sectors.map((label, i) => {
    const role: "focus" | "validate" | "monitor" | "hold" =
      i === r.focus ? "focus" : i === r.validate ? "validate" : CUE[i].d;
    const decision = role === "focus" ? c.chips.prioritize : role === "validate" ? c.chips.validate
      : role === "hold" ? c.cueLabels.hold : c.cueLabels.monitor;
    return { label, role, decision, ev: CUE[i].ev, i };
  }), [c, r.focus, r.validate]);

  return (
    <section className={`${styles.wrap} ${styles[phase]}`} aria-label={c.aria}>
      <div className={styles.instrument}>
        <div className={styles.head}>
          <span className={styles.objEyebrow}>{c.objectiveLabel}</span>
          <div className={styles.objTabs} role="tablist" aria-label={c.objectiveLabel}>
            {c.objectives.map((o, i) => (
              <button key={o} type="button" role="tab" aria-selected={obj === i}
                className={`${styles.objTab}${obj === i ? " " + styles.objTabOn : ""}`}
                aria-label={o} onClick={() => setObj(i)}>{c.objectivesShort[i]}</button>
            ))}
          </div>
          <span className={styles.objHint}><i aria-hidden="true">↻</i> {c.tryHint}</span>
        </div>

        <div className={styles.grid}>
          <div className={styles.ledgerWrap}>
            <span className={styles.colLabel}>{c.setLabel}</span>
            <ol className={styles.ledger}>
              {rows.map((row) => (
                <li key={row.label} className={styles.row} data-role={row.role} style={{ ["--k" as string]: row.i }}>
                  <i className={styles.dot} data-d={row.role} aria-hidden="true" />
                  <span className={styles.rowName}>{row.label}</span>
                  <span className={styles.bars} aria-hidden="true">
                    {[0, 1, 2].map((b) => <i key={b} className={b < row.ev ? styles.on : ""} />)}
                  </span>
                  <span className={styles.rowDec} data-d={row.role}>{row.decision}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className={styles.focus} data-live={concentrated}>
            <div className={styles.focusTop}>
              <span className={styles.chip} data-d="prioritize">{c.chips.prioritize}</span>
              <span className={styles.focusScope} aria-hidden="true">01 / {c.sectors.length}</span>
            </div>
            <h3 className={styles.focusName}>{c.sectors[r.focus]}</h3>

            <div className={styles.why}>
              <span className={styles.microLabel}>{c.whyNow}</span>
              <b>{r.change}</b>
            </div>

            <div className={styles.rail}>
              <span className={styles.microLabel}>{c.evidence}</span>
              <ol className={styles.railTrack}>
                {r.evidence.map((t, k) => <li key={k}>{t}</li>)}
              </ol>
            </div>

            <div className={styles.open}>
              <span className={styles.microLabel} data-d="validate">{c.openQuestion}</span>
              <b>{r.open}</b>
            </div>
          </div>
        </div>

        <p className={styles.readout} aria-live="polite">{c.readout[phase]}</p>
      </div>
    </section>
  );
}
