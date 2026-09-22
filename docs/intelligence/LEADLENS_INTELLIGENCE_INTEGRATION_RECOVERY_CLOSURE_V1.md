# LeadLens — Intelligence Integration + Production Recovery Closure V1

Outcome: **the push/PR bottleneck is resolved — the Intelligence branch is now on the remote** (32 commits
ahead of `main`, 0 behind, clean, hard gates green). Integration is **READY FOR PR** (PR creation + protected-
main merge are founder actions: `gh` is not installed and `main` is protected). Production recovery is proven
in code + deterministic + isolated-live tests (Levels 1–3); Levels 4–7 require a production deploy + secrets and
are **founder/external**. No product code changed this session (release engineering only).

## Repository (verified this session)
- Branch `intelligence-launch-acceptance-v1` · worktree `leadlens-landing-v2` · remote
  `git@github.com:martinfgaleano-crypto/leadlens-ai.git`.
- Local HEAD `34b8a40` → after this doc; **pushed** `40bf8cc..34b8a40` to `origin/intelligence-launch-acceptance-v1`.
- `origin/intelligence-launch-acceptance-v1` now = local HEAD (verified match); **32 ahead / 0 behind `origin/main` (`c682c9f`)**.
- Working tree clean. Backups: `intel-backup-bd455e9-20260921`, `intel-backup-f6ade2e-20260921`,
  `intel-backup-34b8a40-20260922`.

## Integration audit (hard gates — all PASS)
67 files vs main: 23 docs, 17 scripts, 13 lib (Intelligence), 11 ml (acceptance artifacts), 2 app (runner-
injection wirings), 1 `vercel.json` (recover cron). **Sensitive-area scan: none** — no billing / migrations /
schema / pricing / landing (`app/page`) / `.env` / entitlement / catalog product-code changes. No literal
secrets (only env-var NAMES in docs). `VAULT_REUSE_MODE` default **OFF** preserved (`?? "OFF"`). Tenant
isolation / canonical decisions / commercial catalog / credit semantics: unchanged. No new dependencies, no
migrations, no destructive changes. release:check **EXIT 0**; git diff --check clean.

## Integration result
- Integration method: fast-forward push of the existing validated history to the remote feature branch (no
  rebase/force; all 32 commits preserved; source branch intact). `main` is 0 behind → no conflicts.
- Remote HEAD: `34b8a40` (pre-doc) → updated by this doc commit + push.
- **PR: not created** — `gh` CLI not installed. Open it here:
  `https://github.com/martinfgaleano-crypto/leadlens-ai/compare/main...intelligence-launch-acceptance-v1`
  (the remote branch is current, so this compare reflects the exact 32-commit diff).
- **Merge: not performed** — `main` is protected; merge is a founder action through the GitHub PR workflow
  (required checks/reviews). Do not push to protected `main` directly.

## Runtime architecture (unchanged; verified)
Process route `maxDuration=300 s`; durable run records; stage checkpoints (`saveStage`); `recoverStaleRuns` +
execution-generation CAS fencing; idempotent (exactly-once) materialization; charge-at-materialization
(failures excluded). Recover endpoint `/api/internal/intelligence-runs/recover` accepts Vercel Cron
(`Authorization: Bearer <CRON_SECRET>` + GET). Cron in `vercel.json`: `*/15 * * * *`.

## Recovery acceptance levels
- L1 code implemented: **PASS**
- L2 deterministic tests: **PASS** (`intelligence-run-recovery` 19/19)
- L3 isolated live recovery: **PASS** (`accept-run-recovery` 10/10: stranded → RESUMED+COMPLETED, gen 1→2
  fenced, exactly-once, customer-loadable, second wake no-op — proven this cycle)
- L4 cron deployed in prod: **UNVERIFIED** (branch not deployed)
- L5 cron invocation observed: **UNVERIFIED**
- L6 durable recovery in deployed env: **UNVERIFIED**
- L7 prod customer completion / idempotency / credit: idempotency + credit proven in the isolated test;
  **production** verification: **UNVERIFIED**

## Environment / deployment dependencies (founder/external)
- Required env (names only; **absent locally = production-only**): `CRON_SECRET` (Vercel Cron Bearer + route
  auth), `INTERNAL_RUN_SECRET` (recover route re-dispatch to the processor). Present locally: Anthropic/Tavily/
  Firecrawl. Production presence: **NOT ACCESSIBLE from here.**
- Hosting-plan cron compatibility: `*/15` is a sub-daily schedule (Vercel Pro supports it; the project already
  runs 3 crons). Requires the branch to be **deployed** for the cron to exist in prod.
- Deployment protection must not 401 the cron path.

## Product safety
`VAULT_REUSE_MODE=OFF` (not activated). Portfolio/Premium remain wired-not-accepted (not enabled). No
entitlement/pricing/catalog change. No live customer orders touched. Incomplete-order honesty unchanged
(delivery reports the true count; the acceptance harness surfaced 5-vs-6 without silent full-fulfillment).

## Tests / gates
release:check **EXIT 0** (tsc + ~45 suites + build) · git diff --check clean · run-recovery 19/19 ·
one-time-fulfillment 32 · monitor-recurring-usage 12 · vault-reuse-qualification 44 · Track B 7/8.

## Remaining external blockers (top 3)
1. **PR + merge** — `gh` unavailable and `main` protected: founder opens the PR (compare link above) and merges
   through the GitHub workflow.
2. **Production deploy + secrets** — set `CRON_SECRET` + `INTERNAL_RUN_SECRET` in Vercel prod and deploy the
   merged main so the recover cron exists (Levels 4–6).
3. **Observe a live cron invocation** recovering a long (>300 s) job in the deployed environment (Level 5–6).

## Exact founder actions (in order)
1. Open the PR: `https://github.com/martinfgaleano-crypto/leadlens-ai/compare/main...intelligence-launch-acceptance-v1`
   and merge after required checks pass (do not enable `VAULT_REUSE_MODE`).
2. In Vercel prod, set `CRON_SECRET` and `INTERNAL_RUN_SECRET`; deploy merged `main`.
3. Confirm (deployment logs / durable run state) that the `*/15` recover cron authenticates and reclaims a
   stalled run — closing recovery Levels 4–6.
