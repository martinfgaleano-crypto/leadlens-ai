"use client";

// LeadLens hero — the "attention field".
// An interactive EXPLANATION of the mechanism (not a dashboard, not named companies): a commercial
// objective sits over a field of abstract commercial possibilities. Changing the objective changes the
// whole reading — a different recent change becomes relevant, different evidence attaches, a different
// possibility earns attention, a different question stays open, and the rest re-rank. Attention
// concentrates to a justified focus, with the reasoning (what changed + evidence) visible and the
// uncertainty kept in view. No opaque scores, no fake activity, no company names — illustrative.

import { useEffect, useMemo, useRef, useState } from "react";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./attention-field.module.css";

type Phase = "release" | "research" | "focus";
type Role = "focus" | "validate" | "context" | "faint";
type Reading = { focus: number; validate: number; change: string; evidence: [string, string, string]; open: string };

interface Copy {
  aria: string; objectiveLabel: string; objectives: string[]; sectors: string[];
  chips: { prioritize: string; validate: string }; cueLabels: { monitor: string; hold: string }; whyNow: string; evidence: string; openQuestion: string;
  because: string; watching: string; readout: Record<Phase, string>;
  readings: Reading[];
}

const EN: Copy = {
  aria: "How LeadLens concentrates attention — an interactive explanation",
  objectiveLabel: "Objective",
  objectives: ["Expand into a new market", "Find new partners", "Win new clients", "Prioritize target accounts"],
  sectors: ["Regional logistics", "Multi-site healthcare", "Specialty manufacturing", "Food distribution", "Industrial services", "Field services"],
  chips: { prioritize: "Prioritize", validate: "Validate" }, cueLabels: { monitor: "Monitor", hold: "Hold" },
  whyNow: "Why now", evidence: "Evidence", openQuestion: "Open question",
  because: "Attention here because of a recent change and evidence you can inspect.",
  watching: "Kept in view — watched for change.",
  readout: {
    release: "Start from your objective and a field of commercial possibilities.",
    research: "Research adds evidence — and a recent change reorders what matters.",
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
  aria: "Cómo LeadLens concentra la atención — una explicación interactiva",
  objectiveLabel: "Objetivo",
  objectives: ["Entrar a un nuevo mercado", "Encontrar socios", "Ganar nuevos clientes", "Priorizar cuentas objetivo"],
  sectors: ["Logística regional", "Salud multisede", "Manufactura especializada", "Distribución de alimentos", "Servicios industriales", "Servicios de campo"],
  chips: { prioritize: "Priorizar", validate: "Validar" }, cueLabels: { monitor: "Monitorear", hold: "Reservar" },
  whyNow: "Por qué ahora", evidence: "Evidencia", openQuestion: "Pregunta abierta",
  because: "Atención aquí por un cambio reciente y evidencia que puedes revisar.",
  watching: "En vista — en observación por cambios.",
  readout: {
    release: "Parte de tu objetivo y un campo de posibilidades comerciales.",
    research: "La investigación añade evidencia — y un cambio reciente reordena lo que importa.",
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

// Rest scatter (%, within the stage). Concentrated slots: focus dominant left, considered set right.
const REST = [
  { x: 5, y: 12, s: 1 }, { x: 54, y: 6, s: .94 }, { x: 30, y: 34, s: 1.02 },
  { x: 68, y: 40, s: .9 }, { x: 10, y: 62, s: .96 }, { x: 48, y: 66, s: .86 },
];
const CONTEXT_SLOTS = [{ x: 62, y: 46, s: .9, o: .96 }, { x: 62, y: 68, s: .9, o: .96 }];
const FAINT_SLOTS = [{ x: 62, y: 88, s: .82, o: .55 }, { x: 83, y: 88, s: .82, o: .55 }];
const FOCUS_POS = { x: 2, y: 20, s: 1, o: 1 };      // focus uses its own larger box, no scale
const VALIDATE_POS = { x: 60, y: 5, s: 1, o: 1 };
// Secondary "considered" cues (relative standing) — one per sector, deterministic + illustrative.
const CUE: { d: "monitor" | "hold"; ev: number }[] = [
  { d: "monitor", ev: 2 }, { d: "monitor", ev: 1 }, { d: "monitor", ev: 2 },
  { d: "hold", ev: 1 }, { d: "monitor", ev: 1 }, { d: "hold", ev: 1 },
];

export function AttentionField({ locale }: { locale: LandingLocale }) {
  const c = COPY[locale] ?? EN;
  const [obj, setObj] = useState(0);
  const [phase, setPhase] = useState<Phase>("focus");
  const [hover, setHover] = useState<number | null>(null);
  const [trace, setTrace] = useState(false);
  const reduce = useRef(false);
  const r = c.readings[obj];

  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setTrace(false);
    if (reduce.current) { setPhase("focus"); return; }
    setPhase("release");
    const t1 = setTimeout(() => setPhase("research"), 260);
    const t2 = setTimeout(() => setPhase("focus"), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [obj]);

  const layout = useMemo(() => {
    const n = c.sectors.length;
    const rest = Array.from({ length: n }, (_, k) => k).filter((k) => k !== r.focus && k !== r.validate);
    const map: Record<number, { role: Role; slot: number }> = {};
    map[r.focus] = { role: "focus", slot: 0 };
    map[r.validate] = { role: "validate", slot: 0 };
    rest.forEach((i, idx) => { map[i] = idx < CONTEXT_SLOTS.length ? { role: "context", slot: idx } : { role: "faint", slot: idx - CONTEXT_SLOTS.length }; });
    return map;
  }, [obj, c.sectors.length, r.focus, r.validate]);

  const nextObjective = () => setObj((o) => (o + 1) % c.objectives.length);
  const concentrated = phase === "focus";

  return (
    <section className={styles.wrap} data-phase={phase} aria-label={c.aria}>
      <button type="button" className={styles.objective} onClick={nextObjective}
        aria-label={`${c.objectiveLabel}: ${c.objectives[obj]} — ${locale === "es" ? "cambiar objetivo" : "change objective"}`}>
        <span>{c.objectiveLabel}</span><b>{c.objectives[obj]}</b><i aria-hidden="true">⇢</i>
      </button>

      <div className={styles.stage}>
        {c.sectors.map((label, i) => {
          const L = layout[i];
          const isFocus = concentrated && L.role === "focus";
          const isVal = concentrated && L.role === "validate";
          const isFaint = concentrated && L.role === "faint";
          const rest = REST[i];
          const pos = !concentrated
            ? { x: rest.x, y: rest.y, s: rest.s, o: phase === "research" ? 1 : .82 }
            : L.role === "focus" ? FOCUS_POS
              : L.role === "validate" ? VALIDATE_POS
                : L.role === "context" ? CONTEXT_SLOTS[L.slot]
                  : (FAINT_SLOTS[L.slot] ?? FAINT_SLOTS[FAINT_SLOTS.length - 1]);
          const cue = CUE[i];
          return (
            <button
              type="button" key={label}
              className={`${styles.tile}${isFocus ? " " + styles.tFocus : ""}${isVal ? " " + styles.tVal : ""}${isFaint ? " " + styles.tFaint : ""}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, ["--s" as string]: pos.s, ["--o" as string]: pos.o }}
              onMouseEnter={() => { setHover(i); if (isFocus) setTrace(true); }}
              onMouseLeave={() => { setHover(null); if (isFocus) setTrace(false); }}
              onFocus={() => { setHover(i); if (isFocus) setTrace(true); }}
              onBlur={() => { setHover(null); if (isFocus) setTrace(false); }}
              aria-label={label}
            >
              {isFocus && <span className={styles.chip}>{c.chips.prioritize}</span>}
              {isVal && <span className={`${styles.chip} ${styles.chipVal}`}>{c.chips.validate}</span>}
              <span className={styles.label}>{label}</span>

              {isFocus && <>
                <span className={styles.change}><em>{c.whyNow}</em>{r.change}</span>
                <span className={`${styles.trace}${trace ? " " + styles.traceOpen : ""}`}>
                  <em>{c.evidence}</em>
                  <span className={styles.chips}>{r.evidence.map((t, k) => <b key={k}>{t}</b>)}</span>
                </span>
              </>}
              {isVal && <span className={styles.q}><em>{c.openQuestion}</em>{r.open}</span>}

              {concentrated && (L.role === "context" || L.role === "faint") &&
                <span className={styles.cue}>
                  <i className={`${styles.cdot} ${cue.d === "hold" ? styles.cHold : styles.cMon}`} aria-hidden="true" />
                  <b>{cue.d === "hold" ? c.cueLabels.hold : c.cueLabels.monitor}</b>
                </span>}
            </button>
          );
        })}
      </div>

      <p className={styles.readout} aria-live="polite">{hover !== null ? c.sectors[hover] : c.readout[phase]}</p>
    </section>
  );
}
