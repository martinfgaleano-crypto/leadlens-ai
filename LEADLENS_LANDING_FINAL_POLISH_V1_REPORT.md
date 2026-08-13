# LeadLens — Landing Final Polish V1

Final landing polish before visual freeze: remove legacy/outdated copy left around
the rebuilt product proof, and fix the hero-text mobile clip at ≤384px. Product
proof (Opportunity Portfolio + Account Brief mockups) is **preserved**. No
redesign; no pricing/onboarding/auth/billing/backend changes.

## 1. Initial HEAD
`a4622e6` — `feat: modernize LeadLens product proof`.

## 2. Legacy terminology occurrences found
Customer-facing landing copy across en/es/pt/ja: **"Opportunity Snapshot" ×56 +
bare "Snapshot" ×52** (product name), **"100% source-verified"** (+ es/pt/ja
equivalents) in the proof bar, **"buying signals/señales de compra/sinais de
compra/購買シグナル" ×28**, a deliverables section built on **Opportunity Score,
Recommended Sales Angle, Cold Email, LinkedIn DM, Cold Call Opener**, an
es/pt/ja pricing line **"Opportunity Score + Confidence Score" / "Ángulo de venta"
/ "outreach assets"**, and a pt FAQ **"intenção de compra"** (buying intent).
Each was classified CURRENT_VALID / LEGACY / MISLEADING / OVERCLAIM /
INCONSISTENT_WITH_PRODUCT_PROOF; the LEGACY/OVERCLAIM/inconsistent ones were fixed.

## 3. Snapshot cleanup
"Opportunity Snapshot"/"Snapshot" fully removed from the landing (rendered
landing now contains the string **0 times**). Contextual canonical replacements:
the delivered product → **Opportunity Portfolio**; the entry product CTA →
**Opportunity Preview**; the single deep artifact → **Account Brief**. Applied in
all four languages (announcement, hero-adjacent, deliverables, sample-preview,
FAQ, final CTA, pricing helper copy, processing/report view strings). No backend
identifiers renamed.

## 4. Score cleanup
Removed dominant-score framing from the landing: proof-bar "100%" pair replaced;
deliverables "Opportunity Score (0–100)" item removed; es/pt/ja pricing
"Opportunity Score + Confidence Score" → **"Fit × Timing × Evidence"**. Copy now
describes prioritization by **Fit / Timing / Evidence** (+ decision state), matching
the rebuilt product proof. The hero mockup was already score-free (prior sprint).

## 5. Source-verification claim cleanup
Proof-bar **"100% source-verified"** (absolute, inconsistent with the product's
uncertainty/counterevidence model) → **"Evidence + counterevidence"** (EN),
**"Evidencia + contraevidencia"** (es), **"Evidência + contraevidência"** (pt),
**"エビデンス + 反証"** (ja). No absolute verification claim remains.

## 6. Buying-intent copy cleanup
Normalized to observed **signals** without implied intent, all languages:
"buying signals/signal" → "signals/signal"; "Buying signals" table row →
"Signals"; "señales de compra" → "señales"; "sinais de compra" → "sinais";
"購買シグナル" → "シグナル"; pt FAQ "sinalizando intenção de compra" →
"mostram sinais relevantes". ("segmentos de compradores / 購買者セグメント" =
buyer segments — canonical, kept.)

## 7. Sales/outreach copy cleanup
The deliverables section (which led with **Cold Email / LinkedIn DM / Cold Call
Opener / Recommended Sales Angle / Opportunity Score**) was rewritten to
decision-intelligence deliverables (see §8). es/pt/ja pricing "sales angle" →
**"What to validate per account"**; "outreach assets/sequence" →
**"optional outreach context / recommended sequence per account"**. Outreach is
now a demoted, optional secondary — never the primary value.

## 8. Adjacent copy compression
The "What you get" deliverables section (10 items, outreach-led) was compressed to
**6 decision-intelligence items** in all four languages — Opportunity Portfolio ·
What Changed · Fit·Timing·Evidence · Evidence & Counterevidence · What to Validate ·
Next Commercial Decision — letting the rebuilt product proof do the selling.
Title changed from "Five company briefs… reason to pick up the phone" to
"Every account comes with a decision — not just a name." The FAQ "What is an
Opportunity Snapshot?" answer (which re-listed Market Map / Opportunity Scores /
outreach assets) was rewritten to describe the Portfolio + Account Brief.
samplePreviewSub was rewritten from "signals + outreach strategy" to
"what changed, fit, timing, evidence & counterevidence, what to validate."

## 9. Hero clipping root cause
At ≤840px the hero grid becomes a single `1fr` column carrying the text column.
The **primary CTA button** ("Get your Opportunity Preview — from $7 →") has
`white-space: nowrap`, giving it a **min-content of 383px**; every other hero-left
child measured ≤117px. Because a grid item's default `min-width` is `auto`
(= min-content), that 383px floor forced the single `1fr` track to **~401px** —
wider than the 328px container at 360px — and the overflow was hidden by
`overflow-x: hidden`, producing the ~10–25px visual clip. Root cause = geometry
(grid automatic-minimum), not a true content-vs-viewport width.

## 10. Hero clipping fix
Geometry fix (no `overflow-x` band-aid): (1) `min-width: 0` on `.ll-hero-left` and
`.ll-hero-mock` in the ≤840px query so the `1fr` track resolves to the container
width instead of the CTA's min-content; (2) `white-space: normal` on the mobile
CTA buttons (≤400px) so the now-100%-width primary CTA wraps to two lines within
the container instead of overflowing. Track at 360px went 401px → **328px**;
hero-left right-edge 417 → **344 (≤360)**.

## 11. 390 QA
0 horizontal overflow; hero-left within viewport; headline/subhead/CTAs/mockup
clean. docHeight 14,892.

## 12. 384 QA
0 overflow; grid track 352px = container; hero-left right 368 (≤384); no clip.

## 13. 375 QA
0 overflow; grid track 343px; hero-left right 359 (≤375); no clip. docHeight 15,182.

## 14. 360 QA
0 overflow; grid track 328px; hero-left right 344 (≤360); primary CTA wraps to two
lines cleanly and reads premium; mockup clean. docHeight 15,597.

## 15. Desktop preservation
1024 / 1280 / 1440 all 0 overflow, no regression (`min-width:0` only affects the
≤840px single-column layout; the desktop `1fr 1.1fr` grid is unchanged). Desktop
hero unchanged.

## 16. Localization
All changed strings were updated in their own language — no English-only cleanup
strings left inside es/pt/ja. Canonical product terms kept in English across all
languages (Opportunity Portfolio, Account Brief, What Changed, Fit·Timing·Evidence,
Evidence & Counterevidence, What to Validate, Next Commercial Decision), consistent
with the existing convention (the old copy likewise used English "Opportunity
Snapshot", "Market Map", "Cold Email"). No regression.

## 17. ICP regression
None. The first-use `ICP (Ideal Customer Profile)` expansion in `howTitle` is
untouched in all four languages; rewritten FAQ/deliverables use "your ICP" without
re-expanding (not first use). Localization rule preserved.

## 18. Claim safety
No implied buying intent, no absolute certainty, no guaranteed outcomes, no fake
automation/ROI. Copy maintains fact ≠ signal ≠ inference ≠ intent: "signals",
"what changed", "why the timing may matter", "evidence and counterevidence",
"what to validate before you act".

## 19. Page height before/after
| Width | Before (`a4622e6`) | After | Δ |
|---:|---:|---:|---:|
| 375 | 15,526 | 15,182 | −344 |
| 1280 | 9,634 | 9,614 | −20 |

Height reduced via copy compression (goal: flat-or-lower — met).

## 20. Files changed
- `app/demo-pipeline/page.tsx` — hero mobile-clip CSS (2 rules) + landing copy cleanup across en/es/pt/ja.
- `LEADLENS_LANDING_FINAL_POLISH_V1_REPORT.md` — this report.

## 21. Tests
`test:commercial-continuity` 17/17 (terminology/metadata invariants hold).
Product-proof surfaces preserved. No brittle screenshot tests added; responsive
verification via real-browser measurement at all required widths.

## 22. TypeScript
`npx tsc --noEmit` — **clean (0 errors)**.

## 23. Build
`npm run build` — **succeeded** (dev server stopped and `.next` cleared first).

## 24. Remaining P0/P1 visual issues
**None (P0/P1).** Residuals (P2, documented, out of this sprint's landing scope):
- es/pt/ja **pricing feature lists** keep an older structure ("10–15 ranked / Top 5
  Opportunity Briefs") vs EN's tiered wording — pre-existing localization debt;
  legacy score/angle/outreach terms within them were fixed.
- A few **post-submit demo/report-view** labels (ja `sPersonalization`
  "推奨セールスアングル", processing "outreach writing", results-view upsell) still
  use legacy score/outreach wording — these render only after form submission, not
  on the marketing landing.
- es/pt pricing/how-it-works still say "Market Map" / "market segments" (mild).

## 25. Landing ready for visual freeze?
**Yes.** The marketing landing (hero, announcement, proof bar, how-it-works,
product proof, deliverables, pricing cards, FAQ, final CTA) is terminology-clean in
all four languages, the hero mobile clip is fixed, and there are no P0/P1 visual
regressions at 360–1440.

## 26. Commit
`fix: finalize LeadLens landing product language` (single focused commit; not an
amend of `a4622e6`).

## 27. Push status
**Not pushed** — push via GitHub Desktop (no CLI push credentials).

## 28. Stop confirmation
Legacy copy cleaned (Snapshot → Portfolio/Preview/Account Brief; scores demoted;
"100% source-verified" and buying-intent removed; deliverables reframed to decision
intelligence; all four languages) and hero mobile clip fixed as a geometry fix and
verified at 360/375/384/390 (+ 430/768/1024/1280/1440), desktop preserved, product
proof preserved, height reduced, tsc + build green. **Recommendation: freeze the
landing visual architecture; the next visual work should move INSIDE the
authenticated product (dashboard/report), not the marketing page.** Stopping.
