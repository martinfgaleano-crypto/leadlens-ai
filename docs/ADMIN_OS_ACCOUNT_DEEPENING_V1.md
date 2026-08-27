# Admin OS V1 + Account Deepening V1

## Canonical paths

- Admin evaluation: `buildCapabilityControlPlane` → `buildLaunchReadiness` → `buildControlPlaneMemoryRecord` → `persistControlPlaneMemory`.
- Durable table: migration `055_intelligence_control_plane_memory.sql`, `intelligence_control_plane_snapshots`, service-role only under RLS.
- Productive Intelligence: confirmed context → Lead Hunter durable universe → `runLeadLensPipeline` → `runResearchAgent` → `deepenAccountResearch` → qualification → canonical Case.
- Account deepening reuses `research-quality-v1`, Brave/Tavily search adapters, `extractWithFallback`, canonical event/date/materiality gates, and the existing structured full-text extractor. It does not add accounts or create a second decision engine.

## Durable Admin behavior

- First row is tagged `control_plane_baseline_v1`.
- `snapshot_key` fingerprints material evidence, not evaluation time. Reloading the same state is idempotent.
- `summarizeControlPlaneHistory` returns no invented trend for one row; with two material rows it returns readiness/capability deltas and gate/capability transitions.
- `INTERNAL_RUN_SECRET` protects the asynchronous customer processor. Missing it degrades closed-alpha/self-serve readiness but does not disable guided internal Admin pilots.

## Account research contract

`deepenAccountResearch(candidate, criteria, deps)`:

1. builds the existing `AccountResearchProfile` from canonical identity;
2. compiles at most five gap-specific queries from confirmed offer/segments/signals;
3. constrains identity, footprint, event and counterevidence searches to the verified corporate domain;
4. searches only the already selected account;
5. revalidates entity/source quality and deduplicates canonical URLs;
6. spends full-text budget only on high-commercial-relevance pages;
7. selects event-bearing windows from long HTML rather than page boilerplate;
8. validates event type, materiality and event date with canonical deterministic gates;
9. may use the existing structured extractor to propose events, but proposals still pass deterministic gates;
10. requires the counterevidence stage before a positive early stop;
11. stops weak accounts after counterevidence when no material event exists;
12. persists per-account telemetry into the productive run's `researchAudit`.

Telemetry includes planned/executed queries, provider calls/failures, accepted/rejected evidence, full-text and structured extraction calls, dated evidence, independent domains, recovered claims, counterevidence coverage and stop reason. Provider cost remains unmeasured when the provider does not report it.

Serper is intentionally not used by this path while exhausted. Brave and Tavily provide search; extraction remains Tavily → Firecrawl fallback.

## Acceptance commands

```bash
npm run test:account-deep-research
npm run test:research-quality
npx tsx --tsconfig tsconfig.json scripts/fixtures/monitor-activation.test.ts
npm run acceptance:account-deep-research
npx tsx --tsconfig tsconfig.json scripts/accept-customer-intelligence-e2e.mts
npm run test:admin-operating-system
npm run test:admin-intelligence-control-plane
npx tsc --noEmit
npm run build
```

Diagnostic named references are evaluation controls only. They are never production seeds or a market-recall estimate. Current strict result: 1/8; productive autonomous E2E: 15/15 lifecycle checks, 15-company universe, three deepened accounts, zero delivered Cases.

## Remaining blockers

1. Productive positive Case remains `n=0`; Account Deepening recall is operational but not validated.
2. Strict primary-source control is 1/8; three known pages are retrieved but still lack a defensible event date in extracted text.
3. Sample E2E latency was 501,814 ms total / 483,904 ms background, above the 300,000 ms operating ceiling.
4. `INTERNAL_RUN_SECRET` remains absent, so asynchronous customer dispatch is not closed-alpha/self-serve ready.
5. Tenant-security capability lacks multidimensional production evidence in the canonical evaluator.
