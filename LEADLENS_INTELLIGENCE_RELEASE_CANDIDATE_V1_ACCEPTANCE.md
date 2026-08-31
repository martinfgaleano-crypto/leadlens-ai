# LeadLens Intelligence Release Candidate V1 — Acceptance

Date: 2026-08-31  
Baseline: `77a76a2715f73778bde5809a7d4e911ab8852ceb`  
Status: **PARTIAL**  
Readiness: **GUIDED_BETA**  
Freeze decision: **FREEZE_CORE_ONLY**

## Executive outcome

The productive system gained an account-level actionability funnel, exact forward
claim/source binding, deterministic material counterevidence telemetry, and a validated
two-account research default. Dynamic enumeration recall improved, and two severe
targeting leaks were found and closed: geography was required before identity resolution,
and brand names without corporate domains could advance as accounts.

The deep Intelligence path remained truth-safe in every completed live run. The release
candidate is **not** Limited Self-Serve because Candidate Universe yield is still unstable:
the same confirmed context produced universes of 1, 3, 0 and 0 accounts across four runs.
No thresholds or Decisions were weakened to hide that result.

## Productive changes

- `actionability-funnel.ts` records target, identity, coverage, event, temporal,
  materiality, Evidence, Fit, Timing, Decision and canonical Hold reason per account.
- `claim-provenance.ts` binds a verified dated claim only to a matching deterministic
  validated event URL. Inference and missing Evidence receive no URL.
- Deep Research records validated events and affirmative counterevidence; absence,
  provider failure and staleness remain uncertainty, never counterevidence.
- Productive account concurrency defaults to the previously live-validated `2`, capped at
  `2`, with env rollback to serial.
- Identity-stage pages no longer consume event extraction or structured-LLM budget.
- Identity search stops after one provider supplies three accepted identity results.
- Multi-industry discovery queries use explicit alternatives rather than impossible
  `A and B and C` category phrases.
- Thin-universe recovery mines only literal, grounded multiword names.
- Dynamic geography is evaluated after bounded corporate identity resolution.
- Dynamic accounts require both corporate domain and corroborated target geography.

## Live release-candidate matrix

All four runs used the same unseeded context: automated packaging machinery and controls
for mid-sized/large US food, beverage and consumer-goods manufacturers.

| Run | State | Universe | Decisions | Background | Total | Anthropic | Acceptance |
|---|---:|---:|---|---:|---:|---:|---:|
| `1788150358427` | before recall repair | 1 | Hold 1 | 110.988s | 132.748s | $0.086955 | 16/16 |
| `1788150644318` | after query/recovery | 3 | Hold 3 | 251.614s | 287.562s | $0.339531 | 16/16 |
| `1788151045732` | consistency | 0 | No Case | 36.834s | 52.623s | $0.032439 | 11/15 |
| `1788151513846` | identity-safe RC | 0 | No Case | 26.780s | 42.557s | $0.034077 | 11/15 |

Observed Anthropic total: **$0.493002**. Search-provider monetary cost is unknown.

## Actionability funnel

Completed account reviews: `n=4` across two completed runs.

- Valid target: 4/4
- Researched: 4/4
- Deterministically validated current material event: 0/4
- Evidence-valid current event: 0/4
- Validate/Prioritize/Monitor: 0/4
- Hold: 4/4
- Hold reason: `NO_CURRENT_EVENT` 3; `STALE_EVENT` 1 after canonical reason repair

The two zero-universe runs are Discovery failures and are not counted as commercial Hold.

## Human/adversarial review

- Tropical Bottling Co.: correct company/domain/geography; real owned operation; no current
  material event; Hold confirmed.
- BellRing: correct public company identity; owned-manufacturing status unconfirmed and
  potentially asset-light; no current material event; Hold confirmed.
- WK Kellogg Co: corporate identity requires parent/domain caution; no current material
  event; Hold confirmed; not customer-actionable.
- Ferrero: valid commercial manufacturer with US operations; recovered investment was
  stale and partly Canadian/marketing-contextual; Hold confirmed.
- No wrong-company Evidence, fabricated Timing, false independent support or forced
  positive entered customer output.

The reviewed sample contains no positive Case, so positive precision and recall are **not
measurable** from this batch. Customer-safe targeting precision among completed reviewed
accounts is 4/4, but `n=4` is too small and does not establish market recall.

## Geography and identity

The exact failure order was reproduced: 20 grounded names, 19 rejected before identity.
After deferring geography until corporate resolution, brands such as Dasani/smartwater
were detected as a new leak because they had country prose but no domain. The final gate
requires corporate domain + target-country evidence. A post-fix Discovery-only canary
returned only Keurig Dr Pepper and Macrocap Labs; both had corporate domains and explicit
US evidence. The subsequent full run produced zero accounts due to enumeration variance,
not because brands were admitted.

Geography verdict: **PASS on accepted reviewed accounts; live sample small**.  
Targeting verdict: **ACCEPTABLE precision, WEAK consistency/recall**.

## Runtime

Historical baseline: 203.172s, 229.133s, 341.830s.  
Completed RC backgrounds: 110.988s and 251.614s.  
Completed median: 181.301s; max: 251.614s; >300s: 0/2.

The prior live concurrency A/B remains the enabling evidence: serial 337.8s vs c=2
153.9s with identical Decision distribution and deterministic output ordering. This sprint
also removed identity-stage structured extraction; the final deep run could not measure
its effect because Discovery returned zero.

Runtime verdict: **MARGINAL/PASS for completed sample (`n=2`), insufficient for p95**.

## Claim provenance

- Forward exact binding: implemented and fixture-verified.
- Claim A cannot inherit Source B.
- Inference/missing Evidence URL: always null.
- Stable source identity: deterministic canonical-URL hash.
- Same URL: deduplicated.
- Independent support: separate origin required by existing canonical Evidence contracts.
- Historical backfill: **not safe and not attempted**.

Verdict: **CORRECT forward diagnostic path; customer-wide historical provenance remains
an acceptable limitation, not backfilled**.

## Counterevidence

Affirmative cancellation, delay, closure, budget cut, replacement or award elsewhere can
be recorded as material counterevidence from a validated event. Unknown budget, no result,
provider failure and stale Evidence are not counterevidence. The trace and Case synthesis
consume the deterministic flag. Verdict: **ROBUST contract; live positive-negative event
not observed in this small sample**.

## Continuous Intelligence

- Productive repeat review regression: PASS.
- Account Memory: PASS.
- Manual Monitor refresh: 2/2 completed live runs; one account then three accounts.
- No-change: observed.
- Historical-new event: observed once and did not change Decision.
- Natural Monitor canary: NOT_OBSERVED.
- Natural Decision transition: NOT_OBSERVED.
- Memory→Evidence: 0.

## Truth and security

- Wrong-company customer Evidence: 0/4 reviewed.
- Wrong geography in accepted sample: 0/4.
- Static fact→current event: 0/4.
- Provider failure→commercial downgrade: 0.
- Inference→verified URL: 0 in new path.
- Cross-tenant result access: 0/4 live attempts; all returned 404.
- Retry fake review: 0.
- Portfolio Decision mutation: 0.
- Run claim/fencing suite: PASS.

## Major regression results

- Release-candidate contracts: 19/19
- Account Deep Research: 34/34
- Dynamic Universe: 25/25
- Discovery Value: 33/33
- Provider resilience/geography order: 4/4
- Productive Spine: 25/25
- Account Memory: 29/29
- Monitor Intelligence: 45/45
- Monitor consolidation: 41/41
- Productive trace: 21/21
- Continuous Intelligence: 7/7
- Evidence temporal: 55/55
- Failure honesty: 9/9
- Customer seams: 12/12
- Deliverable: 60/60
- Portable deliverable: 55/55
- Run lease/fencing: 7/7
- Vault accretion: 10/10
- HTTP security: 12/12
- TypeScript: PASS
- Production build: PASS, 150 static pages

## Limited Self-Serve gate

| Gate | Result |
|---|---|
| P0 security | PASS |
| Truth | PASS on reviewed sample |
| Geography | PASS on reviewed accepted sample |
| Runtime | PASS/PARTIAL (`n=2`) |
| Portfolio | PARTIAL |
| Actionability | FAIL — no natural non-Hold in current sample |
| Targeting consistency | FAIL — universe 1/3/0/0 |
| Monitor | PASS structurally; natural Monitor not observed |
| Forward provenance | PASS |
| Autonomy | FAIL — two full runs stopped at zero universe |

Final: **FAIL for Limited Self-Serve Beta**.

## Freeze decision

**FREEZE_CORE_ONLY**:

- Account Memory and lineage
- Monitor engine and no-change semantics
- What Changed
- Portfolio Decision authority
- Vault separation
- temporal/materiality truth
- failure honesty
- execution fencing and concurrency=2
- forward claim/source contract
- deterministic counterevidence contract

Do not freeze Candidate Universe targeting/recall or release readiness.

## Supported envelope

- Geography: US and Colombia only where account geography is explicitly corroborated.
- Wedges: manufacturing, logistics/fleet and operational software under guided QA.
- Refresh: bounded/manual; no real-time claim.
- No contact enrichment, no Apollo, no broad-market completeness claim.
- Exclude highly ambiguous generic services and low-footprint accounts without a verified
  corporate domain from self-serve output.

## Single remaining blocker

**Candidate Universe recall and consistency under dynamic enumeration.** The next work
must make enumeration deterministic enough to retain corporate names across repeated runs
without reintroducing brands, directories, foreign entities or seller peers. The preferred
direction is source-page extraction/structured company entities with durable reuse, not
weaker identity/geography gates or Decision tuning.

## Customer truth authority

`CUSTOMER_TRUTH_SINGLE_AUTHORITY: PASS`

Current Decision derives from canonical Case; Evidence from verified Research; What Changed
from current vs predecessor canonical review; Portfolio groups the same Decision; Monitor
uses canonical Memory plus fresh Research.
