// Stale intelligence-run recovery (Product Operability V1).
//
// A customer Intelligence run is dispatched to a serverless executor that claims it
// (status="processing", execution_generation advanced) and fences every authoritative
// write on that generation. If that executor DIES mid-run (crash, serverless timeout,
// lost invocation), the row is left in "processing" with no live worker. executeIntelligence
// Run already reclaims such a run when re-invoked (its own >15min stale check flips the
// claim to forceProcessing, advancing the generation and fencing the dead worker). What was
// missing is a server-owned OWNER that periodically finds these stranded runs and re-dispatches
// them — with a bounded number of reclaim attempts so a genuinely poison run reaches a safe
// terminal "failed" instead of looping forever.
//
// This module is pure policy + an injectable orchestrator. It introduces NO new execution
// semantics and NO new state: staleness is measured from the run's last authoritative write
// (updatedAt, falling back to createdAt), the reclaim reuses the existing execution_generation
// CAS, and the poison bound reuses execution_generation as the reclaim counter.

export const STALE_PROCESSING_MS = 15 * 60_000; // a live executor writes far more often than this

/** The single source of truth for "how long a processing run may go without an authoritative
 *  write before it is presumed dead". Used by BOTH the executor's own reclaim gate and the
 *  recovery owner, so they never disagree. `INTELLIGENCE_STALE_MS` overrides it (test-time only;
 *  never set in production) so recovery can be exercised without a 15-minute wait. */
export function staleThresholdMs(): number {
  const o = Number(process.env.INTELLIGENCE_STALE_MS);
  return Number.isFinite(o) && o > 0 ? o : STALE_PROCESSING_MS;
}
/** After this many reclaims a still-stuck run is failed terminally rather than re-dispatched
 *  (poison-job protection). execution_generation increments once per claim; the initial
 *  dispatch is gen 1, so a genuine dead-worker reclaim reaches 2..N. */
export const MAX_RECOVERY_GENERATION = 6;

export interface StaleRunCandidate {
  runId: string;
  userId: string;
  status: "queued" | "processing" | "completed" | "failed" | string;
  createdAt: string;
  updatedAt: string | null;
  executionGeneration: number;
}

export type RecoveryAction = "redispatch" | "terminal_fail" | "skip";

const lastWrite = (c: StaleRunCandidate): number => new Date(c.updatedAt ?? c.createdAt).getTime();

/** A processing run whose last authoritative write is older than the stale window has no live
 *  executor (executors save far more often than every 15 minutes and complete in minutes). */
export function isStaleProcessing(c: StaleRunCandidate, now: number, staleMs = staleThresholdMs()): boolean {
  return c.status === "processing" && now - lastWrite(c) > staleMs;
}

/** Decide what to do with one candidate. Only stale processing runs are actioned:
 *  re-dispatch until the reclaim bound, then fail terminally. Completed/failed/fresh → skip. */
export function classifyRecovery(
  c: StaleRunCandidate,
  now: number,
  opts: { staleMs?: number; maxGeneration?: number } = {},
): RecoveryAction {
  if (!isStaleProcessing(c, now, opts.staleMs ?? staleThresholdMs())) return "skip";
  return (c.executionGeneration ?? 0) >= (opts.maxGeneration ?? MAX_RECOVERY_GENERATION) ? "terminal_fail" : "redispatch";
}

export interface RecoveryPlanItem { candidate: StaleRunCandidate; action: Exclude<RecoveryAction, "skip"> }

/** Pure: map candidates → the runs to act on (redispatch or terminal_fail), skipping the rest. */
export function planRecoveries(candidates: StaleRunCandidate[], now: number, opts: { staleMs?: number; maxGeneration?: number } = {}): RecoveryPlanItem[] {
  const out: RecoveryPlanItem[] = [];
  for (const candidate of candidates) {
    const action = classifyRecovery(candidate, now, opts);
    if (action !== "skip") out.push({ candidate, action: action as Exclude<RecoveryAction, "skip"> });
  }
  return out;
}

export interface RecoverDeps {
  /** All candidate runs currently in a non-terminal state (queued/processing). */
  listRecoverable: () => Promise<StaleRunCandidate[]>;
  /** Re-dispatch the processor for a run (the same wake-up initial dispatch uses). The processor
   *  reclaims the stale run via its own generation CAS; a still-live executor is not stolen. */
  redispatch: (runId: string, userId: string) => Promise<void>;
  /** Atomically mark a run terminally failed (fenced on its current generation). Returns whether
   *  the write landed (a concurrent reclaim/complete makes it a safe no-op). */
  failTerminal: (candidate: StaleRunCandidate, reason: string) => Promise<boolean>;
  now?: () => number;
  staleMs?: number;
  maxGeneration?: number;
  /** Cap how many runs one wake recovers, so a large backlog is drained across wakes. */
  maxPerWake?: number;
}

export interface RecoverySummary { considered: number; redispatched: number; failedTerminal: number; skipped: number; errors: number }

/** Orchestrate one recovery wake. Idempotent + race-safe by construction: re-dispatch relies on
 *  the executor's generation CAS (two wakes → one reclaim), and terminal_fail is a fenced write. */
export async function recoverStaleRuns(deps: RecoverDeps): Promise<RecoverySummary> {
  const now = (deps.now ?? Date.now)();
  const all = await deps.listRecoverable();
  const plan = planRecoveries(all, now, { staleMs: deps.staleMs, maxGeneration: deps.maxGeneration }).slice(0, deps.maxPerWake ?? 25);
  let redispatched = 0, failedTerminal = 0, errors = 0;
  for (const { candidate, action } of plan) {
    try {
      if (action === "redispatch") { await deps.redispatch(candidate.runId, candidate.userId); redispatched++; }
      else { if (await deps.failTerminal(candidate, "recovery_reclaim_exhausted")) failedTerminal++; }
    } catch { errors++; }
  }
  return { considered: all.length, redispatched, failedTerminal, skipped: all.length - plan.length, errors };
}
