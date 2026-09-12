"use client";

// LeadLens hero — "noise → focus". A product explainer, not a company sample: a whole market of
// companies (a field of ~48 dots) that LeadLens reads and concentrates into the few worth pursuing
// now. Pick a commercial objective and the market re-reads — most companies recede, a few brighten
// (Prioritize / Validate) and pull into focus, and a live count shows the concentration ("3 of 48
// worth pursuing now"). This teaches what LeadLens IS — turning commercial noise into a disciplined
// focus — through interaction. No opaque scores, no contact lists, no fake activity; every dot is a
// company, colour is the canonical Decision. Synthetic, illustrative.

import { useEffect, useMemo, useRef, useState } from "react";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./attention-field.module.css";

type Phase = "market" | "reading" | "focus";

interface Copy {
  aria: string; objectiveLabel: string; objectives: string[]; objectivesShort: string[]; tryHint: string;
  worthPre: string; worthPost: string; poolWord: string; considered: string; prioritize: string; validate: string; rest: string;
  why: string; readout: Record<Phase, string>;
}

const EN: Copy = {
  aria: "How LeadLens turns a whole market into a few companies worth pursuing — interactive",
  objectiveLabel: "Your commercial objective",
  objectives: ["Expand into a new market", "Find new partners", "Win new clients", "Prioritize target accounts"],
  objectivesShort: ["New market", "New partners", "New clients", "Target accounts"],
  tryHint: "Switch the objective — watch the market re-read",
  worthPre: "", worthPost: "worth pursuing now", poolWord: "companies", considered: "of 48 in the market",
  prioritize: "Prioritize", validate: "Validate", rest: "The rest can wait",
  why: "LeadLens weighs recent change, evidence and timing — and keeps the uncertainty visible.",
  readout: {
    market: "A whole market of companies you could pursue.",
    reading: "LeadLens reads the market for your objective…",
    focus: "It concentrates commercial effort on the few worth pursuing now.",
  },
};

const ES: Copy = {
  aria: "Cómo LeadLens convierte todo un mercado en unas pocas empresas que vale la pena perseguir — interactivo",
  objectiveLabel: "Tu objetivo comercial",
  objectives: ["Entrar a un nuevo mercado", "Encontrar socios", "Ganar nuevos clientes", "Priorizar cuentas objetivo"],
  objectivesShort: ["Nuevo mercado", "Socios", "Clientes", "Cuentas objetivo"],
  tryHint: "Cambia el objetivo — mira releerse el mercado",
  worthPre: "", worthPost: "que vale la pena ahora", poolWord: "empresas", considered: "de 48 en el mercado",
  prioritize: "Priorizar", validate: "Validar", rest: "El resto puede esperar",
  why: "LeadLens pondera cambios recientes, evidencia y timing — y mantiene la incertidumbre a la vista.",
  readout: {
    market: "Todo un mercado de empresas que podrías perseguir.",
    reading: "LeadLens lee el mercado para tu objetivo…",
    focus: "Concentra el esfuerzo comercial en las pocas que valen la pena ahora.",
  },
};

const COPY: Record<LandingLocale, Copy> = { en: EN, es: ES, pt: EN, ja: EN };

// ── The market: 48 companies at deterministic phyllotaxis (golden-angle) positions. ──
const N = 48;
const CX = 168, CY = 158, MAXR = 150;
const BASE = Array.from({ length: N }, (_, i) => {
  const rr = Math.sqrt((i + 0.5) / N) * MAXR;
  const a = i * 2.399963229; // golden angle
  return { x: +(CX + rr * Math.cos(a)).toFixed(1), y: +(CY + rr * Math.sin(a)).toFixed(1) };
});
// Focus cluster (right side) the chosen companies pull into.
const FOCAL = [
  { x: 356, y: 108 }, { x: 394, y: 150 }, { x: 352, y: 192 },
  { x: 392, y: 106 }, { x: 396, y: 210 }, { x: 358, y: 150 },
];
// Per-objective winners (fixed, illustrative). pri = Prioritize, val = Validate.
const OBJ = [
  { pri: [5, 22], val: [11, 31, 40] },
  { pri: [8, 27, 44], val: [3, 19] },
  { pri: [14, 35], val: [2, 24, 46] },
  { pri: [1, 18, 38], val: [9, 29] },
];

export function AttentionField({ locale }: { locale: LandingLocale }) {
  const c = COPY[locale] ?? EN;
  const [obj, setObj] = useState(0);
  const [phase, setPhase] = useState<Phase>("focus");
  const reduce = useRef(false);
  const o = OBJ[obj];

  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) { setPhase("focus"); return; }
    setPhase("market");
    const t1 = setTimeout(() => setPhase("reading"), 260);
    const t2 = setTimeout(() => setPhase("focus"), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [obj]);

  // Role + target position + focal slot for each company under the current objective.
  const dots = useMemo(() => {
    const slot = new Map<number, number>();
    [...o.pri, ...o.val].forEach((idx, k) => slot.set(idx, k));
    return BASE.map((p, i) => {
      const role = o.pri.includes(i) ? "prioritize" : o.val.includes(i) ? "validate" : "rest";
      const target = role === "rest" ? p : FOCAL[slot.get(i) ?? 0];
      return { i, role, base: p, target };
    });
  }, [obj]);

  const concentrated = phase === "focus";
  const priCount = o.pri.length;

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

        <div className={styles.stage}>
          <svg className={styles.field} viewBox="0 0 440 320" preserveAspectRatio="xMidYMid meet"
            role="img" aria-label={`${N} ${c.considered}. ${concentrated ? priCount : N} ${c.worthPost}.`}>
            <defs>
              <radialGradient id="af-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(26,169,232,.22)" /><stop offset="100%" stopColor="rgba(26,169,232,0)" />
              </radialGradient>
            </defs>
            <circle className={styles.zone} cx="374" cy="158" r="78" fill="url(#af-glow)" />
            {dots.map((d) => {
              const at = concentrated ? d.target : d.base;
              return <circle key={d.i} className={`${styles.dot} ${styles[`d_${d.role}`]}`}
                cx={at.x} cy={at.y} r={concentrated && d.role !== "rest" ? (d.role === "prioritize" ? 6.5 : 5) : 3.4} />;
            })}
          </svg>

          <div className={styles.count} aria-hidden="true">
            <strong>{concentrated ? priCount : N}</strong>
            <span>{concentrated ? c.worthPost : c.poolWord}</span>
            <small>{c.considered}</small>
          </div>
        </div>

        <div className={styles.legend}>
          <span className={styles.lg} data-d="prioritize"><i />{c.prioritize}</span>
          <span className={styles.lg} data-d="validate"><i />{c.validate}</span>
          <span className={styles.lg} data-d="rest"><i />{c.rest}</span>
        </div>
        <p className={styles.why}>{c.why}</p>
        <p className={styles.readout} aria-live="polite">{c.readout[phase]}</p>
      </div>
    </section>
  );
}
