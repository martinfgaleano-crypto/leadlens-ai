# LeadLens — One-Time Credit Enforcement V1

Approved commercial model: **B — one credit per valid company evaluation delivered.** This sprint
closes the demonstrated Preview commercial gap (a one-time purchase granted credits but the
Intelligence path never consumed them, so a single $7 Preview could generate unbounded 2-company
reports). The correction is a **single coherent change wired with existing primitives** — no new
migration, no new ledger, no new resolver, no billing redesign.

## Approved commercial model (frozen by HQ)
A one-time credit authorizes exactly one valid commercial evaluation of one company. Preview grants
2, Brief 6, Intelligence(Portfolio) 12, Premium 18. Each credit is consumed once when a valid,
authorized company evaluation is durably materialized for delivery. A failed research attempt does
not consume a delivery credit. A duplicate/recovery execution does not re-charge an already-charged
evaluation. A customer may reopen an acquired report without consumption. A customer may not generate
additional billable evaluations after exhausting the one-time allowance. Additional legitimate
purchases grant additional credits through the existing canonical fulfillment.

## Authoritative ledger contract
- **Balance authority (one-time):** `customer_credits.credit_balance` (migration 010), `CHECK
  (credit_balance >= 0)` — the row itself makes oversell impossible.
- **Exactly-once identity:** the EXISTING `account_intelligence_charges` table (migration 062),
  `UNIQUE (user_id, analysis_key, account_key)`. The one-time path reuses it with the same commercial
  unit as the metered path — 1 credit per (customer, logical analysis = **runId**, account) — tagging
  one-time rows with a sentinel epoch `period_start` (`ONE_TIME_CHARGE_PERIOD`) so they never collide
  with subscription period accounting. A technical retry/recovery of the same runId is a 0-cost no-op;
  a NEW legitimate purchase is a new runId → a new row → a new charge.
- **Consumption is separate from subscription metering (§13):** one-time draws down `customer_credits`;
  subscription/beta draw down the `subscription_usage_periods` period ledger. Neither touches the
  other. Internal is unlimited. Precedence (matrix §24) is unchanged: an active subscription funds the
  run and one-time credits are preserved.

## Run authorization
`intelligenceRunGate` (server-authoritative, resolved from durable state) now blocks a **one_time**
customer whose balance is 0 from STARTING new billable research (402 `usage_limit_reached`). Viewing
an already-acquired report is a SEPARATE path (result routes resolve ownership, not this gate), so a
zero balance never blocks reopening a purchased report. Subscription/beta/internal gating unchanged.

## Atomic consumption (`claimOneTimeCredit`, lib/billing/usage-ledger.ts)
1. **Idempotency pre-check** on (user, analysis_key, account_key) → alreadyCharged (0 cost).
2. **Reserve:** optimistic-CAS decrement of `customer_credits` (`update … where credit_balance = read`)
   — two concurrent claims for the final credit let at most one succeed; the DB `CHECK (>= 0)` is the
   last-line guard.
3. **Record** the append-only charge; a concurrent duplicate insert (unique violation) **releases**
   the reserved credit (CAS increment), so a race resolves to exactly one debit + one charge row.

## Production integration (no new wiring in the executor)
The processor already injects two seams from `account-metering`; one-time simply stops no-op'ing them:
- **`remainingAllowanceForRun`** → for one_time, the production cap is the durable balance (+ this
  run's own prior charges, so a recovery re-run reproduces its already-charged accounts instead of
  starving). The executor caps research/delivery by it → never materializes more than the purchase
  funds.
- **`chargeMaterializedAccounts`** → for one_time, charges one credit per materialized company
  (`report.canonical_cases[].account_id`), idempotent per (user, runId, account), allowance-bounded.
  Called after the fenced finalize; a superseded/duplicate executor never reaches it.

## Idempotency identity
Stable charge identity = (user_id, analysis_key = **runId**, account_key = canonical **account_id**).
NOT run-id alone (a run delivers multiple companies) and NOT company-id alone (a later legitimate
purchase re-evaluates the same company under a new runId). This mirrors the Account Memory key.

## Concurrency protection
The CAS decrement + `CHECK (>= 0)` guarantee no oversell and no negative balance under concurrent
claims; the unique charge row + refund-on-duplicate guarantee exactly one net debit per logical
evaluation. Proven deterministically (fixture E/F) and required by the row constraints regardless of
interleaving.

## Failure & recovery
- Research fails before materialization → the account is never passed to the charge seam → no debit.
- Worker crashes before finalize → the fenced `runStore.save` gate means only the winning attempt
  charges; a recovery re-run re-derives its own accounts (budget adds prior charges back) and the
  idempotency key makes re-charging a no-op.
- Charge committed but the completion event replays → alreadyCharged, no extra debit (proven live).
- Partial order (§23): only materialized valid companies are charged; the unfulfilled allowance
  remains on the balance for a later safe run. The order is never silently marked fully fulfilled.

## One-time vs subscription coexistence (§27)
Funding source is chosen by the existing precedence in `resolveEntitlements` (subscription > internal
> one_time > beta): an active subscriber's run is funded by the subscription period ledger and
one-time credits are preserved; a customer with one-time credits and no subscription is funded by
`customer_credits`. This sprint did not change the precedence or invent a new source-selection rule.

## Deterministic acceptance — `scripts/fixtures/one-time-credit-enforcement.test.ts` (27/27)
Against a fake Supabase that enforces the two real constraints (`credit_balance >= 0`; charge
`UNIQUE`): first/second/third evaluation; idempotent retry; new-analysis re-charge; per-company charge
+ budget cap; recovery add-back; concurrency (one credit → at most one crosses; duplicate → one net
debit); failed-generation safety; run gate (one_time 0 → 402, one_time>0 → allow, beta/internal
unaffected); subscription non-regression (one-time bucket untouched). release:check EXIT 0.

## Live paid-equivalent Preview acceptance — `scripts/accept-one-time-enforcement.mts` (21/21)
Disposable purchaser (profiles.plan=`sample`), Colombia WMS context, real pipeline. The legacy
welcome pool (100) was observed then reset to a clean purchase-only ledger (see blocker below) so the
mechanism is proven against what a purchase-only balance would be.

| Stage | balance |
|---|---|
| welcome pool observed | 100 |
| reset → clean | 0 |
| after Preview grant | **2** |
| before run | 2 |
| after run (2 companies materialized) | **0** |
| after replay/recovery | **0** |

Delivered: **2** (Coca-Cola FEMSA Colombia, Logisfashion), decisions grounded. Charges: **2**, all
keyed to the runId (`intel_831773…`). Verified LIVE: exactly one credit per delivered evaluation; the
budget cap researched exactly 2 (not 3); remaining balance 0, never negative; replay/recovery → no
extra debit; report reopen at 0 → allowed + free; **a third billable run at 0 → 402
`usage_limit_reached` with zero provider research**; second tenant → 404, zero cross-tenant charges.
Run `intel_831773db619e99e5297723a2b063b64c`. (Two earlier attempts surfaced the setup issues below —
a disposable user has no profiles row, and the profiles INSERT fires the welcome-credit trigger.)

## ⚠ Production blocker (returned to HQ) — legacy welcome-credit commingling
`customer_credits.credit_balance` is **not** a clean purchase ledger. Migration 010 installs a live
trigger (`on_profile_created` → `bootstrap_customer_credits`) that grants **100 welcome credits** on
every `profiles` INSERT, and `lib/commercial/ensure-profile.ts` inserts that row on signup. So every
real user holds 100 credits; a Preview buyer holds 102. The enforcement mechanism is correct and
proven, but against a 102-credit balance it caps the purchase at 102 evaluations, not 2 — the purchase
scope is not enforced in production until the welcome grant is resolved. This is a pre-existing
commercial/data decision (§58), not something this sprint decides:
- **New signups:** a proposed forward migration `supabase/migrations/064_disable_welcome_credit_bootstrap.sql`
  (NOT APPLIED — founder applies) removes the trigger so new balances reflect purchases only. Requires
  HQ confirmation that new users should no longer get 100 free welcome credits (if a trial allowance is
  still wanted it must be a separate bucket, not commingled).
- **Existing users** who already hold 100 welcome credits are a separate population; per §28/§59 no
  retroactive deduction was performed — reconciling them is a distinct HQ decision.

Until (at least) the new-signup migration is applied, PRODUCTION purchase-scope enforcement is
**BLOCKED**; the mechanism is READY and will enforce correctly the moment customer_credits reflects
purchases only.

## Higher one-time tiers (Brief 6 / Portfolio 12 / Premium 18)
The consumption contract is tier-agnostic: the same `remainingAllowanceForRun` cap +
`chargeMaterializedAccounts` per-company charge apply to every one-time product; the allowance is the
server-resolved grant (`opportunity_target`). No per-tier ledger, no Preview-only hardcode. Full live
orders for the higher tiers were not run (§45/§58 — out of scope; supply/runtime constraints tracked
elsewhere); the per-company ledger contract is proven deterministically and via the live Preview.

## Historical data policy (§28/§59)
Forward-only. No historical balances were deducted, no order was altered, no backfill was performed.
Customers granted one-time credits before enforcement keep their balances; enforcement applies to new
runs. No negative balances are creatable (CAS + CHECK).

## Subscription non-regression
`isMetered`/`meteredPeriod`/`claimAccountIntelligenceCredit` (subscription + beta) and
`monitorUsageGate` are unchanged; the one-time branch is additive and mutually exclusive by access
source. `monitor-recurring-usage` 12/12, `usage-ledger` 6/6, `billing-plan-mapping` 29/29,
`tier-differentiation` 38/38, `product-catalog` 27/27, `one-time-fulfillment` 32/32,
`entitlements-v1` 32/32 remain green.

## Production deployment requirements
Migrations 010/062/063 are already applied (per project migration state) — this change needs **no new
migration**. It ships with the normal branch → PR → merge → deploy flow. `INTERNAL_RUN_SECRET` +
`CRON_SECRET` remain the standing prod requirements for the processor/recovery cron (unchanged).

## Concurrency closure (§8/§19 — CLOSED)
The charge layer was atomic/idempotent, but two simultaneous runs could each pass the start gate and
each DELIVER a company while only one charged — a free delivery a presentation cap cannot prevent.
Closed by **gating delivery on charge**: at materialization the spine charges each portfolio account
and `onRunMaterialized` returns the authorized subset (charged ∪ already-charged); the spine drops any
account the allowance could not cover, so a concurrent loser delivers nothing. Charging moved before
the fenced finalize; idempotent per (user, runId, account) so a superseded/recovery attempt re-charges
as a no-op and no evaluation is lost or double-charged. No new table/reservation — reuses the existing
CAS. Unmetered/internal → all authorized; fail-open on metering error (never withholds a completed
result, never over-charges). Subscription/beta gains the same protection.
- **Deterministic:** spine delivery-gate none/all/partial (`productive-intelligence-spine` 34/34);
  concurrent-runs authorization + tier cases (`one-time-credit-enforcement` 39/39).
- **LIVE vs real Supabase Postgres atomicity** (`accept-one-time-concurrency.mts` 10/10): 6 concurrent
  claims / 1 credit → exactly 1 charged; duplicate → 1 net debit; 2 concurrent runs / 1 credit →
  exactly one authorized; 3 runs / 2 credits → ≤2; tenant isolation. Never negative, never oversold.

## Legacy welcome-credit audit (Phase 1, read-only)
Aggregate audit of the live ledger (no PII): 7 `customer_credits` rows (5×100, 1×1-99, 1×101-102);
20 `credit_transactions` (19 grants, 1 consume). Provenance is **clean and exact** — welcome grants
carry description "Welcome credits — account created", paid grants "one-time … order …": 18
welcome-grant users, 1 paid, **0 ambiguous**, 1 with both (a Preview buyer at 102). So historical
reconciliation is exactly determinable from `credit_transactions` provenance; the affected population
is tiny (early beta). **Reconciliation design (proposed, NOT executed per §7/§15):** for each user,
`purchased_remaining = Σ(paid one-time grants) − Σ(one-time consumes)`; set `credit_balance` to that,
dropping only the welcome portion — an auditable, provenance-based maintenance step run by the founder
against a verified backup. No "subtract 100 from everyone" heuristic; ambiguous provenance (none
found) would be preserved untouched. New-signup fix = migration 064 (drop the trigger).

## Higher one-time tiers (Brief 6 / Portfolio 12 / Premium 18)
**Enforcement: PASS (tier-agnostic).** The same cap + per-company charge + gate apply to every
one-time product from the server-resolved grant (`opportunity_target`): deterministic tier cases
(grant 6/12/18 → exactly N charged, allowance not exceeded, gate at 0) + plan mapping
(`billing-plan-mapping` 29) + the live Preview charge path. **Full-order quality (6/12/18 distinct
relevant companies): NOT ACCEPTED** — supply-bound for the frozen Colombia context (~2-3 fresh) and the
strict US ICP (~5) without the `VAULT_REUSE_MODE` reuse fallback, which §35 forbids forcing/expanding.
A supply-limited live higher-tier order would prove enforcement-at-scale (already proven
deterministically) but not the commercial 6/12/18 count, so it was not run (§40). Full-order quality is
a separate supply/rollout track (reuse-fallback flag is an HQ decision), not an enforcement gap.

## Remaining limitations / boundaries (returned to HQ, not fixed here)
1. **Welcome-credit commingling (production blocker).** New signups: apply migration 064 (founder,
   prod DDL). Existing 100-credit balances: the provenance-based reconciliation above (founder, backup).
2. **Open-beta coexistence.** A customer with 0 one-time credits and `plan=free` resolves to `beta`
   (separate 10-credit metered bucket), so one-time exhaustion blocks the one-time source but not beta
   access. Real one-time fulfillment does not set `profiles.plan`; whether to mark plan on purchase /
   close beta is an HQ posture decision, not a Model B defect.
3. **Higher-tier full-order quality** (6/12/18 distinct relevant companies) is supply-bound — a
   separate reuse-fallback/rollout decision, not an enforcement gap.
