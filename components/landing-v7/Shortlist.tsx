// The shortlist — the product-proof directly under the hero. It shows that one inspectable call
// scales into a small commercial shortlist: one to prioritize, one to validate, one to monitor,
// each with a decision, a concise reason, and one dated evidence cue. Editorial rows, not a
// dashboard. Static, server-rendered. Synthetic / illustrative — archetypes, no scores.

import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./the-brief.module.css";

type Row = { verdict: string; cls: "p" | "v" | "m"; co: string; why: string; src: string };
interface Copy { aria: string; title: string; sub: string; note: string; rows: Row[] }

const EN: Copy = {
  aria: "How one decision scales into a commercial shortlist",
  title: "From one call to your shortlist",
  sub: "The same reasoning, applied across the market you gave us.",
  note: "Illustrative example — archetypes with synthetic dates and evidence.",
  rows: [
    { verdict: "Prioritize", cls: "p", co: "Multi-site healthcare group", why: "New regional facility opened — a clear near-term buying trigger.", src: "Company announcement · Mar 3" },
    { verdict: "Validate", cls: "v", co: "Regional logistics operator", why: "Won a large distribution contract — is the budget owner identified yet?", src: "Regional press · Mar 4" },
    { verdict: "Monitor", cls: "m", co: "Specialty manufacturer", why: "New production certification — watching for a facility or sourcing move.", src: "Trade registry · Feb 26" },
  ],
};

const ES: Copy = {
  aria: "Cómo una decisión se convierte en una lista corta comercial",
  title: "De una decisión a tu lista corta",
  sub: "El mismo razonamiento, aplicado al mercado que nos diste.",
  note: "Ejemplo ilustrativo — arquetipos con fechas y evidencia sintéticas.",
  rows: [
    { verdict: "Priorizar", cls: "p", co: "Grupo de salud multisede", why: "Abrió una nueva sede regional — un disparador de compra a corto plazo.", src: "Anuncio de la empresa · 3 mar" },
    { verdict: "Validar", cls: "v", co: "Operador de logística regional", why: "Ganó un gran contrato de distribución — ¿se identificó quién decide el presupuesto?", src: "Prensa regional · 4 mar" },
    { verdict: "Monitorear", cls: "m", co: "Fabricante especializado", why: "Nueva certificación de producción — atento a una decisión de sede o abastecimiento.", src: "Registro comercial · 26 feb" },
  ],
};

const COPY: Record<LandingLocale, Copy> = { en: EN, es: ES, pt: EN, ja: EN };

export function Shortlist({ locale }: { locale: LandingLocale }) {
  const c = COPY[locale] ?? EN;
  return (
    <section className={`${styles.scope} ${styles.shortlist}`} aria-label={c.aria}>
      <div className={styles.slInner}>
        <div className={styles.slHead}>
          <h2>{c.title}</h2>
          <p>{c.sub}</p>
        </div>
        <div className={styles.sl}>
          {c.rows.map((r) => (
            <div key={r.co} className={styles.slRow}>
              <span className={`${styles.verdict} ${styles[r.cls]}`}>{r.verdict}</span>
              <div><div className={styles.slCo}>{r.co}</div><div className={styles.slWhy}>{r.why}</div></div>
              <span className={styles.slSrc}>{r.src}</span>
            </div>
          ))}
        </div>
        <p className={styles.slNote}>{c.note}</p>
      </div>
    </section>
  );
}
