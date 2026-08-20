# LeadLens — Opportunity Case Landing Adoption V1

The public landing product sample now renders a compressed sibling of the **frozen** Opportunity
Case grammar (same palette, decision states, reasoning-spine identity) — replacing the older,
simpler sample that undersold the product. Everything outside the sample stays frozen. Secondary:
audited the pipeline for Role/Type/Value/Feasibility and emitted **only what is honest** (nothing
fabricated). Initial HEAD `058a39b`.

## Landing sample — before → after (same viewport)

**Before:** a spine of `What changed → Supported by (ladder + full 3-source table) → Limited by →
Decision`, no Opportunity Thesis, no Why-It-Matters-Now, no Account Role / Opportunity Type.

**After (live):** the compressed Opportunity Case —
`POTENTIAL CUSTOMER · SUPPLIER EXPANSION` → **Northstar Logistics** + **Prioritize** → Opportunity
Thesis → Fit/Timing/Evidence → spine **What Changed → Why It Matters Now → Evidence (Strong ·
Corroborated · 3 sources · latest 9d + Observed→Confirmed→Corroborated ladder + primary source +
"+2 more sources in the full Opportunity Case") → What to Validate (Decision-critical + Still
unknown) → Decision**. Interactive: selecting Northstar / FreshRoute / Atlas swaps the Case.

Screenshots captured (dev, 1280 + 390): old sample, new desktop sample, new mobile sample.

| Dimension | Old sample | New sample |
|---|---:|---:|
| Clarity (desktop) | 8.6 | **9.3** |
| Friendliness (desktop) | 9.0 | **9.2** |
| Premium (desktop) | 8.4 | **9.4** |
| **Product depth** (desktop) | 7.6 | **9.4** |
| Clarity (mobile) | 8.4 | **9.2** |
| Product depth (mobile) | 7.4 | **9.3** |
| **Overall** | 8.3 | **9.3** |

Product-depth improvement is obvious (Role/Type + Thesis + Why-It-Matters-Now + compressed
Evidence + Decision-critical validation are all new); friendliness held ≥9.0; mobile passes; the
sample is not heavier or overwhelming (canvas grew modestly, hero unchanged).

## Same visual grammar as the portable? — YES
The landing sample and the portable deliverable now share: palette, decision-state tokens,
Fit/Timing/Evidence, What-Changed accent node, evidence ladder + relation colors, Decision-critical
validation, and the **reasoning-spine identity**. A screenshot of either is recognizably the same
system.

## Landing outside the sample — UNCHANGED
Hero, headline, support copy, nav, pricing, How It Works, transition band, differentiation, FAQ,
footer, legal — untouched. The only change is the product-sample component (`AccountWorkspace` +
its `WS_ACCOUNTS` data) inside the hero. Landing guards **90/90** (78 prior + 12 new Opportunity
Case guards; none of the prior guards weakened).

## Guards
- **Added (P1–P12):** sample carries role/type/thesis/whyNow; renders the spine grammar labels
  (What Changed / Why It Matters Now / Evidence / What to Validate / Decision); Role·Type kicker;
  Opportunity Thesis; Why-It-Matters-Now; Decision-critical + Still-unknown validation; compressed
  evidence ("+N more in the full Opportunity Case"); Fit/Timing/Evidence preserved; exactly one
  Prioritize/Validate/Monitor; wedge = Potential Customer only; **no aggregate score**; **no
  HOT/WARM/COLD / buying-intent** (scoped to the sample region, since dead/unrendered Viz code
  elsewhere legitimately contains those tokens).
- **Preserved:** all locked copy, pricing, hero, legal, brand naming, no-score, page architecture.

## Secondary — pipeline field truth matrix (no fabrication)

| Field | Current source | Availability | Deterministic? | Safe to expose? | Decision |
|---|---|---|---|---|---|
| Account Role | report `market_landscape.accounts[].role` is a *visibility* label ("known_reference"…), not a commercial role | not a commercial role | no | no | **omit** (view model `accountRole` stays null; sample uses synthetic "Potential Customer") |
| Opportunity Type | none structured/customer-facing in the institutional report | absent | no | no | **omit** (`opportunityType` null) |
| Potential Value | not evaluated as a qualitative dimension; only internal confidence scores | absent | no | no | **omit** — never a placeholder score |
| Feasibility | `client_feasibility` (FitState) exists in the deep synthesis layer (`account-opportunity-synthesis.ts`), mostly "insufficient_evidence"; NOT in the deliverable's report path | synthesis-only | partial | not as-is | **omit** from deliverable; wiring it in is a pipeline task |

View model already carries `accountRole`/`opportunityType` as **nullable** (added last sprint);
adapters leave them null; the synthetic landing sample sets them explicitly (allowed). Amor
regenerated — **no Role/Type/Value/Feasibility leak** (verified). No historical data backfilled.

## Amor de Gea (regenerated, honest)
`output/deliverables/amor-de-gea/2026-08-03/LeadLens_Opportunity_Portfolio_Amor_de_Gea_2026-08-03.html`
— 97.0 KB, 10 accounts, ES, pilot data unmodified, **no fabricated fields**, secret-scan clean,
offline/file:// intact. Portable grammar unchanged (frozen). Admin `/admin/deliverables`
preview/download preserved.

## QA / tests
- Landing: 0 horizontal overflow at 1280 & 390; account switching reload-free (verified); the
  full Case (role/type, thesis, why-now, evidence, validate, decision) renders on desktop **and**
  mobile (same `AccountWorkspace`, rail ↔ chips). Touch targets ≥44px; keyboard arrow-nav
  preserved.
- `test:v7-landing-guards` **90/90**, `test:deliverable` 52/52, `test:portable` 45/45,
  `test:commercial-continuity` 17/17. `tsc` clean. `npm run build` clean.

## Files
`app/demo-pipeline/page.tsx` (WS_ACCOUNTS data + AccountWorkspace sample only),
`scripts/fixtures/v7-landing-guards.test.ts` (Section P), `LEADLENS_VISUAL_SYSTEM_V1.md` (Landing
Compression), regenerated `output/deliverables/**`, this report.

## Remaining
- **P0:** none.
- **P1:** emit Account Role / Opportunity Type / Feasibility from the pipeline (then they flow to
  the deliverable Case automatically); adopt the Case grammar in the authenticated workspace via
  shared primitives.
- **P2:** localize the landing sample content (currently English illustrative); Living Case view.

**NOT PUSHED** (GitHub Desktop) — founder handoff.
