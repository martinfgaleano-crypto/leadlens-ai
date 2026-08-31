# LeadLens Intelligence Completion Program V1 — Acceptance

Date: 2026-08-31  
Starting HEAD: `fce153c5ae08c2ee4344194ebc90294f742c4cfd`  
Status: **PARTIAL**  
Readiness: **GUIDED_BETA**  
Freeze: **FREEZE_CORE_ONLY**

## Executive outcome

Candidate Universe no longer forgets a verified context universe when a later search
returns zero. It reuses the latest owner-scoped, exact-context snapshot, revalidates every
candidate, records stable/new/revalidated state and keeps that lineage as Discovery
provenance rather than Evidence. Thin first-run recovery now also extracts explicitly
linked companies from structured association/member pages.

Live validation found and closed three customer-safety leaks: product brands presented as
operating accounts, generic English/Spanish company words assigning unrelated domains,
and an LLM material-event statement producing `Validate` despite zero deterministically
validated events. No scoring, ranking or Decision threshold was relaxed.

The remaining blocker is **natural actionable-Case recall from unseeded customer
contexts**. The completed E2E found a valid company and plausible context, but no event
passed temporal + materiality validation. The correct post-fix Decision is Hold.

## Candidate Universe before / after

Before: same context produced `1 / 3 / 0 / 0`; every run depended on fresh enumeration.

After:

- latest exact context/version snapshot is loaded owner-scoped;
- only non-excluded, non-ambiguous, domain-verified candidates seed reuse;
- required geography must still be present;
- each reused candidate re-passes structural targeting and exclusions;
- provider outage becomes explicit `context_memory_reuse`, not fresh discovery;
- reuse never carries Evidence, Timing, Fit or Decision;
- fresh + memory identities reconcile by canonical domain;
- telemetry: prior considered, reused, fresh, stable-core percentage;
- no migration: immutable `snapshot_reports` snapshots remain the durable store.

## Stable-core measurement

| Context | Run A clean | Run B clean | Intersection | Union | Fresh stable core |
|---|---:|---:|---:|---:|---:|
| US food/beverage manufacturing | 4 | 4 | 4 | 4 | 100% |
| US industrial distributors | 3 | 3 | 2 | 4 | 50% |
| Colombia food/beverage + stable pack | 19 | 18 | 18 | 19 | 94.7% |

Fresh search remains variable in the warehouse wedge. Productive exact-context reuse
turns a later zero-yield pass into a revalidated stable core (contract 24/24), but that
continuity still needs a repeated live productive-context sample.

Unexplained zero-collapse after a verified prior snapshot: **NO by contract; live repeat
not yet measured**.

## Corporate entity extraction

Deterministic structured extraction accepts only explicit outbound corporate links from:

- HTML anchors;
- Markdown links;
- JSON-LD Organization/Corporation/LocalBusiness.

The directory host, same-origin links, social hosts and unrelated hosts cannot become the
candidate domain. LLM extraction remains bounded fallback. Source pages are provenance,
never account Evidence.

## Targeting and geography

Live leaks found and fixed:

1. `Jimmy Dean` and `Hillshire Farm` were product brands owned by Tyson. Explicit
   `(brand)`, `Brand`, `brand of` and `owned by` identity constructions now reject them.
2. `HD Supply` was assigned `supplychainconnect.com` through generic token `supply`.
   Generic commercial terms no longer establish host identity; exact `hdsupply.com`
   remains resolvable.
3. `Pepsico Alimentos Colombia` was assigned `alimentossas.com` through generic token
   `alimentos`. Spanish generic terms no longer establish identity.

Reviewed post-fix live accepted companies:

- US manufacturing: Kraft Heinz, Tyson Foods, Cargill, Coke Consolidated (`n=4`).
- US distributors: Watsco, Rexel USA, Avnet (`n=3`).
- Colombia dynamic: Grupo Nutresa, AB InBev (`n=2`), plus safe vertical-pack candidates;
  pack candidates lacking domains do not become Research-ready.

Wrong accepted geography in reviewed post-fix sample: `0/9`.  
Directory delivered as account: `0`.  
Known wrong-domain candidates after fixes: `0/9`.  
Parent/subsidiary commercial-account choice (AB InBev vs Bavaria) remains a guided-QA
limitation, not a proven geography error.

## Live Customer E2E

Artifact: `ml/data/acceptance/customer-e2e-1788153827649.json`.

- Acceptance: `16/16`.
- Authenticated owners: PASS.
- Confirmed context persistence: PASS.
- Cross-tenant same label isolation: PASS.
- Candidate Universe durable/owner scoped: PASS.
- Universe: Bronco Wine Co., `broncowine.com`, United States, `n=1`.
- Research results: 17.
- Extracted pages: 3.
- Deterministically validated events: 0.
- Material events: 0.
- Independent support: false.
- Background: 138.996s.
- Total including Stage A and Monitor: 175.577s.
- Monitor: 19.156s; no-change completed.
- Retry idempotency: PASS.
- Cleanup of disposable tenant/auth rows: PASS.

The live pre-fix Case said `Validate` because a model-produced acquisition/partnership
claim was allowed to substitute for the empty deterministic event trace. Exact artifact
replay after the fix produces:

- Decision: `Hold`;
- reasons: `no_event`, `no_material_event`, `no_valid_date`;
- Fit: Strong;
- Timing: Limited;
- no fabricated positive.

This is a false-positive correction, not a natural actionable Case.

## Actionability funnel

Exact E2E denominator: `n=1` researched account.

| Stage | N |
|---|---:|
| target valid | 1 |
| identity valid | 1 |
| research sufficient | 1 |
| event candidates | 0 |
| temporal valid | 0 |
| material valid | 0 |
| Evidence valid | 0 |
| independent support | 0 |
| Prioritize | 0 |
| Validate | 0 post-fix |
| Monitor | 0 |
| Hold | 1 post-fix |

Natural actionable Decisions: `0/1`. Forced positives: `0`.

## Provenance

- Stable source IDs: implemented.
- Exact claim→validated event→source binding: implemented.
- Inference/missing Evidence inheriting URL: blocked.
- Cross-binding in contracts: 0.
- Same-origin duplicate support: blocked.
- Forward path: safe under current contracts.
- Broad historical backfill: not attempted and not claimed safe.

The Bronco artifact exposed claims with no source IDs; after the fix those claims cannot
create an actionable canonical Case when deep telemetry has zero validated events.

## Counterevidence

- affirmative cancellation/delay/closure/budget cut/replacement/award elsewhere: material;
- absence, unknown, provider failure and staleness alone: not counterevidence;
- deterministic material flag reaches Case synthesis;
- live E2E checked counterevidence and found none;
- no absence→counterevidence or provider failure→counterevidence observed.

## Runtime and cost

| Run | Runtime |
|---|---:|
| US universe post-fix | 6.190s |
| Warehouse universe post-fix | 7.901s |
| Colombia universe post-fix | 9.196s |
| Customer E2E background | 138.996s |
| Customer E2E total | 175.577s |
| Monitor | 19.156s |

Release validations over 300s: `0`. E2E sample `n=1`, so runtime p95 is not measurable.

Observed E2E Anthropic usage:

- calls: 10;
- input tokens: 23,486;
- output tokens: 6,313;
- calculated cost: `$0.165153` using the ledger's stated pricing source.

Search-provider monetary cost: **UNKNOWN**. Candidate-only canary LLM cost was not
captured as a run delta and is not invented. Cost per actionable Case: not measurable
because actionable Cases = 0.

## Continuous Intelligence / Portfolio

- Productive Account Memory regressions: PASS.
- exact-context Candidate Universe continuity: PASS by contract.
- Monitor no-change: PASS live.
- provider failure did not create commercial downgrade.
- natural Monitor: not observed in this batch.
- natural Decision transition: not observed.
- all-Hold remains truthful; customer value is limited without a positive Case.
- Portfolio Decision mutation: 0 in regression.
- market-completeness claim: 0.

## Security and truth safety

- P0: 0 known.
- cross-tenant result access: blocked (404 live).
- Candidate Universe memory lookup: owner + exact context/version scoped.
- customer-relative eligibility never enters global Vault.
- Memory→Evidence: 0.
- UniverseMemory→Evidence: 0.
- Vault→Evidence: 0.
- static→event: 0 in reviewed path.
- temporal fabrication: 0.
- false independent support: 0.
- provider failure→commercial downgrade: 0.
- wrong claim/source actionable Case: 0 post-fix.

## Tests

- Lead Hunter production/context memory: 24/24.
- Release Candidate / entity extraction / leak regressions: 27/27.
- Dynamic Universe recall: 25/25.
- Account Deep Research: 34/34.
- Research materiality: 7/7.
- Case handoff: 9/9.
- Productive Intelligence Spine: 25/25.
- Productive trace: 21/21.
- Customer E2E seams: 12/12.
- Account Memory: 29/29.
- Monitor consolidation: 41/41.
- Evidence/temporal intelligence: 55/55.
- HTTP security: 12/12.
- TypeScript: PASS.
- Production build: PASS, 150 static pages.

## Self-Serve V5 gate

| Gate | Result |
|---|---|
| Truth safety | PASS on reviewed sample |
| Identity/domain | PASS after three exact leak fixes; small n |
| Geography | PASS on reviewed accepted sample (`n=9`) |
| Candidate continuity | PASS by deterministic productive contract |
| Fresh discovery stability | PARTIAL (50–100% across wedges) |
| Runtime | PASS on current sample; p95 not measurable |
| Security/tenancy | PASS |
| Monitor/no-change | PASS |
| Natural actionability | FAIL (`0/1`) |
| Autonomy | PARTIAL |

Final: **GUIDED_BETA**, not Limited Self-Serve.

## Freeze decision

**FREEZE_CORE_ONLY**:

- canonical Case/Decision authority;
- truth invariants and temporal/materiality gates;
- forward claim/source contract;
- deterministic counterevidence;
- Account Memory and lineage;
- Monitor/no-change semantics;
- Portfolio Decision authority;
- Vault separation;
- execution fencing and concurrency 2;
- Candidate Universe snapshot continuity contract.

Do not freeze first-run fresh enumeration, parent/subsidiary account selection or natural
actionable recall.

## Supported V1 envelope

- Guided US/Colombia manufacturing, logistics/fleet and operational-software contexts.
- Explicitly corroborated company identity/geography only.
- Verified-domain candidates only for productive Research.
- Bounded Research and manual QA before customer delivery.
- No market completeness, people enrichment, Apollo or buying-intent certainty.
- Manual/bounded Monitor; no real-time claim.

## Single remaining blocker

**Natural actionable-Case recall from unseeded customer contexts.** LeadLens must recover
enough current, deterministically dated, material, account-associated events to produce
repeatable `Monitor`/`Validate` Cases without weakening truth gates. Candidate continuity
now prevents valid account loss, but first-run event-bearing account discovery and event
acceptance remain insufficiently demonstrated.

## Next three moves

1. Route fresh enumeration toward primary corporate newsroom/event-bearing source pages
   while preserving the stable reused core.
2. Run a bounded positive-control category context and inspect every found-but-rejected
   material event for a real false-negative gate.
3. Repeat one productive exact context to measure live stable reuse and seek a natural
   current event; stop if no validated event rather than manufacture a positive.

No push was performed.
