# LeadLens — Intelligence Qualification Breakthrough V1 Acceptance

Sprint verdict: **QUALIFICATION_IMPROVED_NOT_CLOSED.** Forensic on the live 1/12 result identified the true
bottleneck — **Firecrawl HTTP 429 rate-limiting** (persistent, not transient) that falsely OPS_BLOCKED real
Colombian manufacturers, **not** candidate ordering or the classifier. Adding source resilience (429 retry +
Retry-After) + an independent **Tavily structural-role fallback** + a bounded official-subpage cascade drove
**ops-blocked 5 → 0** and **qualified-reaching-Research 1 → 2** on the same frozen sample, safely. Not CLOSED:
the full productive Research→Case→Portfolio canary was not run, yield remains modest for a manufacturer-only
target, and role attribution has provider-dependent variance. Builds on
`LEADLENS_INTELLIGENCE_CLOSURE_PROGRAM_V2_ACCEPTANCE.md` (not duplicated).

Distinctions: **CONTROLLED_VALIDATED** = deterministic fixtures · **LIVE_OBSERVED** = real providers + real
Vault this sprint · **PRODUCTION_WIRED** = shipped, flag OFF · **LIVE_FULL_ORDER_VALIDATED** · **NOT_STARTED**.

## Git
Branch `intelligence-launch-acceptance-v1` · worktree `leadlens-landing-v2`. Start HEAD `36eabef` · end HEAD
`04a2532` (+ this doc). Push: **NO.** Merge: **NO.** Commit: `04a2532` (resilience + Tavily fallback + subpage
cascade + tests). Frozen Intelligence / Billing / other worktree: untouched.

## Original 1/12 diagnosis (LIVE_OBSERVED forensic)
Per-candidate forensic of the first 12 Colombia reused identities (target = manufacturer): the dominant
outcome was **HTTP 429** on all but the first few fetches — i.e. Firecrawl account rate-limiting, which the
earlier canary recorded as 5 OPS_BLOCKED. Real manufacturers (Alpina, Colombina, Grupo Carvajal, Organización
Corona) were among those throttled, not irrelevant. Genuine wrong-target (Melonn = logistics/software) was
correctly rejected. First failing stage for most cases: **SOURCE_FETCH_FAILURE (provider rate limit)**, not
WRONG_TARGET_TYPE, CORPORATE_ROLE_NOT_EXTRACTED, or candidate ordering. Ordering was ruled out: the real
manufacturers appeared within the first 12 Vault-order candidates.

## Implemented changes (PRODUCTION_WIRED, flag OFF)
- **Source resilience** (`vault-reuse-qualification-deps.ts`): retry 429/5xx honoring `Retry-After`, bounded
  attempts + backoff ceiling.
- **Independent Tavily fallback** (§18): when Firecrawl is unavailable, aggregate the company's OWN official-
  site Tavily results (title+snippet) into content for a STRUCTURAL role signal — never material-event
  Evidence/Timing (Research owns those). Uses the funded, healthy provider, independent of Firecrawl's limit.
- **Bounded subpage cascade** (`vault-reuse-qualification.ts`, §16): when a homepage yields no role signal,
  try ≤2 official subpages (Spanish-first for `.co`); never overrides a real wrong-target/non-company signal
  (§20); total-fetch cap; `recoveredViaSubpage` + `totalFetches` metrics.
- No new provider, no Exa, no Serper funding, no entitlement/pricing change, no concurrency change.

## Qualification before / after (LIVE_OBSERVED, same frozen Colombia manufacturer context)
| Metric | Baseline (V2) | Post-fix |
|---|---|---|
| attempted | 12 | 12 |
| total fetches | 12 | 18 (homepage + fallback/subpage) |
| **qualified → reach Research** | **1** (Almacafé) | **2** (Sedial, Organización Corona) |
| wrong-target rejected | 4 | 6 (Melonn, Coca-Cola FEMSA, Koba, Carvajal, Logisfashion, Domesa) |
| non-company rejected | 0 (2 at admission) | 1 (+2 at admission) |
| unresolved | 2 | 3 |
| **ops-blocked** | **5** | **0** |
| runtime | ~57 s | ~66 s |
| Anthropic cost | 0 | 0 |
In-sample true-target recall improved (operational failures recovered); wrong-target false admissions: **0**
observed. Provider calls bounded (18). Out-of-sample: NOT_STARTED (budget). **Honest caveat**: role attribution
is source-dependent — Almacafé qualified via Firecrawl (V2) but was rejected as association via the Tavily
fallback (V1); Sedial flipped the other way. Safe (conservative reject; Research re-establishes reality) but
yield/consistency is imperfect; role is a structural eligibility signal, not a Decision.

## Candidate ordering
Previous selection: first 12 in Vault fetch order. New selection: unchanged — the forensic proved ordering was
NOT the bottleneck (real manufacturers were already in the first 12). Incremental target-valid yield from
ordering: none pursued. Customer-derived metadata used for selection: **NO** (neutral identity + geography only).

## USA productive canary — NOT_STARTED
Not run this sprint (fresh met the coverage floor last sprint; fallback fires only when fresh is thin).
§32/§33 fallback-trigger correctness (verified-domain floor vs target-qualified floor) noted for the next
increment; not changed.

## Colombia productive canary — Research→Case→Portfolio: NOT_STARTED
The decisive end-to-end chain (Deep Research → canonical Case → Portfolio for a qualified reused operator) was
not executed: it needs live Anthropic-heavy pipeline execution + DB scaffolding beyond this session's
responsible budget (§40/§49). Proven this sprint: qualified reused operators (Sedial, Corona) now **reach
Research selection** live; canonical Cases + Portfolio membership remain to be demonstrated.

## Security (LIVE_OBSERVED + CONTROLLED_VALIDATED)
Neutral projection intact (role is a neutral fact from the company's own content/official-site results; Vault
`industry` never read) · Cross-tenant isolation: PASS (0 leakage across all reused) · Wrong company: none ·
wrong_target_type: preserved (distributors/logistics rejected) · Historical Evidence promotion: none · False
Timing: none (qualification ≠ Timing) · Wrong geography: none · Duplicate domains: none · Provider-failure
honesty: PASS (429 → held, never wrong-target). Persisted snapshot immutable; no customer-relative Vault write.

## Tier acceptance — NOT advanced
Preview/Brief/Portfolio/Premium remain PRODUCTION_WIRED; no full-order validation this sprint (core not fully
CLOSED; §44 begins with Preview only after the shared productive chain passes). No entitlement change.

## Runtime / COGS (LIVE_OBSERVED)
Qualification (Colombia, 18 fetches incl. retries + Tavily fallback): ~66 s. Firecrawl: bounded scrapes (rate-
limited) · Tavily: fallback searches (funded) · Anthropic: **0** this sprint. Qualification cost per true
target and complete-order COGS: not measured (no Deep Research run). Full-order runtime: NOT_STARTED.

## Track B / truth safety
Track B **7/8** preserved — canonical Research/event-retrieval for fresh candidates untouched
(account-deep-research 43, research-temporal-hardening prior 25, account-memory 29 green). No
materiality/Evidence/geography/Decision threshold change; no forced Decisions.

## Tests
| Suite | Result |
|---|---|
| vault-reuse-qualification (pure + subpage recovery + no-fishing + bounded budget + fail-closed) | 33/33 |
| vault-reuse-integration / vault-reuse-config / vault-identity-reuse / vault-reuse-wiring | 15 / 16 / 22 / 7 |
| lead-hunter-universe / productive-intelligence-spine / account-deep-research | 30 / 31 / 43 |
| **release:check** (tsc + ~45 suites + build) | **EXIT 0** |

TYPECHECK: PASS · BUILD: PASS · INTEL SAFETY: PASS (neutral projection, wrong_target preserved, provider-failure honesty).

## Final qualification status
**QUALIFICATION_IMPROVED_NOT_CLOSED** — the operational bottleneck (provider rate-limiting) is fixed;
research-eligible yield doubled on the frozen sample; safety fully preserved. Not CLOSED: no full productive
Case/Portfolio proof, modest yield, provider-dependent role variance, out-of-sample + USA canary not run.

## Release readiness (unchanged)
USA Core / Colombia Core: GUIDED_BETA · all tiers both markets: GUIDED_BETA. Reuse + qualification OFF in prod.

## Remaining primary bottleneck
No live productive proof that a qualified reused operator flows Research → defensible Case → Portfolio (the
decisive customer-value chain), plus provider-dependent role-attribution variance limiting consistent yield.

## Next three moves
1. Run ONE bounded **live productive canary** (`VAULT_REUSE_MODE=CANARY`, Colombia): Sedial/Corona →
   Research → Case → Portfolio, defensible Evidence (Hold where none), bounded COGS + security review.
2. Reduce role-attribution variance (aggregate Firecrawl + Tavily signals; prefer official product/operations
   pages; require corroboration before wrong-target exclusion of a real operator).
3. Revisit the USA thin-universe fallback trigger (§33: qualify pre-Research coverage, not merely
   verified-domain count) and run out-of-sample qualification on a fresh Vault slice.

## Canonical artifacts (by path)
- `lib/lead-hunter/vault-reuse-qualification.ts` · `vault-reuse-qualification-deps.ts`
- `scripts/fixtures/vault-reuse-qualification.test.ts` · `scripts/accept-reuse-qualification-canary.mts`
- `docs/intelligence/LEADLENS_INTELLIGENCE_CLOSURE_PROGRAM_V2_ACCEPTANCE.md` (prior)
