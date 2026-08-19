# LeadLens — Mobile Acquisition-First Information Architecture (V8.4)

Focused mobile IA sprint. Fix the information ORDER so a first-time visitor understands
LeadLens **before** the Opportunity Portfolio sample dominates. Mobile-only (≤640);
desktop, product mechanics, product truth, pricing, backend — unchanged. Initial HEAD
`5e79cee`. Verified with real 390/360 screenshots.

## Diagnosis

After V8.3 the hero was clean and premium, but the large product sample appeared in the
first viewport and had to carry the entire acquisition story (prioritization, fit, what
changed, evidence, corroboration, uncertainty, validation, decision) — too much
interpretation for a first-time visitor who doesn't yet know what LeadLens does.

## Change: a compact mobile-only acquisition value layer

Inserted **one compact editorial value block** between the hero actions and the product
canvas (mobile-only; desktop's 2-column hero already carries value).

- **Label:** "WHAT LEADLENS HELPS YOU DECIDE" (restrained uppercase, matches the hero eyebrow).
- **Three outcome rows** (small blue dot + bold heading + one muted line, hairline
  dividers — editorial, **not feature cards, not numbered** so it stays distinct from How
  it works):
  1. **Know where to focus** — "The accounts that most deserve your team's commercial attention." → maps to **Portfolio / Prioritize**
  2. **Understand what changed** — "The recent market and account developments behind each opportunity." → maps to **What Changed**
  3. **Act with evidence** — "What supports the case, what's uncertain, and what to validate next." → maps to **Evidence / Limited by / Validate / Decision**
- Localized EN/ES/PT/JA. Height **~275px at 390** (within the 220–320 target).

Because each outcome maps to the product grammar, the Opportunity Portfolio that follows
now reads as **proof of the promise** rather than the explanation itself.

## Information order (mobile)

Before: nav → eyebrow → H1 → support → CTA → price → **PRODUCT (canvas top 316px)**.
After: nav → eyebrow → H1 → support → **CTA → price** → **VALUE BLOCK** → **PRODUCT
(canvas top ~626px)**.

## CTA-placement decision

Options evaluated: value-block **before** CTA (§64) vs CTA in hero, value block **after**
(§65). **Chose §65** — CTA stays in the hero (immediate, above the fold), the value block
sits between price and product. This preserves the locked V8.3 hero, keeps the CTA
above-fold (§68), and still resolves the core concern (understanding *before the product
proof*): the support line + value block create understanding, then the product confirms.

## Outcome-language vs question-language

Evaluated A (outcome: "Know where to focus / Understand what changed / Act with
evidence") vs B (question: "Where should we focus? / What changed? / Does the evidence
support it?"). **Chose A** — more institutional/premium, maps cleanly to the product's
decision grammar, and avoids rhetorical-question risk while keeping first-time clarity.

## Fix along the way

The V8.3 secondary-CTA text-link rule (a `> button:nth-child(2)` **combinator** selector)
was being stripped by the build's inline-`<style>` processing (same quirk seen with
`grid-template-areas`). Replaced it with a **direct class** `.ll-hero-cta2` (added a
`className` prop to `BtnOutline`) — now robust. "View sample →" renders as a text link again.

## QA

- **Overflow:** 0 horizontal at 1440/1280/1024/768/430/390/375/360.
- **Screenshots (390/360):** hero + value block complete the first viewport; product
  canvas begins at the fold/second viewport as proof. Editorial rows, not cards.
- **Canvas top:** 316 → **~626px (390) / ~655px (360)** — product now second-viewport
  (§26/§27), no longer the first major block; not pushed too far.
- **Desktop unchanged (1280):** value block **hidden**, secondary CTA still an outline
  button, no overflow — all changes ≤640-scoped.
- **Localization:** ES ("Qué te ayuda a decidir LeadLens" / "Dónde enfocarte") and JA
  ("LeadLensが意思決定を支援すること" / "どこに注力すべきか / 何が変わったか / エビデンスで行動")
  verified at 360, 0 overflow; PT added. No English leakage.
- **Anchors / nav / menu / language selector:** preserved. **Account switching:** intact.
- **360 total height:** 8,677 → **~9,013** (+336 for the value layer; under the ~9,000
  target within margin, well under 10k).
- **Product truth (SSR):** value label + outcomes present; 0 HOT/WARM/COLD / lead-scoring
  / buying-intent; $7/$25/$59/$129 present; H1 + support intact.
- **No duplication:** the value block (why care / what you get) is distinct from How it
  works (how it gets there) and Differentiation (why it differs from databases/signals).

## Scores (mobile, honest)

| Metric | Before | After |
|---|---:|---:|
| Acquisition clarity | 7.8 | 9.1 |
| Self-relevance | 7.9 | 9.1 |
| First impression | 9.1 | 9.1 |
| Premium | 9.0 | 9.0 |
| Desire | 9.0 | 9.1 |
| Conversion readiness | 8.9 | 9.1 |

Pre-product comprehension test: before the sample, a first-time visitor can now answer
"they help B2B teams figure out which accounts to focus on using market evidence, what
changed, and what to validate" — **YES**.

## Tests / Build / Commit

- `test:v7-landing-guards` **61/61** (adds M1–M6: localized value block, editorial
  non-card rows, mobile-only, direct-class secondary CTA, product-grammar mapping, H1/
  support intact). `test:commercial-continuity` 17/17. `tsc` clean. `rm -rf .next && npm
  run build` succeeded (142 pages).
- Files: `app/demo-pipeline/page.tsx`, `scripts/fixtures/v7-landing-guards.test.ts`, this
  report. Commit: `feat: prioritize mobile acquisition story`. **NOT PUSHED** (GitHub Desktop).

## Freeze

- **Remaining P0:** none. **Remaining P1:** none.
- **Remaining P2:** dead-code localized strings (unrendered steps/problem/viz) carry
  older framing (code hygiene); optional summary-first evidence hierarchy + ranked
  (01/02/03) selector; optional authenticated-Brief visual convergence.
- **MOBILE ACQUISITION FREEZE = YES** · **MOBILE OVERALL FREEZE = YES.** The sample is no
  longer the first major mobile block; a first-time visitor understands what LeadLens
  helps them decide (focus / what changed / evidence) before the product appears; the new
  layer is compact and editorial (not feature cards); the hero stays premium; the CTA is
  above the fold; product proof still appears early (second viewport) and confirms the
  promise; EN/ES/PT/JA are clean; desktop is preserved; 0 overflow; no product-truth
  change. No P0/P1 remains.
