// ─── Account Memory persistence V1.1 ──────────────────────────────────────────
// Durable per-review canonical snapshots + predecessor lookup. The SELECTION and
// SERIALIZATION logic here is pure and fully tested; the Supabase binding is a
// thin adapter over it (no ad-hoc production fallback — §50). Immutable,
// idempotent, owner/client/context scoped. Fails closed to first-review behavior
// when storage is unavailable (§51).
import type { AccountReviewSnapshot } from "./account-memory";
import { snapshotAccountReview, snapshotFingerprint, canonicalAccountKey, canonicalClientKey, isStructuralReject } from "./account-memory";
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

/** Build the canonical rows for a completed review from its view-model accounts. Structural
 *  rejects (wrong entity / non-company / hard ICP disqualifier) are excluded — they never
 *  enter active Account Memory (§A27). */
export function rowsForReview(accounts: AccountBriefVM[], scope: SnapshotScope, meta: ReviewMeta): ReviewSnapshotRow[] {
  return accounts.filter((a) => !isStructuralReject(a)).map((a) => toRow(snapshotAccountReview(a, meta), scope));
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
  loadRecent?(scope: SnapshotScope, accountIds: string[], limitPerAccount?: number): Promise<Record<string, AccountReviewSnapshot[]>>;
}

/** In-memory repo — the same pure logic production relies on, for tests. */
export class InMemoryAccountMemoryRepo implements AccountMemoryRepo {
  rows: ReviewSnapshotRow[] = [];
  async persist(rows: ReviewSnapshotRow[]): Promise<void> {
    for (const row of rows) {
      const existing = this.rows.find((r) => r.ownerUserId === row.ownerUserId && r.clientKey === row.clientKey && r.accountId === row.accountId && r.reviewId === row.reviewId);
      // IMMUTABLE (§A12/§A23/§A24): same (owner,client,account,review) is insert-once. An
      // identical re-ingest is idempotent (no-op); a CHANGED fingerprint is a CONFLICT — the
      // original is preserved, never overwritten (no last-writer mutation of history).
      if (existing) continue;
      this.rows.push(row);
    }
  }
  async loadPredecessors(scope: SnapshotScope, accountIds: string[], current: { reviewId: string; reviewedAt: string }): Promise<Record<string, AccountReviewSnapshot>> {
    const out: Record<string, AccountReviewSnapshot> = {};
    for (const id of accountIds) { const p = selectPredecessor(this.rows, scope, id, current); if (p) out[id] = p.snapshot; }
    return out;
  }
  async loadRecent(scope: SnapshotScope, accountIds: string[], limitPerAccount = 2): Promise<Record<string, AccountReviewSnapshot[]>> {
    const out: Record<string, AccountReviewSnapshot[]> = {};
    for (const id of accountIds) {
      out[id] = this.rows.filter((r) => r.ownerUserId === scope.ownerUserId && r.clientKey === scope.clientKey && r.accountId === id)
        .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime())
        .slice(0, limitPerAccount).map((r) => r.snapshot);
    }
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
    // IMMUTABLE (§A12): ignoreDuplicates so a re-ingest of an existing
    // (owner,client,account,review) is a no-op — history is never overwritten (a changed
    // payload under the same review is a conflict resolved in favour of the original).
    await this.db.from("account_review_snapshots").upsert(
      rows.map((r) => ({ owner_user_id: r.ownerUserId, client_key: r.clientKey, account_id: r.accountId, review_id: r.reviewId, context_version: r.contextVersion, reviewed_at: r.reviewedAt, snapshot: r.snapshot, fingerprint: r.fingerprint })),
      { onConflict: "owner_user_id,client_key,account_id,review_id", ignoreDuplicates: true },
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
  async loadRecent(scope: SnapshotScope, accountIds: string[], limitPerAccount = 2): Promise<Record<string, AccountReviewSnapshot[]>> {
    if (!accountIds.length) return {};
    const q = this.db.from("account_review_snapshots").select("account_id,reviewed_at,snapshot")
      .eq("client_key", scope.clientKey).in("account_id", accountIds).order("reviewed_at", { ascending: false });
    const scoped = scope.ownerUserId ? q.eq("owner_user_id", scope.ownerUserId) : q.is("owner_user_id", null);
    const { data, error } = await scoped;
    if (error || !data) return {};
    const out: Record<string, AccountReviewSnapshot[]> = {};
    for (const row of data as Array<{ account_id: string; snapshot: AccountReviewSnapshot }>) {
      const list = out[row.account_id] ?? [];
      if (list.length < limitPerAccount) list.push(row.snapshot);
      out[row.account_id] = list;
    }
    return out;
  }
}

export interface ReviewMemory { current: ReviewMeta; currentById: Record<string, AccountReviewSnapshot>; previousById: Record<string, AccountReviewSnapshot> }

/** Full write-then-read cycle for a completed review: persist current snapshots
 *  (idempotent) and return the predecessor-derived memory (null if none). Fails
 *  closed — any repo error yields null (first-review behavior), never a throw. */
export async function persistAndLoadMemory(repo: AccountMemoryRepo, accounts: AccountBriefVM[], scope: SnapshotScope, meta: ReviewMeta, onError?: (e: unknown) => void, options: { preferLatestAccepted?: boolean } = {}): Promise<ReviewMemory | null> {
  try {
    // Canonical scope (§A3/§A4): a run-derived clientKey collapses to the logical context so
    // a later run finds its predecessor; a real context/client scope is preserved as-is.
    const canonScope: SnapshotScope = { ownerUserId: scope.ownerUserId, clientKey: canonicalClientKey(scope.clientKey, meta.contextVersion) };
    const rows = rowsForReview(accounts, canonScope, meta);
    const currentRowByCanonical = new Map(rows.map((row) => [row.accountId, row.snapshot] as const));
    await repo.persist(rows);
    // Predecessors are matched on the CANONICAL account key (domain), but returned keyed by
    // the caller's VM id so report reorder / index-suffixed ids still resolve lineage (§A6/§A21).
    const keyByVmId = new Map(accounts.map((a) => [a.id, canonicalAccountKey(a)] as const));
    const canonicalKeys = Array.from(new Set(accounts.map((a) => canonicalAccountKey(a))));
    const recentByCanonical = repo.loadRecent ? await repo.loadRecent(canonScope, canonicalKeys, 2) : {};
    const predsByCanonical = await repo.loadPredecessors(canonScope, canonicalKeys, meta);
    const currentById: Record<string, AccountReviewSnapshot> = {};
    const previousById: Record<string, AccountReviewSnapshot> = {};
    for (const a of accounts) {
      const key = keyByVmId.get(a.id)!;
      const recent = recentByCanonical[key] ?? [];
      const current = options.preferLatestAccepted ? recent[0] : currentRowByCanonical.get(key);
      const predecessor = options.preferLatestAccepted ? recent[1] : predsByCanonical[key];
      if (current) currentById[a.id] = current;
      if (predecessor) previousById[a.id] = predecessor;
    }
    return Object.keys(previousById).length ? { current: meta, currentById, previousById } : null;
  } catch (e) { onError?.(e); return null; }
}

/** Overlay accepted review state only. Memory never supplies source claims or
 * events; those remain in the current report/evidence path. */
export function applyCurrentMemoryToAccounts(accounts: AccountBriefVM[], memory: ReviewMemory | null): AccountBriefVM[] {
  if (!memory) return accounts;
  return accounts.map((account) => {
    const current = memory.currentById[account.id];
    if (!current) return account;
    const dimensions = account.dimensions.map((dimension) => {
      const value = dimension.label === "Fit" ? current.fit : dimension.label === "Timing" ? current.timing : dimension.label === "Evidence" ? current.evidence : null;
      return value ? { ...dimension, value } : dimension;
    });
    return { ...account, decision: current.decision, dimensions,
      decisionNote: current.decision === "monitor" ? (current.monitorReason ?? account.decisionNote) : account.decisionNote,
      revisitWhen: current.revisitTrigger?.condition ?? account.revisitWhen,
      evidence: { ...account.evidence, strength: current.evidence ?? account.evidence.strength, corroborated: current.independentSupport },
    };
  });
}
