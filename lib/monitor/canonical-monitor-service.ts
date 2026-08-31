import { createHash } from "node:crypto";
import type { AccountMemoryRepo, SnapshotScope } from "@/lib/deliverable/account-memory-store";
import { SupabaseAccountMemoryRepo } from "@/lib/deliverable/account-memory-store";
import type { AccountReviewSnapshot } from "@/lib/deliverable/account-memory";
import type { MonitoredAccountState } from "./monitor-eligibility";
import { runMonitor, type MonitorRun, type Reobserver } from "./monitor-cycle";
import type { MonitorBudget } from "./monitor-config";
import { defaultReobserver, loadCurrentSnapshots, persistMonitorRun } from "./monitor-store";

export type MonitorExecutionOrigin = "customer" | "dashboard" | "scheduled";

export function monitorRunId(scope: SnapshotScope, cycleKey: string): string {
  const stable = `${scope.ownerUserId ?? "system"}|${scope.clientKey}|${cycleKey}`;
  return `mon_${createHash("sha256").update(stable).digest("hex").slice(0, 32)}`;
}

export interface CanonicalMonitorWork {
  scope: SnapshotScope;
  states: MonitoredAccountState[];
  priorById: Record<string, AccountReviewSnapshot>;
}

export interface CanonicalMonitorDeps {
  reobserve: Reobserver;
  memoryRepo: AccountMemoryRepo;
  persistRun?: (run: MonitorRun) => Promise<unknown>;
  now?: () => Date;
  budget?: MonitorBudget;
}

/** Single Monitor intelligence service used by customer, dashboard and cron. */
export async function runCanonicalMonitor(
  work: CanonicalMonitorWork,
  meta: { cycleKey: string; origin: MonitorExecutionOrigin },
  deps: CanonicalMonitorDeps,
): Promise<MonitorRun> {
  const runId = monitorRunId(work.scope, meta.cycleKey);
  const run = await runMonitor({
    runId,
    scope: work.scope,
    states: work.states,
    priorById: work.priorById,
    reobserve: deps.reobserve,
    memoryRepo: deps.memoryRepo,
    reviewIdFor: (accountId) => `${runId}_${createHash("sha256").update(accountId).digest("hex").slice(0, 12)}`,
    now: deps.now,
    budget: deps.budget,
  });
  if (deps.persistRun) await deps.persistRun(run);
  return run;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeCanonicalMonitor(db: any, input: {
  scope: SnapshotScope;
  cycleKey: string;
  origin: Exclude<MonitorExecutionOrigin, "scheduled">;
}): Promise<{ ok: true; run: MonitorRun } | { ok: false; reason: "no_monitored_accounts" }> {
  const work = await loadCurrentSnapshots(db, input.scope);
  if (work.states.length === 0) return { ok: false, reason: "no_monitored_accounts" };
  // An authenticated customer/dashboard action is the explicit safe trigger.
  // Merely storing a textual revisit condition never makes an account instantly due.
  const states = work.states.map((state) => ({ ...state, refreshRequested: true }));
  const run = await runCanonicalMonitor({ ...work, states, scope: input.scope }, { cycleKey: input.cycleKey, origin: input.origin }, {
    reobserve: defaultReobserver,
    memoryRepo: new SupabaseAccountMemoryRepo(db),
    persistRun: (result) => persistMonitorRun(db, result),
  });
  return { ok: true, run };
}
