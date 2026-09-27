# LeadLens — Customer Deliverables V2.4 — FREEZE

**Status:** FOUNDER_REVIEW_READY (canonical freeze proposed; not auto-approved)
**Template version:** `CUSTOMER_DELIVERABLES_V2_4` (supersedes `CUSTOMER_DELIVERABLES_V2_3`)
**Effective:** 2026-09-26
**Branch:** `customer-deliverables-v2.4-final-closure`
**Scope discipline:** presentation-only. Product truth, pricing, company allowances, one-time credit
consumption, billing, tenant isolation, and the canonical decision labels
(PRIORITIZE / VALIDATE / MONITOR / HOLD) are **unchanged**. This is the terminal deliverables sprint —
**there is no V2.5**.

---

## 1. Definitive four-tier commercial contract

| Tier | Price | Companies | Deep dossiers | Stakeholder functions | Momentum/Decay | Market patterns | Account Memory | Monitor-eligible |
|------|------:|----------:|--------------:|----------------------:|----------------|-----------------|----------------|------------------|
| **Preview** | $7 | 2 | 0 | — | — | — | none | no |
| **Brief** | $25 | 6 | 0 | — | — | — | none | no |
| **Portfolio** | $59 | 12 | 4 | — | conditional | observed clusters | snapshot | eligible |
| **Premium** | $129 | 18 | 6 | inferred functions | conditional | observed clusters | expanded snapshot | eligible |

All rows are **derived from `lib/products/catalog.ts`** (`launch_tier_architecture_v0`). The matrix is not a
marketing sheet — `lib/products/tier-contract-matrix.ts` maps each catalog entitlement to a delivery
surface (REPORT / WORKSPACE / ELIGIBLE) and an implementation status (`rendered` / `app_live` /
`contracted_not_rendered`), so a contracted-but-unrendered capability surfaces to HQ, never to a customer.

## 2. Capability resolutions (the six deliverables §2)

1. **Deep Dossier — RESOLVED by COMPOSITION.** A deep dossier is a *fuller treatment of the top accounts*,
   not new research: a DEEP DOSSIER chip, full per-source provenance (`label (date) [relation] —
   observation`), and an explicit "what would change the decision" line drawn from the account's own
   counter-signal / validation. Count is catalog-bounded (Portfolio 4 · Premium 6) and tier-monotonic.
   `deepDossierIds()` in `lib/deliverable/portfolio-analytics.ts`; rendered in `renderers/pdf.ts`.
2. **Stakeholder Hypotheses — RESOLVED as INFERRED FUNCTIONS (Premium-only).** We emit *functional roles*
   (e.g. Operations, IT / Systems Integration) inferred from the account's own opportunity type — **never**
   a named person, title, email, or budget authority. Each carries the disclaimer *"Inferred function
   (unverified) — not an identified person."* `deriveStakeholderFunctions()`; Premium-gated in the renderer.
3. **Momentum / Decay — RESOLVED HONESTLY as a conditional.** A one-time first review has no observation
   history, so we state current evidence *freshness* now and defer a full trajectory to Monitor. We never
   fabricate a trend. Matrix status stays `contracted_not_rendered` (an honest Monitor capability), worded
   truthfully in catalog + template.
4. **Market Patterns — RESOLVED HONESTLY.** Rendered as the *observed portfolio clusters* when clusters
   exist; never an extrapolation from the evaluated set to the whole market.
5. **John Deere-class decision/rationale inconsistency — CORRECTED at the earliest safe canonical seam.**
   `checkAccountConsistency` / `reconcileAccountConsistency` (`lib/deliverable/decision-consistency.ts`) run
   inside `fromDeliverableViewModel` — channel-agnostic (PDF + web + csv). A HOLD with an immediate-trigger
   next step keeps the HOLD (decision authority is never overridden) and the trigger prose is neutralized to
   "No outreach now…". Regression matrix in the suite covers PRIORITIZE/VALIDATE untouched, HOLD+stale
   flagged+reconciled, HOLD-without-trigger left alone, and the real John Deere case through the seam.
6. **Tier-capability matrix — FINALIZED.** deep_dossiers + stakeholder_hypotheses are now `rendered`;
   momentum / decay / market_patterns remain honest conditionals.

## 3. Rendered acceptance artifacts (§7-8, §29-36)

Four PDFs generated through the **real** delivery pipeline
(`fromDeliverableViewModel → toPresentationModel(doc, tier, "pdf") → renderPdfBuffer`),
production-parity (compressed):

| File | Data | Accounts | Pages | Empty | Accents |
|------|------|---------:|------:|------:|---------|
| `LeadLens_Preview_V2_4_Final.pdf` | **REAL** controlled-acceptance (US) | 2 | 3 | 0 | clean |
| `LeadLens_Brief_V2_4_Final.pdf` | **REAL** controlled-acceptance (US) | 6 | 7 | 0 | clean |
| `LeadLens_Portfolio_V2_4_Final.pdf` | SYNTHETIC (labeled) | 12 | 10 | 0 | clean |
| `LeadLens_Premium_V2_4_Final.pdf` | SYNTHETIC (labeled) | 18 | 15 | 0 | clean |

QA (PyMuPDF): Preview/Brief carry **no** deep-dossier or stakeholder sections (catalog: 0); Portfolio shows
deep dossiers + what-would-change but **no** stakeholder functions; Premium shows all four; zero empty
pages; no mojibake.

### Real one-time full-order acceptance (2026-09-26)

Executed live through the canonical one-time path (`scripts/accept-one-time-enforcement.mts` and the
render-capturing `scripts/accept-one-time-deliverable-v2_4.mts`), reusing only production server-side
seams — canonical grant primitive `addCredits`, `interpret → confirm → startRun → processRun`, the
`account_intelligence_charges` ledger, and the production viewer path
`deliverableForViewer → fromInstitutionalReport → fromDeliverableViewModel → TierComposer → renderPdfBuffer`.
Disposable `@example.com` tenants; no Lemon purchase; all rows + auth users deleted in `finally`.
Colombia WMS context; Vault `ELIGIBLE_FALLBACK` scoped to Colombia (fail-closed, off-geo rejected).

**PORTFOLIO — PASS (21/21 checks).** Grant = exactly 12 one-time credits (welcome=0, clean ledger);
real pipeline delivered **12/12** valid Colombia accounts; **charges=12 = delivered=12, ending balance 0**,
every charge keyed to the run (exactly-once), tenant-isolated (other tenant 404), replay/recovery = no
extra debit, reopen free, exhausted 3rd run blocked `402 usage_limit_reached` with **zero** provider
research on the blocked attempt. Provider cost **$1.39** (Anthropic 55 calls; Brave/Tavily free tier).
The V2.4 real delivery path renders a real Portfolio PDF (10pp, 0 empty, no mojibake, no synthetic-label
leak, DEEP DOSSIER present, real companies) with **zero credit** consumed on render/reopen.

**PREMIUM — BLOCKED (external funding).** The **Anthropic API credit balance is exhausted**
(`invalid_request_error: "Your credit balance is too low to access the Anthropic API"` →
`CIRCUIT_OPEN: credits_exhausted`), observed mid-run on the second Portfolio pass (delivered degraded to 9,
balance stayed non-negative at 4 — charge-at-materialization remained safe under the outage). Claude is a
hard dependency for interpretation, case synthesis, and the report agent, so a fresh Premium 18/18 run
cannot complete until the Anthropic account is funded. This is **not** a product, supply, Vault, credit-path,
persistence, delivery, or renderer defect — all of those are proven above and by the 88/88 suite. Session
provider spend to date: **$2.19** (well under the $8 target / $12 ceiling); the blocker is the account
balance, not the budget.

**Smallest next correction:** top up the Anthropic API credit balance, then re-run
`LEADLENS_ACCEPTANCE_PLAN=pro …/accept-one-time-deliverable-v2_4.mts` (Premium 18) and one clean
`LEADLENS_ACCEPTANCE_PLAN=standard` render (Portfolio 12) — each ~$1.5–2.0, within budget — to produce the
clean real 12/12 + 18/18 PDFs and flip the freeze to FREEZE_READY.

## 4. Reopening policy (§54)

V2.4 is the canonical freeze. Reopen **only** for:
- a real Portfolio/Premium full-order becoming available (recovery or an authorized live run) — render it and
  replace the synthetic artifact; **no contract change**;
- a founder-identified truthfulness defect in the rendered deliverable;
- a catalog change made deliberately elsewhere (the matrix re-derives automatically).

Do **not** reopen for: another visual restyle, wording preferences, pricing/landing edits, provider
integration, or fabricating the deferred capabilities (momentum trajectory, named stakeholders, market
extrapolation). Those are out of contract by design.

## 5. Verification

- `scripts/fixtures/report-template-v2.test.ts`: **88 passed, 0 failed** (77 prior + 11 new V2.4).
- `npx tsc --noEmit`: clean.
- `npm run release:check`: see sprint report.
