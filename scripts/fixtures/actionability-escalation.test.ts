import { newActionabilityEscalation, runActionabilityEscalation, type EscalationPassResult } from "@/lib/intelligence/actionability-escalation";
import type { QualifiedAccount } from "@/lib/intelligence/customer-job";

let passed = 0;
function test(name: string, ok: boolean): void { if (!ok) throw new Error(`FAIL: ${name}`); passed++; console.log(`✓ ${name}`); }
const account = (decision: QualifiedAccount["decision"], valid = false): QualifiedAccount => ({
  key: `k-${decision}-${valid}`, company: "Test Co", domain: "test.co", route: "r", decision,
  fit: "Strong", timing: "Strong", evidenceCount: 2, qualifiedAtPass: 1,
  hasSource: valid, hasValidatedDate: valid, commercialMechanismVerified: valid,
  accessPathIdentified: valid, counterevidenceMaterial: false,
});
const result = (track: "deepen_existing" | "actionability_first_discovery", pass: number, candidate: QualifiedAccount | null): EscalationPassResult => ({
  candidates: [{ key: `${track}-${pass}`, company: "Test Co", track, queryFamily: `f${pass}`, provider: "test", account: candidate, rejectionReason: candidate ? null : "NO_CURRENT_TIMING" }],
  queries: [`q${pass}`], queryFamilies: [`f${pass}`], providersAttempted: ["test"], providerFailures: [], costUsd: 0.25,
});

async function main(): Promise<void> {
let calls = 0; const saves: number[] = [];
const success = await runActionabilityEscalation(newActionabilityEscalation({ jobId: "j1", tier: "premium", maxPasses: 4, budgetUsd: 5 }), {
  deepenExisting: async () => result("deepen_existing", ++calls, account("validate")),
  discoverActionable: async () => result("actionability_first_discovery", ++calls, account("prioritize", true)),
  save: async (s) => { saves.push(s.pass); },
});
test("runs Track A then Track B", success.accountsDeepened === 1 && success.accountsDiscovered === 1);
test("stops on evidence-qualified Prioritize", success.status === "success" && success.pass === 2 && success.prioritizeFound === 1);
test("persists progress and final state", saves.length >= 3);
test("records bounded spend", success.spendUsd === 0.5);

const exhausted = await runActionabilityEscalation(newActionabilityEscalation({ jobId: "j2", tier: "portfolio", maxPasses: 2 }), {
  deepenExisting: async (s) => result("deepen_existing", s.pass + 1, null),
  discoverActionable: async (s) => result("actionability_first_discovery", s.pass + 1, account("validate")),
});
test("exhausts after configured passes", exhausted.status === "exhausted" && exhausted.pass === 2);
test("records rejection taxonomy", exhausted.rejectionReasons.NO_CURRENT_TIMING === 1);

const provider = await runActionabilityEscalation(newActionabilityEscalation({ jobId: "j3", tier: "premium" }), {
  deepenExisting: async () => ({ candidates: [], queries: ["q"], queryFamilies: ["f"], providersAttempted: ["brave"], providerFailures: ["brave"], costUsd: 0 }),
  discoverActionable: async () => { throw new Error("must not run"); },
});
test("provider exhaustion is an explicit stop", provider.status === "provider_capacity" && provider.stopCondition === "ALL_ATTEMPTED_PROVIDERS_FAILED");
console.log(`\n${passed}/7 actionability escalation checks passed`);
}

main().catch((error) => { console.error(error); process.exit(1); });
