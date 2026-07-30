# LeadLens Intelligence OS — Checkpoint

## Current block
**Block 9 — Signal Recovery Benchmark, Source Calibration and Monitoring Operations — DONE.**

## Block 9 — DONE

- Audited the eight Block 8 results individually: four correct-entity static
  pages, three wrong entities/geographies and one old official static document.
  All eight rejections were correct; no acceptance gate was weakened.
- Added a 19-case real public benchmark: 8 known positives, 5 source/window
  negatives and 6 adversarial cases. Fixture replay is provider-free,
  deterministic and explicitly separated from production intelligence.
- Preliminary curated-fixture results: 10/10 TP, 9/9 TN, 0 FP, 0 FN; precision,
  recall and identity precision 100%. These are benchmark logic results, not
  production outcomes.
- Live 24-query comparison: Brave succeeded 8/8 and recovered acceptable dated
  results for 5/6 positive cases while rejecting 2/2 adversarial cases; Tavily
  Search found event content but supplied no dates; Serper failed 8/8 with HTTP
  400. Cost remained not measured.
- Tavily extraction succeeded 8/8. Targeted English/Spanish visible-dateline
  recovery improved exact dates from 0/8 to 7/8 without treating retrieval time
  as publication time. IKEA remains honestly unresolved in extraction.
- Added ten-gate diagnostics, false-negative/false-positive attribution,
  provider/query-family metrics, resumable/idempotent monitoring operations,
  failed-account-only retry and decision/signal-specific cadence policy. No
  scheduler was created.
- Same-six calibrated rerun: 18 searches, 56 raw results, 54 dated, 40
  event-pattern results, 2 correct-entity results, 0 candidates, 0 valid
  signals, 0 material changes and 0 decision transitions. Identity was the
  primary bottleneck; all false-positive protections remained active.
- Migration 043 was verified applied and reused: 1 run, 12 triggers, 0 signals
  and 6 corrected account-specific changes persisted. A no-signal change-ID
  collision was found, fixed and reprocessed offline; the original row remains
  immutable for audit.
- Command Center additions are provider-free, preliminary/benchmark-labeled and
  additive in Overview, Evidence and Gaps & Actions. Outcome Performance,
  Intelligence Lift, ranking, patterns, auth and customer reports remain
  unchanged.
- Verification: Block 9 38/38, Block 8 51/51, Block 7 62/62, evidence 55/55,
  date resolver 14/14, Command Center 36/36, Snapshot 27/27, Registries 28/28,
  Validation 50/50, Admin Auth 48/48, login routing 57/57, ranking v2 31/31 and
  v3 52/52. TypeScript and production build passed.
- Full details:
  `LEADLENS_BLOCK_9_SIGNAL_RECOVERY_BENCHMARK_REPORT.md`.

## Next block

Block 10 should narrowly improve provider-specific query decomposition and
external-source entity recovery for Colombian accounts, fix or retire Serper,
and expand reviewed category coverage. Do not start scheduling, customer
alerts, ranking learning, pattern promotion or the final Amor de Gea report.

## Block 8 — DONE

- Added `signal-temporal-v2`: 54 signal categories, explicit signal/event states,
  ten-dimensional materiality, category-specific decay/expiry policy, atomic
  event normalization, source independence and strict observation-only defaults.
- Added baseline-required trigger registry, verified-identity monitoring-query
  planner, overlap windows, provider-date uncertainty, stable/idempotent run IDs
  and hard query/extraction/trigger caps. No scheduler or render-time provider call.
- Added signal-specific corroboration and bounded counterevidence contracts,
  What Changed v2, gated Timing v2, explicit qualification transitions and
  14 internal temporal output types. Raw signal count affects no decision.
- First real same-six-account temporal pass: baseline
  `2026-07-30T00:33:22.535Z`, 12 active triggers, 12/30 queries, eight raw
  results, zero provider failures, zero dated entity-safe event candidates,
  zero accepted/corroborated signals, six honest `no_current_signal` outputs,
  zero material changes and zero qualification transitions. Cost is
  `cost_not_measured`, never fabricated as zero.
- Generated minimal migration 043 for four immutable/RLS-protected ledgers:
  runs, triggers, signals and changes. It is pending explicit application;
  migration 042 remains the authoritative baseline.
- Snapshot and Command Center consume the local Block 8 artifact provider-free
  and expose monitoring metrics without inflating maturity, ranking or report
  eligibility.
- Verification: Block 8 50/50, Block 7 62/62, Block 6 55/55, Command Center
  36/36, OS contracts 25/25, snapshot 27/27, registries 28/28, validation 50/50,
  Admin Auth 48/48, login routing 57/57, ranking/intelligence v2 31/31 and v3
  52/52. TypeScript and production build passed.
- Full audit and run ledger:
  `LEADLENS_BLOCK_8_SIGNAL_TEMPORAL_MONITORING_REPORT.md`.

## Next block

Apply migration 043 only with explicit approval, replay the existing artifact
to verify immutable database persistence and tenant isolation, then scope Block
9. Do not begin scheduling, ranking learning, pattern promotion or customer
temporal reports.

## Block 7 — DONE

- Deterministic verified-data-only account research profiles with ambiguity
  risks and evidence gaps; unknown aliases/parents/locations are never invented.
- Bounded entity-safe query planner with eight quality dimensions, explicit
  rejection reasons and identity-first adaptive execution.
- Task-specific provider routing, global retry/query/extraction caps and
  provider quarantine/fallback after failure.
- Formal source tiers A–D, accepted/rejected evidence ledger and strengthened
  entity gates. Tier D is discovery-only.
- Atomic claim recovery separates fact, interpretation and recommendation.
  Account-controlled website/social sources count once; provider duplication is
  never independent corroboration.
- Explicit bounded counterevidence for every dossier; absence is recorded only
  as `not_found_within_bounded_search`.
- Eight-gate qualification with internal-only `act_now/investigate_now/
  prioritize/monitor/low_priority/exclude` decisions and monitoring triggers.
  Identity, timing and evidence cannot be compensated by structural ranking.
- Same-six-account pass: 19 queries, 1 retry, 8 extracts, 17 accepted and 27
  rejected evidence records, 8 wrong-entity rejections, 4 dated items, 6 atomic
  footprint claims, 0 current commercial claims, 0 independent corroborations,
  counterevidence 6/6, qualification 6/6, decisions 4 prioritize + 2 monitor,
  0 actionable. Cost remains not measured.
- Migration 042 was sufficient. Six corrected versioned dossiers, evidence,
  claims and account states were persisted; no migration 043.
- Snapshot/Admin integration is provider-free and additive inside existing
  tabs. Ranking, auth, customer reports, patterns and maturity thresholds remain
  unchanged.
- Tests: Research Quality 62/62, Evidence/Temporal 55/55, Command Center 36/36,
  Validation 50/50, Registries 28/28, Admin Auth 48/48 and structural ranking
  17/17; TypeScript and production build clean. See
  `LEADLENS_BLOCK_7_RESEARCH_QUALITY_REPORT.md`.

## Next block

**Block 8 — Targeted Current-Signal Recovery and Human Qualification Review.**
Improve date-bearing business-media/partner discovery, repair the Serper HTTP
400 request path and add server-mediated human review for internal account
qualifications. Do not change ranking, auto-publish dossiers, promote patterns,
run broad expansion or resume the final Amor de Gea report.

## Block 5 — DONE (authenticated operational Command Center)

- **Previous page:** `/admin/intelligence` was a client-side feedback/preferences observatory. It did not load the Intelligence Snapshot, capability registry, output registry, Block 4 validation lifecycle, gaps, next actions, readiness or evidence integrity.
- **Admin architecture:** `admin-view-model.ts` assembles one provider-free, presentation-safe model per request. It combines the latest deterministic artifact, canonical snapshot, output/pattern registries and optional Supabase learned preferences, feedback and migration-041 lifecycle snapshots. Full, partial and DB-unavailable states are explicit; unavailable values remain `null`, never zero.
- **Protected API:** `GET /api/admin/intelligence/command-center` uses the recovered `requireAdmin` boundary, returns `private, no-store`, adds `noindex`, exposes no service key and fails closed with a useful 503 state. Tenant/actor IDs cannot be supplied by the browser. Migration 041 was **available** during authenticated local QA.
- **New page:** institutional, desktop-first Command Center with hash-preserving tabs: Overview, Capabilities, Outputs, Patterns, Validation, Gaps & Actions, Readiness and Evidence. One initial API request avoids waterfalls; detailed evidence is collapsed until requested.
- **Overview:** real diagnosis, structured-knowledge maturity, 50% level confidence, insufficient-evidence overall state, strongest/weakest capability, primary bottleneck, highest-leverage action, brief-ready status, cutoff/methodology, all eight maturity dimensions and explicit explanations for unmeasured states and Evidence Integrity score 0.
- **Capabilities:** dense expandable table over real capability assessments with mode/measurement/exercised filters, samples, evidence, impacts, limitations, failure modes, promotion criteria and milestones.
- **Outputs:** six real Block-3 outputs from the current artifact; types, claims, confidence, measurement states, validation/review/eligibility, ranking impact, evidence, reasoning, counterevidence and unresolved questions. All remain unreviewed/internal and ranking-off.
- **Patterns:** real registry only. Current state is zero patterns; the page explains learned-preference count 0, `MIN_PATTERN_SAMPLE=5`, remaining evidence/review requirements and why outputs never become patterns automatically.
- **Validation:** real Block-4 funnel and lifecycle bottleneck; current counts are generated 6, reviewed/corrected/relevant/acted/outcome 0. Feedback observability and observation learner are preserved here. No model/ranking update is implied.
- **Gaps/actions/readiness/evidence:** real priority-ordered gaps and action queue, effort/impact semantics, system-level readiness funnel/blockers, explicit non-persisted trends and unmeasured lift, corroboration explanation (`0/8` in evaluated shortlist), source-operation links and knowledge-infrastructure disclaimer.
- **Preserved operations:** Growth Observatory, Review Queue, Source Access and Source Review remain linked; old feedback observability was demoted into Validation instead of deleted.
- **Security/performance:** existing Admin auth behavior unchanged; normal-user API access denied; no provider/LLM calls on render; no protected raw JSON dump; Command Center page bundle 10.2 kB / 104 kB first load.
- **Tests/build:** Command Center **36/36**, Admin Auth **48/48**, login routing **57/57**, OS contracts **25/25**, snapshot **27/27**, registries **28/28**, validation **50/50**, Market-to-Account **17/17**, pipeline **22/22**, segment universe **21/21**. `next build` passed.
- **Browser QA:** authenticated local Admin session with an ephemeral test signature; Overview and all seven detail tabs rendered, no infinite loading, no console warnings/errors, and no page-level horizontal overflow at 1280×default or 900×900. This is local verification, **not production deployment verification**.
- **Screenshots:** `artifacts/block5-command-center/01-overview.png` through `08-evidence.png`.
- **Production/ranking/report impact:** no deployment performed; no ranking/scoring/customer-report/auth changes, provider searches, baseline evaluation, historical persistence or automatic learning.

## Next block

**Block 6 — Self-knowledge and Improvement Queue Governance.** Turn the already-derived diagnosis/gaps/actions into an auditable operational improvement workflow with owners, review decisions, blocked reasons, promotion/freeze recommendations and evidence-based completion—without ranking mutation or automatic capability promotion.

### Exact next prompt

> Continue LeadLens from committed Intelligence OS Block 5 in `LEADLENS_INTELLIGENCE_OS_CHECKPOINT.md`. Execute exactly **Block 6 — Self-knowledge and Improvement Queue Governance**. Reuse the existing snapshot diagnosis, gaps and next-best actions to build a deterministic, auditable improvement workflow: explicit owners, dependencies, review decisions, evidence-required completion, blocked/frozen states, and conservative promotion/freeze recommendations. Connect it to the Admin Command Center without changing Admin authentication, production ranking, customer reports, providers, historical snapshot persistence or Intelligence Lift baselines. Never let task completion alone promote a capability; require operational evidence and human approval. Add tenant-safe persistence only if the targeted reuse audit proves it necessary, add honesty/idempotency/security tests, run build and authenticated browser QA, update both checkpoints, commit, and stop before Block 7.

## Block 4 — DONE (durable validation + conservative learning)

- **Targeted reuse audit:** migrations 023/031/038/039 and `opportunity_feedback` remain useful for aggregate feedback/outcome vocabulary, but cannot safely represent immutable IntelligenceOutput snapshots, correction history, ordered transitions, action linkage, attribution limitations or learning implications. Legacy feedback is adapted only with an explicit known `output_id`; all other rows remain honestly unlinked.
- **Pure lifecycle (`validation-lifecycle.ts`):** centralized ordered state graph for `unreviewed → review/correction → client relevance → action → outcome`; invalid shortcuts throw. Original outputs are cloned and never overwritten. Reviews retain reviewer/role, original and reviewed statements, correction history, confidence/evidence/relevance/safety judgments, notes, timestamps and methodology version.
- **Semantic separation:** factual review and client relevance are independent. Commercial actions (`research/save/contact/response/meeting/proposal`) are separate from attributed outcomes. `client_rejected` never becomes a negative commercial outcome and `no_outcome` never becomes refuted.
- **Attribution and learning safety:** every outcome requires a linked action, bounded attribution confidence and at least one attribution limitation. Learning implications require a linked outcome, remain `observation|shadow|human_reviewed`, require approval for human-reviewed mode and are structurally fixed to `ranking_impact:"off"`. One outcome never creates/promotes a pattern.
- **Report eligibility:** defaults to `internal_only`; human approval alone produces at most `review_required`. Client relevance plus evidence-quality and customer-safety judgments are required for a customer-safe projection. Nothing is automatically published.
- **Persistence (`041_intelligence_validation_loop.sql`):** narrowly justified append-only tables for validations, review history, actions, outcomes and learning implications. UUID primary keys, tenant/client scope, immutable JSON snapshots, idempotency uniqueness, linkage FKs and checks. RLS is enabled with no authenticated policies: only trusted server services can read/write. Migration is created but **not applied** in this block.
- **Server repository (`validation-store.ts`):** browser input cannot supply tenant/actor identity; server context injects it. Writes preserve idempotency keys and complete attribution snapshots. No API/UI was added.
- **Snapshot integration:** deterministic `validation_summary` exposes review/correction/relevance/action/outcome/expiration counts, honest coverage measurements, implication counts and lifecycle bottleneck. Learning implications are projected with ranking off. Empty data yields `no_observations`/`not_measured`, never a fabricated zero.
- **Outcome anti-inflation:** `Outcome Performance` now needs at least **5 attributable non-`no_outcome` outcomes**. Samples 1–4 are `insufficient_evidence`; zero remains `not_measured`.
- **Verification:** validation loop **50/50**, OS contracts **25/25**, snapshot **27/27**, registries **28/28**; `npx tsc --noEmit` and `git diff --check` pass.
- **Production impact:** no provider calls, ranking/scoring changes, Admin/UI/auth/report changes, historical trends or baseline work. Current real six outputs remain unreviewed and internal.

## Historical next block after Block 4

**Block 5 — Admin Intelligence Command Center**, consuming these read-only projections and server-mediated review services. It has not been started.

### Historical exact next prompt for Block 5

> Continue LeadLens from `LEADLENS_INTELLIGENCE_OS_CHECKPOINT.md` after committed Block 4. Execute exactly **Intelligence OS Block 5 — Admin Intelligence Command Center**. Build an authenticated, read-first Admin surface over the existing snapshot, output registry, pattern registry and validation summaries; expose honest measured/unmeasured states, lifecycle bottlenecks, evidence/counterevidence and server-mediated human review actions. Do not call providers, modify ranking, auto-promote patterns, auto-publish customer outputs, fabricate historical trends or Intelligence Lift, change Admin authentication, or apply migration 041 without explicit authorization. Add authorization, tenant-isolation, rendering and honesty tests; update both checkpoints, commit, and stop before any later block.

## Block 3 — DONE (provider-free output + pattern registries)

- `lib/intelligence/output-registry.ts` (NEW, `output-registry-v1`): pure adapter from a real Market-to-Account/segment-universe artifact into deterministic `IntelligenceOutput`s. It emits only conclusions supported by recorded counts/coverage; every generated output is `unreviewed`, `not_eligible`, `outcome_state:"none"`, `ranking_impact:"none"`, and novelty remains `not_measured` without a baseline.
- `lib/intelligence/pattern-registry.ts` (NEW, `pattern-registry-v1`): pure adapter from `learned_preferences` rows into tenant-scoped `IntelligencePattern`s. Rated sample `< MIN_PATTERN_SAMPLE (5)` ⇒ `insufficient_sample`; sufficient sample ⇒ `observation` only. `ranking_impact:"off"`, `report_impact:"off"`, mode observation; no automatic production/human-approved promotion.
- **Claim separation strengthened in `os-contracts.ts`:** outputs now retain affected market/segments/accounts/client, typed supporting facts/signals, and patterns retain accounts/time range/basis/report impact. Guards reject facts without evidence, validated conclusions without a real validation state/reference, collapsed fact/signal kinds, timing interpretations without dated fact/signal evidence, and unreviewed customer-eligible outputs.
- **Snapshot integration:** `SnapshotInput` accepts registries; the snapshot carries deterministic outputs/patterns plus `registry_summary` (counts by type/state/eligibility, strongest supported output, primary pattern limitation). Registry presence is deliberately excluded from maturity derivation and cannot inflate any dimension.
- **Real current artifact:** latest provider-free loader produces **6 outputs**: one segment-coverage insight, one false-positive-avoidance output, one structural-not-timing prioritization insight, and three risk findings (verified-universe limitation, weak corroboration, no timing evidence). All are artifact-scoped and not report-eligible. The artifact produces no cross-market pattern.
- **Real current patterns:** Supabase `learned_preferences` contained **0 rows** at verification time, so the live registry correctly produces **0 patterns**. No insufficient-sample pattern is fabricated from absence. Fixture coverage proves below-floor rows remain `insufficient_sample` and sufficient rows remain observation-only.
- **Honesty preserved:** structural fit emits no timing output; channel access stays `channel_fit_not_buying_intent`; probable identities never become verified; one pilot never creates a cross-market pattern; no baseline ⇒ novelty/lift unmeasured; no prior comparable state ⇒ no What Changed output; no recommendation/validated conclusion is generated by the artifact adapter.
- **Persistence decision: DEFERRED (no migration).** Block 3 registries are deterministic projections. Human review state, validation history and lifecycle persistence belong to Block 4; historical snapshots remain Block 7.
- **Tests:** `test:intelligence-registries` **28 passed**. Regressions green: OS contracts 24, snapshot 26, learner 33/33, Market-to-Account 17, staged pipeline 22, segment universe 21. `tsc --noEmit` clean.
- **Production/ranking/report impact: zero.** No provider calls, no UI changes, no customer report changes, no selector/scorer imports, no Admin/auth changes.

## Historical next block after Block 3

**Block 4 — Validation and Learning Loop.** Link an `IntelligenceOutput` to human review, correction, client relevance, action and commercial outcome using existing feedback/outcome schemas. Keep ranking off and do not redesign Admin in that block.

### Historical exact next prompt for Block 4

> Continue LeadLens from `LEADLENS_INTELLIGENCE_OS_CHECKPOINT.md` after Block 3. Execute exactly **Intelligence OS Block 4 — Validation and Learning Loop**. Reuse existing `IntelligenceValidation`, `IntelligenceOutcome`, `opportunity_feedback`, learned-preference and migration-039 outcome contracts to build a deterministic, tenant-safe output→review→correction→client relevance→action→commercial outcome→learning projection. Do not auto-promote patterns, do not change ranking, reports, Admin authentication or Admin UI, do not call providers, and do not claim outcome performance without real outcomes. Add targeted honesty/idempotency tests, integrate only the validation/outcome summaries needed by the snapshot, document the persistence decision narrowly, update both checkpoints, commit, and stop before Block 5 Admin Command Center.

## Block 2 — DONE (deterministic snapshot engine)
- `lib/intelligence/snapshot-engine.ts` (NEW, `INTELLIGENCE_SNAPSHOT_METHODOLOGY_VERSION = "snapshot-methodology-v1"`): pure, provider-free `buildIntelligenceSnapshot(input)` → `IntelligenceSnapshot`. Documented methodology in one header block (sources, sample thresholds, capability/maturity/dimension rules, missing-data behavior, action prioritization, limitations). **Self-validates** with the Block-1 guards and THROWS rather than shipping a dishonest snapshot.
- `lib/intelligence/snapshot-loader.ts` (NEW): the only environment-touching part (outside the determinism contract). Reads the latest `ml/data/pilot-amor-de-gea/<ts>/{segment-universe,staged-pipeline}.json`; DB-only signals stay honest nulls ⇒ `not_measured`/`not_instrumented`. `assembleLiveSnapshot()` runs on real files with no provider/LLM calls.
- **Real Amor de Gea snapshot (verified honest output):** LEVEL `structured_knowledge` (conf 0.5); overall `insufficient_evidence` (2/8 dims measurable); dims — analytical_depth measured 49, evidence_integrity measured 0 (0 corroborated in pilot shortlist), differentiation `not_measured`, commercial_relevance/client_specificity/temporal `insufficient_evidence`, learning_maturity `no_observations`, outcome_performance `not_measured`; readiness `brief_ready` (3 customer-safe outputs, 4 high blockers); top gap `no_commercial_outcome` (critical); strongest cap `structural_account_ranking`, weakest `outcome_learning`.
- **Anti-inflation proven by the engine's own guards:** during development the guard rejected two over-claims (`counterevidence_analysis` and `structural_account_ranking` asserting analytical maturity without evidence) — fixed so a maturity level is asserted only with a real sample or production status.
- **Persistence decision: DEFERRED (no migration).** Only one snapshot exists; a trend needs ≥2. The snapshot is cheap + provider-free, so Block 5 (Admin) will consume `assembleLiveSnapshot()` on demand. `intelligence_index_snapshots` persistence lands in **Block 7** once a recurring snapshot cadence exists. Documented as gap `no_historical_snapshots`.
- **Tests:** `test:intelligence-snapshot` **26 passed** (all 20 required invariants: provider-free assembly, deterministic replay, stable serialization, missing-data≠zero, volume≠analytical, one-pilot≠client-specificity, tests/schema≠production, no-outcomes⇒not_measured, no-baseline⇒not_measured, shadow≠production, insufficient-sample⇒insufficient, evidence-integrity honesty, critical-gap-blocks-premium, deterministic+deduped gaps, actions-from-gaps, conservative maturity, diagnosis-matches-data, cutoff+methodology present, ranking-untouched). Companions green: os-contracts 24, market-to-account 17, segment-universe 21, learner 33/33. `tsc` clean.
- **package.json:** added `test:intelligence-snapshot` to scripts + `release:check`.
- **Production impact: zero.** No ranking/selector import (asserted by test 20); no persistence; no observation/shadow promotion.

---

## Block 1 — Intelligence Domain Contracts — DONE. (Block 0 below.)

## Block 1 — DONE (canonical domain contracts)
- `lib/intelligence/os-contracts.ts` (NEW, `OS_CONTRACTS_VERSION = "os-contracts-v1"`): all 16 required contracts + honesty guards. NO UI, NO persistence, NO migration, NO ranking impact.
- **Contracts:** IntelligenceMeasurementState (9 states), IntelligenceMaturityLevel (5, ordered + `maturityRank`), OperationalMode (9 + `NON_PRODUCTION_MODES`), IntelligenceScope (global/tenant/client — always explicit), MeasurementResult (`MeasuredValue | UnmeasuredValue`; **score structurally impossible unless `state:"measured"`**), IntelligenceEvidenceReference (+`EVIDENCE_KINDS`, `NON_OPERATIONAL_EVIDENCE`), IntelligenceClaim (discriminated union fact/signal/inference/hypothesis/recommendation/validated_conclusion), IntelligenceCapability, IntelligenceCapabilityAssessment, IntelligenceMaturityDimension (8 dims), IntelligenceMaturityIndex, IntelligenceLiftAssessment, IntelligenceOutput, IntelligencePattern (+`MIN_PATTERN_SAMPLE=5`), IntelligenceValidation, IntelligenceOutcome (aligned to 039 `FeedbackDimension`), IntelligenceGap, NextBestIntelligenceAction, ReportReadinessAssessment (5 levels), IntelligenceSystemDiagnosis, IntelligenceSnapshot.
- **Runtime honesty guards (testable):** `validateMeasurement`, `assessProductionEligibility`, `validateCapabilityAssessment`, `isValidated`/`validateOutputHonesty`, `normalizePatternState`, `deriveOutcomePerformance`, `deriveIntelligenceLift`, `validateReadiness`, `serializeIntelligence` (recursive key-sort for deterministic replay).
- **Reused:** `FeedbackDimension` from `feedback-taxonomy.ts`; measurement-state vocabulary mirrors `growth-index.ts` discipline; outcome kinds align with migration 039 (`progressed/terminal_positive/terminal_negative`). No Amor de Gea hardcoding — vertical/tenant agnostic.
- **Tests:** `test:intelligence-os-contracts` **24 passed** (all 15 required invariants: required fields, unmeasured states, no-score-when-unmeasured, volume≠maturity, schema≠production, tests≠production, shadow≠production, generation≠validation, recommendation≠fact, pattern-sample floor, no-outcomes⇒not_measured, no-baseline⇒not_measured, critical-gap-blocks-premium, explicit scopes, deterministic serialization). Related existing green: market-to-account 17, premium-report-contract 23, segment-universe 21. `tsc --noEmit` clean.
- **package.json:** added `test:intelligence-os-contracts`; also added the previously-missing `test:segment-universe` to `release:check`.
- **Production impact: zero.** Types + pure guards only.

---

## Block 0 — DONE (Directed Audit & Intelligence Map)

## Completed work (Block 0)
- Directed audit of the real intelligence surfaces (no broad repo scan). Verified: `/admin/intelligence` page + 4 subpages + 7 Admin API routes; `lib/intelligence/*` (growth-index, feature-snapshot, feedback-taxonomy, preference-learner, shadow-preference); `lib/memory/*` (account-memory, change-classifier); discovery/report/quality modules; relevant migrations.
- Produced the two architecture/data documents + this checkpoint.

## Files changed
- `LEADLENS_INTELLIGENCE_OS_ARCHITECTURE.md` (new) — target architecture, 4-layer model, maturity model, registries, snapshot engine, security/compat, block plan, honesty gates.
- `LEADLENS_INTELLIGENCE_DATA_MAP.md` (new) — 10 audit deliverables: page map, data-source map, capability map, schema-reuse map, instrumentation map, gaps, measurable-today vs not, minimal architecture, block plan pointer.
- `LEADLENS_INTELLIGENCE_OS_CHECKPOINT.md` (this file, new).

## Schemas reused (no new persistence in Block 0)
`opportunity_feedback` (023/031/038/039), `learned_preferences` (031), `vault_companies/signals/sources`, `account_memory` (025/026), `snapshot_reports` (024/027), `institutional_snapshots` (035), delivery-readiness (019). ML tables (032) **not applied** → stay `blocked_by_migration_032`.

## Migrations added
None (Block 0 is audit-only). Candidate for later: **`intelligence_index_snapshots`** (trends) — the only clearly-justified new table; decision deferred to Block 2.

## Tests
None added in Block 0 (no code). Existing `release:check` suite unchanged.

## Versions
- Maturity model version: **v0 (proposed)** — 5 levels + 8-dim index, to be implemented in Block 1.
- Snapshot methodology version: **not yet defined** (Block 2).
- Precedent: `GROWTH_INDEX_VERSION = 1` (`lib/intelligence/growth-index.ts`) — honest-state discipline to reuse.

## Known limitations (verified, honest)
- No 8-dim Intelligence Maturity Index yet (only 5-component Growth Index).
- No capability/output/pattern registries beyond single-feature `learned_preferences`.
- No output→validation→outcome linkage (039 columns exist but empty).
- No persisted snapshots → **no real trend is computable**.
- Feedback volume very low (~5 events); most dimensions will be `insufficient_evidence`/`not_measured` — this is correct and must be shown honestly.
- Migration 032 (ML) not applied.

## Production-impact status
**Zero.** Block 0 changed no code, no schema, no ranking. Observation/shadow safety intact.

## Observation/shadow safeguards
Preserved: `preference-learner` + `shadow-preference` never touch ranking; UI shows "ranking: Off". All future blocks must keep observation/shadow non-production-impacting.

## Historical next block after Block 2
**Block 3 — Output & Pattern Registry** (typed adapters over `learned_preferences` + Market-to-Account/evidence artifacts; strict fact/signal/inference/hypothesis/recommendation separation; sample-size + confidence gates via the Block-1 contracts; observation/shadow status with **no production ranking impact**). Do NOT invent outputs from empty data.

### Block 3 preparation notes
- Consume `os-contracts.ts` `IntelligenceOutput` / `IntelligencePattern` + `normalizePatternState` (MIN_PATTERN_SAMPLE=5) + claim discriminants.
- Adapt `learned_preferences` → `IntelligencePattern` (observation/shadow; `ranking_impact:"off"`); do NOT treat them as validated intelligence.
- Adapt Market-to-Account artifacts (segment landscape, verified/probable/excluded, reason codes, channel-fit-not-buying-intent) → `IntelligenceOutput` as facts/inferences (never as validated recommendations).
- Feed the resulting `outputs`/`patterns` into the snapshot (currently `[]`). Keep the snapshot self-validation green.
- Add tests: empty data ⇒ empty registry (no fabrication); pattern below floor stays `insufficient_sample`; recommendations carry `requires_validation`; fact/inference never collapse.

## Historical exact prompt for Block 3
> Continue the LeadLens Intelligence OS from `LEADLENS_INTELLIGENCE_OS_CHECKPOINT.md` (commit at Block 2). Execute **Block 3 only — Output & Pattern Registry**: build typed adapters that turn `learned_preferences` into observation/shadow `IntelligencePattern`s (ranking impact off, sample-gated by MIN_PATTERN_SAMPLE) and Market-to-Account/evidence artifacts into `IntelligenceOutput`s with strict fact/signal/inference/hypothesis/recommendation separation — never fabricating outputs from empty data, never marking a generated recommendation validated, never letting a pattern affect production ranking. Wire the registries into the snapshot's `outputs`/`patterns`. Add targeted tests (empty⇒empty, sample floor, claim separation, no ranking impact). Typecheck, commit, update the checkpoint, and stop after Block 3. Do not begin the validation loop or Admin UI.

## Latest commit
`dc35ca1` — Intelligence OS Block 3: output + pattern registries (Block 4 base).
`92a8840` — Intelligence OS Block 2: deterministic snapshot engine.
`45c3bef` — Intelligence OS Block 1: canonical domain contracts + honesty guards.
`23f684d` — Intelligence OS Block 0: directed audit + intelligence/data map (on `17a0dbf`).

## Runtime links
- Admin (dev): `http://localhost:3000/admin/intelligence`
- Latest real artifact: `ml/data/pilot-amor-de-gea/2026-07-27T01-35-36-464Z/` (21 verified / 29 probable / 114 excluded; 7 segments).
