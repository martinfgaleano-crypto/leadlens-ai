// Account Memory persistence V1.1 — store + predecessor + isolation contract.
// Exercises the SAME pure logic production uses, via the in-memory repo (§50).
import { InMemoryAccountMemoryRepo, rowsForReview, selectPredecessor, persistAndLoadMemory, type SnapshotScope, type AccountMemoryRepo, type ReviewSnapshotRow } from "../../lib/deliverable/account-memory-store";
import { diffAccountCase } from "../../lib/deliverable/account-memory";
import type { AccountBriefVM } from "../../lib/deliverable/deliverable-view-model";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean) => { (ok ? passed++ : failed++); console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };

const acct = (o: Partial<AccountBriefVM> & { id: string }): AccountBriefVM => ({
  id: o.id, rank: null, company: o.company ?? o.id, segment: null, geography: null, domain: null,
  accountRole: "Potential Customer", opportunityType: "Capacity Expansion", decision: o.decision ?? "monitor",
  decisionNote: null, thesis: null, whyItMatters: null,
  dimensions: o.dimensions ?? [{ label: "Fit", value: "Strong" }, { label: "Timing", value: "Limited" }, { label: "Evidence", value: "Limited" }],
  whatChanged: o.whatChanged ?? [{ event: "none", date: null, age: null, source: null, kind: "unknown" }],
  evidence: o.evidence ?? { sourceCount: 0, datedCount: 0, corroborated: null, latestAge: null, strength: "Limited" },
  sources: o.sources ?? [], counterSignals: [], limitations: [], validations: o.validations ?? [], validationDetails: o.validationDetails,
  nextStep: null, revisitWhen: o.revisitWhen ?? null, freshness: null, confidence: null,
});
const scope = (owner: string | null, client = "asteron"): SnapshotScope => ({ ownerUserId: owner, clientKey: client });
const meta = (id: string, at: string, ctx = "v1") => ({ reviewId: id, reviewedAt: at, contextVersion: ctx });

// Case states for the same account across reviews
const saiaMonitor = () => acct({ id: "saia", decision: "monitor", revisitWhen: "new terminal", validations: ["Confirm systems / vendor"], validationDetails: [{ question: "Confirm systems / vendor", decisionCritical: true, howToValidate: null, changesDecisionBecause: null }] });
const saiaPrioritize = () => acct({ id: "saia", decision: "prioritize", dimensions: [{ label: "Fit", value: "Strong" }, { label: "Timing", value: "Strong" }, { label: "Evidence", value: "Strong" }], whatChanged: [{ event: "Opened new terminal", date: "2026-06-20", age: "2mo", source: "x", kind: "true_change" }], evidence: { sourceCount: 2, datedCount: 1, corroborated: true, latestAge: "2mo", strength: "Strong" }, sources: [{ label: "freightwaves.com", url: null, date: "2026-06-22", age: "2mo", relation: "direct", claim: null }, { label: "ttnews.com", url: null, date: "2026-06-25", age: "2mo", relation: "corroborating", claim: null }], revisitWhen: "new terminal", validations: ["Confirm systems / vendor"], validationDetails: [{ question: "Confirm systems / vendor", decisionCritical: true, howToValidate: null, changesDecisionBecause: null }] });
const saiaValidate = () => acct({ id: "saia", decision: "validate", dimensions: [{ label: "Fit", value: "Strong" }, { label: "Timing", value: "Strong" }, { label: "Evidence", value: "Strong" }], whatChanged: [{ event: "Opened new terminal", date: "2026-06-20", age: "5mo", source: "x", kind: "true_change" }], evidence: { sourceCount: 3, datedCount: 1, corroborated: true, latestAge: "1mo", strength: "Strong" }, sources: [{ label: "freightwaves.com", url: null, date: "2026-06-22", age: "5mo", relation: "direct", claim: null }, { label: "ttnews.com", url: null, date: "2026-06-25", age: "5mo", relation: "corroborating", claim: null }], validations: [] });

(async () => {
  const owner = "user-A";
  // §100 T1 → no predecessor
  {
    const repo = new InMemoryAccountMemoryRepo();
    const m = await persistAndLoadMemory(repo, [saiaMonitor()], scope(owner), meta("r1", "2026-03-01"));
    t("§100 T1 stored, no predecessor ⇒ null memory", m === null && repo.rows.length === 1);
  }
  // §101 T2 → predecessor = T1
  const repo = new InMemoryAccountMemoryRepo();
  await persistAndLoadMemory(repo, [saiaMonitor()], scope(owner), meta("r1", "2026-03-01"));
  const m2 = await persistAndLoadMemory(repo, [saiaPrioritize()], scope(owner), meta("r2", "2026-06-28"));
  t("§101 T2 predecessor is T1 (decision monitor→prioritize)", !!m2 && m2.previousById["saia"]?.decision === "monitor");
  {
    const diff = diffAccountCase(m2!.previousById["saia"], (await import("../../lib/deliverable/account-memory")).snapshotAccountReview(saiaPrioritize(), meta("r2", "2026-06-28")));
    t("§101 T1→T2 diff detects decision change + new change", diff.decision.changed && diff.newChangeKeys.length === 1);
  }
  // §102 T3 → predecessor = T2 (NOT T1)
  const m3 = await persistAndLoadMemory(repo, [saiaValidate()], scope(owner), meta("r3", "2026-10-01"));
  t("§102 T3 predecessor is T2, not T1 (prioritize, has verified change)", !!m3 && m3.previousById["saia"]?.decision === "prioritize" && m3.previousById["saia"]?.hasVerifiedChange === true);
  t("§40 T3 predecessor reviewId is r2", selectPredecessor(repo.rows, scope(owner), "saia", { reviewId: "r3", reviewedAt: "2026-10-01" })?.reviewId === "r2");

  // §103/§24/§91 duplicate T2 (re-view / retry) ⇒ no duplicate row
  await persistAndLoadMemory(repo, [saiaPrioritize()], scope(owner), meta("r2", "2026-06-28"));
  t("§103 duplicate review re-ingest ⇒ no duplicate row (idempotent)", repo.rows.filter((r) => r.reviewId === "r2" && r.accountId === "saia").length === 1);

  // §104/§22 out-of-order: an older T0 completes AFTER T3 — current lineage unaffected
  await persistAndLoadMemory(repo, [saiaMonitor()], scope(owner), meta("r0", "2026-01-01"));
  t("§104 out-of-order T0 insert ⇒ T3 predecessor still r2", selectPredecessor(repo.rows, scope(owner), "saia", { reviewId: "r3", reviewedAt: "2026-10-01" })?.reviewId === "r2");
  t("§104 out-of-order T0 ⇒ T2 predecessor is r0 now (correct earlier neighbour)", selectPredecessor(repo.rows, scope(owner), "saia", { reviewId: "r2", reviewedAt: "2026-06-28" })?.reviewId === "r1");

  // §105 failed review never persisted ⇒ never a predecessor (only completed reviews call persist)
  {
    const r = new InMemoryAccountMemoryRepo();
    await persistAndLoadMemory(r, [saiaMonitor()], scope(owner), meta("r1", "2026-03-01"));
    // r2 "failed" ⇒ caller does NOT persist it; only a later completed r3 persists
    const mm = await persistAndLoadMemory(r, [saiaValidate()], scope(owner), meta("r3", "2026-10-01"));
    t("§105 failed (unpersisted) review absent ⇒ predecessor is last completed (monitor)", mm?.previousById["saia"]?.decision === "monitor");
    t("§13 only 2 rows exist (failed r2 never stored)", r.rows.length === 2);
  }

  // §106/§96 cross-client isolation: different owner cannot see A's history
  {
    const r = new InMemoryAccountMemoryRepo();
    await persistAndLoadMemory(r, [saiaMonitor()], scope("user-A"), meta("r1", "2026-03-01"));
    const other = await persistAndLoadMemory(r, [saiaPrioritize()], scope("user-B"), meta("r2", "2026-06-28"));
    t("§106 owner B sees no predecessor from owner A", other === null);
    const otherClient = await persistAndLoadMemory(r, [saiaPrioritize()], scope("user-A", "different-client"), meta("r2c", "2026-06-28"));
    t("§106 different clientKey (same owner) sees no predecessor", otherClient === null);
  }

  // §107/§17 context change: predecessor still found, diff marks client_objective_changed
  {
    const r = new InMemoryAccountMemoryRepo();
    await persistAndLoadMemory(r, [saiaPrioritize()], scope(owner), meta("r1", "2026-03-01", "v1"));
    const mc = await persistAndLoadMemory(r, [saiaPrioritize()], scope(owner), meta("r2", "2026-06-28", "v2"));
    const diff = diffAccountCase(mc!.previousById["saia"], (await import("../../lib/deliverable/account-memory")).snapshotAccountReview(saiaPrioritize(), meta("r2", "2026-06-28", "v2")));
    t("§107 context change loads predecessor + flags client_objective_changed", diff.contextChanged && diff.decision.drivers.includes("client_objective_changed"));
  }

  // §109/§35-36 batch: many accounts, single load returns per-account predecessors
  {
    const r = new InMemoryAccountMemoryRepo();
    const many1 = Array.from({ length: 50 }, (_, i) => acct({ id: `acc${i}`, decision: "monitor" }));
    const many2 = Array.from({ length: 50 }, (_, i) => acct({ id: `acc${i}`, decision: i < 10 ? "prioritize" : "monitor" }));
    await persistAndLoadMemory(r, many1, scope(owner), meta("b1", "2026-03-01"));
    const mb = await persistAndLoadMemory(r, many2, scope(owner), meta("b2", "2026-06-01"));
    t("§109 batch: 50 accounts each get a predecessor", mb !== null && Object.keys(mb.previousById).length === 50);
    t("§110 50-account store holds 100 rows (2 reviews)", r.rows.length === 100);
  }

  // §108/§51 storage unavailable ⇒ fail closed to null (no throw)
  {
    const brokenRepo: AccountMemoryRepo = { persist: async () => { throw new Error("db down"); }, loadPredecessors: async () => ({}) };
    const flags = { logged: false };
    const m = await persistAndLoadMemory(brokenRepo, [saiaPrioritize()], scope(owner), meta("r2", "2026-06-28"), () => { flags.logged = true; });
    t("§108/§51 storage failure ⇒ null memory (fail closed), logged", m === null && flags.logged);
  }

  // §16/§18 rows carry canonical account identity + scope (not display name only)
  {
    const rows: ReviewSnapshotRow[] = rowsForReview([saiaPrioritize()], scope(owner), meta("r2", "2026-06-28"));
    t("§18 row keyed by canonical accountId + owner + client", rows[0].accountId === "saia" && rows[0].ownerUserId === "user-A" && rows[0].clientKey === "asteron");
    t("§8 row snapshot is canonical (no HTML/prose fields)", !("html" in rows[0].snapshot) && typeof rows[0].snapshot.decision === "string");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
})();
