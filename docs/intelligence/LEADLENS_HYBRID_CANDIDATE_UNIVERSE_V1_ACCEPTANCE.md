# LeadLens — Hybrid Candidate Universe V1 Acceptance (Productive Vault-Reuse Integration)

Sprint verdict: **HYBRID_UNIVERSE_IMPROVED_NOT_CLOSED.** The neutral Vault identity-reuse lane is now
wired into the productive Candidate-Universe path as a **reversible, default-OFF, thin-universe fallback**,
and is **live-proven** to recover verified, in-geography, leak-free operating identities (Colombia: fresh
3 → hybrid 41). One demonstrated blocker prevents end-to-end customer-Portfolio improvement and keeps the
flag OFF: reused identities carry no org type (by neutral design), and the frozen research-readiness gate
requires a confirmed/target-matching type, so reused identities are admitted to the Universe but **do not
reach Research yet** — the loss is at Research selection (§34). Builds on
`LEADLENS_DUAL_MARKET_CANDIDATE_UNIVERSE_RECOVERY_V1_ACCEPTANCE.md`.

Distinctions: **LIVE_OBSERVED** = run against real providers + real Vault this sprint · **CONTROLLED_VALIDATED**
= deterministic fixtures · **IMPLEMENTED_NOT_LIVE** = shipped, flag OFF in prod · **HYPOTHESIS** = not yet proven.

## Git
- Branch `intelligence-launch-acceptance-v1` · worktree `leadlens-landing-v2`.
- Start HEAD `0fbe1b4` · end HEAD `ecba479` (+ this doc). Push: **NO.** Merge: **NO.**
- Commits: `a5fb47c` (wiring + flag + safety tests), `ecba479` (live canary + documented blocker test), + this doc.
- Frozen Intelligence truth model, Billing/Pricing/entitlements, other worktree: untouched.

## Providers (this sprint)
Tavily HEALTHY (LIVE) · **Brave DOWN/absent key** (US+CO fresh discovery ran Tavily-only) · Firecrawl key
present · Serper present (unfunded) · Anthropic key present · Supabase read-only (service role). No new
provider, no billing change, no concurrency change.

## Productive wiring (IMPLEMENTED_NOT_LIVE)
- **Feature flag** `VAULT_REUSE_MODE` ∈ `OFF` (default) / `CANARY` / `ELIGIBLE_FALLBACK`, plus
  `VAULT_REUSE_CANARY_CONTEXTS` (context-id allowlist for CANARY). `lib/lead-hunter/vault-reuse-config.ts`.
- **Injection points** (both wrap `defaultDiscoveryRunner`): `app/api/internal/intelligence-runs/[runId]/process/route.ts`
  (the real Research→Cases→Portfolio path) and `app/api/customer/lead-hunter/route.ts` (universe build).
- **Composition**: `withVaultReuse(defaultDiscoveryRunner, createVaultReuseDeps(db), budget, { gate, onTelemetry })`.
- **Fallback policy** (§10): fresh Discovery runs first; reuse is considered ONLY when fresh coverage is
  insufficient for the tier — measured as DISTINCT domain-verified, geography-matched **fresh** identities
  (`FRESH_COVERAGE_SUFFICIENCY` preview 6 / brief 8 / intelligence 10; tier from the technical budget). It is
  candidate COVERAGE, never Fit/Timing/Decision, and never fires on low raw counts, a missing event, or an
  all-Hold distribution.
- **Default behavior**: OFF → gate closed → **no Vault read, byte-for-byte original universe** (proven by the
  wiring test). **Rollback**: set `VAULT_REUSE_MODE=OFF` (or unset).

## Live Vault inventory (LIVE_OBSERVED, current — not historical §2)
Read-only neutral projection of `vault_companies` (name/domain/country/region only): **165 companies, 153 with
domain; USA 71, Colombia 44.** Matches the historical feasibility snapshot.

## USA canary — industrial automation (LIVE_OBSERVED)
Fresh discovery (Tavily-only): **6** domain-verified, in-geography operators → **sufficient** → gate **CLOSED**
→ **no reuse**. Fresh in-scope 6 → hybrid in-scope 6; vault_reused 0. Safety checks all pass. Classification:
**THIN_BUT_DEFENSIBLE** this run — fresh happened to meet the coverage floor, so the fallback correctly stayed
inactive; a material reuse contribution for USA was therefore **not exercised** on this run (it fires only when
fresh < floor, which prior runs showed happens under provider variance). Lean/channel US contexts: **NOT RUN**
(deferred with the Research-selection blocker below).

## Colombia canary — manufacturing (LIVE_OBSERVED)
Fresh discovery (Tavily-only, Brave down): **3** domain-verified → **insufficient** → gate **OPEN** → fallback
fired. Fresh in-scope 3 → **hybrid in-scope 41** (vault_reused **38**). Every reused candidate: Colombia
geography, ZERO cross-tenant/ICP/historical-event leakage, `needs_validation` (identity resolved, type
unconfirmed). Identity inspection (§34/§40): the majority are real Colombian operators (Alpina, Colombina,
Grupo Carvajal, Organización Corona, Coca-Cola FEMSA, Tecnoglass, Belcorp, Almacafé, Grupo Éxito, …); a
handful are **Vault data-quality noise** accreted from prior runs (a prnewswire.com press headline, a
co.trabajo.org job posting, a foodnewslatam publisher). Classification: reuse **materially increases verified
in-geography candidate COVERAGE**, but see the blocker — none reach Research yet.

## DEMONSTRATED BLOCKER — loss at Research selection (LIVE_OBSERVED + CONTROLLED_VALIDATED)
`assessResearchReadiness` returns `structural_match_uncertain` for any domain-verified candidate whose
`organizationType` is unobserved (`research-readiness.ts:40`); `prioritizeResearch` admits only
`research_ready`. The neutral Vault projection **deliberately omits org type** (industry is customer-ICP-derived,
§4), so **0 of the reused identities reach Research** — even ones whose name encodes the family (e.g. "American
Packaging"), because the `!observed` check short-circuits before any identity-family match. Result: the
Candidate Universe grows, but the delivered Portfolio is unchanged. Locked as a deterministic test
(`vault-reuse-integration`: "type-free reused identities do NOT reach Research"). This is exactly the §34
"loss at Research selection" case — reported honestly, not worked around by inflating counts.

Deliberately NOT fixed this sprint: unlocking Research for reused identities is a real precision/cost tradeoff
in a frozen file (research selection), requiring a bounded **live Research** canary to validate — more than can
be safely validated within this session's budget without risking the frozen truth/cost model (§5, §22, §53).

## Security review (LIVE_OBSERVED + CONTROLLED_VALIDATED)
- **Neutral projection**: only name/domain/country + safe provenance leave the DB; `createVaultReuseDeps`
  selects exactly `name, domain, country, region` (proven by the wiring test's column assertion). Adversarial
  fixtures carrying another customer's ICP/Fit/Timing/Decision/notes/run-id are fully stripped.
- **Cross-tenant isolation**: PASS — 38 live Colombian reused candidates, 0 leakage; the lane is never in a
  customer run while OFF.
- **Historical→current**: reused candidates carry no Evidence/Timing/Decision, no research hints, no source
  URLs; `last_seen`/`observation_count` never read.
- **Observation inflation**: none — the reuse read is side-effect free; vault-accretion/observation suites green.
- **Fresh-recall inflation**: none — a reused identity is never counted as a fresh discovery
  (`coverage.freshCandidates` unchanged fresh-vs-hybrid; new `vaultReusedCandidates` axis).
- **Geography**: every reused candidate matched the requested market; wrong-country identities excluded.
- **Duplicates**: fresh+Vault collapse to one canonical candidate (domain key); not double-counted.

## Track B / truth safety
Track B **7/8** preserved (no shared research/retrieval code changed). No wrong company/geography/event/date,
Timing, claim/source, Independent Support, Memory/Vault contamination. No Decision/materiality/threshold change.

## Tests (CONTROLLED_VALIDATED)
| Suite | Result |
|---|---|
| vault-reuse-config | 16/16 |
| vault-identity-reuse (gate/telemetry/adversarial) | 22/22 |
| vault-reuse-integration (coverage/dedup/geo/exclusion/provenance/blocker) | 15/15 |
| vault-reuse-wiring (route composition + neutral-column projection + fail-closed) | 7/7 |
| lead-hunter-universe / lead-hunter-production | 30 / 24 |
| dynamic-universe-recall-v1 / event-first-discovery | 28 / 40 |
| intel-guard (temporal-hardening/account-memory/opportunity-synthesis/provider-cogs/materiality) | 25/29/40/32/7 |
| http-surface-security / provider-health-isolation / vault-accretion / vault-observation | 12/9/8/3 |
| **release:check** (tsc + ~45 suites + build) | **EXIT 0** |

## Cost / runtime (LIVE_OBSERVED)
Live discovery: US ~84s, CO ~62s (Tavily-only, one discovery per market; hybrid reuses that output). Vault
read: single bounded neutral query, negligible. No downstream Research invoked in the canary → no Anthropic
research spend this sprint. Provider monetary cost: not separately metered (bounded search only).

## Hybrid universe status
**HYBRID_UNIVERSE_IMPROVED_NOT_CLOSED** — universe integration complete, safe, reversible, live-proven;
customer-Portfolio value blocked at Research selection (documented). Not CLOSED: reused identities do not yet
reach Research, and the full six-context Research/Portfolio matrix was not run.

## Release readiness (unchanged)
USA Core Intelligence: GUIDED_BETA · Colombia Core Intelligence: GUIDED_BETA. All tiers both markets
(Preview/Brief/Portfolio/Premium): **GUIDED_BETA**. Hybrid discovery does not raise any tier's readiness; the
Vault-reuse fallback is OFF in production.

## Remaining primary bottleneck
Reused (type-free) identities do not reach Research (frozen research-readiness requires a confirmed/target
org type). Until that is resolved, Vault reuse improves Candidate-Universe coverage but not the delivered
Portfolio.

## Next three moves
1. Design + implement a **neutral research-qualification for reused identities** — either a bounded neutral
   type verification (public-signal classification of the vault company's own sector, no customer ICP), or a
   validated identity-family research-eligibility (name/domain positive family match → low research band, the
   `wrong_target_type` contradiction guard preserved) — with controlled tests.
2. Run ONE bounded **live Research canary** per market under `VAULT_REUSE_MODE=CANARY` (allowlisted context):
   confirm reused operators reach Research, pass per-customer target validation, and Research re-establishes
   current events (Hold where none), within bounded COGS; security-review the persisted/customer-visible output.
3. If clean, extend a light Vault data-quality filter (publisher/wire/job-board host denylist in
   `nonAccountReason`) and classify the six US+CO contexts to decide LIMITED_SELF_SERVE_BETA per market.

## Canonical artifacts (by path)
- `lib/lead-hunter/vault-reuse-config.ts` · `vault-reuse-deps.ts` · `vault-identity-reuse.ts` (gate/telemetry)
- `lib/lead-hunter/candidate-universe.ts` (honest fresh-vs-reuse coverage)
- `app/api/internal/intelligence-runs/[runId]/process/route.ts` · `app/api/customer/lead-hunter/route.ts`
- `scripts/accept-hybrid-universe-canary.mts` · `scripts/fixtures/vault-reuse-{config,integration,wiring}.test.ts`
