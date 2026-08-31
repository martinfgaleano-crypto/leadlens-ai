import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { InMemoryAccountMemoryRepo, persistAndLoadMemory, applyCurrentMemoryToAccounts, toRow } from "@/lib/deliverable/account-memory-store";
import { snapshotAccountReview, diffAccountCase, type AccountReviewSnapshot } from "@/lib/deliverable/account-memory";
import { monitoredStateFromSnapshot, evaluateEligibility } from "@/lib/monitor/monitor-eligibility";
import type { AccountBriefVM } from "@/lib/deliverable/deliverable-view-model";
import { evidenceClaimSourceUrl } from "@/lib/intelligence/productive-spine";

let passed = 0;
const test = async (name: string, run: () => void | Promise<void>) => { await run(); passed += 1; console.log(`ok - ${name}`); };
const scope = { ownerUserId: "owner", clientKey: "context:factory-automation" };
const vm = (decision: AccountBriefVM["decision"]): AccountBriefVM => ({
  id: "acme", rank: 1, company: "Acme Manufacturing", segment: "manufacturing", geography: "United States", domain: "acme.example",
  monitorIdentity: { canonicalName: "Acme Manufacturing", domain: "acme.example", country: "United States", organizationType: "private_company", aliases: [], confidence: "verified", fromUniverse: true },
  accountRole: null, opportunityType: null, decision, decisionNote: decision, thesis: null, whyItMatters: null,
  dimensions: [{ label: "Fit", value: "Moderate" }, { label: "Timing", value: "Limited" }, { label: "Evidence", value: "Moderate" }],
  whatChanged: [], evidence: { sourceCount: 1, datedCount: 1, corroborated: false, latestAge: null, strength: "Moderate" },
  sources: [], counterSignals: [], limitations: [], validations: [], nextStep: null, revisitWhen: "A new material facility event is verified", freshness: null, confidence: "Moderate",
});

async function main() {
await test("customer view prefers a later accepted Monitor review over the original report review", async () => {
  const repo = new InMemoryAccountMemoryRepo();
  const report = vm("monitor");
  const r1 = snapshotAccountReview(report, { reviewId: "run-1", reviewedAt: "2026-07-01T00:00:00Z", contextVersion: "ctx:v1" });
  const r2: AccountReviewSnapshot = { ...r1, reviewId: "monitor-2", reviewedAt: "2026-08-01T00:00:00Z", decision: "validate", evidence: "Strong", independentSupport: true };
  await repo.persist([toRow(r1, scope), toRow(r2, scope)]);
  const memory = await persistAndLoadMemory(repo, [report], scope, { reviewId: "run-1", reviewedAt: r1.reviewedAt, contextVersion: r1.contextVersion }, undefined, { preferLatestAccepted: true });
  assert.equal(memory?.currentById.acme.reviewId, "monitor-2");
  assert.equal(memory?.previousById.acme.reviewId, "run-1");
  assert.equal(applyCurrentMemoryToAccounts([report], memory)[0].decision, "validate");
});

await test("accepted no-change review remains explicit and does not fabricate a transition", () => {
  const r1 = snapshotAccountReview(vm("monitor"), { reviewId: "r1", reviewedAt: "2026-07-01T00:00:00Z", contextVersion: "c" });
  const r2 = { ...r1, reviewId: "r2", reviewedAt: "2026-08-01T00:00:00Z" };
  const diff = diffAccountCase(r1, r2);
  assert.equal(diff.material, false); assert.equal(diff.decision.changed, false);
});

await test("stored revisit condition is not due; trusted explicit refresh is due", () => {
  const snap = snapshotAccountReview(vm("monitor"), { reviewId: "r", reviewedAt: "2026-08-29T00:00:00Z", contextVersion: "c" });
  const state = monitoredStateFromSnapshot(snap, scope);
  assert.equal(evaluateEligibility(state, new Date("2026-08-30T00:00:00Z")).eligible, false);
  assert.equal(evaluateEligibility({ ...state, refreshRequested: true }, new Date("2026-08-30T00:00:00Z")).eligible, true);
});

await test("productive spine retains evaluated Monitor/Hold before tier-limiting strong Cases", () => {
  const src = readFileSync("lib/intelligence/productive-spine.ts", "utf8");
  assert.match(src, /deliveryLimit:\s*researchLimit/);
  assert.match(src, /decision === "monitor" \|\| decision === "hold" \|\| strongIds\.has/);
});

await test("durable run metadata preserves authoritative commercial outcome", () => {
  const src = readFileSync("lib/intelligence/productive-spine-store.ts", "utf8");
  assert.match(src, /authoritativeOutcome/);
  assert.doesNotMatch(src, /record\.report\.processed_leads\.length \? "completed_with_opportunities"/);
});

await test("actual customer route exposes bounded Monitor refresh and continuity", () => {
  const page = readFileSync("components/deliverable/OpportunityWorkspace.tsx", "utf8");
  assert.match(page, /\/api\/customer\/monitor/);
  assert.match(page, /This is not real-time monitoring/);
  assert.match(page, /Previous review/);
  assert.match(page, /Current review/);
});

await test("only externally verified claims inherit the accepted primary source", () => {
  assert.equal(evidenceClaimSourceUrl("verified_public_signal", "https://corp.example/news"), "https://corp.example/news");
  assert.equal(evidenceClaimSourceUrl("inferred_from_context", "https://corp.example/news"), null);
  assert.equal(evidenceClaimSourceUrl("weak_inference", "https://corp.example/news"), null);
  assert.equal(evidenceClaimSourceUrl("missing_evidence", "https://corp.example/news"), null);
});

console.log(`\n${passed} passed, 0 failed`);
}

main().catch((error) => { console.error(error); process.exit(1); });
