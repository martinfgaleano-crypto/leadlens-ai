import assert from "node:assert/strict";
import { selectDeterministically, type SelectableAccount } from "../../lib/intelligence/deterministic-tier-selection";

const a = (company: string, patch: Partial<SelectableAccount> = {}): SelectableAccount => ({
  id: company.toLowerCase().replace(/\W/g, "-"), company, decision: "validate", fit: "Strong", timing: "Limited", evidence: "Moderate",
  evidenceCount: 1, hasSource: true, hasValidatedDate: false, independentlyCorroborated: false,
  commercialMechanismVerified: false, accessVerified: false, counterevidenceMaterial: false, ...patch,
});
let passed = 0; const t = (name: string, fn: () => void) => { fn(); passed++; console.log(`✅ ${name}`); };

const set = [a("Zulu"), a("Alpha", { accessVerified: true }), a("Beta", { decision: "prioritize" }), a("Gamma", { evidenceCount: 3 })];
t("decision dominates incidental input order", () => assert.equal(selectDeterministically(set, 2).selected[0].company, "Beta"));
t("verified access breaks ties before evidence count", () => assert.equal(selectDeterministically(set, 2).selected[1].company, "Alpha"));
t("permutations produce the same selection", () => assert.deepEqual(selectDeterministically([...set].reverse(), 3).selected.map(x => x.company), selectDeterministically(set, 3).selected.map(x => x.company)));
t("qualified-not-selected remains auditable", () => assert.match(selectDeterministically(set, 3).qualifiedNotSelected[0].reason, /tier cutoff/));
t("nested capacities are prefixes of one canonical order", () => { const x = selectDeterministically(set, 4).ordered; assert.deepEqual(x.slice(0, 2), selectDeterministically(set, 2).selected); });
console.log(`\n${passed} passed, 0 failed`);
