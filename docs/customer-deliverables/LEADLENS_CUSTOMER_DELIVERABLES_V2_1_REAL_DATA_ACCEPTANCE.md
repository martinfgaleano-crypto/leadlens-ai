# LeadLens — Customer Deliverables V2.1 · Final Real-Data Acceptance

**Template:** `CUSTOMER_DELIVERABLES_V2_1` · **State:** `FOUNDER_REVIEW` (not approved) · Branch `deliverables-v2.1-real-acceptance`. Presentation-only; no pricing/entitlement/credit/Intelligence-generation/Vault/tenant change.

This pass verifies the V2.1 renderer against **real Intelligence output**, not only the synthetic fixture, and honestly separates the two populations.

## Data sources (real vs synthetic)
| Tier | Data mode | Source | Notes |
|---|---|---|---|
| **Preview (2)** | **REAL** | `ml/data/acceptance/positive-commercial-case-review-package-v1.json` (2 of 6 real cases) | Controlled acceptance, `production_seeded:false` — real US companies, real public source events, canonical decisions. |
| **Brief (6)** | **REAL** | same package, all 6 real cases | Nestlé USA, Conagra, Quad, Hitachi Energy, John Deere, Mondi. |
| **Portfolio (12)** | SYNTHETIC | V2.1 differentiated fixture (ES) | No real 12-company full-order artifact preserved on disk (real Portfolio 12/12 acceptance content lives in Supabase, not committed — §5). |
| **Premium (18)** | SYNTHETIC | V2.1 differentiated fixture (ES) | No real 18-company full-order artifact on disk. |

**Unavailable artifacts:** real full-order (12/18) delivered-report content is **not preserved on disk**. On-disk `customer-e2e-*` artifacts captured run diagnostics with mostly empty `delivered_accounts` (max 3, Lead-Hunter shape, no canonical case); `account-deep-research-positive-control-*` are research telemetry (no canonical decision/thesis). The only reusable **canonical customer-report** data on disk is the 6-case commercial review package → real Preview + Brief. No new purchase, no Intelligence rerun, no credit consumed; nothing copied into a committed fixture beyond a read-only adapter over the already-committed artifact.

## Real-data commercial quality (Brief, MODE A)
- **Company-specific reasoning:** each dossier is the account's real case — e.g. Nestlé USA's $330M Arvin automated distribution center; Conagra's ~$220M Fayetteville expansion. Not templated.
- **Decisions unchanged:** taken verbatim from Intelligence — **5 validate, 1 hold, 0 prioritize**. An honest result (timing not yet strong enough for prioritize); never inflated (§3).
- **Validation actions:** the real decision-critical questions (e.g. "Are post-go-live integration / multi-site orchestration scopes still open to external vendors?") — account-specific, not boilerplate.
- **Evidence traceability:** real primary + independent source URLs (nestleusa.com press release + consumergoods.com), dated event (2026-06-10), recency shown honestly as "3mo ago" (not inflated to look fresh).
- **Language integrity:** the artifact's own `decisionRationale` carries mixed Spanish fragments ("encaje moderate…" — the exact V2 leak); the adapter deliberately uses the clean English `commercial_analysis` fields, so the real Brief is fully English with no leak (test-enforced).

## Digital / PDF parity (material fields)
| Field | Canonical | Digital | PDF |
|---|:--:|:--:|:--:|
| Company identity / role / opportunity type | ✅ | ✅ | ✅ |
| Canonical decision | ✅ | ✅ | ✅ |
| Fit / Timing / Evidence (ordinal) | ✅ | ✅ | ✅ |
| Commercial thesis / Why now | ✅ | ✅ | ✅ |
| What changed (dated) | ✅ | ✅ | ✅ |
| Counterevidence / weaknesses | ✅ | ✅ | ✅ |
| Next validation (decision-critical) | ✅ | ✅ | ✅ |
| Next commercial action | ✅ | ✅ | ✅ |
| Source references (title/date/URL) | ✅ | ✅ | ✅ |
| Per-source Establishes/Observed/Affects relation | ✅ | ✅ (relation chips) | ➖ summarized (relation carried; not per-claim matrix) |
| Tier-scoped coverage + decision distribution | ✅ | ✅ | ✅ |
| Fit×Timing chart | ✅ | ✅ | ✅ |
| Premium Decision Context (grouped tensions) | ✅ | ✅ | ✅ |

**Only material difference:** the PDF summarizes per-source relations rather than reproducing the digital's per-claim Establishes/Observed/Affects matrix. The PDF remains claim-traceable (each source shows its claim + date + URL) and is not misleading. No omissions of decisions, evidence, counterevidence or next-validation.

## Data-integrity fixes proven on real data
- **Tier-scoped headline (finding #8, fixed this pass):** `composeForTier` now derives a headline consistent with the tier's own companies — Preview "2 of 2", Brief "5 of 6" (was leaking the full-set "5 of 6" into the 2-company Preview; and synthetic Portfolio said "of 18" while showing 12).
- Tier-scoped coverage (V2.1) confirmed on real data: Brief 6/6/5.
- Recency computed from real event dates; sourceCount reconciles with listed real sources; decisions unchanged.

## PDF acceptance (all four)
Pages Preview 3 · Brief 7 · Portfolio 9 · Premium 13 · 0 empty · 0 orphaned headings · English (real) / Spanish (synthetic) with no cross-language leaks · real source links present · no truncation.

## Admin
`Admin → Deliverables → Report Templates` now has a **Data toggle: Synthetic sample / Real acceptance (EN)** in addition to the ES/EN and per-tier Preview/Download. Real mode renders the controlled-acceptance package (admin-only, no paid-customer data, no credit). Template stays `FOUNDER_REVIEW`.

## Security
Tenant isolation unchanged · no fabricated research (real decisions verbatim; synthetic clearly labeled) · no additional customer charge · no public exposure (Admin-gated; controlled-acceptance data only, never a paid customer report) · acceptance data not inserted into Vault/Account Memory.

## Known limitations (≤3 material)
1. Real coverage is Preview + Brief only (6 real cases); Portfolio + Premium remain synthetic — real full-order content is not on disk.
2. The real cases are all validate/hold (no prioritize) — an honest snapshot, not a weakness of the renderer.
3. PDF summarizes per-source relations vs the digital per-claim matrix (claim-traceable, not misleading).
