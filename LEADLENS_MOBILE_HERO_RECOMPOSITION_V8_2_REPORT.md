# LeadLens — Mobile Hero Recomposition + Above-the-Fold Transformation (V8.2)

Focused mobile hero recomposition. All changes are **mobile-only (≤640px)** via CSS;
desktop, product canvas, product truth, pricing, backend — unchanged. Initial HEAD
`effc0e7`. Verified with real 390/360 screenshots (not geometry alone).

## Diagnosis (on-device reality)

The mobile first impression talked too much before the product: promo banner (2 lines +
CTA) → tall nav (big Get started) → eyebrow → H1 → a **bold duplicate** support line
("And the evidence behind every opportunity.") → the analytical support line → two
**equal full-width** CTA buttons → $7 line → a **large reassurance pill** → only then the
Opportunity Portfolio. Too many promotional layers competing before proof.

## Changes (mobile ≤640 only)

1. **Promo banner** — **hidden on mobile** (`.ll-announce{display:none}`). Removes a
   2-line + CTA promotional block; the hero already carries the proposition. Desktop
   keeps it.
2. **Duplicate bold support line** ("And the evidence behind every opportunity.") —
   **hidden on mobile** (`.ll-hero-h2{display:none}`). Only one support line remains.
   Still renders on desktop (has room).
3. **Reassurance pill** ("No contact databases…") — **hidden on mobile**
   (`.ll-hero-note{display:none}`). The message already lives in the Differentiation
   section ("Databases tell you who exists…"); not duplicated. Desktop keeps the pill.
4. **CTA hierarchy** — from two equal full-width buttons to **one filled primary
   ("Get started", full-width) + a light text link secondary ("View sample →")**.
5. **Nav** — tighter mobile padding + smaller CTA: **78px → 51px**; logo now leads.
6. **Hero padding** — top padding reduced so the product reaches the fold sooner.

## Metrics (390, before → after)

| | Before | After |
|---|---:|---:|
| Banner height | 81px | **0 (hidden)** |
| Nav height | 78px | **51px** |
| Hero support lines | 2 | **1** |
| CTA block height | 125px | **100px** |
| **Product canvas top (document px)** | **659** | **392** |
| Hero text portion (nav→canvas) | ~500px | **~341px (−32%)** |
| 360 total page height | 9,619 | **8,800 (−819)** |

Product now **begins ~267px earlier** (§30 target 600–700 → beaten at 392), and the full
Northstar Brief (What Changed → Supported by → evidence) is visible in the first viewport.

## First / second viewport

- **First viewport (390):** compact nav → eyebrow → H1 → one support line → compact
  primary + "View sample →" text link → small $7 line → **product canvas top**. §35 PASS.
- **Second viewport:** already inside the product proof — no marketing block between. §36 PASS.

## QA

- **Screenshots:** 390 before (banner + big nav + H2 + two huge CTAs + pill, product
  barely peeking) vs after (no banner, tight nav, one support line, one primary + text
  secondary, product at the fold) — the delta is immediately obvious (§73 PASS). 360
  verified (ES): compact nav "Comenzar", no banner, no clipping.
- **Overflow:** 0 horizontal at 1440/1280/1024/768/430/390/375/360.
- **Anchors:** mobile section-start preserved — nav 51px, eyebrows land 95–112 (pricing
  95, sample/how/faq 112), all below the nav (§46).
- **Desktop unchanged (1280):** banner, H2, and reassurance pill all visible; secondary
  CTA still an outline button. All mobile changes are ≤640-scoped.
- **Localization:** ES/PT/JA at 360 — banner + H2 hidden, 0 overflow, product early;
  support line wraps to 2 clean lines. No hardcoded English introduced.
- **Menu / language selector:** intact. **SSR:** H1 + support line present; H2 +
  announcement remain in the DOM (rendered for desktop/crawler, CSS-hidden on mobile).

## Scores (founder-aligned, honest)

| Metric | Before | After |
|---|---:|---:|
| Mobile first impression | 7.3 | 8.8 |
| Mobile premium | 7.2 | 8.8 |
| Hero composition | 7.0 | 8.9 |
| Product desire | 7.8 | 8.8 |
| Product visual (untouched) | 8.7 | 8.7 |

## Tests / Build / Commit

- `test:v7-landing-guards` **49/49** (adds K1–K5: H1 intact, banner/H2/pill hidden on
  mobile only, text-link secondary, single support line). `test:commercial-continuity`
  17/17. `tsc` clean. `rm -rf .next && npm run build` succeeded (142 pages).
- Files: `app/demo-pipeline/page.tsx`, `scripts/fixtures/v7-landing-guards.test.ts`, this
  report. Commit: `feat: recompose LeadLens mobile hero`. **NOT PUSHED** (GitHub Desktop).

## Freeze

- **Remaining P0:** none.
- **Remaining P1:** the pre-existing ES/PT/JA pricing **`planFeatures`** copy drift
  (collapsed "What's included" + a couple of section lines still using older
  "rankeadas/lista…contactar/outreach/scores" framing) — a focused localization
  closeout, out of this sprint's scope.
- **MOBILE HERO FREEZE = YES.** The four visual-acceptance conditions (§103) are all met
  — banner removed, duplicate support removed, CTA hierarchy reduced, product moved
  significantly upward — the before/after delta is obvious on a real 390 render, desktop
  is preserved, and product truth is intact. (Overall mobile freeze stays gated only by
  the separate ES/PT/JA pricing-features localization P1.)
