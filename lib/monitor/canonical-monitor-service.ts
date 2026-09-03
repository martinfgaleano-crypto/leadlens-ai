import { createHash } from "node:crypto";
import type { AccountMemoryRepo, SnapshotScope } from "@/lib/deliverable/account-memory-store";
import { SupabaseAccountMemoryRepo } from "@/lib/deliverable/account-memory-store";
import type { AccountReviewSnapshot } from "@/lib/deliverable/account-memory";
import type { MonitoredAccountState } from "./monitor-eligibility";
import { runMonitor, type MonitorRun, type Reobserver } from "./monitor-cycle";
import type { MonitorBudget } from "./monitor-config";
import { defaultReobserver, loadCurrentSnapshots, persistMonitorRun } from "./monitor-store";
import { monitorUsageGate } from "@/lib/billing/account-metering";
import type { EffectiveEntitlement } from "@/lib/entitlements/entitlements-v1";

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
  /** Optional recurring-usage enforcement (matrix §5/§6). When present, the monitor meters one
   *  Account Intelligence Credit per materialized account keyed on this cycle's runId. Absent =
   *  unmetered (current behavior). */
  usageMeter?: { db: unknown; entitlement: EffectiveEntitlement };
}

/** Single Monitor intelligence service used by customer, dashboard and cron. */
export async function runCanonicalMonitor(
  work: CanonicalMonitorWork,
  meta: { cycleKey: string; origin: MonitorExecutionOrigin },
  deps: CanonicalMonitorDeps,
): Promise<MonitorRun> {
  const runId = monitorRunId(work.scope, meta.cycleKey);
  // Build the usage gate only when metering is requested — do NOT sample deps.now() otherwise
  // (some callers pass a counting clock and rely on the exact number of ticks).
  const usageGate = deps.usageMeter
    ? monitorUsageGate(deps.usageMeter.db, deps.usageMeter.entitlement, runId, (deps.now ?? (() => new Date()))().getTime())
    : undefined;
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
    usageGate,
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
  // Manual reviews meter usage under the same commercial contract (best-effort resolve).
  const { resolveEntitlements } = await import("@/lib/entitlements/entitlements-v1");
  const entitlement = input.scope.ownerUserId ? await resolveEntitlements(db, input.scope.ownerUserId).catch(() => null) : null;
  const run = await runCanonicalMonitor({ ...work, states, scope: input.scope }, { cycleKey: input.cycleKey, origin: input.origin }, {
    reobserve: defaultReobserver,
    memoryRepo: new SupabaseAccountMemoryRepo(db),
    persistRun: (result) => persistMonitorRun(db, result),
    usageMeter: entitlement ? { db, entitlement } : undefined,
  });
  return { ok: true, run };
}
