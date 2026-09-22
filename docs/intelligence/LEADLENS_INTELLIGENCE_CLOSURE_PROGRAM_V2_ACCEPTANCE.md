# LeadLens — Intelligence Closure Program V2 Acceptance

Sprint verdict: **HYBRID_UNIVERSE_IMPROVED_NOT_CLOSED (blocker transition CLOSED, safe & live-proven).**
The last demonstrated Hybrid-Candidate bottleneck — reused verified identities never reaching Research — is
now closed at the failing transition: a safe **current-source operating-role qualification** lets genuinely
relevant reused operators reach normal Research while wrong-target and non-operating identities are rejected,
with `wrong_target_type` preserved and zero cross-tenant leakage. Not declared CLOSED: the full productive
Research→Case→Portfolio canaries and the six-context matrix + four-tier full-order acceptance were not run
(expensive; deferred), and live qualification yield is modest for narrow targets. Builds on
`LEADLENS_HYBRID_CANDIDATE_UNIVERSE_V1_ACCEPTANCE.md` (not duplicated here).

Distinctions: **LIVE_OBSERVED** = real providers + real Vault this sprint · **CONTROLLED_VALIDATED** =
deterministic fixtures · **IMPLEMENTED_NOT_LIVE** = shipped, flag OFF in prod · **NOT_STARTED**.

## Git
Branch `intelligence-launch-acceptance-v1` · worktree `leadlens-landing-v2`. Start HEAD `73c9539` · end HEAD
`cdedc70` (+ this doc). Push: **NO.** Merge: **NO.** Commits: `beae9cb` (qualification impl + fixtures),
`cdedc70` (live qualification canary). Frozen Intelligence truth model / Billing / other worktree: untouched.

## Changed files
- `lib/lead-hunter/vault-reuse-qualification.ts` (NEW — pure qualification core + orchestrator)
- `lib/lead-hunter/vault-reuse-qualification-deps.ts` (NEW — bounded Firecrawl `/v1/scrape` fetcher, fail-closed)
- `lib/lead-hunter/research-readiness.ts` (export `FAMILY`/`families` as single source of truth)
- `lib/intelligence/productive-spine.ts` (qualify reused identities before the Research handoff; best-effort/fail-closed)
- `app/api/internal/intelligence-runs/[runId]/process/route.ts` (inject qualifier only when `VAULT_REUSE_MODE != OFF`)
- `scripts/fixtures/vault-reuse-qualification.test.ts` · `scripts/accept-reuse-qualification-canary.mts`

## Research qualification (IMPLEMENTED_NOT_LIVE)
- **Chosen mechanism (§9 option A)**: bounded current public-source qualification. For each Vault-reused,
  in-scope, domain-verified, type-unknown identity, fetch its OWN official domain content (bounded Firecrawl
  scrape, ≤6 KB, 12 s timeout) and establish an operating-role **family** using the EXISTING `FAMILY` dict +
  `classifyOrganization` — **no new scoring/Fit engine, no new LLM call, no Vault `industry` read**.
- **Statuses**: `QUALIFIED_FOR_RESEARCH` (neutral source-verified role → org type set → reaches Research) ·
  `REJECTED_WRONG_TARGET_TYPE` · `REJECTED_NON_COMPANY` · `REJECTED_WRONG_GEOGRAPHY` ·
  `UNRESOLVED_INSUFFICIENT_EVIDENCE` (held) · `OPS_BLOCKED_PROVIDER_FAILURE` (held — provider failure ≠ wrong
  target, §13/§43).
- **wrong_target_type safety**: preserved and strengthened — a verified role outside the customer target
  families is rejected, never admitted (CONTROLLED + LIVE).
- **Vault-noise rejection (§18)**: a CONTENT role guard rejects publisher / news-wire / job-board identities
  from role phrases (not a domain-extension or broad keyword blacklist); directory hosts already rejected at
  admission.
- **Qualification budget**: `maxQualify` (default 12) bounded official-source fetches per run; the observed
  role is a neutral fact about the company itself and is written only to the in-memory research-handoff copy
  — the **persisted discovery snapshot is immutable**, and nothing customer-relative is written to the Vault.

## USA (NOT_STARTED this sprint)
Full productive canaries (industrial automation / lean operations / channel) not run. Prior sprint: US fresh
discovery met the coverage floor (6) so the fallback stayed closed; qualification affects only reused
identities, which appear only when the fallback fires. Deferred to a bounded live-Research canary.

## Colombia — live qualification canary (LIVE_OBSERVED; Firecrawl scrape, NO Deep Research)
Real Vault → 38 in-scope Colombian reused identities, **0 reaching Research pre-qualification**. Bounded
qualification (12 official-source fetches, ~57 s):
- **qualified 1** → Almacafé (`almacafe.com.co`, role=manufacturer) — now reaches Research.
- **rejected wrong-target 4** → Coca-Cola FEMSA (distributor/retailer), Melonn (logistics/software), Sedial
  (distributor/logistics), Organización Corona (financial — a conservative false-negative from an IR homepage).
- **unresolved 2** (no role signal on homepage) · **ops-blocked 5** (Firecrawl scrape failed — held, not excluded).
- Safety: no reused identity reached Research without a source-verified role; every qualified role matched the
  target; **zero leakage**; bounded fetches; provider failures never became wrong-target rejections.
Customer effect where the fallback fires: **+1 verified manufacturer (Almacafé) reaches Research beyond
fresh** for this narrow manufacturer-only target. Honest limits: yield is modest (Vault skews to
distributor/logistics for a manufacturer target) and Firecrawl homepage reliability was ~58%.

## Dual-market matrix (NOT_STARTED) · Portfolio outcome
The six-context matrix and full productive Research→Case→Portfolio runs were not executed (expensive; §40/§53
stopping discipline). Customer-visible Portfolio improvement is therefore proven **up to Research selection**
(reused operators now enter Research), not yet through delivered Cases.

## Security (LIVE_OBSERVED + CONTROLLED_VALIDATED)
Neutral projection intact (qualification adds only a neutral, source-verified role; never the Vault `industry`
field) · Cross-tenant isolation: PASS (0 leakage across 38 live reused) · Historical Evidence promotion: none
(role ≠ Evidence/Timing; Research re-establishes events) · Other-customer metadata leakage: none · Duplicate
companies: none (canonical-domain dedup). Persisted snapshot immutable; no customer-relative Vault write.

## Track B / truth safety
Track B **7/8** preserved — the qualification stage does not touch canonical Research/event-retrieval for fresh
candidates (research-temporal-hardening 25, account-deep-research 43, account-memory 29 green). No
materiality/Evidence/geography/Decision threshold change; no forced Prioritize/Validate/Timing.

## Tier acceptance (§32) — NOT advanced this sprint
Four tiers + Premium remain **PRODUCTION_WIRED** (prior inspection). Full-order live validation not run
(core not fully CLOSED; §5 core priority + §40 stopping rule). No entitlement/pricing change.

## Tests
| Suite | Result |
|---|---|
| vault-reuse-qualification (pure + orchestrator + e2e reach-Research + adversarial + budget + fail-closed) | 29/29 |
| vault-reuse-config / vault-identity-reuse / vault-reuse-integration / vault-reuse-wiring | 16 / 22 / 15 / 7 |
| lead-hunter-universe / lead-hunter-production / dynamic-universe-recall / event-first | 30 / 24 / 28 / 40 |
| productive-intelligence-spine / event-first-parity / spine-trace / vault-spine-accretion / memory-lineage | 31 / 13 / 21 / 10 / 4 |
| intel-guard: research-temporal-hardening / account-memory / account-deep-research / opportunity-synthesis / materiality | 25 / 29 / 43 / 40 / 7 |
| **release:check** (tsc + ~45 suites + build) | **EXIT 0** |

TYPECHECK: PASS · BUILD: PASS · INTEL SAFETY: PASS.

## Runtime / COGS (LIVE_OBSERVED)
Qualification (Colombia, 12 fetches): ~57 s, bounded Firecrawl scrapes only; **no Anthropic / Deep Research
spend** this sprint. Search-provider monetary cost not separately metered. Full-order tier COGS: not measured
(no full order run).

## Hybrid universe status
**HYBRID_UNIVERSE_IMPROVED_NOT_CLOSED** — the reused-identity → Research transition is closed (safe,
deterministic + live-proven; wrong_target_type preserved; zero leakage). Not CLOSED: full productive
canaries + six-context matrix + tier full-order acceptance not run; live yield modest.

## Release readiness (unchanged)
USA Core: GUIDED_BETA · Colombia Core: GUIDED_BETA · all tiers both markets: **GUIDED_BETA**. Reuse +
qualification are OFF in production (`VAULT_REUSE_MODE` default OFF).

## Remaining primary bottleneck
No live productive proof yet that a qualified reused operator flows Research → defensible Case → Portfolio,
and qualification yield/reliability (homepage-only scrape, provider failures) limits contribution for narrow
targets.

## Next three moves
1. Run ONE bounded **live productive canary** per market under `VAULT_REUSE_MODE=CANARY` (allowlisted context):
   confirm the qualified reused operator flows Research → Case → Portfolio with defensible Evidence (Hold where
   none), bounded COGS, + a security review of persisted/customer-visible output.
2. Improve qualification robustness (scrape `/about` or products page / aggregate, or fall back to the existing
   Firecrawl search signal) to raise yield and reduce homepage-IR false-negatives (e.g. Organización Corona).
3. If clean, run the six-context matrix and decide LIMITED_SELF_SERVE_BETA per market; then advance four-tier
   full-order acceptance starting with Preview/Brief.

## Canonical artifacts (by path)
- `lib/lead-hunter/vault-reuse-qualification.ts` · `vault-reuse-qualification-deps.ts` · `research-readiness.ts`
- `lib/intelligence/productive-spine.ts` · `app/api/internal/intelligence-runs/[runId]/process/route.ts`
- `scripts/fixtures/vault-reuse-qualification.test.ts` · `scripts/accept-reuse-qualification-canary.mts`
- `docs/intelligence/LEADLENS_HYBRID_CANDIDATE_UNIVERSE_V1_ACCEPTANCE.md` (prior)
