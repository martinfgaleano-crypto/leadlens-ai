# Canonical Intelligence Delivery System V1

## Purpose

LeadLens uses one canonical above-account intelligence object to turn selected Account Opportunity Cases into market, benchmark, portfolio and visual intelligence. It does not replace account Decisions and it does not infer market-wide coverage from the researched set.

## Authority and flow

`assembleInstitutionalReport()` builds `InstitutionalOpportunityReportV1` and then calls `buildCanonicalIntelligenceDelivery()`.

The resulting `report.intelligence` flows through:

1. `fromInstitutionalReport()`
2. `fromDeliverableViewModel()`
3. `composeTier()` / `scopeCanonicalIntelligence()`
4. web/PDF presentation models
5. the canonical PDF renderer

Admin receives the same persisted object as `jobState.canonicalIntelligence`. No renderer or Admin surface independently recomputes decisions.

## Canonical contract

Implementation: `lib/intelligence/canonical-intelligence-delivery.ts`.

The object contains:

- researched-population scope and capacity target;
- Market Intelligence claims;
- commercial routes and buyer types;
- route -> buyer type -> account Market Map;
- account and route benchmark;
- Portfolio Intelligence;
- evidence coverage;
- chart-ready datasets with explicit population and denominator.

Every claim declares its basis (`fact`, `inference`, `hypothesis`, `unknown`, `recommendation`). Unknown values remain `Unknown`; they are never converted to zero or weak evidence.

## Benchmark contract

Dimensions are defined in `BENCHMARK_DIMENSIONS` with question, measurement basis, source fields, allowed states, transformation semantics and limitations. Current dimensions are objective fit, timing, evidence, commercial access and validation burden.

Benchmark rows explain existing canonical Decisions. They cannot change `Prioritize`, `Validate`, `Monitor` or `Hold`.

## Denominator rule

All percentages and counts use the actual tier-selected account population. `scopeCanonicalIntelligence()` filters the canonical object to the accounts rendered for a tier and rebuilds every affected denominator. Capacity is reported separately.

Example: a Premium report with 17 selected accounts and an 18-account capacity target reports evidence as `X/17` and capacity as `17/18`.

## Tier requirements

- Preview: capacity only; above-account intelligence is not required.
- Brief: capacity only; above-account intelligence is not required.
- Portfolio: capacity, one evidence-qualified `Prioritize`, benchmark, Portfolio Intelligence, visual intelligence and successful render.
- Premium: all Portfolio requirements plus Market Intelligence and 18-account capacity.

The evaluator is `evaluateCanonicalTierReadiness()` in `lib/intelligence/advanced-tier-readiness.ts`. It extends existing capacity/actionability readiness without weakening it.

## Pilot 2 procedure

The provider-free finalization command is:

```bash
npx tsx --tsconfig tsconfig.json scripts/pilot2-actionability-finalize.mts
```

It reuses the accepted, provenance-bearing Pilot 2 foundation, performs deterministic selection, assembles one institutional report, persists canonical intelligence, evaluates tier readiness and renders four PDFs. It does not discover a new account or spend provider credits.

Artifacts are written under `output/pilot2/2026-09-30-actionability-final/`.

The current accepted population is 17 accounts. Premium must remain partial until a legitimate eighteenth account passes the productive gates.

## Validation

```bash
npm run test:canonical-intelligence-delivery
npx tsc --noEmit
npm run release:check
npm run build
```

The synthetic contract fixture uses a German industrial-maintenance context to prove the capability is not coupled to Amor de Gea, food/beverage or the United States.

## Visual QA

After each meaningful renderer change, regenerate all four PDFs, run `pdfinfo`, render every page with `pdftoppm`, inspect all page images for clipping, overlap, broken tables and unreadable text, and confirm extracted text contains the canonical sections only for Portfolio/Premium.

## Known limitations

- Market Intelligence describes only the researched selected universe; it is not TAM/SAM/SOM or market-share analysis.
- Most Pilot 2 buyer functions and access mechanisms remain unknown.
- Independent corroboration coverage remains limited and must be displayed as such.
- Premium is not delivery-ready at 17/18 and may not be padded.

## Provider-resilient evidence acquisition

`lib/sources/access/extractors.ts` is the canonical extraction entry point. It separates discovery from extraction and uses Tavily Extract, Firecrawl, then `retrievePublicPage()` from `lib/sources/access/safe-page-retrieval.ts`. The direct path validates scheme, credentials, DNS results and every redirect; localhost, private/link-local IP space, metadata hosts, unsafe schemes, oversized bodies and unsupported content types fail closed. It stores retrieval method, final URL, status, MIME type, title, dates, redirect chain and content hash. Firecrawl is useful but optional.

Provider failure classes are preserved (`PAYMENT_EXHAUSTED`, `RATE_LIMITED`, `TIMEOUT`, `FETCH_BLOCKED`, `CONTENT_UNUSABLE`, `PAGE_NOT_FOUND`, `ACCESS_RESTRICTED`, `PROVIDER_UNAVAILABLE`). Search snippets are discovery observations and never become verified mechanism evidence merely because extraction failed.

## Commercial depth

`lib/intelligence/commercial-depth-research.ts` independently records research status, mechanism, access, buyer function, corroboration and retrieval failures. A generic contact page is not supplier access. A mechanism is verified only from retrieved first-party text; access does not establish buying intent or current category capacity. The bounded Pilot 2 runner is `scripts/sources/run-pilot2-commercial-depth.ts`.

## Durable market memory

`lib/intelligence/market-memory-store.ts` is the canonical scoped repository contract. Migration `066_market_intelligence_memory.sql` adds service-role-only `market_intelligence_snapshots` and `market_source_observations`. Memory is scoped by tenant/client, objective fingerprint, geography and category context; structural evidence can be reused while time-sensitive evidence is refreshed. Canonical URL and content hashes support anti-repetition. Until migration 066 is applied, the JSON artifact remains auditable but Market Memory must be reported as migration-blocked rather than durable-green.

## Multidimensional readiness

`evaluateCanonicalTierReadiness()` exposes capacity, actionability, market intelligence, commercial depth, corroboration, visual intelligence and evidence-integrity status separately. A partial capacity state cannot hide weak corroboration, and quality warnings do not alter canonical account decisions. Premium remains partial at 17/18.
