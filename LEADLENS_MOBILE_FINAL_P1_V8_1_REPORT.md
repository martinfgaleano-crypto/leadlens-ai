# LeadLens — Mobile Final P1: Hero Precision + Mobile Pricing Compression (V8.1)

Precision sprint on the two remaining mobile-freeze blockers. Initial HEAD `1b717a9`.
No broad redesign; product truth / positioning / prices / backend unchanged.

## Hero supporting copy

- **Before:** `Your team can't work every account. LeadLens shows which ones deserve
  attention now — and the evidence behind the decision.` (3 lines on mobile; began with
  a limitation; "work every account" awkward; generic-SaaS phrasing).
- **Candidates evaluated:** A `Turn market evidence into clearer account decisions.`;
  B `…into better account decisions.`; C `…into evidence-backed account decisions.`;
  D `…into a clearer view of where to focus.`; E `…into clearer decisions about where
  to focus.`
- **Scoring:** A wins on professionalism/premium/product-truth. B "better" is vaguer
  than "clearer." C "evidence-backed" duplicates "market evidence." D/E add length and
  echo the H1's "where to focus." "clearer" (not "perfect/guaranteed/right") avoids
  overclaiming (§11); "market evidence" reads as account changes + sources +
  corroboration, not macro research (§12).
- **Selected:** **A — "Turn market evidence into clearer account decisions."** (founder
  lead candidate; genuinely the strongest). Localized es/pt/ja.
- **Render:** fits **one line at 390** (2 at 360), controlled on 1440/1280; complements
  the H1 (promise → analytical value) and reads as serious commercial intelligence.
  Because it's shorter, the product proof sits higher in the first viewport (§17).

## Mobile pricing compaction

- **Problem:** four rich cards stacked = a long, centered, "marketing-card" scroll.
- **Compositions considered:** (A) compact stacked cards; (B) compact + expanded
  recommended tier; (C) tier-strip header + detail. Chose **A** — cards already use
  progressive disclosure (features collapsed), so tightening + a scannable left-aligned
  hierarchy is the lowest-risk, most premium win; B/C risk hiding info or comparison.
- **Implemented (mobile ≤560 only; desktop untouched):** card padding 2rem→1.25rem,
  price 2.4rem→2rem, grid gap 1.25rem→0.85rem, tighter head/CTA/details spacing, and
  **left-aligned** card content (name → price → purpose → tier differentiator → CTA →
  "What's included") — a professional pricing table instead of centered marketing.
- **Result (390):** pricing grid **1,460 → 1,252 (−14%)**. At 360: **1,500 → 1,314
  (−12.4%)**. Key purchase info (name/price/purpose/differentiator/CTA) stays visible;
  Premium's "guided pilot only" qualifier retained; features still in "What's included."
- **Recommended tier:** Intelligence keeps its RECOMMENDED badge + featured surface
  (restrained). Preview stays a validation entry, not visually dominant.

## Localized pricing-desc fix (found while compacting, §60)

The ES/PT/JA `planDescs` carried **stale older-framing copy** diverging from EN — "lista
ranqueada… contactar… scores/スコア/リスト" (contradicts the AOI positioning, §2/§87) and
the ES/PT/JA Preview desc even said "no payment required" for the **paid $7** tier.
Realigned all three locales' `planDescs` to the clean EN AOI semantics (validate /
focused set / prioritize effort / strategy). **Note:** a broader ES/PT drift remains in
the *collapsed* `planFeatures` and a couple of other section lines ("rankeadas", a gap
line with "contactar", `resultsUpgradeSub` "scores/outreach") — flagged as P1; out of
this precision sprint's scope.

## QA

- **Overflow:** 0 horizontal at 1440/1280/1024/768/430/390/375/360.
- **Desktop pricing unchanged:** card padding 32px, centered, price 2.4rem at 1280 (mobile
  overrides are ≤560 only). Desktop hero support line short but controlled.
- **Mobile pricing anchor preserved:** tap Pricing → eyebrow@72 (under nav) → title →
  first card visible (§44).
- **360 total page height:** **9,825 → 9,619** (−206; hero −~60, pricing −~150).
- **Localization:** heroSub localized 4 locales; 0 overflow at 360 in ES/PT/JA; pricing
  left-aligned in all locales.
- **Product truth (SSR):** new hero copy present, old removed; $7/$25/$59/$129 all
  present; 0 HOT/WARM/COLD / lead-scoring / buying-intent.

## Scores (honest, mobile)

| Metric | Before | After |
|---|---:|---:|
| Hero copy professionalism | ~7.5 | 8.9 |
| Hero clarity | ~8.4 | 8.8 |
| Hero premium tone | ~7.8 | 8.9 |
| Mobile pricing scan | ~8.0 | 8.7 |
| Mobile pricing premium | ~7.8 | 8.6 |
| Mobile pricing density | ~7.5 | 8.6 |
| Mobile conversion readiness | ~8.6 | 8.7 |
| Mobile overall | ~8.7 | 8.8 |

## Tests / Build / Commit

- `test:v7-landing-guards` **44/44** (adds J1–J6: hero phrase, prices/tiers intact,
  mobile-only compaction). `test:commercial-continuity` 17/17. `tsc` clean. `rm -rf
  .next && npm run build` succeeded (142 pages).
- Files: `app/demo-pipeline/page.tsx`, `scripts/fixtures/v7-landing-guards.test.ts`, this
  report. Commit: `feat: refine mobile hero and pricing`. **NOT PUSHED** (GitHub Desktop).

## Freeze

- **Remaining P0:** none.
- **Remaining P1:** broader ES/PT/JA pricing-copy drift (collapsed `planFeatures` + a few
  section lines still using older "rankeadas/lista…contactar/outreach/scores" framing) —
  needs a focused localization audit; optional deeper pricing card-system restyle.
- **MOBILE FREEZE = PROVISIONAL.** The two sprint P1s are solved — the hero support line
  is now genuinely professional/analytical, and mobile pricing is materially more compact
  (−14%) and reads as a premium pricing table — and the visible pricing-desc localization
  errors (incl. the "$7 no payment required" bug) are fixed. Held at **PROVISIONAL** (not
  YES) only because §90's "localization clean" isn't fully met: a broader ES/PT/JA
  pricing-copy drift remains in the collapsed features and a couple of section lines. The
  mobile visual experience itself is freeze-ready.
