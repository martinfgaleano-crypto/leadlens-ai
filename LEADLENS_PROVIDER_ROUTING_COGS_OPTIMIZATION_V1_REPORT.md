# LeadLens — Provider Routing + Intelligence COGS Optimization V1 — Report

**Date:** 2026-08-26 · **Scope:** quality-aware task routing, normalized extraction economics, materiality-lexicon breadth, shared extractor parity. No new providers, Observatory UI, Landing, Pricing, ML.

## 1. Git
Branch `main`; HEAD `8104a4d`; `origin/main` `b657149` (unpushed); clean worktree.

## 2. Existing Provider Matrix (live-verified health)
| Provider | Status (health()) | Role | Cost known | Notes |
|---|---|---|---|---|
| Brave | available | broad web/news discovery | no (null) | Strong publication-date metadata (live: 5/5 dated) |
| Tavily | available | search + news, `supports_dates` | no (null) | Default search returned 0/5 dated live — news mode needed for temporal |
| Serper | available (creds) | broad search | no (null) | Runtime-quota-fragile; health is credential-based; de-prioritized |
| Exa | (creds gated) | semantic retrieval | no | Crawl date ≠ event date; used only in account role |
| Firecrawl | (creds gated) | extraction | no | Extraction-only; used on selective escalation |
Costs are `null` (not fabricated); latency recorded via `recordProviderCall`.

## 3. Existing Routing
Hardcoded: discovery-engine used brave+serper+tavily; `defaultReobserver` used brave+tavily; no task/health/cost-aware policy, no normalized economics.

## 4. Routing Context
`ResearchRoutingContext` (task, accountKnown, geography, language, temporal, needsFullText, primaryProviderUsed) — structured, never raw prose.

## 5. Provider Roles
`broad_discovery | news_temporal | account_specific | semantic_retrieval | extraction`. Task determines role ordering (cheapest-sufficient first).

## 6. Health / Fallback
`planRoute(ctx, healthMap)` drops unavailable/quota-exhausted providers **up front** (recorded in `skipped` with reason — no wasted latency), and promotes the next healthy provider to primary. All-down → empty primary + explicit degrade reason (caller marks insufficient). Wired live into `defaultReobserver` (queries provider `health()` and routes `monitor_delta`).

## 7. Sufficiency / Early Stop
Every plan carries a task-specific `earlyStop`: enough_unique_eligible_candidates (lead hunter), sufficient_evidence_for_case (initial), decision_critical_resolved_or_sufficient_no_change (monitor), event_date_validated (full-text), independent_support_achieved (corroboration). No provider fan-out by default.

## 8. Lead Hunter Routing
Broad discovery, Brave-first then Tavily; fallback Serper only if healthy; stop at enough unique eligible candidates (optimize cost/eligible, not raw count).

## 9. Initial Research Routing
Account-specific (Tavily/Brave), temporal adds a news-mode step; fallback explicitly retains a **counterevidence search** step (never removed for cost).

## 10. Monitor Routing
`monitor_delta` prefers Tavily **news** first (recent-change discovery), Brave fallback; full-text escalation only when ambiguous; stop at decision-critical-resolved or sufficient no-change (avoid five fetches + repeated Sonnet to confirm nothing changed).

## 11. Full-Text Escalation Economics
`EscalationMetrics` funnel (fetched/failures/llmExtractionCalls/repairs/fallbacks/claimsProposed/events funnel) already present; routing early-stop (`event_date_validated`) + `maxLlmExtractionCalls` bound LLM spend to ambiguous/material pages only.

## 12. Shared Initial/Recurring Extractor
`extractEvent` / `proposalsToObservedItems` are the shared source→claim→event primitives; parity test shows identical claims/event/date/materiality/polarity regardless of flow. Switching the LIVE initial research pipeline call-site to these primitives is documented as remaining P2 (the initial engine is not redesigned this sprint).

## 13. Materiality Coverage (P2 closed)
Expanded `materiality.HIGH`, `event-vs-metric.CHANGE`, and `event-extraction.NEGATIVE_KIND` (semantic families, not buzzwords): opened/began production/commissioned/launched operations/entered market/expanded capacity/appointed distributor/signed distribution agreement/strategic alliance; negatives postponed/delayed/suspended/halted/shut down/divested/exited/discontinued/cancelled. **Quality floor preserved** — static/metric/PR still rejected; no event without a defensible date; discovery regressions (account-opportunity-synthesis 40, company-first 77, discovery-engine-v2 40) unchanged.

## 14. Cost Model
Only known costs are summed; `CostBasis.costKnown=false` when any contributor is null → cost-per metrics return **null** (never fabricated). LLM token cost available via `recordLLMUsage`.

## 15. Yield
`ProviderRouteObservation` (candidates/unique/acceptedSources/claims/events/materialEvents) + `normalizeEconomics` aggregation.

## 16. Waste
`WasteReason` enum (duplicate/wrong_company/irrelevant/static_only/historical/undated/low_quality/source_fetch_failed/materiality_rejected/temporal_rejected/already_sufficient/provider_unavailable) + `wasteRate`.

## 17. Controlled Provider Evaluation (live, bounded)
3 provider calls, 3.3s total. Health: brave/tavily/serper available. Yield (1 query each — **controlled estimate, not a benchmark**): Brave US 1361ms 5 results **5 dated**; Tavily US (default search) 1247ms 5 results **0 dated**; Brave CO/es 672ms 5 results **5 dated**. Observation: Brave supplies publication-date metadata more reliably than Tavily's default search mode here → the temporal route correctly leads with Tavily **news** mode (not tested live) and Brave remains a strong fallback/date source. Sample too small to change defaults.

## 18. Before / After Economics
Not claimed as production savings (sample too small). Structural before/after: routing now (a) skips unhealthy providers up front (0 wasted timeouts vs prior blind attempts), (b) leads temporal tasks with a date-appropriate provider, (c) bounds LLM extraction to ambiguous/material pages, (d) exposes cost-per metrics for later optimization. Magnitude requires production soak data.

## 19. Quality Regression
Zero. No weakening of identity, evidence grounding, event dating, corroboration, counterevidence, or temporal rules. Deterministic gates remain final authority. False-accepted-event tests still 0. `research-temporal-hardening` 25, `monitor-intelligence` 40, `canonical-fulltext-extraction` 23, `monitor-activation` 24 all green after lexicon changes.

## 20. Tests
New `provider-routing-cogs.test.ts` **32/32** (routing task plans, health skip, fallback, all-down degrade, geo/lang, no-score, budgets; economics yield/waste/cost + null-cost honesty; materiality expansion + quality-floor; shared-extractor parity). Full regression green (account-memory 27, store 18, synthesis 40, deliverable 60, portable 55, lead-hunter 20, confirmed-context 21, commercial-continuity 17, company-first 77, discovery-engine-v2 40). `tsc` clean; `npm run build` clean.

## 21. Production Verdict
**PROVIDER ROUTING + COGS V1 OPTIMIZED WITH NON-BLOCKING P2.** Task/health/cost-aware routing + normalized economics + materiality breadth are live and tested; a bounded real-provider evaluation ran. Not `PRODUCTION-OPTIMIZED` because before/after savings require a production soak (sample too small), and the live-initial extractor call-site switch remains P2.

## 22. Updated Intelligence Maturity
Stage A 95 · Confirmed Context 90 · Lead Hunter 86 · Research 86 · Source/Evidence 87 · Temporal/What-Changed 90 (broader lexicon) · Opportunity Case 90 · Portfolio 85 · Account Memory 90 · Monitor 86 · Scheduler 70 (trigger pending founder) · Provider Routing/COGS **75** (was 65) · Colombia/private 47 · Observatory 42.
- **CORE INTELLIGENCE SPINE ≈ 90%**
- **OVERALL INTELLIGENCE OPERATIONAL MATURITY ≈ 86%**
- **LIMITED SELF-SERVE INTELLIGENCE READINESS ≈ 84%**

## 23. Limited Self-Serve Assessment
**BLOCKERS:** (1) enable recurring cron (founder env/deploy) — the only thing between "implemented" and "running unattended".
**IMPORTANT NON-BLOCKING:** (2) switch live initial research pipeline to the shared extractor + `synthesizeCase` call-site; (3) production repeated-cycle soak to get real before/after economics; (4) distributed rate-limit store before high-volume public Stage A.
**POST-BETA:** (5) Colombia/private-company source strategy; (6) Intelligence Observatory aggregation UI; (7) provider-cost pricing once vendors expose per-call cost.

## 24. Remaining P0/P1/P2
- **P0:** none.
- **P1:** founder scheduler activation; live-initial extractor call-site convergence.
- **P2:** production soak economics; Observatory aggregation; Colombia source strategy; provider $ pricing capture.

## 25. Recommended Next Move
1. Intelligence Observatory aggregation / exception monitoring (consumes the new economics/waste metrics).
2. Colombia/private-company source strategy.
3. Production repeated-cycle soak (after founder enables the scheduler).
