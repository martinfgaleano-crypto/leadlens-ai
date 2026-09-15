"use client";

// HeroCarousel — the hero's right-side visual: a dark "Commercial Intelligence console" that
// explains LeadLens across five manual, visitor-controlled slides. Copy is HQ-frozen (exact English;
// faithful Spanish). No autoplay. Arrows + segmented progress + counter + keyboard + swipe; only the
// active slide renders (stable height, no empty-space jump); reduced-motion honored. React + CSS only.

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./hero-carousel.module.css";

type Kind = "define" | "ladder" | "value" | "deliver" | "start";
interface Slide {
  label: string;
  headline: ReactNode;
  body?: ReactNode;
  kind: Kind;
}
interface Copy {
  aria: string; prev: string; next: string; primary: string; secondary: string;
  slides: Slide[];
  frags: string[]; object: string;                       // 01
  ladder: Array<{ t: string; d: string }>; ladderMe: { t: string; d: string }; // 02
  manual: string[]; compress: string; decisionLabel: string; decision: string; // 03
  record: { decision: string; stamp: string; rows: Array<{ k: string; v: ReactNode; full?: boolean }> }; secondary4: string; // 04
  steps: string[];                                        // 05
}

const EN: Copy = {
  aria: "What LeadLens is, in five steps", prev: "Previous slide", next: "Next slide",
  primary: "Find where to focus", secondary: "See a sample brief",
  slides: [
    { label: "What is LeadLens?", kind: "define",
      headline: "LeadLens is a Commercial Intelligence platform that turns fragmented market and company evidence into structured, evidence-backed commercial decisions.",
      body: "It researches markets and companies, identifies meaningful change, weighs evidence and timing, makes uncertainty explicit, and helps businesses understand where commercial opportunity and attention belong." },
    { label: "Why LeadLens?", kind: "ladder",
      headline: <>Most tools help you find more information. <em>LeadLens helps you decide what to do with it.</em></> },
    { label: "Why is LeadLens worth paying for?", kind: "value",
      headline: "You are not paying for a list of company names. You are paying for the research, comparison, and judgment required to turn a market into a defensible commercial decision.",
      body: "LeadLens reduces the work of piecing together scattered sources, comparing opportunities, checking timing, and deciding where limited commercial effort should go. As the scope increases, LeadLens adds broader comparison, portfolio-level context, and deeper strategic intelligence." },
    { label: "What does LeadLens deliver?", kind: "deliver",
      headline: "LeadLens delivers Commercial Intelligence at both company and portfolio level.",
      body: "Depending on the scope you choose, that can include evaluated companies, Prioritize / Validate / Monitor / Hold decisions, Why Now, dated evidence, uncertainty, counterevidence, next validations, comparative opportunity context, portfolio-level patterns, relevant alternatives, and deeper strategic context." },
    { label: "How do you start with LeadLens?", kind: "start",
      headline: "Start with your commercial context. LeadLens does the research and turns it into intelligence you can use.",
      body: "Tell LeadLens what you sell, who you want to reach, the market or opportunity you want to explore, and what you are trying to achieve. LeadLens interprets that context, researches the relevant markets and companies, evaluates the evidence, and returns the level of Commercial Intelligence appropriate to the scope you choose." },
  ],
  frags: ["press", "filings", "hiring", "registry", "announcements", "expansion"],
  object: "Commercial Intelligence",
  ladder: [
    { t: "Databases", d: "show you who exists." },
    { t: "Signal tools", d: "tell you what happened." },
    { t: "Generic research", d: "gives you more material to interpret." },
  ],
  ladderMe: { t: "LeadLens", d: "brings the evidence together in the context of your business, compares opportunities, and explains why a company or market should be prioritized, validated, monitored, or held." },
  manual: ["Research", "Compare", "Check timing", "Decide"],
  compress: "compressed into",
  decisionLabel: "The decision",
  decision: "A defensible commercial decision",
  record: {
    decision: "Prioritize", stamp: "company + portfolio level",
    rows: [
      { k: "Why now", v: "A recent, dated development" },
      { k: "Dated evidence", v: "Public sources, each dated" },
      { k: "Uncertainty", v: <><em>What still needs checking</em></> },
      { k: "Validate next", v: "The next thing to confirm" },
      { k: "Portfolio context", v: "Comparative patterns and relevant alternatives", full: true },
    ],
  },
  secondary4: "The deliverable is not a lead list. It is an evidence-backed view of where commercial opportunity and attention belong.",
  steps: ["Your commercial context", "Research + evaluation", "Commercial Intelligence"],
};

const ES: Copy = {
  aria: "Qué es LeadLens, en cinco pasos", prev: "Anterior", next: "Siguiente",
  primary: "Encuentra dónde enfocarte", secondary: "Ver un informe de muestra",
  slides: [
    { label: "¿Qué es LeadLens?", kind: "define",
      headline: "LeadLens es una plataforma de Inteligencia Comercial que convierte evidencia fragmentada de mercados y empresas en decisiones comerciales estructuradas y respaldadas por evidencia.",
      body: "Investiga mercados y empresas, identifica cambios relevantes, pondera evidencia y timing, hace explícita la incertidumbre y ayuda a los negocios a entender dónde corresponden la oportunidad y la atención comercial." },
    { label: "¿Por qué LeadLens?", kind: "ladder",
      headline: <>La mayoría de las herramientas te ayudan a encontrar más información. <em>LeadLens te ayuda a decidir qué hacer con ella.</em></> },
    { label: "¿Por qué vale la pena pagar por LeadLens?", kind: "value",
      headline: "No pagas por una lista de nombres de empresas. Pagas por la investigación, la comparación y el criterio necesarios para convertir un mercado en una decisión comercial defendible.",
      body: "LeadLens reduce el trabajo de reunir fuentes dispersas, comparar oportunidades, verificar el timing y decidir dónde debe ir el esfuerzo comercial limitado. A medida que aumenta el alcance, LeadLens añade comparación más amplia, contexto a nivel de portafolio e inteligencia estratégica más profunda." },
    { label: "¿Qué entrega LeadLens?", kind: "deliver",
      headline: "LeadLens entrega Inteligencia Comercial a nivel de empresa y de portafolio.",
      body: "Según el alcance que elijas, eso puede incluir empresas evaluadas, decisiones de Priorizar / Validar / Monitorear / Mantener, Por qué ahora, evidencia fechada, incertidumbre, contraevidencia, próximas validaciones, contexto comparativo de oportunidades, patrones a nivel de portafolio, alternativas relevantes y contexto estratégico más profundo." },
    { label: "¿Cómo empiezas con LeadLens?", kind: "start",
      headline: "Empieza con tu contexto comercial. LeadLens hace la investigación y la convierte en inteligencia que puedes usar.",
      body: "Dile a LeadLens qué vendes, a quién quieres llegar, el mercado u oportunidad que quieres explorar y qué intentas lograr. LeadLens interpreta ese contexto, investiga los mercados y empresas relevantes, evalúa la evidencia y devuelve el nivel de Inteligencia Comercial adecuado al alcance que elijas." },
  ],
  frags: ["prensa", "registros", "contrataciones", "anuncios", "expansión", "informes"],
  object: "Inteligencia Comercial",
  ladder: [
    { t: "Las bases de datos", d: "muestran quién existe." },
    { t: "Las señales", d: "dicen qué pasó." },
    { t: "La investigación genérica", d: "da más material para interpretar." },
  ],
  ladderMe: { t: "LeadLens", d: "reúne la evidencia en el contexto de tu negocio, compara oportunidades y explica por qué una empresa o mercado debería priorizarse, validarse, monitorearse o mantenerse en espera." },
  manual: ["Investigar", "Comparar", "Verificar timing", "Decidir"],
  compress: "se comprime en",
  decisionLabel: "La decisión",
  decision: "Una decisión comercial defendible",
  record: {
    decision: "Priorizar", stamp: "nivel empresa + portafolio",
    rows: [
      { k: "Por qué ahora", v: "Un desarrollo reciente y fechado" },
      { k: "Evidencia fechada", v: "Fuentes públicas, cada una con fecha" },
      { k: "Incertidumbre", v: <><em>Qué queda por verificar</em></> },
      { k: "Validar", v: "Lo siguiente por confirmar" },
      { k: "Contexto de portafolio", v: "Patrones comparativos y alternativas relevantes", full: true },
    ],
  },
  secondary4: "El entregable no es una lista de leads. Es una vista respaldada por evidencia de dónde corresponden la oportunidad y la atención comercial.",
  steps: ["Tu contexto comercial", "Investigación + evaluación", "Inteligencia Comercial"],
};

const COPY: Record<LandingLocale, Copy> = { en: EN, es: ES, pt: EN, ja: EN };

export function HeroCarousel({ locale, primaryHref }: { locale: LandingLocale; primaryHref: string }) {
  const c = COPY[locale] ?? EN;
  const n = c.slides.length;
  const [i, setI] = useState(0);
  const touchX = useRef<number | null>(null);
  const go = useCallback((to: number) => setI(() => Math.max(0, Math.min(n - 1, to))), [n]);

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

  const s = c.slides[i];
  const pad = (x: number) => String(x).padStart(2, "0");

  return (
    <div className={styles.wrap}>
      <section className={styles.panel} aria-roledescription="carousel" aria-label={c.aria}
        tabIndex={0} onKeyDown={onKey}>
        <div className={styles.header}>
          <span className={styles.label}>{s.label}</span>
          <span className={styles.counter} aria-hidden="true"><b>{pad(i + 1)}</b> / {pad(n)}</span>
        </div>

        {/* All five slides are stacked in one grid cell, so the frame is always as tall as the
            tallest slide — identical footprint on every slide, no height jump. Only the active
            slide is visible (and reachable by AT / keyboard). */}
        <div className={styles.stage} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-live="polite">
          {c.slides.map((sl, idx) => (
            <article key={sl.label} className={styles.slide} data-kind={sl.kind} data-active={idx === i}
              role="group" aria-roledescription="slide" aria-hidden={idx !== i}
              aria-label={`${pad(idx + 1)} of ${pad(n)} — ${sl.label}`}>
              <h2 className={styles.headline}>{sl.headline}</h2>
              {sl.body && <p className={styles.body}>{sl.body}</p>}
              {sl.kind === "deliver" && <p className={styles.secondary}>{c.secondary4}</p>}
              {renderVisual(sl.kind, c, primaryHref)}
              <div className={styles.spacer} />
            </article>
          ))}
        </div>

        <div className={styles.controls}>
          <ol className={styles.seg}>
            {c.slides.map((sl, idx) => (
              <li key={sl.label} style={{ display: "flex", flex: "1 1 auto" }}>
                <button type="button" aria-label={`${sl.label} (${pad(idx + 1)} of ${pad(n)})`}
                  aria-current={idx === i ? "true" : undefined}
                  data-state={idx === i ? "active" : idx < i ? "done" : "todo"}
                  onClick={() => go(idx)} />
              </li>
            ))}
          </ol>
          <div className={styles.arrows}>
            <button type="button" className={styles.arrow} onClick={() => go(i - 1)} disabled={i === 0} aria-label={c.prev}>‹</button>
            <button type="button" className={styles.arrow} onClick={() => go(i + 1)} disabled={i === n - 1} aria-label={c.next}>›</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function renderVisual(kind: Kind, c: Copy, primaryHref: string): ReactNode {
  if (kind === "define") return (
    <div className={styles.define}>
      <div className={styles.frags}>{c.frags.map((f) => <span key={f} className={styles.frag}>{f}</span>)}</div>
      <span className={styles.resolve} aria-hidden="true">→</span>
      <div className={styles.object}>
        <span className={styles.objCheck} aria-hidden="true">✓</span>
        <span className={styles.objText}><span className={styles.objKicker}>Structured</span><b>{c.object}</b></span>
      </div>
    </div>
  );
  if (kind === "ladder") return (
    <dl className={styles.ladder}>
      {c.ladder.map((r) => (
        <div key={r.t} className={styles.rung}><dt>{r.t}</dt><dd>{r.d}</dd></div>
      ))}
      <div className={`${styles.rung} ${styles.rungMe}`}><dt>{c.ladderMe.t}</dt><dd>{c.ladderMe.d}</dd></div>
    </dl>
  );
  if (kind === "value") return (
    <div className={styles.value}>
      <div className={styles.manual}>{c.manual.map((m) => <span key={m}>{m}</span>)}</div>
      <div className={styles.compress} aria-hidden="true"><small>{c.compress}</small><span>→</span></div>
      <div className={styles.decision}><span>{c.decisionLabel}</span><b>{c.decision}</b></div>
    </div>
  );
  if (kind === "deliver") return (
    <div className={styles.record}>
      <div className={styles.recTop}>
        <span className={styles.pill}>{c.record.decision}</span>
        <small><b>{c.record.stamp}</b></small>
      </div>
      <div className={styles.recRows}>
        {c.record.rows.map((r) => (
          <div key={r.k} className={r.full ? styles.full : undefined}><span>{r.k}</span><p>{r.v}</p></div>
        ))}
      </div>
    </div>
  );
  // start
  return (
    <>
      <div className={styles.steps}>
        <div className={styles.stepCard}><b>01</b><span>{c.steps[0]}</span></div>
        <span className={styles.stepArrow} aria-hidden="true">→</span>
        <div className={styles.stepCard}><b>02</b><span>{c.steps[1]}</span></div>
        <span className={styles.stepArrow} aria-hidden="true">→</span>
        <div className={styles.stepCard}><b>03</b><span>{c.steps[2]}</span></div>
      </div>
      <div className={styles.ctaRow}>
        <Link className={styles.primary} href={primaryHref}>{c.primary}</Link>
        <Link className={styles.secondaryLink} href="/sample">{c.secondary} →</Link>
      </div>
    </>
  );
}
