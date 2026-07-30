# LeadLens Intelligence OS — Block 8

## Signal intelligence, temporal monitoring and What Changed v2

Status: complete
Methodology: `signal-temporal-v2`
Scope: the same six Amor de Gea accounts; no market expansion and no customer-facing report.

## 8A. Temporal-readiness audit (completed before implementation)

Audit date: 2026-07-30. The audit used the Block 7 artifact, the current TypeScript contracts, migration 042, and a read-only production query. No Block 8 implementation was written before recording these findings.

### Persisted baseline reality

- `intelligence_account_states` contains 18 rows: three observations for each of the six accounts.
- `intelligence_dossiers` contains 12 rows: two research-pass dossiers for each account.
- `intelligence_evidence` contains 34 canonical records and `intelligence_claims` contains 12 structural-fit claims.
- The six most recent Block 7 states share the controlled-pass cutoff `2026-07-30T00:33:22.535Z`; the six reprocessed states have later per-account observation timestamps around `00:36Z`.
- All 12 persisted Block 7 account states contain exactly one `material_changes` entry, and that entry represents a first/non-comparable observation. Therefore the persisted history exists, but the runner did not load it as the previous baseline.
- Stable evidence and claim IDs exist and are content-derived. State IDs are derived from account, client and projected state fingerprint. Equal semantic state therefore reuses an ID; it does not identify a unique observation. This is useful for idempotency but insufficient as an observation/run identity.
- Dossiers reference account-state IDs and retain the full internal dossier JSON. Monitoring triggers created by Block 7 are inside `dossier_json`; they are not exposed as top-level columns and have no durable lifecycle of their own.

### Date and cutoff readiness

- Canonical evidence already supports `publication_date`, `publication_date_state`, date confidence, `retrieved_at`, and `verified_at`. The production audit initially showed zero dates only because those semantic fields are stored under their migration-042 column names and/or dossier JSON, not the guessed aliases used by the first compact query. Block 7's successful artifact records four publication dates and retrieved/verified timestamps.
- Account states have `observed_at`, but there is no explicit source cutoff, lookback start, overlap window, or provider-date uncertainty on a monitoring run.
- `retrieved_at` is not a publication date and must not be used as one. An undated result may prove that a page was observable at retrieval time, but not that the underlying event occurred within the monitoring window.

### What Changed reality

- `compareAccountStates` can compare a supplied prior state, but `buildAccountState` defaults to `previous = null`.
- The Block 7 runner always used the default and the persistence layer only writes; it never retrieves the previous comparable state.
- The current comparison only observes timing state, corroborated count, contradicted count, and structural-score movements of at least five points. It does not compare signal identity, event status, source cutoff, materiality, expiry, or qualification state.
- Consequently LeadLens does not yet have a real production-grade delta. The present “first comparable observation” on repeated runs is a false lifecycle result, not a real change.

### Existing signal contracts

- Evidence claim categories are broad: identity, structural fit, commercial signal, timing, risk, client relevance and other.
- Research claims distinguish identity, commercial footprint, current activity and negative event.
- These are claim/research categories, not a canonical signal taxonomy. They do not encode event lifecycle, signal status, materiality dimensions, relevance, expiry or monitoring policy.
- Corroboration exists at claim level, while counterevidence is recorded mainly as an account-level bounded search result. Block 8 needs signal-level links and signal-level counterevidence status without weakening the prior claim rules.

### Persistence reuse map

| Block 8 concern | Reuse from 042 | Gap / decision |
|---|---|---|
| Source evidence | `intelligence_evidence` and claim-evidence links | Reuse unchanged; retain publication-date semantics and source independence |
| Atomic claims | `intelligence_claims` | Reuse for factual support; a signal may reference one or more claim IDs |
| Comparable account baseline | `intelligence_account_states` | Reuse as the account projection; explicitly load the latest prior state by account/client/cutoff |
| Internal dossier | `intelligence_dossiers.dossier_json` | Reuse for additive Block 8 output and compatibility |
| Client context | `intelligence_client_contexts` | Reuse unchanged |
| Canonical signals | None | Durable immutable signal observations are required |
| Trigger registry | Trigger objects only inside dossier JSON | Durable active/paused/retired trigger identity and last-checked state are required |
| Monitoring run | None | A bounded run needs its own cutoff, window, budgets, result and failure state |
| Signal change ledger | Generic state `material_changes` JSON only | What Changed v2 needs explicit baseline/run/signal identity and honest no-change |
| Qualification transition | Qualification only inside dossier JSON | Transition can be recorded in the change ledger; no separate table is justified |

### Migration decision

Migration 042 cannot safely preserve independent signal observations, trigger lifecycle, monitoring-run idempotency and an immutable change ledger. A minimal migration 043 is justified with four tables only:

1. `intelligence_signals`
2. `intelligence_monitoring_triggers`
3. `intelligence_monitoring_runs`
4. `intelligence_signal_changes`

A fifth qualification-transition table is deliberately rejected; qualification transitions will be typed change-ledger entries. Migration 043 will be generated and validated locally, but it will not be applied without explicit user approval. Until it is applied, the controlled pass must fail closed for the new tables while still producing a complete local audit artifact and a backward-compatible migration-042 dossier/state projection.

### 8A conclusion

Block 8 is ready to proceed only with these invariants:

- source cutoff and observation time are distinct;
- the baseline is selected before the run and cannot be the current run;
- the same semantic signal keeps a stable signal key while every observation/run remains traceable;
- absence of a new accepted signal produces an explicit honest no-change result, never a fabricated negative claim;
- timing and qualification may transition only through typed gates;
- ranking remains disabled.

## 8B. Signal Intelligence

### Canonical taxonomy and contract

`lib/intelligence/signal-temporal.ts` defines 54 event categories in six families: growth/expansion, commercial activity, organizational change, financial/corporate, negative/contradictory, and market/channel. `structural_fit` and company descriptions are deliberately absent, so static facts cannot normalize into signals.

Every observation preserves stable signal and observation IDs, tenant/client/account scope, category and normalized event type, atomic statement, claim/evidence provenance, source independence, publication/effective/observation/detection dates, freshness, explicit event status, market/location/segment, three separate relevance dimensions, confidence, corroboration, signal-specific counterevidence, multidimensional materiality, expiry, prior/current status, methodology, and safety defaults. Defaults are observation mode, unreviewed, ranking off and report off.

Signal states are candidate, observed, dated, partially corroborated, corroborated, contradicted, weakened, expired, stale, superseded, rejected and unresolved. Event status separately preserves rumored, announced, planned, initiated, in progress, completed, delayed, cancelled, contradicted and unknown.

### Materiality and temporal policy

Materiality does not use one opaque score. It retains ten dimensions: account significance, commercial relevance, client relevance, event magnitude, strategic relevance, temporal proximity, source quality, corroboration, counterevidence risk and likely persistence. Fewer than five evidenced dimensions yields `insufficient_evidence`; counterevidence can cap the result.

All categories have a policy containing relevance window, decay behavior, minimum date confidence, review horizon, independent-source requirement, negative interpretation and expiry behavior. Hiring decays in 90 days; openings/expansion use a 365-day window; launches use 180 days; negative closure/exit events persist for 730 days. No global freshness threshold is used.

### Event normalization

The controlled normalizer:

- rejects unknown/static categories and weak entity matches;
- never converts retrieval time into event time;
- keeps planned and completed events under different stable event keys;
- counts a company site and company-controlled social profile as one source owner;
- collapses syndicated evidence;
- treats a date as a date, not as corroboration;
- retains cancellation/contradiction separately from completion.

## 8C. Monitoring infrastructure

The trigger registry requires a valid baseline and verified account identity. It retains evidence and disconfirmation requirements, commercial rationale, explicit client-relevance gate, review/cadence horizon, signal-specific query templates, priority/confidence, active state and lifecycle timestamps.

The query planner uses the verified name/domain, country, language, category, prior source cutoff and category horizon. It applies a 2–7 day overlap, rejects generic/unverified-identity queries, records that provider date behavior is requested but not guaranteed, and enforces at most three queries per trigger.

Monitoring runs have stable idempotent IDs derived from client, baseline, cutoff and budgets. They preserve lifecycle status, provider uncertainty, query/extraction/trigger caps and observation-only safety flags. No cron, recurring automation or page-render provider call was added.

## 8D. Corroboration and counterevidence

Independent-source identity reuses the Block 6 source-owner and syndication logic. A signal becomes corroborated only with independent sources and diverse evidence classes. The controlled runner generates a bounded signal-specific negative query for each candidate before acceptance. It stores the exact query, found evidence, counterevidence state and unresolved questions. No-result means `none_found_bounded`, never “no counterevidence exists.”

The real pass found no entity-matched, dated event candidate, so it correctly performed no candidate-level countersearch and created no synthetic corroboration. That zero is a valid result.

## 8E. What Changed v2, timing and qualification

What Changed v2 distinguishes first seen, newly active, strengthened, weakened, corroborated, contradicted, materially changed, expired, unchanged, removed and unresolved. Missing baseline is unresolved. First seen is explicitly not historical change. Duplicate evidence remains unchanged. Independent corroboration may strengthen; announced→completed is material; announced→cancelled is contradictory.

Timing v2 uses current signal, event status, freshness, source quality, corroboration, counterevidence, materiality, client relevance and commercial accessibility. Structural relevance cannot raise timing. States are no-current evidence, weak, emerging, credible, strong, contradicted, stale and insufficient evidence.

Qualification transitions are explicit and preserve previous/new decision, reason, decisive evidence, timing, failed gates, confidence, review state and ranking-off. Raw signal count is not an input. In the controlled pass, four `prioritize` and two `monitor` decisions correctly remained unchanged because no current timing evidence existed.

## 8F. Controlled monitoring pass

Artifact: `ml/data/signal-temporal/amor-de-gea-block8-2026-07-30T12-50-20-362Z.json`

- Accounts: Natural + Mente, Tu Tienda Saludable, Hotel Spa La Colina, BioPlaza, Distribuidora DAM and Somos Consiente.
- Persisted baseline cutoff: `2026-07-30T00:33:22.535Z`.
- Active triggers checked: 12 (new location plus distribution agreement for each account).
- Query plans: 36 valid account-specific queries; execution intentionally selected two per account.
- Queries executed: 12/30, all through Brave; 8 raw results; zero provider errors and zero retries.
- Extractions: 0/12 because no result passed the entity + event + publication-date candidate gates.
- Accepted/rejected evidence: zero accepted signal evidence; raw non-candidates were not promoted into the signal ledger.
- Signal candidates / accepted / corroborated: 0 / 0 / 0.
- Counterevidence: no candidate existed, so no candidate-specific countersearch was required or fabricated.
- Material changes: 0.
- Unchanged/no-current-signal accounts: 6.
- Qualification transitions: 0.
- Timing: six `no_current_timing_evidence`.
- Cost: `cost_not_measured`; the provider returned no cost estimate. This is not reported as USD 0.

This is the first honest What Changed result for these accounts: each had a real prior cutoff, bounded monitoring completed successfully, and no new dated event passed the acceptance gates. The correct output is `no_current_signal`, not a positive opportunity and not a claim that nothing happened.

## 8G. Persistence and integration

Migration 043 is generated at `supabase/migrations/043_signal_temporal_monitoring.sql` and contains only the four justified tables. It has RLS, service-side tenant scope, stable/idempotent keys, immutable run/signal/change history, supersession links and ranking/report-off checks. It has **not** been applied.

The current pass is durably reproducible as a local immutable artifact and continues to use migration 042 as the authoritative evidence/claim/account-state/dossier baseline. Database signal-ledger persistence is explicitly blocked pending user approval of 043; the artifact records this limitation instead of claiming database success.

The provider-free snapshot loader now discovers the newest Block 8 artifact and publishes the `signal-temporal-v2` capability version without raising maturity from signal volume. The Admin Command Center adds an internal temporal-monitoring panel with accounts, triggers, queries, candidates, accepted signals, material changes, migration state and honest cost state. It performs no provider calls during render.

Temporal outputs support current signal, strengthening, weakening, contradiction, What Changed, timing interpretation, monitoring update, qualification change, corroboration recovery, counterevidence finding, stale warning, research gap, no material change and no current signal. All are internal, unreviewed, ranking off and report off.

## 8H. QA and readiness

Targeted Block 8 suite: 50/50 passed. It covers the required semantic, temporal, source-independence, budget, idempotency, safety, no-current-signal and qualification invariants.

Regressions verified at implementation time:

- Block 7 Research Quality: 62/62.
- Block 6 Evidence & Temporal: 55/55.
- Admin Command Center: 36/36.
- TypeScript typecheck: passed.

Additional validation/registry/auth/ranking regressions and the production build are recorded in the final verification section below.

Final verification:

- OS contracts: 25/25.
- Intelligence Snapshot: 27/27.
- Output/Pattern Registries: 28/28.
- Validation lifecycle: 50/50.
- Admin Auth: 48/48.
- Admin login routing: 57/57.
- Ranking/intelligence v2: 31/31.
- Ranking/intelligence v3: 52/52.
- TypeScript: passed.
- Next.js production build: passed (134 static pages generated; Admin Intelligence compiled).

### Readiness impact

LeadLens now has a conservative observation-mode temporal engine and the first real, bounded account-over-account comparison. This materially improves analytical depth, but it does not by itself increase outcome performance, differentiation/lift or customer-report readiness. Signal volume is zero and does not lower or inflate maturity; the six valid no-current-signal outputs improve honesty and monitoring coverage.

### Remaining limitations

- Migration 043 awaits explicit approval, so the database signal ledger is unavailable.
- The current two trigger families cover expansion and distribution/partnership; the registry supports the full taxonomy, but this pass did not execute every family.
- Brave returned only eight raw results and no dated entity-matched event candidate in this short same-day baseline window.
- Provider-reported cost remains unavailable.
- No real signal was available to exercise live corroboration or candidate counterevidence; those paths are fixture-tested.
- No recurring scheduler exists by design.
- No human review or outcome sample exists.

### Exact next block recommendation

After explicit approval and application of migration 043, run one persistence verification/replay using this same artifact and confirm tenant isolation plus immutable insert semantics. Then begin **Block 9 only**: broaden temporal coverage through trigger prioritization and baseline cadence design while keeping execution manual/controlled, ranking off and reports internal. Do not start automated scheduling, pattern promotion or customer-facing temporal claims.

### Stop confirmation

Block 8 stops after final QA, checkpoint updates and one stable commit. No Block 9 work, scheduler, ranking learning, pattern promotion, customer report or market expansion is included.
