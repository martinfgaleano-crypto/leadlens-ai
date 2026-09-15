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
      headline: "LeadLens is a Commercial Intelligence platform that turns fragmented market and company evidence into structured, evidence-backed commercial decisions.",
      body: "It researches markets and companies, identifies meaningful change, weighs evidence and timing, makes uncertainty explicit, and helps businesses understand where commercial opportunity and attention belong." },
    { label: "Why LeadLens?", kind: "ladder",
      headline: <>Most alternatives stop too early. <em>LeadLens goes further.</em></> },
    { label: "Why is it worth it?", kind: "value",
      headline: <>You are paying for better commercial judgment — <em>not just more data.</em></>,
      body: "Without LeadLens, teams have to research companies manually, compare signals, judge relevance, check timing, and still decide under uncertainty. LeadLens compresses that work into a structured commercial judgment, so commercial effort can be allocated faster, more clearly, and with stronger reasoning behind it." },
    { label: "What is Commercial Intelligence?", kind: "concept",
      headline: <>Commercial Intelligence is the decision layer <em>between raw market information and commercial action.</em></>,
      body: "For LeadLens, Commercial Intelligence means turning fragmented company, market, and change evidence into structured, evidence-backed judgments about where commercial attention belongs." },
    { label: "What do you get?", kind: "deliver",
      headline: "LeadLens delivers Commercial Intelligence at both company and portfolio level.",
      body: "At the company level, you get a clear commercial judgment on whether an account deserves attention now, the why-now, the public evidence behind it, what is uncertain, and what to validate next. At the portfolio level, you get a structured view across the researched set: where attention is justified now, which accounts should be prioritized, validated, monitored, or held, and what cross-account patterns matter. This is not a lead list. It is a Commercial Intelligence deliverable." },
    { label: "How do you start?", kind: "start",
      headline: "Start with your commercial context. LeadLens does the rest of the intelligence work.",
      body: "You begin by showing LeadLens what you sell, to whom, and what you are trying to achieve. LeadLens then researches the relevant market and companies, evaluates where attention belongs, and returns Commercial Intelligence at company and portfolio level. From there, you can inspect the reasoning, review the evidence, and decide where to focus first." },
  ],
  frags: ["press", "filings", "hiring", "registry", "announcements", "expansion"],
  object: "Commercial Intelligence",
  ladder: [
    { t: "Databases", d: "show who exists." },
    { t: "Signal tools", d: "show that something happened." },
    { t: "Generic research", d: "gathers information." },
  ],
  ladderMe: { t: "LeadLens", d: "turns fragmented evidence into a commercial decision about where attention belongs now — with the reasoning attached, uncertainty visible, and the next validation step clear." },
  manual: ["Research", "Compare signals", "Judge relevance", "Check timing", "Decide"],
  compress: "compressed into",
  decisionLabel: "The result",
  decision: "A structured commercial judgment",
  concept: {
    companyLabel: "Company level", portfolioLabel: "Portfolio level",
    company: { lead: "At the company level,", rest: " it shows which specific accounts deserve attention, why now, what supports the case, what remains uncertain, and what to validate next." },
    portfolio: { lead: "At the portfolio level,", rest: " it shows how attention should be allocated across a researched set, what patterns matter, and where to prioritize, validate, monitor, or hold." },
    closing: "It is not a contact list, a generic research report, or a simple signal feed. It is decision-oriented intelligence for commercial focus.",
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
  secondary5: "For the higher tiers, the output is not limited to isolated company decisions. It also includes portfolio-level Commercial Intelligence.",
  steps: ["Your commercial context", "Research + evaluation", "Commercial Intelligence"],
  ctaSupport: "If you want to see the output first, you can start by reviewing a sample brief.",
};

const ES: Copy = {
  aria: "Qué es LeadLens, en seis pasos", prev: "Anterior", next: "Siguiente",
  primary: "Encuentra dónde enfocarte", secondary: "Ver un informe de muestra",
  slides: [
    { label: "¿Qué es LeadLens?", kind: "define",
      headline: "LeadLens es una plataforma de Inteligencia Comercial que convierte evidencia fragmentada de mercados y empresas en decisiones comerciales estructuradas y respaldadas por evidencia.",
      body: "Investiga mercados y empresas, identifica cambios relevantes, pondera evidencia y timing, hace explícita la incertidumbre y ayuda a los negocios a entender dónde corresponden la oportunidad y la atención comercial." },
    { label: "¿Por qué LeadLens?", kind: "ladder",
      headline: <>La mayoría de las alternativas se quedan cortas. <em>LeadLens va más allá.</em></> },
    { label: "¿Por qué vale la pena?", kind: "value",
      headline: <>Pagas por mejor criterio comercial — <em>no solo por más datos.</em></>,
      body: "Sin LeadLens, los equipos tienen que investigar empresas manualmente, comparar señales, juzgar relevancia, verificar el timing y aun así decidir bajo incertidumbre. LeadLens comprime ese trabajo en un criterio comercial estructurado, para asignar el esfuerzo comercial más rápido, con más claridad y con mejor razonamiento detrás." },
    { label: "¿Qué es la Inteligencia Comercial?", kind: "concept",
      headline: <>La Inteligencia Comercial es la capa de decisión <em>entre la información de mercado en bruto y la acción comercial.</em></>,
      body: "Para LeadLens, la Inteligencia Comercial consiste en convertir evidencia fragmentada de empresas, mercados y cambios en juicios estructurados y respaldados por evidencia sobre dónde corresponde la atención comercial." },
    { label: "¿Qué recibes?", kind: "deliver",
      headline: "LeadLens entrega Inteligencia Comercial a nivel de empresa y de portafolio.",
      body: "A nivel de empresa, recibes un criterio comercial claro sobre si una cuenta merece atención ahora, el porqué ahora, la evidencia pública detrás, qué es incierto y qué validar después. A nivel de portafolio, recibes una vista estructurada del conjunto investigado: dónde se justifica la atención ahora, qué cuentas priorizar, validar, monitorear o mantener, y qué patrones entre cuentas importan. Esto no es una lista de leads. Es un entregable de Inteligencia Comercial." },
    { label: "¿Cómo empiezas?", kind: "start",
      headline: "Empieza con tu contexto comercial. LeadLens hace el resto del trabajo de inteligencia.",
      body: "Empiezas mostrándole a LeadLens qué vendes, a quién y qué intentas lograr. Luego LeadLens investiga el mercado y las empresas relevantes, evalúa dónde corresponde la atención y devuelve Inteligencia Comercial a nivel de empresa y de portafolio. Desde ahí, puedes inspeccionar el razonamiento, revisar la evidencia y decidir dónde enfocarte primero." },
  ],
  frags: ["prensa", "registros", "contrataciones", "anuncios", "expansión", "informes"],
  object: "Inteligencia Comercial",
  ladder: [
    { t: "Las bases de datos", d: "muestran quién existe." },
    { t: "Las señales", d: "muestran que algo pasó." },
    { t: "La investigación genérica", d: "reúne información." },
  ],
  ladderMe: { t: "LeadLens", d: "convierte la evidencia fragmentada en una decisión comercial sobre dónde corresponde la atención ahora — con el razonamiento incluido, la incertidumbre visible y el siguiente paso de validación claro." },
  manual: ["Investigar", "Comparar señales", "Juzgar relevancia", "Verificar timing", "Decidir"],
  compress: "se comprime en",
  decisionLabel: "El resultado",
  decision: "Un criterio comercial estructurado",
  concept: {
    companyLabel: "Nivel empresa", portfolioLabel: "Nivel portafolio",
    company: { lead: "A nivel de empresa,", rest: " muestra qué cuentas específicas merecen atención, por qué ahora, qué respalda el caso, qué queda incierto y qué validar después." },
    portfolio: { lead: "A nivel de portafolio,", rest: " muestra cómo debería asignarse la atención en un conjunto investigado, qué patrones importan y dónde priorizar, validar, monitorear o mantener." },
    closing: "No es una lista de contactos, un informe de investigación genérico ni un simple feed de señales. Es inteligencia orientada a la decisión para el enfoque comercial.",
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
  secondary5: "En los niveles superiores, el resultado no se limita a decisiones aisladas por empresa. También incluye Inteligencia Comercial a nivel de portafolio.",
  steps: ["Tu contexto comercial", "Investigación + evaluación", "Inteligencia Comercial"],
  ctaSupport: "Si prefieres ver primero el resultado, puedes empezar revisando un informe de muestra.",
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
          <button type="button" className={styles.navPrev} onClick={() => go(i - 1)} disabled={i === 0} aria-label={c.prev}>‹</button>
          <ol className={styles.seg}>
            {c.slides.map((sl, idx) => (
              <li key={sl.label}>
                <button type="button" aria-label={`${sl.label} (${pad(idx + 1)} of ${pad(n)})`}
                  aria-current={idx === i ? "true" : undefined}
                  data-state={idx === i ? "active" : idx < i ? "done" : "todo"}
                  onClick={() => go(idx)} />
              </li>
            ))}
          </ol>
          <button type="button" className={styles.navNext} onClick={() => go(i + 1)} disabled={i === n - 1} aria-label={c.next}>›</button>
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
