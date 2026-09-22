# LeadLens — Customer Product Acceptance V1 (Preview)

Verdict: **Integration is LIVE in production; Preview commercial acceptance is BLOCKED on Anthropic credits.**
The Intelligence branch was merged (PR #24) and **deployed to production successfully**, and production recovery
is operational via GitHub Actions. Live Preview delivery cannot be run because the Anthropic credit balance is
exhausted (verified). The Preview entitlement/consumption model is deterministically verified on the billing
side; the customer-visible 2-account delivery cap is implemented but requires a paid-entitlement live run to
observe end-to-end.

## Repository & deployment (LIVE_OBSERVED, this session, via authenticated Vercel CLI + public GitHub API)
- `origin/main` = **`20ab9c0`** = "Merge pull request #24 from …intelligence-launch-acceptance-v1" → **Intelligence integrated into main.**
- **Production deployment: `● Ready`** (leadlens-3nyjy4t6w…, Production, created ~3 min after merge) → the merged Intelligence code is **serving on leadlensintel.com**.
- Prior production was 6 days old; the merge produced a fresh successful production deployment.

## Recovery (LIVE_OBSERVED)
`.github/workflows/intelligence-run-recovery.yml` (`*/15` → authenticated GET prod `/api/internal/intelligence-runs/recover`
with `CRON_SECRET`) runs **green on main every ~15 min** (latest success 2026-09-22 20:02). `CRON_SECRET` +
`LEADLENS_PRODUCTION_URL` are configured as GitHub secrets (the workflow errors if empty; all runs pass). No
Vercel cron (the redundant one was removed pre-merge). Durable recovery re-proven isolated (accept-run-recovery
10/10, exactly-once, robust under credit exhaustion) in the prior session.

## Provider status
**Anthropic credits EXHAUSTED** — a minimal probe returns `invalid_request_error: "Your credit balance is too
low to access the Anthropic API."` Per the run policy, no live generation was attempted. Live Preview delivery
(which needs Anthropic research) is **blocked until the founder tops up credits.**

## Preview contract (CONTROLLED_VALIDATED)
- Catalog: **Preview = $7 / 2 companies**; one-time fulfillment grants `opportunity_target = 2` credits
  (`lib/billing/one-time-fulfillment.ts`). Idempotent (UNIQUE external_order_id): fixture `one-time-fulfillment`
  32/32.
- One-time consumption is on the `customer_credits` / `opportunity_target` ledger, **separate** from
  subscription usage-period metering (`account-metering.remainingAllowanceForRun` returns `null` = uncapped for
  one_time/internal, by design). The 2-company customer scope is applied at the **delivery layer** (server-
  resolved tier via `lib/delivery-system/server/deliverable-for-viewer.ts` — the client can never escalate the
  tier), not by the subscription meter.
- This explains the earlier unmetered harness delivering **3** `processed_leads`: a disposable beta user has no
  one-time entitlement, and the harness measured raw research breadth (`researchLimit`), not the customer's
  tier-capped Preview view. It was a test-harness artifact, **not a demonstrated paid-fulfillment defect** — so
  no correction was made (no reproducible defect).

## Deterministic entitlement/consumption verification (CONTROLLED_VALIDATED)
`one-time-fulfillment` 32, `entitlements-v1` 30, `billing-plan-mapping` 29, `product-catalog` 27,
`monitor-recurring-usage` 12 — all green. Grant, idempotency, plan mapping (2/6/12/18), and catalog are sound.

## What remains for Preview commercial acceptance (blocked)
A single **paid-equivalent live Preview run** (real 2-credit entitlement, plan=sample, delivery_limit=2) to
observe: (a) the customer-visible result shows **exactly 2** evaluations; (b) **exactly 2** `opportunity_target`
credits consumed; (c) safe retry (no third charge); (d) tenant isolation. **Blocked on Anthropic credits.**

## Release envelope (per product × market)
| Product | State |
|---|---|
| Preview CO/US | Intelligence core LIVE_OBSERVED (prior); **paid-equivalent Preview acceptance BLOCKED (Anthropic credits)** |
| Brief CO | 6/6 LIVE_OBSERVED (prior) · Brief US | 5/6, 0 off-target (prior) |
| Portfolio (12) / Premium (18) | PRODUCTION_WIRED + unit-verified; NOT full-order accepted |
Integration: **PRODUCTION_DEPLOYED** (new this session). VAULT_REUSE_MODE default **OFF** in prod.

## Remaining blockers (top 3)
1. **Anthropic credits exhausted** — blocks every live Preview/Brief/tier acceptance run (founder top-up).
2. **Customer-visible 2-cap not live-verified** — the delivery-layer cap is implemented but needs one paid-
   entitlement live run to confirm the customer sees exactly 2 and consumes exactly 2.
3. Portfolio/Premium full-order acceptance still pending (and would need credits + long-order runtime, already
   recovery-backed).

## Next founder action (ONE)
**Top up the Anthropic credit balance.** It is the single blocker preventing the paid-equivalent Preview
acceptance run (and all further live commercial acceptance). Integration is already merged and deployed; no
code or deployment action is needed to proceed once credits are available.
