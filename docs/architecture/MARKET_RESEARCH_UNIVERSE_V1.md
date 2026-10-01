# Market Research Universe V1

## Canonical separation

LeadLens now treats three populations as different authorities:

1. `market_research_universe`: route, ecosystem, buyer-function, commercial-mechanism and market-source research. It may contain entities that are not eligible accounts.
2. `account_research_universe`: companies discovered or investigated as potential accounts. Inclusion is not qualification.
3. `selected_portfolio`: the tier-scoped 2/6/12/18 accounts selected by the existing deterministic selector.

No market claim may silently use the selected portfolio as its market denominator. Every population carries `population_type`, `population_size`, `selection_scope`, `coverage_scope` and limitations.

## Runtime authority

- Contract and validation: `lib/intelligence/market-research-universe.ts`
- Pilot taxonomy: `lib/intelligence/route-ontologies/amor-de-gea-us.ts`
- Canonical report attachment: optional `market_research_universe` on `CanonicalIntelligenceDeliveryV1`
- Premium readiness fails closed when Market Intelligence is only selected-account aggregation.
- `/admin/intelligence/pilot2` displays the three populations and route, mechanism and corroboration depth when present.

The generic contract contains no grocery-specific logic. Pilot-specific aliases, buyer types and dependencies live in the Pilot 2 ontology.

## Route and commercial-depth semantics

Routes use `HYPOTHESIS`, `DISCOVERED`, `EVIDENCE_SUPPORTED`, `LIMITED`, `REJECTED` or `INSUFFICIENT_DATA`. Canonicalization maps exact normalized aliases; it does not use fuzzy or substring matching.

Commercial mechanism, access path and buyer function are separate facts. Coverage distinguishes `NOT_RESEARCHED`, `RESEARCHED_NOT_FOUND`, `FOUND_UNVERIFIED`, `VERIFIED`, `CONTRADICTED` and `STALE`.

`VERIFIED` requires an extracted official page, verification timestamp and verified coverage state. A search result or snippet cannot satisfy it. Same-domain support and syndicated copies do not count as independent corroboration.

## Pilot 2 procedure

```bash
npx -y tsx --tsconfig tsconfig.json scripts/sources/run-pilot2-market-research-universe.ts
npx -y tsx --tsconfig tsconfig.json scripts/sources/deepen-pilot2-commercial-access.ts
npx -y tsx --tsconfig tsconfig.json scripts/pilot2-actionability-finalize.mts
```

The first command uses Brave with bounded query/result limits. The second uses Firecrawl only on already discovered official URLs. Failed extraction remains unverified. `PILOT2_SKIP_EXTRACTION=1` recomputes coverage/charts without external calls. The final command regenerates deliverables from persisted evidence without new research.

## Measured result — 2026-09-30

- Fresh Brave queries: 13
- Unique market sources: 57
- Observed domains/ecosystem entities: 47
- Route hypotheses researched: 9/9
- Routes with discovery-level support: 9/9
- Routes with independent support: 3/9
- Mechanisms researched: 9/9
- Mechanisms identified/verified: 0/0
- Firecrawl official-page extraction: 0/2 successful (provider exhausted)
- Account-18 importer passes: 2; 24 observations, all reobserved; 0 net-new persisted; no account 18 selected

“Supported route” means multiple discovery sources including a likely first-party source. It does not mean product acceptance, open procurement, verified access or buying intent.

## Visual authority

`buildMarketResearchCharts` produces canonical datasets for route coverage, commercial-access depth, freshness and customer-dependency impact. Each preserves population, denominator, unknown/not-researched counts, eligibility and omission reason. Renderers must not recompute semantics.

## Verification

```bash
npm run test:market-research-universe
npm run test:canonical-intelligence-delivery
npm run test:advanced-tier-readiness
npx tsc --noEmit
```

The market-vs-portfolio fixture proves that a researched route can exist with zero selected accounts and rejects unsupported market patterns.

## Known limitations

- Coverage is bounded, not complete US market coverage.
- Search results need extraction and claim validation before verified evidence.
- Firecrawl exhaustion prevented mechanism verification in this run.
- Buyer functions are ontology hypotheses until source-linked verification.
- Premium remains 17/18 and partial; it is not padded.
- FINAL HUMAN PDF ACCEPTANCE: DEFERRED.
