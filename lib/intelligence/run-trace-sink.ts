// Run-trace persistence sink (LIVE EXECUTION TRACE V1 §4/§5/§23).
//
// The narrowest durable path for per-account runtime traces. It is:
//  - idempotent by (run_id, account_id) — the same execution never double-persists;
//  - append-only / immutable (a historical observation is never mutated);
//  - failure-isolated — persist() NEVER throws; a telemetry failure returns an error
//    result and can never fail the customer Intelligence run (§5);
//  - safe — it stores only the IntelligenceRunTrace, which already carries no secrets,
//    no raw source body, no prompts/completions, and no customer prose (queries are
//    category+hash; context is a safe reference).

import type { IntelligenceRunTrace } from "@/lib/intelligence/run-trace";

export interface RunTracePersistResult {
  persisted: boolean;
  duplicate: boolean;
  error: string | null;
}

export interface RunTraceSink {
  persist(trace: IntelligenceRunTrace): Promise<RunTracePersistResult>;
  load(runId: string): Promise<IntelligenceRunTrace[]>;
}

/** Stable persistence identity — one row per (run, account). */
export function runTraceKey(trace: Pick<IntelligenceRunTrace, "run_id" | "account_id">): string {
  return `${trace.run_id}::${trace.account_id}`;
}

/** In-memory sink for controlled tests and the route-acceptance harness. */
export class InMemoryRunTraceSink implements RunTraceSink {
  private readonly rows = new Map<string, IntelligenceRunTrace>();
  private failNext = false;
  /** Test hook: force the next persist() to fail, to prove failure isolation (§5). */
  failNextPersist(): void { this.failNext = true; }

  async persist(trace: IntelligenceRunTrace): Promise<RunTracePersistResult> {
    if (this.failNext) { this.failNext = false; return { persisted: false, duplicate: false, error: "forced_sink_failure" }; }
    const key = runTraceKey(trace);
    if (this.rows.has(key)) return { persisted: false, duplicate: true, error: null };
    this.rows.set(key, structuredClone(trace));
    return { persisted: true, duplicate: false, error: null };
  }
  async load(runId: string): Promise<IntelligenceRunTrace[]> {
    return Array.from(this.rows.values()).filter((t) => t.run_id === runId).map((t) => structuredClone(t));
  }
  all(): IntelligenceRunTrace[] { return Array.from(this.rows.values()).map((t) => structuredClone(t)); }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
// Durable sink backed by the intelligence_run_traces table (migration 056, founder-
// applied). Every method is failure-isolated: a missing table / RLS denial / network
// error surfaces as an error RESULT, never a throw.
export class SupabaseRunTraceSink implements RunTraceSink {
  constructor(private readonly db: any) {}

  async persist(trace: IntelligenceRunTrace): Promise<RunTracePersistResult> {
    try {
      const { error } = await this.db.from("intelligence_run_traces").insert({
        trace_key: runTraceKey(trace),
        run_id: trace.run_id,
        account_id: trace.account_id,
        provenance: trace.provenance,
        observed_at: trace.completed_at,
        trace_json: trace,
      });
      if (error) {
        if (error.code === "23505" || /duplicate key|already exists/i.test(error.message ?? "")) return { persisted: false, duplicate: true, error: null };
        return { persisted: false, duplicate: false, error: error.message ?? "persist_failed" };
      }
      return { persisted: true, duplicate: false, error: null };
    } catch (e) {
      return { persisted: false, duplicate: false, error: e instanceof Error ? e.message : "persist_threw" };
    }
  }

  async load(runId: string): Promise<IntelligenceRunTrace[]> {
    try {
      const { data, error } = await this.db.from("intelligence_run_traces").select("trace_json").eq("run_id", runId);
      if (error || !Array.isArray(data)) return [];
      return data.map((row: { trace_json: IntelligenceRunTrace }) => row.trace_json).filter(Boolean);
    } catch { return []; }
  }
}
