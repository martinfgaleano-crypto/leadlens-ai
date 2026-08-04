# Amor de Gea Pilot 1 - final report mapping and delivery fix

## Initial state

- HEAD and `origin/main`: `486b431e5705215ec5d872a8e62c512bb3d88e29` on `main` (`0 behind / 0 ahead`).
- Initial working tree: only pre-existing runtime files `.leadlens/source-intelligence.json` and `.leadlens/usage.json` were modified.
- Production gate: `/login` HTTP 200; unauthenticated Pilot route HTTP 307 to authentication.
- V3R3 remained unchanged at ten active accounts. No provider call, search, account creation, Pilot 2 execution or client contact occurred.

## Root cause and obsolete report

The wrong download was an Admin information-architecture defect. Two prominent legacy buttons still targeted `/api/admin/intelligence/pilots/amor-de-gea/pdf`; the correct final package appeared lower on the page.

- Obsolete artifact ID: `amor-de-gea-internal-pilot-brief-v3`.
- Filename: `leadlens-amor-de-gea-informe-interno-[fecha].pdf`.
- Type/status: `internal_historical_brief` / `deprecated`.
- Audience: internal; customer delivery **NOT ALLOWED**.
- Portfolio/pages: pre-V3R3, six accounts, 16 pages.
- Content inspected: `INTERNAL PILOT BRIEF`, `REVISION INTERNA`, BioPlaza, Distribuidora DAM, Natural + Mente, Tu Tienda Saludable, Hotel Spa La Colina, Somos Consiente and final-report-blocked language.
- Admin: retained under `Historial interno del piloto`, marked `OBSOLETO - NO ENVIAR`, superseded by `pilot1-final-report`.

## Artifact inventory and validation

| ID | Artifact | Type | Portfolio | Accounts | Pages / size | MIME | Safe |
|---|---|---|---|---:|---:|---|---|
| `amor-de-gea-internal-pilot-brief-v3` | Dynamic internal PDF | `internal_historical_brief` | pre-V3R3 | 6 | 16 pages | PDF | No |
| `pilot1-final-report` | `Amor-de-Gea-LeadLens-Pilot-1-Final-Report.pdf` | `final_customer_report` | V3R3 / 1.0 | 10 | 23 pages | PDF | Yes |
| `pilot1-action-briefs` | `Amor-de-Gea-Account-Action-Briefs-Pilot-1.pdf` | `customer_action_briefs` | V3R3 / 1.0 | 4 briefs | 8 pages | PDF | Yes |
| `pilot1-feedback-pdf` | `Amor-de-Gea-LeadLens-Pilot-1-Feedback.pdf` | `customer_feedback` | V3R3 / 1.0 | 10 | 14 pages | PDF | Yes |
| `pilot1-feedback-docx` | `Amor-de-Gea-LeadLens-Pilot-1-Feedback.docx` | `customer_feedback` | V3R3 / 1.0 | 10 | 39,588 bytes | DOCX | Yes |

The final report contains the correct ten accounts, questionnaire impact, Commercial Readiness, Market Opportunity Map, correct four-account first sequence, four Action Briefs, 30-60 day plan, success framework, evidence/limitations, closure and Pilot 2 boundary. It does not activate BioPlaza, DAM, Hotel Spa La Colina, Tu Tienda Saludable or Somos Consiente and has no internal/blocked status.

The Action Brief package contains exactly Éteka, Celestino Hotel Boutique & Spa, Sinergy On and Vitálica, with account context, test hypothesis, probable buyer function, questions, objections/exit conditions, evidence limits and relationship warning.

Both feedback formats contain the ten-account relationship/relevance/action contract, four brief evaluations, route feedback, Commercial Readiness corrections, Pilot 2 priorities, willingness questions, respondent and date fields, with no prefilled answers. Unsupported PDF checkbox glyphs were repaired to deterministic `[ ]` controls.

Visual QA covered all 23 final-report pages, eight Action Brief pages, 14 feedback-PDF pages and 14 rendered DOCX pages. No blank pages, clipping, overlap, broken table, missing glyph, raw ID or local path was observed.

## Canonical mapping and delivery manifest

The single mapping is `lib/intelligence/amor-de-gea-pilot1-delivery.ts`. Each ID resolves exactly once and binds filename, SHA-256, MIME, version, date, page/size and preview metadata.

| ID | SHA-256 | Review | Delivery |
|---|---|---|---|
| `pilot1-final-report` | `5af16350c6dce577f7f46af8965417f8831261d9641b780a46f6920ae2d521cc` | Founder required | Not delivered |
| `pilot1-action-briefs` | `9904f1f4f660fc3b3095c3c8c98781f99df25fb704e5215ba3e366866ab3184f` | Founder required | Not delivered |
| `pilot1-feedback-pdf` | `24c06c394f92d72b552d8e794c3256d529b370c7caf96c7ed7428879efe23deb` | Founder required | Not delivered |
| `pilot1-feedback-docx` | `8686eea333b7beab21702456a7b96a82eb88ad179198ebe72034969c11e0e7fd` | Founder required | Not delivered |

The authenticated Admin route verifies the exact deployed checksum before serving. It enforces pilot ownership, closed allowlist, traversal rejection, MIME, exact filename and PDF-only preview. Missing or mismatched customer content never falls back to the old report; it returns `Final customer artifact unavailable - regeneration required.` No local path is exposed.

## Admin reorganization

- `PILOT 1 DELIVERY CENTER` is the first operational section.
- `ENVIAR A AMOR DE GEA` contains exactly four customer-safe cards; the 10-account final report is marked canonical.
- Counters render `10 / 4 / 4 / 0`.
- Pilot state (`founder_review_required`) and feedback-document state (`ready_for_delivery`) are distinct.
- The 17 artifact-integrity controls are interactive. Ready remains disabled until 17/17; delivery and feedback actions are sequential and never contact the client automatically.
- Old six-account summary/blocked-final copy was removed from primary overview/export surfaces.
- Internal history is collapsed and excluded from the delivery manifest.
- Prepared email remains unsent with subject `Resultados del Piloto 1 de LeadLens — Amor de Gea`.

## Tests and release evidence

- Focused fixture covers V3R3 invariance, canonical uniqueness, exact four-file manifest, historical exclusion, checksums, MIME, filenames, protected download, preview, no fallback, pilot isolation, 17 controls, state separation, Pilot 2 boundary and zero calls.
- Existing Pilot 1 finalization and infinite-loading regression fixtures pass.
- TypeScript passes.
- TypeScript passes and the optimized production build completes with 134 static pages.
- Authenticated browser smoke passed on the production build: Delivery Center first, `10 / 4 / 4 / 0`, canonical preview URL, 17-control gate disabled at 0/17, historical warning visible, Éteka shown as first validation, no BioPlaza primary recommendation, refresh successful and zero browser console errors.

## Delivery boundary

Send exactly:

1. `Amor-de-Gea-LeadLens-Pilot-1-Final-Report.pdf`
2. `Amor-de-Gea-Account-Action-Briefs-Pilot-1.pdf`
3. `Amor-de-Gea-LeadLens-Pilot-1-Feedback.pdf`
4. `Amor-de-Gea-LeadLens-Pilot-1-Feedback.docx`

Do not send the six-account internal brief, audits, context/source reports, JSON, CSV or internal exports.

Founder action: open the canonical report preview, complete 17/17, mark ready, download the four canonical files and send the prepared email. LeadLens does not send automatically.

## Release

- Focused commit message: `fix: map Amor de Gea final delivery artifacts`.
- Push/deployment: reported honestly in the sprint closeout after the commit and production verification.
