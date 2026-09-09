import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { oneTimeCards } from "../../lib/commercial/plan-catalog";

const root = process.cwd();
const page = readFileSync(`${root}/app/page.tsx`, "utf8");
const copy = readFileSync(`${root}/lib/landing/v2-copy.ts`, "utf8");
const pricing = readFileSync(`${root}/app/pricing/page.tsx`, "utf8");

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
});

check("one executive portfolio and one deeper company case are the only product metaphors", () => {
  assert.equal((page.match(/<ExecutivePortfolio/g) ?? []).length, 1);
  assert.equal((page.match(/<CompanyCase/g) ?? []).length, 1);
  assert.doesNotMatch(page + copy, /Opportunity Canvas|Decision Desk|Hero carousel/i);
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

console.log("Landing Clarity V2 contract: 9 checks passed");
