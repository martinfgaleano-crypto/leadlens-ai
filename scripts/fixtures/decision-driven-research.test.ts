// §49/§50 regression suite for decision-driven research. Deterministic stub researcher
// (no live providers) proves: objective generation is bounded + customer-context-specific,
// research is adaptive (trigger-gated), evidence flows into the EXISTING decision authority
// (synthesizeCase), counterevidence does not inflate, and nothing forces PRIORITIZE.
import assert from "node:assert/strict";
import { deriveResearchObjectives, runResearchAgenda, applyFindingsToCaseInput, type ResearchObjective, type ResearchFinding, type ResearchCustomerContext } from "../../lib/intelligence/decision-driven-research";
import { synthesizeCase, type CanonicalCaseInput } from "../../lib/monitor/canonical-case";

let passed = 0;
const test = (name: string, fn: () => void | Promise<void>) => Promise.resolve(fn()).then(() => { passed++; console.log(`✓ ${name}`); });

const pmi: ResearchCustomerContext = {
  service: "post-merger integration execution", triggerFamily: ["acquisition", "carve-out", "merger"],
  mechanismHints: ["integration management office", "corporate development", "external advisor engagement"],
  buyerFunctionHints: ["integration management", "operations leadership", "corporate development"], geography: "United States",
};
const agenda = (missing = { trigger: true, mechanism: true, buyerFunction: true, access: true }) =>
  deriveResearchObjectives({ account: { company: "Acme Industrial", domain: "acme.com" }, customer: pmi, missing, openDecisionCritical: [], fit: "Strong" });

const beforeInput: CanonicalCaseInput = {
  accountId: "acme", identityVerified: true, fromUniverse: true, signalKind: null, signalDate: null, dateConfidence: "none",
  sourceHost: null, materialEvent: false, hasMaterialCounter: false, openDecisionCritical: ["Is there a current why-now trigger?"],
  priorFit: "Strong", priorTiming: "Limited", priorEvidence: "Moderate", independentSupportNew: false, hasPostReviewEvent: false,
  geographyConfirmed: true, regionRequired: false,
};
const stub = (map: Record<string, ResearchFinding>) => ({ research: async (o: ResearchObjective) => map[o.dimension] ?? { state: "not_found" as const, result: "none", sources: [], failure: "evidence_not_found" as const } });

(async () => {
  await test("agenda is bounded (<=5) and includes a trigger-first objective", () => {
    const o = agenda(); assert.ok(o.length <= 5); assert.equal(o[0].dimension, "trigger");
  });
  await test("agenda is customer-context specific (different service → different queries)", () => {
    const a = agenda();
    const other = deriveResearchObjectives({ account: { company: "Acme Industrial", domain: "acme.com" }, customer: { ...pmi, service: "ESG compliance audits", triggerFamily: ["new sustainability regulation", "emissions mandate"], mechanismHints: ["compliance procurement"], buyerFunctionHints: ["sustainability officer", "compliance"] }, missing: { trigger: true, mechanism: true, buyerFunction: true, access: true }, openDecisionCritical: [], fit: "Strong" });
    assert.notEqual(a[0].query, other[0].query);
    assert.match(a[0].question, /acquisition/i);
    assert.match(other[0].question, /sustainability|emissions/i);
  });
  await test("STRONG FIT + NO TRIGGER → a trigger research objective is generated", () => {
    const o = agenda({ trigger: true, mechanism: false, buyerFunction: false, access: false });
    assert.ok(o.some((x) => x.dimension === "trigger"));
  });
  await test("adaptive: trigger NOT found → mechanism/access skipped_adaptive (not chased)", async () => {
    const o = agenda();
    const r = await runResearchAgenda(o, stub({ trigger: { state: "not_found", result: "no recent acquisition", sources: [], failure: "evidence_not_found" } }));
    assert.equal(r.triggerCurrent, false);
    assert.ok(o.filter((x) => x.dimension === "mechanism" || x.dimension === "access").every((x) => x.status === "skipped_adaptive"));
  });
  await test("current trigger + mechanism unknown → mechanism researched; decision = validate (not prioritize)", async () => {
    const o = agenda();
    await runResearchAgenda(o, stub({
      trigger: { state: "verified", result: "Completed acquisition 2026-06 (8-K Item 2.01)", sources: [{ url: "https://sec.gov/x", title: "8-K", date: "2026-06-01" }], dated: "2026-06-01" },
      counterevidence: { state: "not_found", result: "no evidence of completion/in-house", sources: [], failure: "evidence_not_found" },
      mechanism: { state: "unknown", result: "no external-advisor route found", sources: [], failure: "evidence_not_found" },
      access: { state: "unknown", result: "no owning function identified", sources: [], failure: "evidence_not_found" },
    }));
    const after = applyFindingsToCaseInput(beforeInput, o);
    const d = synthesizeCase(after).decision;
    assert.notEqual(d, "prioritize");
    assert.ok(["validate", "monitor"].includes(d)); // current trigger + open mechanism/access ⇒ VALIDATE-band, never forced up
    assert.ok(after.openDecisionCritical.some((q) => /mechanism|access|function/i.test(q)));
  });
  await test("counterevidence found → decision does not inflate", async () => {
    const o = agenda();
    await runResearchAgenda(o, stub({
      trigger: { state: "verified", result: "acquisition 2026-06", sources: [], dated: "2026-06-01" },
      counterevidence: { state: "verified", result: "integration reported complete; dedicated in-house PMI team", sources: [{ url: "https://x", title: "y", date: "2026-07" }] },
    }));
    assert.equal(o.filter((x) => x.dimension === "mechanism" || x.dimension === "access").every((x) => x.status === "skipped_adaptive"), true);
    const after = applyFindingsToCaseInput(beforeInput, o);
    assert.equal(after.hasMaterialCounter, true);
    assert.notEqual(synthesizeCase(after).decision, "prioritize");
  });
  await test("full support (current trigger + mechanism + access, no counter) is PRIORITIZE-eligible via the real bar only", async () => {
    const o = agenda();
    await runResearchAgenda(o, stub({
      trigger: { state: "verified", result: "acquisition 2026-06", sources: [], dated: "2026-06-01" },
      counterevidence: { state: "not_found", result: "none", sources: [], failure: "evidence_not_found" },
      mechanism: { state: "verified", result: "engages external PMI advisors; transformation office", sources: [{ url: "https://x", title: "t", date: "2026-06" }] },
      access: { state: "verified", result: "integration management office identified", sources: [{ url: "https://y", title: "u", date: "2026-06" }] },
    }));
    const after = applyFindingsToCaseInput(beforeInput, o);
    const d = synthesizeCase(after).decision;
    assert.ok(["prioritize", "validate"].includes(d)); // eligible, but decided ONLY by synthesizeCase — not forced here
  });
  await test("provider failure is recorded distinctly, not treated as not_found", async () => {
    const o = agenda({ trigger: true, mechanism: false, buyerFunction: false, access: false });
    await runResearchAgenda(o, stub({ trigger: { state: "unknown", result: "provider down", sources: [], failure: "provider_failure" } }));
    assert.equal(o.find((x) => x.dimension === "trigger")!.status, "provider_failure");
  });

  console.log(`\n${passed}/8 decision-driven-research checks passed`);
  if (passed !== 8) process.exit(1);
})();
