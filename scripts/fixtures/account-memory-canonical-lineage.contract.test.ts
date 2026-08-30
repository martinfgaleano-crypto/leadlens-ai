// Contract-first production-composition reproductions for Account Memory.
// EXPECTED TO FAIL until the canonical lineage contract is implemented.
// No production behavior is changed by this file.
import { InMemoryAccountMemoryRepo, persistAndLoadMemory, rowsForReview } from "@/lib/deliverable/account-memory-store";
import { diffAccountCase, orderReviews, snapshotAccountReview, snapshotFingerprint } from "@/lib/deliverable/account-memory";
import type { AccountBriefVM, DecisionState } from "@/lib/deliverable/deliverable-view-model";

let passed = 0;
const failures: string[] = [];
function expect(name: string, condition: boolean, observed?: unknown): void {
  if (condition) { passed++; console.log(`ok - ${name}`); return; }
  const detail = observed === undefined ? "" : ` | observed=${JSON.stringify(observed)}`;
  failures.push(`${name}${detail}`);
  console.log(`EXPECTED CONTRACT FAILURE - ${name}${detail}`);
}

const account = (input: {
  id: string; company?: string; domain?: string | null; decision?: DecisionState;
  event?: string | null; eventDate?: string | null; structuralReject?: boolean;
}): AccountBriefVM => ({
  id: input.id, rank: null, company: input.company ?? input.id, segment: "manufacturing",
  geography: "US", domain: input.domain ?? "example.com",
  monitorIdentity: {
    canonicalName: input.company ?? input.id, domain: input.domain ?? "example.com", country: "US",
    organizationType: "operating_company", aliases: [], confidence: "verified", fromUniverse: true,
  },
  accountRole: "Potential Customer", opportunityType: "Capacity Expansion",
  decision: input.decision ?? "monitor", decisionNote: input.structuralReject ? "structural_disqualifier" : null,
  thesis: null, whyItMatters: null,
  dimensions: [
    { label: "Fit", value: "Strong" },
    { label: "Timing", value: input.eventDate ? "Strong" : "Limited" },
    { label: "Evidence", value: input.eventDate ? "Strong" : "Limited" },
  ],
  whatChanged: input.eventDate ? [{ event: input.event ?? "Opened facility", date: input.eventDate, age: null, source: "corp.example", kind: "true_change" }] : [],
  evidence: { sourceCount: input.eventDate ? 1 : 0, datedCount: input.eventDate ? 1 : 0, corroborated: false, latestAge: null, strength: input.eventDate ? "Strong" : "Limited" },
  sources: input.eventDate ? [{ label: "corp.example", url: "https://corp.example/event", date: input.eventDate, age: null, relation: "direct", claim: input.event ?? "Opened facility" }] : [],
  counterSignals: [], limitations: [], validations: [], nextStep: null,
  revisitWhen: "A new material facility event is verified", freshness: null, confidence: input.eventDate ? "Strong" : "Limited",
});

const scope = (owner: string, clientScope: string) => ({ ownerUserId: owner, clientKey: clientScope });
const review = (reviewId: string, reviewedAt: string, contextVersion = "ctx:v1") => ({ reviewId, reviewedAt, contextVersion });

async function run(): Promise<void> {
  // 1 — production currently derives clientKey from runId. A new run cannot see its predecessor.
  {
    const repo = new InMemoryAccountMemoryRepo();
    const a = account({ id: "domain:grainger.com", company: "Grainger", domain: "grainger.com" });
    await persistAndLoadMemory(repo, [a], scope("customer-a", "intel_run_1"), review("intel_run_1", "2026-01-01"));
    const second = await persistAndLoadMemory(repo, [a], scope("customer-a", "intel_run_2"), review("intel_run_2", "2026-02-01"));
    expect("same customer/context/account across two run IDs has predecessor", second?.previousById[a.id]?.reviewId === "intel_run_1", second);
  }

  // 2 — current adapter IDs contain array index; reorder forks lineage.
  {
    const repo = new InMemoryAccountMemoryRepo();
    const r1 = [account({ id: "alpha-0", company: "Alpha", domain: "alpha.com" }), account({ id: "beta-1", company: "Beta", domain: "beta.com" })];
    const r2 = [account({ id: "beta-0", company: "Beta", domain: "beta.com" }), account({ id: "alpha-1", company: "Alpha", domain: "alpha.com" })];
    await persistAndLoadMemory(repo, r1, scope("customer-a", "context:ctx-1"), review("r1", "2026-01-01"));
    const second = await persistAndLoadMemory(repo, r2, scope("customer-a", "context:ctx-1"), review("r2", "2026-02-01"));
    expect("report reorder preserves Alpha and Beta account lineage", Boolean(second?.previousById["alpha-1"] && second?.previousById["beta-0"]), second?.previousById);
  }

  // 3 — identical retry is idempotent.
  {
    const repo = new InMemoryAccountMemoryRepo();
    const a = account({ id: "domain:grainger.com", company: "Grainger", domain: "grainger.com" });
    const s = scope("customer-a", "context:ctx-1"), m = review("r1", "2026-01-01");
    await persistAndLoadMemory(repo, [a], s, m); await persistAndLoadMemory(repo, [a], s, m);
    expect("same review same payload retry creates one immutable row", repo.rows.length === 1 && repo.rows[0].fingerprint === snapshotFingerprint(repo.rows[0].snapshot), repo.rows.length);
  }

  // 4 — changed fingerprint under same review must conflict, not overwrite.
  {
    const repo = new InMemoryAccountMemoryRepo();
    const s = scope("customer-a", "context:ctx-1"), m = review("r1", "2026-01-01");
    await persistAndLoadMemory(repo, [account({ id: "domain:grainger.com", decision: "monitor" })], s, m);
    const original = structuredClone(repo.rows[0]);
    await persistAndLoadMemory(repo, [account({ id: "domain:grainger.com", decision: "validate", eventDate: "2026-01-01" })], s, m);
    expect("same review changed fingerprint preserves original and reports conflict", repo.rows[0].fingerprint === original.fingerprint && repo.rows[0].snapshot.decision === "monitor", repo.rows[0].snapshot.decision);
  }

  // 5 — same universal company, different tenant histories remain isolated.
  {
    const repo = new InMemoryAccountMemoryRepo();
    const a = account({ id: "domain:grainger.com", company: "Grainger", domain: "grainger.com" });
    await persistAndLoadMemory(repo, [a], scope("customer-a", "context:ctx-1"), review("a1", "2026-01-01"));
    const b = await persistAndLoadMemory(repo, [a], scope("customer-b", "context:ctx-1"), review("b1", "2026-02-01"));
    expect("different customers never share customer-relative predecessors", b === null, b);
  }

  // 6 — materially different logical contexts are separate scopes.
  {
    const repo = new InMemoryAccountMemoryRepo();
    const a = account({ id: "domain:grainger.com" });
    await persistAndLoadMemory(repo, [a], scope("customer-a", "context:sell-automation"), review("r1", "2026-01-01"));
    const different = await persistAndLoadMemory(repo, [a], scope("customer-a", "context:sell-insurance"), review("r2", "2026-02-01"));
    expect("different logical commercial contexts do not inherit Decisions", different === null, different);
  }

  // 7 — two writers with different payloads cannot last-writer-mutate one review.
  {
    const repo = new InMemoryAccountMemoryRepo();
    const s = scope("customer-a", "context:ctx-1"), m = review("r1", "2026-01-01");
    const first = account({ id: "domain:grainger.com", decision: "monitor" });
    const competing = account({ id: "domain:grainger.com", decision: "validate", eventDate: "2026-01-01" });
    await Promise.all([persistAndLoadMemory(repo, [first], s, m), persistAndLoadMemory(repo, [competing], s, m)]);
    expect("concurrent changed payload yields conflict rather than mutation", repo.rows.length === 1 && repo.rows[0].snapshot.decision === "monitor", repo.rows.map(r => r.snapshot.decision));
  }

  // 8 — semantic review time, not insertion order, selects current.
  {
    const older = snapshotAccountReview(account({ id: "domain:grainger.com", decision: "monitor" }), review("older", "2026-01-01"));
    const newer = snapshotAccountReview(account({ id: "domain:grainger.com", decision: "validate", eventDate: "2026-02-01" }), review("newer", "2026-02-01"));
    expect("out-of-order completion retains review with newer semantic review time", orderReviews([newer, older]).current?.reviewId === "newer");
  }

  // 9/10 — Decision is not a promotion ladder.
  {
    const monitor = snapshotAccountReview(account({ id: "domain:grainger.com", decision: "monitor" }), review("r1", "2026-01-01"));
    const validate = snapshotAccountReview(account({ id: "domain:grainger.com", decision: "validate", eventDate: "2026-02-01" }), review("r2", "2026-02-01"));
    expect("Monitor to Validate is a valid material transition", diffAccountCase(monitor, validate).decision.changed && diffAccountCase(monitor, validate).decision.to === "validate");
    const hold = snapshotAccountReview(account({ id: "domain:grainger.com", decision: "hold" }), review("h1", "2025-12-01"));
    expect("Hold to Monitor is a valid material transition", diffAccountCase(hold, monitor).decision.changed && diffAccountCase(hold, monitor).decision.to === "monitor");
  }

  // 11 — structural rejects must not be active Account Memory rows.
  {
    const rejected = account({ id: "domain:not-a-company.example", company: "Industry directory", decision: "hold", structuralReject: true });
    const rows = rowsForReview([rejected], scope("customer-a", "context:ctx-1"), review("r1", "2026-01-01"));
    expect("structural reject is excluded from active Account Memory", rows.length === 0, rows.length);
  }

  // 12 — immutable history remains byte-for-byte stable after a conflicting re-ingest.
  {
    const repo = new InMemoryAccountMemoryRepo();
    const s = scope("customer-a", "context:ctx-1"), m = review("r1", "2026-01-01");
    await persistAndLoadMemory(repo, [account({ id: "domain:grainger.com", decision: "hold" })], s, m);
    const serialized = JSON.stringify(repo.rows[0]);
    await persistAndLoadMemory(repo, [account({ id: "domain:grainger.com", decision: "prioritize", eventDate: "2026-01-01" })], s, m);
    expect("historical snapshot is immutable after conflicting re-ingest", JSON.stringify(repo.rows[0]) === serialized);
  }

  console.log(`\n${passed} contract checks passed, ${failures.length} expected current-model failures`);
  if (failures.length) {
    console.log("\nCurrent model violates the proposed contract:");
    failures.forEach((f, i) => console.log(`${i + 1}. ${f}`));
    process.exitCode = 1;
  }
}

void run();
