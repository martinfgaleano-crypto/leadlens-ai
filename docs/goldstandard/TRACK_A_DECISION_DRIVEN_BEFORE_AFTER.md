# Track-A Decision-Driven Research — BEFORE / AFTER

**Verdict: PARTIAL (materially improved).** On the SAME two Track-A accounts, decision-driven
research closed the why-now gap with **grounded, dated SEC evidence** and moved both from
HOLD → VALIDATE for attributable reasons. The remaining gap narrowed to **commercial
access/mechanism grounding**, bounded by the dead paid-search environment.

## Control (previous profile-driven run)
Same customer (Track-A PMI consultancy). Accounts CECO Environmental and Hillman Solutions
were both **HOLD**: why_now = none, mechanism "not established", access "unknown", generic
Path to Prioritize, next action = none. (Chart was not in the control's selected set, so 2 of
the same accounts were used — within the §2 "2–3 accounts" bound.)

## Mechanism (smallest change, §31/§62)
`lib/intelligence/decision-driven-research.ts`: decision gaps → bounded, customer-context
objectives (`deriveResearchObjectives`) → **adaptive** bounded loop (`runResearchAgenda`,
trigger-first; mechanism/access skipped if no current trigger) → `applyFindingsToCaseInput`
builds better INPUTS to the EXISTING `synthesizeCase` authority (no decision-rule rewrite, §32).
Grounded live researchers (no paid search — all three providers are out of credits): **SEC
EDGAR free full-text 8-K search** for the M&A trigger (dated, primary source), and direct-HTTP
page extraction + one bounded LLM assessment for mechanism/access. 8/8 fixture tests.

## Live run (real pipeline, $0.007)
| Account | Before | After | Trigger (grounded) | Mechanism | Access |
|---|---|---|---|---|---|
| CECO Environmental | HOLD | **VALIDATE** | SEC 8-K referencing an acquisition filed 2026-08-10 (60d; current) | not_found (page not retrievable) | not_found |
| Hillman Solutions | HOLD | **VALIDATE** | SEC 8-K referencing an acquisition filed 2026-09-03 (36d; current) | SUPPORTED — own page confirms active acquirer ("Hillman Acquires Delaney Hardware") | partial |

## BEFORE / AFTER by dimension
| Dimension | Before | After | Improvement | Evidence |
|---|---|---|---|---|
| Decision | HOLD / HOLD | VALIDATE / VALIDATE | IMPROVED | current dated trigger → strategic-route-validate via synthesizeCase |
| Current opportunity | none | investigated + found | IMPROVED | SEC EDGAR 8-K hits, dated |
| Why now | none | SEC-grounded dated 8-K | IMPROVED | efts.sec.gov full-text 8-K |
| Commercial mechanism | not established | Hillman SUPPORTED; CECO not_found | IMPROVED (1/2) | Hillman own-page acquisition evidence |
| Buyer function | not established | not established | NOT DEMONSTRATED | no grounded source |
| Commercial access | unknown | CECO not_found; Hillman partial | NOT DEMONSTRATED | direct retrieval patchy; paid search dead |
| Counterevidence | none | actively checked (stale-trigger test) | IMPROVED | EDGAR recency check |
| Critical unknown | generic | account-specific (confirm the acquisition + mechanism/owning function) | IMPROVED | derived from resolved objectives |
| Path to Prioritize | generic | more specific (confirm the dated acquisition's integration work + mechanism/access) | IMPROVED | objective results |
| Next action | none | "Validate the mechanism/owning function before outreach" | IMPROVED | decision + remaining unknown |

## Decision-change attribution (§21)
Both HOLD → VALIDATE because a **current, dated acquisition-referencing SEC 8-K** was found
(CECO 60d, Hillman 36d), establishing a current trigger (strategic route to validate), while
mechanism/access remain unverified → VALIDATE, not PRIORITIZE. The canonical bar decided this
via `synthesizeCase`; nothing was forced.

## Claim-source audit (§38) — the one caveat
- **SUPPORTED:** the *existence and recency* of an acquisition trigger (SEC EDGAR, dated, primary source) for both accounts; Hillman's active-acquirer status (own page).
- **PARTIAL:** Hillman's decision-critical brief states a **specific deal** ("Kanebridge, $315M, August 2026"). That specificity comes from the **cached LLM-profile enrichment**, not the DDR loop; the DDR/EDGAR layer independently corroborates that *a* recent acquisition 8-K exists, but the specific terms are not source-cited in the artifact. Recommend labeling the specific figures as inference/unverified until a filing is cited. This is a pre-existing profile-layer claim, surfaced — not produced — by this experiment.
- **UNSUPPORTED:** none introduced by the DDR loop (mechanism/access honestly not_found where ungrounded).

## Overclaim red-team (§40)
"buying" appears only inside the calibrated Path-to-Prioritize phrasing ("active buying/onboarding route") — not an intent claim. The why_now is phrased "a recent 8-K **referencing** an acquisition," not "confirmed completed acquisition." 0 forbidden customer-language tokens. Exec summary: "0 prioritize · 2 validate · …".

## Customer-specificity (§36)
The agenda is service-derived: trigger family = acquisition/carve-out/merger; mechanism hints = integration management office / corporate development; buyer-function hints = integration management / operations. A different service (e.g. ESG audits → regulation triggers) produces different queries — asserted by the fixture test.

## Quality rubric
Current Opportunity PASS · Why-Now PASS · Commercial Mechanism PARTIAL (1/2) · Buyer Function FAIL · Commercial Access FAIL · Decision-Critical Evidence PASS · Counterevidence PARTIAL · Uncertainty PASS · Decision Coherence PASS · Actionability PARTIAL · Customer Specificity PASS · Claim-Source PARTIAL (the Kanebridge caveat).

## Economics
Spend this run **$0.007** (EDGAR + direct_http are free; ~2 bounded LLM assessments). Per account ≈ $0.0035. Deeper Intelligence did NOT destroy economics — the opposite.

## Single biggest remaining gap
**Commercial access + buyer-function grounding.** The why-now/trigger dimension is now solved with a free primary source; mechanism/access need a working retrieval/search path (paid search is out of credits; direct retrieval is patchy). This is a provider/evidence-availability bottleneck, not a decision-logic gap.

## Artifacts
- `output/goldstandard/track-a/LeadLens_TrackA_GoldStandard_AFTER.pdf` (2 accounts, VALIDATE/VALIDATE)
- `output/goldstandard/track-a/track-a-before-after.json`
- Control: `output/goldstandard/track-a/LeadLens_TrackA_GoldStandard_Premium.pdf` (preserved)
- Scripts: `scripts/track-a-decision-driven-run.mts`; module `lib/intelligence/decision-driven-research.ts`.
