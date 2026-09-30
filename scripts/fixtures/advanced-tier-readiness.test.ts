import { evaluateAdvancedTierReadiness, isEvidenceQualifiedPrioritize } from "@/lib/intelligence/advanced-tier-readiness";
import type { QualifiedAccount } from "@/lib/intelligence/customer-job";

let passed = 0;
function test(name: string, ok: boolean): void { if (!ok) throw new Error(`FAIL: ${name}`); passed++; console.log(`✓ ${name}`); }
const q = (i: number, decision: QualifiedAccount["decision"] = "hold", audit: Partial<QualifiedAccount> = {}): QualifiedAccount => ({
  key: `k${i}`, company: `Co ${i}`, domain: `co${i}.com`, route: "r", decision,
  fit: "Strong", timing: "Strong", evidenceCount: 2, qualifiedAtPass: 1, ...audit,
});
const valid = q(99, "prioritize", { hasSource: true, hasValidatedDate: true, commercialMechanismVerified: true, accessPathIdentified: true, counterevidenceMaterial: false });

test("label alone is not evidence-qualified", !isEvidenceQualifiedPrioritize(q(1, "prioritize")));
test("fully audited Prioritize qualifies", isEvidenceQualifiedPrioritize(valid));
test("material counterevidence fails closed", !isEvidenceQualifiedPrioritize({ ...valid, counterevidenceMaterial: true }));
test("Preview is ready at capacity without Prioritize", evaluateAdvancedTierReadiness("preview", [q(1), q(2)]).deliveryReady);
test("Brief is ready at capacity without Prioritize", evaluateAdvancedTierReadiness("brief", Array.from({ length: 6 }, (_, i) => q(i))).deliveryReady);
const portfolioNoAction = evaluateAdvancedTierReadiness("portfolio", Array.from({ length: 12 }, (_, i) => q(i)));
test("Portfolio capacity alone is not delivery ready", portfolioNoAction.capacityReady && !portfolioNoAction.deliveryReady);
test("Portfolio requests actionability research", portfolioNoAction.reasonCodes.includes("ACTIONABILITY_RESEARCH_REQUIRED"));
const premium = evaluateAdvancedTierReadiness("premium", [...Array.from({ length: 17 }, (_, i) => q(i)), valid]);
test("Premium requires 18 legitimate accounts", premium.actual === 18 && premium.capacityReady);
test("Premium becomes ready with audited Prioritize", premium.deliveryReady && premium.evidenceQualifiedPrioritize === 1);
console.log(`\n${passed}/9 advanced-tier readiness checks passed`);
