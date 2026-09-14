// The hero output artifact — a single LeadLens decision brief. This is what the buyer receives:
// a commercial judgment (Prioritize) with a dated why-now, the evidence behind it, the uncertainty
// kept in view, and the next thing to validate. Static, server-rendered, no interaction.
// Synthetic / illustrative — archetypes, no real company names, no scores.

import type { LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./the-brief.module.css";

interface BriefCopy {
  aria: string; kicker: string; stamp: string; decision: string; archetype: string;
  whyNowLab: string; whyNow: string; whyNowDate: string;
  eviLab: string; evidence: Array<{ t: string; src: string }>;
  uncertainLab: string; uncertain: string;
  validateLab: string; validate: string;
}

const EN: BriefCopy = {
  aria: "Example LeadLens decision brief",
  kicker: "Decision brief", stamp: "reviewed today · public sources",
  decision: "Prioritize", archetype: "Multi-site healthcare group · Southeast US",
  whyNowLab: "Why now", whyNow: "Opened a new regional facility", whyNowDate: "· 9 days ago",
  eviLab: "Evidence", evidence: [
    { t: "Company announcement of the opening", src: "Mar 3" },
    { t: "Regional business press coverage", src: "Mar 5" },
    { t: "New address in the trade registry", src: "Feb 27" },
  ],
  uncertainLab: "Uncertain", uncertain: "Procurement may be decided at group level, not at the new site.",
  validateLab: "Validate", validate: "Confirm who owns the buying decision for the new facility.",
};

const ES: BriefCopy = {
  aria: "Informe de decisión de LeadLens (ejemplo)",
  kicker: "Informe de decisión", stamp: "revisado hoy · fuentes públicas",
  decision: "Priorizar", archetype: "Grupo de salud multisede · Sudeste de EE. UU.",
  whyNowLab: "Por qué ahora", whyNow: "Abrió una nueva sede regional", whyNowDate: "· hace 9 días",
  eviLab: "Evidencia", evidence: [
    { t: "Anuncio de la apertura por la empresa", src: "3 mar" },
    { t: "Cobertura de prensa regional de negocios", src: "5 mar" },
    { t: "Nueva dirección en el registro comercial", src: "27 feb" },
  ],
  uncertainLab: "Incierto", uncertain: "Las compras podrían decidirse a nivel de grupo, no en la nueva sede.",
  validateLab: "Validar", validate: "Confirma quién decide la compra para la nueva sede.",
};

const COPY: Record<LandingLocale, BriefCopy> = { en: EN, es: ES, pt: EN, ja: EN };

export function DecisionBrief({ locale }: { locale: LandingLocale }) {
  const c = COPY[locale] ?? EN;
  return (
    <div className={styles.scope}>
      <figure className={styles.brief} role="figure" aria-label={c.aria}>
        <div className={styles.briefTop}>
          <span className={styles.briefKicker}>{c.kicker}</span>
          <span className={styles.stamp}>{c.stamp}</span>
        </div>
        <div className={styles.head}>
          <span className={styles.chip}><span className={styles.tick} aria-hidden="true" />{c.decision}</span>
          <span className={styles.arche}>{c.archetype}</span>
        </div>
        <div className={styles.rule} />
        <div className={styles.row}>
          <span className={styles.lab}>{c.whyNowLab}</span>
          <span className={styles.whynow}>{c.whyNow} <span className={styles.date}>{c.whyNowDate}</span></span>
        </div>
        <div className={styles.row}>
          <span className={styles.lab}>{c.eviLab}</span>
          <ul className={styles.evi}>
            {c.evidence.map((e) => (
              <li key={e.t}><span>{e.t}</span><span className={styles.src}>{e.src}</span></li>
            ))}
          </ul>
        </div>
        <div className={styles.row}>
          <span className={styles.lab}>{c.uncertainLab}</span>
          <span className={styles.uncert}>{c.uncertain}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.lab}>{c.validateLab}</span>
          <span className={styles.validate}><span className={styles.arw}>→ </span>{c.validate}</span>
        </div>
      </figure>
    </div>
  );
}
