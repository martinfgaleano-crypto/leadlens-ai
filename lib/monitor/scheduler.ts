// ─── Recurring scheduler service (bounded automatic execution) ────────────────
//
// Invoked by a trusted server-side trigger (Vercel Cron → authenticated internal
// route) — NEVER by a browser. Finds DUE monitored work across tenants, applies
// technical batch limits, and invokes the SAME `runMonitor` service the manual
// trigger uses (identical intelligence semantics). Failure is isolated per tenant;
// budget-exceeding work stays due; accepted snapshots are idempotent.

import type { AccountMemoryRepo, SnapshotScope } from "@/lib/deliverable/account-memory-store";
import type { Reobserver, MonitorRun } from "./monitor-cycle";
import { runCanonicalMonitor } from "./canonical-monitor-service";
import { buildReviewQueue } from "./monitor-eligibility";
import { DEFAULT_MONITOR_BUDGET, DEFAULT_SCHEDULER_BUDGET, type SchedulerBudget, type MonitorBudget } from "./monitor-config";
import type { TenantWork } from "./monitor-store";
import type { EffectiveEntitlement } from "@/lib/entitlements/entitlements-v1";

export interface ScheduledRunSummary {
  runId: string;
  origin: "scheduled" | "manual";
  startedAt: string;
  completedAt: string;
  durationMs: number;
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
  /** Optional per-tenant recurring-usage enforcement (matrix §5/§6). Resolves the entitlement +
   *  db for a tenant so scheduled reviews meter Account Intelligence Credits. Absent = unmetered. */
  resolveUsageMeter?: (scope: SnapshotScope) => Promise<{ db: unknown; entitlement: EffectiveEntitlement } | undefined>;
}

/**
 * Run one scheduled wake. Deterministic aside from the injected re-observer/repo.
 * Only tenants with at least one DUE account are processed, up to the tenant/account
 * caps; the rest are deferred (still due next wake). Uses stable per-account review
 * ids so a duplicate wake re-upserts the same snapshot (idempotent).
 */
export async function runScheduledMonitor(input: SchedulerInput): Promise<ScheduledRunSummary> {
  const clock = input.now ?? (() => new Date());
  const now = clock();
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
    try {
      const usageMeter = input.resolveUsageMeter ? await input.resolveUsageMeter(tw.scope) : undefined;
      const run = await runCanonicalMonitor(tw, { cycleKey: input.wakeId, origin: "scheduled" }, {
        reobserve: input.reobserve, memoryRepo: input.memoryRepo, now: () => now, budget: perTenant, usageMeter,
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

  const completedAt = clock();
  return {
    runId: `sched_${input.wakeId}`, origin: input.origin ?? "scheduled",
    startedAt, completedAt: completedAt.toISOString(), durationMs: Math.max(0, completedAt.getTime() - now.getTime()),
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
