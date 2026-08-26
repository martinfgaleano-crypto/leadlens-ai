# LeadLens — Account Memory Live Review1→Review2 Acceptance V1 — Report

**Date:** 2026-08-26 · **Scope:** narrow production acceptance of Account Memory against the real persistence path. No memory redesign, no features, no Monitor.

## 1. Git / Preconditions
Branch `main`; HEAD `ec10012` at start; `origin/main` == HEAD; clean worktree. Migration `052` live.

## 2. Live Schema Verification
`account_review_snapshots` verified live: `owner_user_id` (FK auth.users, nullable), `client_key`, `account_id`, `review_id`, `context_version`, `reviewed_at`, `snapshot jsonb`, `fingerprint`, `unique nulls not distinct (owner_user_id, client_key, account_id, review_id)`, lineage index `(owner_user_id, client_key, account_id, reviewed_at desc)`, RLS `ars_owner_read` (auth.uid() = owner_user_id). Matches canonical expectations. No drift; no migration needed.

## 3. Safe Test Setup
The real `SupabaseAccountMemoryRepo` was exercised with **namespaced, disposable** test data: a unique `client_key` (`acc_accept_<ts>`), `owner_user_id=null`, synthetic account/reviews. All rows are DELETED at the end (append-only by convention; no DB immutability trigger, so cleanup is safe). **No real customer history was touched.** Packaged as a permanent, self-cleaning tool: `scripts/accept-account-memory.mts` (16/16).

## 4. Review 1
Real path = `brief/actions.ts` → `persistAndLoadMemory(new SupabaseAccountMemoryRepo(db), vm.accounts, scope, meta)`. Live: R1 (decision `monitor`, T1) persisted as exactly **one** snapshot; **predecessor resolves to null** (no fake history); current Case renders normally (no Since Last Review).

## 5. Review 1 Idempotency
Re-persisting R1 (reopening the report re-upserts on `(owner,client,account,review)`) → still **1** row. Viewing does not create duplicate history.

## 6. Review 2
R2 (decision `prioritize`, T2>T1, new verified change, new corroborating origin, decision-critical validation resolved) persisted as a **second immutable** snapshot. R1 row unchanged (`decision` still `monitor`). Re-persisting R2 → still **2** rows (no duplicate).

## 7. Predecessor Resolution
R2's predecessor resolves server-side (owner+client+account, strictly before `reviewed_at`, not itself) to **R1** (`job_T1` / monitor). **Out-of-order proven:** inserting T0 (earlier than R1) leaves R2's predecessor as R1 (latest prior, not T0), while R1's predecessor becomes T0 — ordering is by `reviewed_at`, never insert order (T3→T2, never T3→T1).

## 8. Living Case
The predecessor-derived `ReviewMemory` loads from persisted state (proven live). "Since Last Review" and the Living Case are rendered from this memory by the workspace/deliverable renderers (covered by `deliverable-renderer` 60, `account-memory` 27, `portable-deliverable` 55). No fixture-only injection is required — the memory object is the same one the live store returns.

## 9. Decision Transition
`diffAccountCase(R1,R2)`: from `monitor` → to `prioritize`, `changed:true`, `material:true`, drivers = [new_material_change, new_corroboration, decision_critical_resolved, timing_changed, revisit_trigger_met]. Previous + current Decision and the material drivers are explicit — no score language, no vague "rating changed".

## 10. Evidence / Validation Change
Evidence newness is **honest**: `evidenceAdded = [bloomberg.com]` only (the genuinely new origin); the re-seen `reuters.com` is not counted as new. Decision-critical validation `owner` recorded as resolved (`decisionCriticalResolved`). Same-review re-ingest → `isSameReview:true`, not a change.

## 11. Portfolio Change
Portfolio-level change is generated from the same review lineage as the account cases (shared snapshots), covered by `account-opportunity-synthesis` 40 and `amor-phase4-6-portfolio` 29 — no parallel memory interpretation. (Live multi-account portfolio run is deterministic-tested; not separately live-exercised this sprint.)

## 12. Owner Isolation
Client isolation proven live (a different `client_key` returns no predecessor). Owner isolation is enforced at three layers: the repo query scopes by `owner_user_id` (`.eq`/`.is null`), RLS `ars_owner_read` gates authenticated reads by `auth.uid()`, and pure `selectPredecessor` filters by `ownerUserId` (unit-tested). Full cross-`owner_user_id` live test requires two real auth users (cannot synthesize FK) — covered by the three layers above.

## 13. Context Version
`contextId/version` preserved on every row. `contextChanged:false` when `context_version` is unchanged; `contextChanged:true` when it differs — so a Decision move under a new commercial context is classified as a **client-context change**, distinct from an account change (verified live).

## 14. Portable
Portable generation includes Since Last Review when a predecessor exists and shows no memory on a first review; it remains static/offline with no runtime DB access (covered by `portable-deliverable` 55). Not separately re-generated live this sprint.

## 15. Failure Handling
Fail-closed proven: a throwing repo → `persistAndLoadMemory` returns **null** (first-review behavior — current Case still renders) and logs the error via `onError`. Failed/partial reviews never become predecessors (predecessor selection is by persisted completed snapshots only; failed runs are not persisted as accepted memory).

## 16. Performance
Predecessor lookup is **one** indexed range query per review (batched across accounts via `.in(account_id, …)` + in-memory per-account selection — no N+1), using `idx_ars_lineage`. Persist is a single batched upsert. Live latency for the full R1→R2 cycle (persist + predecessor + diff) was sub-second per step.

## 17. Tests
Live acceptance `scripts/accept-account-memory.mts` **16/16** (persistence, idempotency, predecessor, immutability, out-of-order, decision transition, evidence newness, validation resolved, context change, same-review, client isolation, fail-closed). Regression green: account-memory 27, account-memory-store 18, account-opportunity-synthesis 40, amor-phase4-6-portfolio 29, deliverable-renderer 60, portable-deliverable 55, client-context-review 50, commercial-continuity 17. Fixed a pre-existing `tsc` type-narrowing error in `lead-hunter-production.test.ts` (build doesn't typecheck `scripts/`, so it had slipped through). `tsc --noEmit` clean; `npm run build` clean.

## 18. Operational Verdict
**ACCOUNT MEMORY OPERATIONAL WITH NON-BLOCKING P2.** Review1→Review2 works end-to-end against live persistence: durable immutable snapshots, correct auto-predecessor (incl. out-of-order), honest decision/evidence/validation diffs, idempotent reloads, client/context isolation, fail-closed. P2 = full end-to-end UI render of two live reviews through the browser route, and a live cross-`owner_user_id` test (needs two real auth users).

## 19. Remaining P0/P1/P2
- **P0:** none.
- **P1:** none blocking.
- **P2:** end-to-end two-review browser render through `/results/[jobId]/brief`; live cross-owner (two real users) isolation test; live multi-account Portfolio Change run.

## 20. Recommended Next Intelligence Move
1. **Recurring Monitor Intelligence V1.**
2. Provider routing / COGS optimization from real repeated-run data.
3. Colombia/private-company source strategy (evidence-driven follow-up).
