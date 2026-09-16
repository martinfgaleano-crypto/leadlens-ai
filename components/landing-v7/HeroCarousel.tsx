"use client";

// HeroCarousel — the hero's right-side visual: a warm, editorial "story card" that explains LeadLens
// across six manual, visitor-controlled cards. Copy is HQ-frozen (exact English; faithful Spanish).
// No autoplay. Side arrows (vertically centered) + segmented progress + counter + keyboard + swipe.
// All cards are stacked in one grid cell so the frame is always the tallest card's size (no jump).
// Reduced-motion honored. React state + CSS only; no carousel dependency.

import { useCallback, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./hero-carousel.module.css";

type Kind = "define" | "ladder" | "value" | "concept" | "deliver" | "start";
interface Slide { label: string; headline: ReactNode; body?: ReactNode; kind: Kind }
interface Level { lead: string; rest: string }
interface Copy {
  aria: string; prev: string; next: string; primary: string; secondary: string;
  slides: Slide[];
  frags: string[]; object: string;                                             // 01
  ladder: Array<{ t: string; d: string }>; ladderMe: { t: string; d: string }; // 02
  manual: string[]; compress: string; decisionLabel: string; decision: string; // 03
  concept: { companyLabel: string; portfolioLabel: string; company: Level; portfolio: Level; closing: string }; // 04
  record: { decision: string; stamp: string; rows: Array<{ k: string; v: ReactNode; full?: boolean }> }; secondary5: string; // 05
  steps: string[]; ctaSupport: string;                                         // 06
}

const EN: Copy = {
  aria: "What LeadLens is, in six steps", prev: "Previous card", next: "Next card",
  primary: "Find where to focus", secondary: "See a sample brief",
  slides: [
    { label: "What is LeadLens?", kind: "define",
      headline: "LeadLens is a Commercial Intelligence platform.",
      body: "It turns fragmented market, company, and change evidence into structured, evidence-backed commercial decisions. It researches markets and companies, identifies meaningful change, weighs timing and evidence, and makes uncertainty explicit." },
    { label: "Why LeadLens?", kind: "ladder",
      headline: <>Not a contact database, signal feed, or generic research. <em>A decision about where attention belongs.</em></> },
    { label: "Why is it worth it?", kind: "value",
      headline: <>LeadLens compresses scattered manual work into <em>one inspectable commercial judgment.</em></>,
      body: "Instead of researching and comparing many companies yourself, see where to focus, why now, what supports the case, what remains uncertain, and what to validate next." },
    { label: "What is Commercial Intelligence?", kind: "concept",
      headline: <>Commercial Intelligence is the decision layer <em>between raw market information and commercial action.</em></>,
      body: "For LeadLens, it structures fragmented company, market, and change evidence into evidence-backed judgments about where commercial attention belongs." },
    { label: "What do you get?", kind: "deliver",
      headline: "LeadLens delivers Commercial Intelligence at both company and portfolio level.",
      body: "Company decision briefs, portfolio allocation, visible evidence and uncertainty, and clear next validation steps." },
    { label: "How to start", kind: "start",
      headline: "Share your context. Inspect the intelligence. Decide where to focus.",
      body: "Tell LeadLens your market and commercial objective. It researches and evaluates the set, then returns Commercial Intelligence you can inspect." },
  ],
  frags: ["press", "filings", "hiring", "registry", "announcements", "expansion"],
  object: "Commercial Intelligence",
  ladder: [
    { t: "Databases", d: "show who exists." },
    { t: "Signal tools", d: "show what happened." },
    { t: "Generic research", d: "gives more information." },
  ],
  ladderMe: { t: "LeadLens", d: "shows where attention belongs — and why." },
  manual: ["Research", "Compare signals", "Judge relevance", "Check timing", "Decide"],
  compress: "compressed into",
  decisionLabel: "The result",
  decision: "A structured commercial judgment",
  concept: {
    companyLabel: "Company level", portfolioLabel: "Portfolio level",
    company: { lead: "Which accounts merit attention", rest: " — why now, the evidence, uncertainty, and next validation." },
    portfolio: { lead: "Where to focus across the set", rest: " — patterns and what to prioritize, validate, monitor, or hold." },
    closing: "Evidence-backed judgments, not a contact list or a signal feed.",
  },
  record: {
    decision: "Prioritize", stamp: "company + portfolio level",
    rows: [
      { k: "Why now", v: "A recent, dated development" },
      { k: "Dated evidence", v: "Public sources, each dated" },
      { k: "Uncertainty", v: <><em>What still needs checking</em></> },
      { k: "Validate next", v: "The next thing to confirm" },
      { k: "Portfolio", v: "How attention is allocated across the set", full: true },
    ],
  },
  secondary5: "Not a lead list. A commercial decision system.",
  steps: ["Share your market + objective", "Research + evaluation", "Inspect the intelligence"],
  ctaSupport: "See a sample brief before you start.",
};

const ES: Copy = {
  aria: "Qué es LeadLens, en seis pasos", prev: "Anterior", next: "Siguiente",
  primary: "Encuentra dónde enfocarte", secondary: "Ver un informe de muestra",
  slides: [
    { label: "¿Qué es LeadLens?", kind: "define",
      headline: "LeadLens es una plataforma de Inteligencia Comercial.",
      body: "Convierte evidencia fragmentada de mercados, empresas y cambios en decisiones comerciales estructuradas y respaldadas. Investiga mercados y empresas, identifica cambios relevantes, pondera fechas y evidencia, y hace explícita la incertidumbre." },
    { label: "¿Por qué LeadLens?", kind: "ladder",
      headline: <>No es una base de contactos, un feed de señales ni investigación genérica. <em>Ayuda a decidir dónde enfocar la atención.</em></> },
    { label: "¿Por qué vale la pena?", kind: "value",
      headline: <>LeadLens comprime el trabajo manual disperso en <em>un criterio comercial que puedes examinar.</em></>,
      body: "En vez de investigar y comparar muchas empresas por tu cuenta, ves dónde enfocarte, por qué ahora, qué respalda el caso, qué sigue incierto y qué validar después." },
    { label: "¿Qué es la Inteligencia Comercial?", kind: "concept",
      headline: <>La Inteligencia Comercial es la capa de decisión <em>entre la información de mercado en bruto y la acción comercial.</em></>,
      body: "Para LeadLens, estructura evidencia fragmentada de empresas, mercados y cambios en criterios respaldados sobre dónde corresponde la atención comercial." },
    { label: "¿Qué recibes?", kind: "deliver",
      headline: "LeadLens entrega Inteligencia Comercial a nivel de empresa y de portafolio.",
      body: "Informes por empresa, asignación de atención en el portafolio, decisiones respaldadas por evidencia con incertidumbre visible y próximos pasos de validación." },
    { label: "¿Cómo empiezas?", kind: "start",
      headline: "Comparte tu contexto. Examina la inteligencia. Decide dónde enfocarte.",
      body: "Indica tu mercado y objetivo comercial. LeadLens investiga y evalúa el conjunto; luego entrega Inteligencia Comercial que puedes examinar." },
  ],
  frags: ["prensa", "registros", "contrataciones", "anuncios", "expansión", "informes"],
  object: "Inteligencia Comercial",
  ladder: [
    { t: "Las bases de datos", d: "muestran quién existe." },
    { t: "Las herramientas de señales", d: "muestran qué pasó." },
    { t: "La investigación genérica", d: "ofrece más información." },
  ],
  ladderMe: { t: "LeadLens", d: "muestra dónde enfocar la atención — y por qué." },
  manual: ["Investigar", "Comparar señales", "Juzgar relevancia", "Verificar timing", "Decidir"],
  compress: "se comprime en",
  decisionLabel: "El resultado",
  decision: "Un criterio comercial estructurado",
  concept: {
    companyLabel: "Nivel empresa", portfolioLabel: "Nivel portafolio",
    company: { lead: "Qué cuentas merecen atención", rest: " — por qué ahora, evidencia, incertidumbre y próxima validación." },
    portfolio: { lead: "Dónde enfocarse en el conjunto", rest: " — patrones y qué priorizar, validar, monitorear o reservar." },
    closing: "Criterios respaldados por evidencia, no una lista de contactos ni un feed de señales.",
  },
  record: {
    decision: "Priorizar", stamp: "nivel empresa + portafolio",
    rows: [
      { k: "Por qué ahora", v: "Un desarrollo reciente y fechado" },
      { k: "Evidencia fechada", v: "Fuentes públicas, cada una con fecha" },
      { k: "Incertidumbre", v: <><em>Qué queda por verificar</em></> },
      { k: "Validar", v: "Lo siguiente por confirmar" },
      { k: "Portafolio", v: "Cómo se asigna la atención en el conjunto", full: true },
    ],
  },
  secondary5: "No es una lista de leads. Es un sistema de decisión comercial.",
  steps: ["Mercado + objetivo", "Investigación + evaluación", "Examinar la inteligencia"],
  ctaSupport: "Puedes ver un informe de muestra antes de empezar.",
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
  const choose = (to: number, e: React.MouseEvent<HTMLButtonElement>) => {
    go(to);
    if (e.detail > 0) e.currentTarget.blur(); // Pointer activation must not leave a keyboard focus ring.
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.panel} aria-roledescription="carousel" aria-label={c.aria}
        tabIndex={0} onKeyDown={onKey}>
        <div className={styles.header}>
          <span className={styles.label}>{s.label}</span>
          <span className={styles.counter} aria-hidden="true"><b>{pad(i + 1)}</b> / {pad(n)}</span>
        </div>

        {/* All cards are stacked in one grid cell, so the frame is always as tall as the tallest
            card — identical footprint on every card, no height jump. Only the active card is
            visible (and reachable by AT / keyboard). */}
        <div className={styles.stage} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-live="polite">
          {c.slides.map((sl, idx) => (
            <article key={sl.label} className={styles.slide} data-kind={sl.kind} data-active={idx === i}
              role="group" aria-roledescription="slide" aria-hidden={idx !== i}
              aria-label={`${pad(idx + 1)} of ${pad(n)} — ${sl.label}`}>
              <h2 className={styles.headline}>{sl.headline}</h2>
              {sl.body && <p className={styles.body}>{sl.body}</p>}
              {sl.kind === "deliver" && <p className={styles.secondary}>{c.secondary5}</p>}
              {renderVisual(sl.kind, c, primaryHref)}
              <div className={styles.spacer} />
            </article>
          ))}
        </div>

        {/* Side arrows (vertically centered on the card) are the primary affordance; the segmented
            bar shows position. On mobile the arrows reflow into the bottom row beside the bar. */}
        <div className={styles.controls}>
          <button type="button" className={styles.navPrev} onClick={(e) => choose(i - 1, e)} disabled={i === 0} aria-label={c.prev}>‹</button>
          <ol className={styles.seg}>
            {c.slides.map((sl, idx) => (
              <li key={sl.label}>
                <button type="button" aria-label={`${sl.label} (${pad(idx + 1)} of ${pad(n)})`}
                  aria-current={idx === i ? "true" : undefined}
                  data-state={idx === i ? "active" : idx < i ? "done" : "todo"}
                  onClick={(e) => choose(idx, e)} />
              </li>
            ))}
          </ol>
          <button type="button" className={styles.navNext} onClick={(e) => choose(i + 1, e)} disabled={i === n - 1} aria-label={c.next}>›</button>
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
  if (kind === "concept") return (
    <div className={styles.concept}>
      <div className={styles.levels}>
        <div className={styles.level}>
          <span className={styles.levelTag}>{c.concept.companyLabel}</span>
          <p><b>{c.concept.company.lead}</b>{c.concept.company.rest}</p>
        </div>
        <div className={`${styles.level} ${styles.levelAlt}`}>
          <span className={styles.levelTag}>{c.concept.portfolioLabel}</span>
          <p><b>{c.concept.portfolio.lead}</b>{c.concept.portfolio.rest}</p>
        </div>
      </div>
      <p className={styles.conceptClose}>{c.concept.closing}</p>
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
      <p className={styles.ctaSupport}>{c.ctaSupport}</p>
    </>
  );
}
