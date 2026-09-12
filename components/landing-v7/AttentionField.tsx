"use client";

// LeadLens hero — the "Attention Field".
// A spatial field of commercial possibilities with lines of ATTENTION that concentrate on the one
// company worth pursuing now. Pick a commercial objective (obvious chips) and the field re-reads: a
// different line brightens, a different company emerges as the focus, and its Why-now / Evidence /
// Open-question are exposed. Same market, different objective → different answer. No opaque scores,
// no fake activity, no company names — every node is a company, every line is attention, the focus is
// a canonical Decision with inspectable evidence. Synthetic, illustrative.

import { useEffect, useRef, useState } from "react";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./attention-field.module.css";

type Phase = "release" | "research" | "focus";
type Role = "focus" | "validate" | "monitor" | "hold";
type Reading = { focus: number; validate: number; change: string; evidence: [string, string, string]; open: string };

interface Copy {
  aria: string; objectiveLabel: string; objectives: string[]; objectivesShort: string[]; tryHint: string;
  sectors: string[]; chips: { prioritize: string; validate: string }; cueLabels: { monitor: string; hold: string };
  whyNow: string; evidence: string; openQuestion: string; worth: string; considered: string;
  readout: Record<Phase, string>; readings: Reading[];
}

const EN: Copy = {
  aria: "How LeadLens concentrates attention — an interactive field of commercial possibilities",
  objectiveLabel: "Pick a commercial objective",
  objectives: ["Expand into a new market", "Find new partners", "Win new clients", "Prioritize target accounts"],
  objectivesShort: ["New market", "New partners", "New clients", "Target accounts"],
  tryHint: "Switch the objective — watch attention move",
  sectors: ["Regional logistics", "Multi-site healthcare", "Specialty manufacturing", "Food distribution", "Industrial services", "Field services"],
  chips: { prioritize: "Prioritize", validate: "Validate" }, cueLabels: { monitor: "Monitor", hold: "Hold" },
  whyNow: "Why now", evidence: "Evidence", openQuestion: "Open question", worth: "Worth pursuing now", considered: "companies considered",
  readout: {
    release: "A field of commercial possibilities — before an objective is applied.",
    research: "Research weighs recent change and evidence across the set…",
    focus: "Attention concentrates on the one worth pursuing now — and why.",
  },
  readings: [
    { focus: 0, validate: 3, change: "Opened a regional hub · 9 days ago", evidence: ["Company announcement", "New regional hub", "9 days ago"], open: "Is the expansion run centrally, or per region?" },
    { focus: 2, validate: 1, change: "New production certification · 12 days ago", evidence: ["Trade registry", "Certification added", "12 days ago"], open: "Is sourcing decided at group level?" },
    { focus: 5, validate: 4, change: "Won a large service contract · 6 days ago", evidence: ["Regional press", "Contract award", "6 days ago"], open: "Is the budget owner identified?" },
    { focus: 1, validate: 0, change: "Announced two new sites · 15 days ago", evidence: ["Business journal", "Two new sites", "15 days ago"], open: "Does the change affect your category?" },
  ],
};

const ES: Copy = {
  aria: "Cómo LeadLens concentra la atención — un campo interactivo de posibilidades comerciales",
  objectiveLabel: "Elige un objetivo comercial",
  objectives: ["Entrar a un nuevo mercado", "Encontrar socios", "Ganar nuevos clientes", "Priorizar cuentas objetivo"],
  objectivesShort: ["Nuevo mercado", "Socios", "Clientes", "Cuentas objetivo"],
  tryHint: "Cambia el objetivo — mira moverse la atención",
  sectors: ["Logística regional", "Salud multisede", "Manufactura especializada", "Distribución de alimentos", "Servicios industriales", "Servicios de campo"],
  chips: { prioritize: "Priorizar", validate: "Validar" }, cueLabels: { monitor: "Monitorear", hold: "Reservar" },
  whyNow: "Por qué ahora", evidence: "Evidencia", openQuestion: "Pregunta abierta", worth: "Vale la pena ahora", considered: "empresas consideradas",
  readout: {
    release: "Un campo de posibilidades comerciales — antes de aplicar un objetivo.",
    research: "La investigación pondera cambios recientes y evidencia en el conjunto…",
    focus: "La atención se concentra en la que vale la pena ahora — y por qué.",
  },
  readings: [
    { focus: 0, validate: 3, change: "Abrió un hub regional · hace 9 días", evidence: ["Anuncio de la empresa", "Nuevo hub regional", "hace 9 días"], open: "¿La expansión se gestiona central o por región?" },
    { focus: 2, validate: 1, change: "Nueva certificación de producción · hace 12 días", evidence: ["Registro comercial", "Certificación añadida", "hace 12 días"], open: "¿Las compras se deciden a nivel de grupo?" },
    { focus: 5, validate: 4, change: "Ganó un contrato de servicios grande · hace 6 días", evidence: ["Prensa regional", "Adjudicación", "hace 6 días"], open: "¿Está identificado quién decide el presupuesto?" },
    { focus: 1, validate: 0, change: "Anunció dos nuevas sedes · hace 15 días", evidence: ["Diario de negocios", "Dos nuevas sedes", "hace 15 días"], open: "¿El cambio afecta tu categoría?" },
  ],
};

const COPY: Record<LandingLocale, Copy> = { en: EN, es: ES, pt: EN, ja: EN };
const CUE: { d: "monitor" | "hold" }[] = [{ d: "monitor" }, { d: "monitor" }, { d: "monitor" }, { d: "hold" }, { d: "monitor" }, { d: "hold" }];

// Fixed node positions in the SVG field (viewBox 0 0 400 340) — "the market". Attention lines from
// every node converge on the anchor (right-centre), where the focus card sits.
const NODES = [
  { x: 66, y: 56 }, { x: 40, y: 150 }, { x: 96, y: 248 },
  { x: 190, y: 92 }, { x: 158, y: 196 }, { x: 150, y: 300 },
];
const ANCHOR = { x: 392, y: 168 };

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
    const t2 = setTimeout(() => setPhase("focus"), 780);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [obj]);

  const roleOf = (i: number): Role => (i === r.focus ? "focus" : i === r.validate ? "validate" : CUE[i].d);
  const concentrated = phase === "focus";

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

        <div className={styles.stage}>
          {/* The field: nodes = companies, lines = attention converging on the focus. */}
          <svg className={styles.field} viewBox="0 0 400 340" preserveAspectRatio="xMidYMid meet"
            role="img" aria-label={`${c.sectors.length} ${c.considered}. ${c.worth}: ${c.sectors[r.focus]}.`}>
            <defs>
              <radialGradient id="af-focus" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(26,169,232,.26)" /><stop offset="100%" stopColor="rgba(26,169,232,0)" />
              </radialGradient>
            </defs>
            <circle className={styles.anchorGlow} cx={ANCHOR.x} cy={ANCHOR.y} r="62" fill="url(#af-focus)" />
            {c.sectors.map((_, i) => {
              const role = roleOf(i);
              return <line key={`l${i}`} className={`${styles.line} ${styles[`l_${role}`]}`}
                x1={NODES[i].x} y1={NODES[i].y} x2={ANCHOR.x} y2={ANCHOR.y} />;
            })}
            {c.sectors.map((label, i) => {
              const role = roleOf(i);
              const n = NODES[i];
              return (
                <g key={`n${i}`} className={`${styles.node} ${styles[`n_${role}`]}`}>
                  {role === "focus" && <circle className={styles.pulse} cx={n.x} cy={n.y} r="14" />}
                  <circle className={styles.dot} cx={n.x} cy={n.y} r={role === "focus" ? 7 : role === "validate" ? 5.5 : 4.5} />
                  <text className={styles.nlabel} x={n.x + 12} y={n.y + 3.5}>{label}</text>
                </g>
              );
            })}
          </svg>

          {/* The concentrated decision — the focus card. */}
          <div className={styles.focus} data-live={concentrated} key={obj}>
            <span className={styles.worth}>{c.worth}</span>
            <div className={styles.focusTop}>
              <span className={styles.chip} data-d="prioritize">{c.chips.prioritize}</span>
              <span className={styles.focusScope} aria-hidden="true">1 / {c.sectors.length}</span>
            </div>
            <h3 className={styles.focusName}>{c.sectors[r.focus]}</h3>
            <div className={styles.why}><span className={styles.microLabel}>{c.whyNow}</span><b>{r.change}</b></div>
            <div className={styles.rail}>
              <span className={styles.microLabel}>{c.evidence}</span>
              <ol className={styles.railTrack}>{r.evidence.map((t, k) => <li key={k}>{t}</li>)}</ol>
            </div>
            <div className={styles.open}><span className={styles.microLabel} data-d="validate">{c.openQuestion}</span><b>{r.open}</b></div>
          </div>
        </div>

        <p className={styles.readout} aria-live="polite">{c.readout[phase]}</p>
      </div>
    </section>
  );
}
