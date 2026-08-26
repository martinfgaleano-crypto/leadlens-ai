// ─── Recurring scheduler service (bounded automatic execution) ────────────────
//
// Invoked by a trusted server-side trigger (Vercel Cron → authenticated internal
// route) — NEVER by a browser. Finds DUE monitored work across tenants, applies
// technical batch limits, and invokes the SAME `runMonitor` service the manual
// trigger uses (identical intelligence semantics). Failure is isolated per tenant;
// budget-exceeding work stays due; accepted snapshots are idempotent.

import type { AccountMemoryRepo, SnapshotScope } from "@/lib/deliverable/account-memory-store";
import { runMonitor, type Reobserver, type MonitorRun } from "./monitor-cycle";
import { buildReviewQueue } from "./monitor-eligibility";
import { DEFAULT_MONITOR_BUDGET, DEFAULT_SCHEDULER_BUDGET, type SchedulerBudget, type MonitorBudget } from "./monitor-config";
import type { TenantWork } from "./monitor-store";

export interface ScheduledRunSummary {
  runId: string;
  origin: "scheduled" | "manual";
  startedAt: string;
  completedAt: string;
  tenantsConsidered: number;
  tenantsProcessed: number;
  tenantsDeferred: number;
  accountsReviewed: number;
  accountsDeferred: number;
  completedNoChange: number;
  completedChanged: number;
  insufficient: number;
  failed: number;
  tenantErrors: number;
  runs: MonitorRun[];
}

export interface SchedulerInput {
  wakeId: string;
  tenants: TenantWork[];
  reobserve: Reobserver;
  memoryRepo: AccountMemoryRepo;
  origin?: "scheduled" | "manual";
  now?: () => Date;
  budget?: SchedulerBudget;
  accountBudget?: MonitorBudget;
}

/**
 * Run one scheduled wake. Deterministic aside from the injected re-observer/repo.
 * Only tenants with at least one DUE account are processed, up to the tenant/account
 * caps; the rest are deferred (still due next wake). Uses stable per-account review
 * ids so a duplicate wake re-upserts the same snapshot (idempotent).
 */
export async function runScheduledMonitor(input: SchedulerInput): Promise<ScheduledRunSummary> {
  const now = (input.now ?? (() => new Date()))();
  const budget = input.budget ?? DEFAULT_SCHEDULER_BUDGET;
  const accountBudget: MonitorBudget = input.accountBudget ?? DEFAULT_MONITOR_BUDGET;
  const startedAt = now.toISOString();
  const runs: MonitorRun[] = [];

  // Tenants that actually have due work (deterministic eligibility), ordered stably.
  const dueTenants = input.tenants
    .map((tw) => ({ tw, due: buildReviewQueue(tw.states, now, accountBudget, tw.scope).selected.length }))
    .filter((x) => x.due > 0)
    .sort((a, b) => scopeKey(a.tw.scope).localeCompare(scopeKey(b.tw.scope)));

  const processed = dueTenants.slice(0, budget.maxTenantsPerRun);
  const deferredTenants = dueTenants.slice(budget.maxTenantsPerRun);

  let accountsReviewed = 0, accountsBudgetLeft = budget.maxAccountsPerRun, tenantErrors = 0;
  let tenantsDeferredForAccountBudget = 0;

  for (const { tw } of processed) {
    if (accountsBudgetLeft <= 0) { tenantsDeferredForAccountBudget++; continue; }
    // Per-tenant account cap = min(tenant policy, remaining run account budget).
    const perTenant: MonitorBudget = { ...accountBudget, maxAccountsPerRun: Math.min(accountBudget.maxAccountsPerRun, accountsBudgetLeft) };
    const runId = `sched_${input.wakeId}_${scopeKey(tw.scope)}`;
    try {
      const run = await runMonitor({
        runId, scope: tw.scope, states: tw.states, priorById: tw.priorById,
        reobserve: input.reobserve, memoryRepo: input.memoryRepo,
        reviewIdFor: (accountId) => `${input.wakeId}_${scopeKey(tw.scope)}_${accountId}`, // stable → idempotent
        now: () => now, budget: perTenant,
      });
      runs.push(run);
      accountsReviewed += run.observability.attempted;
      accountsBudgetLeft -= run.observability.attempted;
    } catch { tenantErrors++; }
  }

  const agg = runs.reduce((a, r) => ({
    accountsDeferred: a.accountsDeferred + r.observability.accountsDeferred,
    completedNoChange: a.completedNoChange + r.observability.completedNoChange,
    completedChanged: a.completedChanged + r.observability.completedChanged,
    insufficient: a.insufficient + r.observability.insufficient,
    failed: a.failed + r.observability.failed,
  }), { accountsDeferred: 0, completedNoChange: 0, completedChanged: 0, insufficient: 0, failed: 0 });

  return {
    runId: `sched_${input.wakeId}`, origin: input.origin ?? "scheduled",
    startedAt, completedAt: new Date().toISOString(),
    tenantsConsidered: input.tenants.length,
    tenantsProcessed: runs.length,
    tenantsDeferred: deferredTenants.length + tenantsDeferredForAccountBudget,
    accountsReviewed,
    accountsDeferred: agg.accountsDeferred,
    completedNoChange: agg.completedNoChange, completedChanged: agg.completedChanged,
    insufficient: agg.insufficient, failed: agg.failed, tenantErrors,
    runs,
  };
}

function scopeKey(scope: SnapshotScope): string { return `${scope.ownerUserId ?? "anon"}:${scope.clientKey}`; }
