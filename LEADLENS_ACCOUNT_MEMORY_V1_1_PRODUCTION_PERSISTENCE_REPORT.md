# LeadLens — Account Memory V1.1 · Production Persistence + Predecessor Loading + Portfolio Change

**From:** `f0aa0b7` · **Date:** 2026-08-22

> **Bottom line:** Account Memory is now connected to the real review lifecycle. On a completed review, the authenticated brief flow persists immutable canonical snapshots (idempotent — never on mere page view duplication) and loads the correct predecessor review to drive the Living Case and a new Portfolio Change section — owner/client/context scoped, server-side, fail-closed. Selection/idempotency/isolation logic is fully tested (18 store + 27 memory cases). The one remaining founder action is applying migration `052`; migrations are generated-only by repo convention and never auto-applied.

## 1. Initial architecture audit
Migrations run to `051`; `institutional_report_snapshots` is already upserted idempotently inside `getBriefForViewer` on completed reports — the established, safe write hook. `intelligence_account_events` (048) is append-only, tenant-scoped. `getBriefForViewer` enforces ownership via `lead_searches.user_id`, assembles server-side, and never ships raw `report_json`.

## 2. Existing persistence reuse
No parallel memory subsystem. Reused: the completed-review upsert pattern (idempotency, service client), ownership resolution, and `diffPortfolioIntelligence`/`diffAccountCase`/`snapshotFingerprint`. Added one focused table for canonical review snapshots.

## 3. Storage contract
`account_review_snapshots` (migration `052`): owner_user_id, client_key, account_id, review_id, context_version, reviewed_at, `snapshot` jsonb (canonical `AccountReviewSnapshot` — no prose/HTML §8), fingerprint. `unique(owner_user_id, client_key, account_id, review_id)` for idempotency; index `(owner_user_id, client_key, account_id, reviewed_at desc)` for one-scan predecessor lookup (no N+1); RLS owner-only read.

## 4. Migration
`supabase/migrations/052_account_review_snapshots.sql` — generated only, **not auto-applied** (repo convention; founder applies). Historical migrations untouched.

## 5. Snapshot write lifecycle
Written inside `getBriefForViewer` **only after** `status === "completed"` + ownership resolved (processing/failed/partial return earlier §11-14). Idempotent upsert keyed by (owner,client,account,review) — re-viewing or retrying the same completed review re-writes the same rows, never duplicates (§42/§103). Canonical only.

## 6. Predecessor lookup
`SupabaseAccountMemoryRepo.loadPredecessors` — one batched query (owner+client+accountIds, reviewed_at < current, review_id ≠ current), newest-first, per-account selection in memory. `selectPredecessor` is pure and unit-tested: T3→T2 (not T1), out-of-order-safe, same-review-excluded (§21/§22/§40/§102).

## 7. Authorization
Predecessor scope derives server-side from the authorized current report (owner_user_id from `lead_searches`, client_key from the report subject) — the client never supplies the history key (§32). Cross-client/owner isolation enforced by scope + RLS (§96, tested).

## 8. Idempotency
Fingerprint + unique constraint; `persistAndLoadMemory` re-runs cleanly. Duplicate ingest ⇒ no duplicate row (tested).

## 9. Ordering / concurrency
Ordering by persisted `reviewed_at` only (never browser/render clock §20). Out-of-order completion cannot corrupt lineage (tested §104): a late-arriving older review becomes the correct earlier neighbour, not the current predecessor.

## 10. BriefView integration
`getBriefForViewer` returns `memory: ReviewMemory | null`; `page.tsx` passes it to `OpportunityWorkspace`. `getBriefForViewer` ownership + raw-report isolation unchanged; memory contains only canonical snapshots (safe client-side §98). Whole block is try/caught — persistence failure logs server-side and falls back to first-review behavior; the deliverable never breaks (§51/§108/§52).

## 11. Workspace Living Cases
The optional `memory` prop now arrives from real server data. Living Case module renders above the Account Brief when a predecessor exists (verified last sprint via the same component path). Current Case stays dominant.

## 12. Portable generation
`renderPortableHtml(vm, mem?)` — a later-review portable includes real predecessor-derived memory; stays static/offline (no runtime DB §55/§58). Demo: `asteron-review1-first.html` (none) vs `asteron-review2-memory.html` (8 Living Cases + Portfolio Change).

## 13. Portfolio Change
New compact section in the Portfolio Intelligence tab (workspace + portable) when a predecessor exists — `portfolioChange()` aggregates the per-account diffs (§62 canonical equivalent), so it always agrees with the account Living Cases (§69-70). Content: decision moves (to/from Prioritize with names), strengthened/weakened counts, new verified changes, validations resolved, revisit conditions met. Verified: "8 moved to Prioritize: Alianza Team, Saia Inc., Encompass Health, Watsco…". First review / no-change ⇒ omitted (§65/§67/§68). Not a sixth tab (§60).

## 14. Localization
All memory + portfolio-change copy is EN/ES via structured messages; diff on canonical keys, so EN vs ES yields zero false change (§76-78, tested).

## 15. Performance
Predecessor lookup is a single indexed query for the whole portfolio (batched); the 50-account store test exercises the same selection path with no per-account query. Overhead is one query + pure in-memory diffs — negligible vs report assembly (§37/§111-112).

## 16. Failure handling
Fail-closed: storage error ⇒ `memory=null`, first-review UI, server-side log, no customer stack trace (§51-52/§108, tested).

## 17. Tests
`account-memory-store` **18/18** (§100-110: T1/T2/T3 predecessor, duplicate, out-of-order, failed-excluded, cross-client + cross-context isolation, context-change driver, 50-account batch, fail-closed, canonical rows). `account-memory` **27/27** (incl. a real bug fix: `isSameReview` now respects `contextVersion`, so a pure context change is no longer swallowed §17/§107). Regression: portfolio-intelligence 36, portable 55, deliverable 60, product-truth 21, landing 102. tsc + production build clean; secret scan clean; **0 provider calls**; auth/PI-synthesis/Canvas/landing unchanged.

## 18. Production readiness
The write + read code paths are wired into the authenticated lifecycle and compile/build clean; the selection/idempotency/isolation logic is fully tested against the same functions production calls. **Operational once migration `052` is applied** (founder action per repo convention). End-to-end live-DB execution (a real Supabase write on one review, read on the next) was **not** exercised in this environment — it requires the applied migration + two completed reviews; that is the acceptance step the founder runs after applying `052`.

## 19. Remaining P0 / P1 / P2
- **P0:** none.
- **P1:** apply migration `052` and run the two-review acceptance (Review 1 → Review 2 shows Since Last Review) against live Supabase — the only step between "wired" and "operational".
- **P2:** Evidence-tab "new since last review" markers (§92/§125-126, optional); admin observability counters (snapshots stored / predecessor found / failures §82); deterministic backfill of existing prior reports (audited as possible; **not** run §46).

## 20. Recommended next sprint
After `052` is applied and acceptance passes: **Account Memory V1.2 — review cadence + admin observability** (surface memory counters, optional scheduled re-review to make repeated reviews routine). Framing stays cyclic/review-based, never real-time (§79-81).

---
**"LeadLens remembers."** — The engine, persistence, predecessor loading, Living Cases, and Portfolio Change are implemented, wired into the real review lifecycle, tested, and build-clean. The statement becomes literally true in production the moment migration `052` is applied; until then it is operational-ready, not yet operational — stated honestly per §131.
