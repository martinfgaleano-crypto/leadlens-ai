# LeadLens Intelligence — Productization & Release V2 Acceptance

Session verdict: **PARTIAL** — the USA Candidate-Universe collapse was diagnosed to a specific,
evidence-backed root cause (Phase 2) at **zero new spend**, and the obvious Phase-3 fix was
implemented and **live-verified as a regression, then reverted** (verified-negative). No unsound
code shipped; no large live campaign was run (budget policy §11). The core release blocker
(productive USA universe recall) is preserved honestly. Builds on
`LEADLENS_INTELLIGENCE_CORE_AND_TIERS_COMPLETION_V1_ACCEPTANCE.md`.

Branch: `intelligence-launch-acceptance-v1` · start HEAD `ee6a8f6` · end HEAD `ee6a8f6` (+ this doc).
No product code change committed. No push. No merge. Billing / payments / auth / pricing / landing
untouched. Other worktree (`leadlens-project`, packaging-clarity-v1) untouched.

## 1. Repository truth (Phase 0)
State intact from V1: HEAD `ee6a8f6`, V1 commits `da50667` (recall closure) + `ee6a8f6` (acceptance)
present; origin/intelligence-launch-acceptance-v1 still at `40bf8cc` (V1 work local, unpushed). Only
`.leadlens/*` runtime ledgers dirty (excluded). No other agent advanced the branch.

## 2. Track A input recoverability (Phase 1) — EXACT_MATRIX_RECOVERED
Correcting V1's conservative "not recoverable": the exact per-run productive inputs **are** frozen and
recoverable. The stored run artifacts `ml/data/acceptance/customer-e2e-*.json` each record the verbatim
`synthetic_context` (the exact input text), the full `candidate_universe`, `delivered_accounts`,
`timings` and `usage_delta`. Combined with `docs/intelligence/launch-acceptance-v1/commercial-contexts.json`
(3 families × US/SA), the six Track A runs are reproducible. (Re-executing them still needs Anthropic —
now restored — but is a bounded live campaign deferred here per §11.)

## 3. Candidate-Universe diagnostic (Phase 2) — from existing artifacts, zero spend
Per-family universe totals from the frozen Track A run artifacts:

| Family | US (English) universe | SA (Spanish) universe |
|---|---:|---:|
| industrial-automation | **1** | 17 |
| lean-operations-software | **0–1** | 15–18 |
| channel-partnerships | **2** | 15 |

The `candidate_universe.coverage.eventFirst.result_audit` for the clean-provider US runs shows the
**first-loss stage is discovery query → corporate-subject extraction**: 38–45 of 48 hints yield
`no_subject`, because the English event queries surface **market-research-report / aggregator SEO** —
top hosts `mordorintelligence.com`, `technavio.com`, `expertmarketresearch.com`,
`marketdataforecast.com`, `thebusinessresearchcompany.com`, plus YouTube / X / Wikipedia / PubMed.
These pages correctly carry no extractable operating-company subject (the extractor is behaving
correctly). The equivalent Spanish queries do not hit this report-SEO layer, so SA yields 15–18.
(One earlier US run, `customer-e2e-1789603045864`, additionally recorded
`provider_unavailable: brave, tavily` — a provider-degraded run, reported separately per §58 and not
used as clean evidence.) Root cause = **English universe query composition**, not provider absence and
not an over-strict gate.

## 4. Phase 3 attempted fix — implemented, live-verified, REJECTED, reverted
Hypothesis: append report-SEO negative-phrase suppression (`-"market size" -"market share"
-"industry analysis" …`) to the **English** event queries only (Spanish/SA untouched; no company/
event/URL seed; no gate weakened). Implemented in `planEventFirstQueries` + a deterministic fixture
(both passed: event-first-discovery 40/40, and adjacent regressions green: event-first-queries 6,
productive-event-first-parity 13, lead-hunter-universe 30, discovery-value 33, account-first-discovery,
tsc 0).

**Bounded same-session live A/B (real Brave, same state, 6 queries each), suppression OFF vs ON:**

| | provider_calls | results | subject-bearing |
|---|---:|---:|---:|
| suppression OFF (baseline) | 6 | 36 | 6 (**17%**) |
| suppression ON (fix) | 6 | 36 | 2 (**6%**) |

The fix **degraded** company-subject yield (17% → 6%) and `mordorintelligence` appeared *more* — Brave
does not cleanly honour a chained negative-phrase operator, so the change backfires. Per §22/§23/§58 a
change that worsens recall must not ship: the code + fixture were **reverted** to HEAD. This
verified-negative is the session's engineering result — it removes negative-term query suppression from
the solution space and shows the fix must be a genuine query-reformulation, live-verified.

## 5. Provider preflight (§10)
Brave: **HEALTHY** (health() = available; live search returned results). Tavily/Firecrawl/Serper/Exa:
keys present (names only), not exercised this session. Anthropic: HEALTHY (V1 probe). No repeated
probing; no new provider activated (Exa/SAM.gov/Data.gov not touched).

## 6. Tiers & Premium (Phases 5–8) — unchanged from V1; NOT full-order live-validated this session
Per V1: Preview/Brief/Intelligence-$59/Premium and the Premium V1 capability layer are PRODUCTION_WIRED
and pass deterministic acceptance; one bounded Premium **contextual** live acceptance passed (10/10,
COGS $0.0479). No full-order productive tier runs were executed here (a materially larger live campaign;
deferred per §11 budget policy). Honest tier state: **CONTROLLED_VALIDATED**, not
**LIVE_FULL_ORDER_VALIDATED**. Premium full 18-company order = `PREMIUM_FULL_ORDER_NOT_YET_VALIDATED`.

## 7. Truth safety
No product code shipped → no new violation. The rejected change touched only English discovery query
strings (never identity/date/materiality/geography/Decision gates) and was reverted. Deterministic gate
remains green at HEAD.

## 8. Release readiness (unchanged; gated by core universe recall, not tier/Premium code)
All tiers, USA and South America: **GUIDED_BETA**. Not self-serve — the productive USA Candidate
Universe is systematically thin (query→subject collapse) and the direct fix is verified-not-viable, so
the core gate (§27) is not met.

## 9. Remaining release blocker (single, P1)
**USA Candidate-Universe recall**: English universe queries surface market-research-report SEO instead
of operating-company pages, collapsing the US universe to ~0–2 (vs ~15–18 for the equivalent Spanish
context). Negative-term suppression is verified not to work. Needs a genuine English query
reformulation (e.g. operating-company-page-biased query families, provider-appropriate operators, or a
retrieval-then-company-page-resolution step), each **live-verified** on the frozen US contexts before
acceptance.

## 10. Next three moves
1. Reformulate the English event/account-first universe queries toward operating-company pages
   (not negative-term suppression); measure subject-bearing yield with the bounded same-session live
   A/B harness (rebuild the temp `scripts/_tmp-universe-ab` pattern) before any full run.
2. Once a query variant beats the 17% baseline on Brave (and holds on Tavily), run the exact frozen
   Track A US contexts once each (Anthropic restored) and re-classify the USA universe.
3. Only after core recall is defensible: execute one full 18-company Premium productive order to move
   Premium from CONTROLLED_VALIDATED → LIVE_FULL_ORDER_VALIDATED with measured runtime + COGS.

## Canonical artifacts (by path)
- `docs/intelligence/LEADLENS_INTELLIGENCE_CORE_AND_TIERS_COMPLETION_V1_ACCEPTANCE.md`
- `docs/intelligence/launch-acceptance-v1/*` and `.../recall-closure-v1/*`
- `ml/data/acceptance/customer-e2e-*.json` (frozen Track A run artifacts: exact inputs + funnel + cost)
- `lib/lead-hunter/event-first-discovery.ts` (`planEventFirstQueries` — the query-composition surface)
