# LeadLens — Bounded Async Discovery Relevance V1

## 1. Git

- Baseline: `64a74fff076e8c310091fc9ee0e98468088e0a6d` on `main`.
- `origin/main` was the same baseline at sprint start.
- Existing local runtime ledgers and unrelated untracked product-audit documents were preserved and are not part of this change.
- No push was attempted. Cron remains off.

## 2. Previous E2E Failure

The prior authenticated acceptance kept the customer request open for 508,576 ms, researched 8 of 14 accounts, delivered 2 weak Cases, produced no dated material event, and consumed approximately 89 Brave + 89 Serper + 84 Tavily calls. Stage A was 12,762 ms; therefore almost all remaining latency belonged to discovery/research and their provider/LLM fan-out.

## 3. Runtime Audit

The productive customer POST called `startIntelligenceRun`, which synchronously executed Lead Hunter, company-first discovery, Research, qualification, Case synthesis, persistence and Account Memory before responding. The pipeline researched accounts serially. Each researched account could add Tavily plus two Anthropic calls. Discovery independently multiplied each company query across three search providers.

The final live acceptance separates:

- Stage A: 13,952 ms.
- confirmation: 933 ms.
- customer start request: **472 ms**.
- background completion: **243,854 ms**.
- total harness: 262,556 ms.

## 4. Provider Call Multiplication

Root cause in the old code was literal `Promise.all([brave, serper, tavily])` per company query, plus two rounds, multiple companies, universe enumeration and per-account Research. It was query × provider fan-out, not one unavoidable search operation.

The new path uses sequential escalation: Tavily primary for event search, then Brave, then Serper only on insufficient yield. Enumeration similarly uses primary→fallback. One hard Serper failure cools it down for the run.

## 5. Async Architecture

The authenticated customer POST validates ownership/context, creates an owner-scoped durable row and returns HTTP 202. `snapshot_reports.status=processing` is reused because the production database check constraint does not allow `queued`; `_intelligence_run.stage=queued` is the durable queue equivalent.

Execution occurs through the internal-secret-protected route:

`POST /api/internal/intelligence-runs/[runId]/process`

The processor atomically claims only a queued run, persists `lead_hunter → research → case_synthesis → report`, and writes durable failure. The existing customer GET polls/reloads the owner-scoped run. A queued or stale run is safely re-dispatched by polling; an internal recovery endpoint can scan five queued/stale runs. No cron was activated and no new queue vendor was introduced.

## 6. Durable Lifecycle

- accepted: DB `processing`, stage `queued`;
- claimed: stage `lead_hunter`;
- active: `research`, `case_synthesis`;
- complete: status `completed`, stage `report`;
- failure: status `failed`, bounded safe code;
- stale: processing older than 15 minutes is eligible for safe re-dispatch;
- completed retry: reload only, no Research rerun.

## 7. Polling

`/results/[jobId]` already polls every five seconds. It now renders the accepted/processing lifecycle and explicitly says the page may be closed. Owner isolation remains enforced by `/api/customer/intelligence-runs/[runId]`.

## 8. Budget Enforcement

Authoritative discovery caps:

| Tier | Companies | Queries/company | Extractions | Provider calls | Calls/account | Retries |
|---|---:|---:|---:|---:|---:|---:|
| Preview/sample | 15 | 1 | 12 | 20 | 3 | 0 |
| Brief/starter | 24 | 2 | 24 | 40 | 4 | 1 |
| Intelligence | 36 | 3 | 40 | 64 | 5 | 1 |
| Premium/internal | 48 | 3 | 60 | 90 | 6 | 1 |

Research caps are 3/5/8/10 accounts for sample/starter/standard/pro. Delivery remains 2/6/12/18. Cost caps, extraction caps and the existing wall-clock guard remain active. A budget stop cannot manufacture evidence or a strong Case.

## 9. Provider Cooldown

Provider failures are classified. Exhausted/invalid/rate-limited providers cool down immediately; any hard failure exceeding the tier retry allowance also cools down. Live evidence: Serper moved from 89 failed calls before to **1 failed call** in the final run.

## 10. Early Stop

Provider escalation stops when one provider yields at least two company-associated results. Account search stops on sufficient evidence, identity/organization failure, per-account cap, global cap, extraction cap or wall time.

## 11. Candidate Relevance Audit

Sprouts survived previously because broad category matching treated warehouse adjacency as target fit. ALAC survived because a plausible name without a verified domain could enter expensive Research. The structural fix is not company-specific:

- verified corporate domain required for Research;
- confirmed target organization family must match observed type/industry;
- matched vertical-pack membership is an inspectable structural prior, never Opportunity evidence;
- wrong target, ambiguous identity and structural uncertainty stay in universe coverage but do not consume Research.

## 12. Target Organization Semantics

Manufacturers/distributors no longer silently broaden to grocery retail. The deterministic acceptance rejects Sprouts as `wrong_target_type`, ALAC as `needs_identity_validation`, and admits a verified manufacturer as `research_ready`.

## 13. Pre-Research Gate

Inspectable states:

- `research_ready`
- `needs_identity_validation`
- `structural_match_uncertain`
- `hard_excluded`
- `wrong_target_type`

There is no HOT/WARM/COLD and no opaque opportunity score at this stage.

## 14. Research Priority

Only `research_ready` accounts are handed off. Verified direct descriptor matches receive priority band 1; verified matched vertical-pack accounts band 2. Original order breaks ties. The reason is persisted on the handed-off candidate.

## 15. Commercial Outcome Semantics

Productive delivery now applies the canonical Case after Research. WARM alone is not enough. Only canonical `prioritize` or `validate` Cases remain customer-visible. A run with only Monitor/Hold research completes with zero opportunities and `_intelligence_run.commercialOutcome=completed_no_strong_opportunity`. Missing research-ready evidence fails as insufficient research rather than fake success.

## 16. Positive-Control Live Run

Context: Colombian mid/large manufacturers and distributors operating their own warehouse/DC/plants; offer WMS and warehouse automation; explicit exclusions for public entities, media, consultants, pure software, retail without owned logistics and fully outsourced operations.

- Candidate Universe: 15.
- Research-ready handoff: 5.
- Researched: 3.
- Delivered: 0.
- Start latency: 472 ms.
- Background: 243,854 ms.
- Provider calls: Brave 9, Tavily 15, Serper 1; Anthropic 10.
- Dated grounded candidates: 1 clearly inspectable candidate in research audit (Colombina).
- Canonical result: Hold because its January 26, 2026 modernization event was 213 days old at acceptance and violated the unchanged 180-day freshness blocker.

Manual conclusion: the run found a correct company and a commercially relevant event, but not a defensible current opportunity. This is an honest absence, not a positive commercial proof. The acceptance clause allows this result only with the explicit explanation that the bounded universe lacked an in-window event; it does not justify claiming recall quality is solved.

## 17. Negative-Control Run

The separate live US warehouse-automation control (`customer-e2e-1787838320514.json`) used the same post-async structural gate:

- Universe: 2.
- Research-ready/researched: 1 (Advanced Illumination).
- Delivered: 0.
- Start: 578 ms.
- Background: 91,425 ms.
- Calls: Anthropic 6, Brave 7, Tavily 7, Serper 6 in that pre-enumeration-cooldown run.
- Outcome: no confirmed timing/event; no forced Prioritize.

The later enumeration cooldown specifically reduced Serper to one call.

## 18. Manual QA

Final live researched audit:

- **Colombina** — correct company/domain/country and relevant modernization source; event dated 2026-01-26; stale >180 days; automatic Hold confirmed by human review.
- **Cementos Argos** — social/reference source in the preceding instrumented run; should not have consumed LLM Research. A post-run deterministic pre-LLM source/association filter now rejects Instagram and unrelated-company results; exact regression added.
- **Alpina** — structurally relevant verified company; no customer-deliverable canonical Case; no rescue.

No false positive reached customer delivery. No defendable true positive was found, so precision/recall cannot be estimated statistically.

## 19. COGS

Final live observed:

- Anthropic: 10 calls, 15,758 input tokens, 11,294 output tokens, known calculated cost **USD 0.216684** using the ledger's cited Sonnet price.
- Brave: 9 calls, cost unknown.
- Tavily: 15 calls, cost unknown.
- Serper: 1 failed call, cost unknown.
- Total known cost: USD 0.216684.
- Total provider cost remains unknown; no missing price was invented.

## 20. Latency

Start latency improved from 508,576 ms synchronous completion to 472 ms durable acceptance. Background completion improved to 243,854 ms (52.1% lower). It fits the current 300-second worker ceiling in this sample, but margin is only ~56 seconds; production soak must test tail latency and Anthropic timeout behavior.

## 21. Before / After

| Metric | Before | After |
|---|---:|---:|
| Customer request | 508,576 ms | 472 ms |
| Background completion | same request | 243,854 ms |
| Universe | 14 | 15 |
| Research-ready | not separated | 5 |
| Researched | 8 | 3 |
| Delivered | 2 weak | 0 honest |
| Web-search calls | ~262 | 25 |
| Calls/researched account | ~32.8 | 8.3 (includes universe discovery) |
| Serper failures | 89 | 1 |
| Dated relevant event | 0 | 1, rejected stale |

This is a material economics/reliability improvement and a precision improvement. It is not proof of adequate recall or positive opportunity yield.

## 22. Tests

- 414 core async/relevance/Lead Hunter/provider/temporal/Case/Memory/context/Monitor/company-first assertions passed.
- 12 customer E2E seam assertions passed.
- 60 deliverable assertions passed.
- 17 commercial-continuity assertions passed.
- Final bounded suite: 12/12 after the social/reference regression.
- TypeScript passed.
- Next production build passed: 151 pages; internal process and recovery routes present.
- Ranking, selector and score algorithms were not changed.

## 23. Production Verdict

`BOUNDED ASYNC INTELLIGENCE V1 READY WITH NON-BLOCKING P2`

The async/budget/relevance-control architecture is ready for controlled production soak. Commercial opportunity recall is not proven and remains a launch-readiness blocker for limited self-serve, but it does not invalidate an internal/closed-alpha soak that can honestly return zero opportunities.

## 24. Launch Readiness

- Internal pilot: Ready.
- Closed alpha: Ready with manual QA and provider/latency monitoring.
- Limited self-serve: Not ready; positive opportunity yield and worker tail latency need soak evidence.
- Paid public: Not ready.

## 25. Maturity

- Core components: 91%.
- Operational integration: 84%.
- Limited self-serve readiness: 68%.
- Paid-launch readiness: 55%.
- Happy-path autonomy: 82%.

These are engineering maturity estimates, not statistical model metrics.

## 26. Remaining Work

1. Production soak across at least 10 bounded contexts with manual relevance labels.
2. Measure positive opportunity recall; current live n=2 contexts and n=4 researched accounts is insufficient.
3. Validate background p95 below platform ceiling; current best representative run used 81% of 300 seconds.
4. Persist richer per-phase/provider budget telemetry in the durable run, not only acceptance artifacts/usage ledger.
5. Validate the post-run social/reference filter in a fresh live run (deterministic exact-case test already passes).

## 27. Recommended Next Move

`PRODUCTION SOAK + LAUNCH GATES V1`

Run a small closed-alpha soak, preserve zero-result honesty, label every researched account, and buy no additional provider breadth until marginal confirmed-opportunity yield is measured.
