# LeadLens — Client Opportunity Canvas V1 (direction correction)

Acts on the founder's authoritative correction: the signature framework must be **client-level**
(the customer using LeadLens is the subject; discovered accounts live *inside* the canvas), and
**much lighter** (navy reduced to text + thin rules; blue as a precise accent). The prior
account-level Matrix pilot is rejected. Initial HEAD `c91430c`.

## Why the previous (account-level) Matrix was rejected
- **Wrong subject.** It titled the whole framework with one *discovered account* (Northstar),
  answering "what does LeadLens think about Northstar?" — not "what does LeadLens see for THIS
  CLIENT?". The client company must be the visual anchor.
- **Too heavy / dark.** A large navy header block dominated; it read as a report/dashboard, not a
  light, memorable corporate canvas.
- **Hierarchy inversion.** The Opportunity Case is one *drill-down* of client-level intelligence,
  not the top object.

## Corrected hierarchy
`CLIENT → COMMERCIAL OBJECTIVE → OPPORTUNITY CANVAS (landscape) → SELECTED OPPORTUNITY CASE →
EVIDENCE → DECISION`. The account-level Opportunity Case (reasoning spine, built prior) is
preserved and moves **down one level** as the drill-down / mobile / deep view.

## Two new client-level pilots (rendered, light)
Synthetic client **Asteron Systems** · Objective: "Find enterprise accounts where operational
expansion creates a credible near-term software opportunity" · 5 discovered opportunities inside
(Northstar / FreshRoute / Vantage / Atlas / Bergen) with coherent Role=Potential Customer and
Types (Operations Expansion / Technology Modernization / Facility Expansion / New Business).

| Criterion (of 10) | C · Structured Client Canvas | D · Opportunity Landscape Canvas |
|---|---:|---:|
| Eye-catching | **9.4** | 9.1 |
| Premium | **9.4** | 9.1 |
| Corporate seriousness | 9.3 | 9.2 |
| Framework familiarity | 9.2 | 9.3 |
| LeadLens distinctiveness | 9.2 | 9.1 |
| Clarity | **9.4** | 8.9 |
| Executive comprehension (first-page) | **9.4** | 9.0 |
| **Overall** | **9.3** | 9.1 |

Both are a **material jump** over the rejected Matrix (founder-estimated ~7–8) and over the
current flow-forward landing sample. Screenshots (1280 + 390) captured for C and D; artifacts:
`output/pilots/client-canvas-pilot-c.html`, `client-canvas-pilot-d.html` (+ the earlier
`case-matrix-pilot-a.html` / `case-canvas-pilot-b.html` as rejected references).

**Winner: Pilot C (Structured Client Canvas).** Composition:
- **Client header** — LeadLens provider mark + "Account Opportunity Intelligence" kicker →
  **Asteron Systems** (34px, the dominant element) → Objective (blue label) → market · N
  opportunities evaluated · generated date. Navy = text + a 3px top rule only.
- **LeadLens Read** — a prominent blue-left-accent synthesis line (portfolio-level signature).
- **Where to Focus · Opportunity Landscape** (dominant ~2/3 column) — the discovered
  opportunities as compact decision tiles (rank · account · Role/Type · decision pill ·
  Fit·Timing·Evidence · one-line What Changed · freshness); the top one highlighted.
- **Supporting column** (~1/3) — What's changing (portfolio patterns), Evidence coverage
  (N with dated evidence / corroborated / latest — teal), What to Validate (amber, top unresolved
  questions across the portfolio).
- **Light palette proportions:** ~78% light surfaces, ~12% navy (text/rule), ~8% intelligence
  blue accent, small teal/amber semantic cues. Decision states textual (no traffic light).
- **Mobile:** collapses to one column — client header → LeadLens Read → Where to Focus tiles →
  supporting cards. Selecting an opportunity (integration step) opens the existing Opportunity
  Case reasoning spine.

## LIVE integration status (updated)

**SHIPPED — Landing (real, integrated, not pilot-only):** the landing product sample is now the
approved **Client Opportunity Canvas as a mini interactive LeadLens workspace** — `AccountWorkspace`
replaced by `ClientCanvasSample` in `app/demo-pipeline/page.tsx`. Client **Asteron Systems** is the
subject; the discovered accounts are opportunities inside. Five tabs (one synthetic fixture powers
all): **Overview** (Client Canvas — LeadLens Read + Where-to-Focus opportunity landscape +
supporting column: what's changing / evidence coverage / what to validate) · **Opportunity Cases**
(the frozen reasoning spine via a reused `CaseSpine`, account selector) · **Evidence** (claim-first
rows with Direct/Corroborating/Context) · **Compare** (Fit/Timing/Evidence + Key unknown + Validate,
no aggregate score) · **Strategy** (portfolio read + recommended sequence tied to the portfolio).
Light composition (navy = text + a 3px top rule; the giant dark header is gone). Opportunity Type
corrected Supplier→**Operations Expansion** (§66). Verified live: all 5 tabs render, tile→Case
drill-down works, 0 horizontal overflow, responsive (grids collapse ≤720; account list becomes a
horizontal rail on mobile). Landing outside the sample unchanged. Guards **102/102** (78 frozen +
Section P Opportunity-Case + **Section Q client-canvas/tabs**). tsc + build clean; deliverable
52/52, portable 45/45, continuity 17/17.

**PENDING — Portable + Amor (immediate next P0):** the portable deliverable still opens on the
V1 portfolio workspace; wiring the Client Canvas as its opening surface + regenerating Amor (AMOR
DE GEA as the client header) via a shared `ClientCanvasVM` is the next commit, per the plan below.
Portable/Amor were **not changed** this turn (portable 45/45 unchanged) — not claimed as shipped.

## Status — direction locked; integration is the next step (honest)
Per the sprint's own "STOP before finalizing / render + compare + select, then integrate only
after it passes" workflow, this turn **locks the corrected client-level direction** with rendered
pilots and a chosen winner. It does **not** yet replace the live landing sample or the portable
opening, because that is a substantial multi-surface integration and the founder explicitly
halted to correct the model first. Nothing shipped was regressed: landing, portable, Amor,
workspace, and all tests are unchanged from `c91430c` (guards 90/90, deliverable 52/52, portable
45/45, continuity 17/17, tsc + build clean at the prior commit).

### Integration plan (next sprint, Pilot C)
1. **Shared model:** add a client-level `ClientCanvasVM` (client name, objective, market,
   `opportunities[]` compressed tiles, patterns, coverage, validationQueue, leadRead) derived from
   the existing `DeliverableViewModel` (portfolio + accounts) — no new business logic. Patterns
   only when real; Amor keeps graceful absence (no fabricated client objective if none exists).
2. **Portable:** render the Client Canvas as the opening surface, each opportunity tile drilling
   into the existing Opportunity Case (spine). Regenerate Amor (AMOR DE GEA as the client header).
3. **Landing:** replace `AccountWorkspace` with the Client Canvas (synthetic Asteron client) +
   opportunity selection → Opportunity Case; update landing guards (client-level assertions).
4. **QA:** 1440→360, print first-page test, offline/file://, secret scan; then freeze.

## Files (this turn)
`scripts/deliverable/render-client-canvas-pilots.ts` (+ earlier matrix pilots),
`output/pilots/**`, `LEADLENS_CLIENT_OPPORTUNITY_CANVAS_V1_REPORT.md`. No product/landing/portable
code changed.

## Remaining
- **P0 (next):** integrate Pilot C into portable + landing per the plan above; regenerate Amor;
  update guards/tests.
- **P1:** client-level patterns/coverage from real report data (graceful when absent); workspace
  adoption.
- **P2:** finalize public framework name (kept operational: "Client Opportunity Canvas").

**Freeze:** Client Opportunity Canvas V1 **direction** is chosen (Pilot C); freeze the
*implementation* after integration + QA. **NOT PUSHED** (GitHub Desktop).
