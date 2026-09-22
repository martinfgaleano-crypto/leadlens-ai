# LeadLens Intelligence Recall Closure V1

## Decision

Sprint status: `OPS_BLOCKED_INCOMPLETE_RERUN`.

Launch status: `NOT_READY`.

The bounded known-event control closed locally at 7/8 with no observed truth hard fail. The exact six-context Track A rerun could not be executed because Anthropic returned `credit balance is too low`. Two of three frozen USA contexts remain `SYSTEMATICALLY_INCOMPLETE` in the last valid baseline, so the stricter `RECALL_CLOSED` status is not permitted.

## Track B

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Captured controls | 5/8 | 7/8 | +2 |
| Capture rate | 62.5% | 87.5% | +25 pp |
| Provider calls | 66 | 69 | +3 |
| Extractions | 15 | 13 | -2 |
| Runtime | 222,261 ms | 125,306 ms | -96,955 ms (-43.6%) |
| Observed cost | not measured | not measured | not asserted |

Captured: Nestlé USA, Conagra Brands, Quad, voestalpine, Hitachi Energy, John Deere, Mondi.

Missed: UFP. Brave and Tavily returned valid official UFP changes, but neither returned the frozen South Carolina facility source in bounded general or source-language probes. This is classified `PROVIDER_MISS`, not a truth-gate rejection.

False positives and truth hard fails observed in the final control: 0.

## Generalized changes

1. Replaced an over-conjoined exact signal query with a bounded official-domain operating-change vocabulary. Query count stayed unchanged.
2. Prevented quarterly/trading updates and generic non-asset expansion pages from consuming the two extraction slots.
3. Preserved concrete facilities, plants, distribution centers and standalone material changes as eligible extraction candidates.
4. Routed official-domain current-activity probes through the corporate web index instead of Tavily's incomplete news index; counterevidence remains news-oriented.

No Fit, Timing, Evidence, Decision, geography, identity, materiality, provenance, corroboration, delivery or concurrency gate changed.

## Provider contribution

The bounded attribution replay demonstrated complementary value:

- Brave-only: Nestlé USA, Quad; Hitachi was found by Brave while Tavily timed out.
- Tavily-only: Conagra Brands, voestalpine, Mondi.
- Neither: UFP.
- John Deere: captured in the productive final run, but per-URL provider attribution is not persisted and bounded replay did not reproduce the provider. Marked `NOT_MEASURED`, not inferred.

Exa was not tested because Brave + Tavily reached 7/8; the benchmark gate for Exa was not met.

## USA baseline collapse

The three frozen USA contexts produced 144 raw results but only 20 extracted subjects, 3 canonical companies and 3 selected Research accounts. Industrial automation and operational software are `SYSTEMATICALLY_INCOMPLETE`; channel partnership is `THIN_BUT_DEFENSIBLE`. The dominant failure is result/subject extraction and subject/canonical-identity conversion, not Research selection.

See `usa-universe-analysis.json` for the per-stage table.

## Track A

The prior frozen result remains the only valid matrix: 6 runs, 50 universe accounts, 9 researched, 7 portfolio accounts, 9 Hold and 0 customer-visible positive opportunities. No conclusion is changed by the incomplete rerun. All-Hold is not itself a defect; the USA universe collapse is.

Anthropic was probed once by the targeted run and returned HTTP 400 `credit balance is too low`. Subsequent work used deterministic/provider-level paths; no full Track A run was attempted.

## Release envelope

Allowed: internal diagnostics, bounded positive-control evaluation, and founder-guided research where candidate companies are independently reviewed.

Not allowed: self-serve launch, claims of complete USA market coverage, or autonomous Track A acceptance.

## Remaining priorities

P0: restore Anthropic quota and rerun the exact six frozen Track A contexts without changing inputs or gates.

P1: improve USA result-to-subject and subject-to-canonical-company conversion under the existing provider budget, then rerun only the USA contexts if the exact matrix confirms the same collapse.

## Exact next action

Restore Anthropic availability and execute the unchanged six-context Track A matrix once; use that result to determine whether the USA universe remains systematically incomplete.
