"use client";

// Guided story deck — the hero's main object. Five manual, visitor-controlled panels that answer,
// in order: what LeadLens is, why it's different, why it's worth paying for, what you receive, and
// how to start. No autoplay. Prev/next + clickable step titles + swipe + arrow keys; reduced-motion
// safe. Lightweight: React state + CSS transforms only, no carousel dependency. Slide 04 renders the
// real decision brief passed in as `brief`. Product truth preserved; no scores, no buyer-intent.

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./story-deck.module.css";

interface Slide { step: string; kicker: string; head: string; body: string; visual: "shortlist" | "why" | "worth" | "brief" | "start" }
interface Copy {
  aria: string; prev: string; next: string; primary: string; secondary: string;
  slides: Slide[];
  shortlist: Array<{ d: "p" | "v" | "m"; verdict: string; co: string }>;
  why: Array<{ k: string; v: string; me?: boolean }>;
  worth: { without: string; withL: string; withoutItems: string[]; withItems: string[] };
  steps: string[];
}

const EN: Copy = {
  aria: "What LeadLens is, in five steps", prev: "Previous", next: "Next",
  primary: "Find where to focus", secondary: "See a sample brief",
  slides: [
    { step: "01", kicker: "What is LeadLens", head: "Know which companies deserve your attention.", body: "LeadLens turns public company evidence into a short, ranked view of where commercial effort belongs — and why.", visual: "shortlist" },
    { step: "02", kicker: "Why LeadLens", head: "Not more data. A decision you can check.", body: "Databases tell you who exists. Signal tools tell you what happened. LeadLens tells you what deserves attention now.", visual: "why" },
    { step: "03", kicker: "Why it's worth it", head: "Your team's time is worth more than the searching.", body: "Instead of chasing every company across a dozen tabs, you get a handful of evidence-backed calls, ready to act on.", visual: "worth" },
    { step: "04", kicker: "What you get", head: "A brief you can defend.", body: "For each company: the decision, why now, the dated evidence, what's still uncertain, and what to check next.", visual: "brief" },
    { step: "05", kicker: "How to start", head: "Point us at your market. Get the decisions.", body: "Tell LeadLens what you sell and want to achieve. It researches the companies that matter, and hands you the calls with the reasoning.", visual: "start" },
  ],
  shortlist: [
    { d: "p", verdict: "Prioritize", co: "Multi-site healthcare group" },
    { d: "v", verdict: "Validate", co: "Regional logistics operator" },
    { d: "m", verdict: "Monitor", co: "Specialty manufacturer" },
  ],
  why: [{ k: "Databases", v: "who exists" }, { k: "Signal tools", v: "what happened" }, { k: "LeadLens", v: "what deserves attention — and why", me: true }],
  worth: { without: "On your own", withL: "With LeadLens", withoutItems: ["Dozens of tabs and sources", "Every company still needs judgment", "Effort spread across weak leads"], withItems: ["A handful of evidence-backed calls", "The reason and timing attached", "Ready to inspect and act on"] },
  steps: ["Tell us what you sell and what you want to achieve.", "LeadLens researches the companies that matter.", "Receive the decisions — with the reasoning behind them."],
};

const ES: Copy = {
  aria: "Qué es LeadLens, en cinco pasos", prev: "Anterior", next: "Siguiente",
  primary: "Encuentra dónde enfocarte", secondary: "Ver un informe de muestra",
  slides: [
    { step: "01", kicker: "Qué es LeadLens", head: "Sabe qué empresas merecen tu atención.", body: "LeadLens convierte la evidencia pública de empresas en una vista corta y priorizada de dónde corresponde el esfuerzo comercial — y por qué.", visual: "shortlist" },
    { step: "02", kicker: "Por qué LeadLens", head: "No más datos. Una decisión que puedes verificar.", body: "Las bases de datos dicen quién existe. Las herramientas de señales, qué pasó. LeadLens dice qué merece atención ahora.", visual: "why" },
    { step: "03", kicker: "Por qué vale la pena", head: "El tiempo de tu equipo vale más que la búsqueda.", body: "En vez de perseguir cada empresa entre mil pestañas, recibes unas pocas decisiones respaldadas por evidencia, listas para actuar.", visual: "worth" },
    { step: "04", kicker: "Qué recibes", head: "Un informe que puedes defender.", body: "Para cada empresa: la decisión, por qué ahora, la evidencia fechada, qué queda incierto y qué verificar después.", visual: "brief" },
    { step: "05", kicker: "Cómo empezar", head: "Apúntanos a tu mercado. Recibe las decisiones.", body: "Dile a LeadLens qué vendes y qué quieres lograr. Investiga las empresas que importan y te entrega las decisiones con el razonamiento.", visual: "start" },
  ],
  shortlist: [
    { d: "p", verdict: "Priorizar", co: "Grupo de salud multisede" },
    { d: "v", verdict: "Validar", co: "Operador de logística regional" },
    { d: "m", verdict: "Monitorear", co: "Fabricante especializado" },
  ],
  why: [{ k: "Bases de datos", v: "quién existe" }, { k: "Señales", v: "qué pasó" }, { k: "LeadLens", v: "qué merece atención — y por qué", me: true }],
  worth: { without: "Por tu cuenta", withL: "Con LeadLens", withoutItems: ["Decenas de pestañas y fuentes", "Cada empresa aún requiere criterio", "Esfuerzo repartido en leads débiles"], withItems: ["Unas pocas decisiones con evidencia", "El motivo y el timing incluidos", "Listas para inspeccionar y actuar"] },
  steps: ["Dinos qué vendes y qué quieres lograr.", "LeadLens investiga las empresas que importan.", "Recibe las decisiones — con el razonamiento detrás."],
};

const COPY: Record<LandingLocale, Copy> = { en: EN, es: ES, pt: EN, ja: EN };

export function StoryDeck({ locale, brief, primaryHref }: { locale: LandingLocale; brief: ReactNode; primaryHref: string }) {
  const c = COPY[locale] ?? EN;
  const [i, setI] = useState(0);
  const n = c.slides.length;
  const go = useCallback((to: number) => setI((prev) => Math.max(0, Math.min(n - 1, to === -1 ? prev : to))), [n]);
  const region = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); setI((p) => Math.min(n - 1, p + 1)); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setI((p) => Math.max(0, p - 1)); }
  }, [n]);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 45) setI((p) => Math.max(0, Math.min(n - 1, p + (dx < 0 ? 1 : -1))));
    touchX.current = null;
  };
  return (
    <section className={styles.deck} aria-roledescription="carousel" aria-label={c.aria}
      tabIndex={0} onKeyDown={onKey} ref={region}>
      <div className={styles.rail} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-live="polite">
        {(() => {
          const s = c.slides[i];
          return (
            <article key={i} className={styles.slide} role="group" aria-roledescription="slide"
              aria-label={`${s.step} — ${s.kicker} (${i + 1}/${n})`}>
              <div className={styles.copy}>
                <span className={styles.kicker}>{s.kicker}</span>
                <h2 className={styles.head}>{s.head}</h2>
                <p className={styles.body}>{s.body}</p>
                {s.visual === "start" && (
                  <div className={styles.cta}>
                    <Link className={styles.primary} href={primaryHref}>{c.primary}</Link>
                    <Link className={styles.secondary} href="/sample">{c.secondary} →</Link>
                  </div>
                )}
              </div>
              <div className={styles.visual}>{renderVisual(s.visual, c, brief)}</div>
            </article>
          );
        })()}
      </div>

      <div className={styles.controls}>
        <ol className={styles.progress}>
          {c.slides.map((s, idx) => (
            <li key={s.step}>
              <button type="button" className={`${styles.step}${idx === i ? " " + styles.on : ""}`}
                aria-current={idx === i ? "true" : undefined} onClick={() => go(idx)}>
                <span className={styles.stepNum}>{s.step}</span><span className={styles.stepName}>{s.kicker}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className={styles.arrows}>
          <button type="button" className={styles.arrow} onClick={() => go(i - 1)} disabled={i === 0} aria-label={c.prev}>‹</button>
          <span className={styles.count} aria-hidden="true">{i + 1} / {n}</span>
          <button type="button" className={styles.arrow} onClick={() => go(i + 1)} disabled={i === n - 1} aria-label={c.next}>›</button>
        </div>
      </div>
    </section>
  );
}

function renderVisual(kind: Slide["visual"], c: Copy, brief: ReactNode): ReactNode {
  if (kind === "brief") return <div className={styles.briefWrap}>{brief}</div>;
  if (kind === "shortlist") return (
    <ul className={styles.glance}>
      {c.shortlist.map((r) => (
        <li key={r.co} className={styles.gRow} data-d={r.d}>
          <span className={styles.gVerdict}>{r.verdict}</span><span className={styles.gCo}>{r.co}</span>
        </li>
      ))}
    </ul>
  );
  if (kind === "why") return (
    <ul className={styles.why}>
      {c.why.map((r) => (
        <li key={r.k} className={r.me ? styles.whyMe : undefined}><span>{r.k}</span><p>{r.v}</p></li>
      ))}
    </ul>
  );
  if (kind === "worth") return (
    <div className={styles.worth}>
      <div className={styles.wCol} data-tone="cold"><span>{c.worth.without}</span><ul>{c.worth.withoutItems.map((x) => <li key={x}>{x}</li>)}</ul></div>
      <div className={styles.wArrow} aria-hidden="true">→</div>
      <div className={`${styles.wCol} ${styles.wColMe}`}><span>{c.worth.withL}</span><ul>{c.worth.withItems.map((x) => <li key={x}>{x}</li>)}</ul></div>
    </div>
  );
  // start
  return (
    <ol className={styles.steps}>
      {c.steps.map((s, idx) => <li key={s}><b>{idx + 1}</b><span>{s}</span></li>)}
    </ol>
  );
}
