# LeadLens International Event Recall V1 — Acceptance

Generated: 2026-08-31

Starting HEAD: `0aa92c5ec048b75a1fc77d84ef7aac9bf02d6e49`

Release decision: `FREEZE_CORE_ONLY`

Single remaining blocker: `PRODUCTIVE_EVENT_RECALL_STABILITY`

## Executive result

The original Colombia failure was reproduced as a conversion problem, not a truth-gate problem: 48 search results produced zero canonical companies because provider fallback stopped on result volume, Spanish event subjects and legal forms were under-extracted, long ICP descriptions were used as literal search phrases, and identity budget was consumed before target-geography/target-vertical hints.

The bounded discovery benchmark now converts Colombia event results into verified accounts without bypassing Research:

| Run | Raw results | Company mentions | Domains resolved | Geography resolved | Target-valid canonical companies |
|---|---:|---:|---:|---:|---:|
| Historical Colombia baseline | 48 | 1 observed hint | 0 | 0 | 0 |
| Broad industrial post-fix (`1788200409648`) | 26 | 6 | 1 | 1 | 1 (`WEG`) |
| Exact customer-context post-fix (`1788202112561`) | 30 | 8 | 2 | 2 | 2 (`Mapei`, `WEG`) |

This is a real discovery-recall improvement. It is not yet a productive opportunity-quality acceptance: neither account reached canonical Research in a repeatable full customer run during this sprint.

## What changed

- Spanish/LatAm corporate subject extraction now supports accented event verbs, object-first headlines, newsroom suffix forms, legal suffixes and conservative snippet fallback.
- Coordinated actors separated by commas are resolved independently; generic `others/otros` is rejected.
- Provider fallback is based on useful event/identity surfaces rather than raw result count.
- Foreign event subjects cannot prematurely stop Colombia fallback.
- Long customer ICP descriptions are projected into compact searchable buyer families while the full confirmed context remains authoritative downstream.
- Identity work is prioritized by corporate-domain evidence, target geography and target vertical.
- Uppercase corporate initialisms such as WEG can resolve only when the official host carries the exact token.
- US state names are accepted as explicit US geography evidence; foreign ccTLD and explicit foreign identity still dominate.
- Employment directories and publisher surfaces observed in the degraded run (`Computrabajo`, `Más Colombia`) are rejected before Research.
- Event-first URLs remain discovery provenance only. They do not become Evidence, event dates, Timing or Decisions.

## Colombia forensic funnel

### Historical failure

- Raw results: 48
- Canonical companies: 0
- Dominant rejection: no explicit event subject
- Additional causes: stale result, wrong target, identity unresolved, provider fallback stopped too early

### Final controlled customer-context benchmark

Artifact: `ml/data/acceptance/event-first-recall-1788202112561.json`

- Duration: 14.844 s
- Queries: 4
- Raw results: 30
- Explicit company mentions: 8
- Domains resolved: 2
- Geography resolved: 2
- Target-valid: 2
- Canonical companies: 2
- Accepted identities:
  - Mapei — `mapei.com` — Colombia
  - WEG — `weg.net` — Colombia
- Rejections: no subject 22; wrong target 1; identity unresolved 5
- Provider calls: Tavily 7, Brave 4, Serper 4
- Serper response: not enough credits; it did not become a commercial downgrade.

## Productive Colombia E2E

### Anthropic-available run before final query compression

Artifact: `ml/data/acceptance/customer-e2e-1788201571956.json`

- Acceptance seams: no failed checks
- Total: 244.613 s
- Background processing: 217.431 s
- Candidate universe: 15
- Researched: 3
- Canonical decisions: 3 Hold
- Natural non-Hold: 0
- Event-first target-valid: 0
- Anthropic: 13 calls, 1 error, USD 0.256092 observed
- Brave: 28 calls; Tavily: 37 calls; Serper: 4/4 errors
- Customer-safe leakage: 0

The three researched accounts (Organización Corona, Grupo Carvajal, Alpina) had plausible structural fit but no validated current material event. Hold was correct.

### Provider-degraded run after final query compression

Artifact: `ml/data/acceptance/customer-e2e-1788202156667.json`

- Anthropic returned HTTP 400 usage-limit exhaustion.
- Stage A used deterministic fallback honestly.
- Total: 54.488 s
- Background processing: 46.336 s
- Delivered accounts: 0
- Event-first: 30 raw, 0 explicit subjects, 0 canonical
- Internal Research attempted two non-account surfaces; neither was delivered.
- The exact `Computrabajo` and `Más Colombia` leak is now covered by the Candidate Universe non-account contract.

This run proves failure honesty and bounded degraded execution, not market coverage or opportunity quality.

## US regression

Final discovery artifact: `ml/data/acceptance/event-first-recall-1788201524217.json`

- Duration: 3.406 s
- Raw results: 42
- Company mentions: 11
- Canonical companies: 0
- False canonical companies: 0

An intermediate run incorrectly fused `Siemens, Diageo, Oxbo` into one identity and assigned `siemens.com`. The exact case was converted into a contract test and fixed by actor-list splitting. The final run is truth-safe but shows low Event-First recall in this bounded sample. Existing US Account-First productive evidence is not reclassified by this sample.

## Truth and safety acceptance

- Wrong-company customer Evidence: 0 observed in reviewed E2E outputs.
- Wrong-geography accepted company in final controlled Colombia sample: 0/2.
- Event hint to Evidence bypass: 0 by contract.
- Discovery URL to Evidence bypass: 0 by contract.
- Static fact to event: 0 in reviewed Holds.
- False independent support introduced: 0.
- Provider failure converted to commercial negative: 0.
- Cross-tenant result access: blocked (404 in live disposable-tenant E2E).
- Degraded run falsely reported as successful opportunity coverage: no.

## Runtime and cost

| Run | Total/runtime | Observed Anthropic cost | Outcome |
|---|---:|---:|---|
| Pre-final Colombia E2E | 244.613 s | USD 0.256092 | 3 Hold |
| Provider-degraded Colombia E2E | 54.488 s | USD 0 | 0 delivered |
| Exact Colombia discovery benchmark | 14.844 s | not measured separately | 2 canonical discovery accounts |
| Final US discovery benchmark | 3.406 s | not measured separately | 0 canonical, 0 false canonical |

No completed full run exceeded 300 seconds. Search-provider monetary cost was unavailable and is not invented.

## Test evidence

- Lead Hunter universe: 29/29
- Event-First discovery: 31/31
- Dynamic universe/geography: 26/26
- Account Deep Research: 35/35
- Productive Intelligence Spine: 25/25
- Customer E2E seams: 12/12
- Evidence/Temporal: 55/55
- Signal/Temporal/Monitor: 51/51
- Monitor consolidation: 41/41
- HTTP surface security: 12/12
- TypeScript: required at final closeout
- Build: required at final closeout

## Readiness by release envelope

- Frozen truth core: PASS.
- Candidate Universe truth boundary: PASS after exact non-account regression tests.
- Colombia controlled event discovery: SUPPORTED for bounded industrial-manufacturing diagnostics.
- Colombia productive customer opportunity recall: NOT YET SUPPORTED.
- US previously validated Account-First wedge: unchanged; Event-First bounded sample remains low recall.
- Global self-serve: NOT READY.
- Guided beta: viable only with explicit coverage limitation and human QA.

## Freeze decision

`FREEZE_CORE_ONLY`

The truth, tenancy, Evidence, temporal, Decision, Memory and Monitor boundaries remain frozen. Do not broaden architecture or relax gates.

Exactly one blocker remains before Intelligence V1 freeze:

`PRODUCTIVE_EVENT_RECALL_STABILITY` — verified Event-First accounts must reliably survive the same interpreted customer context into Candidate Universe and bounded Research across repeated provider outcomes, with at least one naturally defensible non-Hold Case or an evidence-backed no-opportunity result from the event-derived accounts themselves.

The next validation should rerun the exact Colombia context only after Anthropic is operational, inspect whether Mapei/WEG enter the persisted universe and Research order, and stop after that single causal check.
