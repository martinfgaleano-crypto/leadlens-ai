# LeadLens — Country × Industry Source Intelligence Layer V1

A discovery-precision layer that decides **where** LeadLens should search before Discovery Engine V2 expands volume. Multi-label industry graph, country/source registries, contextual source mappings, Source Memory, discovery funnel/yield metrics, and an explainable Source Router. Deterministic; **no provider calls, no search, no outreach**. Pilot 1/2 and Account Memory untouched.

## 1. Initial HEAD
`aed68d3` (`feat: build recurring opportunity cycle foundation`), branch `main`, origin in sync. Migration 048 applied; Pilot 1 paused, Pilot 2 planned/not-authorized.

## 2. Git state
Clean except the intentional `.leadlens/*` runtime files. This sprint adds only new files + `package.json` (one test script).

## 3. Existing discovery audit
Found and preserved: providers (`lib/providers/*`: tavily/apollo/hunter/PDL/public-signal + `provider-registry`/`provider-selector`), source adapters (`lib/sources/*`: directory/apollo/google-maps/linkedin + `source-registry` = **provider** adapters, `source-engine-types` = v0 skeleton), `lib/discovery/*` (company/account-first discovery, segment/company universe, source-utility, source-intelligence-store), Account Memory + recurring cycle (`lib/intelligence/recurring/*`). The new layer sits **above** these and cleanly separates SOURCE (origin) from PROVIDER (retrieval).

## 4. New architecture
`lib/discovery/source-intelligence/`: `taxonomy.ts` (multi-label graph), `registry.ts` (country + source registry + contextual mappings), `router.ts` (Source Memory, funnel/yield, router, gaps, research queue, learning), `index.ts`. Read-only Admin observatory at `/admin/intelligence/discovery`.

## 5. Multi-label taxonomy
Graph, not tree. `IndustryRelation` types: broader_than / narrower_than / adjacent_to / overlaps_with / commonly_cooccurs_with / incompatible_with. An entity carries many `CandidateLabel`s (industry/business_model/route/mechanism) with evidence, confidence, source, inferred-vs-verified, client/cycle relevance — never permanent truth.

## 6. Country model
`CountryProfile` (languages, registries, chambers, associations, tourism directories, trade orgs, regulators, ecommerce, structured-data availability, access restrictions, freshness, quality notes). **Colombia** is the first serious profile; framework ready for MX/US/ES/CL/AR/PE/BR (not populated).

## 7. Industry graph
26 labels + a partial, extensible relation set (e.g. spa overlaps wellness AND co-occurs with boutique_hospitality; boutique_hospitality narrower_than hospitality; manufacturing incompatible_with boutique_hospitality). Country-specific terms (es-CO aliases). No forced single parent.

## 8. Business-model taxonomy
20 models (retailer, distributor, manufacturer, hotel_operator, spa_operator, ecommerce_store, corporate_gifting_provider, marketplace_seller, hospitality_group…). Multi-model per account.

## 9. Commercial-route taxonomy
14 routes (retail_listing, hospitality_guest_experience, spa_integration, corporate_gifting, procurement, wholesale_distribution, co_branding, private_label, location_rollout…). Context-dependent, stored per client+account+cycle+opportunity — never a permanent global route.

## 10. Opportunity mechanisms
15 mechanisms (guest_amenity, kit_inclusion, product_listing, spa_ritual, procurement_replacement, supplier_addition, seasonal_campaign, regional_expansion…), separate from industry.

## 11. Source Registry
`SourceRegistryEntry` (labels, models, routes, ecosystem, roles, access method, robots notes, expected density/domain/freshness/authority/noise, confidence, active). 12 Colombia sources: RUES, Cotelco, RNT, Fenalco, ANDI, CCCE, MercadoLibre CO, ProColombia, INVIMA, company sites, partner/location pages, general search engine.

## 12. Source roles
7 roles: DISCOVERY / IDENTITY / BUSINESS_MODEL / EVIDENCE / SIGNAL / COVERAGE / VALIDATION. A source may hold several; discovering a company ≠ sufficient evidence to recommend it.

## 13. Source ecosystems
20 ecosystems (official_registries, industry_associations, chambers_of_commerce, tourism_directories, hotel_collections, marketplaces, supplier_directories, ecommerce_ecosystems, company_websites, partner_pages, search_engines…). Plans prefer relevant ecosystems before generic queries.

## 14. Country × Industry × Route mappings
`SourceContextMapping` (country × industry_labels × business_models × route × mechanism → tiered source_ids). 5 Colombia mappings: hospitality-guest-amenity, retail-listing, corporate-gifting, manufacturing-procurement, distribution. Overlapping (a source belongs to many mappings; an account can come from many plans).

## 15. Source priorities
8 tiers (tier_1_primary … tier_4_signal_only, low_priority, avoid, inaccessible, deprecated), **contextual** (per country+labels+route+mechanism). Explainable dimensions (`SourcePriorityDimensions`): authority, entity_density, buyer_compatibility_yield, official_domain_yield, evidence_yield, novelty_yield, freshness, extraction_reliability, cost_efficiency, historical_portfolio_yield — no single opaque score.

## 16. Source Memory
`SourceMemory` + append-only `SourcePerformanceSnapshot` per cycle (candidates→valid→model→context→evidence→opportunity→portfolio, novelty, false-positives, duplicates, extraction/access failures, cost, latency). Commercial-outcome fields (client_selected/contact/order rate) exist but stay `null` → `awaiting_real_outcomes` (§31). History preserved; `quality_trend`.

## 17. Discovery funnel
10 canonical stages (source_results → … → portfolio_selected) as `DiscoveryFunnelEvent` with per-rejection stage/reason/rule/source/account/evidence.

## 18. Yield metrics
`yieldMetrics()`: raw/valid/business-model/context/evidence/opportunity/portfolio/novelty/official-domain yields, false-positive & duplicate rates, cost per qualified & per portfolio account. Pure functions.

## 19. Source Router
`buildSourcePlan(context, {knownAccounts, sourceMemory})` → `SourcePlan`: matched mapping, country coverage, ordered `SourcePlanStep`s (source, tier, role, ecosystem, matched country/labels/model/route/mechanism, expected density/domain/evidence yield, historical portfolio yield, provider hint, why-higher-than-alternatives), fallback sources, stop conditions, suppressed accounts, cost expectation, explanation.

## 20. Stop conditions
8 (target reached, marginal yield below threshold, duplicate rate too high, ecosystem exhausted, cost/qualified over threshold, evidence deteriorating, enough route diversity, challenger pool sufficient). "Don't keep searching only because budget remains."

## 21. Colombia source profile
Research-backed ecosystems across hospitality, specialty retail, wellness, corporate gifting, distribution, manufacturing (+ regulatory). Structured sources before generic search: hospitality-guest-amenity Tier 1 = RNT + Cotelco; manufacturing-procurement Tier 1 = ANDI + RUES. All start `confidence: hypothesized` until benchmarked.

## 22. Benchmark framework
Source Memory snapshots + `historicalPortfolioYield()` support Source-A-vs-B comparison within the same country+industry+route; `proposeReprioritization()` requires ≥3 cycles of evidence.

## 23. Discovery Observatory
`/admin/intelligence/discovery` (read-only, middleware-protected, `noindex`): country coverage, source registry, two live example plans (hospitality vs manufacturing) with tier/role/provider/why, coverage gaps, research queue, and the `awaiting_real_outcomes` note. Every metric ties to a source or gap.

## 24. Coverage gaps
`SourceCoverageGap` (dimension, severity, evidence, affected country/labels, action): country-low-coverage, industry-no-tier1, sources-unbenchmarked, signal-sources-missing, source-stale, high-duplicate, weak-official-domain.

## 25. Research queue
`SourceResearchTask` seeded from gaps (country, labels, gap, proposed source, owner, status) — improves LeadLens itself, not an account search.

## 26. Account Memory integration
Router consumes `KnownAccount[]` and suppresses delivered/excluded/duplicate accounts before expensive research (`suppressed_accounts`, `account_memory_consulted`).

## 27. Provider integration / Source vs Provider
SOURCE and PROVIDER never conflated: each plan step carries a `provider_hint` (e.g. "structured fetch (Firecrawl)", "SERP provider (Serper/Brave/Tavily) — gap filler") separate from the source. `SourceProviderInteraction` records provenance (discovery via directory, domain via Serper, extraction via Firecrawl, signal via Brave). Existing providers preserved.

## 28. Persistence
None added this sprint. The layer is deterministic code (like the pilot intelligence modules); Source Memory snapshots are in-model and will persist through the existing event/snapshot patterns when real cycles run. No new migration.

## 29. Migration
**None.**

## 30. Tests
`test:source-intelligence-layer` — **38 passed, 0 failed** (multi-label graph, no single parent, incompatibility; country/source registry; multi-role/multi-industry sources; contextual tiers; **§47 success criteria** — hospitality vs manufacturing produce materially different plans; structured-before-search; account-memory suppression; funnel + all yields; source-memory append-only + awaiting_real_outcomes; learning needs ≥3 cycles + approval, no auto reprioritization; coverage gaps; research queue; source≠provider). Regression: recurring-cycle 50/0, amor-pilot1 finalization + delivery ok.

## 31. TypeScript
`npx tsc --noEmit` clean.

## 32. Build
`npm run build` succeeded (new `/admin/intelligence/discovery` route compiled).

## 33. Provider calls
**0.** No search, no outreach, no uncontrolled discovery.

## 34. Files changed
New: `lib/discovery/source-intelligence/{taxonomy,registry,router,index}.ts`, `app/admin/intelligence/discovery/page.tsx`, `scripts/fixtures/source-intelligence-layer.test.ts`, this report. Modified: `package.json` (+test script). Pilot 1/2, Account Memory, providers, discovery adapters, Observatory: untouched.

## 35. Commit
`feat: build country industry source intelligence layer`.

## 36. Push/deployment
Push via GitHub Desktop (no CLI push credentials). New admin route deploys with runtime code on push.

## 37. Exact recommended next sprint
**Discovery Engine V2 — controlled source execution (Colombia hospitality)**: pick one Tier-1 Colombia mapping, wire the router's plan to the existing providers under a hard provider-call budget, run one small benchmarked discovery, capture real `SourcePerformanceSnapshot`s, and surface the first measured (non-`awaiting`) yields in the Observatory — with founder approval before any reprioritization.

### Founder review required
Open `/admin/intelligence/discovery`, review the Colombia source tiers/mappings and coverage gaps, and approve which hypothesized sources to benchmark first (and any Tier-1 promotions). No autonomous changes are made.
