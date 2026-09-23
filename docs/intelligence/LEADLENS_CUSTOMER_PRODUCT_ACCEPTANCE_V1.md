# LeadLens — Customer Product Acceptance V1 (Preview)

Verdict: **Preview Intelligence core is LIVE-ACCEPTED in both markets; commercial-entitlement consumption is
PARTIAL (deterministically verified, not exercised through a live paid one-time entitlement).** The Intelligence
integration is merged (`main` = `20ab9c0`) and deployed to production; Anthropic credits were restored and two
live Preview orders completed successfully (Colombia + USA), each delivering valid, on-target companies through
the real productive pipeline. The exactly-2 customer scope and idempotent grant are verified; the literal
one-time credit-ledger decrement was not run because the acceptance harness uses a beta (uncapped-metering) user.

## Provider & repository
- Anthropic: **AVAILABLE** (health probe HTTP 200; earlier exhaustion resolved by founder top-up).
- `origin/main` = `20ab9c0` (PR #24 merged); production deployment **● Ready** (verified prior session).
- Recovery: GitHub Actions `intelligence-run-recovery.yml` (`*/15`) green on main. `VAULT_REUSE_MODE` default OFF.
- No product code changed this sprint; doc branch `customer-product-acceptance-v1`.

## Canonical Preview contract (CONTROLLED_VALIDATED)
Preview = **$7 / 2 companies**. One-time fulfillment grants `opportunity_target = 2` credits, idempotent via
UNIQUE(external_order_id) (`one-time-fulfillment` 32/32). Customer-facing scope is capped at the **delivery
layer**: `tier-composer.ts` `doc.accounts.slice(0, maxAccounts)` (maxAccounts mirrors the catalog operating
limit; server-resolved tier, client cannot escalate) — `tier-differentiation` golden **38/38**. Internal
research may evaluate more than 2 candidates (not overdelivery, §7); the customer sees exactly `opportunity_target`.

## Colombia Preview — LIVE_OBSERVED (16/16 harness checks)
Frozen context: warehouse-automation/WMS seller. Run `intel_…` (artifact `customer-e2e-1790128872730.json`),
plan `sample`. Fresh sufficient (reuse off). Evaluated 3 valid Colombian companies — **Coca-Cola FEMSA Colombia
(WARM), Alpina (WARM), Colombina (WARM)** — canonical Cases generated, Account Memory seeded (3), other-tenant
load → 404. COGS **$0.25** Anthropic; runtime ~296 s. Customer-facing Preview caps to 2 (tier composer). All
delivered identities are correct, in-geography, target-relevant operating companies. **Acceptance: core PASS.**

## USA Preview — LIVE_OBSERVED (16/16 harness checks)
Frozen context: US industrial-automation seller (manufacturers with owned plants). Run `intel_3363d3cc…`
(artifact `customer-e2e-1790129251653.json`), plan `sample`, `VAULT_REUSE_MODE=ELIGIBLE_FALLBACK`. Fresh thin →
fallback fired, 5 reused qualified → 6 pre-selected → 3 researched → **2 delivered: American Packaging
Corporation (WARM, reused Vault manufacturer), Across International (COLD, industrial-equipment maker)**; Palmetto
State Armory (firearms) correctly DISCARDed → **0 off-target**. Other-tenant load → 404. COGS **$0.22**; runtime
~284 s. **Acceptance: core PASS**; depends on controlled `ELIGIBLE_FALLBACK` (production default OFF — prod OFF
would not reproduce the reuse contribution).

## Credit safety / consumption (CONTROLLED_VALIDATED; live paid-ledger NOT exercised)
- Grant exactly-once/idempotent: `one-time-fulfillment` 32/32.
- Delivery scope = `opportunity_target` (2): tier-composer slice + `tier-differentiation` 38/38.
- Subscription metering (charge-at-materialization, exactly-once, failures excluded): `entitlements-v1` 30,
  `monitor-recurring-usage` 12, `account-metering` design. One-time consumption is on the separate
  `customer_credits`/`opportunity_target` ledger (not decremented at run for one_time — `remainingAllowanceForRun`
  returns null for one_time by design; scope is enforced at delivery).
- **Limitation:** the e2e harness uses a beta user (no one-time entitlement), so the literal customer_credits
  decrement for a live paid Preview was not observed. Grant + delivery-cap are verified; the paid-ledger
  decrement path remains to be exercised with a real one-time entitlement.

## Tenant isolation / recovery
Both runs: owner loads durable result; **other tenant → 404**. Durable recovery: GHA cron live + isolated
accept-run-recovery 10/10 (prior), run-recovery 19/19. Neither Preview run was interrupted, so production
recovery was not exercised this sprint (it is independently verified).

## Runtime note
Two of the Preview runs this session hit a transient network outage mid-run (Anthropic "Connection error" +
Supabase `fetch failed`) and failed the save; a clean re-run then passed 16/16. This is environmental
instability, not a code defect — and it re-confirms the value of the durable recovery mechanism for production.

## Tests / gates
`one-time-fulfillment` 32 · `entitlements-v1` 30 · `tier-differentiation` 38 · `http-surface-security` 12 ·
`intelligence-run-recovery` 19 — all green. Two live Preview e2e runs 16/16 each. No code changed → no
regression; `release:check` last EXIT 0 on merged main.

## Release envelope
| Product × Market | State |
|---|---|
| Preview CO | **LIVE core PASS** (3 valid, tier-capped to 2); paid-ledger consumption CONTROLLED_VALIDATED |
| Preview US | **LIVE core PASS** (2 valid, 0 off-target); depends on controlled fallback; paid-ledger CONTROLLED_VALIDATED |
| Brief CO 6/6 · Brief US 5/6 | prior LIVE |
| Portfolio 12 / Premium 18 | PRODUCTION_WIRED + unit-verified; NOT full-order accepted |
Integration: PRODUCTION_DEPLOYED (`20ab9c0`).

## Remaining blockers (top 3)
1. **Paid one-time credit-ledger consumption** not exercised live — needs a disposable user granted a real
   Preview one-time entitlement, then load the tier-composed deliverable and confirm 2 shown + ledger effect.
2. **US Preview depends on `ELIGIBLE_FALLBACK`** — production default OFF would not reproduce the reused
   contribution (a rollout decision, not a defect).
3. Portfolio/Premium full-order acceptance still pending.

## Next action (ONE)
Exercise a **live paid-equivalent Preview** via the authorized one-time entitlement grant (disposable user →
grant 2 `opportunity_target` credits → run → load the tier-composed deliverable → confirm exactly 2 shown + the
credit-ledger effect), closing the one remaining commercial-entitlement gap. Do not enable `VAULT_REUSE_MODE`
globally.
