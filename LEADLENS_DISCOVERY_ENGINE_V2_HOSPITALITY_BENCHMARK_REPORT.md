# LeadLens — Discovery Engine V2: Hospitality Colombia Benchmark

Turns the hypothesized source intelligence into a **measured discovery pipeline**. Controlled Source Executor, entity resolution V2, staged validation funnel, incremental/marginal yield, source overlap, and source-vs-provider metrics — run over a **deterministic fixture** (0 provider calls, no live crawl). Pilot 1/2 and Account Memory untouched.

> **Honesty note (§54):** This benchmark is **fixture-based**, not a live crawl. `provider_calls = 0`, `live_execution = false`, `data_basis = deterministic_fixture`. It measures the *pipeline architecture*, not real Colombian market performance. Differences are **preliminary**; real-world source confidence stays `hypothesized` (a fixture run cannot promote a real source beyond `benchmarked`). A live, budgeted validation is the explicit next step.

## 1–3. Initial HEAD / Git / Production
HEAD `3933112` (`feat: build country industry source intelligence layer`), branch `main`, origin in sync, tree clean except `.leadlens/*`. Production `/login` 200; `/admin/intelligence/discovery` present; migration 048 present; recurring-cycle 50/0 (Account Memory 15 accounts intact); Pilot 2 `PLANNED — NOT AUTHORIZED`.

## 4. Existing discovery audit
Preserved: Source Intelligence Layer V1 (`lib/discovery/source-intelligence/{taxonomy,registry,router}`), providers (`lib/providers/*`), source adapters (`lib/sources/*`), Account Memory + recurring cycle. This sprint adds executor/benchmark on top; nothing existing was modified.

## 5–8. Objective / context / budget / strategies
- **Objective:** measure which discovery strategies, sources and providers actually produce novel, context-compatible accounts per unit cost.
- **Benchmark cell:** Colombia · hospitality/boutique/spa/wellness · hotel_operator · hospitality_guest_experience · guest_amenity.
- **Budget:** 60 source pages, 120 extractions, 60 domain resolutions, 40 evidence calls (hard caps, enforced).
- **Strategies:** A structured-first (RNT → Cotelco → search), B search-first (search → company sites for domains), C hybrid (RNT+Cotelco discovery + search enrichment only).

## 9. Sources executed
RNT (registry), Cotelco (association), search engine; company sites (hybrid enrichment). Fixture rows = 24.

## 10. Providers used
`firecrawl_structured` (structured sources), `serper` (search/domain resolution) — **simulated** (fixture). Provider calls = **0**.

## 11. Structured extraction
`SourceExecutor` per source with provenance, budget, stop reason; adapters modeled as registry / association-directory / search. Candidates remain `DISCOVERY_CANDIDATES` until identity resolves.

## 12–19. Measured funnel (per strategy)

| Metric | Structured-first | Search-first | Hybrid |
|---|---|---|---|
| Source results | 24 | 9 | 15 |
| Raw candidates | 24 | 9 | 15 |
| Entity resolved | 14 | 5 | 11 |
| Official domains (verified) | 6 | 5 | 5 |
| Context compatible | 11 | 5 | 8 |
| Evidence sufficient | 10 | 5 | 7 |
| Opportunity plausible | 9 | 5 | 6 |
| **Genuinely-new qualified** | **6** | 3 | 4 |
| Duplicate rate | 0.21 | 0.00 | — |
| Cost (est. units) | 17.5 | 6.5 | 12.7 |
| Marginal cost / qualified | 1.94 | 1.30 | 2.12 |

- **Entity resolution:** non-business (articles/aggregators) and associations rejected at identity; group vs property distinguished; merges require shared official domain or name+geo (never fuzzy name alone).
- **Official domains:** RNT exposes **0 verified** domains (registry gives names, not domains) → resolved as `probable` pending a provider; Cotelco/search carry domains.
- **Novelty:** the 4 known Amor accounts (Éteka, Celestino, Masaya, Charleston) are suppressed → excluded from genuinely-new-qualified.

## 20–23. Funnel by strategy / source / provider · overlap
- **By source (structured-first):** RNT raw 8 → 4 incremental qualified, **0 verified domains**, role observed = DISCOVERY + IDENTITY (low domain), marginal cost 1.92; Cotelco adds buyer-model-rich hotels with domains; search adds few unique + heavy noise.
- **By provider:** serper resolved 4 registry-origin domains; firecrawl_structured 5. Provider producing the most URLs (search) is **not** best — it drives the largest rejection bucket.
- **Overlap:** structured-first duplicate rate 0.21 (RNT∩Cotelco); 9 unique qualified across all strategies.

## 24–25. Incremental yield & marginal cost
Per-source incremental qualified and marginal cost are computed (e.g. RNT 4 incremental qualified @ 1.92). Search as a *second* source after structured adds mostly duplicates/noise → poor incremental value; strong as a **domain resolver / gap-filler**, weak as primary discovery.

## 26–27. Source ordering & complementarity
RNT-first vs Cotelco-first overlap heavily (same properties); complementarity is by **role**, not discovery volume: RNT = identity/coverage, Cotelco = business-model + domains, search = domain resolution + long-tail. The system preserves these role distinctions.

## 28–29. Provider findings
`serper` best for **domain resolution** of registry-origin entities; structured fetch best for **coverage/identity**. Do not equate URL count with quality (search = 67% of rejections).

## 30. Rejection reasons
`non_business_result` **8 (67%)** — concentrated in **search_engine** (articles/listicles); `wrong_geography_or_route` 2 (17%, RNT weak-route hotels); `aggregator` 2 (17%, search). **Biggest candidate loss and blocker:** non-business search noise + official-domain resolution for registry-origin entities.

## 31. False-positive audit & 40. Founder review sample
`review_sample` exposes 10 strongest (verified identity+domain+strong spa mechanism), borderline (evidence/domain gap), and lowest-confidence rejected, each with source + why + evidence — for direct founder inspection. (Small sample; automated labels, not machine-certified precision.)

## 32–33. Snapshots & source confidence
Real per-source performance recorded as `SourceContribution`/snapshot (append-only). Confidence: fixture run marks pipeline `benchmarked` at most; **real-world confidence stays `hypothesized`** — no promotion to `historically_effective` on one (fixture) run.

## 34. Learning recommendations (approval-gated)
`keep_strategy` (structured-first), `use_source_for_identity_not_domain` (RNT), `research_source` (structured hotel-collection with domains). Every rec: `human_approval_required: true`, `auto_applied: false`, `fixture_based: true`, confidence `low`. **No production reprioritization applied.**

## 35–36. Research gaps & stop conditions
Gap: registry-origin entities lose at the domain stage → research a structured hotel-collection source. Stop: `source_ecosystem_exhausted` (within budget).

## 37. Observatory changes
`/admin/intelligence/discovery` extended with a **Benchmark medido** section: fixture warning banner, strategy comparison table, rejection analysis, approval-gated recommendations. Renders `N/A` where denominators are unsafe; commercial performance shown as `awaiting_real_outcomes`.

## 38–40. Persistence / providers / cost
Persistence: deterministic artifact `output/discovery-v2-colombia-hospitality-001.json` (reproducible; regenerate via `npm run pilot:discovery-v2-benchmark`). Provider calls **0**. Cost: estimated units only (fixture), attributed by depth level (discovery/identity/validation/evidence).

## 41–43. Tests / TypeScript / Build
`test:discovery-engine-v2` **40/0** (executor budget, provenance, entity-resolution V2 incl. reject-fuzzy + group/property, domain/aggregator, model/context/opportunity, novelty suppression, funnel, incremental/marginal, overlap, source≠provider, rejection analysis, review buckets, approval-gated learning, fixture honesty, reproducibility). Regression: source-intelligence 38/0, recurring-cycle 50/0, amor-pilot1 delivery ok. `tsc` clean; `npm run build` succeeded.

## 44. Files changed
New: `lib/discovery/source-intelligence/{benchmark-fixture,executor,benchmark}.ts`, `scripts/artifacts/run-discovery-v2-benchmark.ts`, `scripts/fixtures/discovery-engine-v2.test.ts`, `output/discovery-v2-colombia-hospitality-001.json`, this report. Modified: `lib/discovery/source-intelligence/index.ts` (exports), `app/admin/intelligence/discovery/page.tsx` (benchmark section), `package.json` (+2 scripts). Pilot 1/2, Account Memory, providers, source adapters untouched.

## 45–46. Commit / push
Commit `feat: benchmark discovery engine with measured source yield`. Push via GitHub Desktop (no CLI push credentials); admin route deploys on push.

## 47. Founder review required
Open `/admin/intelligence/discovery` → **Benchmark medido**. Decide: (1) keep structured-first for this context? (2) RNT first, Cotelco second? (3) RNT = identity/coverage (not domain source)? (4) serper for domain resolution? (5) approve researching a structured hotel-collection source? None are auto-applied.

## 48. Recommended second benchmark (NOT executed)
Colombia · manufacturing/industrial · manufacturer · procurement · supplier_addition/procurement_replacement — to test generalization beyond hospitality.

## 49. Exact next sprint
**Discovery Engine V2 — live controlled execution (Colombia hospitality)**: run one Tier-1 source live under a hard provider-call budget, capture real `SourcePerformanceSnapshot`s (replacing fixture), compare to this baseline (regression benchmark), and surface the first measured non-fixture yields — founder-approved before any reprioritization.

## 50. Stop confirmation
Executor + structured extraction + 3 budgeted strategies + measured funnel + incremental/marginal yield + overlap + source/provider separation + approval-gated learning + reproducible artifact + Observatory + founder-review sample — all present. 0 provider calls, no outreach, no people enrichment, Pilot 1/2 unchanged. **Did not** execute the manufacturing benchmark. Stopping.
