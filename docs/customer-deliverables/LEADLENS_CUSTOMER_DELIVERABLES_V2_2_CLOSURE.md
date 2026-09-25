# LeadLens — Customer Deliverables V2.2 · Final Product Closure

**Template:** `CUSTOMER_DELIVERABLES_V2_2` (supersedes `CUSTOMER_DELIVERABLES_V2_1`) · **State:** `FOUNDER_REVIEW` (not approved) · Branch `deliverables-v2.2-closure`. Presentation-only; no pricing/entitlement/credit/Intelligence-generation/Vault/tenant change.

Closes the two P0 product problems from the founder's V2.1 review plus the observed defects.

## P0-A — Cover hierarchy (product identity, not the finding)
Before, the cover title was the decision distribution ("5 accounts to validate of 6 evaluated"). Now the cover leads with the **product** the customer bought — sourced from `lib/products/catalog.ts`:
- Title = product name (Opportunity Preview / Opportunity Brief / Opportunity Portfolio / Commercial Intelligence Dossier).
- Descriptor = the approved catalog `product_promise` (validate → select → prioritize → strategize).
- Commercial context = market + objective.
- The decision distribution is now a **secondary "Decision snapshot" band** (bar + legend). The title is correct for any decision mix (0 prioritize, all validate, only hold, etc.).

## P0-B — Tier value (not just a company list)
- **Canonical contract audit:** the source of truth is `lib/products/catalog.ts` (`launch_tier_architecture_v0`). Prices/allowances verified: Preview $7/2 · Brief $25/6 · Intelligence(Portfolio) $59/12 · Premium $129/18 (unchanged).
- **`lib/products/tier-contract-matrix.ts`** derives, from the catalog, each capability's **delivery surface** (report / workspace / eligible) and **status** (rendered / app_live / contracted_not_rendered).
- **In-report "What's included" band:** every tier's report now shows its value verb + the capabilities actually delivered *in this report*, and (Intelligence/Premium) a separate **"In your LeadLens workspace"** list — Account Memory (accounts remembered for your next review) and Monitor-eligibility (recurring updates *available on a Monitor plan* — not an included subscription, §9). The band is derived from the **actually composed sections**, so it never claims a section the tier omits.
- **Admin tier-contract matrix:** `Admin → Deliverables → Report Templates` now exposes the per-tier matrix — In report / Workspace / **Contracted-not-rendered (HQ gap)**. Premium honestly shows 10 contracted-but-not-yet-rendered capabilities (deep dossiers, coverage gaps, portfolio risk, momentum, decay, market patterns, playbooks, stakeholder hypotheses, discovery questions, watchlist) — surfaced to HQ (§11), never advertised to customers as delivered.

## Defect closure
| # | Defect | Layer | Fix |
|---|---|---|---|
| 28 | Premium English leak "…could strengthen the case" in ES | renderer (frozen text) | localized via `locFrozen` (frozen Intelligence unmodified). |
| 29 | John Deere HOLD vs "worth validating now" | **upstream Intelligence** | Decision kept **HOLD verbatim**; the HOLD is explained from the canonical reason (`hard_blocker_stale_beyond_180d` → "event older than 180 days, timing not defensible"); the contradictory `why_now`/`next_action` prose is NOT used as the rationale. **Upstream defect flagged to HQ:** the artifact's `commercial_analysis` was written as if timing were current, contradicting the stale-blocked HOLD. |
| 30 | Portfolio copy "…primero priorizar primero, luego validar" | composer/fixture | allocation line now `line: detail`. |
| 31 | Long source URLs split awkwardly | renderer | readable label + date + **clickable shortened URL** (full URL in the link annotation). |
| 32 | Fit×Timing 18-point collisions | renderer | jittered **numbered** markers keyed to the table `#` — all 18 individually identifiable; ordinal semantics preserved (no fake precision). |
| 33 | Off-target company in the synthetic full order | fixture | replaced Agroexport Urabá (outside the Caribbean) with an on-target Caribbean case; all 18 satisfy the target criteria. |

## Evidence & metric integrity (preserved)
Tier-scoped headline + coverage, source-count reconciliation, computed recency, missing-date honesty, corroboration semantics — all preserved and test-guarded (`report-template-v2` 61/61).

## Real vs synthetic (unchanged separation)
- **Preview + Brief:** REAL controlled-acceptance data (6 US companies; decisions verbatim — 5 validate, 1 hold). Not a paid customer report.
- **Portfolio + Premium:** SYNTHETIC design sample (real 12/18 full-order artifacts not preserved on disk). Clearly labeled.

## Four PDFs
`LeadLens_{Preview,Brief,Portfolio,Premium}_V2_2_Review.pdf` — pages 3/7/9/13 · 0 empty · 0 orphaned headings · clickable source links · English (real) / Spanish (synthetic).

## Admin
Template `CUSTOMER_DELIVERABLES_V2_2` (supersedes V2_1) · `FOUNDER_REVIEW` · Synthetic/Real toggle · ES/EN toggle · per-tier Preview/Download · tier-contract matrix. Deterministic; no credit; authorization enforced.

## Known limitations (≤5 material)
1. Premium (and Intelligence) have contracted-but-not-yet-rendered capabilities (playbooks, momentum, decay, deep-dossier depth, etc.) — surfaced in the Admin matrix as an **HQ product gap**, not delivered.
2. John Deere exposes an **upstream Intelligence consistency defect** (stale-HOLD vs current-timing prose) — presented honestly; the fix belongs upstream (frozen Intelligence), flagged to HQ.
3. Real data covers Preview + Brief only (6 real cases); Portfolio/Premium remain synthetic.
4. PDF summarizes per-source relations vs the digital per-claim matrix (claim-traceable, not misleading).
5. Not founder-approved until the four PDFs are accepted (`FOUNDER_REVIEW`).
