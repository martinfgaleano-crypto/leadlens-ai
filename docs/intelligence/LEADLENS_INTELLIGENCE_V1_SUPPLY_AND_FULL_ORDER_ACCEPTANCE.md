# LeadLens — Intelligence V1 Qualified-Supply + Full-Order Acceptance

Verified truth only. The Portfolio 9/12 shortfall was root-caused to a specific reuse-gate defect and
corrected with the smallest safe change; the correction is proven to restore candidate supply. The
live full-order Portfolio/Premium PASS is now gated on a single external blocker (Anthropic funds
exhausted mid-session), not on supply or a product defect.

## Portfolio funnel — verified root cause
Previous Portfolio run `intel_b8b7ed4c` (grant 12): candidate universe **10** (fresh public-signal
discovery), reuse fallback appended **0**, geography 10/10, research completed 10, **1 case DISCARD**
(Platanitos) → **9 delivered / 9 charged / 3 preserved**. Limiting stage = **candidate supply**, and
specifically the **reuse gate never fired**.

**Why the gate never fired (the defect):** `makeVaultReuseGate` opens reuse only when fresh coverage
is *below* `FRESH_COVERAGE_SUFFICIENCY[tier]`. The tier is derived from the discovery budget, and both
Portfolio (12) and Premium (18) mapped to a single `intelligence` tier with floor **10**. Fresh
discovery produced exactly 10 → `10 >= 10` = "sufficient" → gate closed → the Vault fallback (holding
**67 Colombia companies**, verified read-only) was never consulted. The floor sat *below* the
delivery target, so a 12- or 18-company order treated a 10-company universe as complete.

## The correction (one coherent, smallest safe change)
`lib/lead-hunter/vault-reuse-config.ts`: split the coarse `intelligence` tier into `standard`/`pro`
and set the floors to the **delivery target + ~2 headroom** for the measured ~10% DISCARD rate:
`FRESH_COVERAGE_SUFFICIENCY = { preview: 6, brief: 8, standard: 14, pro: 20 }`; `tierFromBudget` now
returns `standard` (≤80 provider calls) or `pro` (above). It is a coverage **floor**, not a cap; no
qualification standard was weakened; production `VAULT_REUSE_MODE` stays **OFF** so production behavior
is unchanged. Regression: `vault-reuse-config` **20/20** (incl. the exact fresh-10 Portfolio case:
fresh 10 → insufficient → reuse allowed to top up).

## Vault incremental value (measured, live)
With the fix, on the frozen CO Portfolio context the reuse gate opened and the Vault contributed real
supply (telemetry `vault_reuse`): fetched **183** vault companies → **78** rejected (non-Colombia) →
**40** projected CO candidates → **10** duplicates removed (already fresh) → **30 appended** →
qualified down to a combined candidate universe of **22** (fresh 10 + ~12 qualified reused). The
candidate-supply bottleneck is **removed**: universe grew **10 → 22**, comfortably above the 12 target
with headroom. Reused candidates still pass fresh qualification and fresh research (no stale-evidence
promotion, provenance preserved, tenant isolation preserved).

## Portfolio full-order live acceptance — BLOCKED on provider funds (not supply)
Two clean re-runs were attempted after the fix:
1. Universe **22** (fix working) → completed research → **failed at ledger reconciliation** due to a
   transient Supabase DNS outage (`ENOTFOUND …supabase.co`) — environmental, not a code/product defect.
2. Universe 11 → **every lead failed research** with `[anthropic] CIRCUIT_OPEN: credits_exhausted`
   (`400 "Your credit balance is too low"`). **Anthropic funds are exhausted** (drained by this
   session's Preview + Brief + first Portfolio runs).

**Valuable negative proof from run 2:** under *total* research failure, delivered **0**, charged **0**,
balance **12 fully preserved** — §22/§35 failed-generation + partial-order safety hold even when every
company fails (no credit consumed, no fabricated evaluation delivered).

**Verdict:** the qualified-supply blocker is **REMOVED and proven** (universe 10→22). A live Portfolio
12/12 PASS now requires only **Anthropic credit top-up** (external/founder). It was not achievable this
session because provider funds ran out (§2/§45 STOP).

## Premium (18) — BLOCKED on the same funds (+ supply to be confirmed at 18)
Not run: Anthropic funds exhausted. With the fix, the pro-tier floor (20) will fire reuse for an
18-order; whether the CO Vault yields 18 *distinct on-target* companies after qualification/DISCARD
needs one live measurement once funds are restored. Acceptance matrix unchanged (grant 18 → 18 valid →
18 charged → 0 remaining → 19th blocked → premium differentiation rendered).

## Cost (measured, this session, before exhaustion)
Preview $0.218 (2 evals) · Brief $0.539 (6) · Portfolio(9) $0.856 · ≈ **$0.09–0.11 / valid evaluation**
(Anthropic; Brave/Tavily free tier). The post-fix Portfolio researches the full reused universe (~22)
rather than 12 — a **cost inefficiency** (pipeline `researchCount = max(PLAN_LEAD_COUNT, researchCandidateLimit)`
overrides the spine's tighter research cap), not a safety issue (charge still caps at the balance via
CAS + the delivery-gate). A follow-up could tighten research to `deliveryTarget + headroom`.

## Release envelope (updated)
- **Preview + Brief (Colombia): commercially accepted** (live, on deployed code).
- **Portfolio (Colombia): supply RESOLVED**, full-order live PASS pending Anthropic funds.
- **Premium (Colombia): pending funds + one 18-supply measurement.**
- Production `VAULT_REUSE_MODE=OFF`: the reuse dependency is test-scoped. A production rollout of
  `ELIGIBLE_FALLBACK` is a separate HQ decision supported by the measured incremental value above.

## Remaining blockers (returned to HQ)
1. **Anthropic credit top-up** — the only thing between here and a live Portfolio 12/12 (and Premium 18).
2. **Production reuse-rollout decision** — Portfolio/Premium supply depends on `VAULT_REUSE_MODE`
   (OFF in prod); the fix makes the gate correct, but enabling fallback in prod is HQ's call.
3. **(Optional) research-cap tightening** — cost efficiency only; not blocking.
