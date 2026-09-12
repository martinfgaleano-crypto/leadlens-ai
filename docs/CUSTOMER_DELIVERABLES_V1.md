# Customer Deliverables V1 — the one-time tier contract

LeadLens = **Account Opportunity Intelligence**: which accounts deserve attention now, why, on what
evidence, what's uncertain, what to validate next. Same Intelligence truth-quality across every tier —
tiers differ by scope, breadth, comparison, synthesis, contextual intelligence and export, never by
truthfulness.

## Signature LeadLens (recurring in every deliverable)
1. What deserves attention? (Decision: Prioritize / Validate / Monitor / Hold)
2. Why now? · 3. On what evidence? · 4. What's uncertain? · 5. What to validate next?
Portfolio-capable tiers add: 6. How do these compare? · 7. What patterns exist across the set? ·
8. Where should effort concentrate? Premium adds: 9. What broader context changes the decision? ·
10. What could change key decisions? · 11. Which adjacent possibilities are worth investigating?

Canonical dimensions: Fit / Timing / Evidence. Truth doctrine: FACT / SIGNAL / INFERENCE / DECISION /
RECOMMENDED VALIDATION — never collapsed; sources, freshness, counterevidence, unknowns, confidence and
scope are preserved.

## Tiers

### Preview — $7 · 2 accounts · web + PDF
- **Buyer question:** "Show me how LeadLens thinks about two real accounts."
- **Receives:** per account — Decision, one-line why, Fit/Timing/Evidence, the evidence summary + top
  sources, one uncertainty, and the single most important thing to validate next.
- **Different:** small but complete — the full signature at concise depth. Not a crippled Brief.
- **Excludes:** commercial context section, comparison, portfolio synthesis, coverage, methodology, CSV.

### Brief — $25 · 6 accounts · web + PDF
- **Buyer question:** "Give me a focused opportunity brief across a small set."
- **Receives:** full account narrative (thesis, what supports/needs confirming), commercial context,
  What-Changed where dated, a validation queue, and evidence coverage.
- **Different from Preview:** the full account narrative + commercial context + validation queue +
  coverage.
- **Excludes:** allocation, side-by-side Compare, methodology, portfolio benchmark, Premium context, CSV.

### Portfolio — $59 · 12 accounts · web + PDF + CSV
- **Buyer question:** "Show me where commercial effort should go across this portfolio."
- **Receives:** everything in Brief + ranked prioritization/allocation, side-by-side Compare, portfolio
  distribution + patterns ("observed within this researched portfolio — not the whole market"),
  methodology, full account depth, and a structured CSV export.
- **Different from Brief:** the portfolio-level narrative (allocation, Compare, patterns, methodology) +
  CSV.
- **Excludes:** the Premium decision-context architecture (benchmark / alternatives / pathways / briefs
  / discovery / ecosystem).

### Premium — $129 · 18 accounts · web + PDF + CSV
- **Buyer question:** "Give me the most comprehensive one-time LeadLens decision package."
- **Receives:** everything in Portfolio + the **Decision context** layer: Advanced Portfolio Synthesis,
  Commercial Benchmark, relevant Competitor/Alternative context, up-to-5 Decision-Critical Briefs with
  conditional Decision Pathways ("what could change this decision"), bounded Additional Opportunity
  Discovery and Ecosystem routes — each present only where defensible evidence exists (fail-closed).
- **Different from Portfolio:** the decision-context architecture (real added decision utility, not more
  companies).
- **Excludes:** market research / TAM-SAM-SOM / full competitor mapping / lead lists / outreach.

## Deliverable comparison (implementation truth)
| Dimension | Preview | Brief | Portfolio | Premium |
|---|---|---|---|---|
| Accounts | 2 | 6 | 12 | 18 |
| Decision + Fit/Timing/Evidence | ✓ | ✓ | ✓ | ✓ |
| Evidence + sources | ✓ (top) | ✓ | ✓ | ✓ |
| Uncertainty + validate-next | ✓ (bounded) | ✓ | ✓ | ✓ |
| Full account narrative (thesis) | — | ✓ | ✓ | ✓ |
| Commercial context | — | ✓ | ✓ | ✓ |
| What Changed (when dated) | — | ✓ | ✓ | ✓ |
| Validation queue | — | ✓ | ✓ | ✓ |
| Allocation / where effort goes | — | — | ✓ | ✓ |
| Side-by-side Compare | — | — | ✓ | ✓ |
| Portfolio patterns + methodology | — | — | ✓ | ✓ |
| Decision-context architecture | — | — | — | ✓ |
| Commercial benchmark / alternatives | — | — | — | ✓ (where supported) |
| Decision-critical briefs / pathways | — | — | — | ✓ |
| Additional discovery / ecosystem | — | — | — | ✓ (where supported) |
| Web | ✓ | ✓ | ✓ | ✓ |
| PDF | ✓ | ✓ | ✓ | ✓ |
| CSV | — | — | ✓ | ✓ |

Presentation consumes the persisted immutable snapshot: opening web, exporting PDF/CSV, and refreshing
trigger **zero research and zero credit**. Tier is server-resolved; it cannot be elevated client-side.
See [PREMIUM_DIFFERENTIATION_V1.md](PREMIUM_DIFFERENTIATION_V1.md) for the Premium context internals.
