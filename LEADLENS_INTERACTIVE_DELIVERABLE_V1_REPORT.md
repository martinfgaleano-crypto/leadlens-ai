# LeadLens — Interactive Customer Deliverable System (V1)

Turns the customer-facing deliverable from a vertically-scrolling, Word-like report into
an **interactive Opportunity Portfolio workspace** — a portfolio navigator + dynamic Account
Brief + meaningful section tabs — built on a **generic renderer** that normalizes any report
shape (the canonical institutional report *and* the legacy Amor de Gea pilot) into one typed
view model. Product-only sprint. Landing untouched and still frozen (guards 78/78).

Initial HEAD `6f1b9f9` · Final HEAD = this commit (see `git log -1`).

## Audit (Phase 1)

| Component | Data source | Reusable | Customer-facing | Secure | Static/interactive | Recommended role |
|---|---|---|---|---|---|---|
| `/results/[jobId]/brief` (page + `actions.ts`) | snapshot → `assembleInstitutionalReport` | yes | yes | yes (ownership + server assembly) | static (Word-like) | **canonical route — keep security, swap UI** |
| `BriefView.tsx` | institutional report | grammar only | yes | yes | static scroll | superseded by workspace |
| `InstitutionalOpportunityReportV1` | curated snapshot | yes | yes | yes | data | **source of truth for the adapter** |
| `report-experience.ts` (derivations) | report data | yes | — | — | logic | reused (decision/decay/momentum/allocation) |
| `/results/[jobId]/page.tsx` | `LeadLensReport` polling | no | yes (older) | yes | static | left as legacy results page |
| Amor pilot `output/amor-pilot1-deliverable.data.json` | bespoke pilot artifact | via adapter | pilot | file (read-only) | static | **compatibility test** |
| Landing sample (`demo-pipeline`) | synthetic marketing mock | grammar only | marketing | n/a | interactive mock | not copied — grammar extracted |
| PDF/CSV | `window.print()` / delivery package | partial | yes | yes | export | print → Downloads tab |

**Gap analysis:** navigation gap (endless scroll, no account switching) · interactivity gap
(no tabs) · hierarchy gap (marketing scale) · trust gap (evidence not foregrounded per
account). No security/authorization gap — that layer was already hardened.

## New architecture (Phases 2–4)

- **View model** `lib/deliverable/deliverable-view-model.ts` — `DeliverableViewModel`
  (`meta`, `portfolio{counts,allocation,funnel}`, `accounts[]`, `coverage`, `capabilities`)
  and `AccountBriefVM` (`decision`, `dimensions[]`, `whatChanged[]`, `evidence`, `sources[]`,
  `counterSignals[]`, `limitations[]`, `validations[]`, `nextStep`, `freshness`). Shared
  decision-state tokens match the landing (Prioritize=blue, Validate=amber, Monitor=slate,
  Hold=light). `EvidenceRelation` = direct / corroborating / context.
- **Adapters** `lib/deliverable/adapters.ts` — `fromInstitutionalReport` (canonical path) and
  `fromAmorPilot` (legacy). Pure, typed, **graceful absence, never fabrication** (e.g. Amor's
  prose dates are *not* coerced into fake ISO dates → no age badge rather than an invented one).
- **Primitives** `components/deliverable/primitives.tsx` — `DecisionBadge`, `DimensionStrip`,
  `WhatChangedSection`, `EvidenceSummary`, `SourceList`, `CounterSignals`, `Limitations`,
  `Validations`, `DecisionSection`, `AccountBrief`.
- **Workspace** `components/deliverable/OpportunityWorkspace.tsx` — the interactive shell:
  top bar (branding + client/market/tier/date), sticky tab row, portfolio navigator, dynamic
  Account Brief. Client component; receives the already-assembled, already-authorized view
  model; no fetching, no raw snapshot.
- **Wiring** — canonical `/results/[jobId]/brief/page.tsx` now renders
  `OpportunityWorkspace vm={fromInstitutionalReport(report, experience)}`. `actions.ts`
  (ownership + server assembly) **unchanged**.

### Navigation model
- **Tabs:** Portfolio · Account Briefs · Evidence · Downloads (each gated by capabilities —
  Amor shows no Downloads because it has no exports; Preview would hide Portfolio).
- **Account switching:** reload-free (in-memory state), URL-synced via `replaceState`
  (`?tab=&account=`) for deep-linking without polluting history — back button leaves the
  deliverable cleanly.
- **Desktop:** persistent 288px left navigator + brief. **Mobile (≤820):** navigator becomes
  a horizontal scrollable account switcher; **≤640** tightens spacing. 44px+ touch targets.

## Compatibility (Phase 5) — real data, no destructive changes

| Report | Accounts | Language | Result | Gaps (graceful) |
|---|---|---|---|---|
| Synthetic institutional (Northstar/FreshRoute/Atlas) | 3 | EN | ✅ renders | — |
| **Amor de Gea pilot (real, bespoke shape)** | 10 | ES | ✅ renders through the SAME workspace | dated-evidence age (prose dates kept as text, no fake ISO); no Downloads (no exports); no funnel/allocation (pilot has none) |

Amor mapping: `name→company`, `route→segment`, `group→decision cluster`, `why→thesis`,
`test→validate`, `unknown→limits`, `next→next step`, `evidence→source row`. **Zero writes to
the pilot file.** No fabricated fields.

## QA (Phases 6–7)

- **Responsive (measured):** 0 horizontal overflow at 1280 / 768 / 375; navigator flips to
  horizontal scroll ≤820; 10-account switcher scrolls; tabs ≥44px. CSS uses max-width/flex-
  wrap/grid-collapse (safe 1440→360).
- **Interaction:** account switch updates brief + active state + URL (`account=…`) reload-free;
  Portfolio tab shows decision distribution (3 prioritize · 4 validate · 3 monitor · 0 hold),
  allocation/funnel when present, and a clickable "Where to focus" list.
- **Screenshots (dev preview):** desktop synthetic Account Brief; desktop Amor Account Brief
  (Éteka); desktop Amor Portfolio; mobile Amor (horizontal switcher + stacked brief).
  Reproducible at `/dev-brief-preview` and `/dev-brief-preview?source=amor` (dev-only, 404 in
  prod).
- **Tests:** new `test:deliverable` **33/33** (normalization, decision vocabulary, separate
  dimensions/no opaque score, provenance, real-or-null dates, Amor compatibility, graceful
  empty states, security guards). `test:v7-landing-guards` **78/78** (landing unbroken).
  `test:commercial-continuity` **17/17**. `tsc` clean. `rm -rf .next && npm run build`
  succeeded.

## Security
- Canonical route keeps `getBriefForViewer` (linked reports → owner-only via verified token;
  unlinked legacy → link-access unchanged). Server-side assembly unchanged; the browser
  receives only the curated view model — no raw report snapshot. Amor preview is dev-only.
  No new API routes, no new data exposure, no authorization change. Guards 29–33 lock this.

## Future tier support (§185)
The renderer already gates sections through `capabilities`, resolved from the job's
`ReportExperience`: `showPortfolioTab` (Preview hides portfolio depth), `showEvidenceTab`,
`showDownloadsTab`, `showMethodology`. Preview/Brief/Intelligence/Premium reuse the **same**
workspace at different depth — no fake entitlements, no billing touched.

## Scope honored
No changes to billing, entitlement logic, discovery, providers, Monitor engine, Vault, Lead
Hunter, or the landing. Admin surfaces untouched (customer product is separate from the admin
observatory).

## Files
`lib/deliverable/deliverable-view-model.ts`, `lib/deliverable/adapters.ts`,
`components/deliverable/primitives.tsx`, `components/deliverable/OpportunityWorkspace.tsx`,
`app/results/[jobId]/brief/page.tsx` (wire), `app/dev-brief-preview/page.tsx` (preview both),
`scripts/fixtures/deliverable-renderer.test.ts`, `package.json` (script), this report.
`BriefView.tsx` retained (unused; superseded) — removal is a P2 cleanup.

## Remaining
- **P0:** none.
- **P1:** CSV export in Downloads; PDF hierarchy parity with the interactive brief; a second
  real (non-pilot) report as an additional compatibility fixture; account comparison view.
- **P2:** remove superseded `BriefView.tsx`; Account Memory "what changed since last run";
  richer corroboration when the pipeline emits relation metadata.

**Recommended next sprint:** Downloads (CSV + PDF parity) + comparison view + a second real
report fixture. Est. 6–10 hours.

**NOT PUSHED** (GitHub Desktop) — founder handoff for deploy.
