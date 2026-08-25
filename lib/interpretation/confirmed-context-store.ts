// ─── Confirmed commercial context: durable, versioned, owner-isolated store ────
//
// This is the WRITE GATE and the load path for ConfirmedCommercialContextV1.
// It turns a user-confirmed interpretation into a durable, versioned execution
// input — and refuses to persist anything unconfirmed / unsupported / blocked.
//
// Storage is abstracted behind ConfirmedContextStore so the domain logic (the
// write gate, versioning, idempotency, owner scoping) is provider-agnostic and
// fully testable with an in-memory store. A thin Supabase-backed implementation
// lives at the bottom; it holds no policy of its own — every decision is made in
// the pure domain functions here.
//
// BOUNDARIES:
//   • No raw prose is stored — only the validated ConfirmedCommercialContextV1.
//   • No provider / LLM / network here. Persistence only.
//   • Confirmation is the doorway: persist runs confirmInterpretation and stores
//     ONLY when it passes.

import type { CompanyInterpretationV1 } from "./company-interpretation";
import type { ConfirmedCommercialContextV1 } from "./confirmed-commercial-context";
import { confirmInterpretation, type ConfirmationOptions } from "./confirmed-commercial-context";

/** One immutable, persisted version of a confirmed commercial context. */
export interface ConfirmedContextRecord {
  userId: string;
  contextId: string;
  version: number;
  supersedesVersion?: number;
  clientId?: string;
  objectiveType: string;
  context: ConfirmedCommercialContextV1;
  provenanceSummary: string;
  effectiveFrom: string; // ISO
  confirmedAt: string; // ISO
}

/**
 * Storage port. Implementations MUST scope every read to `userId` (owner
 * isolation) and MUST treat rows as append-only (never update/delete).
 */
export interface ConfirmedContextStore {
  /** All versions of one logical context owned by userId, any order. */
  listVersions(userId: string, contextId: string): Promise<ConfirmedContextRecord[]>;
  /** Append a new immutable version. Implementations must reject duplicates on
   *  (userId, contextId, version). */
  insert(record: ConfirmedContextRecord): Promise<void>;
}

export type PersistResult =
  | { ok: true; record: ConfirmedContextRecord; created: boolean }
  | { ok: false; reason: string; missing: string[] };

export interface PersistOptions {
  userId: string;
  contextId: string;
  clientId?: string;
  /** Clock injection for deterministic tests. */
  now?: () => Date;
}

/** Execution-relevant fields whose change warrants a NEW version. Confirmation
 *  metadata / timestamps are intentionally excluded so a re-confirm of identical
 *  intent is idempotent (does not spawn a version). */
function canonicalFingerprint(ctx: ConfirmedCommercialContextV1): string {
  return JSON.stringify({
    objective: ctx.objective,
    companyProfile: ctx.companyProfile,
    targetAccountProfile: ctx.targetAccountProfile,
    opportunityConditions: ctx.opportunityConditions,
    disqualifiers: ctx.disqualifiers,
    signalHypotheses: ctx.signalHypotheses,
    qualificationConstraints: ctx.qualificationConstraints,
    clientId: ctx.clientId,
  });
}

const objectiveTypeOf = (ctx: ConfirmedCommercialContextV1): string =>
  ctx.objective.type;

/**
 * THE WRITE GATE. Confirm an interpretation and durably persist the resulting
 * ConfirmedCommercialContextV1 as the next immutable version.
 *
 * Refuses (never persists) when confirmInterpretation refuses: unsupported
 * objective, open blocker, not confirmable/ready, not execution-ready, or any
 * truth-boundary violation.
 *
 * IDEMPOTENCY: if the latest persisted version is byte-identical in its
 * execution-relevant fields, no new version is created — the existing record is
 * returned with `created: false`. A genuine change appends version N+1 with
 * `supersedesVersion = N`.
 */
export async function persistConfirmedContext(
  store: ConfirmedContextStore,
  interp: CompanyInterpretationV1,
  opts: PersistOptions,
): Promise<PersistResult> {
  const existing = await store.listVersions(opts.userId, opts.contextId);
  const sorted = [...existing].sort((a, b) => b.version - a.version);
  const latest = sorted[0];
  const nextVersion = latest ? latest.version + 1 : 1;

  const confirmOpts: ConfirmationOptions = {
    contextId: opts.contextId,
    version: nextVersion,
    clientId: opts.clientId,
    supersedes: latest ? { contextId: opts.contextId, version: latest.version } : undefined,
  };
  const confirmed = confirmInterpretation(interp, confirmOpts);
  if (!confirmed.ok) return { ok: false, reason: confirmed.reason, missing: confirmed.missing };

  // Idempotency: identical execution intent as the latest version → no new row.
  if (latest && canonicalFingerprint(latest.context) === canonicalFingerprint(confirmed.context)) {
    return { ok: true, record: latest, created: false };
  }

  const now = (opts.now ?? (() => new Date()))().toISOString();
  const record: ConfirmedContextRecord = {
    userId: opts.userId,
    contextId: opts.contextId,
    version: nextVersion,
    supersedesVersion: latest?.version,
    clientId: opts.clientId,
    objectiveType: objectiveTypeOf(confirmed.context),
    context: confirmed.context,
    provenanceSummary: confirmed.context.provenanceSummary,
    effectiveFrom: confirmed.context.effectiveFrom ?? now,
    confirmedAt: confirmed.context.confirmedAt ?? now,
  };
  await store.insert(record);
  return { ok: true, record, created: true };
}

export interface ContextSelector {
  contextId: string;
  /** Specific historical version. Omit for the latest version. */
  version?: number;
}

/**
 * Load an authorized confirmed context version for execution. Owner-scoped: the
 * store only ever returns rows owned by `userId`. Returns null when nothing
 * matches — callers MUST fail safe (never fall back to raw prose).
 */
export async function loadConfirmedContext(
  store: ConfirmedContextStore,
  userId: string,
  selector: ContextSelector,
): Promise<ConfirmedContextRecord | null> {
  const versions = await store.listVersions(userId, selector.contextId);
  if (versions.length === 0) return null;
  if (selector.version !== undefined) {
    return versions.find((v) => v.version === selector.version) ?? null;
  }
  return versions.reduce((a, b) => (b.version > a.version ? b : a));
}

// ─── In-memory store (tests / non-persistent environments) ────────────────────

export class InMemoryConfirmedContextStore implements ConfirmedContextStore {
  private rows: ConfirmedContextRecord[] = [];

  async listVersions(userId: string, contextId: string): Promise<ConfirmedContextRecord[]> {
    return this.rows
      .filter((r) => r.userId === userId && r.contextId === contextId)
      .map((r) => structuredClone(r));
  }

  async insert(record: ConfirmedContextRecord): Promise<void> {
    const dup = this.rows.some(
      (r) => r.userId === record.userId && r.contextId === record.contextId && r.version === record.version,
    );
    if (dup) throw new Error(`duplicate version ${record.version} for ${record.contextId}`);
    this.rows.push(structuredClone(record));
  }

  /** Test helper: every row (unfiltered). */
  all(): ConfirmedContextRecord[] {
    return this.rows.map((r) => structuredClone(r));
  }
}

// ─── Supabase-backed store ────────────────────────────────────────────────────
//
// Thin mapping to `public.confirmed_commercial_contexts` (migration 053). It is
// constructed with an already-authorized service-role client; it holds no
// policy. Row shape mirrors ConfirmedContextRecord.

interface MinimalSupabaseClient {
  from(table: string): {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
      };
    };
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
}

const TABLE = "confirmed_commercial_contexts";

export class SupabaseConfirmedContextStore implements ConfirmedContextStore {
  constructor(private readonly client: MinimalSupabaseClient) {}

  async listVersions(userId: string, contextId: string): Promise<ConfirmedContextRecord[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("user_id, context_id, version, supersedes_version, client_id, objective_type, payload, provenance_summary, effective_from, confirmed_at")
      .eq("user_id", userId)
      .eq("context_id", contextId);
    if (error) throw new Error(`load confirmed contexts failed: ${error.message}`);
    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        userId: r.user_id as string,
        contextId: r.context_id as string,
        version: r.version as number,
        supersedesVersion: (r.supersedes_version as number | null) ?? undefined,
        clientId: (r.client_id as string | null) ?? undefined,
        objectiveType: r.objective_type as string,
        context: r.payload as ConfirmedCommercialContextV1,
        provenanceSummary: r.provenance_summary as string,
        effectiveFrom: r.effective_from as string,
        confirmedAt: r.confirmed_at as string,
      };
    });
  }

  async insert(record: ConfirmedContextRecord): Promise<void> {
    const { error } = await this.client.from(TABLE).insert({
      user_id: record.userId,
      context_id: record.contextId,
      version: record.version,
      supersedes_version: record.supersedesVersion ?? null,
      client_id: record.clientId ?? null,
      schema_version: "1",
      objective_type: record.objectiveType,
      payload: record.context,
      provenance_summary: record.provenanceSummary,
      effective_from: record.effectiveFrom,
      confirmed_at: record.confirmedAt,
    });
    if (error) throw new Error(`persist confirmed context failed: ${error.message}`);
  }
}
