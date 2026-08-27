# LeadLens Production Soak + Launch Gates V1

## 1. Git

- Baseline milestone: `00e9607` on `main`.
- `origin/main` at soak start: `64a74ff`.
- Ranking, selector and scoring algorithms were not modified.
- Cron remained OFF.
- Runtime ledgers and unrelated audit documents were kept outside the sprint commit.

## 2. Soak Design

Ten synthetic, production-path customer contexts ran through authenticated Stage A, immutable context confirmation, async start, persisted Candidate Universe, bounded Research, canonical Case synthesis, durable reload and tenant-isolation checks. No winning accounts were hand-seeded. Phase A ran five contexts unchanged. Phase D ran five contexts after two evidence-backed P1 fixes. One deliberately contradictory sparse context stopped correctly at Stage A clarification and is not counted among the ten Intelligence runs.

## 3. Context Mix

- 10 completed Intelligence contexts: 8 United States, 2 Colombia.
- Patterns: manufacturing automation, WMS/logistics, enterprise operations, industrial distribution, fleets, channel partnerships and two sparse controls.
- 78 total universe entries, 22 researched accounts, 0 delivered Cases.
- Synthetic contexts only; no private customer data.

## 4. Run-Level Results

| Phase | Runs | Universe | Researched | Delivered | Provider calls | Known LLM cost |
|---|---:|---:|---:|---:|---:|---:|
| A | 5 | 50 | 13 | 0 | 145 | $0.798732 |
| D | 5 | 28 | 9 | 0 | 108 | $0.573921 |
| Total | 10 | 78 | 22 | 0 | 253 | $1.372653 |

All ten completed as `completed_no_strong_opportunity`. There were no failed, insufficient or stale/recovered Intelligence runs. Every run passed 15/15 E2E checks.

## 5. Candidate Universe Quality

Phase A exposed cross-objective/cross-country vertical seeds: US manufacturing contexts inherited wellness retailers, and a Colombia run represented a US Sunon domain as Colombian. Generic dynamic names also reached Research. Phase D removed cross-country curated seeds and required structural target semantics even for vertical seeds. Coverage then contracted materially, exposing weak dynamic recall rather than hiding it with irrelevant seeds.

## 6. Pre-Research Gate Quality

- Overall structurally useful: 12/22 = 54.5%.
- Phase A: 5/13 = 38.5%.
- Phase D: 7/9 = 77.8%.
- Phase D improvement: +39.3 percentage points.

The improvement is real but the total and post-fix samples remain small. The recommended limited-self-serve gate is at least 80% over `n>=50` researched accounts.

## 7. Research Waste

Ten of 22 researched accounts should have been filtered earlier:

- wrong target type: Whole Foods/Sprouts in manufacturing or manufacturer-distributor scopes; Specialty Distributors; Schneider Electric;
- identity/domain issue: Ferguson pre-fix, Sunon, First Professional Services, General Devices;
- wrong geography: Sunon;
- unrelated account evidence: Advanced Illumination pre-fix and First Professional Services.

Phase D reduced waste from 8/13 to 2/9. Remaining waste is primarily dynamic identity and operational-model uncertainty.

## 8. Delivered Case Quality

No Cases were delivered. Therefore:

- customer-facing false positives: 0, denominator `n=0`, rate not calculable;
- delivered defensibility: not measured;
- no claim of customer-facing precision is valid.

The canonical floor correctly prevented WARM/COLD research from becoming customer opportunities.

## 9. Opportunity Capture Proxy

No reviewed account met the defined human-positive Case criteria (correct identity + target + grounded dated event + system Prioritize/Validate + human defensibility). The observed opportunity capture rate is therefore undefined, not 0% and not 100%. Global recall was not measured.

## 10. Zero-Result Honesty

All 22 researched accounts were correctly withheld as non-defensible. However, the zero-result outcomes are not sufficient evidence of market absence: several US universes contained only 1-3 companies in evidence-rich categories. Zero-result truth at the researched-account level passed; market-coverage sufficiency did not.

## 11. Temporal Quality

- Delivered/accepted events: 0.
- Historical/stale Cases reviewed: 3 (Grupo Éxito, Alkosto, Ferguson Industrial).
- Correctly held as historical/stale: 3/3.
- Retrieval date mistaken as customer What Changed: 0 delivered occurrences.
- Wrong-company dated evidence occurred internally before the Phase D filter (Advanced Illumination and First Professional Services) but was not delivered.

## 12. Timing Quality

- Customer-facing non-empty Timing claims: `n=0`.
- Unsupported customer-facing Timing: 0, rate not calculable.
- No launch confidence can be inferred without accepted Cases.

## 13. Counterevidence

Research consistently exposed outsourcing, incumbent-system, parent-level procurement, scale, wrong-unit and no-trigger risks. No-news was represented as missing evidence rather than negative evidence. The main limitation is that counterevidence quality cannot be evaluated on a delivered Case because none existed.

## 14. Provider Health

- Anthropic: operational; 84 calls, 0 errors.
- Brave: operational; 74 calls, 0 errors.
- Tavily: operational; 85 calls, 0 errors.
- Serper: 10 calls, 10 errors; one bounded failed attempt per run, then cooldown.
- Exa and Firecrawl: health-probed operational but not called merely for benchmarking.
- SAM.gov: provider error during health probe; not required by these runs.
- SEC EDGAR: operational health probe; normal routing did not require it.

## 15. Provider Economics

- All provider calls: 253 / 10 = 25.3 per run.
- Calls per researched account: 253 / 22 = 11.5.
- Calls per defensible Case: undefined (`n=0`).
- Brave/Tavily/Serper dollar costs are unknown and remain separate from known LLM cost.

## 16. LLM Economics

- Anthropic calls: 84 = 8.4/run.
- Known Anthropic cost: $1.372653 total.
- Mean known LLM cost: $0.137265/run.
- Input/output token totals are preserved in the structured dataset per run.

## 17. Latency

Background completion, `n=10`:

- min: 91,360 ms;
- median/p50: 163,323 ms;
- p90: 284,488 ms;
- p95: 311,793 ms;
- max: 311,793 ms.

Classification against the existing 300-second ceiling: SAFE 8, NEAR_LIMIT 1, EXCEEDED 1. With ten observations, percentile confidence is low, but the p95 gate clearly fails.

## 18. Failure / Recovery

- Completed: 10/10.
- Failed: 0.
- Insufficient: 0.
- Stale/recovered: 0.
- Start request remained sub-second in all runs.
- One excluded pre-run context correctly requested Stage A clarification and never created an Intelligence run.

## 19. Autonomy

- Runtime human/developer intervention: 0/10.
- Manual QA labeling was post-run and is excluded from intervention.
- Candidate selection, provider routing, report assembly, persistence and cleanup were autonomous.

## 20. US vs Colombia

| Slice | Runs | Universe | Researched | Structurally useful | Mean runtime | Mean known LLM cost |
|---|---:|---:|---:|---:|---:|---:|
| US | 8 | 48 | 17 | 8/17 (47.1%) | 173,189 ms | $0.131006 |
| Colombia | 2 | 30 | 5 | 4/5 (80.0%) | 249,639 ms | $0.162305 |

The Colombia pack increased universe volume and structural fit but cost more time. The US dynamic universe was cleaner after fixes but often too small. Samples are too small for broad country-performance claims.

## 21. Monitor Soak

Three controlled real-provider reviews used accepted Rockwell Automation baselines:

- 3/3 completed no-change;
- 24 search results considered;
- 3 provider failures observed and contained;
- 0 pages escalated/fetched;
- 0 events accepted;
- 0 false novelty;
- 0 false What Changed;
- durations: 3,062 ms, 1,251 ms, 1,243 ms;
- canonical identity and predecessor memory were correct.

Cron remained OFF.

## 22. Full-Text Yield

No natural Monitor result crossed the escalation gate: 0 pages escalated, 0 fetched, 0 structured extractions, 0 accepted events. The initial-run artifact did not expose page-escalation counters, so initial-run full-text yield is unavailable rather than estimated.

## 23. P0/P1 Findings

No customer-facing P0 leak occurred. P1 findings:

1. Cross-objective/cross-country vertical seeds caused pre-Research waste.
2. A single generic company-name token allowed wrong-company Research evidence.
3. Vertical-seed provenance bypassed explicit target-family mismatch.
4. Post-fix dynamic recall is too low in several US contexts.
5. Background p95 lacks deployment safety margin.

The first three received exact fixes and deterministic tests between phases A and D. The latter two remain launch blockers.

## 24. Proposed Launch Gates

| Gate | Recommended limited-self-serve threshold | Rationale |
|---|---|---|
| Wrong-entity customer-facing rate | 0% over at least 30 delivered Cases | Entity mistakes destroy trust. |
| False What Changed | 0% over at least 30 Monitor reviews | Temporal truth is non-negotiable. |
| Unsupported Timing | 0% over at least 30 delivered Cases | Timing requires dated material evidence. |
| Delivered Case defensibility | >=90% over at least 30 delivered Cases | Limited beta still needs high precision. |
| Research-ready structural precision | >=80% over at least 50 researched accounts | Research spend must be targeted. |
| Observed opportunity capture | >=70% over at least 10 human-positive reviewed Cases | Prevent precision-through-zero-recall. |
| Technical completion | >=99% over at least 100 runs | Self-serve cannot need operators. |
| p95 background runtime | <240s under 300s ceiling | Preserve at least 60s safety margin. |
| Provider calls/run | <=40 for sample plan | Preserve bounded economics. |
| Known LLM cost/run | <=$0.25 for sample plan | Current observed cost supports this ceiling. |
| Runtime manual intervention | 0% normal supported runs | Self-serve must be autonomous. |

## 25. Gate Results

| Gate | Observed | Result | Confidence |
|---|---:|---|---|
| Wrong-entity customer-facing | 0 / 0 delivered | NOT MEASURED | none |
| False What Changed | 0 / 3 Monitor reviews | PASS | low |
| Unsupported Timing | 0 / 0 delivered | NOT MEASURED | none |
| Delivered defensibility | `n=0` | NOT MEASURED | none |
| Structural precision | 12/22 = 54.5%; Phase D 7/9 = 77.8% | FAIL | medium-low |
| Opportunity capture proxy | no human-positive Cases | NOT MEASURED | none |
| Technical completion | 10/10 = 100% | PASS | low |
| p95 runtime | 311.8s | FAIL | low |
| Provider calls/run | 25.3 | PASS | medium |
| LLM cost/run | $0.1373 | PASS | medium |
| Runtime intervention | 0/10 | PASS | low |

## 26. Self-Serve Decision

`NOT READY FOR LIMITED SELF-SERVE BETA`

The system is honest and bounded but has not demonstrated a single defendable positive Case, customer-facing precision has no denominator, post-fix structural precision is below threshold, and p95 exceeds the deployment ceiling.

## 27. Closed Alpha / Beta Guardrails

- Closed alpha only: maximum 5 users and 5 sample-plan runs/day.
- Supported contexts: explicit manufacturing/distribution/logistics operations in US or Colombia.
- 100% manual QA before sharing every non-empty report.
- Pause immediately on any wrong-entity delivery, false What Changed or unsupported Timing.
- Keep cron OFF; Monitor remains manually triggered.
- Keep delivery floor fail-closed and allow zero-result reports.
- Do not buy provider breadth until marginal confirmed-opportunity yield is measured.

## 28. Maturity Update

- Core: 91%.
- Operational: 85%.
- Limited self-serve readiness: 58%.
- Paid-launch readiness: 45%.
- Happy-path autonomy: 88%.

These are engineering maturity estimates, not model-quality statistics.

## 29. Remaining Work

1. Improve bounded US company-universe recall without reintroducing cross-target seeds.
2. Produce at least 10 human-positive reviewed Cases and measure capture/defensibility.
3. Reduce background p95 below 240 seconds.
4. Accumulate at least 30 delivered Cases and 30 Monitor reviews for truth gates.
5. Persist/emit initial-run full-text escalation metrics in the acceptance artifact.

## 30. Recommended Next Move

`DYNAMIC UNIVERSE RECALL + POSITIVE-CONTROL EVIDENCE V1`

This should be the smallest blocker sprint: improve dynamic enumeration for two supported US verticals, preserve the Phase D precision controls, and run a bounded positive-control set until at least one genuinely defendable Validate/Prioritize Case is observed or the discovery route is disproven.
