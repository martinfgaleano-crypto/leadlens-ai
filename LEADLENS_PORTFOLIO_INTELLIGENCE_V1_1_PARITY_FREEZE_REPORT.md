# LeadLens — Portfolio Intelligence V1.1 · Surface Parity + Localization + Freeze

**From:** `3fe35b0` · **Date:** 2026-08-22

> **Bottom line:** Portfolio Intelligence is now a coherent product surface across all three surfaces. It is wired into the authenticated Workspace (real `PortfolioIntelligenceVM`, no UI synthesis), fully localized (Spanish customer prose, English for English deliverables), with canonical locale-independent keys so the memory diff is unaffected. A compact Overview preview invites the fifth tab. Rich (Asteron) stays deep; sparse (Amor) stays honest and now reads as clean Spanish. Tests + build green. **Portfolio Intelligence V1 is frozen.**

## 1. Initial state
HEAD `3fe35b0`. Audit found: portable had the real PI fifth tab; the **Workspace** still rendered a V0 PI tab from `toClientCanvasVM` (empty patterns); synthesized prose was English-only; landing already displayed "Portfolio Intelligence" as its fifth-tab label.

## 2. Workspace integration
`PortfolioIntelligenceTab` rewritten to consume `buildPortfolioIntelligence(vm)` — presentation only, no detection in React (§66). Renders Read, Where to Focus (+ differentiators), Opportunity Patterns, What Is Changing, Evidence Coverage, Validation Themes, Portfolio Tensions, Recommended Direction, Coverage Gaps — each section gated by data availability, empty ones omitted (§9/§65). Supporting accounts render as chips that navigate to the Case (`onOpen`, §67-70). Data source: the already-authorized `DeliverableViewModel` the Workspace already holds — no new fetch, no raw `report_json`, no report re-assembly, auth/ownership untouched (§5-6).

## 3. Canonical tab ontology
Five primary tabs converge across surfaces: **Overview · Opportunity Cases · Evidence · Compare · Portfolio Intelligence**. Downloads/Methodology/How-to-read remain secondary utilities (`<details>`/utility bar), never primary tabs (§3/§80).

## 4. Overview PI preview
The Workspace Overview now shows a compact preview card (§13-16): one cross-account signal (strongest change/opportunity pattern), one coverage statement, one tension-or-theme, and an **Explore Portfolio Intelligence →** button that switches to the fifth tab. Verified rendering: "1 of 3 opportunities have a verified recent material development · Explore Portfolio Intelligence →". Depth stays in the tab; Canvas not overloaded (§17/§63).

## 5. Localization
Synthesized prose now follows `vm.meta.language` via a single structured message layer (§32) — labels, Read, differentiators, pattern/theme summaries, coverage statements, gap text, tension meaning, guidance kind + statements. Spanish uses clear institutional wording (§29), not literal translation. Company names / source titles are never translated (§27). ES validation-theme normalization added (Spanish keywords in the canonical classifier, §30). **Amor (Spanish) PI: 0 English fragments** (was mixed-language). Change-theme and validation-theme keys are canonical/locale-independent; only display labels localize.

## 6. Asteron rich-evidence QA
Preserved: 4 opportunity-type patterns, 2 real change patterns (acquisition/integration, DC), Saia + GXO tensions (both sides intact), guidance (Focus/Validate/Sequence/Monitor), 8/12 verified change, 7/12 corroborated. No evidence mutated; no provider calls.

## 7. Amor sparse-evidence QA
Preserved and honest: 0 verified change, 0 change patterns, 0 tensions; validation-first guidance; coverage gaps (no verified change / limited footprint). Read (Spanish): "10 de 10 no tienen un cambio reciente verificado… es un límite de cobertura, no un juicio de calidad." No new research, no provider calls, evidence unchanged (§40/§53/§111).

## 8. Landing / Portable / Workspace parity
Same client-as-subject hierarchy, same five tabs, same Decision states, same Fit/Timing/Evidence semantics, same Case grammar, same Evidence semantics, same Portfolio Intelligence semantics. Densities differ (landing compressed, portable handoff, workspace interactive) — ontology identical (§23-24). Landing outside the sample untouched (guards 102/102).

## 9. Mobile
Workspace PI on 375px: single-column, cards stack in order (Read → Focus → Coverage → Direction), tab rail scrolls, no page overflow. Amor portable PI mobile verified likewise.

## 10. Memory diff regression
`diffPortfolioIntelligence` now diffs on **canonical keys** (not display copy). Tests prove: change-pattern keys identical across en/es; display labels differ; cross-locale diff shows zero spurious churn; decision/coverage/validation-resolved detection intact.

## 11. Tests
`portfolio-intelligence` **36/36** (incl. localization, locale-independent keys, memory diff); `tavily-date-contract` 9/9; `product-truth-parity-repair` 21/21 (assertion #12 updated from V0-stub to V1.1 honest-coverage); regression portable 55, deliverable 60, landing 102, temporal 55, counterevidence 30, evidence-complete 36, amor-content ok. tsc clean; **production build green**. Secret scan clean. **Provider calls this sprint: 0** (Tavily date fix validated in the prior sprint; no research run).

## 12. Remaining P0/P1/P2
- **P0:** none.
- **P1:** none material to Portfolio Intelligence.
- **P2:** (a) optional LLM prose-normalization layer (deterministic stands alone, §33); (b) landing sample content could adopt more of the PI section vocabulary verbatim (concepts already map); (c) **pre-existing, unrelated:** `pilot-workspace` test #29 asserts a "reporte final … deshabilitado" string absent from `app/admin/intelligence/pilots/*` — fails at clean `3fe35b0` too (confirmed via stash), not touched by this sprint; belongs to an admin-page cleanup, not PI.

## 13. Freeze verdict
All acceptance criteria met: workspace gets real PI from the domain VM without UI synthesis or auth changes; five-tab ontology converges; downloads/methodology secondary; landing uses PI ontology and stays frozen; portable functional; Asteron deep; Amor honest; Spanish coherent with no mixed-language contamination; canonical IDs locale-independent; Overview preview compact; PI discoverable on mobile; supporting accounts inspectable; no market/conversion/revenue claims; no new research; memory diff valid; tests + build pass; no P0. **Portfolio Intelligence V1 is FROZEN** — future changes require real customer evidence, memory integration, new capability, or a production defect (§112).

## 14. Account Memory readiness
The layer is memory-ready: immutable, canonical-keyed snapshots + `diffPortfolioIntelligence` already classify new / persisting / strengthened / weakened / resolved across a simulated second snapshot. The next sprint — **Account Memory / Living Opportunity Cases V1** — can persist per-review PI snapshots and surface "what changed across the portfolio since last review" without a parallel memory system.
