# LeadLens — Automated Lead Hunter V1.1 — Production Run Persistence + Authenticated Job Integration

**Date:** 2026-08-26 · **Scope:** make Lead Hunter a production-operational job stage — durable universe persistence + authenticated job integration. No landing/pricing/Monitor/new-provider/engine changes; V1 brain unchanged.

## 1. Git / Preconditions
Branch `main`; HEAD `625e279` at start; `origin/main` == HEAD; clean worktree. Migration `054` live (confirmed-context persistence canonical — verified).

## 2. Existing V1 Architecture
`lib/lead-hunter/candidate-universe.ts` (plan/hunt/classify/owner-scoped entry) + `discovery-runner.ts` (reuses `runCompanyFirstDiscovery`). Produced a `CandidateAccountUniverse` in-memory only. Reused unchanged.

## 3. Production Gap
Universe not durably persisted; not wired into the authenticated job lifecycle. Closed here.

## 4. Job Integration
New authenticated route `app/api/customer/lead-hunter/route.ts` (POST, maxDuration 300): `createServerClient` → `auth.getUser` → owner `user.id`; rate-limit `lead-hunter:${user.id}` (4/min); body `{context_id, version?}` **only** (no candidate injection); `SupabaseConfirmedContextStore` + `SupabaseLeadHunterRunStore` + `defaultDiscoveryRunner` → `runAndPersistLeadHunter`. Refusals → 404/503. Returns runId + coverage + reviewRequired + the owner's candidates.

`runAndPersistLeadHunter` (`hunt-and-persist.ts`): owner-scoped `huntFromConfirmedContext` → persist immutable snapshot → return `{runId, universe, created, reused}`. Idempotent (deterministic runId; existing → reuse, no duplicate). Failure persisted as a **failed** run (never a fabricated completed universe).

## 5. Persistence
**Reused `snapshot_reports` — no new migration** (same convention as `vault-generation-store`, which persists non-report snapshots there). `run-store.ts`: `LeadHunterRunStore` port + `InMemory` (tests) + `Supabase` impl. Row: `job_id`=runId (unique → idempotency), `user_id` (owner), `status` (completed/failed), `report_json` = namespaced `_lead_hunter_universe` payload (contextRef + universe + createdAt), `plan="lead_hunter"`. **Live acceptance passed** against real Supabase: insert (created:true) → idempotent re-insert (created:false) → reload (provenance intact, no evidence leak) → clean delete. No founder action required; persistence is **operational now**.

## 6. Context Lineage
Each run carries `{contextId, version}`. runId = `lh_<contextId>_v<version>_<date>`. A historical V1 run stays V1 after a V2 context exists (tested); latest runs use the latest version. No dynamic reinterpretation of historical runs.

## 7. Idempotency / Retry
Same runId re-invoked → reuse persisted snapshot (`created:false, reused:true`), never a duplicate. Immutability: a stored run is never rewritten (verified: a different discovery result under the same runId keeps the original). A genuine new cycle (new date/runId) persists separately. Failed run → retry on a new runId succeeds.

## 8. Ownership
Owner isolation end-to-end: confirmed-context load is owner-scoped (RLS), runId derives from an owned context, `user_id` stamped on the snapshot, reads user-scoped. Verified: attacker can neither hunt nor read another owner's context/universe. Browser never sends a candidate list.

## 9. Candidate Universe Roundtrip
Persist→reload preserves canonical identity, status, statusReason, provenance, opportunityConditionIds, watchSignalFamilies, openQualificationQuestions, coverage, gaps, context lineage — with **no** Fit/Timing/Decision/Evidence introduced (typed + tested).

## 10. Exception Handling
`reviewRequired` classes persisted (identity_ambiguity / provider_anomaly / unsupported_target_type / repeated_zero_yield). Mixed universe: eligible/likely/needs_validation candidates proceed to Research; excluded + identity_ambiguous are held — **valid subset never blocked** by an ambiguous one (§20, tested).

## 11. Downstream Research Handoff
`toResearchCandidates(universe)` → `LeadCandidate[]` for the pipeline's existing **`candidatesOverride`** seam (skips provider discovery, processes exactly these). Discovery provenance carried as source **context only** (`source_url`), never Evidence; `confidence_score` is identity confidence, not an opportunity score. Downstream smoke: the seam accepts the persisted candidates (mock pipeline). Research still independently owns claims/Signals/What-Changed/Evidence/Fit/Timing/Decision.

## 12. Observability / Economics
Persisted per run: discovered/unique/per-status counts, duplicateRate, providers used/failed, routes attempted, gaps, runId, context lineage, reviewRequired. Provider calls/cost recorded by the engine's usage ledger (`recordProviderCall`/`recordLLMUsage`). Cost/run measurable from the ledger; not fabricated. No dashboard.

## 13. Colombia / Spanish Smoke (executed, bounded)
Synthetic Colombian software/manufacturing context (geography Colombia, latin_america region → Spanish query variants), preview tier, **22.1s**: 3 discovered / 3 unique, **1 eligible / 2 identity_ambiguous / 0 excluded**; providers Brave+Tavily up, Serper down (graceful); sample names Becomp, Pololu, Electronica I+D. **Finding:** Colombia recall is thinner and identity ambiguity higher than the US case (2/3 vs 1/8) — the predicted low-public-footprint / Spanish-name-collision risk is real. Critically, the gates **held**: a wrong-entity ("Pololu", a US robotics company) was flagged `identity_ambiguous`, not silently qualified. Per §27 this is a signal, **not** a coverage benchmark; recorded as a future evidence-driven source-ecosystem/identity task. Gates were not weakened.

## 14. Tests
New `lead-hunter-production.test.ts` **20/20** (persistence, reload, immutability, idempotency, retry, failed, degraded, all-fail, owner isolation ×2, historical V1/V2, mixed review, handoff ×2, downstream accept, observability, route guards, reuse). Regression green: lead-hunter-universe 27, confirmed-context-execution 21, confirmed-context-persistence 31, interpret-discovery 30, company-first-discovery 77, discovery-engine-v2 40, commercial-continuity 17, account-memory 27. `tsc --noEmit` clean; `npm run build` clean (`/api/customer/lead-hunter` registered). Live persistence + two live discovery smokes executed.

## 15. Production Verdict
**LEAD HUNTER PRODUCTION-OPERATIONAL WITH NON-BLOCKING P2.** Durable immutable persistence live (no migration), authenticated route wired, owner-isolated, idempotent, fail-safe, downstream handoff proven. P2: end-to-end HTTP run not exercised with a real signed-in user session (domain path + live store proven); Colombia recall/identity is a known thin spot.

## 16. Automation Estimate
US golden live: 7/8 auto-eligible. Colombia live: 1/3 eligible, 2 flagged review. Normal supported (mature-market) runs: **~85–90%** no founder intervention; Colombia/private-footprint markets currently lower (more identity-review exceptions). Basis: two live smokes + 47 deterministic tests. Exception classes: identity_ambiguity, uncertain_hard_exclusion, provider_anomaly, unsupported_target_type, repeated_zero_yield.

## 17. Remaining P0/P1/P2
- **P0:** none.
- **P1:** exercise the route with a real signed-in session (staging E2E); Serper quota exhausted (degradation covers it).
- **P2:** Colombia/Spanish source-ecosystem + identity resolution improvements (evidence-driven, separate sprint); optional dedicated `lead_hunter_runs` table if snapshot_reports mixing becomes a concern; route-yield COGS metrics.

## 18. Recommended Next Intelligence Move
1. Account Memory live Review1→Review2 acceptance.
2. Recurring Monitor Intelligence V1.
3. Provider-routing / COGS optimization from real production-run data.
