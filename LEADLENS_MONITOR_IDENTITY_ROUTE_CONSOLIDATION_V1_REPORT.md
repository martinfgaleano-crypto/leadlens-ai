# LeadLens Monitor Identity + Route Consolidation V1

## 1. Git

- Baseline: local `main` at `d74218cdb2ef0b208d35e55ec6db191d90cc15a9`; `origin/main` remained `d804d4c`.
- Eight unrelated untracked audit documents were preserved.
- No reset, rebase, push, pricing, Landing, provider, alert, ML, Observatory, or scheduler activation change.
- No migration was required; the JSON snapshot payload evolved compatibly.

## 2. Audit Finding Verification

| Finding | Result | Evidence / resolution |
|---|---|---|
| A. Snapshot identity was only `accountId` | VERIFIED | Added durable `MonitorableAccountIdentity` to snapshot payload. |
| B. Reobserver queried `plan.accountId` | VERIFIED | Query now uses canonical name, domain, geography and bounded aliases. |
| C. Dashboard used legacy `/api/monitor/[id]/run` engine | VERIFIED | Route is now an authenticated adapter to canonical service. |
| D. Canonical route was `/api/customer/monitor` | VERIFIED | Route retained and delegates the same service. |
| E. Cron/manual diverged | VERIFIED | Scheduler and both manual routes now call `runCanonicalMonitor`. |
| F. Full text was implemented but unused productively | VERIFIED | Default reobserver now calls the shared selective full-text path. |
| G. Manual run IDs could collide | VERIFIED | IDs now hash owner + client scope + cycle. |
| H. `providerFailuresSeen` was placeholder zero | VERIFIED | Aggregates actual failed providers and thrown reobservation. |
| I. Run timestamps did not measure duration | VERIFIED | Start/end clocks are sampled at execution boundaries; duration is emitted. |
| J. `last month` semantics were wrong | VERIFIED | Resolves previous calendar month as a bounded range, including year rollover. |
| K. Canonical adapter injected synthetic assumptions | VERIFIED | Removed `unknown.com` and unsupported identity/universe/geography/material truth. |

## 3. Previous Monitor Architecture

Dashboard invoked the legacy async pipeline while customer and cron used recurring `runMonitor`. The recurring path searched opaque account IDs, consumed snippets only, generated collidable IDs, and rebuilt canonical input with synthetic truth values. Account Memory was canonical for diffs but lacked durable external identity.

## 4. Monitorable Account Identity

The Account Memory snapshot now carries a version-compatible optional identity payload:

- stable account key;
- canonical company name;
- canonical domain;
- aliases;
- country/geography;
- organization type;
- confidence (`verified`, `strong`, `plausible`, `ambiguous`);
- Candidate Universe lineage;
- optional parent/operating entity seams.

A domain plus report fields yields at most `strong`; only upstream identity resolution may provide `verified`. Legacy opaque IDs become `ambiguous` and return `identity_requires_validation` rather than researching the wrong company.

## 5. Identity Lineage

Identity now propagates:

```text
CandidateAccountUniverse.identity
→ LeadCandidate.account_identity
→ processed lead
→ institutional dossier.monitor_identity
→ AccountBriefVM.monitorIdentity
→ AccountReviewSnapshot.accountIdentity
→ MonitoredAccountState / MonitorReviewPlan
```

Historical snapshots remain immutable. Payloads without identity use a conservative legacy interpretation. Search-backed report memory now uses `searchId` as the stable Monitor client scope rather than customer display metadata.

## 6. Search Identity

Queries are constructed from:

1. quoted canonical company name;
2. country when present;
3. opportunity/change theme;
4. quoted canonical domain when present.

Results must match the corporate domain or a boundary-safe canonical name/alias in title/snippet before full-text processing. The internal account slug is never the sole external term.

## 7. Legacy vs Canonical Monitor

- `/api/customer/monitor`: canonical authenticated manual route.
- `/api/monitor/[id]/run`: thin dashboard compatibility adapter; no longer creates a legacy pipeline job.
- internal scheduler: batch wrapper over the same canonical service.
- `runMonitor` remains the low-level account-cycle engine owned by `runCanonicalMonitor`; there is no second productive decision/research engine.

## 8. Route Consolidation

`lib/monitor/canonical-monitor-service.ts` owns tenant-safe identity, review IDs, Account Memory persistence and run invocation. Customer/dashboard resolve references server-side. Browsers cannot inject snapshots, Evidence, What Changed, provider output, or Decision. Dashboard history recognizes canonical Monitor summaries and displays reviewed/changed/no-change/limited counts inline rather than linking them to an incompatible legacy report page.

## 9. Full-Text Productive Cutover

The real default reobserver now performs:

```text
provider routing
→ account-specific search
→ strict result/account association
→ snippetIsPromising
→ bounded extractWithFallback
→ neutralizePageContent
→ extractStructured when justified
→ proposalsToObservedItems
→ deterministic extractEvent/materiality/date gates
```

Pages are not fetched indiscriminately. Fetch and extraction budgets remain in the existing shared modules.

## 10. Structured Extraction

The LLM proposes claims/events only. Prompt-injection phrases are neutralized before model input. Forecasts, metrics, static statements and opinions do not become events. Deterministic account association, event type, date, materiality, relevance and novelty remain authoritative. A controlled productive-path test executed a page containing injection text, invoked structured extraction, and accepted only the validated dated event.

## 11. Temporal Fixes

- `last month` is the previous calendar month, represented by start/end bounds.
- August 20 → July 1–31.
- January → previous December with year rollover.
- Relative expressions require a publication anchor.
- Retrieval date never anchors or becomes event date.
- Publication date never automatically becomes event date.
- Month/quarter/year precision remains explicit and non-day-exact.
- Historical-new evidence can strengthen Evidence but does not become post-review What Changed.

## 12. Canonical Case

Recurring intelligence still flows through `CanonicalCaseInput → synthesizeCase`. Input truth now follows durable identity and validated delta:

- `identityVerified` only for verified identity;
- `fromUniverse` only with lineage;
- source host is nullable, never `unknown.com`;
- `materialEvent` only when a validated accepted/historical event exists;
- geography confirmed only from persisted geography;
- post-review timing only from a true accepted post-review event.

## 13. Account Memory

Accepted reviews create immutable snapshots and diffs. Insufficient or failed reviews create no predecessor. The current Case is synthesized first and then compared with `diffAccountCase`. Identity is copied forward without rewriting historical rows. The disposable Supabase acceptance proved Review1→Review2 persistence and cleanup.

## 14. Run IDs / Idempotency

Canonical run identity is `mon_<sha256(owner|clientKey|cycleKey)[0..32]>`. Review IDs derive from run ID plus hashed stable account key. Same owner/scope/cycle is idempotent; two owners with identical client/account/date receive different IDs.

## 15. Concurrency

Two simultaneous tenant runs completed with different run IDs and isolated outcomes. Per-run data lives in function scope. No mutable timestamp or provider-result accumulator is shared.

## 16. Observability

Monitor now records:

- real provider failures;
- run and per-account duration;
- search results considered;
- pages escalated/fetched;
- fetch failures;
- structured extraction calls;
- claims/events proposed;
- events accepted;
- temporal/materiality rejects;
- accepted-new, rediscovered and historical-new through existing delta counters.

Raw page bodies are not persisted in metrics.

## 17. Manual / Scheduled Parity

Controlled parity tests supplied identical identity, prior review, context and provider observation to manual and scheduled origins. Decision and Account Memory diff were identical. Origin only affects invocation metadata; canonical semantics are shared.

## 18. Live Acceptance

A disposable acceptance ran against configured Supabase with reserved `.example` identity and a controlled sufficient/no-change observation:

- canonical query used company name/domain, not opaque slug;
- canonical Monitor completed without fabricating change;
- Review2 persisted;
- durable run summary persisted;
- all namespaced snapshot/run rows were deleted in `finally`.

Result: **5 passed, 0 failed**. No customer history and no fabricated material event were used. Live external-provider full-text was intentionally not required; the exact productive post-search path was exercised with controlled provider/page fixtures.

## 19. Tests

- New consolidation integration: **41 passed, 0 failed**.
- Required focused/regression suites: **410 passed, 0 failed**.
- Disposable Supabase acceptance: **5 passed, 0 failed**.
- Total deterministic checks recorded: **451 passed, 0 failed** (acceptance checks reported separately).
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; 150 static pages generated and Monitor routes compiled.

## 20. Production Verdict

`CANONICAL MONITOR V1 OPERATIONAL WITH NON-BLOCKING P2`

The dashboard, customer route and scheduler now converge on one Monitor service; external research uses durable identity; and the productive reobserver executes the canonical full-text path. Qualification reflects remaining historical backfill and live-provider acceptance work, not a missing runtime chain.

## 21. Remaining P0 / P1 / P2

### P0

None in Monitor identity, route authority, full-text productive path, temporal truth, tenancy or Account Memory acceptance.

### P1

None within the consolidated runtime contract.

### P2

1. Backfill/validate identity for historical snapshots that predate the identity payload; ambiguous rows correctly remain blocked meanwhile.
2. Run a bounded live-provider reobservation for a verified disposable/public account after provider budgets are approved; `NO_MATERIAL_CHANGE` is acceptable.
3. Add a richer customer detail view for canonical Monitor outcomes; dashboard currently provides a safe inline summary rather than a full legacy-style dossier.
4. Add stale canonical Monitor run recovery if execution is later moved behind an async worker.

## 22. Cron Activation Requirements

Cron remains disabled unless `MONITOR_SCHEDULER_ENABLED === "true"`; this sprint did not change environment variables.

Safe founder activation requires:

1. validate/backfill identity for the intended monitored cohort;
2. confirm provider budget and routing health;
3. run one bounded live provider acceptance;
4. inspect full-text funnel and provider failure metrics;
5. verify scheduler secret and tenant batch limits;
6. enable the kill switch only after these checks;
7. observe the first wake and disable immediately on identity or coverage failures.

## 23. Recommended Next Sprint

`CUSTOMER JOURNEY + REAL SUPABASE E2E ACCEPTANCE V1`

Focus on the minimal customer confirmation/start/results seam, historical Monitor identity validation and one bounded real-provider acceptance. Do not activate cron as a substitute for that acceptance.

## Canonical Runtime Chain

```text
accepted Account Memory snapshot with durable identity
→ runCanonicalMonitor
→ eligibility + bounded queue
→ identity-safe MonitorReviewPlan
→ provider routing
→ canonical name/domain/geography query
→ strict account association
→ selective full-text + structured proposals
→ deterministic event/date/materiality validation
→ classifyDelta
→ synthesizeCase
→ immutable AccountReviewSnapshot
→ diffAccountCase
→ durable Monitor run summary
```

## Maturity Update

- Core Intelligence components: **94%**.
- Operationally integrated Intelligence: **89%**.
- Limited Self-Serve Intelligence readiness: **74%**.

These are architecture maturity estimates, not precision/recall claims.
