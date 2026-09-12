"use client";

// LeadLens hero — "Market → LeadLens reads → Focus".
// A product explainer with three legible stages: a researched MARKET (a set of companies), the
// INTELLIGENCE LeadLens applies (weighing recent change, evidence, timing and uncertainty for your
// objective), and the resulting FOCUS (the few worth pursuing now, with why-now, an evidence cue and
// the open question). Pick a commercial objective and the whole pipeline re-reads: the weighting
// shifts, the market re-highlights, a different focus emerges. No opaque scores, no fake activity,
// no contact list — colour is the canonical Decision. Synthetic, illustrative.

import { useEffect, useMemo, useRef, useState } from "react";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./attention-field.module.css";

type Phase = "reset" | "reading" | "focus";
type Reading = { focus: number; validate: number; change: string; evidence: string; open: string };

interface Copy {
  aria: string; objectiveLabel: string; objectives: string[]; objectivesShort: string[]; tryHint: string;
  stages: { market: string; reading: string; focus: string };
  criteria: string[]; sectors: string[]; chips: { prioritize: string; validate: string };
  whyNow: string; evidence: string; openQuestion: string;
  readout: Record<Phase, string>; readings: Reading[]; weights: number[][];
}

const EN: Copy = {
  aria: "How LeadLens reads a market into a commercial focus — interactive",
  objectiveLabel: "Your commercial objective",
  objectives: ["Expand into a new market", "Find new partners", "Win new clients", "Prioritize target accounts"],
  objectivesShort: ["New market", "New partners", "New clients", "Target accounts"],
  tryHint: "Pick an objective — the reading updates",
  stages: { market: "The market", reading: "LeadLens reads", focus: "Worth pursuing now" },
  criteria: ["Recent change", "Evidence", "Timing", "Uncertainty"],
  sectors: ["Regional logistics", "Multi-site healthcare", "Specialty manufacturing", "Food distribution", "Industrial services", "Field services"],
  chips: { prioritize: "Prioritize", validate: "Validate" },
  whyNow: "Why now", evidence: "Evidence", openQuestion: "Open question",
  readout: {
    reset: "A researched market of companies.",
    reading: "Weighing recent change, evidence, timing and uncertainty…",
    focus: "A few companies justify attention now — with the reason attached.",
  },
  readings: [
    { focus: 0, validate: 3, change: "Opened a regional hub · 9 days ago", evidence: "Company announcement · dated", open: "Central or per-region procurement?" },
    { focus: 2, validate: 1, change: "New production certification · 12 days ago", evidence: "Trade registry · dated", open: "Sourcing decided at group level?" },
    { focus: 5, validate: 4, change: "Won a large service contract · 6 days ago", evidence: "Regional press · dated", open: "Is the budget owner identified?" },
    { focus: 1, validate: 0, change: "Announced two new sites · 15 days ago", evidence: "Business journal · dated", open: "Does the change affect your category?" },
  ],
  weights: [[3, 2, 3, 1], [2, 3, 2, 2], [2, 3, 3, 1], [3, 2, 2, 3]],
};

const ES: Copy = {
  aria: "Cómo LeadLens lee un mercado hasta un foco comercial — interactivo",
  objectiveLabel: "Tu objetivo comercial",
  objectives: ["Entrar a un nuevo mercado", "Encontrar socios", "Ganar nuevos clientes", "Priorizar cuentas objetivo"],
  objectivesShort: ["Nuevo mercado", "Socios", "Clientes", "Cuentas objetivo"],
  tryHint: "Elige un objetivo — la lectura se actualiza",
  stages: { market: "El mercado", reading: "LeadLens lee", focus: "Vale la pena ahora" },
  criteria: ["Cambio reciente", "Evidencia", "Timing", "Incertidumbre"],
  sectors: ["Logística regional", "Salud multisede", "Manufactura especializada", "Distribución de alimentos", "Servicios industriales", "Servicios de campo"],
  chips: { prioritize: "Priorizar", validate: "Validar" },
  whyNow: "Por qué ahora", evidence: "Evidencia", openQuestion: "Pregunta abierta",
  readout: {
    reset: "Un mercado investigado de empresas.",
    reading: "Ponderando cambio reciente, evidencia, timing e incertidumbre…",
    focus: "Unas pocas empresas merecen atención ahora — con la razón adjunta.",
  },
  readings: [
    { focus: 0, validate: 3, change: "Abrió un hub regional · hace 9 días", evidence: "Anuncio de la empresa · fechado", open: "¿Compras central o por región?" },
    { focus: 2, validate: 1, change: "Nueva certificación de producción · hace 12 días", evidence: "Registro comercial · fechado", open: "¿Compras a nivel de grupo?" },
    { focus: 5, validate: 4, change: "Ganó un contrato de servicios grande · hace 6 días", evidence: "Prensa regional · fechado", open: "¿Se identificó quién decide el presupuesto?" },
    { focus: 1, validate: 0, change: "Anunció dos nuevas sedes · hace 15 días", evidence: "Diario de negocios · fechado", open: "¿El cambio afecta tu categoría?" },
  ],
  weights: [[3, 2, 3, 1], [2, 3, 2, 2], [2, 3, 3, 1], [3, 2, 2, 3]],
};

const COPY: Record<LandingLocale, Copy> = { en: EN, es: ES, pt: EN, ja: EN };

export function AttentionField({ locale }: { locale: LandingLocale }) {
  const c = COPY[locale] ?? EN;
  const [obj, setObj] = useState(0);
  const [phase, setPhase] = useState<Phase>("focus");
  const reduce = useRef(false);
  const r = c.readings[obj];
  const w = c.weights[obj];

  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) { setPhase("focus"); return; }
    setPhase("reset");
    const t1 = setTimeout(() => setPhase("reading"), 240);
    const t2 = setTimeout(() => setPhase("focus"), 820);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [obj]);

  const marketRole = useMemo(() => c.sectors.map((_, i) =>
    i === r.focus ? "focus" : i === r.validate ? "validate" : "rest"), [c.sectors, r.focus, r.validate]);
  const concentrated = phase === "focus";

  return (
    <section className={`${styles.wrap} ${styles[phase]}`} aria-label={c.aria}>
      <div className={styles.instrument}>
        <div className={styles.head}>
          <span className={styles.objEyebrow}>{c.objectiveLabel}</span>
          <div className={styles.objTabs} role="tablist" aria-label={c.objectiveLabel}>
            {c.objectives.map((ob, i) => (
              <button key={ob} type="button" role="tab" aria-selected={obj === i}
                className={`${styles.objTab}${obj === i ? " " + styles.objTabOn : ""}`}
                aria-label={ob} onClick={() => setObj(i)}>{c.objectivesShort[i]}</button>
            ))}
          </div>
          <span className={styles.objHint}><i aria-hidden="true">↻</i> {c.tryHint}</span>
        </div>

        <div className={styles.pipe}>
          {/* MARKET */}
          <div className={styles.stage}>
            <span className={styles.stageLabel}>{c.stages.market}</span>
            <ul className={styles.market}>
              {c.sectors.map((s, i) => (
                <li key={s} className={styles.mRow} data-role={marketRole[i]}>
                  <i className={styles.mDot} data-role={marketRole[i]} aria-hidden="true" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          <span className={styles.flow} aria-hidden="true" />

          {/* INTELLIGENCE */}
          <div className={styles.stage}>
            <span className={styles.stageLabel} data-lens="1">{c.stages.reading}</span>
            <ul className={styles.reads}>
              {c.criteria.map((cr, i) => (
                <li key={cr} className={styles.crit} data-hot={w[i] >= 3}>
                  <span className={styles.critName}>{cr}</span>
                  <span className={styles.meter} aria-hidden="true">
                    {[0, 1, 2].map((b) => <i key={b} className={b < w[i] ? styles.on : ""} />)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <span className={styles.flow} aria-hidden="true" />

          {/* FOCUS */}
          <div className={styles.stage} data-live={concentrated}>
            <span className={styles.stageLabel} data-focus="1">{c.stages.focus}</span>
            <div className={styles.result} key={obj}>
              <div className={styles.card} data-d="prioritize">
                <span className={styles.chip} data-d="prioritize">{c.chips.prioritize}</span>
                <b className={styles.cardName}>{c.sectors[r.focus]}</b>
                <span className={styles.cardWhy}><em>{c.whyNow}</em>{r.change}</span>
                <span className={styles.cardEv}>{r.evidence}</span>
              </div>
              <div className={styles.card} data-d="validate">
                <span className={styles.chip} data-d="validate">{c.chips.validate}</span>
                <b className={styles.cardName}>{c.sectors[r.validate]}</b>
                <span className={styles.cardWhy}><em>{c.openQuestion}</em>{r.open}</span>
              </div>
            </div>
          </div>
        </div>

        <p className={styles.readout} aria-live="polite">{c.readout[phase]}</p>
      </div>
    </section>
  );
}
