# LeadLens Productive Opportunity Recall Stabilization V1 — Acceptance

Date: 2026-08-31

Starting HEAD: `56ac6ada91acec55f6dba2b69b6a7291ccbd4f1b`

Scope: controlled Event-First → productive Candidate Universe → Research selection → Deep Research → canonical Case.

## Status

**PARTIAL — FREEZE_CORE_ONLY.**

The isolated recall defect is closed at the controlled-to-productive handoff: valid Event-First candidates retain provenance and research hints through normalization, deduplication, durable universe reload, balanced selection, and Deep Research. There were zero silent disappearances in the measured Colombia pair. Truth gates remain fail-closed.

Full Intelligence V1 cannot freeze yet because the live post-fix run could not validate an event or produce a natural non-Hold Case while Anthropic returned HTTP 400 (`usage limits`). This is provider evidence, not a no-opportunity conclusion.

## Controlled → productive parity

| Company | Controlled | Canonical | Target-valid | Productive universe | Research-ready | Selected | Researched | Validated event | Case | Decision | Exact disposition |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Mapei | yes | yes (`mapei.com`) | yes, Colombia | yes | yes | yes | yes | no | yes | Hold | `EVENT_DATE_FAILED` / `MATERIALITY_FAILED`; hinted page fetched fresh but did not yield a dated material event |
| WEG | yes | yes (`weg.net`) | yes, Colombia | yes | yes | yes | yes | no | yes | Hold | `EVENT_HINT_TOO_WEAK`; hinted secondary URL was not accepted, generic research found only out-of-geography events |
| Rainforest Distribution | yes | yes (`rainforestdistribution.com`) | yes, United States | not measured in productive E2E | not measured | not measured | not measured | not measured | not measured | — | controlled US conversion proven; productive validation blocked by provider availability |

Colombia target-valid canonical Event-First: **2**. Survived productive universe: **2**. Survival rate: **2/2 (100%, small n)**. Silent disappearances: **0**.

## Productive Event-First funnel — Colombia post-fix

- Raw Event-First results: 36 in the productive run (30 in the clean controlled run).
- Company mentions: 11.
- Canonical Event-First companies: 2.
- Target-valid: 2.
- Productive universe: 2.
- Selected: 2.
- Researched: 2.
- Validated events: 0.
- Material validated events: 0.
- Prioritize / Validate / Monitor / Hold: 0 / 0 / 0 / 2.
- Forced decisions: 0.

The full durable universe contained 7 candidates: 4 eligible and 3 excluded. Mapei and WEG were both selected despite the research cap; Event-First was not starved.

## Defects fixed

1. Account-First/Event-First fusion now unions bounded research hints and provenance instead of retaining the lower-information duplicate.
2. Origin flags preserve `ACCOUNT_FIRST`, `EVENT_FIRST`, `BOTH`, `VAULT_REUSED`, and `CONTEXT_REUSED`.
3. Context Memory candidates preserve matching Event-First hints without converting them to Evidence.
4. Balanced research ordering reserves Event-First coverage without allowing it to monopolize the cap.
5. Deep Research fetches the hinted URL first, validates it through the same identity, temporal, geography, and materiality gates, and falls back safely.
6. Event-date hints are never accepted as canonical dates without fresh source validation.
7. Colombia business-media source types are classified as news rather than rejected by an English-only source classifier.
8. Editorial phrases such as “Lejos del petróleo” are rejected as non-company subjects.
9. Failed identity providers no longer consume the successful-resolution budget.
10. US state names support geography resolution; event-page geography is evaluated independently from the corporate-domain page.
11. All event validation paths now require target-geography grounding. This closed a severe live leak where Mapei Colombia could inherit UK/Portugal events.
12. Productive telemetry now records candidate origins, hint counts, Event-First selection, research, validated events, and Cases.

## US trace

Three event-rich lanes were tested. Manufacturing and SaaS produced no canonical company after safe rejection. Logistics produced:

- 18 raw results → 2 subjects → 1 canonical and target-valid company.
- Rainforest Distribution, Fort Pierce, Florida distribution-center opening.
- Runtime: 5.088 s.
- Tavily: HTTP 433; Serper: HTTP 400 exhausted; Brave supplied the valid result.
- No false canonical company was emitted.

This proves controlled US Event-First conversion is non-zero. It does **not** prove productive US Case conversion.

## Research selection and hint safety

- A cap of 3 selects up to 2 event-led candidates and keeps at least 1 structural candidate when both classes exist.
- Hints influence research order only. They do not alter Fit, Timing, Evidence, score, or Decision.
- Discovery URL → Evidence: 0.
- Hint date → canonical event date without validation: 0.
- Context Memory/Vault → Evidence: 0.
- Failed/mismatched hint auto-acceptance: 0.

Deterministic parity fixture: **11/11 pass**. Productive spine fixture: **27/27 pass**.

## Runtime and observed cost

| Run | Geography | Runtime | Event-First selected | Researched |
|---|---|---:|---:|---:|
| Clean controlled Event-First | Colombia | 7.645 s | n/a | n/a |
| Productive customer E2E post-geography gate | Colombia | 53.844 s | 2 | 2 |
| Controlled Event-First logistics | United States | 5.088 s | n/a | n/a |

Measured productive account research: Mapei 7.354 s; WEG 4.126 s. Maximum measured run: 53.844 s. Runs over 300 s: 0/3 in this post-fix set.

Observed productive provider delta: Anthropic 1 call / 1 error / 0 billed tokens recorded; Brave 32 calls / 0 errors; Serper 4 calls / 4 errors; Tavily 15 calls / 7 errors. External Brave/Tavily/Serper monetary cost is **Unknown**; do not infer zero from the internal ledger.

## Truth safety

- Wrong company in accepted output: 0 observed post-fix.
- Wrong geography in accepted event: 0 after the new regression gate.
- Static fact promoted to event: 0 observed.
- Temporal fabrication: 0.
- False Independent Support: 0.
- Provider failure converted into commercial counterevidence: 0.
- Portfolio/Decision semantics changed: no.
- Ranking, selector, and scorer changed: no.

## Release envelope

| Envelope | Readiness | Evidence |
|---|---|---|
| US manufacturing | GUIDED_BETA | universe stable historically; current Event-First positive conversion still 0 |
| US logistics | GUIDED_BETA | controlled canonical conversion 1/1; productive Case conversion not yet measured |
| Colombia manufacturing | GUIDED_BETA | controlled→productive survival 2/2; no validated event in post-fix E2E |
| Colombia logistics | GUIDED_BETA | identity/geography improved; natural actionability sample insufficient |

Global readiness: **GUIDED_BETA**.

Intelligence freeze: **FREEZE_CORE_ONLY**.

Exactly one remaining blocker: **PRODUCTIVE_EVENT_TO_CASE_VALIDATION** — demonstrate, with Anthropic operational, at least one naturally validated material Event-First event reaching a canonical Monitor/Validate/Prioritize Case under unchanged truth gates.

## Reopen conditions

Reopen the stabilized recall core only for: silent Event-First disappearance; hint leakage into Evidence; systematic Event-First starvation; wrong-company/domain association; wrong-geography event acceptance; or a measured valid-event false negative with a deterministic reproduction.

## Evidence artifacts

- `ml/data/acceptance/event-first-recall-1788205561106.json` — clean Colombia controlled conversion.
- `ml/data/acceptance/customer-e2e-1788206032185.json` — Colombia productive E2E after geography gate.
- `ml/data/acceptance/event-first-recall-1788206656689.json` — US logistics controlled conversion.

These artifacts record real provider behavior. They are acceptance evidence, not customer-facing Evidence and not fixtures.
