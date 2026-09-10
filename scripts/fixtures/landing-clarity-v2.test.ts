import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { oneTimeCards } from "../../lib/commercial/plan-catalog";
import { getLandingV2Copy } from "../../lib/landing/v2-copy";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const copy = readFileSync(`${root}/lib/landing/v2-copy.ts`, "utf8");
const styles = readFileSync(`${root}/app/landing-v2.module.css`, "utf8");
const pricing = readFileSync(`${root}/app/pricing/page.tsx`, "utf8");
const attention = readFileSync(`${root}/components/landing-v5/HeroAttentionField.tsx`, "utf8");
const attentionStyles = readFileSync(`${root}/components/landing-v5/hero-attention-field.module.css`, "utf8");

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
  assert.match(page, /HeroAttentionField/);
});

check("V5 introduces one bounded attention field before the product proof", () => {
  assert.match(attention.slice(0, 80), /["']use client["']/);
  assert.match(page, /<HeroAttentionField locale=\{locale\} \/>/);
  assert.ok(page.indexOf("<HeroAttentionField") < page.indexOf("<ExecutivePortfolio"));
  assert.match(attention, /aria-pressed=\{selected === index\}/);
  assert.match(attention, /aria-live="polite"/);
});

check("one executive portfolio and one deeper company case remain the page-wide product proofs", () => {
  assert.equal((page.match(/<ExecutivePortfolio/g) ?? []).length, 1);
  assert.equal((page.match(/<CompanyCase/g) ?? []).length, 1);
  assert.doesNotMatch(page + copy, /Opportunity Canvas|Decision Desk|Hero carousel/i);
});

check("V5 attention field exposes evidence, uncertainty and a synthetic-data disclosure", () => {
  assert.match(attention, /Evidence trace/);
  assert.match(attention, /Still unresolved/);
  assert.match(attention, /Illustrative sample/);
  assert.match(attentionStyles, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(attention, /score|live research/i);
});

check("V3 portfolio leads with one decision instead of a dashboard table", () => {
  assert.match(page, /priorityCompany/);
  assert.match(page, /secondaryCompanies/);
  assert.doesNotMatch(page, /portfolioColumns|companyRowSelected/);
});

check("V3 company reasoning is progressive disclosure", () => {
  assert.match(page, /<details className=\{styles\.companyCase\}>/);
  assert.doesNotMatch(page, /<details className=\{styles\.companyCase\} open>/);
  assert.match(copy, /inspect: "Inspect case"/);
});

check("V3 pricing presents a restrained decision ladder", () => {
  assert.match(styles, /\.planGrid\{[^}]*grid-template-columns:repeat\(4,1fr\)/);
  assert.match(styles, /\.plan ul\{[^}]*display:grid/);
  assert.match(styles, /\.planFeatured\{background:var\(--ink\);color:#fff\}/);
});

check("V4 ladder explains each product with no more than three concrete outcomes", () => {
  assert.deepEqual(Object.values(getLandingV2Copy("en").pricing.plans).map((plan) => plan.points.length), [3, 3, 3, 3]);
  assert.match(copy, /A focused two-company analysis/);
  assert.match(copy, /A focused six-company comparison/);
  assert.match(copy, /A ranked twelve-company portfolio/);
  assert.match(copy, /A guided eighteen-company analysis/);
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

check("landing removes stale evidence-quality tiers and speculative Premium claims", () => {
  const publicLanding = `${page}\n${copy}`;
  assert.doesNotMatch(publicLanding, /Standard Evidence|Full Evidence|Reinforced Evidence/i);
  assert.doesNotMatch(publicLanding, /Decision Pathways|Decision-Critical Briefs|commercial benchmark|competitor context|What Changed/i);
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

console.log("Landing V5 product experience contract: 16 checks passed");
