# LeadLens — V7.2: Responsive Anchors, Sample Output Redesign & Mobile Pass

Same V7 sprint. Addresses the founder's post-V7 feedback: mobile must feel as
intentional as desktop, the Sample Output must SHOW the deliverable (not describe it),
anchors must behave differently on desktop vs mobile, and the hero price microcopy must
be concise. Desktop hero + frozen system untouched (§227/§228). Initial HEAD `0a4375b`.

## 75. Mobile anchor strategy
On mobile, every nav anchor lands at the **section START**: sticky nav → eyebrow →
heading → first content. Sections keep `scroll-margin-top:76px` (≈ the 78px mobile
nav), so the eyebrow sits just under the nav. The pricing anchor sits above the grid, so
on mobile it takes a **large** `scroll-margin-top` (300px) that pulls it low in the
viewport — which reveals the section from its eyebrow down, i.e. the same section-start
composition. Verified at 390/360: eyebrow@96, title@138, first plan@300.

## 76. Desktop anchor strategy
Desktop **composes** the section. Pricing uses a 220px anchor offset so the heading sits
just below the nav and the 2×2 cards fill most of the viewport (1440 94% / 1280 80% /
1024 76%). How/Sample/FAQ land heading + content. Desktop and mobile deliberately differ
(§163) — driven purely by responsive `scroll-margin-top`, no JS, works for nav-click and
direct hash alike.

## 77. Pricing desktop before/after
Before (V7): heading@72, grid 80–94% visible — already good; unchanged.
After: same composed behavior retained.

## 78. Pricing mobile before/after
Before (V7): first card 100% but the eyebrow/title had scrolled above the fold.
After: eyebrow "Pricing"@96 (just under nav), title@138, first plan@300 — section START,
so the visitor immediately sees *which* section they entered (§166/§174).

## 79. Sample mobile anchor
Eyebrow "Sample output"@112, heading@154, brief begins immediately below — section start.

## 80. How it works mobile anchor
Eyebrow@112, heading@154, stage 01 immediately below — section start.

## 81. FAQ mobile anchor
Eyebrow@112, heading@154, first question immediately below — section start (§169).

## 82. Hero microcopy decision — **REMOVE → SHORTEN**
`Paid plans start at $7, one-time · viewing the sample is free — no card needed.` →
**`Start with a $7 one-time validation run.`** (localized). The free-sample/no-card
clause is **removed**: the "View sample" button already implies free browsing (§199), and
the line now positions $7 purely as the low-risk validation entry (§198/§200).

## 83. Hero mobile composition
First viewport (390×844) shows category (badge), 2-line headline, value (sub), and both
CTAs (row@455, in-view); the product workspace begins at 703 (within 1.3 viewports).
Headline stays 2 lines — no 5–6 line wall (§194/§195). CTAs stack full-width ≤560 (existing).

## 84. Mobile proof bar
Already a clean **2×2** ≤600px (dividers hidden, labels wrap, values 1.375rem) — readable,
not microscopic; no change needed (§201).

## 85. Mobile product workspace
The hero `AccountWorkspace` keeps its mobile segmented account switcher + stacked spine
(Account → Change → Evidence w/ relation tags + ladder → Limiter → Decision). Evidence
tags/ladder remain legible; 0 overflow at 360 (§212–214).

## 86. Mobile What Changed transition
Kept as a single compact dark band with the one question (padding tightened to 1.75rem in
V7). It is short on mobile — one line, not a wasted-scroll block. Responsive difference is
authorized (§203); left compact rather than removed since it bridges into How it works.

## 87. Mobile How it works
3-stage flow stacks with downward arrows (existing). Cards are concise; no change needed.

## 88. Mobile Sample Output
**Redesigned.** Stack order eyebrow → **mini Account Brief** → CTA (View full sample) +
note (§188). The brief is a real product object (358px, fits 360) — not a shrunk desktop
UI — using the same primitives as the hero, so it reads as the same LeadLens product (§190).

## 89. Mobile differentiation
Stacks to one column (old panel → arrow → LeadLens panel); the lede carries the
Databases → Signals → LeadLens story in text. Understandable without oversized boxes (§205).

## 90. Mobile pricing
Cards stack 1-col ≤580; entry lands at section start (§206). Architecture unchanged.

## 91. Mobile FAQ
Compressed to **5 primary questions + a "More questions" disclosure** (native `<details>`,
localized) so the accordion no longer dominates the ending before the final CTA (§207/§208).

## 92. Mobile final CTA
Unchanged ("Now find yours.") — with the FAQ compressed, the page ends on the CTA with
more energy (§208).

## 93. Mobile typography
Hero H1 clamps to 2 lines; proof labels .72rem; product-UI labels remain legible (no
sub-11px). Localized strings (ES/PT/JA) verified non-truncating at 360.

## 94. Mobile spacing
Sample section row-gap tightened; curiosity band tightened (V7). Section paddings inherit
the 3.25rem system; mobile heights: 390 ≈ 10,039, 360 ≈ 9,771 (down from V7's 10,559).

## 95. Mobile localization
ES/PT/JA verified at 360: 0 horizontal overflow; localized sample headline, hero price
note, differentiation, sample teaser, and "More questions"; brief card fits.

## 96. Sample Output professionalism score: ~6.5 → **8.7**
Now a two-column product-proof: real Account Brief (elevation, decision pill, spine,
relation tag, F/T/E) beside a tight commercial block with one dominant CTA — comparable to
the hero canvas, not a centered marketing paragraph (§176/§186).

## 97. Mobile visual quality score: ~7.6 → **8.7**
Section-start anchors, product-proof sample, 2×2 proof, compressed FAQ, concise hero
microcopy, 0 overflow — mobile reads as intentional, not a compromised desktop (§192/§221).

## 98. Mobile anchor quality score: ~6.0 → **9.2**
Every mobile anchor begins its section with the eyebrow under the nav; direct hash matches.

## 99. Product fidelity scores
- Hero ↔ `/sample`: **8.8** — same intelligence grammar + accounts + decision states.
- `/sample` ↔ Real Brief: **8.2** — shared decision-state vocabulary + analytical
  structure (aligned in the authenticated-Brief sprint); the real Brief carries more depth.
- Hero ↔ Real Brief: **8.0** — the hero is a compact teaser of the same deliverable.

## 100. Real Brief alignment decision — **A (matches well enough now)**
The homepage Sample Output is built from the *actual* deliverable's components (decision
states + What Changed + evidence w/ relation tags + limiter + validation + decision), which
the real authenticated Brief already uses. So the marketing sample honestly corresponds to
what LeadLens delivers — not independent art (§216). Not ambiguous: **A**. A dedicated
real-Brief *visual presentation* polish (to mirror the canvas aesthetic pixel-for-pixel)
is an optional future follow-up (B), not a blocker for this sprint.

## Verification
`npm run test:v7-landing-guards` **25/25** (adds Sample-Brief-shows-deliverable,
responsive-anchor, FAQ-compression, concise-microcopy guards). `test:commercial-continuity`
17/17. `tsc` clean. `rm -rf .next && npm run build` succeeded (142 pages, `/sample`
prerendered). Browser QA at 1440/1280/1024/768/430/390/375/360: 0 horizontal overflow;
anchor matrix (nav + direct hash) desktop-composed / mobile-start; Sample two-column↔stack;
ES/PT/JA at 360 clean. Note: in-app preview screenshots render blank mid-page (known pane
behavior); all composition verified via DOM geometry.

## Not changed
Desktop hero, headline, intelligence canvas, pricing architecture/prices, nav architecture,
commercial positioning, backend/auth/billing/Discovery/catalog — untouched (§227/§228).

## Commit
`feat: V7.2 — responsive anchors, Sample Output product-proof, mobile pass`. Not pushed.
