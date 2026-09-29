// ─── Durable Customer-Job store (customer-job-v1) ─────────────────────────────
// Persists CustomerJobState so a multi-pass job survives process restart, provider
// throttle, or a failed pass and can RESUME instead of restart (§7/§90). Reuses the
// existing snapshot_reports table with a namespaced payload (no migration), mirroring
// the Lead Hunter run-store pattern. Owner-scoped read (tenant isolation).

import type { CustomerJobState } from "./customer-job";

const TABLE = "snapshot_reports";
const NS = "_customer_job";

export interface CustomerJobStore {
  save: (state: CustomerJobState, userId: string | null) => Promise<void>;
  load: (jobId: string, userId: string | null) => Promise<CustomerJobState | null>;
}

/** Deterministic in-memory store for tests and dry runs. */
export class InMemoryCustomerJobStore implements CustomerJobStore {
  private readonly rows = new Map<string, { userId: string | null; state: CustomerJobState }>();
  async save(state: CustomerJobState, userId: string | null): Promise<void> {
    this.rows.set(state.jobId, { userId, state: structuredClone(state) });
  }
  async load(jobId: string, userId: string | null): Promise<CustomerJobState | null> {
    const row = this.rows.get(jobId);
    if (!row) return null;
    if (row.userId !== null && row.userId !== userId) return null; // owner isolation
    return structuredClone(row.state);
  }
}

interface MinimalDb {
  from: (table: string) => {
    upsert: (row: Record<string, unknown>, opts?: { onConflict?: string }) => Promise<{ error: { message: string; code?: string } | null }>;
    select: (cols: string) => { eq: (col: string, val: unknown) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> } };
  };
}

/** Supabase-backed store: upserts on job_id so each pass persists the latest state. */
export class SupabaseCustomerJobStore implements CustomerJobStore {
  constructor(private readonly db: MinimalDb) {}

  async save(state: CustomerJobState, userId: string | null): Promise<void> {
    // snapshot_reports.status has a CHECK constraint (processing|completed|failed).
    // The real, richer job status lives in the namespaced payload; the column just
    // takes a constraint-valid projection of it.
    const colStatus = state.status === "complete" ? "completed" : state.status === "failed_terminal" ? "failed" : "processing";
    const { error } = await this.db.from(TABLE).upsert(
      {
        job_id: state.jobId,
        user_id: userId,
        plan: "customer_job",
        status: colStatus,
        report_json: { _status: state.status, job_id: state.jobId, kind: "customer_job", [NS]: state },
      },
      { onConflict: "job_id" },
    );
    if (error) throw new Error(`save customer job failed: ${error.message}`);
  }

  async load(jobId: string, userId: string | null): Promise<CustomerJobState | null> {
    const { data, error } = await this.db.from(TABLE).select("job_id, user_id, report_json").eq("job_id", jobId).maybeSingle();
    if (error) throw new Error(`load customer job failed: ${error.message}`);
    if (!data) return null;
    const rowUser = (data.user_id as string | null) ?? null;
    if (rowUser !== null && rowUser !== userId) return null; // owner isolation
    const json = (data.report_json ?? {}) as Record<string, unknown>;
    const state = json[NS] as CustomerJobState | undefined;
    return state ?? null;
  }
}

/** Best-effort read of the most recent customer job (for Admin observability).
 *  Degrades gracefully (returns null) when Supabase / the table is unavailable. */
export async function loadLatestCustomerJob(customer?: string): Promise<CustomerJobState | null> {
  try {
    const { createServerClient } = await import("@/lib/supabase/server");
    const db = createServerClient();
    if (!db) return null;
    const { data, error } = await db.from(TABLE).select("report_json, created_at").eq("plan", "customer_job").order("created_at", { ascending: false }).limit(20);
    if (error || !data) return null;
    const matches = (data as Array<{ report_json?: Record<string, unknown> }>)
      .map((row) => (row.report_json ?? {})[NS] as CustomerJobState | undefined)
      .filter((s): s is CustomerJobState => Boolean(s) && (!customer || s!.customer === customer));
    // Prefer the most recent job that produced an actual qualified shortlist — a
    // pure-discovery growth run (0 qualified) must not shadow the deliverable foundation.
    return matches.find((s) => (s.qualified?.length ?? 0) > 0) ?? matches[0] ?? null;
  } catch { return null; }
}
