# LeadLens — V7: Reliability, Sample Clarity, Anchor Precision & Localization

Continuation of the V6 commercial-narrative sprint (visual system frozen). V7 closes
reliability, hero pricing/sample clarity, navigation-anchor precision, localization,
and section economy — no product-canvas / pricing-architecture / backend / price
changes. Initial HEAD `4e0729a`; final = the commit below.

## Reliability

- **Atlas selection crash — root cause & fix.** `WS_ACCOUNTS["Atlas"]` carried
  `evidence: "Developing"`, but `STRENGTH` only defines `Strong/Moderate/Limited`.
  Selecting Atlas ran `FTE` → `STRENGTH["Developing"].color` → read `.color` on
  `undefined` → the whole hero workspace threw. Fixed the data (`Developing → Limited`,
  consistent with Atlas's thin, Observed-only story) **and** hardened `FTE` with a
  fallback so any unknown strength degrades gracefully instead of crashing. Verified:
  selecting Atlas renders the full panel (Fit Moderate / Timing Limited / Evidence
  Limited / clinic-locations change), no console error. All 3 accounts switch cleanly.

## Hero pricing / sample microcopy (§128–135)

- **57. Before:** `From $7 · one-time · no card to explore the sample` — conflated the
  paid entry price with the fact that the public sample is free to view.
- **58. After:** `Paid plans start at $7, one-time · viewing the sample is free — no
  card needed.` (localized es/pt/ja). Two concepts, explicitly separated.
- **59. Sample/paid-entry confusion resolved? YES.** "Paid plans" own the $7; "viewing
  the sample is free" owns sample access. A visitor cannot read the sample as costing
  $7, nor the $7 product as free-until-checkout.
- **60. Redundant hero sample link removed? YES.** The hero had two sample actions —
  the **View sample** button (→ `/sample`) and a **Preview sample report →** underline
  link (→ in-app demo). The underline link (class `ll-hero-demo-link`) and its orphan
  CSS were removed; the hero now has exactly one sample action. The in-app demo remains
  reachable from the Sample section and the demo/form banners.
- **$7 positioning (§131):** preserved as a validation entry — "Paid plans **start
  at** $7" signals a low-risk floor with deeper tiers above; the Preview tier keeps its
  "Low-risk starting point" badge and validation-first copy. Prices unchanged.

## Pricing navigation (§136–150)

- **61. Pricing anchor bug reproduced? YES.** At 1280×800 the nav "Pricing" scroll
  landed the section top at the offset, and the heading block (tag + h2 + 3rem-margin
  subhead = 262px) pushed the 2×2 grid to y=338 — only the **top row** (462px of the
  723px grid) was visible; the second row fell off. Reproduced by measuring the
  post-scroll grid rect.
- **62. Root cause.** Two compounding issues: (a) the scroll target was the section
  top, so all of the heading whitespace sat above the cards; (b) **the sticky nav was
  not actually sticky** — `.ll-root { overflow-x: hidden }` forced `overflow-y: auto`,
  making `.ll-root` a scroll container and silently breaking `position: sticky` (nav
  measured at viewport-top −1458 while scrolled). So a generic `scroll-margin-top`
  could never be tuned reliably (per §139's warning).
- **63. Fix (native, minimal JS — §140 option C).**
  1. `.ll-root { overflow-x: clip }` — clips horizontal overflow **without** creating a
     scroll container, so the sticky nav genuinely pins (verified viewport-top = 0).
  2. A dedicated scroll anchor `<span id="pricing" class="ll-price-anchor">` sits just
     above the grid; both nav-click (`getElementById('pricing').scrollIntoView`) and
     direct `/#pricing` land on it, honoring a tuned `scroll-margin-top` that clears the
     sticky nav and reveals a heading peek + the cards together. Responsive:
     168→**220**px desktop, **210**px ≤820, **250**px ≤580 (mobile heading block is
     taller). The subhead's oversized 3rem bottom margin was tightened to 1.75rem.
  - `id="pricing"` moved from `<section>` to the anchor; the `pricingRef`
    IntersectionObserver (analytics) and the dashboard "back to pricing" both still
    resolve via `getElementById`.
- Acceptance — after clicking **Pricing** (heading below the 70px sticky nav + grid share the viewport):
  - **64. 1440:** heading@72, grid@220, **94%** of the 2×2 visible, 0 overflow.
  - **65. 1280:** heading@72, grid@220, **80%** visible, 0 overflow.
  - **66. 1024:** heading@73, grid@220, **76%** visible, 0 overflow.
  - **67. 390:** heading@87, **first plan 100%** visible, 0 overflow.
  - **68. 360:** heading@87, **first plan 100%** visible, 0 overflow.
  - **69. Direct `/#pricing`:** heading@72, grid@220, 80% visible — identical to the
    click path (native hash honors the anchor's scroll-margin).
- Regression audit of the other nav anchors (§143–146), 1280×800, all land heading +
  content in the useful viewport:
  - **70. How it works:** heading@171, 3-stage flow enters at y=273. Useful.
  - **71. Sample:** heading@171, primary "View full sample" CTA at y=475. Useful.
  - **72. FAQ:** heading@170, first questions immediately below. Useful.

## Section economy & flow (§152–155)

- **How it works heading (§152D/§159F).** `ICP (Ideal Customer Profile) in. Commercial
  intelligence out.` → **From your ideal customer profile to a decision — in three
  steps.** (localized) — no awkward parenthetical, matches the Define→Investigate→Decide
  flow.
- **"What Changed" / curiosity dark band (§152C/§159E).** Kept — its question
  ("What changed in the accounts you're already watching?") is a strong, singular
  transition hook. Compressed: removed the redundant repeated category label (already
  in the hero badge + announcement) and tightened padding 2.5rem→1.75rem.
- **Sample Output hierarchy (§152B/§159D).** Rebuilt to one clear hierarchy: the
  **View full sample** card is now the single primary action; the format-preview and
  $7-report options are demoted to a subtle secondary text row **below** it. Removed the
  redundant gray disclaimer panel (its synthetic-data note already lives in the card),
  and tightened the subhead margin 3rem→1.75rem. Fully localized (was hardcoded
  English). Journey stays coherent: Hero → Sample → Pricing → Get started.
- **Height (§155 bonus):** the economy work reduced 360px page height 10,826 → **10,559**
  (−267) while improving clarity; 0 horizontal overflow at 360/375/390/430/768/1024/1280/1440.

## Localization (§150/§159G)

- The V6 differentiation lede, "case for/against" close, and the "inspect the reasoning"
  proof line were English-only; the differentiation column labels/items were too. All
  converted to copy keys and translated into **es/pt/ja** (`diffLede{pre,emph,post}`,
  `diffOldLabel/Items/Foot`, `diffNewLabel/Items/Foot`, `diffProofBold/Rest`). The
  Sample teaser (text/CTA/note) and the new hero price note are localized as well.
- Anchor IDs are language-independent (`how-it-works/sample/pricing/faq` are static);
  verified stable after switching to Spanish, with the differentiation/how-title/price/
  teaser all rendering localized and the pricing anchor still composing (heading@72,
  72% grid).

## §159H — Hero /sample / real Brief fidelity (assessment)

Assessed, not rebuilt. The hero `AccountWorkspace`, the public `/sample` Account Brief,
and the real authenticated Brief share the same decision-state vocabulary
(Prioritize/Validate/Monitor/Hold) and the same analytical grammar (What Changed →
Supported by → Limited by → Decision + what to validate). The hero/sample are explicitly
labeled illustrative/synthetic. No fidelity drift introduced; deeper visual parity with
the authenticated Brief remains a future (non-blocking) item.

## Scores

- **73. Anchor / section navigation quality:** ~5.5 → **9.2** (sticky nav actually pins;
  Pricing and all nav anchors land on useful compositions; direct hash works).
- **74. Hero commercial clarity (sample vs paid entry):** ~6.5 → **9.2** (two concepts
  explicitly separated; single sample action).

## Verification

- `npm run test:v7-landing-guards` — **18/18** (Atlas strength safety, hero
  single-sample-action, overflow-x:clip, pricing anchor, 4-locale localization, how
  heading). `npm run test:commercial-continuity` — **17/17** (unaffected).
- `npx tsc --noEmit` clean. `rm -rf .next && npm run build` succeeded (142 pages,
  `/sample` statically prerendered).
- Browser QA at 1440/1280/1024/768/430/390/360: 0 horizontal overflow; anchor matrix
  above; Atlas + all 3 accounts switch without crash; Spanish locale verified.
- SSR/crawler spot-check (not a full re-audit per §128): new hero price note, new how
  title, differentiation lede, proof line, "View full sample" all present in server
  HTML; 0 old ICP parenthetical, 0 personal Gmail; corporate email + AOI title present.

## Not changed (guardrails)

Backend, auth, billing, Discovery/providers, product catalog, prices, pricing
architecture, and the frozen visual system (product canvas / rail / evidence / decision
/ navy stage / nav / pricing cards) — all untouched. `.leadlens/*` not committed.

## Commit

`feat: V7 — fix Atlas crash, sample/price clarity, pricing anchor, localization`.
Not pushed (GitHub Desktop).
