# LeadLens — Admin Intelligence + Launch Readiness + Vault Observability Closure V1

Verified truth only. Root-caused the "static Admin indicators" report across the three surfaces and
made the operator-facing observability reflect **live persisted product state**. No displayed number was
hand-edited, no synthetic company was inserted, no readiness score was manually raised.

## Live baseline (measured this sprint, production Supabase, read-only)
- `vault_companies`: **185** total; new by `first_seen_at` = **2 / 24h, 20 / 7d, 118 / 30d** → the Vault
  **is actively growing** (was 98 in a prior sprint).
- `snapshot_reports`: 46 rows, **1** productive `intel_*` run persisted (acceptance runs self-delete on
  cleanup, so live run-count reflects real/leftover runs, not disposable acceptances).
- `account_intelligence_charges`: **28** delivered-evaluation charges (30d window).

## Root cause per surface
1. **Vault count "static":** NOT a persistence defect — the vault admin route reads `vault_companies`
   live (auto-dynamic via `requireAdmin`) and already surfaced New·24h/7d. The gaps were **no 30d
   window and no freshness timestamp**, so slow-but-real growth (118/30d) wasn't legible. Persistence
   works (productive runs accrete via `vault-accretion` in the process route).
2. **Intelligence Observatory "static":** by construction it scores **capability maturity from curated
   ML acceptance artifacts** (`ml/data/acceptance/*.json` via `loadSnapshotInputs`/`loadLatest*`), which
   do not move with daily production. Live DB reads existed only for preferences/validations/feedback —
   **actual productive runs and delivered evaluations were not surfaced anywhere.**
3. **Launch Readiness "static":** `buildLaunchReadiness` is genuinely **evidence-driven** (route is
   `force-dynamic`, no hardcoded score), but its evidence is the same curated capability plane + a
   bundled validation-evidence file. It is **correctly** static until the underlying verified evidence
   changes; it must not be manually bumped (§14/§17). Moving it requires updating the curated evidence
   to reflect newly verified gates — a separate, auditable evidence-ingestion step, not a code bump.

## Implemented corrections (this sprint)
- **Live operational-activity source** — `lib/admin/operational-activity.ts` (pure) + admin-only,
  `force-dynamic` route `/api/admin/operational-activity`. Reads the canonical tables the pipeline
  writes and reports, per 24h/7d/30d window + last-activity timestamp: **intelligence runs**
  (`snapshot_reports` job_id `intel_*`; `distinct_runs` de-dupes recovery retries), **delivered
  evaluations** (`account_intelligence_charges`; one row = one charged company; `distinct_analyses`
  de-dupes the run), **new Vault companies** (`first_seen_at`). Fail-visible: an unavailable source is
  reported, never replaced with a fabricated zero (§28).
- **Vault summary growth + freshness** — `summarize()` now also computes `newCompanies30d`,
  `reobserved30d`, `lastWriteAt`, `lastObservationAt`. Surfaced on `/admin/vault` alongside a live
  "Operational activity" panel and a "refreshed at" timestamp.
- **No change to Launch Readiness scoring** (it is evidence-driven and correct); documented why it is
  static and how to move it (evidence ingestion of verified gates).

## Canonical metric definitions (operational-activity)
| Metric | Source table | Numerator | De-dup | Window |
|---|---|---|---|---|
| Intelligence runs | `snapshot_reports` (`intel_*`) | rows with a valid `created_at` | `distinct_runs` = distinct `job_id` | 24h/7d/30d + total |
| Delivered evaluations | `account_intelligence_charges` | one row per charged company | `distinct_analyses` = distinct `analysis_key` (=runId) | 24h/7d/30d + total |
| New Vault companies | `vault_companies` | `first_seen_at` in window | canonical company id (upsert) | 24h/7d/30d + total |

Distinctions preserved (§4/§26): discovered candidate ≠ qualified company ≠ delivered evaluation; a
reused Vault company is not a new company (new = `first_seen_at`); a recovery retry does not double-count
(`distinct_*`). Acceptance/disposable activity self-deletes, so live counts trend toward real activity.

## Refresh behavior (§12/§27)
Both the vault route and the operational-activity route are dynamic (admin auth ⇒ per-request) — new
persisted activity appears **without a redeploy**. No new scheduler, no continuous polling; the panels
fetch on load and show a "refreshed at" timestamp. Bounded projections only; small tables aggregated
once in memory (no N+1).

## Tests / gates
`operational-activity` **10/10** (windows nested, non-intel job ids excluded, `distinct_*` de-dup,
empty/malformed → zeros + null timestamps), `vault-view` **39/39** (incl. new 30d + `lastWriteAt`/
`lastObservationAt`). TypeScript clean · build clean · **release:check EXIT 0** · git diff --check clean.
No existing assertion weakened.

## Production verification status (§36)
CODE FIXED + DETERMINISTICALLY VERIFIED + live-DB baseline confirmed. **NOT yet PRODUCTION_ADMIN_VERIFIED**
— the branch `admin-intelligence-vault-observability-v1` is pushed and awaits protected-main merge +
deploy; the deployed Admin was not opened this sprint (needs an admin session on the deployed app).

## Remaining limitations
1. **Launch Readiness** still reflects curated evidence; surfacing the recently verified gates (one-time
   enforcement deployed, 064 applied, full-order acceptances) requires an evidence-ingestion step, not a
   code change — deliberately out of scope (no manual score bump).
2. **Intelligence Observatory** capability scores remain artifact-driven (maturity, by design); the new
   operational-activity panel is the live complement. Fully merging the two into one Observatory view is
   a follow-up.
3. **Production-admin verification** pending merge + deploy + an authenticated admin session.
