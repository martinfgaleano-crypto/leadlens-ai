// ─── Account Memory demo artifacts (controlled synthetic timeline) ────────────
// Renders a FIRST-review and a SECOND-review Asteron portable from the SAME real
// structured intelligence. The "previous review" is a SYNTHETIC earlier state
// (verified changes stripped, decisions rolled back to Monitor/Validate, systems
// validation open) — a test timeline around real-like Cases, NOT actual history
// (§39/§142). No provider calls; no evidence mutated.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { renderPortableHtml, type PortableMemory } from "../../lib/deliverable/portable/render-portable";
import { snapshotAccountReview } from "../../lib/deliverable/account-memory";
import type { DeliverableViewModel, AccountBriefVM } from "../../lib/deliverable/deliverable-view-model";

const vm: DeliverableViewModel = JSON.parse(readFileSync("output/benchmark/asteron-benchmark-deliverable.vm.json", "utf8"));

// Synthetic PRIOR state: before the expansions were verified. For accounts that
// currently show a verified change, roll back to Monitor + no verified change +
// an open decision-critical "systems" validation. Others carry forward unchanged.
function priorOf(a: AccountBriefVM): AccountBriefVM {
  const hadChange = a.whatChanged.some((c) => c.kind === "true_change" || c.kind === "recent_event");
  if (!hadChange) return a;
  return {
    ...a, decision: "monitor",
    dimensions: a.dimensions.map((d) => d.label === "Timing" ? { ...d, value: "Limited" } : d.label === "Evidence" ? { ...d, value: "Limited" } : d),
    whatChanged: [{ event: "No verified recent change", date: null, age: null, source: null, kind: "unknown" }],
    evidence: { ...a.evidence, corroborated: null, datedCount: 0, strength: "Limited" },
    sources: [],
    validations: ["Confirm current planning systems / vendor"],
    validationDetails: [{ question: "Confirm current planning systems / vendor", decisionCritical: true, howToValidate: null, changesDecisionBecause: null }],
    revisitWhen: a.revisitWhen ?? "A new facility or expansion is announced",
  };
}

const prevReview = { reviewId: "asteron-review-1", reviewedAt: "2026-03-15", contextVersion: "asteron-v1" };
const mem: PortableMemory = {
  current: { reviewId: "asteron-review-2", reviewedAt: "2026-08-22", contextVersion: "asteron-v1" },
  previousById: Object.fromEntries(vm.accounts.map((a) => [a.id, snapshotAccountReview(priorOf(a), prevReview)])),
};

mkdirSync("output/benchmark", { recursive: true });
writeFileSync("output/benchmark/asteron-review1-first.html", renderPortableHtml(vm));                 // first review: no memory
writeFileSync("output/benchmark/asteron-review2-memory.html", renderPortableHtml(vm, mem));            // second review: Since Last Review
const memHits = vm.accounts.filter((a) => a.whatChanged.some((c) => c.kind === "true_change" || c.kind === "recent_event")).length;
console.log(JSON.stringify({ firstReview: "output/benchmark/asteron-review1-first.html", secondReview: "output/benchmark/asteron-review2-memory.html", accountsWithMemory: memHits }, null, 2));
