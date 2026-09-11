"use client";

// LeadLens hero — the "attention field".
// An interactive EXPLANATION of the mechanism (not a sample dashboard, not named companies): a
// commercial objective sits over a field of abstract commercial possibilities. As research enters,
// evidence attaches, a recent change reorganizes the field, one question stays open, and attention
// CONCENTRATES to a justified focus. Change the objective and the focus moves — teaching that the
// objective drives where attention belongs. No company names, no opaque scores, no fake live activity.

import { useEffect, useMemo, useRef, useState } from "react";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./attention-field.module.css";

type Phase = "rest" | "research" | "focus";
type Role = "focus" | "validate" | "context" | "faint";

interface Copy {
  aria: string; objectives: string[]; sectors: string[];
  chips: { prioritize: string; validate: string };
  focusWhy: string; validateWhy: string; openQ: string;
  readout: Record<Phase, string>; objectiveLabel: string; seeWhy: string;
}

const EN: Copy = {
  aria: "How LeadLens concentrates attention — an interactive explanation",
  objectives: ["Expand into a new market", "Find new partners", "Win new clients", "Prioritize target accounts"],
  sectors: ["Regional logistics", "Multi-site healthcare", "Specialty manufacturing", "Food distribution", "Industrial services", "Field services"],
  chips: { prioritize: "Prioritize", validate: "Validate" },
  focusWhy: "A recent, dated change strengthens the case here.",
  validateWhy: "Promising — but one question is still open.",
  openQ: "Open question",
  readout: {
    rest: "Start from your objective and a field of commercial possibilities.",
    research: "Research adds evidence — and a recent change reorders what matters.",
    focus: "Attention concentrates: here is where it belongs, and why.",
  },
  objectiveLabel: "Objective", seeWhy: "See the reasoning",
};

const ES: Copy = {
  aria: "Cómo LeadLens concentra la atención — una explicación interactiva",
  objectives: ["Entrar a un nuevo mercado", "Encontrar socios", "Ganar nuevos clientes", "Priorizar cuentas objetivo"],
  sectors: ["Logística regional", "Salud multisede", "Manufactura especializada", "Distribución de alimentos", "Servicios industriales", "Servicios de campo"],
  chips: { prioritize: "Priorizar", validate: "Validar" },
  focusWhy: "Un cambio reciente y fechado refuerza el caso aquí.",
  validateWhy: "Prometedor — pero queda una pregunta abierta.",
  openQ: "Pregunta abierta",
  readout: {
    rest: "Parte de tu objetivo y un campo de posibilidades comerciales.",
    research: "La investigación añade evidencia — y un cambio reciente reordena lo que importa.",
    focus: "La atención se concentra: aquí es dónde corresponde, y por qué.",
  },
  objectiveLabel: "Objetivo", seeWhy: "Ver el razonamiento",
};

const COPY: Record<LandingLocale, Copy> = { en: EN, es: ES, pt: EN, ja: EN };

// Six possibilities. Rest = a designed asymmetric scatter (%, within the stage). Focus phase =
// a clean concentrated composition: focus dominant left, a considered set descending on the right.
const REST = [
  { x: 5, y: 12, s: 1 }, { x: 54, y: 6, s: .94 }, { x: 30, y: 34, s: 1.02 },
  { x: 68, y: 40, s: .9 }, { x: 10, y: 62, s: .96 }, { x: 48, y: 66, s: .86 },
];
// Concentrated slots. Focus left; validate + a descending considered set on the right.
const CONTEXT_SLOTS = [{ x: 60, y: 44, s: .82, o: .95 }, { x: 60, y: 64, s: .82, o: .95 }];
const FAINT_SLOTS = [{ x: 60, y: 83, s: .6, o: .5 }, { x: 80, y: 83, s: .6, o: .5 }];
const FOCUS_POS = { x: 3, y: 24, s: 1.5, o: 1 };
const VALIDATE_POS = { x: 60, y: 5, s: 1.02, o: 1 };
// Per objective: which tile becomes the focus and which becomes the validate (distinct).
const FOCUS_MAP = [0, 2, 4, 5];
const VAL_MAP = [3, 1, 5, 2];

export function AttentionField({ locale }: { locale: LandingLocale }) {
  const c = COPY[locale] ?? EN;
  const [obj, setObj] = useState(0);
  const [phase, setPhase] = useState<Phase>("rest");
  const [hover, setHover] = useState<number | null>(null);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) { setPhase("focus"); return; }
    setPhase("rest");
    const t1 = setTimeout(() => setPhase("research"), 320);
    const t2 = setTimeout(() => setPhase("focus"), 1250);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [obj]);

  const focusI = FOCUS_MAP[obj], valI = VAL_MAP[obj];
  // Deterministic role + slot per tile for the concentrated (focus) phase.
  const layout = useMemo(() => {
    const n = c.sectors.length;
    const rest = Array.from({ length: n }, (_, k) => k).filter((k) => k !== focusI && k !== valI);
    const map: Record<number, { role: Role; slot: number }> = {};
    map[focusI] = { role: "focus", slot: 0 };
    map[valI] = { role: "validate", slot: 0 };
    rest.forEach((i, idx) => { map[i] = idx < CONTEXT_SLOTS.length ? { role: "context", slot: idx } : { role: "faint", slot: idx - CONTEXT_SLOTS.length }; });
    return map;
  }, [obj, c.sectors.length]);

  const nextObjective = () => { setObj((o) => (o + 1) % c.objectives.length); };

  return (
    <section className={styles.wrap} data-phase={phase} aria-label={c.aria}>
      <button type="button" className={styles.objective} onClick={nextObjective} aria-label={`${c.objectiveLabel}: ${c.objectives[obj]} — ${locale === "es" ? "cambiar" : "change"}`}>
        <span>{c.objectiveLabel}</span><b>{c.objectives[obj]}</b><i aria-hidden="true">⇢</i>
      </button>

      <div className={styles.stage}>
        {c.sectors.map((label, i) => {
          const L = layout[i];
          const isFocus = phase === "focus" && L.role === "focus";
          const isVal = phase === "focus" && L.role === "validate";
          const isFaint = phase === "focus" && L.role === "faint";
          const rest = REST[i];
          const pos = phase !== "focus"
            ? { x: rest.x, y: rest.y, s: rest.s, o: phase === "research" ? 1 : .9 }
            : L.role === "focus" ? FOCUS_POS
              : L.role === "validate" ? VALIDATE_POS
                : L.role === "context" ? CONTEXT_SLOTS[L.slot]
                  : (FAINT_SLOTS[L.slot] ?? FAINT_SLOTS[FAINT_SLOTS.length - 1]);
          const showEv = phase !== "rest";
          const ev = isFocus ? 3 : isVal ? 2 : 1;
          return (
            <button
              type="button" key={label}
              className={`${styles.tile}${isFocus ? " " + styles.tFocus : ""}${isVal ? " " + styles.tVal : ""}${isFaint ? " " + styles.tFaint : ""}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, ["--s" as string]: pos.s, ["--o" as string]: pos.o }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              aria-label={label}
            >
              {isFocus && <span className={styles.chip}>{c.chips.prioritize}</span>}
              {isVal && <span className={`${styles.chip} ${styles.chipVal}`}>{c.chips.validate}</span>}
              <span className={styles.label}>{label}</span>
              {showEv && <span className={styles.ev} aria-hidden="true">{[0, 1, 2].map((d) => <i key={d} className={d < ev ? styles.on : ""} />)}</span>}
              {isFocus && <span className={styles.change} aria-hidden="true" />}
              {isFocus && <span className={styles.why}>{c.focusWhy}</span>}
              {isVal && <span className={styles.q}><b>{c.openQ}</b>{c.validateWhy}</span>}
            </button>
          );
        })}
      </div>

      <p className={styles.readout} aria-live="polite">{hover !== null ? c.sectors[hover] : c.readout[phase]}</p>
    </section>
  );
}
