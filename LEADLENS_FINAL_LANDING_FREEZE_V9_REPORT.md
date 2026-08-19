# LeadLens — Final Desktop + Mobile Freeze (V9)

Closeout sprint on a small, finite set of Codex-audited mobile issues. Frontend-only;
prices, backend, auth, billing, Discovery unchanged. Desktop was already frozen (V7.x) and
is preserved verbatim — every V9 change is mobile-scoped (≤640) or SSR-safe. This sprint
resolves the five mandated items; the only reason **LANDING FREEZE is not YES** is that
**production is still behind local HEAD and I cannot push/deploy** (GitHub Desktop only).

## The five changes

### 1. Production synchronization (founder handoff)
The code is finalized, committed locally, and verified. I **cannot push or deploy** from
this environment (repo is driven through GitHub Desktop). Production sync is a founder
action: push the local branch, deploy, then confirm the product-truth strings below are
live. Until that happens the deployed landing is stale — so I do **not** claim a production
freeze.

### 2. Mobile language selector (in the hamburger)
- New localized language group at the **bottom** of the mobile nav panel (`#ll-nav-panel`),
  under a `navLanguage` label ("Language" / "Idioma" / "Idioma" / "言語").
- Four buttons (EN/ES/PT/JA), each **44px** min touch target, `role="group"`,
  **`aria-pressed`** reflecting the active language, selected styling (blue border/fill).
- `changeLang(l)` now also sets **`document.documentElement.lang = l`** so `<html lang>`
  tracks the UI language; route + hash are untouched (state-only switch).
- **Verified interactively** (375px): menu opens, 4 buttons render at 44px, English
  `aria-pressed=true`; tapping **Español** → `aria-pressed` moves to Español, `<html lang>`
  becomes `es`, and the H1 re-renders in Spanish.

### 3. Mobile Opportunity Monitor recomposition
- Same strip, now `.ll-monitor` with a mobile-only compaction: reduced padding, smaller
  title/copy, **full-width CTA**, tighter top margin — clearly **secondary** to the four
  one-time tiers.
- New per-locale **`monitorSubMobile`** (35–50% shorter) swapped in ≤640 ("Periodic account
  re-evaluation — monthly refreshes and recurring briefs."); the full desktop copy is
  hidden on mobile, the short one shown.
- **No real-time / continuous / always-on** claim anywhere (guarded). Price **unchanged**
  ($99/mo); tag remains "Coming soon — Pilot access".

### 4. Mobile pricing compaction
- Per-card **"One-time payment"** repetition (`.ll-price-onetime`) is **hidden on mobile**
  — the pricing intro already states "Four one-time products", so the repeat is redundant.
  Desktop keeps it.
- Card padding/gaps/CTA already compacted (V8.1); `What's included ↓` disclosure and all
  prices/architecture unchanged.

### 5. After You Buy disclosure + How It Works mobile headline
- **After You Buy** is now a semantic **`<details className="ll-afterbuy">`**: `open` on
  desktop and in **SSR** (initial state `true`, so crawlers / no-JS / desktop see the full
  content); a mount-time `matchMedia("(max-width:640px)")` check **collapses it on mobile**.
  Summary is a ≥44px touch target with a chevron affordance (native marker hidden).
- **How It Works headline** gets a per-locale **`howTitlePostMobile`** so mobile drops
  "— in three steps." (EN/ES/PT end on "."); **JA keeps its へ particle** ("へ。") so the
  sentence stays grammatical. Desktop keeps the full "— in three steps." suffix.

## Frozen (untouched)
Desktop everything; mobile hero; mobile product teaser/canvas; metrics; market transition;
differentiation; "Don't trust a score"; FAQ; final CTA; sample.

## QA

**Static / build**
- `tsc --noEmit` clean.
- `test:v7-landing-guards` **78/78** (adds O1–O9: mobile lang selector + aria-pressed +
  44px, navLanguage ×4, `changeLang` html-lang, After-You-Buy disclosure open-on-SSR +
  matchMedia collapse, Monitor coming-soon/periodic/$99 + no real-time/always-on,
  `monitorSubMobile` ×4, per-card one-time hidden on mobile, per-locale How-it-works mobile
  headline with JA へ, prices + product-truth intact).
- `test:commercial-continuity` **17/17**.
- `rm -rf .next && npm run build` succeeded (production build clean; 142 pages).

**Mobile (375/390), measured in-browser**
- Horizontal overflow **0**.
- `.ll-monitor` full copy `display:none`, short copy `display:block` ("Periodic account
  re-evaluation…"), CTA full-width.
- `.ll-price-onetime` `display:none`.
- `.ll-afterbuy` collapsed (`open=false`) on mobile mount.
- How-it-works: full suffix hidden, mobile "." suffix inline.
- Language selector: 4×44px, `aria-pressed` correct; switching to ES sets `<html lang>=es`
  and re-renders the Spanish H1.
- Hero / value block / product canvas render intact (screenshot captured).

**Desktop (1280), measured in-browser**
- Horizontal overflow **0**.
- `.ll-price-onetime` visible ("One-time payment"); Monitor full copy shown, short hidden;
  full How-it-works suffix ("— in three steps.") shown; header language dropdown + outline
  "View sample" button intact (screenshot captured).

**SSR (curl)**
- `<details class="ll-afterbuy" open="" …>` — disclosure **open in server HTML**.
- After-You-Buy steps present ("Share your commercial context…").
- `monitorSubMobile` present; prices $7×4 / $25 / $59 / $129 / $99/mo present.
- Product-truth negatives all **0**: "LeadLens AI", "Submit your ICP", "score each
  opportunity", "continuous market intelligence", "real-time", "always-on", personal Gmail.

**Known, non-blocking**
- Dev preview shows a red "1 error" overlay ("Text content does not match server-rendered
  HTML") — verified in prior sprints to reproduce on the fully-static `/sample` page →
  **dev-preview environmental, not frontend**; production build compiles clean.
- The in-app browser pane intermittently reports `innerWidth 0` and stalls on click; mobile
  verification used computed-style/DOM reads + SSR curl + a top-of-page screenshot, which
  are reliable. This is a harness limitation, not a page defect.

## Files / Commit
`app/demo-pipeline/page.tsx`, `scripts/fixtures/v7-landing-guards.test.ts`, this report.
Commit: `feat: finalize and freeze LeadLens landing`. **NOT PUSHED** (GitHub Desktop) —
push + deploy is the founder handoff for production sync.

## Freeze decision
- **DESKTOP FREEZE = YES** — untouched; verified unchanged at 1280 (one-time visible,
  Monitor full copy, After-You-Buy open, full How-it-works suffix, header controls intact).
- **MOBILE FREEZE = YES** — all five mandated items implemented and verified; 0 overflow;
  EN/ES/PT/JA clean; only optional P2 code-hygiene items remain (unrendered dead-copy
  strings; optional summary-first evidence hierarchy / ranked 01-02-03 selector).
- **LANDING FREEZE = NO (provisional)** — the *code* is freeze-ready, but the deployed
  landing is **behind local HEAD** and I cannot push/deploy. Landing freeze becomes YES the
  moment the founder pushes and deploys and confirms the SSR product-truth strings live.

**Remaining before LANDING FREEZE = YES:** founder pushes local HEAD → deploys → confirms
production shows the After-You-Buy disclosure, the compact mobile Monitor, the mobile
language selector, and 0 product-truth negatives. No code work remains.
