# LeadLens — Customer Deliverables V2.3 · Contract Fulfillment

**Template:** `CUSTOMER_DELIVERABLES_V2_3` (supersedes V2_2) · **State:** `FOUNDER_REVIEW` · Branch `deliverables-v2.3-contract`. Presentation/delivery-layer only; no pricing/entitlement/credit change; frozen Intelligence V1 generation not rebuilt.

Closes the V2.2 gap: capabilities that were *contracted but not rendered* are now either **delivered from existing canonical data**, **honestly deferred** to their true surface, or **flagged to HQ** as a real generation gap — with the tier-contract matrix telling the truth about each.

## Capability closure (data lineage → decision)
The customer data model (`AccountBriefVM` / `DeliverableViewModel`) does **not** carry momentum/decay/coverage-gaps/portfolio-risk/market-patterns/playbooks/stakeholder/watchlist fields; the Premium section carries clusters + contradictions + validationPriorities + optional context. Each contracted capability was routed to the correct outcome:

| Capability | Before (V2.2) | After (V2.3) | How |
|---|---|---|---|
| Coverage gaps | contracted, not rendered | **DELIVERED** (Portfolio/Premium) | derived from existing per-account evidence (no dated evidence / no corroboration / limited) — `deriveCoverageGaps`. §15. |
| Portfolio risk | contracted, not rendered | **DELIVERED** (Portfolio/Premium) | thin/uncorroborated actionable accounts, stale-signal accounts, segment concentration — `derivePortfolioRisk`. §16. |
| Playbooks | contracted, not rendered | **DELIVERED** (Premium) | structured from each actionable account's OWN fields (objective / why / validate / hold-if / next step) — `derivePlaybooks`. Invents no purchasing process (§19). |
| Discovery questions | contracted, not rendered | **DELIVERED** (mapped) | the per-account decision-critical validations already rendered are the discovery questions. §21. |
| Momentum / Decay | contracted, not rendered | **HONESTLY DEFERRED** | require observation history — a one-time report has none; shown as a **Monitor (recurring)** capability, never a fabricated trend. §17. |
| Opportunity clusters / Decision context | rendered | rendered | Premium synthesis (unchanged). |
| Market patterns | contracted, not rendered | **CONDITIONAL** | Premium research context (benchmark/competitors/ecosystem) — rendered when present, honest "no additional context" when null (usually null). §18. |
| Deep dossiers (deeper corroboration) | contracted, not rendered | **HQ GAP** | needs additional research depth — not fabricated. |
| Stakeholder hypotheses | contracted, not rendered | **HQ GAP** | needs generation; not fabricated (no invented roles/names). §20. |
| Watchlist | contracted, not rendered | **APP / Monitor** | a workspace/Monitor capability (Premium `watchlist:initial`), not a PDF section. §11. |
| Account Memory | app | **APP (live)** | Account Memory V1 is production; shown as a workspace capability, not a PDF badge. §10. |

**No capability is marked delivered because its name appears in a report or matrix** (§10/§12). The Admin matrix distinguishes `rendered` / `app_live` / `contracted_not_rendered`, and the remaining gaps (deep dossiers, stakeholder hypotheses, momentum/decay-in-report, market-patterns generation) are surfaced to HQ.

## Decision/rationale integrity (John Deere class, §24-28)
- **Root cause:** the artifact's `commercial_analysis` (`why_now`/`next_action`) was written as if timing were current, contradicting a HOLD grounded in `hard_blocker_stale_beyond_180d`.
- **Correction at the seam (not PDF-only):** a canonical, channel-agnostic guard `lib/deliverable/decision-consistency.ts` (`reconcileAccounts`) is applied in **`fromDeliverableViewModel`** — the single point every customer report (digital + PDF, real + synthetic + production) passes through. For a HOLD/MONITOR with stale/thin evidence, a next step asserting an immediate trigger ("validate now", "before outreach", ES equivalents) is replaced with a decision-consistent, honest one. **The canonical decision is never changed; no event is fabricated; uncertainty is preserved.**
- **Regression matrix (§27):** prioritize/validate with sound rationale untouched; HOLD+stale+trigger flagged & reconciled; HOLD without trigger prose left alone; the real John Deere is hold-consistent via the seam. (`report-template-v2` 77/77.)

## Real full-order acceptance (§29-34)
- **Preview + Brief:** REAL controlled-acceptance data (6 US companies; decisions verbatim).
- **Portfolio (12) + Premium (18):** **RENDERER ACCEPTANCE** on synthetic data. **FULL-ORDER COMMERCIAL ACCEPTANCE remains BLOCKED:** no 12/18-company canonical customer report is preserved on disk (on-disk `customer-e2e-*` = run diagnostics with ≤3 Lead-Hunter accounts; `positive-control-*` = research telemetry; the 6-case review package is the only canonical set). Real full-order content lives in Supabase; recovering it safely needs a live disposable-account run (not executed here — no rerun, no credit, no customer-data exposure). Reported honestly per §34; not fabricated.

## Four PDFs
`LeadLens_{Preview,Brief,Portfolio,Premium}_V2_3_Review.pdf` — pages 3/7/10/15 · 0 empty · 0 orphaned headings · clickable source links · REAL (Preview/Brief) vs SYNTHETIC (Portfolio/Premium) labeled.

## Admin
Template `CUSTOMER_DELIVERABLES_V2_3` · `FOUNDER_REVIEW` · tier-contract matrix updated (rendered vs app vs HQ-gap) · Synthetic/Real + ES/EN toggles · deterministic · authorized.

## Known limitations (≤5)
1. Deep-dossier depth, stakeholder hypotheses, and in-report momentum/decay require new Intelligence generation — **HQ gap**, not delivered (not fabricated).
2. Market patterns depend on premium research context that is usually null (honest "no additional context").
3. Portfolio/Premium are RENDERER-accepted on synthetic data; real full-order (12/18) acceptance needs a live disposable-account run (Supabase).
4. The John Deere fix is a delivery-seam guard; the durable upstream fix (Intelligence not emitting contradictory prose) is an HQ decision.
5. `FOUNDER_REVIEW` — not production-approved.
