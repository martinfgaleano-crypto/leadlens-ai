// Monitor Recurring Usage Enforcement — the scheduled/manual Monitor path meters Account
// Intelligence Credits under the frozen commercial unit (1 material re-analysis = 1 credit).
// Deterministic: real runMonitor + a modeled usage gate + a fake reobserver (no provider cost).
// The ledger's own CAS/idempotency/concurrency is live-proven in accept-account-metering; here we
// prove runMonitor honors the gate — production cap (no wasted research) + charge-gated persistence.

import { runMonitor, type MonitorUsageGate, type Reobserver } from "../../lib/monitor/monitor-cycle";
import type { AccountObservation, MonitorReviewPlan } from "../../lib/monitor/delta-research";
import { monitoredStateFromSnapshot } from "../../lib/monitor/monitor-eligibility";
import { InMemoryAccountMemoryRepo } from "../../lib/deliverable/account-memory-store";
import type { AccountReviewSnapshot } from "../../lib/deliverable/account-memory";
import { DEFAULT_MONITOR_BUDGET } from "../../lib/monitor/monitor-config";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

const NOW = new Date("2026-09-02T12:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400e3).toISOString();
const scope = { ownerUserId: "A", clientKey: "ca" };

const snap = (accountId: string): AccountReviewSnapshot => ({
  reviewId: `r_${accountId}`, reviewedAt: daysAgo(40), contextVersion: "ctx", accountId, decision: "monitor",
  fit: "Moderate", timing: "Limited", evidence: "Moderate",
  accountIdentity: { stableAccountKey: accountId, canonicalName: `Co ${accountId}`, domain: `${accountId}.example`, aliases: [], country: "US", organizationType: "private_company", confidence: "verified", fromUniverse: true, lineage: "candidate_universe" },
  changeKeys: [], hasVerifiedChange: false, evidenceOrigins: ["reuters.com"], independentSupport: false,
  counterCount: 0, hasMaterialCounter: false, validationThemeKeys: [], decisionCriticalThemeKeys: [], hasRevisitTrigger: false, revisitTrigger: null, monitorReason: null,
});

// Fake reobserver: a sufficient, no-change observation → an ACCEPTED (materialized) review. Counts calls.
let researchCalls = 0;
const noChange: Reobserver = async (plan) => { researchCalls++; return { accountId: plan.accountId, items: [], providersAvailable: ["brave", "tavily"], providersFailed: [], routesAttempted: 2, operatingMode: "full" } as AccountObservation; };

// A modeled ledger gate: allowance for the cap, a separate claim-allowance, and per-account charge
// idempotency (charged set). claim() consumes at most `claimAllowance`; a repeat for an already-
// charged account is a 0-cost yes (idempotent).
function gate(opts: { capRemaining: number | null; claimAllowance: number }): MonitorUsageGate & { consumed: number } {
  const charged = new Set<string>();
  const g = {
    consumed: 0,
    remaining: async () => opts.capRemaining,
    claim: async (accountId: string) => {
      if (charged.has(accountId)) return true;           // idempotent: already charged this review
      if (g.consumed >= opts.claimAllowance) return false; // exhausted
      g.consumed++; charged.add(accountId); return true;
    },
  };
  return g;
}

const runOne = (accountIds: string[], usageGate: MonitorUsageGate | undefined, repo: InMemoryAccountMemoryRepo, runId = "mon_run") =>
  runMonitor({
    runId, scope, states: accountIds.map((id) => monitoredStateFromSnapshot(snap(id), scope)),
    priorById: Object.fromEntries(accountIds.map((id) => [id, snap(id)])),
    reobserve: noChange, memoryRepo: repo, reviewIdFor: (id) => `${runId}_${id}`, now: () => NOW, budget: DEFAULT_MONITOR_BUDGET, usageGate,
  });

async function run() {
  // ── Q1 — successful scheduled Review #2 → exactly 1 credit ──
  { researchCalls = 0; const repo = new InMemoryAccountMemoryRepo(); const g = gate({ capRemaining: 5, claimAllowance: 5 });
    const r = await runOne(["acme"], g, repo);
    t("Q1 review materialized + persisted", repo.rows.length === 1 && r.observability.attempted === 1);
    t("Q1 exactly 1 credit charged", g.consumed === 1);
    t("Q1 research ran once", researchCalls === 1);
  }

  // ── Q2 — exhausted usage → no material research → 0 charge ──
  { researchCalls = 0; const repo = new InMemoryAccountMemoryRepo(); const g = gate({ capRemaining: 0, claimAllowance: 0 });
    const r = await runOne(["acme"], g, repo);
    t("Q2 exhausted → account deferred_due_to_usage", r.outcomes.some((o) => o.status === "deferred_due_to_usage"));
    t("Q2 no material research performed", researchCalls === 0);
    t("Q2 nothing persisted, 0 charge", repo.rows.length === 0 && g.consumed === 0);
  }

  // ── Q3 — duplicate / retry of same logical review → exactly 1 eventual charge ──
  { researchCalls = 0; const repo = new InMemoryAccountMemoryRepo(); const g = gate({ capRemaining: 5, claimAllowance: 5 });
    await runOne(["acme"], g, repo, "mon_dup");
    await runOne(["acme"], g, repo, "mon_dup");   // same runId → idempotent
    t("Q3 duplicate review → one snapshot (idempotent persist)", repo.rows.length === 1);
    t("Q3 duplicate review → exactly one credit", g.consumed === 1);
  }

  // ── Q4 — concurrency with one remaining credit → at most one materialization crosses ──
  // Cap allows researching both (simulating two reviews that each saw a free slot), but the
  // CAS-bounded claim admits only one — the loser is deferred_due_to_usage and NOT persisted.
  { researchCalls = 0; const repo = new InMemoryAccountMemoryRepo(); const g = gate({ capRemaining: 2, claimAllowance: 1 });
    const r = await runOne(["acme", "beta"], g, repo);
    t("Q4 both researched but only one charged", g.consumed === 1);
    t("Q4 at most one materialization crosses capacity", repo.rows.length === 1);
    t("Q4 the loser is deferred_due_to_usage (not failed, not persisted)", r.outcomes.filter((o) => o.status === "deferred_due_to_usage").length === 1);
  }

  // ── Regression: no gate → unmetered (current behavior, all materialized) ──
  { researchCalls = 0; const repo = new InMemoryAccountMemoryRepo();
    const r = await runOne(["acme", "beta"], undefined, repo);
    t("unmetered (no gate) → both persisted, attempted=selected", repo.rows.length === 2 && r.observability.attempted === 2);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
run().catch((e) => { console.error(e); process.exit(1); });
