# LeadLens Opportunity Recall Engine V1 — Acceptance

Generated from repository and live-run evidence on 2026-08-31. This artifact separates unique accounts/events from repeated observations and does not assign human-positive labels.

## STATUS

**PARTIAL**

Event-First Discovery materially improved natural opportunity recall in the validated US food/beverage manufacturing wedge while preserving canonical Research gates. The release remains **GUIDED_BETA** because evidence does not yet support cross-wedge event recall, especially Colombia, and no natural `Validate` or `Prioritize` was observed.

## EXECUTIVE OUTCOME

- Added a bounded Event-First lane and fused it with Account-First discovery without creating a second truth engine.
- In two identical unseeded productive runs, Event-First supplied all 3 deeply researched accounts and the only natural non-Hold Case.
- The best natural Case was SunOpta: one dated, material, primary-source production-capacity event; canonical Decision `Monitor`.
- Account/company/decision overlap was 100% across the two runs.
- Runtime improved from 278.9s to 236.2s, but median 257.5s remains marginal against the preferred 180–200s envelope.
- A live acceptance review found and fixed a false independent-corroboration claim caused by a related-link mention on an acquisition article. SunOpta is therefore treated as primary-source-supported, not independently corroborated, until a true second source is recovered.
- Event-first Colombia coverage remained weak: 0 canonical companies from the final 48 raw result observations across two Colombian contexts.

## GIT

- Starting HEAD: `287ec6964b43cee11c472b048bea7809bddc34c9`
- Origin at start: `da9e32a801b44d11c1c8c662132fe94dbfe08d50`
- Branch: `main`
- Push: **NO**
- Remote check: unavailable because DNS resolution failed; no remote state was invented.
- Pre-existing `.leadlens` changes and unrelated founder acceptance files were preserved and not staged.

## COMMITS

| Commit | Capability | Evidence |
|---|---|---|
| `418d246` | Event-First discovery and Account/Event fusion | Deterministic contracts and live event benchmark |
| `c10a09d` | Identity, target and recency hardening | XPO/RSA/PE/stale leak rejections |
| `3be4335` | Canonical Case/customer narrative reconciliation | Hold Cases no longer claim confirmed urgency |
| `5280125` | Claim-level corroboration provenance | Exact source bindings in Case evidence |
| `1d1a74a` | Demand-safe Timing narrative | Non-Hold text cannot claim buying intent/immediate demand |
| `d3e5e0d` | Related-link corroboration hardening | Exact SunOpta false-support regression |

## OPPORTUNITY DISCOVERY ARCHITECTURE

- Account-first: **YES**
- Event-first: **YES**
- Fusion: **YES**
- Canonical Research/event/materiality/Decision validation reused: **YES**
- Event hint → Evidence bypass: **NO**
- Event-First can influence Research priority only after identity, target and geography validation; it cannot strengthen canonical Decision directly.

## EVENT-FIRST FUNNEL

Post-fix selected discovery benchmark (`event-first-recall-1788192082505.json`):

- Contexts: 4 (US manufacturing, US logistics, Colombia manufacturing, Colombia logistics)
- Queries: 16
- Raw result observations: 90
- Unique event hints: 15
- Canonical companies: 5
- US manufacturing canonical companies: 3
- US logistics canonical companies: 2
- Colombia canonical companies: 0

Repeated productive US manufacturing run, per run:

- Event queries: 4
- Raw hints: 24
- Unique hints: 5
- Event-First canonical companies: 3
- Fused universe: 4 (1 Account-First, 3 Event-First)
- Deep researched: 3 (bounded selection; all Event-First)
- Unique validated events: 1
- Unique material-event accounts: 1
- Evidence-valid unique Cases: 1
- `Prioritize`: 0
- `Validate`: 0
- `Monitor`: 1
- `Hold`: 2

## ACCOUNT-FIRST VS EVENT-FIRST

| Metric | Account-First | Event-First | Fused |
|---|---:|---:|---:|
| Unique valid companies in productive universe | 1 | 3 | 4 |
| Deep researched in bounded run | 0 | 3 | 3 |
| Unique validated-event accounts | not measured in same run | 1 | 1 |
| Unique actionable non-Hold Cases | not measured in same run | 1 | 1 |
| Known accepted-sample identity/geo issues | 0 | 0 | 0 |

This is a partial A/B comparison. Account-First's one company was not selected for Research in these bounded runs, so a full origin-level conversion comparison would be misleading.

## EVENT RECALL

- Live category contexts sampled: 5 initially; 4 post-fix selected; two Colombian contexts rerun separately.
- Unique validated real material events after canonical Research: **1**.
- Serious pre-fix discovery leaks: stale event hints, wrong event subject, logistics publisher/domain confusion and PE firms entering a SaaS buyer context.
- Those exact classes were corrected and covered by deterministic tests.
- False positives in the reviewed final canonical non-Hold sample: 0 of 1, but `n=1` is insufficient to claim generalized precision.
- False rejects: not measured with a human-labeled complete event universe.
- Recall interpretation: **WEAK cross-wedge; promising within the repeated US manufacturing wedge**.

## NATURAL ACTIONABILITY

Unique deeply researched accounts (`n=3`):

- `Prioritize`: 0
- `Validate`: 0
- `Monitor`: 1
- `Hold`: 2
- Forced decisions: **0**

Repeated account-run observations (`n=6`): Monitor 2, Hold 4. These are repetitions of the same 3 accounts, not 6 independent Cases.

## BEST NATURAL CASE

- Company: SunOpta
- Origin: `EVENT_FIRST`
- Canonical Decision: `Monitor`
- Buyer fit: strong structural fit for an industrial automation/controls and plant-operations software seller
- Geography: United States; Omak, Washington
- Event: opening of a new fruit-snacks production line after >USD 25M investment, expected to increase capacity by 25%
- Event date: 2026-06-01
- Materiality: valid, high; canonical `corporate_event`
- Primary Evidence: SunOpta corporate newsroom
- Primary URL/source ID: `https://www.sunopta.com/one-more-line-lots-more-snacks-sunopta-expands-production-in-omak/` / `src_6b841c3c0e7aa9d5d93e`
- Independent support: **not established after final corroboration hardening**. The prior Business Wire acquisition page only repeated the event in related-link text and is no longer accepted as independent corroboration.
- Counterevidence/risk: Refresco may control technology standards and vendors; automation may already have been contracted with the line; acquisition integration may delay procurement; no active RFP or dissatisfaction is evidenced.
- Timing: a real recent operational change exists, but it is not proof of current buying intent.
- What to validate: post-acquisition controls/MES standards, purchasing ownership and whether any integration/automation scope remains open.
- Defensibility: the event and fit justify continued investigation, while unresolved vendor ownership and open-scope questions correctly prevent `Validate`/`Prioritize`.
- Human-positive: **NOT ASSIGNED**.

## ACTIONABILITY ROOT CAUSE

- Candidate Universe: Event-First improves supply in US manufacturing; cross-wedge supply remains uneven.
- Event recall: one unique valid material event after deep validation.
- Materiality: gate correctly rejected static, stale and wrong-geo items.
- Evidence: primary source valid for SunOpta; true independent corroboration remains missing.
- Timing: current change exists only for SunOpta; no buying intent is inferred.
- Decision: `Monitor` is correct; uncertainty about open commercial scope blocks stronger action.
- Primary remaining cause: **EVENT_RECALL outside the validated US manufacturing wedge, especially Colombia**.

## NATURAL MONITOR

- Observed: **YES**
- Company: SunOpta
- Reason: valid recent material event and fit, but open-scope/vendor-control uncertainty remains.
- Trigger: evidence of controls/MES standardization, integration project, vendor selection or open commissioning scope.
- Refresh: one bounded Monitor refresh completed; it found no new current event and did not fabricate What Changed.

## DECISION TRANSITION

- Genuine new-opportunity transition observed: **NO**
- One Monitor refresh resynthesized a decision from historical evidence, but there was no new current event/revisit trigger. It is not counted as a natural commercial transition.

## COLOMBIA

Final reduced rerun (`event-first-recall-1788193429629.json`):

- Contexts: 2 (manufacturing and logistics)
- Queries: 8
- Raw results: 48
- Canonical companies: 0
- Validated events: 0
- P/V/M/H: 0/0/0/0
- Dominant rejects: no identifiable event subject; stale result; wrong target
- Runtime: 7.5s discovery-only
- Verdict: current provider result quality and query/subject extraction are insufficient for a Colombia launch claim.

## RUNTIME

| Run | Stage A | Confirmation/start | Background Intelligence | Monitor | Total |
|---|---:|---:|---:|---:|---:|
| E2E 1 | 11.7s | 2.5s | 223.4s | 36.3s | 278.9s |
| E2E 2 | 11.7s | 1.5s | 184.1s | 34.6s | 236.2s |

- Total median: 257.5s
- Total max: 278.9s
- Runs >300s: 0/2
- Account-First and Event-First enumeration execute concurrently.
- Research concurrency remains capped at 2.
- Runtime verdict: **MARGINAL** (release ceiling passed; preferred median missed).

## COST

Two E2E runs:

- Anthropic calls: 34
- Anthropic input tokens: 84,764
- Anthropic output tokens: 26,722
- Observed Anthropic cost: USD 0.655122 total; USD 0.327561 median/run
- Brave: 48 calls; monetary cost unavailable
- Tavily: 50 calls; monetary cost unavailable
- Serper: 6 failed calls; monetary cost unavailable
- Event-First marginal search: 7 Tavily calls/run in productive coverage telemetry; monetary cost unavailable
- Cost per unique validated event/actionable Case cannot be isolated fairly from repeated runs and unknown search pricing.

## PROVIDER CONTRIBUTION

| Provider | Company discovery | Event hints | Validated events |
|---|---|---|---|
| Tavily | primary Event-First contributor | yes | discovery origin for SunOpta; canonical validation used deep Research |
| Brave | Account/deep Research and fallback | limited event lane contribution | supported Research, no independently accepted SunOpta corroboration after fix |
| Anthropic | interpretation/structured Research | no search hints | Case synthesis under canonical gates |
| Serper | none in these runs | failures only | none |

## SELF-SERVE V6

Broad V6 was not completed. Evidence consists of one unseeded US manufacturing context repeated twice plus bounded discovery-only wedge checks. This is sufficient to validate the architecture and consistency of one wedge, not sufficient for limited self-serve.

| Geo/wedge | Universe | Deep Research | Valid Events | P/V/M/H | Runtime | Autonomous |
|---|---:|---:|---:|---|---:|---|
| US food/beverage manufacturing, run 1 | 4 | 3 | 1 | 0/0/1/2 | 278.9s | yes |
| Same context, run 2 | 4 | 3 | 1 | 0/0/1/2 | 236.2s | yes |

## OPPORTUNITY DENSITY

| Wedge | Unique accounts researched | Material-event accounts | Actionable non-Hold Cases |
|---|---:|---:|---:|
| US food/beverage manufacturing | 3 | 1 | 1 |
| Colombia manufacturing/logistics | 0 | 0 | 0 |

Do not extrapolate these figures to market-level density.

## PORTFOLIO

- Useful: **PARTIAL**
- Mixed portfolio observed: 1 Monitor + 2 Hold
- All-Hold explanation path remains useful but was not the final repeated portfolio.
- Decision mutation by Portfolio: 0
- Market overclaim: 0

## CUSTOMER PRODUCT

- Actual route contract: `/results/[jobId]/brief`
- The disposable acceptance tenants/jobs were cleaned up, so no persistent customer URL is claimed.
- Event-First lane does not leak into customer complexity; customers receive canonical Case/Decision output.
- Canonical customer narrative now reconciles to validated events and Decisions.
- Final narrative hardening is covered deterministically; the second live artifact predates the last demand-safe text fix.
- Legacy internal enrichment still contains older category/outreach fields, but canonical Case/Decision owns the result route.

## TRUTH SAFETY

Reviewed final unique researched sample (`n=3`) and repeated E2E checks:

- Wrong company accepted as actionable: 0
- Wrong geography accepted as actionable: 0
- Event hint treated as Evidence: 0
- Static fact → canonical event: 0
- Temporal fabrication: 0
- Old event falsely new: 0 in canonical Cases
- False Independent Support: found 1 during acceptance inspection, fixed, regression added; final code rejects it
- Wrong claim/source in final binding: 0 after fix
- Memory/Vault/Universe Memory → Evidence: 0
- Provider failure → commercial downgrade: 0
- Portfolio decision mutation: 0
- Cross-tenant access: 0; non-owner received 404 in both E2E runs
- Forced positive: 0

## TESTS

Final regression set before the corroboration fix: 313 passing checks across Event-First, Lead Hunter, deep Research, release candidate, Productive Spine, Case handoff, Evidence/Temporal, customer seams, HTTP security, Dynamic Universe, Account Memory and Monitor consolidation.

Post-fix affected suites:

- Account Deep Research: 35 passed, 0 failed
- Intelligence Release Candidate: 31 contracts passed, 0 failed (the script's legacy footer still prints `31/30`)

Two initial commands referenced obsolete fixture filenames; rerunning their canonical replacements passed. This was a harness-name issue, not a product failure.

## TYPECHECK

`npx tsc --noEmit`: PASS.

## BUILD

`npm run build`: **PASS** (Next.js 14.2.5, 150/150 static pages, exit code 0).

## READINESS

**GUIDED_BETA**

Supported evidence: repeated unseeded US manufacturing run, natural Monitor, no known accepted-sample identity/geo leak, canonical tenancy and memory lifecycle. Unsupported: broad wedges, Colombia and natural `Validate`/`Prioritize`.

## INTELLIGENCE FREEZE

**FREEZE_CORE_ONLY**

Do not reopen canonical Research/Evidence/Decision semantics without a demonstrated false positive/negative. Event-First discovery and cross-wedge recall are not frozen.

## ONE REMAINING BLOCKER

**EVENT_RECALL**

Evidence: only one unique current material event in the deep sample; Colombia produced zero canonical companies; no live deep Research was completed for the promising US logistics candidates.

Exact next action: run a bounded deep-Research canary on the two post-fix US logistics Event-First candidates, then improve Spanish subject/company resolution using exact rejected Colombia traces before another Colombia E2E.

## PRODUCT FEEL

**CONTINUOUS_ACCOUNT_INTELLIGENCE**

The system now combines structural account discovery, recent-change discovery, canonical Research, Memory and Monitor. It is not yet market-ready across geographies/wedges.

## NEXT PRIMARY PROJECT DOMAIN

Remain in **INTELLIGENCE / EVENT_RECALL** until the one blocker above is resolved. Moving to broad self-serve activation would outrun measured coverage.

## FINAL FOUNDER ANSWERS

1. Valid companies: **Yes in tested wedges, with small reviewed samples; not proven universally.**
2. Recent material change without account names: **Yes, one unique canonical US manufacturing event.**
3. Event-First improves recall: **Yes materially in the repeated US manufacturing run; broad magnitude not yet measured.**
4. Safe Event-First admission: **Yes; identity, target and geography precede canonical Research.**
5. Natural Decisions: **Monitor observed; Validate/Prioritize not observed.**
6. Defensible Decisions: **SunOpta Monitor is defensible after removing false corroboration.**
7. Colombia viable: **Not yet based on current Event-First evidence.**
8. Runtime safe: **Below 300s in 2/2 runs, but marginal against preferred median.**
9. Cost reasonable for beta: **Anthropic cost is reasonable; total cost remains partially unknown.**
10. Portfolio useful: **Partially; mixed decisions and honest Holds are useful.**
11. Continuous Intelligence complete: **Core lifecycle works; cross-wedge recall does not.**
12. Limited Self-Serve Beta: **No. Guided beta only.**
13. Freeze Intelligence V1: **No; freeze core only.**
14. Move engineering to another domain: **Not until Event Recall has at least one additional validated wedge and Colombia trace work is complete.**
