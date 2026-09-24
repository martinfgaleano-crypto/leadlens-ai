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

## Portfolio full-order live acceptance — PASS (12/12), after funds restored
Run `intel_04565690` (plan `standard`, CO context, reuse fallback). Universe grew to **17** (fresh +
qualified reused); 17 researched → 1 DISCARD → **12 delivered / 12 charged / balance 0**. Twelve
distinct on-target CO companies — manufacturers (WEG, Cargill, Organización Corona, Mapei, Tecnoglass,
Alimentos SAS) and logistics/DC operators (Logisfashion, Quick, Leschaco, Alcomex, Koba, Almacafé).
Decision mix: 10 WARM / 6 COLD / 1 DISCARD among researched — a genuine spread, not padded. Third run
→ **402**, replay/recovery → no extra debit, reopen free, second tenant → 404. **21/21** harness
checks. COGS **$1.22** Anthropic (49 calls) ≈ $0.10/eval. **FULL_ORDER_ACCEPTED.**

(Two earlier post-fix attempts failed on environmental issues only — a transient Supabase DNS outage,
then Anthropic funds exhaustion — during which delivered=0/charged=0/**balance preserved** proved
failed-generation + partial-order safety under total provider failure.)

## Premium full-order live acceptance — PASS (18/18)
Run `intel_84ec8241` (plan `pro`, CO context, reuse fallback; pro-tier floor 20). Universe **23** →
**18 delivered / 18 charged / balance 0**. Eighteen distinct on-target CO companies (food/beverage
manufacturers: Coca-Cola FEMSA, Alpina, Colombina, Bavaria, Postobón, Cargill; industrial: WEG,
Organización Corona, Mapei; logistics/DC operators: Logisfashion, Leschaco, Alcomex, Koba, Melonn,
Distribuciones Madeg, Almacafé, Grupo Novargi, Alimentos SAS). Third run → **402**, replay/reopen safe,
tenant 404. **Premium differentiation fires:** `isPremiumEligible("pro") === true` → the spine ran
`producePremiumContext` and attached `_premium_context` (additive, fail-closed; composition verified by
`premium-production` 18/18 + `premium-context-researcher`). **21/21** harness checks. COGS **$1.67**
Anthropic (66 calls) ≈ $0.093/eval. **FULL_ORDER_ACCEPTED.**

## Cost (measured, this session, before exhaustion)
Preview $0.218 (2 evals) · Brief $0.539 (6) · Portfolio(9) $0.856 · ≈ **$0.09–0.11 / valid evaluation**
(Anthropic; Brave/Tavily free tier). The post-fix Portfolio researches the full reused universe (~22)
rather than 12 — a **cost inefficiency** (pipeline `researchCount = max(PLAN_LEAD_COUNT, researchCandidateLimit)`
overrides the spine's tighter research cap), not a safety issue (charge still caps at the balance via
CAS + the delivery-gate). A follow-up could tighten research to `deliveryTarget + headroom`.

## Release envelope (final)
All four one-time tiers are now **commercially accepted (live) in the Colombia market** with correct
per-company consumption, run gating, partial-order + failed-generation safety, idempotency, tenant
isolation, and fail-closed ledger behavior — on the merged + deployed code (main includes the supply
fix via PR #26), migration 064 applied:
- **Preview 2/2 · Brief 6/6 · Portfolio 12/12 · Premium 18/18** — all PASS.
- Portfolio/Premium supply depends on `VAULT_REUSE_MODE=ELIGIBLE_FALLBACK` (test-scoped here;
  production default stays **OFF**). Enabling fallback in production is a separate HQ rollout decision,
  now supported by measured incremental value (universe 10→17/23; 12 and 18 delivered).
- USA market is a separate acceptance (prior strict-ICP benchmark ~5/6), not re-validated here.

## Remaining blockers (returned to HQ)
1. **Production reuse-rollout decision** — Portfolio/Premium full supply needs `VAULT_REUSE_MODE`
   enabled in prod (currently OFF). The gate is now correct; enabling fallback is HQ's call.
2. **Existing legacy welcome balances** (≤6 accounts × 100 credits) — provenance-based reconciliation,
   a separate founder maintenance step (new signups are clean post-064).
3. **(Optional) research-cost tightening** — the pipeline researches the full reused universe rather
   than `deliveryTarget + headroom`; ~2× cost, no safety impact.
