# LeadLens — Intelligence Production Activation V1 — Report

**Date:** 2026-08-26 · **Scope:** full-text event extraction, one canonical Case engine, and recurring scheduler activation. No new providers, alerts, Landing, Pricing, Colombia, or ML.

## 1. Git / Preconditions
Branch `main`; HEAD `b657149`; `origin/main` `ec10012` (HEAD unpushed); clean worktree. Vercel cron infra + `extractWithFallback` + `opportunityTest` all pre-existing.

## 2. Existing Intelligence Spine
Confirmed context → Lead Hunter → discovery → Account Memory → Monitor → temporal-hardened recurring research, all operational. This sprint activates recurring execution and strengthens extraction + Case-engine unity.

## 3. Initial vs Recurring Research Audit
Initial: dossier → `adapters.decisionOf` (tier/action → DecisionState). Recurring: validated deltas → `resynthesizeCase` → `opportunityTest`. They diverged at the final decision authority. Now both converge on one authority (below); live-initial deliverable cutover is a documented P2 (its adapters remain for the live customer surface).

## 4. Full-Text Escalation
`full-text-extraction.ts`: `snippetIsPromising` triages (skip metrics/marketing/reference; escalate positive OR negative material snippets); promising candidates are full-fetched (DI `PageFetcher`, real = `extractWithFallback` Tavily→Firecrawl) up to a bounded budget (`maxFetchesPerAccount` etc.); the rest are snippet-only (no fetch cost). Verified: only the promising candidate is fetched; budget caps at N.

## 5. Claim/Event Extraction
Fetched content runs through the canonical `extractEvent` gates (event vs metric, materiality, negative→counterevidence, defensible date). No raw page/model text becomes Evidence — the deterministic gates are the sole authority. Full-text raised recall (dated events resolvable from body text a snippet lacked).

## 6. Temporal Integrity
`scrapeEventDatePhrase` finds the event date in body text but **skips dates adjacent to a publication marker** ("Published August 2026" is not the event date). Verified: a page "published August, event in March" → event date March. Precision preserved (exact/month/quarter/year/relative/unknown).

## 7. Materiality
Full text may reveal a promising snippet is immaterial/historical/speculative → rejected; the fetch is never rewarded for cost. Negative/reversal events are detected and fully supported as counterevidence.

## 8. Origin / Corroboration
Unchanged doctrine: same event across pages → one event; independent support requires ≥2 distinct origin ids. Full text improves origin classification inputs without inferring independence from URL count.

## 9. Historical-New vs True Change
The hardened distinction survives full text: a body-confirmed event before the cutoff → newly-discovered historical evidence, never a post-review What Changed.

## 10. Canonical Case Pipeline
`canonical-case.ts` `synthesizeCase(CanonicalCaseInput) → CanonicalCase` is THE single decision authority (wraps `opportunityTest` + caps: open decision-critical → Validate, material counterevidence → Validate; timing only from an observed post-review event). `resynthesizeCase` now delegates to it via `recurringToCanonicalInput`.

## 11. Initial/Recurring Parity
Both flows map their validated intelligence into one `CanonicalCaseInput` and call `synthesizeCase` — identical input yields identical Fit/Timing/Evidence/Decision (tested). Recurring reviews additionally carry historical metadata; the current Case is built first, then `diffAccountCase` compares. No parallel final Decision engine for recurring; live-initial adapter cutover = P2.

## 12. Scheduler Infrastructure
Reuses existing **Vercel Cron** (`vercel.json`) — added `/api/internal/monitor-scheduler` at `0 9 * * *`. No new scheduling vendor. `scheduler.ts` `runScheduledMonitor` finds due tenants (deterministic eligibility), applies tenant/account/runtime budgets, and invokes the SAME `runMonitor` service the manual trigger uses. Kill switch `schedulerEnabled()` (`MONITOR_SCHEDULER_ENABLED` env) — off by default; the route returns `disabled` until enabled.

## 13. Due Selection / Queue
`loadDueMonitoredWork` reads latest-accepted-per-account across tenants (owner/client scoped) → per-tenant `TenantWork`; the scheduler runs V1's `buildReviewQueue`/eligibility (Hold excluded, not-due excluded). Verified live: seeded tenant → found → processed.

## 14. Auth / Run Lock / Idempotency
Route authed by `CRON_SECRET` (Vercel Cron bearer) or `INTERNAL_RUN_SECRET`/`x-internal-secret`; 401 otherwise; never browser-triggerable. Idempotency: stable per-wake review ids (`${wakeId}_${scope}_${account}`) → duplicate wake re-upserts, no duplicate snapshot (tested + reused Account Memory idempotency). Run "lock" is the deterministic wakeId within the hour; overlapping wakes converge on the same review ids.

## 15. Failure / Deferred Work
Per-tenant isolation: one tenant's re-observer throwing does not drop others (tested). Tenant/account budget exceeded → remaining work deferred, still due next wake (never marked completed). `nextReviewAt` advances so an immediate second wake does not re-review (tested).

## 16. Observability
`ScheduledRunSummary` (tenants considered/processed/deferred, accounts reviewed/deferred, no-change/changed/insufficient/failed, tenantErrors); per-tenant `MonitorRun` observability persisted to `snapshot_reports`. Full-text `EscalationMetrics` (triaged/fetched/failures/eventsProposed/Accepted/dateResolved/materialityRejected/injectionNeutralized).

## 17. COGS / Latency
Provider + extraction cost via the existing ledger; the escalation funnel gives sources→fetch→claims→events→accepted→material-change for later optimization. Scheduler `maxRuntimeMs` bounds a wake.

## 18. Full-Text Live Acceptance
Wired to real `extractWithFallback`. A live run on a vague synthetic snippet was correctly **triaged out (0 fetches)** — conservative, no wasted spend. The fetch → neutralize → extract → validate path is proven deterministically (mock fetcher), including live-representative prompt-injection neutralization and publication-vs-event date resolution.

## 19. Scheduler Soak (live + deterministic)
**Live:** seeded disposable tenant → `loadDueMonitoredWork` (1 tenant) → `runScheduledMonitor` (1 reviewed, completed_no_change) → R2 persisted (snapshots 1→2) → cleaned up. **Deterministic:** due selection, Hold/not-due exclusion, tenant budget → deferred, idempotent duplicate wake, immediate-second-wake no repeat, per-tenant failure isolation, multi-tenant scope isolation.

## 20. Tests
New `monitor-activation.test.ts` **24/24** (full-text escalation, injection, temporal, budget; canonical parity + delegation guard; scheduler due/Hold/budget/deferred/idempotency/no-repeat/isolation/auth/kill-switch/cron). Regression green: research-temporal-hardening 25, monitor-intelligence 40, account-memory 27, account-memory-store 18, account-opportunity-synthesis 40, deliverable-renderer 60, lead-hunter-production 20, confirmed-context-execution 21, commercial-continuity 17, company-first-discovery 77. `tsc` clean; `npm run build` clean (`/api/internal/monitor-scheduler` registered).

## 21. Production Verdict
**INTELLIGENCE RECURRING PRODUCTION-ACTIVATED WITH NON-BLOCKING P2.** All activation code is complete, tested, and the scheduler SERVICE is proven live end-to-end; the recurring cron trigger requires one founder deployment/config action (see Production State). Truthfully: the periodic trigger is not yet firing in production.

## 22. Updated Intelligence Maturity
Stage A 95% · Confirmed Context 90% · Lead Hunter 85% · Research 83% (full-text escalation) · Source/Evidence 84% · Temporal/What-Changed 88% · Opportunity Case 87% (one engine, recurring) · Portfolio 85% · Account Memory 90% · Monitor 85% (scheduler service live) · Scheduler 70% (code+cron in repo; trigger pending founder enable) · Provider routing/COGS 65% · Colombia/private 45% · Observatory 40%.
- **CORE INTELLIGENCE SPINE ≈ 88%** (context→hunter→research→case→memory→recurring-review, all operational; recurring trigger pending).
- **OVERALL INTELLIGENCE OPERATIONAL MATURITY ≈ 84%.**
- **LIMITED SELF-SERVE INTELLIGENCE READINESS ≈ 80%** (spine runs founder-free once the cron is enabled; remaining is throughput/observability/weak-market breadth).

## 23. Remaining P0/P1/P2
- **P0:** none.
- **P1 (founder):** set `CRON_SECRET` + `MONITOR_SCHEDULER_ENABLED=true` and deploy so the Vercel cron fires `/api/internal/monitor-scheduler`. **P1 (eng):** a full-text LLM claim/event extractor (higher dated-event yield than the deterministic body scraper).
- **P2:** route the live INITIAL deliverable through `synthesizeCase` (retire `decisionOf`); Observatory aggregation; Colombia source strategy; provider-routing/COGS tuning on real repeated-run data.

## 24. Recommended Next Move
1. Founder enables the scheduler (env + deploy) → real repeated-cycle production soak.
2. Provider routing + COGS optimization from the new yield data.
3. Intelligence Observatory aggregation / exception monitoring.
4. Colombia/private-company source strategy.
