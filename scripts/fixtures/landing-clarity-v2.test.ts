import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { oneTimeCards } from "../../lib/commercial/plan-catalog";
import { getLandingV2Copy } from "../../lib/landing/v2-copy";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const copy = readFileSync(`${root}/lib/landing/v2-copy.ts`, "utf8");
const styles = readFileSync(`${root}/app/landing-v2.module.css`, "utf8");
const pricing = readFileSync(`${root}/app/pricing/page.tsx`, "utf8");
const shortlist = readFileSync(`${root}/components/landing-v7/Shortlist.tsx`, "utf8");
const carousel = readFileSync(`${root}/components/landing-v7/HeroCarousel.tsx`, "utf8");
const carouselStyles = readFileSync(`${root}/components/landing-v7/hero-carousel.module.css`, "utf8");
const briefStyles = readFileSync(`${root}/components/landing-v7/the-brief.module.css`, "utf8");

function check(name: string, fn: () => void) {
  fn();
  console.log(`PASS ${name}`);
}

check("one-time catalog remains the only landing plan source", () => {
  assert.match(page, /oneTimeCards\(\)/);
  assert.doesNotMatch(page, /\$7|\$25|\$59|\$129/);
});

check("public one-time matrix is Preview 2, Brief 6, Portfolio 12, Premium 18", () => {
  assert.deepEqual(
    oneTimeCards().map(({ name, price, capacity }) => ({ name, price, capacity })),
    [
      { name: "Preview", price: 7, capacity: "2 companies evaluated" },
      { name: "Brief", price: 25, capacity: "6 companies evaluated" },
      { name: "Portfolio", price: 59, capacity: "12 companies evaluated" },
      { name: "Premium", price: 129, capacity: "18 companies evaluated" },
    ],
  );
});

check("landing remains server-rendered with bounded client islands", () => {
  assert.doesNotMatch(page.slice(0, 80), /["']use client["']/);
  assert.match(page, /LanguageSwitcher/);
  assert.match(page, /HeroCarousel/);
  assert.match(page, /Shortlist/);
});

check("hero is a two-column composition: preserved left copy + a six-slide Commercial Intelligence carousel", () => {
  // HQ Carousel V3: restore the left hero (promise + lead + CTA); the right graphic is a manual carousel.
  assert.match(page, /<HeroCarousel locale=\{locale\} primaryHref=\{START_PATH\} \/>/);
  assert.match(page, /styles\.heroLead/);       // the left hero support copy is restored (visible)
  assert.match(page, /styles\.heroLeadFull/);
  assert.equal(getLandingV2Copy("en").hero.title, "Find the companies worth pursuing now"); // leading verb
  assert.match(page, /<Shortlist locale=\{locale\} \/>/);
  // Page order: hero(carousel) → boundary → shortlist → how it thinks → pricing.
  assert.ok(page.indexOf("<HeroCarousel") < page.indexOf("styles.boundary"));
  assert.ok(page.indexOf("styles.boundary") < page.indexOf("<Shortlist"));
  assert.ok(page.indexOf("<Shortlist") < page.indexOf('id="how"'));
  assert.ok(page.indexOf('id="how"') < page.indexOf('id="pricing"'));
  // The carousel is a bounded client island: manual (no autoplay), semantic, keyboard + swipe + reduced motion.
  assert.match(carousel.slice(0, 40), /["']use client["']/);
  assert.match(carousel, /aria-roledescription="carousel"/);
  assert.match(carousel, /aria-roledescription="slide"/);
  assert.match(carousel, /onKeyDown/);
  assert.match(carousel, /onTouchStart/);
  assert.doesNotMatch(carousel, /setInterval\(/); // no auto-rotation timer
  assert.match(carouselStyles, /prefers-reduced-motion:reduce/);
  // Six cards retain their source-of-truth concepts while their supporting copy stays compact.
  assert.match(carousel, /in six steps/);
  for (const concept of [
    /LeadLens is a Commercial Intelligence platform\./,
    /fragmented market, company, and change evidence/,
    /Not a contact database, signal feed, or generic research/,
    /one inspectable commercial judgment/,
    /Commercial Intelligence is the decision layer/,
    /companyLabel: "Company level"[\s\S]*portfolioLabel: "Portfolio level"/,
    /LeadLens delivers Commercial Intelligence at both company and portfolio level\./,
    /Share your context\. Inspect the intelligence/,
  ]) assert.match(carousel, concept);
  // The "What is Commercial Intelligence?" card is inserted BEFORE the deliverable card.
  assert.ok(carousel.indexOf("What is Commercial Intelligence?") < carousel.indexOf("LeadLens delivers Commercial Intelligence at both company"));
  // Full decision grammar preserved — broader than a shortlist.
  assert.match(carousel, /prioritize, validate, monitor, or hold/);
  // Side arrows are the primary navigation affordance (vertically centered on the card).
  assert.match(carousel, /styles\.navPrev/);
  assert.match(carousel, /styles\.navNext/);
  // The rejected hero graphic is not recycled inside the carousel.
  assert.doesNotMatch(carousel, /Multi-site healthcare|Regional logistics|Specialty manufacturer|Northwind|Cascade|Atlas|Meridian|Northstar/);
  // Shortlist keeps the four-state decision grammar as commercial judgment.
  for (const token of [/Prioritize/, /Validate/, /Monitor/]) assert.match(shortlist, token);
  // Shortlist rows are responsive with reduced-motion support (shared the-brief stylesheet).
  assert.match(briefStyles, /@media\(max-width:760px\)/);
  assert.match(briefStyles, /prefers-reduced-motion:reduce/);
});

check("the interactive pipeline hero and all legacy product sections are removed (no visual remnants)", () => {
  for (const gone of [/AttentionField/, /<FocusBoard/, /<ExecutivePortfolio/, /<CompanyCase/, /CompanyInterpretationV2/,
    /allocGrid/, /portfolioGrid/, /priorityCompany/, /companyCase/, /styles\.ongoing[^A-Za-z]/, /styles\.sampleBand/, /styles\.method/, /styles\.audience/]) {
    assert.doesNotMatch(page, gone);
  }
});

check("the page is one coherent, shorter architecture: hero, trust, shortlist, how-it-thinks, pricing, final CTA", () => {
  assert.match(page, /styles\.boundary/);  // honesty boundary strip
  assert.match(page, /styles\.thinks/);          // how LeadLens thinks
  assert.match(page, /id="pricing"/);
  assert.match(page, /styles\.finalCta/);
  // "How it thinks" is a static reasoning section — no process diagram / pipeline remnants.
  assert.doesNotMatch(page, /Market → |node|dotField|pipeline/i);
});

check("typography is one modern-commercial system: Manrope display + IBM Plex Mono metadata", () => {
  assert.match(styles, /--fd:var\(--font-display\)/);
  assert.match(styles, /--mono:var\(--font-mono\)/);
  // eyebrows use the mono metadata voice, not the display face.
  assert.match(styles, /\.eyebrow\{[^}]*font-family:var\(--mono\)/);
  // Editorial serif retired in favour of a modern grotesk display.
  assert.doesNotMatch(styles, /Fraunces/);
});

check("V6 public category broadens while preserving account opportunity methodology", () => {
  assert.equal(getLandingV2Copy("en").category, "Commercial Intelligence");
  assert.match(copy, /Account Opportunity Intelligence/);
});

check("hero uses one primary CTA and 'see a sample brief' as the secondary", () => {
  const hero = page.slice(page.indexOf("<section className={styles.hero}"), page.indexOf("styles.boundary"));
  assert.equal((hero.match(/href=\{START_PATH\}/g) ?? []).length, 1);
  assert.equal((hero.match(/href="\/sample"/g) ?? []).length, 1);
  assert.equal(getLandingV2Copy("en").secondary, "See a sample brief");
});

check("final CTA system leads with attention allocation", () => {
  assert.equal(getLandingV2Copy("en").primary, "Find where to focus");
  assert.equal(getLandingV2Copy("es").primary, "Encuentra dónde enfocarte");
});

check("final pricing presents a decision-first editorial ladder", () => {
  assert.match(page, /styles\.planLadder/);
  assert.match(styles, /\.planRow\{[^}]*grid-template-columns:/);
  assert.match(styles, /\.planDecision h4\{/);
});

check("V4 ladder explains each product with no more than three concrete outcomes", () => {
  assert.deepEqual(Object.values(getLandingV2Copy("en").pricing.plans).map((plan) => plan.points.length), [3, 3, 3, 3]);
  assert.match(copy, /Get a real decision on where to focus first/);
  assert.match(copy, /Resolve a shortlist into a clear next move/);
  assert.match(copy, /See where your commercial effort belongs across the set/);
  assert.match(copy, /Understand the context that could change your decision/);
  assert.match(copy, /Decision-ready briefs/);
});

check("sample data is disclosed and never presented as live research", () => {
  assert.match(page, /c\.synthetic/);
  assert.match(copy, /Illustrative sample|Muestra ilustrativa/);
  assert.doesNotMatch(page, /DEMO_MODE|\/api\/demo/);
});

check("pricing keeps both purchase paths and the one-time default", () => {
  assert.match(page, /\/pricing\?commercial_path=one_time/);
  assert.match(page, /\/pricing\?commercial_path=ongoing/);
  assert.match(pricing, /path === "ongoing" \? <>{ongoing}{project}<\/> : <>{project}{ongoing}<\/>/);
});

check("landing removes stale evidence tiers and keeps Premium differentiation claim-safe", () => {
  const publicLanding = `${page}\n${copy}`;
  assert.doesNotMatch(publicLanding, /Standard Evidence|Full Evidence|Reinforced Evidence/i);
  assert.doesNotMatch(publicLanding, /Decision Pathways|commercial benchmark|competitor context/i);
  assert.match(publicLanding, /Decision-ready briefs/i);
});

check("all four locale variants disclose synthetic evidence in their own language", () => {
  assert.match(copy, /Muestra ilustrativa/);
  assert.match(copy, /Amostra ilustrativa/);
  assert.match(copy, /説明用サンプル/);
});

check("all high-intent landing actions route to real customer surfaces", () => {
  assert.match(page, /\/get-started\?commercial_path=one_time/);
  assert.match(page, /href="\/sample"/);
  assert.match(page, /\/signup\?commercial_path=one_time&product_code=/);
});

check("footer closes with how, sample, pricing and sign-in navigation", () => {
  assert.match(page, /<footer className=\{styles\.footer\}>/);
  assert.match(page, /<nav aria-label=\{c\.navigation\}>/);
  assert.match(page, /href="#how"/);
  assert.match(page, /href="#pricing"/);
  assert.match(page, /href="\/login"/);
});

console.log("Landing 'The Brief' product experience contract passed");
