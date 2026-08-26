# LeadLens — Recurring Monitor Intelligence V1 — Report

**Date:** 2026-08-26 · **Scope:** bounded recurring intelligence loop (delta research + review queue + temporal integrity + memory loop). No alerts, no real-time, no Landing/Pricing/new-providers.

## 1. Git / Preconditions
Branch `main`; HEAD `e1df014`; `origin/main` `ec10012` (HEAD unpushed, expected); clean worktree. Account Memory live-accepted; `snapshot_reports` + `account_review_snapshots` live.

## 2. Current Intelligence Architecture
Reused unchanged: `AccountReviewSnapshot` + `diffAccountCase` (canonical material-change classifier), `account-memory-store` (immutable persist + predecessor), `date-resolver` (publication≠event doctrine), `snapshot_reports` (run summary), provider access (`braveProvider`/`tavilyProvider`). `lib/monitor/scheduling.ts` already declares `SCHEDULING_ENABLED=false` (manual only).

## 3. Monitor Eligibility
`monitor-eligibility.ts`: `MonitoredAccountState` derived from the latest accepted snapshot. `evaluateEligibility` (deterministic, reasons): eligible when due by cadence OR unresolved decision-critical OR revisit trigger. **Hold consumes no recurring research** unless it carries an explicit revisit trigger. Eligibility is separate from priority.

## 4. Review Queue
`buildReviewQueue`: eligible → prioritized → `selected` up to `maxAccountsPerRun`, rest `deferred_due_to_budget` (explicit, never dropped). Carries run context + budget + eligibleCount.

## 5. Review Priority
`prioritize`: inspectable ordered factors (decision_critical_unresolved → revisit_trigger_due → prioritize_freshness → monitor_review_due → time_since_last_review) → a tier that is a **readout of the reasons**, not an opaque score. Deterministic tiebreak (oldest review, then accountId).

## 6. Technical Budgets
`monitor-config.ts`: max accounts/run, provider calls per account & per run, queries/extractions per account, retries, per-account & per-run timeouts, `minRoutesForSufficiency`. Cadence per Decision (validate 14d, prioritize/monitor 30d, hold trigger-only) + evidence freshness window. Technical safety limits, **not** pricing.

## 7. Delta Research Plan
`planMonitorReview(state, prior)`: `since` cutoff (previous reviewId/reviewedAt/contextVersion), `focusValidationKeys` (decision-critical unresolved), `watchSignalFamilies` (from prior changeKeys kinds), `knownOrigins`/`knownChangeKeys`, and conceptual `routeThemes` (`resolve:<validation>`, `change:<family>`, revisit) — **themes, not provider query strings**. Delta research, not full reconstruction.

## 8. Temporal Cutoff
Every cycle carries an explicit `since` = previous accepted `reviewedAt`. Potentially-new intelligence is evaluated against it.

## 9. Event / Claim Canonicalization
`classifyDelta`: event date is **only** `item.eventDate` (never `retrievedAt`, never `publicationDate`). `changeKey = kind:eventDate`. Same event from multiple sources → one accepted event (grouped by changeKey).

## 10. Evidence Newness
Dispositions: `accepted_new` (dated material event after cutoff, unknown), `rediscovered` (changeKey already known — new retrieval time is not novelty), `rejected_temporal` (no defensible event date, or event predates cutoff), `contextual_only` (not a dated material event / not relevant). Origin-aware corroboration: `independentSupport` requires ≥2 **distinct origin ids** — the same press release reproduced by two outlets is one origin, not independent. New origins exclude already-known hosts.

## 11. Research Sufficiency
`NO_MATERIAL_CHANGE` requires `operatingMode ≠ stopped`, ≥1 provider available, and ≥`minRoutesForSufficiency` routes attempted. Otherwise `INSUFFICIENT_REVIEW` — we do not know whether anything changed.

## 12. No Material Change
Explicit successful outcome `completed_no_change` (research sufficient, no material Case change) — distinct from `insufficient_review` and observable in run metrics.

## 13. Account Memory Integration
Every accepted review builds a new immutable `AccountReviewSnapshot` (carrying prior state + accepted deltas) persisted via the canonical `account-memory-store`; predecessor = previous accepted review; `diffAccountCase` is the **only** material-change classifier (no parallel ontology). Failed/insufficient reviews never persist.

## 14. Decision Re-evaluation
Conservative, inspectable `reevaluateDecision`: material counterevidence weakens Prioritize→Validate; a Validate whose decision-critical unknowns are all resolved with new support →Prioritize; a monitor/hold revisit trigger firing →Validate (needs validation, **not** auto-Prioritize); otherwise unchanged. Dimensions move conservatively (new independent support strengthens evidence/timing; counterevidence weakens evidence). Full per-account Case re-synthesis through the research pipeline is P2.

## 15. Revisit / Next Review
`revisit_trigger_met` reuses Account Memory semantics. Every accepted cycle produces `nextReviewAt` from the (possibly new) Decision's cadence — no infinite immediate loops.

## 16. Batch / Failure Handling
`runMonitor` reviews each selected account with per-account isolation: 8 succeed / 1 insufficient / 1 error → 8 accepted, others reported, run marked `completed_with_failures`. One provider down but viable → completes with degraded coverage; all providers down → `insufficient_review`, no snapshot, never "no change". Deferred accounts reported as `deferred_due_to_budget`.

## 17. Auth / Tenancy
`POST /api/customer/monitor` (maxDuration 300): server resolves owner via `auth.getUser`; body is **only** `{client_key}`; `loadCurrentSnapshots` is owner+client scoped. Browser cannot inject Evidence/Decision/snapshot/review result. Returns only curated observability + alert contracts — never raw snapshots.

## 18. Persistence / Idempotency
Accepted snapshots persist to `account_review_snapshots` (immutable, idempotent upsert on owner/client/account/review). Run summary persists to `snapshot_reports` (reuse, keyed by runId). Re-running the same cycle uses the same per-account reviewIds → upsert, no duplicate memory (verified).

## 19. Observability / COGS
Run metrics: accounts due/selected/deferred, attempted, completed_no_change/changed, insufficient, failed, decisionChanged, revisitTriggerMet, newEvidence, rediscoveredEvidence. Delta counters (discovered/accepted_new/rediscovered/rejected_temporal/contextual_only) enable wasted-research and yield (material_changes / reviews, / provider_calls) computation; provider cost via the existing ledger. No dashboard.

## 20. Scheduler Boundary
No third-party scheduler introduced. `SCHEDULING_ENABLED=false` remains — Monitor is a **scheduler-ready service + authenticated manual trigger**. Recurring execution is NOT auto-scheduled; that is the explicit P2.

## 21. Golden Fixtures
A no-change (rediscovered-only) **PASS**; B strengthened (new corroborated event → material) **PASS**; C weakened (material counterevidence → Validate) **PASS**; D validation-resolved (decision-critical resolved + new support → Prioritize) **PASS**; E freshness-only (aging → freshness_gap, not counterevidence) **PASS**.

## 22. Adversarial Temporal Fixtures
retrieval≠event, publication-new/event-old, rediscovery, same-event-multiple-sources (one event), common-origin (not independent), static page (contextual only), no-news-sufficient (no-change), all-providers-fail (insufficient) — all **PASS**.

## 23. Live Acceptance (executed, bounded, self-cleaning)
Prior review R1 (monitor) persisted live → `loadCurrentSnapshots` (1 eligible) → `runMonitor` (controlled rediscovered-only observation) → **completed_no_change**, decision unchanged, `nextReviewAt` set, **R2 accepted snapshot persisted** (count 2), **predecessor resolves to R1**, observability recorded (1 rediscovered, 0 new). Plus one **real re-observer** call: Brave+Tavily up, 6.6s, 30 items, mode `full` — conservatively no fabricated change. Test rows deleted. No customer data touched.

## 24. Tests
New `monitor-intelligence.test.ts` **40/40**. Regression green: account-memory 27, account-memory-store 18, account-opportunity-synthesis 40, deliverable-renderer 60, lead-hunter-production 20, confirmed-context-execution 21, commercial-continuity 17. `tsc --noEmit` clean; `npm run build` clean (`/api/customer/monitor` registered).

## 25. Production Verdict
**MONITOR INTELLIGENCE V1 OPERATIONAL WITH NON-BLOCKING P2.** Intelligence logic + persistence + authenticated manual trigger proven live; recurring execution is scheduler-ready but not auto-scheduled (P2). The production re-observer is bounded and reaches real providers but is CONSERVATIVE (no event-date extractor) — a dedicated event-date/materiality extractor is the P2 deepening that unlocks live strengthened/weakened detection at scale.

## 26. Updated Intelligence Maturity
- Stage A Company Interpretation: **95%** (production-hardened).
- Lead Hunter: **85%** (operational; identity/Colombia recall P2).
- Research pipeline: **75%** (works; per-account monitor re-observation extractor P2).
- Evidence: **80%** (corroboration/origin doctrine strong).
- Temporal / What Changed: **80%** (delta classifier strong; event-date extraction at scale P2).
- Opportunity Case reasoning: **80%** (synthesis mature; monitor uses conservative re-evaluation).
- Portfolio Intelligence: **85%** (frozen, solid).
- Account Memory: **90%** (live-accepted, immutable, predecessor-correct).
- Monitor: **70%** (loop + trigger operational; scheduler + event-date extractor P2).
- Provider routing: **65%** (works + graceful degradation; COGS tuning pending).
- Colombia / private coverage: **45%** (known thin spot).
- Observatory: **35%** (structured metrics emitted; no aggregation/automation).
- **Overall LeadLens Intelligence maturity ≈ 80%** (weighted toward the autonomous confirmed-context→universe→case→memory→recurring-review spine, which is now operational end-to-end). Remaining gap is concentrated in: automatic scheduling, a monitor event-date/materiality extractor, Colombia source strategy, and an Observatory aggregation layer.

## 27. Remaining P0/P1/P2
- **P0:** none.
- **P1:** activate a scheduler (cron/queue) for recurring execution; build the monitor re-observer's event-date + materiality extractor (unlocks live change detection at scale).
- **P2:** Colombia/private-company source strategy; Observatory aggregation of the emitted metrics; full per-account Case re-synthesis via the research pipeline.

## 28. Recommended Next Intelligence Move
1. Repeated-run Research / Temporal production soak (with the event-date extractor).
2. Provider routing + COGS optimization from real repeated-run data.
3. Observatory automation / exception metrics.
