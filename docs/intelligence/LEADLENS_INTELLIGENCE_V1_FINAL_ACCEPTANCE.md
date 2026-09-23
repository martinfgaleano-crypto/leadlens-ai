# LeadLens — Intelligence V1 Final Product Acceptance

Post-merge production verification + one-time full-order commercial acceptance. This document records
**verified truth only** — production state confirmed against live GitHub/Vercel/Supabase, and
paid-equivalent acceptance run through the real Intelligence pipeline on isolated disposable tenants
(no real payments, no real customer balances touched).

## Verified production state (Phase A)
- **`origin/main` = `1f46552`** — PR #25 merged `one-time-credit-enforcement-v1` (all 5 enforcement
  commits `3bd71ff…3aa6e2d` are ancestors of main).
- **Production deployment: Ready**, built from `1f46552`. The merge commit was authored `10:31:33` and
  the `leadlens-ai` production deploy was created `10:31:36` (3s later) — same commit, confirmed via
  authenticated `npx vercel`.
- **Migration 064: APPLIED.** Behavioral acceptance — a fresh disposable signup now receives **no
  `customer_credits` row (balance 0)**, i.e. the legacy 100-credit `on_profile_created` bootstrap no
  longer fires. Confirmed twice (direct probe + the Preview harness `welcome_credits_seen = 0`).
- **Welcome-credit bootstrap: DISABLED for new signups.** Legitimate purchases still grant the
  canonical allowance (`addCredits` → `opportunity_target`); subscriptions unaffected.
- **`VAULT_REUSE_MODE`: default OFF** in production (unchanged).

## Historical credit audit (Phase A, read-only — unchanged from prior)
7 `customer_credits` rows (5×100, 1×1-99, 1×101-102); grant provenance clean — 18 welcome-grant
users, 1 paid, 1 with both, **0 ambiguous**. **Commercial impact of the residual:** the ≤6 existing
accounts that already hold 100 legacy welcome credits could still authorize legacy-funded Intelligence
work (each ~100 evaluations) until reconciled — a tiny early-beta/test population. New customers are
clean post-064. Historical reconciliation was **NOT performed** (§7/§9 — no retroactive deduction);
it remains a separate, provenance-based founder maintenance step (documented in
`LEADLENS_ONE_TIME_CREDIT_ENFORCEMENT_V1.md`), run against a verified backup.

## Preview commercial acceptance — PASS (live, post-064)
Disposable purchaser, Colombia WMS context, real pipeline. Run `intel_fc3728ed…`.
- welcome credits on fresh signup: **0** (064 live) · grant **2** · delivered **2** · consumed **2** ·
  remaining **0** (never negative).
- Third run at 0 → **402 `usage_limit_reached`**, zero provider research · replay/recovery → no extra
  debit · report reopen at 0 → allowed & free · second tenant → 404, zero cross-tenant charges.
- **21/21** harness checks. This is the exact merged+deployed enforcement code.

## Ledger-failure safety — PASS (deterministic, isolated)
The deployed enforcement is fail-CLOSED: on ledger unavailability no unpaid evaluation is delivered,
the run is left `processing` (recovery reclaims only `processing`) so the recovery cron retries the
idempotent charge, and an already-authorized replay reuses its charge without a new debit. Proven by
`one-time-credit-enforcement` (ledger-failure cases) + `productive-intelligence-spine` (run stays
`processing`). No faults injected into the production database (§11).

## Subscription non-regression — PASS
One-time enforcement is additive and mutually exclusive by access source; `isMetered`/period ledger/
`monitorUsageGate` unchanged. `monitor-recurring-usage`, `usage-ledger`, `billing-plan-mapping`,
`tier-differentiation`, `product-catalog`, `entitlements-v1` remain green (release:check).

## Brief full-order acceptance (6) — PASS
Disposable purchaser, plan `starter`, Colombia WMS context, real pipeline. Run `intel_fd951ff6…`.
- grant **6** · delivered **6** · consumed **6** (one per company) · remaining **0** (never negative).
- Six distinct on-target Colombian companies: **Coca-Cola FEMSA, Cargill, Alpina, Colombina, Tecnoglass**
  (manufacturers with owned DC/plant operations) and **Leschaco** (logistics operator) — all legitimate
  targets for a WMS/warehouse-automation seller. All 6 carry account memory, grounded evidence, 0
  insufficient-coverage. Canonical decisions (internal WARM/COLD is scoring, not the customer layer).
- Third run at 0 → **402**, no research · replay/recovery → no extra debit · reopen free · tenant 404.
- **21/21** harness checks. **Supply dependency (§16):** reaching 6 valid for this frozen CO context
  required `VAULT_REUSE_MODE=ELIGIBLE_FALLBACK` (test-scoped env only — production default stays OFF).
  This is a recorded supply dependency, not an enforcement gap; the per-company consumption contract is
  identical to Preview and scaled cleanly to 6.

## Portfolio full-order acceptance (12) — PARTIAL (enforcement PASS, full count supply-bound)
Disposable purchaser, plan `standard`, Colombia WMS context + reuse fallback. Run `intel_b8b7ed4c…`.
- grant **12** · candidate universe **10** (fresh discovery; reuse fallback added 0 eligible) · 1
  DISCARD (Platanitos) → **delivered 9 · charged 9 · remaining 3** (never negative).
- **This is a LIVE proof of partial-order safety (§23):** the customer was charged for exactly the 9
  valid companies delivered and the **3 unfulfilled credits were preserved** — no over-charge, and NO
  padding to 12 with irrelevant companies (§19 shortfall not concealed). The nine (Coca-Cola FEMSA,
  WEG, Distribuciones Madeg, Quick, Logisfashion, Alpina, Colombina, Bavaria, Postobón) are on-target
  CO manufacturers/logistics operators. **18/19** harness checks — the single expected failure is the
  "full 12" assertion.
- **Verdict:** consumption/entitlement/partial-order enforcement **PASS**; the commercial 12-count is
  **supply-bound** for this frozen CO context (~9-10 valid). Reaching 12 needs broader on-target supply
  — a separate supply/rollout track, NOT an enforcement defect and NOT to be forced by expanding Vault,
  relaxing qualification, or broadening the ICP (§16/§24/§30).

## Premium full-order acceptance (18) — NOT ACCEPTED (supply-blocked; not run)
Prerequisite §21 ("the customer context can legitimately support 18 relevant companies") is **not
met**: the same CO context yields a candidate universe of ~10, so an 18-company order cannot deliver 18
valid evaluations. Per §21 an expensive run that cannot complete its scope was **not started**.
**Acceptance matrix (ready when supply exists):** grant 18 → 18 valid relevant companies → 18 charged →
remaining 0 → 19th blocked → premium differentiation (`_premium_context`, gated `isPremiumEligible`,
already unit-verified: `premium-production`/`premium-context-researcher`) rendered → recovery/replay
safe. The enforcement is tier-agnostic and proven through 9 (Portfolio) and 6 (Brief); the sole gap is
qualified 18-company **supply** for a single frozen context.

## Production recovery
Recovery runs via GitHub Actions (`intelligence-run-recovery.yml`, `*/15`, authed GET prod `/recover`).
`gh` was not available in this session to re-poll recent invocations; recovery was previously verified
green and the workflow is unchanged. Live stale-run recovery of a long order was not re-observed this
session (would require an interrupted prod run) — recorded as previously-verified, not re-confirmed.

## Cost (measured)
Anthropic (the only metered provider; Brave/Tavily on free tiers = $0, Serper unfunded/unused):
| Order | Anthropic calls | Anthropic cost | Valid delivered | Cost / valid eval |
|---|---|---|---|---|
| Preview | 9 | $0.218 | 2 | $0.109 |
| Brief | 23 | $0.539 | 6 | $0.090 |
| Portfolio | 35 | $0.856 | 9 | $0.095 |
COGS ≈ **$0.09–0.11 per valid company evaluation** — far below the price floor (Preview $7/2 = $3.50
per company). Do not read Anthropic cost as total COGS; it is the dominant metered component here.

## Release envelope
**Commercially accepted (this session, live, isolated):** Preview 2/2 and Brief 6/6 (CO context, reuse
fallback) with correct one-time per-company consumption, run gating, partial-order safety, idempotency,
tenant isolation, and fail-closed ledger behavior; on the merged + deployed production code with
migration 064 live. Portfolio's enforcement + partial-order safety are proven (9/9, 3 preserved); the
full 12-count and Premium 18-count are **supply-bound** for a single frozen context, not enforcement
gaps. Recommended launch envelope: **Preview + Brief in the Colombia market**, with Portfolio/Premium
gated on qualified-supply expansion (a separate, non-enforcement track). USA market coverage is a
separate acceptance (prior benchmark: strict US ICP ~5/6) and not re-validated here.

## Remaining blockers (returned to HQ)
1. **Qualified-supply ceiling** (~9–10 valid for the frozen CO context) caps Portfolio/Premium
   full-orders; needs broader on-target supply (supply/rollout decision), not an enforcement change.
2. **Existing legacy welcome balances** (≤6 accounts × 100 credits) — provenance-based reconciliation
   is a separate founder maintenance step (backup + the documented script); new signups are clean.
3. **Live stale-run recovery of a long order in production** not re-observed this session (GHA workflow
   unchanged/previously green).
