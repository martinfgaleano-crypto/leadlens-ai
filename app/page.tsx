import Link from "next/link";
import { CompanyInterpretationV2 } from "@/components/landing-v2/CompanyInterpretationV2";
import { LanguageSwitcher } from "@/components/landing-v2/LanguageSwitcher";
import { CommercialIntelligenceExplorer } from "@/components/landing-v6/CommercialIntelligenceExplorer";
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
          <CommercialIntelligenceExplorer locale={locale} />
        </section>

        <section className={styles.trustStrip} aria-label={c.trust.label}>
          {c.trust.items.map((item) => <p key={item.title}><strong>{item.title}</strong><span>{item.body}</span></p>)}
        </section>

        <section className={styles.portfolioChapter} id="product">
          <SectionIntro eyebrow={c.portfolio.kicker} title={c.portfolio.title} body={c.outcomes.body} />
          <ExecutivePortfolio copy={c} />
        </section>

        <section className={styles.section} id="case">
          <SectionIntro eyebrow={c.case.eyebrow} title={c.case.title} body={c.case.body} /><CompanyCase copy={c} />
        </section>

        <section className={`${styles.section} ${styles.howSection}`} id="how">
          <SectionIntro eyebrow={c.flow.eyebrow} title={c.flow.title} body={c.flow.body} />
          <ol className={styles.flow}>{c.flow.items.map((item, i) => <li key={item.title}><span>{i + 1}</span><div><h3>{item.title}</h3><p>{item.body}</p></div></li>)}</ol>
        </section>

        <CompanyInterpretationV2 locale={locale} copy={c.interpretation} />

        <section className={`${styles.section} ${styles.audience}`}>
          <div><p className={styles.eyebrow}>{c.audience.eyebrow}</p><h2>{c.audience.title}</h2></div>
          <ul>{c.audience.items.map((item) => <li key={item}>{item}</li>)}</ul>
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

function ExecutivePortfolio({ copy: c }: { copy: ReturnType<typeof getLandingV2Copy> }) {
  const [priority, ...secondary] = LANDING_COMPARISON.accounts;
  return <div className={styles.portfolio} aria-label={c.portfolio.label}>
    <div className={styles.portfolioHead}><span>{c.portfolio.kicker}</span><small>{c.portfolio.disclosure}</small></div>
    <article className={styles.priorityCompany}>
      <div className={styles.priorityMeta}><strong>{priority.name}</strong><b>{decisionLabel(priority.decision, c)}</b></div>
      <h2>{priority.changed}</h2>
      <div className={styles.priorityProof}><span>{priority.fresh} · {c.portfolio.evidence}: {priority.evidence}</span><span>{c.portfolio.confirm}: {priority.unknown}</span></div>
    </article>
    <div className={styles.secondaryCompanies}>
      {secondary.map((account) => <div className={styles.companyRow} key={account.name}>
        <strong>{account.name}</strong><span>{account.changed}</span><b data-decision={account.decision}>{decisionLabel(account.decision, c)}</b>
      </div>)}
    </div>
    <p className={styles.synthetic}>{c.synthetic}</p>
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
