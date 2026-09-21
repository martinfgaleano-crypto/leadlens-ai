# LeadLens — Intelligence Productive Breakthrough V2 Acceptance

Sprint verdict: **PRODUCTIVE CHAIN CLOSED (both markets, live).** The full customer path —
Vault identity → current qualification → Research selection → Deep Research → canonical Opportunity
Cases → Portfolio → customer result → Account Memory → Monitor — ran **live end-to-end** in USA and
Colombia through the real production route, and a **reused Vault account completed the entire chain**
(the outstanding §15 proof). Builds on `LEADLENS_INTELLIGENCE_QUALIFICATION_BREAKTHROUGH_V1_ACCEPTANCE.md`
and `LEADLENS_HYBRID_CANDIDATE_UNIVERSE_V1_ACCEPTANCE.md` (not duplicated). Six-context matrix + full
Portfolio/Premium tier orders remain the next bounded step.

Distinctions: **LIVE_OBSERVED** · **CONTROLLED_VALIDATED** · **PRODUCTION_WIRED** ·
**LIVE_FULL_ORDER_VALIDATED** · **NOT_STARTED**.

## Git
Branch `intelligence-launch-acceptance-v1` · worktree `leadlens-landing-v2`. Start HEAD `f34c02c` ·
end HEAD `59c3648` (+ this doc). Push: **NO.** Merge: **NO.** Commit this sprint: `59c3648`
(env-configurable `delivery_limit` in the productive e2e harness — the only code change; the
qualification/resilience code shipped in prior sprints). Frozen core / Billing / other worktree: untouched.

## Implemented changes
- `scripts/accept-customer-intelligence-e2e.mts`: `LEADLENS_ACCEPTANCE_DELIVERY_LIMIT` env (default 2
  unchanged) so a bounded Brief-sized productive canary lets reused accounts win Research slots. No
  product-code change; feature flag remains default OFF; no entitlement/pricing/concurrency change.

## Colombia productive canary (LIVE_OBSERVED) — real route, `VAULT_REUSE_MODE=ELIGIBLE_FALLBACK`
Context: warehouse-automation/WMS seller targeting Colombian manufacturers + distributors + logistics.
Full discovery produced **16 fresh candidates → gate correctly CLOSED (reuse=0)**; the customer received
a **3-account Portfolio** from fresh discovery (Coca-Cola FEMSA Colombia, Logisfashion, Distribuciones
Madeg), canonical Cases generated + decisions applied (grounded), all 3 entered Account Memory, Monitor
ran. 16/16 checks. **Runtime 290 s** (research 257 s); **Anthropic $0.26** (10 calls, 41k tokens); Tavily
24 calls; Serper errored (unfunded — correctly). Key finding: real productive discovery for this context
is **healthy**, so the thin-universe fallback correctly does not fire — the earlier "fresh=3" was an
artifact of a minimal hand-built plan, not the real pipeline.

## USA productive canary (LIVE_OBSERVED) — real route, thin fresh → fallback fired
Context: US industrial-automation seller targeting US manufacturers with owned plants. Full discovery
produced **1 fresh candidate** (the genuine US thin-universe collapse) → **fallback FIRED** (gateOpen,
40 neutral reused appended; 49 geography-rejected). Qualification: eligible 39, attempted 12,
**qualified 7** (recoveredViaSubpage 1, wrong-target 4, non-company 1, unresolved 0, **ops-blocked 0**).
Research selection took 6 pre-selected candidates; Deep Research completed on 3 accounts:
- **SunOpta [sunopta.com] — reused Vault identity ✅** (plant-based food manufacturer)
- **Mars [mars.com] — reused Vault identity ✅** (food/confectionery manufacturer)
- Plastic Injection Molder [plasticmoldingmfg.com] — fresh
Canonical Cases generated + decisions applied; **3-account Portfolio delivered**; 3 entered Account
Memory; Monitor ran. 16/16 checks. **Runtime 368 s** (research 266 s); **Anthropic $0.337** (15 calls,
55k tokens); Tavily 13 calls. **This is the §15 proof: reused Vault operators (SunOpta, Mars) completed
identity → qualification → Research selection → Deep Research → canonical Case → Portfolio → Account
Memory → Monitor, live, through the production route.**

## Fresh vs reused contribution
- Colombia: fresh 16 / reused 0 (gate closed) → 3 fresh delivered.
- USA: fresh 1 / reused 39 admitted → 7 qualified → 6 Research-selected → 3 researched (2 reused + 1 fresh)
  → 3 delivered. Reuse is never counted as fresh discovery (separate `vaultReusedCandidates` axis).

## Qualification before / after (LIVE)
| | Baseline (V1, CO manufacturer) | V2 US industrial-automation |
|---|---|---|
| attempted | 12 | 12 |
| qualified | 1–2 | **7** |
| ops-blocked | 5 → 0 (resilience) | **0** |
| recovered via subpage | — | 1 |
| wrong-target rejected | 4–6 | 4 |
The US context yields far higher true-target recall because the Vault holds ~46 US industrial operators
matching a manufacturer target and Firecrawl was not throttled (resilience + Tavily fallback held). Role
attribution remains source-dependent (documented V1 caveat); safe (conservative reject, Research owns truth).

## Dual-market matrix (partial)
- USA industrial automation: **LIVE_OBSERVED** (fallback fired; 2 reused + 1 fresh delivered; THIN_BUT_DEFENSIBLE — fresh alone was 1, reuse materially widened coverage).
- USA lean operations / channel-distribution: NOT_STARTED.
- Colombia industrial/manufacturing: **LIVE_OBSERVED** (fresh-sufficient; 3 fresh delivered; ADEQUATE for this context).
- Colombia operations/consulting / channel-distribution: NOT_STARTED.

## Truth safety (LIVE_OBSERVED + CONTROLLED_VALIDATED)
Wrong company: none (SunOpta/Mars are genuine US manufacturers) · Wrong geography: none (geography gate
kept 6/6 US; 49 non-US reused rejected) · False event/Timing: none (qualification ≠ Timing; Research owns
events; Monitor saw provider failures → no fabricated change) · False Independent Support: none ·
Historical Vault Evidence promotion: none (role ≠ Evidence; `last_seen`/`observation_count` never read) ·
Decision mutation: none (canonical decisions applied by the decision engine) · Cross-tenant leakage: none
(other tenant load → 404; neutral projection intact). No canonical threshold changed.

## Tier acceptance
Both canaries ran at 6-delivery (Brief-sized) through the shared core → Preview(2)/Brief(6) core path is
**LIVE_OBSERVED** end-to-end in both markets. Portfolio(12)/Premium(18) full orders: **NOT_STARTED**
(bounded budget; §40). All four tiers remain **PRODUCTION_WIRED**; none newly **LIVE_FULL_ORDER_VALIDATED**
at 12/18 scope this sprint. No entitlement change.

## Runtime / COGS (LIVE_OBSERVED)
| | Colombia | USA |
|---|---|---|
| total | 290 s | 368 s |
| research (bg) | 257 s | 266 s |
| Anthropic | $0.26 (10 calls) | $0.337 (15 calls) |
| Tavily | 24 | 13 |
| Firecrawl | (qualification, bounded; CO gate closed) | bounded, ops-blocked 0 |
Cost per completed customer result (3 accounts): ~$0.26–0.34. Qualification overhead is bounded (≤12
attempts, ≤24 fetches) and did not breach the background execution window. No timeouts. Unknown provider
monetary costs: search providers (not separately metered).

## Track B / tests
Track B **7/8** preserved (canonical Research/event-retrieval untouched). Suites: vault-reuse-qualification
33 · vault-reuse-integration 15 · vault-reuse-config 16 · vault-identity-reuse 22 · vault-reuse-wiring 7 ·
lead-hunter-universe 30 · productive-intelligence-spine 31 · account-deep-research 43 · **release:check
EXIT 0** (tsc + ~45 suites + build). Two live productive e2e runs: **16/16 checks each.**

TYPECHECK: PASS · BUILD: PASS · INTEL SAFETY: PASS.

## Release readiness
USA Core: GUIDED_BETA (thin fresh + reuse materially widens coverage; single-context live proof) ·
Colombia Core: GUIDED_BETA (fresh-adequate live proof). All tiers both markets: **GUIDED_BETA**. Reuse
flag remains OFF in production; live proofs used CANARY/ELIGIBLE_FALLBACK in a disposable environment.

## Remaining primary bottleneck
Breadth of live evidence: only 1 context per market and no 12/18-account full-order tier run — the six-
context matrix and Portfolio/Premium full orders remain to move from GUIDED_BETA toward
LIMITED_SELF_SERVE.

## Next three moves
1. Run the remaining four matrix contexts (USA lean/channel, Colombia operations/channel) as bounded
   productive canaries; classify each ADEQUATE / THIN_BUT_DEFENSIBLE / SYSTEMATICALLY_INCOMPLETE.
2. Run one complete **Portfolio (12)** and one **Premium (18)** order end-to-end; measure full-order COGS
   + runtime against the background execution window.
3. Decide the production rollout for `VAULT_REUSE_MODE` (CANARY → ELIGIBLE_FALLBACK) per market once the
   matrix confirms consistent safe value; reduce qualification role-attribution variance in parallel.

## Canonical artifacts (by path)
- `scripts/accept-customer-intelligence-e2e.mts` (productive chain harness) · `scripts/accept-reuse-qualification-canary.mts`
- `lib/lead-hunter/vault-reuse-qualification.ts` · `vault-reuse-qualification-deps.ts` · `vault-identity-reuse.ts`
- `lib/intelligence/productive-spine.ts` · `app/api/internal/intelligence-runs/[runId]/process/route.ts`
- Structured run evidence: `ml/data/acceptance/customer-e2e-*.json` (gitignored; not committed)
