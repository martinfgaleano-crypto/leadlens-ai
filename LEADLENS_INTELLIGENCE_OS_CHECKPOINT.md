# LeadLens Intelligence OS — Checkpoint

## Current block
**Block 0 — Directed Audit & Intelligence Map — DONE.**

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
**Block 1 — Intelligence Domain Contracts** (TypeScript types only; tests for required fields + honesty states + no-false-production-maturity; no UI, no broad persistence).

## Exact next prompt
> Continue the LeadLens Intelligence OS from `LEADLENS_INTELLIGENCE_OS_CHECKPOINT.md`. Execute **Block 1 only — Intelligence Domain Contracts**: create reusable, tenant-aware TypeScript contracts for capability, capability assessment, maturity dimension, maturity index, intelligence output, pattern, validation, outcome, gap, next action, report readiness, intelligence snapshot, and explicit unknown/unmeasured states — reading from existing data shapes (`growth-index`, `learned_preferences`, `opportunity_feedback`/039, market-to-account artifacts), with no UI and no broad persistence. Add targeted tests: required fields, honesty states, and that knowledge volume / passing tests / schema existence cannot produce production maturity, and that shadow ≠ production and generation ≠ validation. Typecheck, commit, update the checkpoint, and stop after Block 1.

## Latest commit
`ce9afcb` — Intelligence OS Block 0: directed audit + intelligence/data map (on `17a0dbf`).

## Runtime links
- Admin (dev): `http://localhost:3000/admin/intelligence`
- Latest real artifact: `ml/data/pilot-amor-de-gea/2026-07-27T01-35-36-464Z/` (21 verified / 29 probable / 114 excluded; 7 segments).
