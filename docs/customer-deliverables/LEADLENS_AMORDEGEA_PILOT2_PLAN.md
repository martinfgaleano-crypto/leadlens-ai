# LeadLens — Amor de Gea Pilot 2 (US Export) — Plan & Readiness

**State:** PLANNED · FOUNDER_REVIEW · **NOT AUTHORIZED for live research** (mirrors the existing
`AMOR_PILOT1_FINAL.pilot2` stub: `state: "PLANNED — NOT AUTHORIZED"`, `accounts: []`, `provider_calls: 0`).
Isolated branch `pilot/amordegea-pilot-2-us-export` (docs-only; does not touch billing/OTP/Lemon/V2.4 work — §54).

This document is a **plan grounded in real, verified Pilot 1 sources** — not a deliverable. It does **not**
contain US accounts, buyers, volumes, margins, or compliance conclusions, because those require the real
LeadLens pipeline (live research) and must never be fabricated (§0, §49–53, §70).

## 1. Material gates before Pilot 2 can be *completed* (honest state)
1. **Pilot 1 feedback — RECEIVED (real).** The founder provided the completed responses (respondent
   **Juliana Maya Zuluaga**, Directora/Fundadora, Sep 2026), now persisted canonically in
   `lib/intelligence/amor-de-gea-pilot1-feedback.ts` (ratings: prioritization/context/clarity/pilot2-likelihood/
   value-vs-DB = 5; utility/relevance/briefs/evidence/confidence = 4). The repo `/public` PDF is the **blank
   instrument** and is not the source. The reconciliation and Admin workspace surface the real values.
   *(This gate is now closed.)*
2. **Live US-export research supply.** Producing 2/6/12/18 real qualified US accounts requires
   running the LeadLens pipeline live (provider spend; throttled same-day quota; and an ICP — *US buyers/channels for a
   Colombian premium botanical export* — that the frozen Intelligence V1 was validated for US mfg/logistics, **not** this).
   No spend budget is set for this sprint. Fabricating accounts is prohibited (§53/§70). This is the gate for Phases D–H.

## 2. Verified Amor de Gea context (from `lib/intelligence/amor-de-gea-pilot1-finalization.ts`, not memory — §7)
- **Product:** premium botanical/wellness **liquid**, sold in **glass** packaging; small pilot sizing (~50 units referenced).
- **Positioning:** premium, non-medical language required (regulatory-safe claims).
- **Pilot 1 market:** **Colombia domestic B2B**. Routes evaluated: **spa/hospitality**, **retail natural/bienestar**,
  **corporate gifts**, **retail/fitoterapia**.
- **Pilot 1 portfolio (10):** first-validation — Éteka, Celestino Hotel Boutique & Spa, Sinergy On, Vitálica; strategic —
  Ser Saludable, Masaya Collection, Natural + Mente; investigate — Hotel Charleston Santa Teresa Spa, Habibi Plantitas, Funat.
- **Excluded (5):** BioPlaza, Distribuidora DAM, Hotel Spa La Colina, Tu Tienda Saludable, Somos Consiente.
- **Repeat-suppression (§ Pilot-2 rule "no repetir las mismas cuentas"):** all 15 above are already in the Pilot 1
  `pilot2.account_memory` with `repeat_suppression: true`. Pilot 2's US universe must exclude them (they are Colombia
  domestic anyway, so this is naturally satisfied).
- **Customer contact:** Juliana. **Relationship disclosure standard (reuse verbatim):** LeadLens has not confirmed prior
  commercial relationships; the customer confirms relationship/exclusion/conflict before outreach.

## 3. New objective interpretation (§5) — reframe, don't copy
**"Amor de Gea wants to begin exporting from Colombia to the United States."** Interpreted as commercial intelligence
(not logistics): *which US commercial routes and account types deserve attention for a premium Colombian botanical
liquid in glass, under Amor de Gea's real constraints — and what must be validated before outreach.* Canonical decision
semantics are preserved at the **route** and **account** level: PRIORITIZE / VALIDATE / MONITOR / HOLD.

## 4. Constraint reinterpretation for US export (§8) — typed as COMMERCIAL_INFERENCE (to validate, not fact)
- **Glass packaging:** Colombia = local transport constraint → US export = international **freight breakage risk,
  case-pack/weight, handling, warehouse/retailer receiving requirements**. Materially raises minimum viable shipment
  economics. (INFERENCE — validate with a freight/importer quote.)
- **MOQ (~50 units pilot):** Colombia = buyer pilot sizing → US export = a 50-unit international shipment is likely
  **below the economic threshold** for importer/distributor viability; pilot economics must be recomputed. (INFERENCE.)
- **Premium positioning:** Colombia = channel fit → US = **category competition + import price stack** (freight + duty +
  importer/distributor margin layers) can erode premium shelf economics; positioning must survive the landed-cost stack.
  (INFERENCE — validate against route economics.)

## 5. US route HYPOTHESES to research (§21) — hypotheses, not conclusions, no named accounts
Routes to evaluate and rank (PRIORITIZE/VALIDATE/MONITOR/HOLD) **only after real research**: specialty/premium natural
retail; hospitality/spa & wellness hospitality; premium/corporate gifting; specialty importers & Latin-American specialty
distributors; boutique grocery. Each must be evaluated on: strategic + commercial fit, buyer type, likely order structure,
pilot feasibility, import/logistics complexity, buyer accessibility, time-to-first-order, evidence availability, and key
unknowns (§22). **Do not assume Pilot 1's Colombia routes transfer.**

## 6. Import/compliance FRAME (§18–20) — categories only, with the mandatory disclaimer
**Product classification is UNCERTAIN** from current context (a "botanical liquid" could be a conventional food/beverage,
a dietary supplement, or a cosmetic — each carries different US requirements). Per §18, classification must be established
from customer truth + product evidence **before** any requirement conclusion. LeadLens provides **commercial** intelligence,
not legal advice (§20): the following are **categories commonly applicable to US food/supplement imports that require
specialist confirmation for Amor de Gea's exact classification** — not verified requirements: FDA facility registration;
prior notice of imported shipments; FSVP / importer of record; labeling + claims (non-medical); ingredient review; tariff
classification + duties; state distribution requirements. **No specific compliance conclusion is issued here.**

## 7. Pilot 1 → Pilot 2 map (§4) — against the feedback INSTRUMENT (responses pending)
| Instrument dimension (Pilot 1 form) | Current LeadLens capability | Pilot 2 treatment | Generalizable? |
|---|---|---|---|
| Account relevance to capacity/routes | ICP + qualification + geo gate | US-route-scoped universe | Yes |
| Prioritization (validate-first) | canonical PRIORITIZE/VALIDATE/MONITOR/HOLD | route + account decisions | Yes |
| Buyer function / entry route | inferred **stakeholder functions** (Premium, no named people) | buyer-function + buyer-access classification (§28) | Yes |
| Evidence credibility / dated sources | source + freshness + counterevidence | unchanged discipline | Yes |
| Commercial prep (price/MOQ/docs/customization/glass) | **new** constraints envelope (Intake V1) | "commercial constraints / unknowns" module | Yes |
| "No repetir las mismas cuentas" | account memory + suppression | suppress the 15 Pilot 1 accounts | Yes |
| Route preference (hotelería/retail/gifting/distribution) | route-level decisions | US route analysis + prioritization | Yes |

Every row is generalizable to any customer entering a new geography (§39) — none is Amor-de-Gea-specific product work.

## 8. Deliverables plan (§32–36) — one canonical foundation, four tiers, V2.4 renderer
When authorized: one real US-export intelligence foundation → composed into Preview(2)/Brief(6)/Portfolio(12)/Premium(18)
via the **existing** V2.4 tier composer + renderer (`renderPdfBuffer`) — **no** Pilot-2 template, cover, or design language
(§1/§37). New content is delivered as **content modules** inside the canonical system (§38): US Entry Context, Commercial
Route Map, Buyer Access, Import/Compliance Dependencies (framed per §6), Route Economics Questions, US Validation Plan —
each of which would benefit any new-geography customer (§39). Tiers stay PILOT/FOUNDER_REVIEW (§73). Supply honesty:
if fewer than 2/6/12/18 valid US accounts exist, state it — never force the count (§53).

## 9. Next action (single)
**Founder decision required on the two gates:** (a) provide the real Pilot 1 customer feedback (or confirm it is not yet
available), and (b) authorize a bounded live US-export research run with a spend budget and confirm Amor de Gea's product
classification — after which Pilot 2's four real tiers can be generated through the canonical pipeline + V2.4 renderer.
Until then, the reusable **Customer Context Intake V1** (`docs/customer-context/LEADLENS_CUSTOMER_CONTEXT_INTAKE_V1.md`)
is the shippable, generalizable product increment from this sprint.
