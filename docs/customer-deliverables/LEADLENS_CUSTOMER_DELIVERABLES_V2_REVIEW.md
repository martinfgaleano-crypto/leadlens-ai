# LeadLens — Customer Deliverables V2 · Final Review Package

**Template version:** `CUSTOMER_DELIVERABLES_V2` · **Approval state:** `FOUNDER_REVIEW` (NOT approved until the founder reviews the four PDFs) · **Effective:** 2026-09-24 · Branch `deliverables-v2-final-review`.

Presentation-only. No change to pricing, entitlements, credit consumption, canonical decisions, Intelligence generation, Vault, or tenant isolation. All sample artifacts use **synthetic data** (fictional companies, `example.*` sources) — never a real customer's private Intelligence.

---

## 1. Premium page-count forensics (the founder's concern)

**Question:** is Premium (18 companies) "excessively compressed"?

**Method:** re-rendered all four tiers from a realistic-length synthetic fixture and inspected every page; audited the renderer for truncation.

**Findings:**
- **All 18 companies receive a complete individual dossier.** The renderer loops every account (`for (const a of doc.accounts) accountCase(a, s)`) — no company is dropped, summarized-away, or merged onto a shared row.
- **No dossier truncation.** The only length caps in the renderer are the cover *teaser* summary (180 chars — the full summary appears in the Executive Summary section) and the executive "where attention goes first" list (top 4). Per-company thesis, evidence, what-changed, counter-signals, validations, sources, and next-step all render in full (word-wrapped, never clipped).
- **The compression was VISUAL, not informational.** Companies ran together with only thin spacing, and the Fit/Timing/Evidence chips touched the thesis. Two real presentation defects existed: (a) the **"Opportunity cases" heading orphaned** at a page bottom above dead space; (b) tight inter-dossier spacing.
- **Digital vs PDF completeness:** identical dossier fields, with one deliberate difference — the digital report additionally shows per-source *Establishes / Observed / Affects* relations; the PDF summarizes evidence as a counts line + a sources list. No data is lost in the PDF.

**Correction (this sprint):** each dossier is now a distinct unit — a per-company divider rule, a tinted header strip with the decision accent bar, the decision chip aligned in the header, a role/opportunity-type subline, and breathing room after the metric chips. The orphaned-heading bug is fixed (`band()` now reserves enough space to move a heading to the next page with its first content).

**Result:** with realistic content the Premium PDF is **16 pages** (was 12 on shorter synthetic text) — each company gets ~⅔ page as a deliberate dossier. Page count scales with real content; it is not padded.

**18-company completeness:** every sample company carries decision · Fit · Timing · Evidence · Why · thesis · (what-changed when dated) · counter-signals · validate-before-acting · sources · next-step. Fields absent from the underlying data (e.g. undated timing) are shown honestly, never fabricated.

---

## 2. Tier differentiation & information-coverage matrix

Verified against `lib/delivery-system/tier-composer.ts` (`TIER_COMPOSITION`).

| Component | Preview (2·$7) | Brief (6·$25) | Portfolio (12·$59) | Premium (18·$129) |
|---|:--:|:--:|:--:|:--:|
| Branded cover + decision distribution | ✅ | ✅ | ✅ | ✅ |
| Executive summary + decision legend | ✅ | ✅ | ✅ | ✅ |
| Company dossiers (full) | ✅ (2) | ✅ (6) | ✅ (12) | ✅ (18) |
| Commercial context | — | ✅ | ✅ | ✅ |
| Validation queue | — | ✅ | ✅ | ✅ |
| What-changed (dated) | — | ✅ | ✅ | ✅ |
| Evidence coverage stats + segment tally | — | ✅ | ✅ | ✅ |
| Portfolio table + **Fit×Timing chart** | — | ✅ (chart ≥4 cos) | ✅ | ✅ |
| Allocation · Compare · Methodology | — | — | ✅ | ✅ |
| **Premium Decision Context** (executive context, tensions, validation priorities, commercial benchmark, decision-critical briefs) | — | — | — | ✅ |

Tiers differ by **sections + depth + company count**, not by a thinner layout — the frozen commercial contract (2/6/12/18) is preserved. Premium's differentiation is *additional intelligence* (the Decision Context dossier), not a badge or accent.

---

## 3. Brand & color specification (Refined Cobalt Editorial)

| Token | Hex | Use |
|---|---|---|
| Ink | `#0F172A` | Headlines, company names, primary text |
| Cobalt | `#0284C7` | Brand accent, wordmark "Lens", prioritize decision |
| Sky | `#0EA5E9` | Secondary accent, brand mark |
| Paper | `#F6F9FC` | Panels, dossier header strips |
| Rule | `#E2E8F0` | Dividers, table borders |

**Decision colors** (never the sole signal — always paired with a text label): prioritize `#0284C7`, validate `#D97706`, monitor `#475569`, hold `#94A3B8`.

**Wordmark:** the existing name-based **Lead**Lens wordmark (rounded "L" mark + sky accent), reproduced natively in the PDF cover, footer, and section brand — no icon invented, no distortion.

**Typography:** jsPDF standard Helvetica (WinAnsi/Latin-1). Full coverage for English + Spanish (á é í ó ú ñ ü ¿ ¡). **No font files are distributed to customers.** Non-Latin-1 scripts (e.g. CJK) are not yet supported and would require an embedded font — noted as a known limitation, and characters are never silently stripped.

---

## 4. Chart inventory

| Chart | Business question | Data source | Encoding | Empty state |
|---|---|---|---|---|
| Decision distribution bar | How is the portfolio split across decisions? | `portfolio.counts` | Proportional segments, canonical colors | Hidden when total = 0 |
| **Fit × Timing scatter** (web + PDF) | Which companies combine strong fit with strong timing? | ordinal `dimensions` Fit/Timing | Numbered dots (keyed to the table `#`) positioned on a 3×3 ordinal grid, decision-colored | Accounts missing fit/timing listed as "not positioned"; suppressed under 4 companies |
| Evidence-coverage stat row | How well-evidenced is the portfolio? | `coverage` | Count tiles (evaluated / with-sources / dated / corroborated) | Omitted when coverage absent |

No chart invents numeric precision; ordinal strengths are shown as ordinals, never as probabilities or scores. Evidence-recency and source-coverage *charts* remain available candidates (data supports them) but are intentionally not added to avoid decoration without added meaning (§19/§29).

---

## 5. Admin template review & versioning

Extends the existing **Admin → Deliverables** surface (no new CMS):
- **`GET /api/admin/deliverables/template`** (admin-only) → the `CUSTOMER_DELIVERABLES_V2` descriptor (version, source commit, tiers, languages, rendering/chart systems, brand tokens, approval state, effective date, known limitations).
- **`GET /api/admin/deliverables/template/preview?tier=&lang=&mode=`** (admin-only) → a **deterministic sample PDF** rendered from the in-repo synthetic fixture. No DB, no customer data, no research, **no credit**. Same version + sample ⇒ equivalent output.
- The Deliverables page shows a **Report Templates** panel: version, approval-state chip (DRAFT / FOUNDER_REVIEW / APPROVED / RETIRED), an ES/EN sample toggle, and Preview/Download PDF per tier.

Approval workflow: the descriptor ships as `FOUNDER_REVIEW`; it is **not** auto-approved. The founder reviews the four PDFs, then the state is advanced to `APPROVED` in a follow-up. Current production customer report behavior is unchanged until then.

---

## 6. Known limitations
- Sample data is synthetic (layout representative only).
- PDF language coverage is Latin-1 (English + Spanish); CJK etc. would need an embedded font.
- PDF evidence is summarized vs the digital per-source relations.
- `FOUNDER_REVIEW` — not production-approved until the four PDFs are accepted.

## 7. Verification
Four PDFs generated with review filenames, page-by-page QA: 0 empty pages, 0 orphaned headings, Spanish accents intact, correct caps 2/6/12/18. Digital Premium + mobile 375px verified previously. Tests: delivery + tier-differentiation + product-catalog + new report-template suite; tsc; build; `release:check`.
