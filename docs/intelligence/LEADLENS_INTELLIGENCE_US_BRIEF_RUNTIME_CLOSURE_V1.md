# LeadLens — US Brief + Production Runtime Closure V1

Verdict: **US Brief = PARTIAL (6 delivered, 5/6 on-target) · Production Runtime = PASS (recovery proven live +
scheduled) · Repository = READY FOR PR.** The two HQ blockers from Brief Full-Order V1 were addressed with one
focused correction each. Builds on `LEADLENS_INTELLIGENCE_BRIEF_FULL_ORDER_ACCEPTANCE_V1.md`.

## Repository
Branch `intelligence-launch-acceptance-v1` · worktree `leadlens-landing-v2`. Start HEAD `bd455e9` → end
`d2edd53` (+ this doc). Backup tag `intel-backup-bd455e9-20260921`. origin/main `c682c9f` (0 behind);
origin/branch `40bf8cc` (older). Push: NO · Merge: NO · tree clean. 28 prior commits preserved; V2 & Brief V1
reproducible; Hybrid Candidate Universe intact.

## US funnel forensics (Brief V1 baseline → cause)
V1 universe 43 = 3 fresh (Aras→DISCARD, Palmetto→COLD, InnovativeTek→COLD — all weak) + 2 qualified reused
(SunOpta, Mars). Only **5 research-ready < 6** → 4 delivered. Root cause = **research-ready SUPPLY**, not
Discovery: qualification attempted only 12 of 39 eligible reused (maxQualify=12), and the neutral fetch had
no stable order, so which 12 were attempted varied run-to-run (V2 qualified 7/12, V1 2/12 — same pool). The
pipeline researches `min(candidates, max(targetCount≈10, researchCandidateLimit))`; Colombia (13 research-
ready) researched 10 → 6 valid, USA (5) was supply-capped.

## Correction 1 — adaptive reused-qualification coverage (US supply)
`adaptiveQualificationBudget(deliveryTarget)`: when the thin-universe fallback fires, attempt enough eligible
reused to plausibly meet the delivery target (Brief 6 → maxQualify 18), hard-capped 30; `maxTotalFetches`
= 2× (bounded). Relevance bar unchanged (wrong_target/non-company gates intact). Plus deterministic
`.order(domain)` in the neutral fetch so the qualification batch is stable. Wired in `productive-spine` (only
active when fresh under-supplies). Files: `vault-reuse-qualification.ts`, `vault-reuse-deps.ts`,
`productive-spine.ts`, + tests (`vault-reuse-qualification` 37, `vault-reuse-wiring` 7).

## US Brief re-run (frozen industrial-automation context, plan `starter`, ELIGIBLE_FALLBACK) — LIVE_OBSERVED
Universe 42 (3 fresh + 39 reused). Qualification: attempted **18**, **qualified 8** (was 2), wrong-target 5,
non-company 4, unresolved 1, ops-blocked 0. **10 research-ready** → 10 researched → **6 delivered**:
| Company | origin | internal | assessment |
|---|---|---|---|
| Mars | fresh+vault | WARM 7.6 | ✅ food manufacturer |
| American Packaging Corporation | reused | WARM 7.5 | ✅ packaging manufacturer |
| Compact Industries, Inc. | reused | WARM 7.5 | ✅ contract manufacturer |
| Ferrero | reused | WARM 7.4 | ✅ food manufacturer |
| Across International | reused | COLD 4.0 | ✅ industrial-equipment maker (low fit) |
| DHL Supply Chain | reused | COLD 5.5 | ⚠️ **logistics — off-target, mis-qualified as manufacturer** |
DISCARDs correctly excluded: Oracle & Aras (software), Palmetto (firearms), NAWAH. **5 of 6 are genuine
relevant manufacturers/industrial makers; DHL is a role-attribution error** (its content reads as
manufacturer-adjacent), delivered at COLD/low-fit — the customer sees it as low priority, not a fabricated
opportunity, but it should not have been a candidate. Per §30 this is a target-relevance defect on 1/6, so US
Brief = **PARTIAL**, not a clean PASS — a strong improvement over V1 (4/6, 2 weak) but not perfect. Not fixed:
the one US correction allowance was spent on supply; DHL's mis-qualification is the residual role-variance
limit (see §13/§29). COGS **$0.786** Anthropic (32 calls), Tavily 47. Runtime **591 s**.

## Correction 2 — schedule the recovery cron (production runtime)
Both Briefs' research exceeds the process route `maxDuration=300 s` (US 591 s, CO 610 s). The dead-run recovery
endpoint (`/api/internal/intelligence-runs/recover`, generation-CAS resume) existed and was tested, but was
**NOT in `vercel.json` crons** — so a killed run would never auto-recover (manual restart isn't ordinary
fulfillment). Added the recover cron `*/15 * * * *`; the route already accepts Vercel Cron (Bearer CRON_SECRET
+ GET). **FOUNDER PROD ENV REQUIRED: `CRON_SECRET` + `INTERNAL_RUN_SECRET` set in Vercel prod.**

## Runtime acceptance (LIVE_OBSERVED, this session) — PASS
`accept-run-recovery.mts` **10/10**: real run → executor "died" (no completion) → stranded in processing →
recovery re-dispatched → **RESUMED and COMPLETED** → generation fenced 1→2 → **exactly ONE** report row (no
duplicate) → customer-loadable → second wake no-op. Covers §25 A–G: normal completion, interruption, durable
recovery, idempotency, customer visibility, credit safety (fenced/exactly-once), terminal fencing. **A Brief
exceeding 300 s completes safely via reclaim+resume**, no manual restart. Production cron execution +
deployment limits are env/deploy-dependent (not verifiable from this environment).

## Colombia non-regression
Structurally unaffected: the adaptive budget only changes behavior when the fallback fires (fresh under-
supply); CO fresh (22) is sufficient → gate closed → no qualification → adaptive budget & ordering are inert.
CO Brief V1 (6/6) stands. Fixtures green: lead-hunter-universe 30, vault-reuse-{config 16, identity 22,
integration 15, wiring 7}, vault-reuse-qualification 37, intelligence-run-recovery 19.

## Cost / economics
US Brief measured Anthropic **$0.786** (32 calls, ~130k tok); Tavily 47 (funded); Firecrawl bounded; unmetered
= search providers. ~$0.13/valid company. At $25 the Brief remains economically plausible (COGS << price),
excluding fixed infra. Not linearly extrapolated to Portfolio/Premium.

## Vault flag
Production default `VAULT_REUSE_MODE=OFF`. The US Brief's reused supply required `ELIGIBLE_FALLBACK`; **prod OFF
would NOT reproduce it** (Colombia does not depend on reuse). Rollout decision is HQ's, per market, after this
report. Not activated.

## Release states
US Core: CORE LIVE-OBSERVED (Brief 6 delivered, 5/6 relevant — PARTIAL) · Colombia Core: FULL BRIEF LIVE-
ACCEPTED. Runtime: PASS (recovery). Repository: READY FOR PR.

## Tests / gates
release:check **EXIT 0** (tsc + ~45 suites + build) · git diff --check clean · targeted suites all green (above)
· two live acceptance runs (US Brief 16/16, run-recovery 10/10) · Track B 7/8 preserved.

## Remaining limitations (red-team, top 3)
1. **Role-attribution mis-qualification** (DHL logistics → manufacturer) admits ~1 off-target company per US
   Brief at low fit — needs corroboration before wrong-target exclusion / a stricter role signal.
2. **US high-quality supply is thin**: reaching 6 relied on the full reused pool; a narrower US ICP or a run
   with lower qualification yield could still fall short.
3. **Production runtime is recovery-dependent, not single-pass**: correct + proven, but requires the founder
   cron env and adds wall-clock latency (multiple 300 s segments) for a Brief.

## Next action (ONE)
HQ decision: authorize a single follow-up to harden role attribution (require corroborating operating-role
evidence before qualifying, so logistics/adjacent firms are not admitted as manufacturers) — the one change
that would move the US Brief from PARTIAL (5/6) to a clean 6/6 — OR accept the current US envelope (broader ICP)
and proceed to prepare the branch PR. Do not relax relevance; do not start Portfolio/Premium acceptance yet.
