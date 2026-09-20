# LeadLens Intelligence — Core & Tiers Completion V1 Acceptance

Session verdict: **PARTIAL** — Recall Closure recovered, verified and committed; Anthropic
availability restored (Codex's `OPS_BLOCKED` lifted); the four one-time tiers and the Premium V1
capability layer were found **already implemented and production-wired** on this branch and pass
deterministic acceptance; one bounded **live** Premium acceptance passed with measured COGS. The one
core-release blocker that remains is the exact-frozen **Track A** six-context live rerun (now
unblocked) and the USA universe-recall question it must answer.

Branch: `intelligence-launch-acceptance-v1` · start HEAD `40bf8cc` · end HEAD `da50667` (+ this doc).
No push. No merge. Billing / payments / auth / pricing / landing untouched.

## 1. Repository truth (Phase 0)

- Repo `leadlens-ai` has two worktrees: `leadlens-project` (`packaging-clarity-v1`, d02b34b) and
  `leadlens-landing-v2` — **this session's worktree**, which had been re-checked-out from the landing
  branch onto **`intelligence-launch-acceptance-v1` @ 40bf8cc** (the Codex worktree). Prior landing
  work is safe on origin (`landing-experience-refinement-v1`, f791fc4).
- Codex's interrupted Recall Closure work was present here **uncommitted**: `account-deep-research.ts`,
  `research-quality.ts`, the Track-B positive-control artifact, three touched fixtures, and an untracked
  `docs/intelligence/launch-acceptance-v1/recall-closure-v1/`. `.leadlens/*` were modified runtime
  ledgers (excluded).

## 2. Recovered Codex work (Phase A) — committed `da50667`

Truth-safe recall-quality only; no Fit/Timing/Evidence/Decision/geography/identity/materiality/
provenance/corroboration/threshold change; no benchmark URL injection.

- `account-deep-research.ts`: official-domain current-activity now uses the corporate web index
  (`query_type=company_specific`) instead of Tavily's incomplete news index; counterevidence stays
  news-oriented. `isEventExtractionCandidate` tightened to (change-verb + operating-asset) OR standalone
  material change, excluding quarterly/trading updates and generic non-asset "expansion" (recovers John
  Deere PDC, Mondi Pittsburgh; drops trading-update / self-repair noise).
- `research-quality.ts`: over-conjoined exact-signal query replaced by a bounded official-domain
  operating-change OR-vocabulary (same query count).
- Fixtures updated to lock the above; acceptance artifact refreshed to the measured 7/8 control; Codex
  docs preserved. Runtime ledgers not committed.

## 3. Track B (known-event recall)

- Result: **7/8** captured (Nestlé USA, Conagra, Quad, voestalpine, Hitachi Energy, John Deere, Mondi).
  Miss: UFP South Carolina = `PROVIDER_MISS` (Brave+Tavily returned valid UFP changes but not the frozen
  SC facility source), **not** a truth-gate rejection. 0 false positives, 0 truth hard fails.
- Verification (this session, deterministic): `account-deep-research` 43/43, `research-quality` 65/65,
  `admin-intelligence-command-center` 50/50 (control-plane derives `dynamic_universe_discovery` =
  `soak_validated`, `positive_controls_captured=7`). Canonical artifact:
  `ml/data/acceptance/account-deep-research-positive-control-v1.json`.

## 4. Track A (productive six-context matrix)

- **NOT rerun this session.** Reason: integrity, not capability. The exact frozen matrix is
  `docs/intelligence/launch-acceptance-v1/commercial-contexts.json` (3 families × US/SA = 6 runs), fed
  historically to `accept:customer-intelligence-e2e` per run. The **verbatim per-run context string** is
  not recoverable as a single committed command/harness (the result artifacts record funnel summaries,
  not the exact input text), so a reconstructed rerun could not be certified as the frozen matrix. A
  guessed reconstruction would violate "no context modification" and spend budget on an unsound result.
- Last valid frozen result stands (`post-fix-results.json`): baseline 6 runs → 50 universe / 9 researched
  / 7 portfolio / **9 Hold / 0 opportunities**; post-fix only 3/6 runs completed before Anthropic
  exhausted (19 universe / 5 researched / 3 Hold / 0 opp; 1 internal Validate correctly not admitted).
- USA universe: 2/3 contexts `SYSTEMATICALLY_INCOMPLETE`, 1 `THIN_BUT_DEFENSIBLE`; collapse is
  **before canonical identity** (result→subject→canonical), not provider absence
  (`recall-closure-v1/usa-universe-analysis.json`). All-Hold is honest, not itself a defect; the USA
  universe collapse is the real limitation.

## 5. Anthropic availability (A4) — RESTORED

One lightweight probe: `POST /v1/messages` (max_tokens 1) → **HTTP 200**. Codex's
`credit balance too low` / `OPS_BLOCKED_INCOMPLETE_RERUN` condition is **lifted**. The exact Track A
rerun is now **unblocked** and is the P0 next action (see §8). Credentials present (names only):
ANTHROPIC, TAVILY, BRAVE, SERPER, EXA, FIRECRAWL, SUPABASE.

## 6. Tier implementation matrix (Phase B, current branch — inspected, not from prior reports)

Frozen catalog (`lib/commercial/plan-catalog.ts`, unchanged): Preview $7/2, Brief $25/6,
Intelligence $59/12 (display "Portfolio"; internal id `intelligence_launch_v0`), Premium $129/18.

| Tier | Shared canonical Intelligence core | Tier layer | State |
|---|---|---|---|
| Preview $7/2 | Research/Fit/Timing/Evidence/Decision/Case, entitlement-capped at 2 | — | **PRODUCTION_WIRED** |
| Brief $25/6 | same core, cap 6 | bounded portfolio | **PRODUCTION_WIRED** |
| Intelligence/Portfolio $59/12 | same core, cap 12 | decision distribution, cross-account, Executive Portfolio, exports | **PRODUCTION_WIRED** |
| Premium $129/18 | same core, cap 18 | full Premium V1 capability layer (below) | **PRODUCTION_WIRED** |

All tiers consume the **same** canonical core (`productive-spine.ts`); no per-price truth standard.
Deterministic acceptance green (via `release:check` EXIT=0 + focused reruns): `tier-differentiation`
38/38.

## 7. Premium capability matrix (Phase C) — already implemented + wired

Module `lib/intelligence/premium/` (`premium-context.ts`, `premium-context-researcher.ts`,
`premium-decision-architecture.ts`, `premium-production.ts`), gated by `isPremiumEligible(plan)`, run
**after** finalized canonical Intelligence in `productive-spine.ts` (additive `report._premium_context`,
fail-closed, never delays/corrupts core), rendered in `app/results/[jobId]/brief` + delivery
(`delivery-document.ts`, `tier-composer.ts`, PDF).

| Capability | Typed contract | State |
|---|---|---|
| Commercial Benchmark | `CommercialBenchmarkV1` + live researcher | PRODUCTION_WIRED |
| Competitor / Alternative Context | `CompetitorContextV1` | PRODUCTION_WIRED |
| Advanced Portfolio Synthesis | `AdvancedPortfolioSynthesisV1` + `buildAdvancedSynthesis` | PRODUCTION_WIRED |
| Decision Pathways | `DecisionPathwayV1` + `buildDecisionPathway` | PRODUCTION_WIRED |
| Decision-Critical Briefs | `DecisionCriticalBriefV1` + `selectDecisionCriticalBriefs` (max 5) | PRODUCTION_WIRED |
| Additional Opportunity Discovery | `AdditionalOpportunityV1` (bounded, own validation) | PRODUCTION_WIRED |
| Embedded Ecosystem Intelligence | `EcosystemActorV1` | PRODUCTION_WIRED |
| Contact Rationale | `ContactRationaleV1` + `buildContactRationale` (suppresses when unsupported) | PRODUCTION_WIRED |

Budgets enforced (`PREMIUM_BUDGETS`, `DEFAULT_LIVE_LIMITS`). Deterministic fixtures green:
`premium-context` 25/25, `premium-context-researcher`, `premium-production` 18/18 (incl. fail-closed),
`premium-delivery`, `premium-differentiation` 29/29, `premium-report-contract`, `premium-internal-pdf`,
`premium-pilot-experience` — all part of the green `release:check`.

## 8. Premium LIVE acceptance (Phase F, bounded) — PASS

`scripts/accept-premium-context-live.mts` with `PREMIUM_LIVE_ACCEPT=1` (real Brave/Tavily + real LLM,
one fixed public portfolio, no DB/Lemon/persistence):

- status `present`; benchmark PRESENT; competitors 4; additionalOpportunities 2; ecosystem 4.
- providerCalls 6; llmCalls 1; **COGS $0.0479 / order** (list-price via ledger; << $4 target, far under
  the $8 STOP); latency 58.9s (parallelized).
- **10/10 truth invariants PASS**: every surfaced note/competitor/discovery/ecosystem item is grounded
  to ≥1 real retrieved URL; no stale "current movement"; caps respected; cost not fabricated;
  portfolio ≠ market note present. Zero fabrication. (This validates the contextual layer via the real
  `producePremiumContext` orchestration; a full 18-company productive premium run + standard-vs-premium
  comparison remains the next live step.)

## 9. Truth safety

No new material violation introduced this session. Recall fixes are retrieval-routing/extraction-slot
only. Premium is additive and fail-closed; live run showed 0 fabricated items, all evidence-backed,
portfolio≠market disclosed, no Decision mutation, no cross-tenant surface. `release:check` EXIT=0
(tsc + ~45 suites + build) with all changes applied.

## 10. Readiness (do not inherit from shared core)

- Preview / Brief / Intelligence $59 / Premium $129: **GUIDED_BETA** (per the standing core envelope) —
  code-complete and deterministically + (Premium contextual layer) live-proven, but gated by the core
  USA universe-recall question, not by tier/Premium code.
- Not `SELF_SERVE`: the frozen Track A verdict (all-Hold, USA universe collapse) is unchanged pending the
  now-unblocked exact rerun.

## 11. Next three moves

1. **Run the exact frozen Track A six-context matrix** (Anthropic restored). Requires the verbatim
   per-run context composition Codex used (recover it from the e2e harness invocation / Codex worktree
   history), fed unchanged to `accept:customer-intelligence-e2e` for all 6 runs — no seeds. Compare to
   `baseline-results.json`; decide RECALL_CLOSED vs RECALL_IMPROVED_NOT_CLOSED vs
   RECALL_BLOCKED_BY_PROVIDER_COVERAGE.
2. If USA remains `SYSTEMATICALLY_INCOMPLETE`, target the **result→subject→canonical-identity** stage
   (the measured first collapse) narrowly, then rerun only the affected USA contexts.
3. **Full productive Premium live acceptance**: one 18-company premium run vs the 12-company standard,
   assessing added decision value under a comparable subset (not length), with measured incremental
   runtime + COGS; confirm the ≥300s execution contract is respected (bounded async, not bypassed).

## Canonical artifacts (by path, not duplicated here)

- `docs/intelligence/launch-acceptance-v1/{commercial-contexts,baseline-results,post-fix-results,final-report}.json|md`
- `docs/intelligence/launch-acceptance-v1/recall-closure-v1/{final-report.md,diagnostics.json,usa-universe-analysis.json}`
- `ml/data/acceptance/account-deep-research-positive-control-v1.json`
- `lib/intelligence/premium/*`, `lib/intelligence/productive-spine.ts`, `scripts/accept-premium-context-live.mts`
