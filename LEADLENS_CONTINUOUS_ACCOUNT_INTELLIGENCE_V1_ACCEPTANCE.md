# LeadLens Continuous Account Intelligence V1 — Acceptance

Generated: 2026-08-31  
Status: **PARTIAL**  
Starting HEAD: `fe6d8a47623ca68ee3804585b271d17bb85ee6a3`  
Acceptance baseline: canonical `main`, all reported productive commits present in the same worktree.  
Push: **NO**.

## Executive outcome

LeadLens can now retain customer-relevant evaluated accounts under a stable confirmed-context scope, independently re-run Research, resolve the immediate predecessor by canonical domain, preserve immutable historical reviews, compute evidence-grounded deltas, and execute a bounded authenticated Monitor refresh. The customer path prefers the latest accepted review and can show explicit no-change rather than manufacturing urgency.

This is not yet a Limited Self-Serve Beta acceptance. The live sample produced only `Hold` Cases, not a naturally selected `Monitor`; one full run exceeded 300 seconds; and a wrong-geography account was observed in the live canary before a deterministic fix. The system is suitable for **GUIDED_BETA** with founder QA.

## Architecture before → after

Before:

`productive run → report-scoped memory → later run could not reliably find predecessor`

After:

`confirmed context → productive run → durable universe → fresh Research → canonical Cases → context-scoped Account Memory → later productive review → grounded diff → current customer view → explicit/manual or scheduled Monitor → fresh bounded re-observation → accepted changed/no-change review`

Canonical identity is owner + confirmed context + verified corporate domain. Run IDs remain execution identity only.

## Account Memory contract

- Canonical lineage contract: **12/12 PASS**.
- Same customer/context/domain across distinct runs resolves a predecessor.
- Report reorder does not fork identity.
- Same-review retry is idempotent.
- Same-review changed payload is a conflict, not mutation.
- Historical snapshots remain immutable.
- Structural rejects do not enter active Memory.
- Cross-tenant and cross-context predecessor lookup is isolated.
- Productive worker and customer brief both use `context:<contextId>`.

## Productive repeat-review live proof

Artifact: `ml/data/acceptance/productive-repeat-review-1788144635510.json`

Context: US mid-market/enterprise packaging manufacturers operating owned plants; no named-account or event seeds.

| Metric | Run 1 | Run 2 |
|---|---:|---:|
| Researched/portfolio accounts | 4 | 4 |
| Prioritize | 0 | 0 |
| Validate | 0 | 0 |
| Monitor | 0 | 0 |
| Hold | 4 | 4 |
| Runtime | 229.133 s | 203.172 s |

- Acceptance checks: **18/18 PASS**.
- Distinct run IDs: yes.
- Canonical overlap: 4/4.
- Predecessors resolved: 4/4.
- False predecessors: 0.
- Run 1 mutations: 0.
- Monitor/Hold continuity: 4 accounts in both runs.
- Cross-tenant reload: HTTP 404.
- Non-material event falsely called new: 0.
- Fresh Research occurred in both runs; Memory was comparison baseline, not Evidence.
- Combined observed Anthropic cost: USD 0.677709; Brave/Tavily monetary cost unavailable in the ledger.

The run exposed analyst-variance false deltas: four accounts were initially marked material despite no new event or source. Productive code now requires externally grounded change for validation resolution and dimension movement. Exact deterministic regression is green; a third full repeat was not purchased because it would add >6 minutes and was unnecessary after the bounded proof plus live Monitor no-change proof.

## Monitor lifecycle

- `Monitor` is an active reevaluation state with a machine-readable revisit trigger.
- `Hold` remains remembered but is not automatically due from trigger prose alone.
- Due means cadence reached or a trusted explicit refresh; it never means commercial promotion.
- Customer/admin explicit refresh sets `refreshRequested=true`.
- Scheduled execution remains kill-switch controlled and execution-fenced.
- Accepted `completed_changed` and `completed_no_change` reviews persist; insufficient/failed refreshes do not.
- Provider failure is an operational state, never counterevidence or a commercial downgrade.

## Live Monitor refresh proof

Artifact: `ml/data/acceptance/customer-e2e-1788145325672.json`

- Customer E2E checks: **16/16 PASS**.
- Authenticated confirmed-context run: completed.
- Durable Candidate Universe: 8 accounts.
- Researched/customer Cases: 3.
- Account Memory before refresh: 3 snapshots.
- Explicit customer refresh selected: 3 accounts.
- Result: `completed_no_change=3`, `completed_changed=0`, `insufficient=0`, `failed=0`.
- Memory after refresh: 6 snapshots.
- Search results considered: 22.
- Temporal rejects: 19.
- Materiality rejects: 22.
- Accepted events: 0.
- False urgency/change: 0.
- Monitor duration: 7.177 s engine / 7.576 s customer call.
- Monitor-specific cost: **UNKNOWN** (the ledger artifact records the full E2E delta, not a per-stage monetary split).

Limitation: these were naturally produced `Hold` Cases refreshed through an explicit trusted customer action. A naturally selected `Monitor` Case was not observed; therefore the strict natural-Monitor canary remains open.

## No-material-change proof

The live Monitor re-observed three natural productive Cases and accepted three `completed_no_change` outcomes. No event, source, validation resolution, counterevidence resolution or Decision transition was fabricated. Account Memory now also rejects pure analyst/LLM variation as customer-facing What Changed.

## What Changed

- Stable event identity supports same-day distinct events while preserving legacy `kind:date` keys.
- Rediscovered old event is not new.
- Same source/event is not independent corroboration.
- A missing regenerated validation question is not “resolved” without external grounding.
- Fit/Timing/Evidence wording or ordinal movement alone is not material on an immediate repeat.
- Counterevidence resolution remains material only through the structured Monitor path.
- No-change is first-class and customer-visible.

## Portfolio refresh

The productive spine now synthesizes Cases across the bounded evaluated set and tier-limits only actionable `Prioritize`/`Validate` accounts. Customer-relevant `Monitor`/eligible `Hold` survive to Portfolio and Memory. Portfolio groups are derived from current canonical Cases and cannot mutate individual Decisions.

Live sample portfolio: Attention Now 0, Validate 0, Monitor 0, Hold 4 (repeat run) / Hold 3 (customer E2E). This is an honest abstention, not an opportunity claim.

## Customer product

- Actual route: `/results/[jobId]/brief`.
- Owner-linked productive reports require authenticated ownership.
- The brief resolves context-scoped Memory and prefers the latest accepted review.
- Workspace shows previous/current review, reason/trigger, no-change, and an authenticated “Review accounts now” action.
- Copy explicitly states monitoring is not real-time.
- Deliverable renderer: 60/60.
- Portable deliverable: 55/55.
- Live server-side brief assembly passed; a retained browser screenshot was not produced because disposable tenant cleanup removed the report after acceptance.

## Runtime

Measured productive full-run background times (`n=3`): 203.172 s, 229.133 s, 341.830 s.

- Median: 229.133 s.
- Max: 341.830 s.
- >300 s violations: 1/3.
- Monitor refresh: 7.177 s engine, `n=1`.

Runtime remains a self-serve blocker even though single-account Monitor is materially cheaper than a full run.

## Cost

- Two-run repeat review: USD 0.677709 observed Anthropic cost.
- Customer E2E including Stage A, full Research and Monitor: USD 0.291591 observed Anthropic cost.
- Full-run per researched account: not safely separable from Stage A/report costs in the current ledger artifact.
- Monitor-only monetary cost: UNKNOWN.
- Brave/Tavily monetary cost: UNKNOWN (calls observed, no configured price authority).

## Truth safety

- Memory used as current Evidence: 0 observed/tested.
- Vault used as current Evidence without validation: 0 tested.
- Static fact → event: 0 in targeted regression.
- False-new-event: 0 in repeat artifact.
- Retrieval/publication date substituted as event date: 0 in regression.
- False independent support: 0 in regression.
- Absence/unknown → counterevidence: 0 in regression.
- Provider failure → commercial downgrade: 0 in regression.
- Portfolio Decision mutation: 0 in regression.
- Cross-tenant Memory leak: 0; live wrong-owner run reload returned 404.
- History mutation: 0.
- Retry fake review: 0.

One wrong-geography account (`Omni-Pac UK`) reached the pre-fix customer E2E because query prose mentioning the United States overrode an explicit UK identity and `.co.uk` domain. The deterministic geography resolver now treats explicit foreign markers/ccTLDs as contradictory and blocks the account. Exact tests pass; no post-fix full Research run was purchased.

## Provenance

Classification: **IMPRECISE**, improved.

The productive audit trail no longer assigns the primary source URL to `inferred_from_context`, `weak_inference`, or `missing_evidence`. Only `verified_public_signal` retains it. Claim-level source IDs are still absent, so multiple verified claims can conservatively inherit the accepted primary URL even when Research consulted several sources.

- Blocks guided beta: NO, with QA.
- Blocks broad Vault backfill: YES.

## Counterevidence

Classification: **PARTIAL**.

Structured Monitor can add and resolve material counterevidence. Unknown, no-news and provider failure remain separate. Productive full-run counterevidence is still partly model-derived and lacks claim-level source identity.

## Test evidence

| Suite | Result |
|---|---:|
| Account Memory canonical lineage | 12/12 |
| Account Memory | 29/29 |
| Account Memory store | 18/18 |
| Productive Memory lineage | 4/4 |
| Monitor/Hold continuity | 27/27 |
| Monitor Intelligence | 45/45 |
| Monitor activation | 24/24 |
| Monitor consolidation | 41/41 |
| Continuous Intelligence V1 | 7/7 |
| Productive Intelligence Spine | 25/25 |
| Productive Spine trace | 21/21 |
| Customer E2E seams | 12/12 |
| Deliverable renderer | 60/60 |
| Portable deliverable | 55/55 |
| Dynamic universe recall/identity | 25/25 |
| Discovery value | 33/33 |
| Provider resilience | 3/3 |

Additional consolidated suites for failure honesty, run lease, Vault accretion, temporal hardening and opportunity synthesis completed without a reported failure. TypeScript is clean.

## Readiness

Product feel: **ACCOUNT_OPPORTUNITY_ANALYSIS** moving toward continuous intelligence.

Readiness: **GUIDED_BETA**.

Why not Limited Self-Serve Beta:

1. no naturally selected Monitor Case in the live sample;
2. full-run max 341.830 s and 1/3 runs over 300 s;
3. post-fix foreign-geography rejection is deterministic but lacks a second full live E2E;
4. all live Cases were Hold, so positive customer Portfolio value was not demonstrated;
5. claim-level provenance remains imprecise.

## Beta operating limits

- Geographies: US and Colombia only under guided QA.
- Wedges: industrial/packaging manufacturing, logistics automation, fleet/operational software packs already covered by deterministic expertise.
- Active monitored accounts/customer: start at 10 maximum.
- Refresh cadence: manual/customer-triggered plus conservative scheduled cadence; no real-time claim.
- Founder QA: review every emitted Prioritize/Validate and every identity/geography exception.

## Freeze list

- Account Memory canonical identity/immutability contract.
- Bounded research concurrency = 2.
- Monitor execution fencing and accepted-review persistence semantics.
- Temporal rule: retrieval/publication date is not event date.
- Provider failure is not commercial counterevidence.
- Portfolio cannot mutate account Decisions.

## Remaining top risks

1. **P0 — Runtime:** 1/3 productive runs exceeded 300 s; self-serve timeout risk.
2. **P1 — Targeting/geography:** foreign identity leak fixed deterministically but not yet post-fix live-revalidated.
3. **P1 — Positive portfolio yield:** 0 Prioritize/Validate/Monitor in the live repeat sample (`n=8 account reviews`).
4. **P1 — Provenance:** no claim-level source IDs for verified claims.
5. **P2 — Monitor selection:** natural Monitor canary still missing; current live refresh used explicit Hold refresh.

## Next primary bottleneck

**TARGETING** — specifically proving post-fix high-precision candidate/geography selection while recovering at least one naturally defensible `Monitor` or `Validate` Case.

## Next three moves

1. Run one post-fix, narrower positive-control context through full customer E2E and require zero identity/geography leaks plus one naturally defensible Monitor/Validate or an honest Hold-only outcome.
2. Attribute per-stage cost/runtime and early-stop Research when identity/event gates already establish Hold.
3. Add claim-level validated source IDs before broad Vault backfill.

## Final statement

1. Can LeadLens remember accounts safely? **Yes**, contract and live predecessor proof.
2. Can it re-research them safely? **Yes**, two independent productive runs plus Monitor re-observation.
3. Can it distinguish change from no-change? **Yes in deterministic and live Monitor paths**; repeat-run analyst variance was fixed.
4. Can Monitor trigger a real refresh? **Yes**, authenticated customer route; natural Monitor selection remains unproven.
5. Can Decisions evolve safely across reviews? **Structurally yes**; no live Decision transition occurred.
6. Can Portfolio update without mutating account truth? **Yes**, tested.
7. Can the customer see all of this? **Mostly** through the actual brief/workspace; no retained browser acceptance screenshot.
8. Is LeadLens now behaving as Continuous Account Intelligence? **Partially**; the loop works, but live value and natural Monitor selection are not yet demonstrated.
9. Is Limited Self-Serve Beta justified? **No. Guided Beta is justified.**
