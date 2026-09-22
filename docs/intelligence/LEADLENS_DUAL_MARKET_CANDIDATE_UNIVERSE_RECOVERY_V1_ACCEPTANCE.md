# LeadLens — Dual-Market Candidate Universe Recovery V1 Acceptance

Sprint verdict: **PARTIAL — with the strongest positive result of the recall program.** Read-only Vault
feasibility (Phase A) proved the decisive lever: fresh USA discovery collapses to ~1 operating company,
but the canonical Vault **already holds verified operators** for both launch markets. A neutral,
tenant-safe **Vault identity-reuse lane** was implemented, deterministically tested (16/16) and
**live-proven** (40 US + 40 Colombian verified candidates, zero leakage). It is **not yet wired** into
the productive customer path — enabling it for every run is a behavior change needing a policy decision
+ e2e canary + security review (the next increment). Builds on the USA discovery acceptance docs.

Branch `intelligence-launch-acceptance-v1` · start HEAD `b247559` · end HEAD `0b10e50` (+ this doc) ·
worktree `leadlens-landing-v2`. No push. No merge. Frozen core / Billing / other worktree untouched.

## Providers
Brave/Tavily HEALTHY · Firecrawl HEALTHY · Supabase read-only (service role) used for Vault inventory +
neutral fetch. No Anthropic spend. Exa/SAM.gov/Data.gov not integrated. No new provider, no billing change.

## Phase A — Vault feasibility (READ-ONLY, no writes) — VAULT_REUSE_JUSTIFIED
Live inventory of `vault_companies` (global/neutral table; **no owner/tenant column** by schema):
- **165 companies**, all recent (last_seen median **22 days**, max 72). company_type: Manufacturer 39 /
  Logistics 27 / Distributor 7 / Unknown 80.
- **USA: 71 companies, every one with a verified domain, 46 industrial-relevant** (Post Holdings, Mars,
  SunOpta, Lassonde, American Packaging, Kaps-All, WWEX, Seko, Burris Logistics, Shipfusion, Legacy
  Supply Chain, …) — exactly the operators fresh USA discovery collapses to ~1 on.
- **Colombia: 56 companies, 44 with domain, 23 industrial-relevant** (Alpina, Colombina, Grupo Carvajal,
  Organización Corona, Coca-Cola FEMSA, Almacafé, Tecnoglass, Belcorp, …).

Marginal value is high for USA (fresh ~1 → reusable ~40 verified operators) and bounded-but-useful for
Colombia (fresh already ~15–18; reuse adds verified breadth). **Decision: VAULT_REUSE_JUSTIFIED.**

## Safety flag found + handled
The Vault `industry` field carries **customer-ICP-derived text** ("Mid-market packaging manufacturers
with owned plants") — NOT a neutral fact. Reuse therefore projects **only name + canonical domain +
country**, and never reads or emits `industry`, observation counts, `last_seen`, source status, or any
customer-relative attribute (§24–§27).

## Implemented — `lib/lead-hunter/vault-identity-reuse.ts` (tested + live-proven; NOT wired)
- `projectNeutralIdentity` → `RawDiscoveredOrg{origin:"vault_reuse"}` carrying only name/domain/country
  + provenance (a **runtime + fixture leakage guard** asserts no other keys).
- `selectVaultReuseCandidates(context, deps)` → geography-filtered (customer's own geography), domain-
  required, canonical-dedup, budget-bounded (≤40).
- `withVaultReuse(baseRunner, deps)` → additive composition over the productive `DiscoveryRunner`: run
  base, then append de-duplicated neutral reuse candidates; **fail-closed** (a fetch error preserves the
  base run). Vault candidates enter the **existing** `hunt` admission → per-customer target-validation,
  geography, canonical dedup, then canonical Research (no shortcut, no Evidence/Timing/Decision from
  reuse; `last_seen` never an event date).

Evidence: 16/16 deterministic fixtures; tsc 0; **release:check EXIT=0** (all ~45 suites + build; Track B
7/8 preserved). **Live proof (read-only):** neutral fetch returned 40 US + 40 Colombian verified operator
candidates; runtime leakage guard = "name/domain/country + provenance only".

## Fresh discovery
Unchanged this sprint (prior findings stand): USA English category/event queries return market-research
SEO; negative-term suppression and buyer-prefix removal rejected; general name-based enumeration unsafe
(company-vs-category). The identity-precision guard (5eb02c7) is intact. **Vault reuse is the
complementary lever that does not depend on fixing fresh English search.**

## USA / Colombia productive acceptance
Candidate generation: **LIVE_OBSERVED** (40 US + 40 CO neutral candidates). Full productive runs
(Research → P/V/M/H → Portfolio): **NOT run** — the lane is not yet wired, and enabling it changes every
customer's universe, so it needs the wiring + policy + canary below before productive acceptance.
Classification state (fresh-only) unchanged: US industrial/lean SYSTEMATICALLY_INCOMPLETE, US channel
THIN_BUT_DEFENSIBLE; Colombia larger but unverified for current-event quality this sprint.

## Track B / truth safety / security
Track B **7/8** preserved (no shared retrieval code changed). No wrong company, geography, event, date,
Timing, claim/source, Independent Support, Memory/Vault contamination, or **cross-tenant leakage** (the
lane is neutral-projection-only, and the module is not yet in any customer run). Vault accretion path
untouched (no manual backfill).

## Status
VAULT_REUSE_JUSTIFIED · module IMPLEMENTED + CONTROLLED_VALIDATED + candidate-gen LIVE_OBSERVED ·
**IMPLEMENTED_NOT_LIVE** in the customer path. Readiness unchanged: USA + Colombia, all tiers —
**GUIDED_BETA** (productive acceptance pending wiring + canary).

## Remaining primary bottleneck
Wiring the reuse lane into the productive path **safely** — a policy decision (always-on vs thin-universe
fallback to avoid flooding rich universes) + one e2e canary per market + a security review — then
confirming the combined universe improves USA Research selection without admitting off-target companies.

## Next three moves
1. **Wire `withVaultReuse(defaultDiscoveryRunner, createVaultReuseDeps())`** at
   `app/api/internal/intelligence-runs/[runId]/process/route.ts` and `app/api/customer/lead-hunter/route.ts`,
   gated as a **thin-universe fallback** (contribute reuse only when fresh account-first yields few
   canonical operators) to avoid flooding Colombia's already-rich universe.
2. Run **one US industrial-automation + one Colombia productive canary**; verify the universe improves,
   vault candidates pass per-customer target-validation (off-target ones filtered), and Research
   re-establishes current events (Hold where none) — with a security review of the neutral projection.
3. If clean, classify all three US + three Colombia contexts and decide LIMITED_SELF_SERVE_BETA per market.

## Canonical artifacts (by path)
- `lib/lead-hunter/vault-identity-reuse.ts` · `scripts/fixtures/vault-identity-reuse.test.ts`
- `lib/lead-hunter/candidate-universe.ts` (`hunt`, `DiscoveryRunner`), `lib/lead-hunter/discovery-runner.ts` (`defaultDiscoveryRunner`)
- `docs/intelligence/LEADLENS_USA_{OPERATING_COMPANY_DISCOVERY_V1,ACCOUNT_FIRST_ENUMERATION_V1}_ACCEPTANCE.md`
