import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { oneTimeCards } from "../../lib/commercial/plan-catalog";
import { getLandingV2Copy } from "../../lib/landing/v2-copy";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const copy = readFileSync(`${root}/lib/landing/v2-copy.ts`, "utf8");
const styles = readFileSync(`${root}/app/landing-v2.module.css`, "utf8");
const pricing = readFileSync(`${root}/app/pricing/page.tsx`, "utf8");
const attention = readFileSync(`${root}/components/landing-v7/FocusBoard.tsx`, "utf8");
const attentionStyles = readFileSync(`${root}/components/landing-v7/focus-board.module.css`, "utf8");
const heroExplainer = readFileSync(`${root}/components/landing-v7/AttentionField.tsx`, "utf8");

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
  assert.match(page, /CompanyInterpretationV2/);
  assert.match(page, /LanguageSwitcher/);
  assert.match(page, /AttentionField/);
  assert.match(page, /FocusBoard/);
});

check("V7 hero explains the mechanism; the focus board is the product proof below it", () => {
  assert.match(heroExplainer.slice(0, 80), /["']use client["']/);
  assert.match(attention.slice(0, 80), /["']use client["']/);
  // Hero = AttentionField (explanation), then FocusBoard (proof), then ExecutivePortfolio (summary).
  assert.match(page, /<AttentionField locale=\{locale\} \/>/);
  assert.match(page, /<FocusBoard locale=\{locale\} \/>/);
  assert.ok(page.indexOf("<AttentionField") < page.indexOf("<FocusBoard"));
  assert.ok(page.indexOf("<FocusBoard") < page.indexOf("<ExecutivePortfolio"));
  // The hero explainer teaches the system WITHOUT sample company names.
  assert.doesNotMatch(heroExplainer, /Northwind|Cascade|Atlas|Meridian/);
  assert.match(heroExplainer, /aria-live="polite"/);
  // The focus board keeps the six-lens decision system (role=tab, not six pills).
  assert.equal((attention.match(/aria-selected=/g) ?? []).length, 1);
  assert.match(attention, /role="tab"/);
});

check("one executive portfolio and one deeper company case remain the page-wide product proofs", () => {
  assert.equal((page.match(/<ExecutivePortfolio/g) ?? []).length, 1);
  assert.equal((page.match(/<CompanyCase/g) ?? []).length, 1);
  assert.doesNotMatch(page + copy, /Opportunity Canvas|Decision Desk|Hero carousel/i);
});

check("V6 benefit explorer teaches the decision system without a fictional company", () => {
  assert.match(attention, /Prioritize/);
  assert.match(attention, /Why now/);
  assert.match(attention, /Evidence/);
  assert.match(attention, /Validate/);
  assert.match(attention, /Monitor/);
  assert.match(attentionStyles, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(attention, /Northstar|live research/i);
});

check("hero product object stays legible and responsive on mobile", () => {
  assert.match(styles, /\.planLadder/);
  assert.match(attentionStyles, /\.board/);
  assert.match(attentionStyles, /@media\(max-width:760px\)/);
  assert.match(attention, /role="tab"/);
});

check("V6 public category broadens while preserving account opportunity methodology", () => {
  assert.equal(getLandingV2Copy("en").category, "Commercial Intelligence");
  assert.match(copy, /Account Opportunity Intelligence/);
});

check("hero uses one primary CTA and the explorer as secondary engagement", () => {
  const hero = page.slice(page.indexOf("<section className={styles.hero}"), page.indexOf("<section className={styles.trustStrip}"));
  assert.equal((hero.match(/href=\{START_PATH\}/g) ?? []).length, 1);
  assert.doesNotMatch(hero, /href="\/sample"/);
});

check("the first product half progresses from portfolio to case to process", () => {
  assert.ok(page.indexOf("<ExecutivePortfolio") < page.indexOf("<CompanyCase"));
  assert.ok(page.indexOf("<CompanyCase") < page.indexOf('id="how"'));
});

check("final CTA system leads with attention allocation", () => {
  assert.equal(getLandingV2Copy("en").primary, "Find where to focus");
  assert.equal(getLandingV2Copy("es").primary, "Encuentra dónde enfocarte");
});

check("executive portfolio is portfolio-LEVEL (distribution + allocation), not account cards", () => {
  // FocusBoard shows per-company decisions; the Executive Portfolio must raise to the shape of the
  // whole set — a decision distribution + allocation + pattern — and NOT repeat account rows/cards.
  assert.match(page, /distBar/);
  assert.match(page, /distLegend/);
  assert.match(page, /portfolioGrid/);
  assert.doesNotMatch(page, /priorityCompany|secondaryCompanies|companyRow/);
});

check("V3 company reasoning is progressive disclosure", () => {
  assert.match(page, /<details className=\{styles\.companyCase\}>/);
  assert.doesNotMatch(page, /<details className=\{styles\.companyCase\} open>/);
  assert.match(copy, /inspect: "Inspect case"/);
});

check("final pricing presents a decision-first editorial ladder", () => {
  assert.match(page, /styles\.planLadder/);
  assert.match(styles, /\.planRow\{[^}]*grid-template-columns:/);
  assert.match(styles, /\.planDecision h4\{/);
  assert.match(styles, /\.planFeatured\{[^}]*background:var\(--ink\)/);
});

check("V4 ladder explains each product with no more than three concrete outcomes", () => {
  assert.deepEqual(Object.values(getLandingV2Copy("en").pricing.plans).map((plan) => plan.points.length), [3, 3, 3, 3]);
  assert.match(copy, /Decide which company deserves attention first/);
  assert.match(copy, /Turn a shortlist into a clear next focus/);
  assert.match(copy, /Allocate attention across a commercial portfolio/);
  assert.match(copy, /See the commercial context that could change the decision/);
  assert.match(copy, /decision-critical briefs and open questions/);
});

check("sample data is disclosed and never presented as live research", () => {
  assert.match(page, /c\.synthetic/);
  assert.match(copy, /Illustrative sample|Muestra ilustrativa/);
  assert.doesNotMatch(page, /DEMO_MODE|\/api\/demo/);
});

check("one-time appears before ongoing by default on both public purchase surfaces", () => {
  assert.ok(page.indexOf('id="pricing"') < page.indexOf("styles.ongoing"));
  assert.match(pricing, /path === "ongoing" \? <>{ongoing}{project}<\/> : <>{project}{ongoing}<\/>/);
});

check("landing removes stale evidence tiers and keeps Premium differentiation claim-safe", () => {
  const publicLanding = `${page}\n${copy}`;
  assert.doesNotMatch(publicLanding, /Standard Evidence|Full Evidence|Reinforced Evidence/i);
  // "What Changed" as a stale premium *feature/tier* name stays banned; but the Deep Case now uses
  // "What changed" as a Before → What changed → Now causality label (founder-mandated), which is
  // truthful and on-brand — so guard the stale feature framings, not the generic causality word.
  assert.doesNotMatch(publicLanding, /Decision Pathways|commercial benchmark|competitor context/i);
  assert.match(publicLanding, /decision-critical briefs and open questions/i);
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
  assert.match(page, /\/pricing\?commercial_path=ongoing/);
});

check("footer closes with product, sample, pricing and sign-in navigation", () => {
  assert.match(page, /<footer className=\{styles\.footer\}>/);
  assert.match(page, /<nav aria-label=\{c\.navigation\}>/);
  assert.match(page, /href="#product"/);
  assert.match(page, /href="#pricing"/);
  assert.match(page, /href="\/login"/);
});

console.log("Landing V6 product experience contract passed");
