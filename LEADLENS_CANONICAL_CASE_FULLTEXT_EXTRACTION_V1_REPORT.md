# LeadLens — Canonical Case + Full-Text Claim/Event Extraction V1 — Report

**Date:** 2026-08-26 · **Scope:** unify the final Decision authority (initial + recurring) and add a bounded structured full-text claim/event extractor. No new providers, Landing, Pricing, alerts, ML, scheduler redesign.

## 1. Git / Preconditions
Branch `main`; HEAD `f7a6097`; `origin/main` `b657149` (unpushed); clean worktree.

## 2. Initial vs Recurring Case Audit
Initial: dossier (validated `tier`/`actionability_status`) → `adapters.decisionOf` (`TIER_DECISION`/`ACTION_DECISION` maps) → `dossierToBrief` → deliverable. Recurring: deltas → `resynthesizeCase` → `synthesizeCase` (`opportunityTest` + caps). `decisionOf` is called once (adapters.ts:83) — a projection of the upstream verdict, not a separate reasoning engine.

## 3. Legacy Decision Gap
Two independent status→Decision maps existed (`TIER_DECISION`/`ACTION_DECISION` vs `STATUS_DECISION`). Unified.

## 4. Canonical Case Cutover
New shared authority `caseDecision(status, openDecisionCritical, hasMaterialCounter)` in `canonical-case.ts`: the single status→Decision mapping + caps (open decision-critical → Validate; material counterevidence → Validate). `synthesizeCase` now derives its Decision via `caseDecision`. `adapters.decisionOf` maps the dossier verdict → canonical `OppStatus` (HOT/act_now→opportunity, WARM/validate_first→investigate, COLD/monitor→monitor, DISCARD/exclude→reject) → `caseDecision`. The independent `TIER_DECISION`/`ACTION_DECISION` maps are **removed**. Outputs are identical (1:1 mapping) → **deliverable-renderer 60/60 + portable 55/55 unchanged**.

## 5. CanonicalCaseInput
Unchanged contract; sufficient for both flows (identity, signal/date/confidence, materiality, counterevidence, decision-critical, prior dimensions, post-review-event flag). No schema expansion needed.

## 6. Initial/Recurring Parity
Both flows resolve the final Decision through `caseDecision`; `synthesizeCase` is the single Case authority; identical `CanonicalCaseInput` → identical Decision (tested). Guard test asserts `decisionOf` routes through `caseDecision` and the legacy maps are gone.

## 7. Existing Full-Text Architecture
`escalateAndExtract` (snippet triage → `extractWithFallback` fetch → deterministic `scrapeEventDatePhrase` → `extractEvent`). Recall-limited: the deterministic scraper infers events from regex/verb heuristics.

## 8. Structured Claim Extraction
New `claim-event-extractor.ts`: after a promising fetch, an LLM proposes structured claims + events (schema: family/description/eventDatePhrase/polarity/claimType/resolvesValidationKey). Model: **claude-sonnet-4-6** (reused; good structured factual parsing at bounded `max_tokens 700`; no new provider, no cost jump). Strict JSON with deterministic coercion; **one repair**; **timeout** → null.

## 9. Structured Event Extraction
Proposals → `proposalsToObservedItems`: drops metric/static/forecast/opinion and future-tense plans, then runs each `event` proposal through `extractEvent` (with `assumeTriggering` — the LLM's allowed event-vs-metric judgment, §14) while **date + materiality + negative-detection remain deterministic**. No raw LLM output becomes Evidence.

## 10. Prompt-Injection Defense
The extraction system prompt explicitly forbids obeying page instructions, revealing itself, or executing commands, and demands schema-only output. Page content is neutralized (`neutralizePageContent` inline phrase strip) before the model sees it. Tested: an injected page is neutralized and still yields the factual event.

## 11. Temporal Validation
LLM date is never trusted blindly — `resolveEventDate` is authoritative. Live-verified: model returned "March 2026" (event) for a page **published August 2026**; publication/retrieval never become the event date; precision preserved (month/quarter/year/relative/unknown).

## 12. Materiality
Deterministic `classifyMateriality` remains final (§35). A recent-but-irrelevant proposal (sponsorship) is rejected; a metric/static/forecast is dropped pre-gate. **Known limit:** the materiality lexicon misses some real English phrasings (e.g. "inaugurated a new manufacturing plant") → conservative non-acceptance (P2: broaden lexicon), never a false accept.

## 13. Origin / Corroboration
Unchanged: canonical event identity dedupes same-event/multi-source; independent support needs ≥2 distinct origin ids; no independence inferred from claim/URL count.

## 14. Historical-New vs True Change
Survives structured extraction (tested): a pre-cutoff structured event → `newly_discovered_historical` (new Evidence, no What Changed); a post-cutoff event → `accepted_new` + What Changed.

## 15. Shared Initial/Recurring Extraction
The extractor is flow-agnostic (source→claim→event→validation); initial and recurring differ only in the cutoff/novelty layer (`classifyDelta`). Wiring the initial research pipeline to call it is a documented P2 (the primitive is shared; the live initial pipeline call-site is not yet switched).

## 16. Budgets
`ExtractionBudget` (maxContentChars, maxProposals, timeout) + `EscalationOptions.budget` (maxFetchesPerAccount, maxContentChars). Repair capped at 1; content capped; proposals capped.

## 17. Observability / COGS
`EscalationMetrics` extended: `llmExtractionCalls`, `extractionRepairs`, `extractionFallbacks`, `claimsProposed`, plus event funnel (proposed/accepted/dateResolved/dateUnknown/materialityRejected). Token/cost via existing `recordLLMUsage` ledger. No raw page/LLM output logged.

## 18. Controlled Extraction Evaluation
Same fixture (acquisition described in noun form, buried date): **deterministic-only accepted = 0; structured + deterministic validation accepted = 1; false accepts = 0.** Structured extraction recovered an event the verb-based scraper missed, with no loss of temporal/materiality discipline. (Small controlled sample — not a broad benchmark.)

## 19. Live Smoke
Real Anthropic model on a noisy multi-fact page (5.6s, 1 call, no repair): proposed 4 claims / 1 event; the event was `facility_opening` dated **March 2026** (not the August publication date), correctly excluding the revenue metric, the static country count, and the future-plan forecast. The deterministic materiality gate conservatively did not accept that English phrasing (P2 lexicon breadth). Proposal-layer recall + temporal discipline confirmed live; no fabrication.

## 20. Tests
New `canonical-fulltext-extraction.test.ts` **23/23** (case authority + cutover guard + parity; structured extraction, malformed→repair, timeout→fallback, injection, static/metric/forecast/negative/irrelevant, no-raw-LLM→Evidence, historical-new vs true-change, controlled eval, deterministic fallback). Regression green: monitor-activation 24, research-temporal-hardening 25, monitor-intelligence 40, account-memory 27, account-memory-store 18, account-opportunity-synthesis 40, deliverable-renderer 60, portable-deliverable 55, lead-hunter-production 20, confirmed-context-execution 21, commercial-continuity 17, company-first-discovery 77. `tsc` clean; `npm run build` clean.

## 21. Production Verdict
**CANONICAL CASE + EXTRACTION V1 HARDENED WITH NON-BLOCKING P2.** One Decision authority for initial + recurring (cutover done, zero regression); structured full-text extraction operational with deterministic gates final. P2: broaden the deterministic materiality lexicon (recall), and switch the live initial research pipeline to call the shared extractor + `synthesizeCase` at its own call-site.

## 22. Updated Intelligence Maturity
Stage A 95 · Confirmed Context 90 · Lead Hunter 85 · Research 85 (structured extraction) · Source/Evidence 86 · Temporal/What-Changed 89 · Opportunity Case 90 (one Decision authority) · Portfolio 85 · Account Memory 90 · Monitor 85 · Scheduler 70 (trigger pending founder) · Provider/COGS 65 · Colombia/private 45 · Observatory 40.
- **CORE INTELLIGENCE SPINE ≈ 89%**
- **OVERALL INTELLIGENCE OPERATIONAL MATURITY ≈ 85%**
- **LIMITED SELF-SERVE INTELLIGENCE READINESS ≈ 82%**

## 23. P0/P1/P2
- **P0:** none.
- **P1 (founder):** enable the recurring cron (`CRON_SECRET` + `MONITOR_SCHEDULER_ENABLED=true` + deploy).
- **P2:** broaden deterministic materiality lexicon (English/ES phrasings); switch live initial research pipeline to the shared extractor + `synthesizeCase`; Observatory aggregation; Colombia source strategy; provider-routing/COGS tuning.

## 24. Recommended Next Move
1. Provider routing + COGS optimization (using the extraction funnel + ledger).
2. Intelligence Observatory aggregation / exception monitoring.
3. Colombia/private-company source strategy.
4. Founder scheduler activation → production repeated-cycle soak.
