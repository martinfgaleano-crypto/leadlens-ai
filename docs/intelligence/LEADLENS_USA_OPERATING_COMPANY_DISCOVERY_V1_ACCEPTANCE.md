# LeadLens — USA Operating-Company Discovery V1 Acceptance

Sprint verdict: **PARTIAL**. The USA universe collapse was reproduced under a controlled live A/B; the
report-SEO **root cause was confirmed** and one directional lever (dropping the buyer-category query
prefix) was found — but its recall gain was **not robust** (provider variance) and it broke the
objective-specific query contract, so it was **not shipped**. A real, generalizable **identity-precision
defect** exposed by the experiment was fixed and shipped. USA productive recall is **not closed**;
the durable lever is account-first operating-company enumeration (deferred, new architecture).

Branch `intelligence-launch-acceptance-v1` · start HEAD `89ad136` · end HEAD `5eb02c7` · worktree
`leadlens-landing-v2`. No push. No merge. Frozen core, Billing/Pricing, other worktree untouched.

## Providers
Brave **HEALTHY** · Tavily **HEALTHY** (both health()=available; live searches returned). Firecrawl not
exercised. Serper not required. Exa / SAM.gov / Data.gov **not integrated**. No new spend beyond the
bounded A/B search calls (event-first uses heuristic extraction — **no Anthropic**).

## Baseline (frozen US industrial-automation context, real event-first lane)
canonical target-valid operating companies ≈ **1** (DHL Supply Chain), from 66 raw hints / 6 subjects;
`no_subject` ≈ 54–59 (English event queries dominated by market-research-report SEO — confirmed in V2).
Provider variance note: repeat baseline runs swung 1↔3 (Brave returns different result sets per call).

## Strategy A — operator-oriented English queries (controlled live A/B)
| Variant | canonical target-valid | orgs (sample) | note |
|---|---:|---|---|
| OLD (buyer-prefixed) | 1–3 | DHL; EOS; Vertex Wireless | high run-to-run variance |
| **Buyer-prefix dropped** | 3–4 | DHL, Apple, Amazon, Cencora, Novartis | real operators, but 2 malformed subjects; breaks objective-specificity |
| A1 asset+event led | 1–2 | American Eagle, Ahold Delhaize, Flexitallic, Pryer Aerospace | clean, but no robust count gain |
| A2 announcement led | 2 | Motorola Solutions + 1 malformed | identity risk |
| A3 business-journal/jobs led | 0 | — | collapsed (government/no-subject) |

**Result:** the quoted buyer-category prefix is the report-SEO magnet, and removing it surfaces more
real operators — but (a) the canonical-count gain is inside the provider-variance band (OLD itself hit
3), and (b) it removes the target-buyer terminology from the query (breaks the "objective-specific"
contract). Per §23/§25/§49 an unproven, contract-degrading query change is **not shipped** (reverted).

## Strategy B — third-party operator enumeration (association / directory / trade lists)
`lib/discovery/account-first-discovery.ts` already blueprints this (`association_membership`,
`catalog_entity_extraction`, `directory_to_official`) — but it is **Colombia/wellness-specialized**
(Spanish, `input.colombia`) and `executed:false` (FOUNDER REVIEW). A general US operating-company
enumeration path is new architecture. **Deferred** per §20/§49 (not built this sprint). This is the
**durable lever** to reach an SA-comparable US universe (SA's 15–18 comes from working Spanish
discovery, not English category search).

## Strategy C — Vault reuse
Not evaluated this sprint (§20 scope: do not reopen Vault for an English-query problem). Kept separate
from fresh Discovery recall to avoid benchmark contamination.

## Shipped change (5eb02c7) — identity precision only, NOT recall
The broadened queries exposed a real extraction defect: headline fragments and dangling connectives
emitted as company identities ("Novartis finalizes US manufacturing", "Cencora to"). `plausibleSubject`
now rejects candidate names containing an event/connective noise word or exceeding ~5 words. English-
only vocabulary; Spanish names unaffected. This improves customer-facing identity precision (§29) but
**does not add valid companies** — it is not the recall fix.

## Tests / gate
event-first-discovery **40/40** (new precision assertion) · productive-event-first-parity 13 ·
lead-hunter-universe 30 · account-first-discovery exit 0 · **tsc 0** · **release:check EXIT=0**
(Track B / all ~45 contract suites green → known-event recall 7/8 preserved, §31). Build PASS.

## Truth safety
Wrong company: none (precision fix reduces malformed names) · Publisher/Directory as account: none ·
Offer-side vendor contamination: none · Wrong geography: none · False event/Timing/Evidence: none ·
Memory/Vault contamination: none · Cross-tenant leakage: none. No threshold/materiality/Decision change.

## Discovery status
**USA_DISCOVERY_NO_SAFE_IMPROVEMENT** (recall): no robust, safe recall improvement was demonstrated for
the English contexts; a directional lever exists but is provider-variance-bound and contract-degrading.
A separate identity-precision hardening was shipped.

## Release readiness (unchanged)
Preview / Brief / Intelligence-Portfolio / Premium — USA: **GUIDED_BETA**. Not self-serve: the USA
productive Candidate Universe remains systematically thin for broad buyer contexts.

## Remaining primary blocker
**USA productive Candidate-Universe recall.** English category/event search on the Brave+Tavily stack
does not reliably surface enough operating-company identities; the fresh-query levers are either
variance-bound (buyer-prefix) or contract-degrading. The reliable path is a general **account-first
operating-company enumeration** lane (like the working Spanish path / the unexecuted Colombia blueprint),
which is new bounded architecture.

## Next three moves
1. Design a general (language-agnostic) **account-first enumeration** lane: trade-association member
   lists / industrial-facility announcement indices / operator directories → grounded company subject →
   canonical identity → target validation (reuse existing identity + admission gates; directory never
   becomes an account). Prove it on US industrial-automation via the bounded live A/B before wiring.
2. If it yields ≥ ~6 clean canonical target-valid US operators, run the exact frozen US Track A contexts
   once each and re-classify (ADEQUATE / THIN_BUT_DEFENSIBLE / SYSTEMATICALLY_INCOMPLETE).
3. Only then revisit tier full-order live acceptance (Preview→Premium) with measured runtime + COGS.

## Canonical artifacts (by path)
- `docs/intelligence/LEADLENS_INTELLIGENCE_{CORE_AND_TIERS_COMPLETION_V1,PRODUCTIZATION_AND_RELEASE_V2}_ACCEPTANCE.md`
- `lib/lead-hunter/event-first-discovery.ts` (`planEventFirstQueries`, `plausibleSubject`)
- `lib/discovery/account-first-discovery.ts` (Colombia-specialized enumeration blueprint, executed:false)
- `ml/data/acceptance/customer-e2e-*.json` (frozen Track A run artifacts)
