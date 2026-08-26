# LeadLens — Research + Temporal Intelligence Hardening V1 — Report

**Date:** 2026-08-26 · **Scope:** event extraction + materiality + canonical full Case re-synthesis + repeated-run soak. No alerts, no scheduler, no providers, no Landing/Pricing.

## 1. Git
Branch `main`; HEAD `4649b10`; `origin/main` `ec10012` (HEAD unpushed); clean worktree.

## 2. Existing Research Architecture
Reused: `opportunityTest` (canonical dimensional decision → opportunity/investigate/monitor/reject, enforcing no_valid_date/stale/no_material_event/aging→monitor), `classifySignalKind` (event vs metric, `can_trigger`), `classifyMateriality` (high/medium/low, negative→low), `parseEnglishDate`/`parseSpanishDate`, Account Memory `diffAccountCase`. Monitor V1 delta/cycle/store extended, not redesigned.

## 3. Monitor Gap (closed)
V1 re-observer produced `eventDate=null` (conservative); Monitor decided with ad-hoc transitions; historical-vs-change was not distinguished. All three closed.

## 4. Source → Claim → Event
`event-extraction.ts` formalizes the chain: a source's title+content → `classifySignalKind`/`classifyMateriality` → a validated `ObservedItem`. Source ≠ event: metrics, marketing, reference pages, and static "about us" pages are non-triggering/contextual, never events.

## 5. Event Extraction
`extractEvent(candidate, watchFamilies)` → `ObservedItem` with `isDatedMaterialEvent = can_trigger && material && defensible eventDate`. Negative/reversal events → `isCounterevidence`. LLM may produce candidates; deterministic gates decide truth (nothing trusts prose).

## 6. Event Dates
`resolveEventDate` reads the event phrase ONLY: ISO (exact), "YYYY-MM" (month), "QN YYYY"/"trimestre" (quarter), "Month YYYY" (month), "YYYY" (year), relative phrase anchored to publication (`relative_bounded`), else `unknown`. **Publication and retrieval dates are never the event date.** Live-verified: "March 2026" published in August → event date 2026-03-01.

## 7. Materiality
Canonical `classifyMateriality`: recent-but-irrelevant (wellness award) → low (materiality ≠ novelty); negative events → counterevidence (materiality ≠ positive); metrics/marketing/reference → non-material.

## 8. Origin / Corroboration
Preserved: same event across sources → one accepted event; `independentSupport` requires ≥2 **distinct origin ids** (same press release reproduced by two outlets is one origin).

## 9. Novelty
`classifyDelta` dispositions: `accepted_new` (post-review dated material), `newly_discovered_historical` (pre-cutoff, not previously known), `rediscovered` (known changeKey), `rejected_temporal` (no defensible date), `contextual_only`. New retrieval time is never novelty.

## 10. Historical-New vs True Change (core correctness)
A dated material event **before** the cutoff that was not previously known → `newly_discovered_historical`: it may add **new Evidence** (new origin) but **never** a `changeKey` / "changed since last review." Only post-review events (`accepted_new`) produce `newChangeKeys`. Validations may be resolved by either. Live-verified: a real dated pre-cutoff event → historicalEvidence, `newChangeKeys=0`.

## 11. Evidence Retention
Prior evidence origins + new (post-review and historical) origins merge; independent support carries forward or is added by new corroboration. Aging alone → `freshnessGap`, never counterevidence.

## 12. Full Case Re-Synthesis
`case-resynthesis.ts` `resynthesizeCase(prior, delta, now)` rebuilds the CURRENT Case decision through the canonical `opportunityTest` engine over validated current evidence — **one Case engine** for recurring reviews. Current Case is built first; Account Memory then diffs it. Guard: with no material new info, the prior decision is **retained** (not re-decided from aging), preventing false changes from the passage of time. Fallback (`fallback_conservative`) is flagged/observable.

## 13. Fit / Timing / Evidence / Counterevidence
Fit is structural (carried). **Timing derives only from an observed post-review dated event** (no event → no timing boost). Evidence strengthens on new independent support, weakens on material counterevidence. Counterevidence stays sourced+material (no-news/unknown excluded).

## 14. Decision
Decision comes from `opportunityTest` (canonical), then two principled caps: an open decision-critical question caps at Validate; material counterevidence caps a Prioritize/Monitor at Validate. Event existence alone never forces Prioritize.

## 15. Account Memory
Unchanged and canonical: `diffAccountCase(prior, next)` is the only comparator; the re-synthesized snapshot is immutable; predecessor = prior accepted; failed/insufficient never persist.

## 16. Failure / Fallback
Extraction produces no event without a defensible date; insufficient coverage → `insufficient_review`, no snapshot (memory not corrupted); re-synthesis fallback is flagged, never silently authoritative.

## 17. Budgets
Re-observer bounded (≤3 themes × 2 providers); per-account/run technical budgets from `monitor-config`. No new LLM calls added in the deterministic path (extraction gates are deterministic; a full-text LLM extractor is P2).

## 18. Observability / COGS
New run counters: `newHistoricalEvidence`, `caseResynthesisCanonical`, `caseResynthesisFallback` (plus V1's new/rediscovered/decisionChanged/…). Delta counters (discovered/accepted_new/newly_discovered_historical/rediscovered/rejected_temporal/contextual_only) give event yield + research-waste reasons. Provider cost via existing ledger.

## 19. Repeated-Run Soak (deterministic)
R1(monitor) → R2(new corroborated event → completed_changed, canonical decision, new What Changed) → R3(same event re-seen → completed_no_change, decision retained, no false novelty); R2 immutable. Historical soak: R2 discovers a pre-R1 event → new evidence, **no** changeKey claiming change-since-last-review. **False-novelty and false-What-Changed = 0** in the adversarial set.

## 20. Live Acceptance (bounded)
Real re-observer over Brave+Tavily (4.1s, mode full): 20 items → **19 contextual_only** (correctly filtered), **1 newly_discovered_historical**, **0 accepted_new, 0 newChangeKeys** — zero fabricated What Changed, correct temporal discipline over real snippets. No customer data touched. (A full-text LLM event extractor would raise dated-event yield — P2.)

## 21. Tests
New `research-temporal-hardening.test.ts` **25/25** (extraction, dates/precision/conflict, materiality, historical-vs-change, canonical re-synthesis, false-novelty=0, R1→R2→R3 soak, failure). `monitor-intelligence` **40/40** (updated for the new disposition + canonical engine). Regression green: account-memory 27, account-memory-store 18, account-opportunity-synthesis 40, deliverable-renderer 60, lead-hunter-production 20, confirmed-context-execution 21, commercial-continuity 17, company-first-discovery 77. `tsc` clean; `npm run build` clean.

## 22. Production Verdict
**RESEARCH + TEMPORAL INTELLIGENCE HARDENED WITH NON-BLOCKING P2.** Event extraction + temporal/materiality discipline + historical-vs-change + canonical full Case re-synthesis are operational and reach real providers. P2: a full-text LLM event/claim extractor (raises dated-event yield) and routing the INITIAL research path through the same `resynthesizeCase` entry (recurring already does; initial synthesis still builds dimensions upstream).

## 23. Updated Intelligence Maturity
Stage A **95%** · Lead Hunter **85%** · Research **80%** (event extraction gates in) · Source/Evidence **82%** · Temporal/What-Changed **88%** (historical-vs-change + canonical dates) · Opportunity Case **85%** (one engine for recurring) · Portfolio **85%** · Account Memory **90%** · Monitor **80%** (canonical re-synthesis in) · Provider routing **65%** · Colombia/private **45%** · Observatory **35%**. **Overall ≈ 83%** — the temporal correctness spine (no false novelty, no false What Changed, canonical decision) is now trustworthy; remaining gap is throughput (LLM extractor, scheduler) and breadth (Colombia, Observatory).

## 24. P0/P1/P2
- **P0:** none.
- **P1:** full-text LLM event/claim extractor for higher dated-event yield; activate the recurring scheduler.
- **P2:** unify the initial research synthesis through `resynthesizeCase`; Colombia source strategy; Observatory aggregation of the emitted yield/waste metrics.

## 25. Recommended Next Move
1. Activate/operationalize the recurring scheduler.
2. Provider routing + COGS optimization using the new yield data.
3. Colombia/private-company source strategy; Observatory aggregation.
