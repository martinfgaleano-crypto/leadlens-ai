# LeadLens — Customer Deliverables V2.1 · Final Commercial & Visual Review

**Template version:** `CUSTOMER_DELIVERABLES_V2_1` (supersedes `CUSTOMER_DELIVERABLES_V2`) · **State:** `FOUNDER_REVIEW` (not approved) · **Effective:** 2026-09-24 · Branch `deliverables-v2.1-commercial`.

Presentation-only. No change to pricing, entitlements, credit consumption, canonical decisions, Intelligence generation, Vault, or tenant isolation. All sample artifacts use **synthetic data** (fictional companies, `example.*` sources).

This iteration implements the founder/HQ review of the V2 PDFs. Each finding was traced to its true source — **synthetic fixture (A)**, **presentation/composer (B)**, or **frozen Intelligence (C)** — and fixed at that layer.

## Findings → resolution

| # | Finding (V2) | Source | Fix (V2.1) |
|---|---|---|---|
| 1 | Cover headline "1 cuenta prioritaria" vs 5 prioritize | A (fixture) | Headline now **derived** from the real distribution: "3 cuentas para priorizar y 5 por validar de 18 evaluadas". Test guards it. |
| 2 | Evidence coverage identical across tiers | **B (composer)** | `composeForTier` now **recomputes coverage over the tier's own companies** (`recomputeCoverage`) — Brief 6/5/3, Portfolio 10/10/6, Premium 18/13/8. |
| 3 | Recency "latest 4d" vs August dates | A (fixture) | All recency is **computed from the event/source date** vs the report date (`hace 11 d`, `hace 27 d`). |
| 4 / 11 | Source counts don't reconcile with listed sources | A (fixture) | `sourceCount` = the number of listed sources (always reconciles); independent support is carried by `corroborated`, not a smaller count. |
| 5–9 / 12 | Repetitive theses, weak differentiation | A (fixture) | New **curated 18-case fixture**: distinct sectors, decisions, evidence situations (strong/dated, weak, contradictory, no-trigger, missing-date), each with its own thesis. Test asserts theses are unique. |
| 10 | Mixed English/Spanish labels | **B (renderer)** | The PDF renderer is **fully localized** (sections, chips, decision labels, strength values, footer, table headers) driven by report language. Test asserts no English leaks in ES. |
| 20 | Generic "plant-expansion" validation for every sector | A (fixture) | **Sector-appropriate** validations (logistics slotting, distributor territories, channel alliance, furnace modernization, customs-yard flow…). |
| 13 | Missing-date honesty | A/B | No dated source ⇒ **no recency claim** (latestAge null); dates never inferred from retrieval. |
| 45 | Premium tensions repeated per company, in English | **C (frozen Intelligence)** | Not rewritten. The renderer **groups** companies sharing a tension into one line and **localizes** the known frozen strings + decision cluster keys at presentation. |
| 22 | On/off-target relevance | A | Off-target cases (e.g. Agroexport Urabá outside the Caribbean) are labeled and reflected in a low decision, not inflated. |

## Data integrity (verified by `report-template-v2` suite, 37/37)
- Headline reflects the real prioritize count (no overstated "1 priority").
- Tier-scoped coverage & counts (Brief ≠ Premium; scoped to ≤ tier size).
- `sourceCount` reconciles with listed sources; dated ≤ listed; no-date ⇒ no recency.
- ES has no English label leaks; ES and EN renders differ.
- Deterministic render; Admin routes fail closed (403) unauthenticated.

## Frozen-Intelligence dependency (HQ)
The Premium "Decision Context" tension notes and scope note are produced in **canonical English** by `lib/intelligence/premium/premium-decision-architecture.ts` (frozen). V2.1 does **not** modify that layer; it presents the output better (grouped + localized). A durable fix — language-aware, per-account premium synthesis — is an **HQ decision** for the Intelligence layer, documented here.

## Tiers (frozen contract preserved)
Preview 2·$7 · Brief 6·$25 · Portfolio 12·$59 · Premium 18·$129. Pages (sample, content-aware): Preview 3 · Brief 6 · Portfolio 9 · Premium 13. Premium differentiates by the additional Decision Context (executive context, grouped tensions, sector-specific validation priorities), not by a badge or color.

## Admin
`Admin → Deliverables → Report Templates`: version `CUSTOMER_DELIVERABLES_V2_1` (supersedes V2), state chip, ES/EN toggle, per-tier Preview/Download PDF (deterministic sample, no credit). `GET /api/admin/deliverables/template` + `…/template/preview` — admin-only (403 unauth, 200 authorized, verified e2e).

## Known limitations
- Synthetic sample (layout + variety only).
- PDF language coverage = Latin-1 (English + Spanish); CJK etc. need an embedded font (never silently stripped).
- Premium synthesis text originates English in frozen Intelligence (grouped/localized at presentation).
- `FOUNDER_REVIEW` — not production-approved until the four PDFs are accepted.

## Verification
Four ES + four EN PDFs generated (`LeadLens_{tier}_V2_1_Review.pdf`): 0 empty pages, 0 orphaned headings, accents intact, no ES English leaks, caps 2/6/12/18. `report-template-v2` 37/37; tsc; build; `release:check`.
