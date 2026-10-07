// Regression suite for the customer-safe delivery terminal state (§1/§33).
import assert from "node:assert/strict";
import { deriveTerminalState } from "../../lib/delivery-system/delivery-terminal-state";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`✓ ${name}`); };
const counts = (p: number, v: number, m: number, h: number) => ({ prioritize: p, validate: v, monitor: m, hold: h });

test("full + actionable → no note", () => {
  const t = deriveTerminalState({ selected: 12, capacity: 12, counts: counts(2, 4, 3, 3), sourcedCount: 12, evidenceDenominator: 12 });
  assert.equal(t.kind, "full");
  assert.equal(t.note, "");
});

test("underfilled (not padded) is explained honestly", () => {
  const t = deriveTerminalState({ selected: 6, capacity: 12, counts: counts(1, 2, 1, 2), sourcedCount: 6, evidenceDenominator: 6 });
  assert.equal(t.kind, "underfilled");
  assert.equal(t.underfilled, true);
  assert.match(t.note, /were evaluated and qualified of the up-to-12/);
  assert.match(t.note, /not padded/);
});

test("no prioritize + good coverage → valuable abstention", () => {
  const t = deriveTerminalState({ selected: 6, capacity: 6, counts: counts(0, 2, 1, 3), sourcedCount: 6, evidenceDenominator: 6 });
  assert.equal(t.kind, "no_actionable");
  assert.equal(t.abstention, "valuable_abstention");
  assert.match(t.note, /research conclusion, not a failure/);
});

test("no prioritize + sparse coverage → research thin (distinct from abstention)", () => {
  const t = deriveTerminalState({ selected: 4, capacity: 6, counts: counts(0, 1, 1, 2), sourcedCount: 1, evidenceDenominator: 4 });
  assert.equal(t.abstention, "research_thin");
  assert.equal(t.kind, "no_actionable_underfilled");
  assert.match(t.note, /insufficient to confidently qualify/);
});

test("never invents refund/commercial policy language", () => {
  const t = deriveTerminalState({ selected: 3, capacity: 12, counts: counts(0, 1, 1, 1), sourcedCount: 3, evidenceDenominator: 3 });
  assert.doesNotMatch(t.note, /refund|credit|money back|reembolso/i);
});

test("Spanish localizes the note", () => {
  const t = deriveTerminalState({ selected: 6, capacity: 12, counts: counts(0, 2, 1, 3), sourcedCount: 6, evidenceDenominator: 6 }, { es: true });
  assert.match(t.note, /cuentas|priorización/i);
});

console.log(`\n${passed}/6 delivery-terminal-state checks passed`);
