# LeadLens — Preview Commercial Closure V2 (One-Time Entitlement + Credit Ledger + Exact Delivery)

Verdict: **PREVIEW COMMERCIAL ACCEPTANCE = PARTIAL.** The paid-equivalent Preview core is proven — grant
credits the right amount (idempotently), the customer runs the real Intelligence pipeline, delivery is capped to
the tier's `opportunity_target` (2), and ownership/tenant isolation hold. **The one precise gap:** the new
customer Intelligence path does **NOT decrement the one-time credit ledger** (`customer_credits`). Consumption
is wired only into the dead legacy Apollo `process/search` route, not the productive Intelligence run. Whether
Preview should decrement per report or per company — and enforce a zero balance — is a **billing-MODEL decision**
(§32 forbids redesigning billing), so per the STOP rule this is returned to HQ rather than speculatively wired.

This sprint changed **no product code** — it is a read-only contract trace plus deterministic verification.

## Repository
Branch `preview-commercial-closure-v2` off `origin/main` (`20ab9c0`, 0 behind). Worktree `leadlens-landing-v2`.
This doc is the only change. Push: branch only (feature-branch push is allowed; `main` is protected — founder
opens the PR). No migration, no billing/pricing/entitlement/schema code touched. `VAULT_REUSE_MODE` default OFF.

## The traced one-time contract (Phase A, read-only — the authoritative finding)

Money → credits → run → delivery, as the code actually wires it:

1. **Grant.** `lib/billing/one-time-fulfillment.ts` → `fulfillCanonicalOrder` resolves the purchased product
   (variant→product authority) and calls `addCredits(userId, credits = product.entitlements.opportunity_target)`.
   Preview grants **2** into `customer_credits.credit_balance`. The order row is `UNIQUE`/idempotent, so a webhook
   replay grants **once** (verified: `one-time-fulfillment` 32/32).
2. **Entitlement resolution.** `lib/entitlements/entitlements-v1.ts` → `resolveEntitlements` reads
   `customer_credits.credit_balance`; sets `accessSource = "one_time"` when `isPaidPlan || credits > 0`;
   `canRunIntelligence = accessSource !== "none"`. There is **no branch that blocks a `one_time` user at balance
   0** and **no decrement here** (verified: `entitlements-v1` 30/30).
3. **Run entry.** `app/api/customer/intelligence-runs/route.ts` maps plan→`PLAN_DELIVERY`/`PLAN_RESEARCH` and sets
   `deliveryLimit = min(delivery_limit ?? PLAN_DELIVERY[plan], PLAN_DELIVERY[plan])`. Line ~64 carries the explicit
   comment that there is **"No per-run customer_credits deduction here."** The run does **not** read or write
   `customer_credits`.
4. **Delivery cap.** `lib/delivery-system/tier-composer.ts:90` → `doc.accounts.slice(0, c.maxAccounts)` caps the
   customer-visible accounts to the tier's `opportunity_target` (Preview = 2). Tier is server-resolved; the client
   cannot escalate it (verified: `tier-differentiation` 38/38).
5. **Subscription metering (separate model, §13).** `lib/billing/account-metering.ts` →
   `remainingAllowanceForRun` returns `null` (uncapped) for `one_time`/`internal`; it caps **subscription** runs
   only. One-time entitlements are intentionally **outside** the metering path.

### Where consumption actually lives (and why the gap is real)
- `lib/credits/consume-credits.ts` → `consumeCredits` has exactly **one** caller:
  `app/api/process/search/[id]/route.ts:491` — the **legacy Apollo lead-gen path**, which the productive
  Intelligence pipeline does not touch. So a Preview customer's `customer_credits` balance is **never decremented
  by an Intelligence run.**
- `lib/entitlements/entitlements-v1.ts` → `consumeRunSlotAtomic` (atomic decrement + CAS) exists but has **no
  callers** anywhere in the codebase — the intended enforcement primitive is present but unwired.

Net: after a $7 Preview purchase, `credit_balance = 2` and stays `2` across Intelligence runs. Nothing stops a
second (or Nth) run from the same balance. Under a "pay per report" reading of the frozen catalog (Preview $7 →
2 companies), that is a fulfillment/revenue-integrity gap; under a "one-time purchase = product access, delivery
scoped by tier" reading it is by design. **Which reading is canonical is the HQ decision** — it determines
whether consumption should be per-report (decrement 1 report-scope on materialization) or per-company (decrement
`opportunity_target`), and where the atomic guard (`consumeRunSlotAtomic`) attaches.

## Deterministically-verified invariants (this sprint, no code change)
- **Grant amount + idempotency:** Preview grants exactly 2; webhook replay grants once — `one-time-fulfillment` 32/32.
- **Entitlement resolution:** `one_time` access + `credits_remaining` surfaced; no 0-balance hard block — `entitlements-v1` 30/30.
- **Exact-2 delivery cap:** tier composer slices to `opportunity_target`; client cannot escalate — `tier-differentiation` 38/38.
- **Catalog mapping frozen:** Preview 2 / Brief 6 / Portfolio 12 / Premium 18 — `product-catalog` 27/27, `billing-plan-mapping` 29/29.
- **Tenant isolation / ownership:** brief served through `getBriefForViewer` ownership; cross-tenant → 404 — `http-surface-security` 12/12 + prior live 404 proof.
- **Exactly-once materialization + charge-at-materialization:** recovery is idempotent; failed generation never consumes scope — `intelligence-run-recovery` 19/19.
- **Live Preview core (prior, both markets):** Colombia 3 valid / USA 2 valid, 0 off-target, 16/16 harness checks each.

## Why no additional live experiment was run
The consumption behavior is **definitively established from code** (single dead caller; unwired atomic guard;
run route explicitly documents no deduction). A live paid-equivalent run would grant 2, run Preview (~$0.25 +
network risk), and observe `credit_balance` **unchanged at 2** — i.e. re-confirm the code fact at cost. Per the
efficiency rule (a focused ledger trace establishes the missing behavior; do not perform repeat productive runs
to re-observe a known fact), the trace is the acceptance evidence and the sprint stops at the decision boundary.

## The precise blocker returned to HQ (billing-MODEL decision — NOT an engineering relaxation)
**Should a one-time Preview entitlement be consumed by an Intelligence run, and how?**
- **Option A — per-report scope:** one purchased Preview = one delivered report; decrement 1 report-credit at
  materialization; block further runs at 0. (Matches "one-time = one deliverable"; smallest enforcement surface.)
- **Option B — per-company decrement:** decrement `opportunity_target` (2) as companies materialize; balance
  drives the delivery cap directly. (Matches a literal "2 companies" reading; couples ledger to composition.)
- **Option C — access-grant (current behavior):** purchase unlocks Preview; tier caps each delivery to 2; no
  ledger decrement; re-runs allowed. (What ships today — acceptable only if HQ intends unlimited re-runs per
  purchase.)

Enforcement primitive already exists (`consumeRunSlotAtomic`, atomic + CAS, currently uncalled) so whichever
model HQ picks, the correction is **one narrowly-scoped wiring** at materialization — but the choice of model is
HQ's, and this sprint's mandate forbids picking it unilaterally (§32 "do not redesign billing"). Do **not** merge
one-time and subscription models; do not change pricing.

## Tests / gates
release:check **EXIT 0** (prior; no code changed) · `one-time-fulfillment` 32 · `entitlements-v1` 30 ·
`tier-differentiation` 38 · `product-catalog` 27 · `billing-plan-mapping` 29 · `http-surface-security` 12 ·
`intelligence-run-recovery` 19 · live Preview CO/US 16/16 each.

## Remaining blockers (top 3)
1. **One-time ledger consumption unwired** (this doc) — HQ picks the model (A/B/C above); then ONE wiring at
   materialization via the existing `consumeRunSlotAtomic`.
2. **Production recovery not verified live** — long Preview/Brief runs exceed `maxDuration=300s` and complete only
   via the recover cron; needs `CRON_SECRET` + `INTERNAL_RUN_SECRET` in Vercel prod + a deploy.
3. **Integration PR unmerged** — `intelligence-launch-acceptance-v1` is READY_FOR_PR; `main` is protected (founder merges).

## Next action (ONE — HQ decision)
Decide the Preview one-time consumption model (A / B / C). If A or B: authorize the single materialization-time
wiring through `consumeRunSlotAtomic` (with idempotency keyed to the run) — a bounded correction, not a redesign.
If C: record that unlimited re-runs per purchase is intended, and Preview commercial acceptance flips to FULL as-is.
