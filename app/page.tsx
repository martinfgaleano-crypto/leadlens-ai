import type { Metadata } from "next";
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

// Per-locale document metadata. Locale is query-param based (?lang=xx), so the static root layout
// cannot localize <html lang>/<title>. generateMetadata (SSR) localizes the crawlable metadata for
// the "/" route; the runtime <html lang> is corrected by a tiny inline script (accessibility/SR).
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://leadlensintel.com").replace(/\/$/, "");
const META: Record<LandingLocale, { title: string; description: string; ogLocale: string }> = {
  en: { title: "LeadLens — Commercial Intelligence", description: "LeadLens researches and compares companies so teams can focus commercial effort where it matters most, with evidence and uncertainty behind every decision.", ogLocale: "en_US" },
  es: { title: "LeadLens — Inteligencia Comercial", description: "LeadLens investiga y compara empresas para que los equipos enfoquen el esfuerzo comercial donde más importa, con evidencia e incertidumbre detrás de cada decisión.", ogLocale: "es_ES" },
  pt: { title: "LeadLens — Inteligência Comercial", description: "A LeadLens pesquisa e compara empresas para que as equipes concentrem o esforço comercial onde mais importa, com evidência e incerteza por trás de cada decisão.", ogLocale: "pt_BR" },
  ja: { title: "LeadLens — コマーシャル・インテリジェンス", description: "LeadLensは企業を調査・比較し、各判断の根拠と不確実性を示しながら、営業リソースを最も重要な企業に集中できるようにします。", ogLocale: "ja_JP" },
};
const localePath = (l: LandingLocale) => (l === "en" ? "/" : `/?lang=${l}`);

export function generateMetadata({ searchParams }: { searchParams?: { lang?: string | string[] } }): Metadata {
  const locale = localeFrom(searchParams?.lang);
  const m = META[locale];
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: localePath(locale),
      languages: { en: "/", es: "/?lang=es", pt: "/?lang=pt", ja: "/?lang=ja", "x-default": "/" },
    },
    openGraph: { title: m.title, description: m.description, url: `${APP_URL}${localePath(locale)}`, siteName: "LeadLens", locale: m.ogLocale, type: "website", images: [{ url: `${APP_URL}/api/og`, width: 1200, height: 630, alt: m.title }] },
    twitter: { card: "summary_large_image", title: m.title, description: m.description, images: [`${APP_URL}/api/og`] },
  };
}

function decisionLabel(decision: string, c: ReturnType<typeof getLandingV2Copy>) {
  return c.decisions[decision as keyof typeof c.decisions] ?? decision;
}

export default function LandingV2({ searchParams }: { searchParams?: { lang?: string | string[] } }) {
  const locale = localeFrom(searchParams?.lang);
  const c = getLandingV2Copy(locale);
  const proof = locale === "es"
    ? { eyebrow: "Lo que recibes", title: "Cada empresa vuelve como una decisión sobre la que puedes actuar.", body: "No una lista por trabajar. Para cada una: la decisión, por qué ahora, la evidencia detrás, qué queda incierto y qué validar después.", inside: ["Decisión", "Por qué ahora", "Evidencia con fecha", "Qué queda incierto", "Qué validar después"] }
    : { eyebrow: "What you receive", title: "Every company comes back as a decision you can act on.", body: "Not a list to work through. For each one: the decision, why now, the evidence behind it, what stays uncertain, and what to validate next.", inside: ["Decision", "Why now", "Dated evidence", "What stays uncertain", "What to validate next"] };
  // Portfolio-level view (illustrative): the SHAPE of the whole researched set — distribution across
  // decisions, where attention concentrates, and the pattern the set reveals. No per-company cards
  // (that is FocusBoard's job) and no invented score — canonical decision states only.
  const portfolioView = locale === "es"
    ? { funnel: "12 evaluadas", attention: "2 de 12 justifican atención ahora; 3 más vale la pena validar.", pattern: "El fit es común en el conjunto — un cambio reciente y fechado es lo que separa a las pocas que merecen atención.", patternLabel: "Lo que revela el conjunto", allocationLabel: "A dónde va la atención", scope: "Observado dentro de este portafolio investigado — no todo el mercado." }
    : { funnel: "12 evaluated", attention: "2 of 12 justify attention now; 3 more are worth validating.", pattern: "Fit is common across the set — a recent, dated change is what separates the few that deserve attention.", patternLabel: "What the set reveals", allocationLabel: "Where attention goes", scope: "Observed within this researched portfolio — not the whole market." };
  const portfolioDist: { k: "prioritize" | "validate" | "monitor" | "hold"; n: number }[] = [{ k: "prioritize", n: 2 }, { k: "validate", n: 3 }, { k: "monitor", n: 5 }, { k: "hold", n: 2 }];
  // Salvaged from the production landing: a 5-second category distinction. No named competitors.
  const category3 = locale === "es"
    ? { eyebrow: "Dónde encaja LeadLens", rows: [{ k: "Bases de datos", v: "Quién existe." }, { k: "Herramientas de señales", v: "Qué pasó." }, { k: "LeadLens", v: "Por qué importa — y a dónde debe ir la atención.", me: true }] }
    : { eyebrow: "Where LeadLens fits", rows: [{ k: "Databases", v: "Who exists." }, { k: "Signal tools", v: "What happened." }, { k: "LeadLens", v: "Why it matters — and where attention belongs.", me: true }] };
  // Purchase-confidence band before pricing: inspect the real deliverable before paying.
  const sample = locale === "es"
    ? { eyebrow: "Míralo tú mismo", title: "Revisa un informe de decisión completo antes de comprar.", body: "No una captura — el razonamiento real detrás de una recomendación: la decisión, la evidencia con fecha, qué queda incierto y qué validar después.", chips: ["Evidencia con fecha", "Incertidumbre visible", "Próxima validación"], cta: "Ver una muestra" }
    : { eyebrow: "See it for yourself", title: "Inspect a full decision brief before you buy.", body: "Not a screenshot — the real reasoning behind a recommendation: the decision, the dated evidence, what stays uncertain, and what to validate next.", chips: ["Dated evidence", "Uncertainty shown", "Next validation"], cta: "View a sample" };
  const plans = oneTimeCards();
  // Decision-depth progression (visible even if price/count are hidden): one decision → shortlist → allocation → strategic context.
  const tierLabel: Record<string, string> = locale === "es"
    ? { preview_launch_v0: "Una decisión", brief_launch_v0: "Decisión de lista corta", intelligence_launch_v0: "Decisión de asignación", premium_launch_v0: "Contexto estratégico" }
    : { preview_launch_v0: "One decision", brief_launch_v0: "Shortlist decision", intelligence_launch_v0: "Allocation decision", premium_launch_v0: "Strategic context" };

  return (
    <div className={styles.page}>
      {locale !== "en" && <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(locale)}` }} />}
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
            <p className={styles.eyebrow}>{c.category}</p><h1>{c.hero.title} <span className={styles.heroAccent}>{c.hero.titleAccent}</span></h1><p className={styles.heroLead}>{c.hero.lead}</p>
            <div className={styles.ctas}><Link className={styles.primary} href={START_PATH}>{c.primary}</Link></div>
            <p className={styles.heroInput}>{c.hero.inputOutput}</p>
          </div>
          <AttentionField locale={locale} />
        </section>

        <CompanyInterpretationV2 locale={locale} copy={c.interpretation} />

        <section className={styles.trustStrip} aria-label={c.trust.label}>
          <div className={styles.trustItems}>
            {c.trust.items.map((item) => <p key={item.title}><strong>{item.title}</strong><span>{item.body}</span></p>)}
          </div>
          <p className={styles.trustBoundary}>{c.trust.boundary}</p>
        </section>

        <section className={styles.section} id="product" aria-label={proof.title}>
          <div className={styles.proofRow}>
            <div className={styles.proofText}><p className={styles.eyebrow}>{proof.eyebrow}</p><h2>{proof.title}</h2><p>{proof.body}</p><ul className={styles.proofInside}>{proof.inside.map((x) => <li key={x}>{x}</li>)}</ul></div>
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

        <section className={`${styles.section} ${styles.catBand}`} aria-label={category3.eyebrow}>
          <p className={styles.eyebrow} style={{ textAlign: "center", marginBottom: "2.5rem" }}>{category3.eyebrow}</p>
          <div className={styles.catRow}>
            {category3.rows.map((x) => <div key={x.k} className={"me" in x && x.me ? styles.catMe : styles.catCol}><span>{x.k}</span><p>{x.v}</p></div>)}
          </div>
        </section>

        <section className={styles.sampleBand} aria-label={sample.eyebrow}>
          <div className={styles.sampleInner}>
            <p className={styles.eyebrow}>{sample.eyebrow}</p>
            <h2>{sample.title}</h2>
            <p className={styles.sampleBody}>{sample.body}</p>
            <ul className={styles.sampleChips}>{sample.chips.map((x) => <li key={x}>{x}</li>)}</ul>
            <Link className={styles.primary} href="/sample">{sample.cta}</Link>
          </div>
        </section>

        <section className={`${styles.section} ${styles.soft}`} id="pricing">
          <SectionIntro eyebrow={c.pricing.eyebrow} title={c.pricing.title} body={c.pricing.body} />
          <div className={styles.planLadder}>{plans.map((plan, index) => {
            const pc = c.pricing.plans[plan.productCode];
            const highlighted = plan.productCode === "intelligence_launch_v0";
            return <article className={`${styles.planRow}${highlighted ? ` ${styles.planFeatured}` : ""}`} key={plan.productCode}>
              <div className={styles.planIdentity}><span>0{index + 1}</span><h3>{plan.name}</h3><em className={styles.planTier} data-code={plan.productCode}>{tierLabel[plan.productCode]}</em>{highlighted && <b className={styles.recommended}>{c.pricing.recommended}</b>}</div>
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
  // Attention-allocation grid: each evaluated company is one cell, coloured by its decision and ordered
  // from act-now to hold — a LeadLens-specific view of how attention concentrates across the set.
  const cells = dist.flatMap((d) => Array.from({ length: d.n }, () => d.k));
  return <div className={styles.portfolio} aria-label={c.portfolio.label}>
    <div className={styles.portfolioHead}><span>{c.portfolio.kicker}</span><small>{view.funnel}</small></div>
    <div className={styles.distTotal}><strong>{total}</strong><span>{c.portfolio.disclosure.replace(/^\d+\s*/, "")}</span></div>
    <div className={styles.allocGrid} role="img" aria-label={distText}>
      {cells.map((k, i) => <span key={i} className={styles.allocCell} data-d={k} style={{ background: DEC_COLOR[k] }} />)}
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
    <summary>
      <div className={styles.caseHead}>
        <span><strong>{a.name}</strong><small>{a.changed}</small></span><b>{decisionLabel(a.decision, c)}</b><em>{c.case.inspect}</em>
      </div>
      {/* P1-1: causality is visible in the collapsed default state — cause → decision change → reason to inspect. */}
      <ol className={styles.caseCausality} aria-label={`${c.case.beforeLabel} → ${c.case.changeLabel} → ${c.case.nowLabel}`}>
        <li><span>{c.case.beforeLabel}</span><p>{a.before}</p></li>
        <li className={styles.caseChange}><span>{c.case.changeLabel}</span><p>{a.changed} · {a.fresh}</p></li>
        <li><span>{c.case.nowLabel}</span><p>{a.now}</p><b className={styles.caseNowDecision}>{decisionLabel(a.decision, c)}</b></li>
      </ol>
    </summary>
    <div className={styles.caseBody}>
      <div><h3>{c.case.fact}</h3><p>{a.changed} · {a.fresh}</p><small>{c.case.factNote}</small></div>
      <div><h3>{c.case.analysis}</h3><p>{c.case.thesis}</p><small>{c.case.inference}</small></div>
      <div className={styles.caseRisk}><h3>{c.case.weakness}</h3><p>{c.case.weaknessText}</p><small>{c.case.uncertainty}</small></div>
      <div><h3>{c.case.next}</h3><p>{c.case.validationText}</p><small>{c.case.recommendation}</small></div>
    </div>
    <p className={styles.caseTrust}>{c.case.trustLine}</p>
    <div className={styles.caseFooter}><span>{c.synthetic}</span><Link href="/sample">{c.case.full}</Link></div>
  </details>;
}
