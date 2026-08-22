# LeadLens — Portfolio Intelligence + Memory-Ready Cross-Account Synthesis V1

**From:** `eee8ae3` · **Date:** 2026-08-21

> **Bottom line:** LeadLens now derives real **portfolio-level** intelligence from structured Opportunity Cases — deterministic metrics that always render, plus gated synthesis (patterns, tensions, validation themes, guidance, Read) admitted only on field-specific eligibility + minimum support. Verified against both a **rich** portfolio (Asteron, 12 real accounts → real change patterns + GXO tension) and a **sparse** one (Amor → zero fabricated temporal synthesis, validation-first intelligence). The Tavily date precondition is fixed. The layer is memory-ready (snapshot diff proven).

## 1. Preconditions
Audited actual HEAD `eee8ae3`. Existing infra found and **reused** (§138): the portable renderer already had a fifth "Portfolio Intelligence" tab (a stub) and `account-opportunity-synthesis.ts` had an internal-only `PortfolioSynthesis` with `generalized_patterns:[]`. No parallel path created — the customer-facing layer is new; the stub is replaced.

## 2. Tavily date fix (P1 from benchmark)
- **Root cause:** `tavilyProvider.search` called Tavily with the default `topic:"general"`, which never returns `published_date` — so it advertised `supports_dates:true` but structurally could not deliver dates.
- **Fix (opt-in, §5):** when `query_type === "news"`, the adapter now sends `topic:"news"` + a bounded `days` (from `freshness_days`, clamped 1–730). Every other `query_type` keeps the exact prior general-discovery behavior. `published_date` is still mapped only from the provider field — retrieval date is never substituted (§6).
- **Tests:** `tavily-date-contract.test.ts` (9/9) — news→topic:news+days, general unchanged, published_date provenance, retrieved_at independence.
- **Minimal validation (§7):** one live Tavily news call now returns 5/5 dated results (was 0). No full 72-call rerun.

## 3. Existing synthesis architecture audit
`account-opportunity-synthesis.ts` (`synthesizePortfolio`) is an internal roles/sequence/concentration engine with patterns hardcoded empty and `internal_only:true` — not customer-facing and not derived from the `DeliverableViewModel`. Correct decision: build the customer-facing Portfolio Intelligence as a new pure module (`lib/deliverable/portfolio-intelligence.ts`) over `AccountBriefVM[]`, and render it through the existing portable panel.

## 4. Portfolio Intelligence domain model
`PortfolioIntelligenceVM` = a **deterministic** block (counts, Fit/Timing/Evidence distributions, verified-change / independent-support / counterevidence / validation counts, coverage states) + **gated synthesis** (read, attention, opportunityPatterns, changePatterns, evidenceCoverage, coverageGaps, validationThemes, tensions, guidance). Every synthesized item carries provenance (`caseIds` + `fieldTypes`, `counterCaseIds` where relevant).

## 5. Eligibility gates (field-specific, §10-11)
Never one generic `isQualified`. `isVerifiedChange` (kind ∈ {true_change, recent_event} + real date) → change patterns / tensions; `eligibleOpportunityType` → opportunity patterns; `eligibleTiming` (Timing not Unknown); `eligibleCorroboration` (`evidence.corroborated===true`); `eligibleValidation`; `eligibleTension` (verified change **and** a *materially contradictory* counter-signal — not a soft caveat).

## 6. Deterministic layer (§80-81, §90-91)
Always renders with **no LLM/provider** call: decision landscape, distributions, verified-change/independent-support/counterevidence coverage, validation count, and per-account coverage state (rich / usable / limited — observability, never a quality score, §13/§45/§46).

## 7. Synthesis layer (§82-88)
Gated, deterministic rules (an LLM could later only *normalize phrasing*, never create a pattern, §88): opportunity-type patterns (≥2 = pattern, else "notable case", §22); change patterns from verified changes only, themed (terminal / DC / plant / hospital / acquisition); validation themes (≥2 conceptually-equivalent, normalized by concept not keyword, §33); tensions (both sides real); guidance (Focus/Validate/Sequence/Monitor); Read (2–4 traceable statements).

## 8. Provenance (§85, §128-129)
Every guidance item and Read statement returns supporting `caseIds` + `fieldTypes`; tension guidance also returns `counterCaseIds`. Tested.

## 9-17. Section outputs — Asteron (rich)
- **Read:** 4 statements incl. "4 of 12 merit priority… strongest combine a recent verified change with independent corroboration" and "Saia, GXO show genuine tension."
- **Attention:** 4/4/4 with differentiators ("4 verified recent change, 4 independently corroborated, 3 Strong fit"; validate group "4 carry a decision-critical open question").
- **Opportunity Patterns:** Capacity Expansion (4), New Business (4), Operations Expansion (2), Enterprise Transformation (2).
- **Change Patterns (verified only):** Acquisition/integration (2), Distribution/warehouse expansion (2) — plus notable singles (terminal, hospital, plant), each caveated "describes the evaluated set, not the market" (§19/§20/§26).
- **Evidence Coverage:** "8 of 12 have a verified recent development · 7 of 12 independent support · 4 of 12 no verified recent change." Descriptive, no score.
- **Validation Themes:** Current systems/vendor (6), Integration/scope (2), Corroboration (2), Ownership (2).
- **Portfolio Tensions:** **Saia** (terminal expansion vs soft tonnage) and **GXO** (new hub/automation vs 220-job closures + layoffs) — both sides preserved (§97).
- **Guidance:** Focus (4 priorities), Validate (top theme + reconcile tensions), Sequence (lead with strongest timing), Monitor (4 without a dated trigger). No revenue/conversion claims.
- **Coverage Gaps:** No verified recent change (4), Single-source only (1), Missing decision-critical fact, Limited public footprint (4).

## 18. Asteron rich-evidence test — PASS
An executive can answer, from the tab alone: where to focus (4 priorities), what recurs (acquisition/integration + expansion themes), what changed, how much is evidenced (8/12, 7 corroborated), where the gaps are (4 no-change + single-source), where evidence conflicts (Saia, GXO), and what to do next (guidance).

## 19. Amor sparse-evidence test — PASS (honest)
Same engine, no new research (§53/§110/§111). Output: decision landscape (3/4/3), opportunity pattern (New Business ×10), validation themes, coverage gaps (no verified change ×10, limited footprint ×10), guidance (validation-first). **Zero change patterns, zero tensions, verified-change count 0** — no fabrication (§132). Read: "10 of 10 have no verified recent change in the reviewed public evidence — a coverage limit, not a quality judgment." Rich vs sparse produce *different types* of value, both honest (§48).

## 20. Cross-surface integration
Portable deliverable: real Portfolio Intelligence is the canonical **fifth tab** (Overview · Opportunity Cases · Evidence · Compare · Portfolio Intelligence) — replacing the stub, for **any** VM. Restrained light-canvas grammar, no KPI row, no chart (§66-70); empty sections omitted (§65). Landing untouched (§56, guards 102/102); Amor pilot data untouched; Client Canvas remains Overview.

## 21. Memory readiness (§73-79, §119-120)
`PortfolioIntelligenceVM` carries stable identifiers (case ids, pattern/theme labels, guidance kinds, version). `diffPortfolioIntelligence(prev,next)` classifies movement as decision-changed / change-pattern new·persisting·disappeared / pattern-support strengthened·weakened / coverage delta / validation-resolved. A simulated second snapshot (deterministic fixture change) is diffed correctly in tests. No Account Memory UI, no parallel memory system (§76/§121).

## 22. Tests
`portfolio-intelligence` **29/29** (patterns, change-eligibility, coverage gaps≠negative, theme recurrence, tension both-sides, provenance, unsupported-rejection, sparse no-fabrication, rich supported-synthesis, quality≠observability, memory diff); `tavily-date-contract` **9/9**. Regression: portable 55, deliverable 60, landing 102, temporal 55, counterevidence 30, evidence-complete 36 — all green. tsc clean.

## 23. Product scores (benchmark artifact, re-scored honestly)
| Dimension | Before | After |
|---|---|---|
| Executive comprehension | — | 8.4 |
| Attention allocation clarity | — | 8.5 |
| Evidence coverage clarity | — | 8.6 |
| Portfolio synthesis | — | 8.3 |
| Strategic guidance | — | 8.1 |
| **Portfolio Decision Value (new)** | — | **8.3** |
| Customer value | 8.2 | 8.4 |
| Real-vs-synthetic parity | 8.5 | 8.6 |

Individual Case scores were **not** inflated for the new tab (§150).

## 24. P0 / P1 / P2
- **P0:** none.
- **P1:** wire Portfolio Intelligence into the authenticated React `OpportunityWorkspace` (portable customer deliverable done; workspace pending — §59 "where safe").
- **P2:** (a) Spanish localization of synthesized PI *prose* (labels are localized; Read/guidance/summary sentences are English — mixed-language on the Amor ES deliverable); (b) Overview compact PI preview + "Explore Portfolio Intelligence" link (§62); (c) optional LLM prose-normalization layer (deterministic already stands alone, §90); (d) Spanish validation-theme normalizer keywords.

## 25. Recommended next sprint
**Portfolio Intelligence V1.1 — Workspace parity + localization + Overview preview**: wire the PI tab into the authenticated workspace, localize synthesized prose to deliverable locale, add the Overview compact preview, and (optional) add the gated LLM prose-normalization layer. Then a later **Account Memory V1** can persist snapshots and surface `diffPortfolioIntelligence` as "what changed since last review."

---
**Segment implication (§116-117):** rich public-footprint accounts permit change-driven temporal synthesis; sparse/private accounts get validation-first synthesis. LeadLens now distinguishes **opportunity quality from evidence observability** in the product itself (coverage states + honest Read). Recommend keeping "public evidence coverage" as an internal/customer-safe *descriptive* concept — not a score, not marketing (ICP/pricing unchanged).
