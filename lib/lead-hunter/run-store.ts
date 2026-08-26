// ─── Lead Hunter run store — durable, immutable candidate-universe snapshots ───
//
// Persists a completed CandidateAccountUniverse on the EXISTING snapshot_reports
// rows (no new table — same convention as vault-generation-store): job_id = the
// deterministic Lead Hunter runId, report_json carries a namespaced
// `_lead_hunter_universe` payload, status mirrors the run outcome. Rows are
// immutable by convention: a run is inserted once; a NEW discovery cycle uses a
// new runId → a new row. We never rewrite a persisted universe.
//
// Owner isolation: user_id is stamped on the row and every read is user-scoped.
// The runId is derived from an owner-isolated confirmed context, so a user can
// only ever address a universe for a context they own.

import type { CandidateAccountUniverse } from "./candidate-universe";

const NS = "_lead_hunter_universe" as const;

export interface LeadHunterRunRecord {
  runId: string;
  userId: string | null;
  status: "completed" | "failed";
  contextRef: { contextId: string; version: number };
  universe: CandidateAccountUniverse;
  createdAt: string;
}

export interface LeadHunterRunStore {
  /** Insert a run snapshot. Returns { created:false } when a row already exists
   *  for this runId (idempotent — never a duplicate, never a rewrite). */
  persist(record: LeadHunterRunRecord): Promise<{ created: boolean }>;
  /** Owner-scoped load by runId. Returns null when absent or not owned. */
  load(runId: string, userId: string | null): Promise<LeadHunterRunRecord | null>;
}

// ─── In-memory store (tests) ──────────────────────────────────────────────────

export class InMemoryLeadHunterRunStore implements LeadHunterRunStore {
  private rows = new Map<string, LeadHunterRunRecord>();

  async persist(record: LeadHunterRunRecord): Promise<{ created: boolean }> {
    if (this.rows.has(record.runId)) return { created: false };
    this.rows.set(record.runId, structuredClone(record));
    return { created: true };
  }

  async load(runId: string, userId: string | null): Promise<LeadHunterRunRecord | null> {
    const r = this.rows.get(runId);
    if (!r) return null;
    if (r.userId !== null && r.userId !== userId) return null; // owner isolation
    return structuredClone(r);
  }
}

// ─── Supabase-backed store (reuses snapshot_reports) ──────────────────────────

interface MinimalDb {
  from(table: string): {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string; code?: string } | null }>;
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      };
    };
  };
}

const TABLE = "snapshot_reports";

export class SupabaseLeadHunterRunStore implements LeadHunterRunStore {
  constructor(private readonly db: MinimalDb) {}

  async persist(record: LeadHunterRunRecord): Promise<{ created: boolean }> {
    const { error } = await this.db.from(TABLE).insert({
      job_id: record.runId,
      user_id: record.userId,
      plan: "lead_hunter",
      status: record.status,
      report_json: {
        _status: record.status,
        job_id: record.runId,
        kind: "lead_hunter_universe",
        [NS]: { contextRef: record.contextRef, universe: record.universe, createdAt: record.createdAt },
      },
    });
    if (error) {
      // Unique violation on job_id → already persisted (idempotent).
      if (error.code === "23505" || /duplicate key|already exists/i.test(error.message)) return { created: false };
      throw new Error(`persist lead hunter run failed: ${error.message}`);
    }
    return { created: true };
  }

  async load(runId: string, userId: string | null): Promise<LeadHunterRunRecord | null> {
    const { data, error } = await this.db.from(TABLE).select("job_id, user_id, status, report_json, created_at").eq("job_id", runId).maybeSingle();
    if (error) throw new Error(`load lead hunter run failed: ${error.message}`);
    if (!data) return null;
    const json = (data.report_json ?? {}) as Record<string, unknown>;
    const payload = json[NS] as { contextRef: LeadHunterRunRecord["contextRef"]; universe: CandidateAccountUniverse; createdAt: string } | undefined;
    if (!payload) return null; // not a lead-hunter snapshot
    const rowUser = (data.user_id as string | null) ?? null;
    if (rowUser !== null && rowUser !== userId) return null; // owner isolation
    return {
      runId: data.job_id as string,
      userId: rowUser,
      status: data.status as LeadHunterRunRecord["status"],
      contextRef: payload.contextRef,
      universe: payload.universe,
      createdAt: payload.createdAt ?? (data.created_at as string),
    };
  }
}
