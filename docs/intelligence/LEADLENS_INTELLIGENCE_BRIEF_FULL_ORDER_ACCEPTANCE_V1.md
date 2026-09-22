# LeadLens — Brief Full-Order Acceptance V1

Verdict: **Colombia Brief = FULL_BRIEF_LIVE_ACCEPTED (6/6). USA Brief = 4/6, BLOCKED at target-
qualification yield.** The V2 "6→3" gap was diagnosed as a config artifact (the harness ran `plan:"sample"`,
whose cap is 2), not a discovery/qualification defect — the product's plan caps are correct. Running the
Brief-tier plan (`starter` → delivery 6, spine researches `max(6,5)=6`) produced a complete 6-company
Colombia Brief live; the strict manufacturer-only USA context yielded only 4 quality evaluations. Builds on
`LEADLENS_INTELLIGENCE_PRODUCTIVE_BREAKTHROUGH_V2_ACCEPTANCE.md`.

## Repository
Branch `intelligence-launch-acceptance-v1` · worktree `leadlens-landing-v2`. Start HEAD `84b4f54` → end
`29588a6` (+ this doc). origin/main `c682c9f` (unchanged, 0 behind); origin/branch `40bf8cc` (older). Push:
NO. Merge: NO. Commit: `29588a6` (harness `LEADLENS_ACCEPTANCE_PLAN` env — acceptance tooling only; **no
product-code change; the one focused-correction allowance was NOT used**). 24 prior commits preserved; V2
reproducible; Hybrid Candidate Universe intact.

## Root-cause of the V2 6→3 collapse (diagnosis, §21–22)
`app/api/customer/intelligence-runs/route.ts`: `PLAN_DELIVERY = {sample:2, starter:6, standard:12, pro:18}`,
`deliveryLimit = min(requested, PLAN_DELIVERY[plan])`. The harness hardcoded `plan:"sample"` → `min(6,2)=2`;
`researchLimit = PLAN_RESEARCH.sample = 3`; spine `researchLimit = min(candidates, max(2,3)) = 3` → 3
delivered. **Limiting stage was ENTITLEMENT/CONFIG (plan cap), not Discovery/Qualification.** Fix = run the
Brief-equivalent plan `starter`.

## Acceptance contract (canonical Brief)
Six evaluated companies, each: valid identity + geography + target-type match, completed Deep Research,
grounded material claims, canonical Decision (P/V/M/H), Why-Now or honest no-trigger, uncertainty,
counterevidence where relevant, next validation, customer-facing presentation, correct entitlement/consumption.

## Colombia Brief — FULL_BRIEF_LIVE_ACCEPTED (LIVE_OBSERVED)
Context (frozen): warehouse-automation/WMS/inventory-orchestration seller → Colombian manufacturers +
distributors operating their own DCs/warehouses/plants with recent logistics-infrastructure investment;
excludes public/media/consultancies/pure-software/retailers-without-own-logistics/fully-outsourced. Plan
`starter`, `VAULT_REUSE_MODE=ELIGIBLE_FALLBACK`.
- Universe 22 fresh / 0 reused (fresh sufficient → gate correctly closed). 13 pre-selected → 10 researched →
  **6 delivered**: Coca-Cola FEMSA Colombia, Central Cervecera de Colombia, Grupo Éxito, Alkosto, Olímpica,
  Sodimac Colombia. Canonical Cases generated; 6 entered Account Memory; Monitor ran; other-tenant load 404.
  **16/16 harness checks.**
- COGS **$0.728** Anthropic (27 calls, 110k tok) · Tavily 62 · Firecrawl 0. Runtime **610 s** total (research 560 s).
- Independent relevance review: all 6 Colombian; Coca-Cola FEMSA (bottler + DCs) and Central Cervecera
  (brewery/plant) squarely in-target; Éxito/Alkosto/Olímpica/Sodimac are large retailers that DO operate
  owned distribution centers (satisfy the "own logistics" exclusion) — **defensible but retailer-heavy**; a
  buyer targeting pure manufacturers/distributors may view 4/6 as adjacent. No fabricated identity/geography/
  event; internal category WARM×6, canonical Decisions applied by the decision engine.

## USA Brief — 4/6, BLOCKED (LIVE_OBSERVED)
Context (frozen): US industrial-automation seller → US manufacturers operating owned plants with recent
capacity investment; excludes public/media/consultancies/pure-software/distributors-without-manufacturing.
Plan `starter`, `VAULT_REUSE_MODE=ELIGIBLE_FALLBACK`.
- Universe 43 = **3 fresh + 39 reused**; fallback fired (gateOpen, 40 appended, 55 geo-rejected).
  Qualification: attempted 12, **qualified 2** (SunOpta, Mars), wrong-target 7, non-company 3, ops-blocked 0.
  5 pre-selected → 5 researched (Aras→DISCARD, Palmetto State Armory→COLD, InnovativeTek→COLD, SunOpta→WARM
  7.2, Mars→WARM 7.8) → **4 delivered** (DISCARD excluded). 16/16 harness checks (delivery honesty preserved).
- COGS **$0.42** Anthropic (19 calls) · runtime 418 s.
- **Limiting stage = target-qualification yield**: only 3 eligible-fresh + 2 qualified-reused = 5 research-
  ready < 6. Qualification attempted only the first 12 of 39 eligible reused (10 were genuinely non-
  manufacturer). Yield is variance-bound (V2 got 7/12; this run 2/12, same pool) and the strict manufacturer-
  only US context has limited high-quality supply. **2 strong reused operators (SunOpta, Mars) again proved
  the reuse chain**; the other 2 delivered are weak (COLD). Forcing 6 would require relaxing the target bar or
  padding weak/irrelevant companies — refused per §15/§16/§42.

## Hard fails
None. No wrong identity, wrong geography, fabricated evidence/date, false Independent Support, cross-tenant
leakage, or silently-incomplete delivery. USA under-delivery (4<6) is reported honestly, not padded.

## Runtime / production window (§30)
Both Briefs' research exceeds the process route's `maxDuration = 300 s` (CO 560 s, US ~370 s research) when run
end-to-end in one pass. Production completion therefore **depends on the existing dead-run recovery**
(cron */15, gen-CAS reclaim, idempotent resume) rather than a single serverless request. **Single-window
runtime: NOT VERIFIED / recovery-dependent** — a genuine product-acceptance caveat for larger tiers.

## Entitlement / recovery
Disposable beta users → no paid entitlement → uncapped research (per design); idempotent retry confirmed
(completed retry reused the run, no new Research). No billing change made. Incomplete-order consumption not
separately stressed this sprint (no paid entitlement in the harness).

## Tier acceptance
- Preview (2): CORE LIVE-OBSERVED (subset of the proven chain; no dedicated 2-company order run).
- **Brief (6): Colombia LIVE_FULL_ORDER_VALIDATED; USA 4/6 (not validated).**
- Portfolio (12) / Premium (18): NOT VALIDATED (not run).

## Release states
USA Core: CORE LIVE-OBSERVED (Brief 4/6 blocked at qualification yield) · Colombia Core: **FULL BRIEF
LIVE-ACCEPTED**. (Commercial/Lemon/activation gates are separate and NOT part of this proof.)

## Tests / gates
release:check **EXIT 0** (tsc + ~45 suites + build) · git diff --check clean · vault-reuse-qualification 33 ·
productive-intelligence-spine 31 · account-deep-research 43 (from prior runs) · two live Brief e2e runs 16/16
each · Track B 7/8 preserved.

## Remaining primary bottleneck
USA target-qualification yield: for the strict manufacturer-only US context, fresh (~3) + reused-qualified
(~2, variance-bound) research-ready supply is < 6, so a full 6-company US Brief is not reliably deliverable
without relaxing relevance.

## Next action (HQ decision)
ONE of: (a) raise/optimize the reused-qualification attempt coverage for thin markets (attempt more of the 39
eligible when research-ready supply < delivery target) + reduce role-attribution variance — legitimate target
recovery, bounded, but adds latency to an already recovery-dependent run; or (b) accept a narrower US launch
envelope (broader US ICP, or Brief delivering the honest quality supply). Do NOT relax relevance or pad.

## Flag safety
`VAULT_REUSE_MODE` remains OFF in production. The USA Brief's reused contribution required
ELIGIBLE_FALLBACK/CANARY; production OFF would NOT reproduce it. Colombia Brief did not depend on reuse.
