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

### The one genuinely material external blocker (§35 / §65)

**Real Portfolio (12/12) and Premium (18/18) full-order acceptance on real data is BLOCKED.** The only real
canonical dataset is the 6-company controlled-acceptance package, which covers Preview (2) and Brief (6)
truthfully. To render a real 12/18 we would need one of:

- **Historical recovery from Supabase** — requires a production read, which the environment's auto-mode
  classifier **denies** (`[Production Reads]`). Not bypassed.
- **A fresh bounded live run** — cost-bearing and production-adjacent; `INTERNAL_RUN_SECRET` and
  `BRAVE_API_KEY` are unset locally, and higher-tier full-order supply is Vault-reuse- and funds-gated per
  standing memory.

Per §65 this is the permitted "genuinely material external blocker." Portfolio/Premium are therefore
rendered from **clearly-labeled synthetic** full-orders (layout + tier-composition proof), and real 12/18
acceptance is a **FOUNDER ACTION**, not a code gap.

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
