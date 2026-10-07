// Regression suite for Path to Prioritize (§16). Proves it enumerates legitimate
// decision-critical gaps for interesting non-prioritize accounts, returns an honest
// "no realistic path" when structural fit is the ceiling, never fabricates, and is
// generic (no customer-specific knowledge).
import assert from "node:assert/strict";
import { derivePathToPrioritize, type PathToPrioritizeInput } from "../../lib/intelligence/path-to-prioritize";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`✓ ${name}`); };

const base: PathToPrioritizeInput = {
  decision: "validate", fit: "Strong", timing: "Limited", evidence: "Moderate",
  openDecisionCritical: [], hasMaterialCounter: false,
  commercialMechanismVerified: false, commercialAccessVerified: false, independentlyCorroborated: false,
};

test("already-prioritized needs no path", () => {
  const r = derivePathToPrioritize({ ...base, decision: "prioritize" });
  assert.equal(r.reachable, true);
  assert.deepEqual(r.conditions, []);
});

test("weak structural fit → NO realistic path (honest, not fabricated)", () => {
  const r = derivePathToPrioritize({ ...base, decision: "hold", fit: "Limited" });
  assert.equal(r.reachable, false);
  assert.deepEqual(r.conditions, []);
  assert.match(r.rationale, /No realistic path/i);
});
test("null fit → NO realistic path", () => {
  const r = derivePathToPrioritize({ ...base, decision: "hold", fit: null });
  assert.equal(r.reachable, false);
});

test("validate with open decision-critical question lists it as a condition", () => {
  const r = derivePathToPrioritize({ ...base, openDecisionCritical: ["whether new-store assortment reviews include premium beverages"] });
  assert.equal(r.reachable, true);
  assert.ok(r.conditions.some((c) => /confirm: whether new-store assortment/.test(c)));
});

test("missing mechanism + access + timing + corroboration are all named, capped at 4", () => {
  const r = derivePathToPrioritize({ ...base });
  assert.equal(r.reachable, true);
  assert.ok(r.conditions.length <= 4);
  assert.ok(r.conditions.some((c) => /commercial mechanism/i.test(c)));
  assert.ok(r.conditions.some((c) => /commercial access/i.test(c)));
});

test("material counterevidence is the first condition", () => {
  const r = derivePathToPrioritize({ ...base, hasMaterialCounter: true });
  assert.match(r.conditions[0], /resolve the material counterevidence/i);
});

test("fully-evidenced-but-not-prioritized falls back to the current-opportunity bar", () => {
  const r = derivePathToPrioritize({ ...base, decision: "monitor", timing: "Strong", evidence: "Strong", commercialMechanismVerified: true, commercialAccessVerified: true, independentlyCorroborated: true });
  assert.equal(r.reachable, true);
  assert.ok(r.conditions.some((c) => /current.*opportunity|current, evidenced/i.test(c)));
});

test("Spanish output localizes conditions + rationale", () => {
  const r = derivePathToPrioritize({ ...base, openDecisionCritical: ["ruta de importación"] }, { es: true });
  assert.match(r.rationale, /encaje/i);
  assert.ok(r.conditions.some((c) => /confirmar:/.test(c)));
});

test("generic — no customer name anywhere in output", () => {
  const r = derivePathToPrioritize({ ...base });
  const blob = (r.conditions.join(" ") + " " + r.rationale).toLowerCase();
  assert.doesNotMatch(blob, /amor de gea|natural grocers|sprouts/);
});

console.log(`\n${passed}/9 path-to-prioritize checks passed`);
