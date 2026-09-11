import Link from "next/link";
import { CompanyInterpretationV2 } from "@/components/landing-v2/CompanyInterpretationV2";
import { LanguageSwitcher } from "@/components/landing-v2/LanguageSwitcher";
import { FocusBoard } from "@/components/landing-v7/FocusBoard";
import { AttentionField } from "@/components/landing-v7/AttentionField";
import { oneTimeCards } from "@/lib/commercial/plan-catalog";
import { LANDING_COMPARISON } from "@/lib/landing/fixtures/landing-comparison";
import { getLandingV2Copy, type LandingLocale } from "@/lib/landing/v2-copy";
import styles from "./landing-v2.module.css";

const VALID_LOCALES = new Set<LandingLocale>(["en", "es", "pt", "ja"]);
const START_PATH = "/get-started?commercial_path=one_time";

function localeFrom(raw: string | string[] | undefined): LandingLocale {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && VALID_LOCALES.has(value as LandingLocale) ? value as LandingLocale : "en";
}

function decisionLabel(decision: string, c: ReturnType<typeof getLandingV2Copy>) {
  return c.decisions[decision as keyof typeof c.decisions] ?? decision;
}

export default function LandingV2({ searchParams }: { searchParams?: { lang?: string | string[] } }) {
  const locale = localeFrom(searchParams?.lang);
  const c = getLandingV2Copy(locale);
  const proof = locale === "es"
    ? { eyebrow: "El resultado", title: "De la investigación a una decisión", body: "Para cada empresa evaluada: una decisión clara, por qué ahora, la evidencia que la sostiene y qué queda por validar." }
    : { eyebrow: "The result", title: "From research to a decision", body: "For each company evaluated: a clear Decision, why now, the evidence behind it, and what still needs validating." };
  // Portfolio-level view (illustrative): the SHAPE of the whole researched set — distribution across
  // decisions, where attention concentrates, and the pattern the set reveals. No per-company cards
  // (that is FocusBoard's job) and no invented score — canonical decision states only.
  const portfolioView = locale === "es"
    ? { funnel: "40 consideradas → 12 evaluadas", attention: "2 de 12 justifican atención ahora; 3 más vale la pena validar.", pattern: "El fit es común en el conjunto — un cambio reciente y fechado es lo que separa a las pocas que merecen atención.", patternLabel: "Lo que revela el conjunto", allocationLabel: "A dónde va la atención", scope: "Observado dentro de este portafolio investigado — no todo el mercado." }
    : { funnel: "40 considered → 12 evaluated", attention: "2 of 12 justify attention now; 3 more are worth validating.", pattern: "Fit is common across the set — a recent, dated change is what separates the few that deserve attention.", patternLabel: "What the set reveals", allocationLabel: "Where attention goes", scope: "Observed within this researched portfolio — not the whole market." };
  const portfolioDist: { k: "prioritize" | "validate" | "monitor" | "hold"; n: number }[] = [{ k: "prioritize", n: 2 }, { k: "validate", n: 3 }, { k: "monitor", n: 5 }, { k: "hold", n: 2 }];
  // Salvaged from the production landing: a 5-second category distinction. No named competitors.
  const category3 = locale === "es"
    ? { eyebrow: "Dónde encaja LeadLens", rows: [{ k: "Bases de datos", v: "Quién existe." }, { k: "Herramientas de señales", v: "Qué pasó." }, { k: "LeadLens", v: "Por qué importa — y a dónde debe ir la atención.", me: true }] }
    : { eyebrow: "Where LeadLens fits", rows: [{ k: "Databases", v: "Who exists." }, { k: "Signal tools", v: "What happened." }, { k: "LeadLens", v: "Why it matters — and where attention belongs.", me: true }] };
  const plans = oneTimeCards();

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main">{c.skip}</a>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label={c.navigation}>
          <Link className={styles.logo} href={locale === "en" ? "/" : `/?lang=${locale}`}>Lead<span>Lens</span></Link>
          <div className={styles.navLinks}>
            <a href="#product">{c.nav.product}</a><Link href="/sample">{c.nav.sample}</Link><a href="#pricing">{c.nav.pricing}</a><a href="#how">{c.nav.how}</a>
          </div>
          <div className={styles.navActions}>
            <Link className={styles.signIn} href="/login">{c.nav.signIn}</Link>
            <LanguageSwitcher locale={locale} label={c.language} />
            <Link className={styles.primarySmall} href={START_PATH}>{c.primary}</Link>
          </div>
        </nav>
      </header>

      <main id="main">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{c.category}</p><h1>{c.hero.title}</h1><p className={styles.heroLead}>{c.hero.lead}</p>
            <div className={styles.ctas}><Link className={styles.primary} href={START_PATH}>{c.primary}</Link></div>
            <p className={styles.heroInput}>{c.hero.inputOutput}</p>
          </div>
          <AttentionField locale={locale} />
        </section>

        <CompanyInterpretationV2 locale={locale} copy={c.interpretation} />

        <section className={styles.trustStrip} aria-label={c.trust.label}>
          {c.trust.items.map((item) => <p key={item.title}><strong>{item.title}</strong><span>{item.body}</span></p>)}
        </section>

        <section className={styles.section} id="product" aria-label={proof.title}>
          <div className={styles.proofRow}>
            <div className={styles.proofText}><p className={styles.eyebrow}>{proof.eyebrow}</p><h2>{proof.title}</h2><p>{proof.body}</p></div>
            <div className={styles.proofBoard}><FocusBoard locale={locale} /></div>
          </div>
        </section>

        <section className={styles.portfolioChapter} id="portfolio">
          <SectionIntro eyebrow={c.portfolio.kicker} title={c.portfolio.title} body={c.outcomes.body} />
          <ExecutivePortfolio copy={c} view={portfolioView} dist={portfolioDist} />
        </section>

        <section className={styles.section} id="case">
          <SectionIntro eyebrow={c.case.eyebrow} title={c.case.title} body={c.case.body} /><CompanyCase copy={c} />
        </section>

        <section className={`${styles.section} ${styles.howSection}`} id="how">
          <SectionIntro eyebrow={c.flow.eyebrow} title={c.flow.title} body={c.flow.body} />
          <ol className={styles.flow}>{c.flow.items.map((item, i) => <li key={item.title}><span>{i + 1}</span><div><h3>{item.title}</h3><p>{item.body}</p></div></li>)}</ol>
        </section>

        <section className={`${styles.section} ${styles.audience}`}>
          <div><p className={styles.eyebrow}>{c.audience.eyebrow}</p><h2>{c.audience.title}</h2></div>
          <ul>{c.audience.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>

        <section className={styles.section} aria-label={category3.eyebrow}>
          <p className={styles.eyebrow} style={{ textAlign: "center", marginBottom: "2.5rem" }}>{category3.eyebrow}</p>
          <div className={styles.catRow}>
            {category3.rows.map((x) => <div key={x.k} className={"me" in x && x.me ? styles.catMe : styles.catCol}><span>{x.k}</span><p>{x.v}</p></div>)}
          </div>
        </section>

        <section className={`${styles.section} ${styles.soft}`} id="pricing">
          <SectionIntro eyebrow={c.pricing.eyebrow} title={c.pricing.title} body={c.pricing.body} />
          <div className={styles.planLadder}>{plans.map((plan, index) => {
            const pc = c.pricing.plans[plan.productCode];
            const highlighted = plan.productCode === "intelligence_launch_v0";
            return <article className={`${styles.planRow}${highlighted ? ` ${styles.planFeatured}` : ""}`} key={plan.productCode}>
              <div className={styles.planIdentity}><span>0{index + 1}</span><h3>{plan.name}</h3>{highlighted && <b className={styles.recommended}>{c.pricing.recommended}</b>}</div>
              <div className={styles.planDecision}><h4>{pc.job}</h4><p>{pc.points[0]}</p></div>
              <ul>{pc.points.slice(1).map((point) => <li key={point}>{point}</li>)}</ul>
              <div className={styles.planAction}><strong>${plan.price}</strong><small>{plan.capacity}</small><Link href={`/signup?commercial_path=one_time&product_code=${plan.productCode}`}>{c.pricing.choose} {plan.name}</Link></div>
            </article>;
          })}</div>
          <div className={styles.compareLink}><Link href="/pricing?commercial_path=one_time">{c.pricing.compare}</Link></div>
        </section>

        <section className={styles.ongoing}><div><p className={styles.eyebrow}>{c.ongoing.eyebrow}</p><h2>{c.ongoing.title}</h2><p>{c.ongoing.body}</p></div><Link href="/pricing?commercial_path=ongoing">{c.ongoing.action}</Link></section>

        <section className={`${styles.section} ${styles.method}`}><div><p className={styles.eyebrow}>{c.method.eyebrow}</p><h2>{c.method.title}</h2><p>{c.method.body}</p></div><ul>{c.method.items.map((item) => <li key={item}>{item}</li>)}</ul></section>

        <section className={`${styles.section} ${styles.faq}`}><SectionIntro eyebrow={c.faq.eyebrow} title={c.faq.title} /><div>{c.faq.items.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div></section>

        <section className={styles.finalCta}><h2>{c.final.title}</h2><p>{c.final.body}</p><div className={styles.ctas}><Link className={styles.primary} href={START_PATH}>{c.primary}</Link><Link className={styles.secondary} href="/sample">{c.secondary}</Link></div></section>
      </main>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} LeadLens</span>
        <nav aria-label={c.navigation}><a href="#product">{c.nav.product}</a><Link href="/sample">{c.nav.sample}</Link><a href="#pricing">{c.nav.pricing}</a><Link href="/login">{c.nav.signIn}</Link></nav>
        <div><Link href="/privacy">{c.footer.privacy}</Link><Link href="/terms">{c.footer.terms}</Link><Link href="/refund">{c.footer.refund}</Link></div>
      </footer>
    </div>
  );
}

function SectionIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return <div className={styles.sectionIntro}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2>{body && <p>{body}</p>}</div>;
}

const DEC_COLOR: Record<string, string> = { prioritize: "#7dd3fc", validate: "#f0c477", monitor: "#9fb0c2", hold: "#5c6a7a" };

// Portfolio-LEVEL proof: the shape of the whole researched set (distribution + allocation + pattern),
// NOT another list of account cards (that is FocusBoard). Illustrative distribution; canonical decision
// states only; no invented score.
function ExecutivePortfolio({ copy: c, view, dist }: {
  copy: ReturnType<typeof getLandingV2Copy>;
  view: { funnel: string; attention: string; pattern: string; patternLabel: string; allocationLabel: string; scope: string };
  dist: { k: "prioritize" | "validate" | "monitor" | "hold"; n: number }[];
}) {
  const total = dist.reduce((s, d) => s + d.n, 0);
  const distText = dist.map((d) => `${d.n} ${decisionLabel(d.k, c).toLowerCase()}`).join(" · ");
  return <div className={styles.portfolio} aria-label={c.portfolio.label}>
    <div className={styles.portfolioHead}><span>{c.portfolio.kicker}</span><small>{view.funnel}</small></div>
    <div className={styles.distTotal}><strong>{total}</strong><span>{c.portfolio.disclosure.replace(/\d+/, String(total))}</span></div>
    <div className={styles.distBar} role="img" aria-label={distText}>
      {dist.filter((d) => d.n > 0).map((d) => <span key={d.k} style={{ flex: d.n, background: DEC_COLOR[d.k] }} />)}
    </div>
    <ul className={styles.distLegend}>
      {dist.map((d) => <li key={d.k}><i style={{ background: DEC_COLOR[d.k] }} /><strong>{d.n}</strong> {decisionLabel(d.k, c).toLowerCase()}</li>)}
    </ul>
    <div className={styles.portfolioGrid}>
      <div><span>{view.allocationLabel}</span><p>{view.attention}</p></div>
      <div><span>{view.patternLabel}</span><p>{view.pattern}</p></div>
    </div>
    <p className={styles.synthetic}>{view.scope} · {c.synthetic}</p>
  </div>;
}

function CompanyCase({ copy: c }: { copy: ReturnType<typeof getLandingV2Copy> }) {
  const a = LANDING_COMPARISON.accounts[0];
  return <details className={styles.companyCase}>
    <summary><span><strong>{a.name}</strong><small>{a.changed}</small></span><b>{decisionLabel(a.decision, c)}</b><em>{c.case.inspect}</em></summary>
    <div className={styles.caseBody}>
      <div><h3>{c.case.fact}</h3><p>{a.changed} · {a.fresh}</p><small>{c.case.factNote}</small></div>
      <div><h3>{c.case.analysis}</h3><p>{c.case.thesis}</p><small>{c.case.inference}</small></div>
      <div className={styles.caseRisk}><h3>{c.case.weakness}</h3><p>{c.case.weaknessText}</p><small>{c.case.uncertainty}</small></div>
      <div><h3>{c.case.next}</h3><p>{c.case.validationText}</p><small>{c.case.recommendation}</small></div>
    </div>
    <div className={styles.caseFooter}><span>{c.synthetic}</span><Link href="/sample">{c.case.full}</Link></div>
  </details>;
}
