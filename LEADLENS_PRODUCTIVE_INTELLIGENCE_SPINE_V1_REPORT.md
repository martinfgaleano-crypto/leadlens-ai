# LeadLens Productive Intelligence Spine V1 Report

## 1. Git / Preconditions

- Branch: `main`.
- Baseline and `origin/main`: `d804d4cc0805d5a2284033fc7d46b420507a645d` before this sprint.
- No reset, rebase, push, provider, migration, Monitor, scheduler, pricing, or Landing change was made.
- Eight pre-existing untracked visual/landing audit documents were preserved and are not part of this sprint.
- The existing `snapshot_reports`, confirmed-context, and Lead Hunter stores were reused.

## 2. Audit Finding Verification

All six reported P0 findings were verified against the baseline:

| Finding | Baseline result | Resolution |
|---|---|---|
| A. `persistConfirmedContext()` had no productive confirmation caller | VERIFIED | Authenticated signed-token confirmation endpoint now calls the canonical store. |
| B. Persisted Candidate Universe had no productive Research consumer | VERIFIED | The productive run reloads the persisted universe and hands its eligible subset to Research. |
| C. Lead Hunter handoff helpers had no productive downstream consumer | VERIFIED | `loadLeadHunterUniverse()` and `toResearchCandidates()` are now in the runtime spine. |
| D. Customer discovery bypassed Lead Hunter | VERIFIED | `/api/customer/discovery` is now a compatibility alias to the productive run route. |
| E. Customer discovery was synchronous and non-durable | VERIFIED | Stable run state is persisted through `snapshot_reports`; completed and failed states reload. Execution remains request-started rather than worker-queued. |
| F. Initial reports did not execute full `synthesizeCase()` | VERIFIED | Every successfully delivered lead is passed to canonical `synthesizeCase()` and canonical decisions are consumed by institutional dossiers. |

## 3. Previous Runtime Fragmentation

The baseline had separate paths: Interpretation stopped in browser state; confirmed contexts could start isolated discovery; Lead Hunter persisted a universe and stopped; legacy discovery independently selected candidates; initial report decisions used legacy dossier mappings. No single production call graph connected all of them.

## 4. Confirmation Action

- `POST /api/interpret` issues an owner-bound, expiring, HMAC-signed `confirmation_token` only for authenticated ready-for-confirmation interpretations.
- `POST /api/customer/contexts/confirm` requires Supabase authentication and the signed token.
- The browser sends authorization plus references, not Evidence, Fit, Timing, Decision, candidates, or externally-verified state.
- Confirmation is explicit; nothing auto-confirms.
- The route marks the interpretation as user-confirmed, rejects illustrative/unsupported objectives, and calls `persistConfirmedContext()`.

## 5. Confirmed Context

The canonical confirmed-context store remains authoritative. Owner, immutable `contextId`/`version`, fingerprint/idempotency, and supersession semantics are preserved. Execution resolves the exact requested version once; creating V2 cannot rewrite a V1 run.

## 6. Durable Run Lifecycle

`startIntelligenceRun()` is the sole new server-side orchestration boundary. It accepts owner, exact context reference, plan, bounded delivery/research limits, and an optional idempotency key. It does not accept raw prose, candidates, Evidence, or Decision.

Run IDs are deterministic SHA-256 identities over owner, context ID, version, and idempotency key: `intel_<32 hex>`. Owner entropy prevents global collisions. Existing `snapshot_reports` rows hold `processing`, `completed`, or `failed` plus stages `lead_hunter`, `research`, `case_synthesis`, and `report`, exact lineage, attempt, Lead Hunter run reference, and final report.

## 7. Lead Hunter Integration

The chain invokes canonical `runAndPersistLeadHunter()` with the exact confirmed context. Lead Hunter builds and persists `CandidateAccountUniverse`; no founder or browser candidate selection is accepted. Lead Hunter run scoping now includes owner and run entropy. A module-global discovery timestamp was removed so concurrent runs cannot leak mutable state.

## 8. Candidate Universe Persistence

Candidate universes remain in the existing Lead Hunter run store. The durable Intelligence run stores the Lead Hunter run ID. If Research fails, the universe remains available. A retry first reloads that universe and does not repeat a successful Lead Hunter run.

## 9. Research Handoff

After Lead Hunter, the orchestrator deliberately reloads the durable universe via `loadLeadHunterUniverse()` and converts only the eligible subset via `toResearchCandidates()`. Ambiguous candidates remain held while valid candidates proceed. Discovery provenance is retained in `discovery_provenance`; it is no longer copied into `source_url`, so it cannot become Opportunity Evidence without independent Research acceptance.

## 10. Research Breadth vs Delivery Count

`PipelineInput` now distinguishes `researchCandidateLimit` from `deliveryLimit`. The pipeline can investigate a bounded universe larger than the customer delivery set and trims only after ranking/intelligence. Delivered totals, opportunity rankings, counts, averages, and report intelligence summaries are recomputed for the selected delivery set. Account Memory receives only delivered leads.

## 11. Extraction Boundary

The existing Research/pipeline implementation remains in place; no provider or parallel extractor was added. The spine supplies canonical identity and context. A source is treated as a verified current signal for canonical synthesis only when Research output includes a dated `verified_public_signal`, a valid source URL host, and a signal date. Discovery provenance alone never satisfies this boundary.

## 12. Canonical Case Synthesis

Successfully quality-controlled delivered leads are converted into `CanonicalCaseInput` and passed to `synthesizeCase()`. The durable report stores `canonical_cases`, including canonical Decision, reasons, Fit, Timing, Evidence, and first-review semantics. The institutional assembler prefers these canonical decisions; legacy reports retain their existing fallback adapter for compatibility.

First review has no predecessor and no fabricated Since Last Review. A current change is material only when supported by accepted dated evidence.

## 13. Durable Report

Completed reports are stored in `snapshot_reports.report_json`, not only returned synchronously. `GET /api/customer/intelligence-runs/[runId]` authenticates the caller and reloads only an owner-scoped run. The start response returns this API report URL. Existing customer report-page wiring remains a separate UI integration seam; the durable API contract is operational.

## 14. Retry / Idempotency

- A completed run with the same stable identity reloads without rerunning Research.
- A failed Research attempt retains and reuses the successful Lead Hunter universe.
- Failed state and sanitized failure code are durable.
- Retry increments the attempt and produces one completed durable report.
- Concurrent create races reload the already-created row.

## 15. Tenant Isolation

Context resolution, Lead Hunter universe loading, run creation/update, and report reload are owner-scoped in application queries. Run IDs include owner entropy. Tests intentionally use identical context IDs, versions, and dates for two owners and prove distinct run IDs and isolated state. Wrong-owner reload returns no run.

## 16. Live Acceptance

A disposable live Supabase acceptance was not executed because no disposable authenticated user/session was available without touching customer data. No customer rows were created or deleted. The production routes compiled in the Next.js build, and the complete server-side chain was exercised deterministically through its real orchestration contracts with in-memory stores and bounded fake Research/Lead Hunter dependencies. This is a non-blocking P2 acceptance gap, not a missing runtime call path.

## 17. Tests

- Productive-spine integration: **25 passed, 0 failed**.
- Focused regression suites: **354 passed, 0 failed** across interpretation hardening, confirmed-context persistence/execution, Lead Hunter universe/production, company-first discovery, canonical full-text extraction, deliverable rendering, portable delivery, and commercial continuity.
- Total recorded checks: **379 passed, 0 failed**.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; all 150 static pages generated and new routes compiled.
- `git diff --check`: passed before report creation and must be rerun before commit.

The focused suite covers explicit confirmation, signed/owner-bound/tamper-resistant confirmation state, unsupported objective rejection, exact version lineage, execution by references, no candidate injection, durable and tenant-safe run identity, Lead Hunter invocation/persistence/reload, mixed universes, provenance separation, research breadth, canonical synthesis, first-review semantics, durable reload, failure state, retry/idempotency, tenant collision, and concurrency isolation.

## 18. Production Verdict

`PRODUCTIVE INTELLIGENCE SPINE OPERATIONAL WITH NON-BLOCKING P2`

The real server-side runtime chain now exists and compiles. The verdict is qualified because a disposable live Supabase acceptance and customer results-page wiring were not completed in this backend-convergence sprint.

## 19. Remaining P0 / P1 / P2

### P0

None in Confirmed Context → Lead Hunter → Research → canonical Case → durable Report.

### P1

None within the sprint's backend contract. Monitor identity/route convergence is intentionally out of scope.

### P2

1. Run one disposable authenticated Supabase acceptance and remove its synthetic data afterward.
2. Wire an existing customer journey to confirmation and the productive run endpoints.
3. Make the existing `/results/[jobId]` UI consume owner-scoped productive-run reports (the API result is already durable/reloadable).
4. Consider moving long request-started execution to the existing internal worker lifecycle if real provider latency exceeds deployment limits.
5. Add stale-`processing` recovery for hard serverless termination, which cannot execute the current catch block.

## 20. Recommended Next Sprint

`MONITOR IDENTITY + ROUTE CONSOLIDATION V1`

Before broad activation, include the short live Supabase acceptance and the minimal customer UI seam as entry checks. Do not activate the recurring scheduler until Monitor identity and route authority are consolidated.

## Canonical Runtime Chain

```text
authenticated Stage A interpretation
→ signed explicit confirmation token
→ POST /api/customer/contexts/confirm
→ persistConfirmedContext (exact owner/context/version)
→ POST /api/customer/intelligence-runs (references only)
→ durable Intelligence run
→ runAndPersistLeadHunter
→ persisted CandidateAccountUniverse
→ loadLeadHunterUniverse
→ eligible subset via toResearchCandidates
→ existing Research pipeline (breadth budget > delivery limit where available)
→ independently accepted dated evidence
→ synthesizeCase
→ canonical_cases in institutional report
→ snapshot_reports durable result
→ owner-scoped GET /api/customer/intelligence-runs/[runId]
```

## Maturity Update

- Core Intelligence components: **92%**. Canonical modules and authority contracts exist; Monitor remains separate by design.
- Operationally integrated Intelligence: **82%**. The initial productive spine is connected and durable; worker recovery and Monitor consolidation remain.
- Limited Self-Serve Intelligence readiness: **68%**. Secure backend contracts exist, but the minimal customer confirmation/start/results UI seam and live persistence acceptance remain.

These percentages are judgment-based architecture maturity estimates, not mechanical averages or quality/precision claims.
