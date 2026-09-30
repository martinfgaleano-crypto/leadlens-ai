import assert from "node:assert/strict";
import { isEvidenceQualifiedPrioritize } from "../../lib/intelligence/advanced-tier-readiness";
import type { QualifiedAccount } from "../../lib/intelligence/customer-job";

const canonical: QualifiedAccount = {
  key: "natural-grocers::naturalgrocers.com",
  company: "Natural Grocers",
  domain: "naturalgrocers.com",
  route: "supplier_access",
  decision: "prioritize",
  fit: "Strong",
  timing: null,
  evidenceCount: 1,
  qualifiedAtPass: 7,
  hasSource: true,
  hasValidatedDate: false,
  currentActionabilityBasis: true,
  commercialMechanismVerified: true,
  accessPathIdentified: true,
  counterevidenceMaterial: false,
};

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`✓ ${name}`); };
test("canonical Natural Grocers Case survives the evidence-qualified Prioritize gate", () => assert.equal(isEvidenceQualifiedPrioritize(canonical), true));
test("supplier intake never substitutes for source provenance", () => assert.equal(isEvidenceQualifiedPrioritize({ ...canonical, hasSource: false }), false));
test("open access never substitutes for strong objective fit", () => assert.equal(isEvidenceQualifiedPrioritize({ ...canonical, fit: "Moderate" }), false));
test("commercial mechanism must be verified", () => assert.equal(isEvidenceQualifiedPrioritize({ ...canonical, commercialMechanismVerified: false }), false));
test("material counterevidence forces fail-closed", () => assert.equal(isEvidenceQualifiedPrioritize({ ...canonical, counterevidenceMaterial: true }), false));
test("the gate does not infer buying intent from a supplier page", () => assert.equal(canonical.timing, null));
console.log(`\n${passed}/6 Natural Grocers red-team checks passed`);
