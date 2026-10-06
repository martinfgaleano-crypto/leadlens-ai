# Amor de Gea — Pilot 2 Final Closure

**Status: CLOSED** · **Outcome: PARTIAL** · **Date closed: 2026-10-05** · **Final HEAD: see git (branch `pilot/amordegea-pilot-2-us-export`)**

This document formally closes LeadLens Pilot 2. Research is closed; engineering is
closed except the operational items listed under *Remaining items*. No further
Pilot 2 sprint is recommended.

## Objective
Help Amor de Gea (premium botanical / natural specialty beverage producer) evaluate
**commercial expansion into the United States (national)**: identify credible
commercial routes, buyer functions, verified access mechanisms, and the accounts
worth attention — with evidence discipline, not persuasion.

## Customer context available
Offer and category known; **US product/regulatory classification UNKNOWN** (carried
as a customer dependency, never fabricated). Importer-of-record model, landed
economics / target margin, and MOQ / case-pack compatibility all unresolved
(customer-side inputs).

## Research scope (bounded, now closed)
Bounded Brave-led discovery + Firecrawl extraction across 9 route hypotheses and
13 queries; account-level eligibility (3-outcome: eligible / research_more /
exclude); canonical decisioning; a separate Market Research Universe pass. No new
research was performed during closure.

## Canonical lineage (the 6-vs-15 resolution)
- **Market Research Universe (MRU)** — `amor-de-gea-us-2026-10-01`, generated
  2026-10-01T00:45Z. 72 sources · 47 ecosystem/account entities · 9 routes.
- **Account research universe** — 47 domains observed (eligibility not implied).
- **Selected portfolio** — the latest valid canonical customer job
  `cj_amordegea_pilot2_1790815841047` (updated 2026-10-01T00:55Z): **6 accounts**.
- An earlier 15-account artifact (`output/pilot2/2026-09-30-final2`) was
  **superseded** by a legitimate eligibility narrowing to 6; the 6-account job is
  the latest persisted canonical state and the same run cycle that produced the MRU.
  **The 6-account portfolio is canonical.** The MRU's own `selected_population=17`
  is stale prior-portfolio metadata the MRU explicitly keeps separate; it is never
  used as the delivered portfolio count.

## Final research result (no stale counts)
| Measure | Value |
|---|---|
| Market sources | 72 |
| Routes researched / supported | 9 / 9 |
| Ecosystem + account entities | 47 |
| Buyer functions identified | 24 |
| Verified commercial mechanisms | 3 |
| Verified access paths | 3 |
| Independent corroboration achieved | 3 |
| Qualified / selected accounts | 6 |

## Final decision distribution (tier-local, canonical)
**Prioritize 0 · Validate 2 · Monitor 1 · Hold 3** (of 6 selected).

## Actionability result
**No evidence-qualified PRIORITIZE account exists.** This is an honest finding, not
a failure to run: LeadLens did not find an evidence-qualified act-now opportunity
from the available public evidence under the current customer context. Portfolio
and Premium are therefore **NOT ACTIONABILITY-READY** (they require ≥1 evidence-
qualified PRIORITIZE); capacity status (6/12, 6/18) is reported separately and is
not padded.

## Market intelligence learned
Premium natural/specialty grocery is the strongest-evidenced US route; wellness
hospitality and gifting are weaker/again structural-only. The US natural/specialty
top-of-search is heavily saturated. Verified **access** exists (official supplier
intake) but is **not buying intent**.

## Route intelligence
9 routes researched, all with some support; strongest = natural/specialty grocery
(verified supplier mechanisms). Weak/structural-only = wellness hospitality, hotel/
spa, corporate gifting (route plausibility without verified access or dated events).

## Commercial mechanisms
- **Verified (3):** Natural Grocers, Sprouts, Whole Foods — official supplier /
  new-item submission mechanisms.
- **Found-unverified / not found:** remaining 6 researched routes.

## Commercial access
- **Verified (3):** official supplier/product submission pages for the three
  grocers above.
- **Unknown:** everything else. Access ≠ buying intent (made explicit in prose).

## Customer dependencies (unresolved, customer-side)
US product/regulatory classification · importer-of-record model · landed
economics / target margin · MOQ / case-pack compatibility.

## Semantic remediation (this closure session)
Fixed at the presentation layer (no decision/evidence/count changes):
- Legacy decision taxonomy (act-now / investigate / reserve / reject) — **removed**;
  allocation now derives from canonical Prioritize/Validate/Monitor/Hold counts.
- WARM/HOT/COLD tier labels — **removed**.
- Opaque `/10` scores, "average score", "highest-scoring" — **removed**.
- Spanish debug prose in the English deliverable — **translated** (bounded frozen
  rationale templates), Spanish deliverables unaffected.
- Internal reason codes (`validate_source_first`, `monitor_for_new_signal`,
  `exclude`, …) — **mapped to customer prose**.
- "1 act now" contradiction with Prioritize=0 — **eliminated** (one decision system).
- Tier-count leakage ("three monitor-tier…") — **eliminated**; the executive summary
  is now derived deterministically from tier-local canonical counts.
- "Source URL unavailable" placeholder — **replaced** with "Contextual reference".

Implemented generically in `lib/delivery-system/customer-language.ts` +
`deriveAllocation` (`lib/products/report-experience.ts`) + the deterministic
tier-local executive summary in `lib/delivery-system/renderers/pdf.ts`. Verified by
extracted-text QA on the delivered PDFs (`scripts/pilot2-verify-pdfs.mts`) and unit
suites (`customer-language`, `pilot2-mru-closure`, `pilot-depth`).

## Visual intelligence present (each answers a commercial question)
| Visual | Tier | Question | Source |
|---|---|---|---|
| Decision distribution bar + legend | Preview→Premium | Where is attention allocated? | canonical decisions |
| Evidence-coverage bars (sourced/dated/mechanism/verified-access) | Portfolio, Premium | Where does evidence break down? | canonical evidence coverage |
| Commercial routes table (accounts, P/V, mechanism, access, evidence) | Portfolio, Premium | Which routes have real access? | canonical market intelligence |
| Market route map (route → buyer function → account) | Portfolio, Premium | How do routes connect to accounts? | canonical market map |
| Account benchmark table (decision × dimensions) | Portfolio, Premium | Why does one account deserve more attention? | canonical benchmark |
| MRU: route research coverage + verified mechanisms/access + commercial depth | Premium | What did LeadLens learn about entering this market? | Market Research Universe |
| Customer dependencies | Premium | What customer facts block stronger conclusions? | MRU dependencies |

(These are vector/table/bar renders with real labels — not decorative charts. No
opaque scores, no fake precision.)

## The four final deliverables — `output/pilot2/FINAL-CLOSED/`
| Tier | Accounts/cap | Pages | Bytes | Decisions | Actionability |
|---|---|---|---|---|---|
| Preview_FINAL | 2/2 | 3 | 13,279 | Validate 2 | n/a (no PRIORITIZE required) |
| Brief_FINAL | 6/6 | 7 | 33,678 | Validate 2 · Monitor 1 · Hold 3 | n/a |
| Portfolio_FINAL | 6/12 | 9 | 43,876 | Validate 2 · Monitor 1 · Hold 3 | **NOT READY (0 PRIORITIZE)** |
| Premium_FINAL | 6/18 | 12 | 60,849 | Validate 2 · Monitor 1 · Hold 3 | **NOT READY (0 PRIORITIZE)** + full MRU |

Directory also contains `canonical-report.json`, `market-research-universe.json`,
and `closure-metrics.json` for reproducibility.

## What worked
Evidence discipline (no forced PRIORITIZE), honest market/route/access intelligence,
the Market Research Universe as a genuine differentiator, canonical decision
integrity end-to-end, and a reusable render chain.

## What failed / was overbuilt
Zero evidence-qualified PRIORITIZE (acceptable, but no act-now value). The pilot's
**cycle time was far too long** — many research/architecture sprints for one
customer. Customer-facing semantic hygiene was not enforced at the presentation
boundary until this closure (two decision systems, baked scores, Spanish leakage).

## <24h production implications
Future customer jobs must terminate on bounded stop conditions and never re-open
research to chase a PRIORITIZE. Each stage (market → routes → discovery →
eligibility → deep research → mechanism → access → corroboration → decisioning →
bounded actionability escalation → intelligence → composition → QA → render) needs
an explicit budget/cap and a terminal state: RESEARCH EXHAUSTED · INSUFFICIENT
EVIDENCE · CUSTOMER INPUT REQUIRED · NO ACTIONABLE OPPORTUNITY FOUND. The closure
render itself ran at **$0 / seconds** from the canonical foundation — proof the
*delivery* path is already within envelope; the *research* path is what overran.

## Reusable (keep)
Market Research Universe engine + selected-vs-market separation; canonical
intelligence delivery + tier scoping; `customer-language.ts` sanitizer + canonical
`deriveAllocation` + tier-local executive summary; the extracted-text PDF QA gate;
the render-only closure/verify scripts.

## Do NOT repeat
Unbounded research; two decision systems; opaque scoring; language leakage; padding
tiers; manufacturing actionability.

## Final outcome
**PARTIAL.** Genuine, reusable market/route/access intelligence and real customer
decision value (it tells Amor de Gea *not* to commit outbound yet and exactly which
validation questions and access routes matter), plus an honest "no act-now
opportunity" finding — but zero evidence-qualified PRIORITIZE and an excessive pilot
cycle time. The four PDFs are clean, canonical, and ready for founder review; a real
customer send is the founder's decision.
