# LeadLens — Automated Lead Hunter Intelligence V1 — Report

**Date:** 2026-08-26 · **Scope:** automate confirmed-context → candidate account universe without founder-by-founder selection, reusing the existing discovery engine. No landing/pricing/Monitor/new-provider changes; stops before deep Opportunity Case research.

## 1. Existing Discovery Architecture
Real engine = `runCompanyFirstDiscovery(icp, criteria)` → `buildCompanyUniverse` (company-first-v2), returning candidates + rich `DiscoveryMetrics` (origins, roles, visibility, provider status, operating mode). It already performs identity resolution (domain), dedup (`duplicate_domain_identity`), deterministic prioritization (no exposed numeric score), and graceful provider degradation. Real-provider behavior is covered by the `discovery-engine-v2-*-live` suites (77 + 40 tests green). The `lib/lead-hunter/*` July module is a manual-sources scaffold (not reused).

## 2. Automation Gap
No typed **context→universe facade**: nothing turned `ConfirmedCommercialContextV1` into a stable, inspectable candidate universe with a first-pass status taxonomy, discovery provenance, and coverage/gap model, owner-scoped, short of the full pipeline. That facade is this sprint.

## 3. Discovery Plan
`planDiscovery(ConfirmedCommercialContextV1)` (pure, deterministic) → `DiscoveryPlan`: organizationTypes/industries/geographies/businessModel, conceptual **routes** (industry_category, geo_category, partner_channel, expansion_signal, named_account_expansion, source_ecosystem), exclusions, named seeds, watch signal families (hints), a bounded technical **budget** (`DEFAULT_DISCOVERY_BUDGET`), and `planGaps`. Routes derive from objective/relationship (partnerships→partner_channel; advisory→expansion_signal; software→industry+geo) and are capped at `maxRoutes`.

## 4. Discovery Routes
Multi-route, conceptual (providers execute them). Bounded by budget regardless of input breadth (verified: 40 industries × 30 geographies still ≤ `maxRoutes`). No provider-specific query strings in the domain object (§7/§28).

## 5. Provider Routing
`defaultDiscoveryRunner` reuses the engine (no new engine) and is **tier-aware from the technical budget** (small candidate budget → cheaper `preview` tier + `costCapUsd`). Provider selection/health/fallback are owned by the engine; the facade consumes `providers_available/missing` + `operating_mode`.

## 6. Candidate Model
`CandidateAccount`: `identity` (canonicalName/domain/country/orgType/aliases/confidence), first-pass `status` + `statusReason`, `provenance: DiscoveryProvenance[]` (route/origin/provider/source — **never evidence**), and research-handoff hints (`opportunityConditionIds`, `watchSignalFamilies`, `openQualificationQuestions`). No Fit/Timing/Decision/Evidence/score.

**Status taxonomy** (distinct from Decisions and HOT/WARM/COLD): `eligible | likely_eligible | needs_validation | excluded | identity_ambiguous`.

## 7. Identity Resolution
Canonical key = domain when present, else normalized name+country. Same name / different domains|countries → **distinct** candidates (parent/subsidiary/brand not merged). A bare (domainless) name colliding with ≥2 domains, or a bare name with conflicting countries → `identity_ambiguous` (never silently qualified).

## 8. Deduplication
Same canonical identity surfaced by multiple providers/routes → **one** candidate with multiple `provenance` entries. Multiple origins are provenance, **not** independent evidence corroboration (typed + tested). `duplicateRate` recorded.

## 9. Eligibility
Deterministic, inspectable: resolved domain + known type/industry → `eligible`; resolved but unknown attribute → `needs_validation` (unknown ≠ fail); plausible but domainless → `likely_eligible` (low footprint is not rejection). No numeric lead score.

## 10. Exclusions
Hard exclusions (industry/geo/name/business-model) applied deterministically → `excluded` with a configuration reason, **never** counterevidence. Geography exclusion requires a known country (no fabricated certainty).

## 11. Discovery Provenance
Each candidate keeps route, origin, provider, sourceUrl, discovered name, timestamp — kept strictly separate from Evidence.

## 12. Coverage / Gaps
`CoverageSummary`: operating mode, providers available/failed, routes attempted, discovered/unique counts, per-status counts, duplicateRate, and machine-readable `gaps` (`low_public_footprint`, `provider_unavailable`, `sparse_geographic_coverage`, `identity_ambiguity`, `insufficient_target_definition`, `candidate_volume_too_low`, …). No fake "% of market covered".

## 13. Failure / Retry
One provider down → universe completes, gap + `provider_anomaly` review recorded (verified live: Serper down). All providers down / runner throws / insufficient target → `ok:false` with a `failureReason`, **zero fabricated candidates**. Budget bounds retries.

## 14. Downstream Research Handoff
`huntFromConfirmedContext(store, userId, selector, runner)` is owner-scoped (tenant isolation) and attaches the context's `opportunityConditionIds` to each candidate, so Research receives identity + why-discovered + relevant conditions + watch families + open questions. Research still owns Evidence/What-Changed/Timing/corroboration/Decision.

## 15. Observability
Per-run: discovered/unique/per-status counts, duplicateRate, providers used/failed, routes attempted, gaps, `runId`, context lineage, generatedAt, `reviewRequired` classes — consumable later by an Intelligence Observatory. No dashboard built.

## 16. Golden Fixtures (mock discovery)
Software/manufacturing **PASS**, Consulting **PASS**, Partnerships **PASS** (partner relationship preserved, not coerced to customer sales). No founder selection; truth boundaries hold.

## 17. Real Provider Smoke (executed, bounded)
Software/manufacturing confirmed context → `defaultDiscoveryRunner` (preview tier, `costCapUsd 0.5`), **33.0s**: **8 discovered / 8 unique**, **7 eligible / 1 identity_ambiguous / 0 excluded**, providers available **Brave + Tavily**, **Serper failed** → graceful degradation (`provider_unavailable` gap, universe still `ok`, `full_discovery` mode). No Fit/Timing/Decision produced. This proves the facade reaches real providers via the engine and automates end-to-end. (Not extended to a broad benchmark, per §59.)

## 18. Colombia / Spanish
Not run as a separate live smoke this sprint (bounded scope). The facade preserves observed names, supports geography/exclusion in Spanish contexts, and classifies low-footprint private orgs as `likely_eligible` (tested with a Colombian SAS fixture) rather than rejecting them. A dedicated Colombia live smoke is recommended next.

## 19. Manual Exception Classes
`identity_ambiguity`, `uncertain_hard_exclusion`, `provider_anomaly`, `unsupported_target_type`, `repeated_zero_yield`. Normal golden runs produce **none** (mock) or **one** (live: the ambiguous candidate).

## 20. Automation Readiness
Live golden run: **7/8 (~87%)** candidates auto-classified `eligible` with no founder input; 1 flagged for identity review. Estimated **~85–90%** of normal supported candidate-universe generation runs without manual review, with human review confined to the exception classes above. Estimate is grounded in the live run + deterministic tests, not asserted to hit a target.

## 21. Tests
New `lead-hunter-universe.test.ts` **27/27** (plan, golden×3, dedup, identity collisions, exclusion, unknown, low-footprint, provider-failure, all-fail, runner-throw, budget, tenant isolation, idempotency, observability, insufficient-target, reuse). Regression green: confirmed-context-execution 21, confirmed-context-persistence 31, execution-context-adapter 22, interpret-discovery 30, company-first-discovery 77, discovery-engine-v2 40, commercial-continuity 17, account-memory 27. `tsc --noEmit` clean; `npm run build` clean.

## 22. P0/P1/P2
- **P0:** none.
- **P1:** persist the `CandidateAccountUniverse` per run (reuse `snapshot_reports`/`lead_searches` or a narrow new table) for auditability/idempotent reuse; wire `huntFromConfirmedContext` into an authenticated route/job; Serper quota (predicted-exhausted) — accept degradation or refresh.
- **P2:** dedicated Colombia/Spanish live smoke; richer identity resolution (alias/legal-entity graph); route-level yield metrics for COGS tuning.

## 23. Recommended Next Intelligence Move
1. Account Memory live Review1→Review2 acceptance.
2. Recurring Monitor Intelligence V1.
3. Provider-routing / COGS optimization from real automated-run data.
