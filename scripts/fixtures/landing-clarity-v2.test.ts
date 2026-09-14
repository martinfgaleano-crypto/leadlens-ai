import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { oneTimeCards } from "../../lib/commercial/plan-catalog";
import { getLandingV2Copy } from "../../lib/landing/v2-copy";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const copy = readFileSync(`${root}/lib/landing/v2-copy.ts`, "utf8");
const styles = readFileSync(`${root}/app/landing-v2.module.css`, "utf8");
const pricing = readFileSync(`${root}/app/pricing/page.tsx`, "utf8");
const brief = readFileSync(`${root}/components/landing-v7/DecisionBrief.tsx`, "utf8");
const shortlist = readFileSync(`${root}/components/landing-v7/Shortlist.tsx`, "utf8");
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
  assert.match(page, /DecisionBrief/);
  assert.match(page, /Shortlist/);
});

check("hero leads with the OUTPUT (a decision brief), then the shortlist proves it scales", () => {
  // "The Brief" direction: the hero IS the output the buyer receives, not a mechanism explainer.
  assert.match(page, /<DecisionBrief locale=\{locale\} \/>/);
  assert.match(page, /<Shortlist locale=\{locale\} \/>/);
  // Page order: hero(brief) → trust/category → shortlist → how it thinks → pricing.
  assert.ok(page.indexOf("<DecisionBrief") < page.indexOf("styles.catBand"));
  assert.ok(page.indexOf("styles.catBand") < page.indexOf("<Shortlist"));
  assert.ok(page.indexOf("<Shortlist") < page.indexOf('id="how"'));
  assert.ok(page.indexOf('id="how"') < page.indexOf('id="pricing"'));
  // The brief carries the decision grammar + evidence + uncertainty + next validation.
  for (const token of [/Prioritize/, /Why now/, /Evidence/, /Uncertain/, /Validate/]) assert.match(brief, token);
  // Output artifact is static + accessible, and uses archetypes (no fictional company brand names).
  assert.doesNotMatch(brief.slice(0, 40), /["']use client["']/);
  assert.match(brief, /role="figure"/);
  assert.doesNotMatch(brief + shortlist, /Northwind|Cascade|Atlas|Meridian|Northstar/);
  // Shortlist keeps the four-state decision grammar as commercial judgment.
  for (const token of [/Prioritize/, /Validate/, /Monitor/]) assert.match(shortlist, token);
  // The brief is responsive (a real mobile composition) with reduced-motion support.
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
  assert.match(page, /styles\.catBand/);        // trust / category strip
  assert.match(page, /styles\.thinks/);          // how LeadLens thinks
  assert.match(page, /id="pricing"/);
  assert.match(page, /styles\.finalCta/);
  // "How it thinks" is a static reasoning section — no process diagram / pipeline remnants.
  assert.doesNotMatch(page, /Market → |node|dotField|pipeline/i);
});

check("typography is one system: Fraunces display + IBM Plex Mono metadata", () => {
  assert.match(styles, /--fd:var\(--font-serif\)/);
  assert.match(styles, /--mono:var\(--font-mono\)/);
  // eyebrows use the mono metadata voice (analyst-grade), not the display face.
  assert.match(styles, /\.eyebrow\{[^}]*font-family:var\(--mono\)/);
});

check("V6 public category broadens while preserving account opportunity methodology", () => {
  assert.equal(getLandingV2Copy("en").category, "Commercial Intelligence");
  assert.match(copy, /Account Opportunity Intelligence/);
});

check("hero uses one primary CTA and 'see a sample brief' as the secondary", () => {
  const hero = page.slice(page.indexOf("<section className={styles.hero}"), page.indexOf("styles.catBand"));
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
