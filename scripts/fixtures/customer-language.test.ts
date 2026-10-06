// §28/§30 regression suite for the customer-language remediation.
// Proves the presentation-layer sanitizer and the canonical allocation are
// generic (not Amor-de-Gea-specific), language-aware, and leave no internal
// vocabulary, opaque score, or competing decision taxonomy in customer output —
// while never altering counts or decisions.
import assert from "node:assert/strict";
import { toCustomerText, hasForbiddenCustomerLanguage, FORBIDDEN_CUSTOMER_TOKENS } from "../../lib/delivery-system/customer-language";
import { deriveAllocation } from "../../lib/products/report-experience";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`✓ ${name}`); };

// ── reason/action codes → prose (both languages) ──
test("maps internal reason codes to EN prose", () => {
  const out = toCustomerText("Next step: validate_source_first", { es: false });
  assert.doesNotMatch(out, /validate_source_first/);
  assert.match(out, /verify the commercial signal/);
});
test("maps internal reason codes to ES prose", () => {
  const out = toCustomerText("Siguiente: monitor_for_new_signal", { es: true });
  assert.doesNotMatch(out, /monitor_for_new_signal/);
  assert.match(out, /monitorear/);
});

// ── opaque scores + legacy tier labels ──
test("strips opaque /10 scores and legacy tier labels", () => {
  const out = toCustomerText("highest-scoring account at 7.5/10 (WARM)", { es: false });
  assert.doesNotMatch(out, /7\.5\s*\/\s*10/);
  assert.doesNotMatch(out, /\bWARM\b/);
  assert.doesNotMatch(out, /highest-scoring/i);
  assert.match(out, /top-priority/);
});

// ── Spanish analyst rationale → EN for an English deliverable ──
test("translates the frozen Spanish rationale template for EN output", () => {
  const raw = "validate: encaje strong, sin señal temporal verificada y evidencia sin independencia confirmada; queda por resolver: confirmar la categoría.";
  const out = toCustomerText(raw, { es: false });
  assert.doesNotMatch(out, /encaje|sin señal|independencia confirmada|queda por resolver/i);
  assert.match(out, /fit strong/);
  assert.match(out, /no verified timing signal and evidence without confirmed independence/);
  assert.match(out, /open question/);
});
test("preserves Spanish rationale for a Spanish deliverable", () => {
  const raw = "validate: encaje strong, sin señal temporal verificada";
  const out = toCustomerText(raw, { es: true });
  assert.match(out, /encaje strong/); // untouched Spanish is correct for an ES report
});

// ── placeholder source label ──
test("replaces the Source URL unavailable placeholder", () => {
  assert.equal(toCustomerText("Source URL unavailable", { es: false }), "Contextual reference");
  assert.equal(toCustomerText("Source URL unavailable", { es: true }), "Referencia contextual");
});

// ── never mangles clean prose ──
test("leaves clean customer prose and legitimate words intact", () => {
  const clean = "Whole Foods' expansion is a timing-relevant company signal; a warm introduction or broker relationship may help.";
  assert.equal(toCustomerText(clean, { es: false }), clean); // "warm introduction" is prose, not the WARM label
});

// ── forbidden-language detector (QA gate authority) ──
test("hasForbiddenCustomerLanguage detects and then clears", () => {
  assert.ok(hasForbiddenCustomerLanguage("7.5/10 WARM validate_source_first").length >= 3);
  assert.deepEqual(hasForbiddenCustomerLanguage(toCustomerText("Next step: validate_source_first — 7.5/10 (WARM)", { es: false })), []);
  assert.ok(FORBIDDEN_CUSTOMER_TOKENS.length > 0);
});

// ── canonical allocation (generic, any distribution / language) ──
test("allocation line uses canonical decisions, never a legacy taxonomy", () => {
  const a = deriveAllocation({ prioritize: 2, validate: 3, monitor: 1, hold: 4 });
  assert.equal(a.line, "2 prioritize · 3 validate · 1 monitor · 4 hold");
  assert.doesNotMatch(a.line + a.detail, /\b(act now|investigate|reserve|reject|HOT|WARM|COLD)\b/i);
});
test("allocation with a prioritized account concentrates effort there", () => {
  const a = deriveAllocation({ prioritize: 1, validate: 2, monitor: 0, hold: 0 });
  assert.match(a.detail, /Concentrate immediate effort on the 1 account/);
});
test("zero-prioritize allocation never implies act-now (EN + ES)", () => {
  const en = deriveAllocation({ prioritize: 0, validate: 2, monitor: 1, hold: 3 }, false);
  assert.doesNotMatch(en.detail, /\bact now\b/i);
  assert.match(en.detail, /before any outreach/);
  const es = deriveAllocation({ prioritize: 0, validate: 0, monitor: 0, hold: 5 }, true);
  assert.match(es.line, /priorizar · /);
  assert.match(es.detail, /Ninguna cuenta justifica/);
});

// ── generalization: a different customer/domain string still sanitizes ──
test("sanitizer is domain-agnostic (no hardcoded customer)", () => {
  const out = toCustomerText("Acme Robotics: act_now, highest-scoring at 9/10 (HOT); next: send_outreach_now", { es: false });
  assert.deepEqual(hasForbiddenCustomerLanguage(out), []);
  assert.match(out, /prioritize/);
  assert.match(out, /prepare commercial outreach/);
});

console.log(`\n${passed}/12 customer-language checks passed`);
