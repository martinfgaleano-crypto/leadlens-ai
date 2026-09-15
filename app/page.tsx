import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/landing-v2/LanguageSwitcher";
import { HeroCarousel } from "@/components/landing-v7/HeroCarousel";
import { Shortlist } from "@/components/landing-v7/Shortlist";
import { oneTimeCards } from "@/lib/commercial/plan-catalog";
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

// "The Brief" landing — one coherent, output-led page:
// HERO (a decision brief) → TRUST/CATEGORY → SHORTLIST → HOW IT THINKS → PRICING → FAQ → FINAL CTA.
export default function LandingV2({ searchParams }: { searchParams?: { lang?: string | string[] } }) {
  const locale = localeFrom(searchParams?.lang);
  const c = getLandingV2Copy(locale);
  const es = locale === "es";
  // How LeadLens thinks — three reasoning principles + one before → now example (folds the old Deep Case).
  const thinks = es
    ? { eyebrow: "Cómo razona LeadLens", title: "Un criterio que puedes inspeccionar — no un puntaje.",
        principles: [
          { k: "Qué cambió", v: "Un desarrollo reciente y fechado que hace que una empresa merezca atención ahora — no un dato estático." },
          { k: "Evidencia + timing", v: "Las fuentes públicas detrás de la decisión, cada una con fecha, para que verifiques el razonamiento." },
          { k: "Qué falta verificar", v: "La incertidumbre queda a la vista, con lo siguiente por validar antes de invertir esfuerzo." },
        ],
        exLabel: "Una decisión, en tres pasos",
        steps: [
          { k: "Antes", v: "Una empresa mediana, sin una razón clara para actuar." },
          { k: "Qué cambió", v: "Abrió una nueva sede regional — hace 9 días, según un anuncio público fechado." },
          { k: "Ahora", v: "Priorizar — con la pregunta abierta (¿quién decide la compra?) como próxima verificación." },
        ] }
    : { eyebrow: "How LeadLens thinks", title: "Judgment you can inspect — not a score.",
        principles: [
          { k: "What changed", v: "A recent, dated development that makes a company worth attention now — not a static fact." },
          { k: "Evidence + timing", v: "The public sources behind the call, each dated, so you can check the reasoning yourself." },
          { k: "What still needs checking", v: "The uncertainty stays in view, with the next thing to validate before you commit effort." },
        ],
        exLabel: "One call, in three moves",
        steps: [
          { k: "Before", v: "A mid-market company, no clear reason to engage." },
          { k: "What changed", v: "Opened a new regional facility — 9 days ago, from a dated public announcement." },
          { k: "Now", v: "Prioritize — with the open question (who owns procurement?) named as the next check." },
        ] };
  const plans = oneTimeCards();
  const tierLabel: Record<string, string> = es
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
            <a href="#how">{c.nav.how}</a><Link href="/sample">{c.nav.sample}</Link><a href="#pricing">{c.nav.pricing}</a>
          </div>
          <div className={styles.navActions}>
            <Link className={styles.signIn} href="/login">{c.nav.signIn}</Link>
            <LanguageSwitcher locale={locale} label={c.language} />
            <Link className={styles.primarySmall} href={START_PATH}>{c.primary}</Link>
          </div>
        </nav>
      </header>

      <main id="main">
        {/* 1. HERO — the output the buyer receives */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{c.category}</p><h1>{c.hero.title} <span className={styles.heroAccent}>{c.hero.titleAccent}</span></h1><p className={styles.heroLead}><span className={styles.heroLeadFull}>{c.hero.lead}</span><span className={styles.heroLeadShort}>{c.hero.lead.split(/\.\s/)[0]}.</span></p>
            <div className={styles.ctas}><Link className={styles.primary} href={START_PATH}>{c.primary}</Link><Link className={styles.secondary} href="/sample">{c.secondary}</Link></div>
            <p className={styles.heroInput}>{c.hero.inputOutput}</p>
          </div>
          <HeroCarousel locale={locale} primaryHref={START_PATH} />
        </section>

        {/* 2. Honesty boundary — one line, product-truth */}
        <section className={styles.boundary}><p>{c.trust.boundary}</p></section>

        {/* 3. SHORTLIST — the one product proof */}
        <Shortlist locale={locale} />

        {/* 4. HOW LEADLENS THINKS — reasoning principles + one before → now example */}
        <section className={`${styles.section} ${styles.thinks}`} id="how" aria-label={thinks.title}>
          <SectionIntro eyebrow={thinks.eyebrow} title={thinks.title} />
          <div className={styles.thinksGrid}>
            {thinks.principles.map((p) => <div key={p.k} className={styles.principle}><span>{p.k}</span><p>{p.v}</p></div>)}
          </div>
          <div className={styles.causality} aria-label={thinks.exLabel}>
            <span className={styles.exLabel}>{thinks.exLabel}</span>
            <ol>{thinks.steps.map((s, i) => <li key={s.k} className={i === 1 ? styles.stepChange : undefined}><span>{s.k}</span><p>{s.v}</p></li>)}</ol>
          </div>
          <p className={styles.synthetic}>{c.synthetic}</p>
        </section>

        {/* 5. PRICING — buyer-language ladder */}
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
          <div className={styles.compareLink}><Link href="/pricing?commercial_path=one_time">{c.pricing.compare}</Link><Link href="/pricing?commercial_path=ongoing">{c.ongoing.action}</Link></div>
        </section>

        {/* 6. FAQ — a few high-intent objections */}
        <section className={`${styles.section} ${styles.faq}`}>
          <SectionIntro eyebrow={c.faq.eyebrow} title={c.faq.title} />
          <div>{c.faq.items.slice(0, 5).map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</div>
        </section>

        {/* 7. FINAL CTA */}
        <section className={styles.finalCta}><h2>{c.final.title}</h2><p>{c.final.body}</p><div className={styles.ctas}><Link className={styles.primary} href={START_PATH}>{c.primary}</Link><Link className={styles.secondary} href="/sample">{c.secondary}</Link></div></section>
      </main>

      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} LeadLens</span>
        <nav aria-label={c.navigation}><a href="#how">{c.nav.how}</a><Link href="/sample">{c.nav.sample}</Link><a href="#pricing">{c.nav.pricing}</a><Link href="/login">{c.nav.signIn}</Link></nav>
        <div><Link href="/privacy">{c.footer.privacy}</Link><Link href="/terms">{c.footer.terms}</Link><Link href="/refund">{c.footer.refund}</Link></div>
      </footer>
    </div>
  );
}

function SectionIntro({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return <div className={styles.sectionIntro}><p className={styles.eyebrow}>{eyebrow}</p><h2>{title}</h2>{body && <p>{body}</p>}</div>;
}
