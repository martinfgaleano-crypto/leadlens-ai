// ─── Account Memory persistence V1.1 ──────────────────────────────────────────
// Durable per-review canonical snapshots + predecessor lookup. The SELECTION and
// SERIALIZATION logic here is pure and fully tested; the Supabase binding is a
// thin adapter over it (no ad-hoc production fallback — §50). Immutable,
// idempotent, owner/client/context scoped. Fails closed to first-review behavior
// when storage is unavailable (§51).
import type { AccountReviewSnapshot } from "./account-memory";
import { snapshotAccountReview, snapshotFingerprint } from "./account-memory";
import type { AccountBriefVM } from "./deliverable-view-model";

export const ACCOUNT_MEMORY_STORE_VERSION = "account-memory-store-v1";

export interface SnapshotScope { ownerUserId: string | null; clientKey: string }
export interface ReviewMeta { reviewId: string; reviewedAt: string; contextVersion: string }

/** Persisted row (mirrors migration 052). Contains only canonical state. */
export interface ReviewSnapshotRow {
  ownerUserId: string | null;
  clientKey: string;
  accountId: string;
  reviewId: string;
  contextVersion: string;
  reviewedAt: string;
  snapshot: AccountReviewSnapshot;
  fingerprint: string;
}

export function toRow(snap: AccountReviewSnapshot, scope: SnapshotScope): ReviewSnapshotRow {
  return { ownerUserId: scope.ownerUserId, clientKey: scope.clientKey, accountId: snap.accountId, reviewId: snap.reviewId, contextVersion: snap.contextVersion, reviewedAt: snap.reviewedAt, snapshot: snap, fingerprint: snapshotFingerprint(snap) };
}

/** Build the canonical rows for a completed review from its view-model accounts. */
export function rowsForReview(accounts: AccountBriefVM[], scope: SnapshotScope, meta: ReviewMeta): ReviewSnapshotRow[] {
  return accounts.map((a) => toRow(snapshotAccountReview(a, meta), scope));
}

/** Pure predecessor selection: the latest prior row for the SAME account within
 *  the SAME owner+client scope, strictly BEFORE the current review (by time), and
 *  never the current review itself. Out-of-order inserts and same-review re-ingest
 *  cannot become the predecessor (§21/§22/§23). */
export function selectPredecessor(rows: ReviewSnapshotRow[], scope: SnapshotScope, accountId: string, current: { reviewId: string; reviewedAt: string }): ReviewSnapshotRow | null {
  const t = new Date(current.reviewedAt).getTime();
  const candidates = rows.filter((r) =>
    r.ownerUserId === scope.ownerUserId && r.clientKey === scope.clientKey && r.accountId === accountId
    && r.reviewId !== current.reviewId && new Date(r.reviewedAt).getTime() < t);
  candidates.sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());
  return candidates[0] ?? null;
}

// ── repository ──
export interface AccountMemoryRepo {
  persist(rows: ReviewSnapshotRow[]): Promise<void>;   // idempotent upsert on (owner,client,account,review)
  loadPredecessors(scope: SnapshotScope, accountIds: string[], current: { reviewId: string; reviewedAt: string }): Promise<Record<string, AccountReviewSnapshot>>;
}

/** In-memory repo — the same pure logic production relies on, for tests. */
export class InMemoryAccountMemoryRepo implements AccountMemoryRepo {
  rows: ReviewSnapshotRow[] = [];
  async persist(rows: ReviewSnapshotRow[]): Promise<void> {
    for (const row of rows) {
      const i = this.rows.findIndex((r) => r.ownerUserId === row.ownerUserId && r.clientKey === row.clientKey && r.accountId === row.accountId && r.reviewId === row.reviewId);
      if (i >= 0) this.rows[i] = row; else this.rows.push(row);   // idempotent
    }
  }
  async loadPredecessors(scope: SnapshotScope, accountIds: string[], current: { reviewId: string; reviewedAt: string }): Promise<Record<string, AccountReviewSnapshot>> {
    const out: Record<string, AccountReviewSnapshot> = {};
    for (const id of accountIds) { const p = selectPredecessor(this.rows, scope, id, current); if (p) out[id] = p.snapshot; }
    return out;
  }
}

/** Supabase-backed repo. `db` is a service-role/authorized SupabaseClient (or the
 *  server client). Batched predecessor lookup — one range query, then per-account
 *  selection in memory (no N+1, §35-36). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class SupabaseAccountMemoryRepo implements AccountMemoryRepo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: any) {}
  async persist(rows: ReviewSnapshotRow[]): Promise<void> {
    if (!rows.length) return;
    await this.db.from("account_review_snapshots").upsert(
      rows.map((r) => ({ owner_user_id: r.ownerUserId, client_key: r.clientKey, account_id: r.accountId, review_id: r.reviewId, context_version: r.contextVersion, reviewed_at: r.reviewedAt, snapshot: r.snapshot, fingerprint: r.fingerprint })),
      { onConflict: "owner_user_id,client_key,account_id,review_id" },
    );
  }
  async loadPredecessors(scope: SnapshotScope, accountIds: string[], current: { reviewId: string; reviewedAt: string }): Promise<Record<string, AccountReviewSnapshot>> {
    if (!accountIds.length) return {};
    // One query: all prior rows for this owner/client + these accounts, before current time.
    const q = this.db.from("account_review_snapshots").select("account_id,review_id,reviewed_at,snapshot")
      .eq("client_key", scope.clientKey).in("account_id", accountIds)
      .lt("reviewed_at", current.reviewedAt).neq("review_id", current.reviewId)
      .order("reviewed_at", { ascending: false });
    const scoped = scope.ownerUserId ? q.eq("owner_user_id", scope.ownerUserId) : q.is("owner_user_id", null);
    const { data, error } = await scoped;
    if (error || !data) return {};
    const out: Record<string, AccountReviewSnapshot> = {};
    for (const row of data as Array<{ account_id: string; snapshot: AccountReviewSnapshot }>) { if (!out[row.account_id]) out[row.account_id] = row.snapshot; }
    return out;
  }
}

export interface ReviewMemory { current: ReviewMeta; previousById: Record<string, AccountReviewSnapshot> }

/** Full write-then-read cycle for a completed review: persist current snapshots
 *  (idempotent) and return the predecessor-derived memory (null if none). Fails
 *  closed — any repo error yields null (first-review behavior), never a throw. */
export async function persistAndLoadMemory(repo: AccountMemoryRepo, accounts: AccountBriefVM[], scope: SnapshotScope, meta: ReviewMeta, onError?: (e: unknown) => void): Promise<ReviewMemory | null> {
  try {
    const rows = rowsForReview(accounts, scope, meta);
    await repo.persist(rows);
    const previousById = await repo.loadPredecessors(scope, accounts.map((a) => a.id), meta);
    return Object.keys(previousById).length ? { current: meta, previousById } : null;
  } catch (e) { onError?.(e); return null; }
}
