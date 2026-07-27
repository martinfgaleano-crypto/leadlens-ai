# LeadLens Intelligence OS — Checkpoint

## Current block
**Block 1 — Intelligence Domain Contracts — DONE.** (Block 0 below.)

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

## Next block
**Block 2 — Intelligence Snapshot Engine** (deterministic assembly of the index + capability assessments + evidence integrity + gaps + next actions + report readiness + system diagnosis from REAL existing data, `not_measured` elsewhere). Define the snapshot methodology version. Add replay-determinism, idempotency, missing-data and sparse-data tests. Persist historical snapshots **only if** the audit-confirmed need holds (single candidate table `intelligence_index_snapshots`); otherwise keep it a typed projection. No UI.

### Block 2 preparation notes
- Consume `os-contracts.ts` types + guards. The engine must call `validateMeasurement`/`validateCapabilityAssessment`/`validateReadiness` on its own output and refuse to emit an invalid snapshot.
- Real data sources ready to read: `growth-index.computeGrowthIndex()` (map its 5 components into the 8 dimensions where they correspond; the rest → `not_measured`/`not_instrumented`), `opportunity_feedback`(+039 outcomes), `learned_preferences`, vault counts, and the latest harness artifacts under `ml/data/pilot-amor-de-gea/<ts>/`.
- Use `serializeIntelligence` for the replay/idempotency assertions.
- Snapshot must run with **no provider/LLM calls**; explicit `source_data_cutoff` + `methodology_version`.

## Exact next prompt
> Continue the LeadLens Intelligence OS from `LEADLENS_INTELLIGENCE_OS_CHECKPOINT.md` (commit at Block 1). Execute **Block 2 only — Intelligence Snapshot Engine**: build a deterministic, provider-free assembler that reads real existing data (`growth-index`, `opportunity_feedback`/039, `learned_preferences`, vault counts, latest `ml/data/pilot-amor-de-gea` artifacts) and produces an `IntelligenceSnapshot` per `os-contracts.ts` — mapping available signals into the 8 maturity dimensions and marking everything else `not_measured`/`not_instrumented`, computing capability assessments, evidence integrity, gaps, next-best actions, report readiness and a rules-based diagnosis. Define a snapshot methodology version; validate output with the contract guards; add tests for deterministic replay, idempotency, missing-data and sparse-data. Persist `intelligence_index_snapshots` only if trend history genuinely requires it, else keep a typed projection. No Admin UI. Typecheck, commit, update the checkpoint, and stop after Block 2.

## Latest commit
`45c3bef` — Intelligence OS Block 1: canonical domain contracts + honesty guards.
`23f684d` — Intelligence OS Block 0: directed audit + intelligence/data map (on `17a0dbf`).

## Runtime links
- Admin (dev): `http://localhost:3000/admin/intelligence`
- Latest real artifact: `ml/data/pilot-amor-de-gea/2026-07-27T01-35-36-464Z/` (21 verified / 29 probable / 114 excluded; 7 segments).
