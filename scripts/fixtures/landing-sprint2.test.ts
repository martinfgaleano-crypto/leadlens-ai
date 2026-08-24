import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { interpretLandingInput, sanitizeLandingInput, LANDING_INTERPRETATION_EXAMPLES } from "../../lib/landing/landing-interpretation";
import { NORTHSTAR_WHAT_CHANGED } from "../../lib/landing/fixtures/northstar-change";

let passed = 0;
const test = (name: string, run: () => void) => {
  run();
  passed += 1;
  console.log(`✓ ${name}`);
};

test("interprets a controlled logistics example deterministically", () => {
  const first = interpretLandingInput(LANDING_INTERPRETATION_EXAMPLES[1]);
  const second = interpretLandingInput(LANDING_INTERPRETATION_EXAMPLES[1]);
  assert.deepEqual(first, second);
  assert.equal(first.scenarioKey, "logistics");
  assert.deepEqual(first.commercialContext.regions, ["Colombia"]);
  assert.ok(first.signalFamilies.includes("New distribution center"));
});

test("all controlled examples use the same interpretation path", () => {
  assert.deepEqual(LANDING_INTERPRETATION_EXAMPLES.map((value) => interpretLandingInput(value).scenarioKey), ["cybersecurity", "logistics", "packaging"]);
});

test("ambiguous input stays partial and asks one clarification", () => {
  const result = interpretLandingInput("software");
  assert.equal(result.scenarioKey, null);
  assert.equal(result.signalFamilies.length, 0);
  assert.equal(result.buyerHypotheses.length, 0);
  assert.equal(result.clarificationGaps.length, 1);
});

test("unknown input does not manufacture unsupported specificity", () => {
  const result = interpretLandingInput("We help companies grow");
  assert.equal(result.targetAccountDescriptors.length, 0);
  assert.equal(result.commercialContext.industries.length, 0);
  assert.equal(result.commercialContext.objective, null);
});

test("projection is explicitly illustrative with deterministic provenance", () => {
  const result = interpretLandingInput(LANDING_INTERPRETATION_EXAMPLES[0]);
  assert.equal(result.illustrative, true);
  assert.equal(result.provenance, "deterministic_demo");
});

test("input sanitizer removes markup, normalizes space and enforces the limit", () => {
  assert.equal(sanitizeLandingInput(" <b>  software </b> "), "b software /b");
  assert.equal(sanitizeLandingInput("x".repeat(400)).length, 280);
});

test("localized interpretation preserves deterministic scenario semantics", () => {
  const result = interpretLandingInput("Vendemos software logístico a fabricantes en Colombia.", "es");
  assert.equal(result.scenarioKey, "logistics");
  assert.match(result.productCapability, /logística/i);
  assert.deepEqual(result.commercialContext.regions, ["Colombia"]);
});

test("Japanese controlled input resolves without ASCII word-boundary loss", () => {
  const result = interpretLandingInput("ラテンアメリカの銀行向けにサイバーセキュリティを販売しています。", "ja");
  assert.equal(result.scenarioKey, "cybersecurity");
  assert.deepEqual(result.commercialContext.regions, ["Latin America"]);
  assert.match(result.productCapability, /サイバーセキュリティ/);
});

test("What Changed fixture uses canonical decision and strength values", () => {
  assert.deepEqual(NORTHSTAR_WHAT_CHANGED.before, { decision: "monitor", timing: "Moderate" });
  assert.deepEqual(NORTHSTAR_WHAT_CHANGED.after, { decision: "prioritize", timing: "Strong" });
  assert.equal(NORTHSTAR_WHAT_CHANGED.change.kind, "true_change");
  assert.equal(NORTHSTAR_WHAT_CHANGED.illustrative, true);
});

test("landing modules have no persistence, network, ranking or Account Memory dependency", () => {
  const root = process.cwd();
  const files = [
    "lib/landing/landing-interpretation.ts",
    "lib/landing/fixtures/northstar-change.ts",
  ];
  const source = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  for (const forbidden of ["fetch(", "localStorage", "sessionStorage", "account-memory", "scoreOpportunity", "rankAccounts", "supabase"]) {
    assert.equal(source.includes(forbidden), false, `forbidden dependency found: ${forbidden}`);
  }
});

test("landing surface wires complete tab semantics and reduced-motion parity", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app/demo-pipeline/page.tsx"), "utf8");
  assert.match(source, /aria-controls={`cc-panel-\${tb}`}/);
  assert.match(source, /aria-labelledby={`cc-tab-\${tab}`}/);
  assert.match(source, /onCaseTabKey/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /scrollIntoView\(\{ behavior: reduceMotion \? "auto" : "smooth"/);
});

console.log(`\n${passed}/${passed} Landing Sprint 2 contract tests passed.`);
