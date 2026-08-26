# LeadLens — Confirmed Context Live Self-Serve Execution Acceptance V1 — Report

**Date:** 2026-08-25 · **Scope:** operationalize (not re-architect) the confirmed-context → real discovery path. No Lead Hunter, Monitor, Landing, pricing, or provider changes.

## 1. Git / Preconditions
Branch `main`; HEAD `aab2f67`; `origin/main` = `aab2f67` (prior sprint was pushed by the founder — HEAD == origin). `aab2f67` present. No contradiction.

## 2. Migration 053 State
**NOT applied to live Supabase.** Verified non-destructively via `scripts/accept-confirmed-context.mjs` (service-role select of every expected column) → `TABLE_MISSING :: Could not find the table 'public.confirmed_commercial_contexts'`. Per §4, no live-persistence claim is made.

**FOUNDER ACTION REQUIRED: apply `supabase/migrations/053_confirmed_commercial_contexts.sql` to the live Supabase project.** After it is applied, re-run `node scripts/accept-confirmed-context.mjs` to confirm structure + RLS.

## 3. Live Persistence
Not exercised against live DB (table absent). Domain logic (write gate, versioning, idempotency, owner isolation) is fully exercised via `InMemoryConfirmedContextStore`. Live insert acceptance is intentionally **not** forced: the `user_id`→`auth.users` FK plus the append-only immutability trigger mean synthetic production rows cannot be cleanly created or cleaned up, so structure-only verification is the correct non-destructive live check.

## 4. Authenticated Execution Route
New `app/api/customer/discovery/route.ts` (POST, `maxDuration=300`):
1. `createServerClient()` (503 if unconfigured) → authenticate via `db.auth.getUser(token)` (same pattern as `/api/customer/onboarding`); 401 if no user.
2. Rate-limit `customer-discovery:${user.id}` (6/min).
3. Body zod = `{ context_id, version?, plan? }` **only** — the browser never sends a context object.
4. `SupabaseConfirmedContextStore(db)` + `runDiscoveryFromConfirmedContext(store, user.id, …, runLeadLensPipeline)`.
5. Refusals map to stable codes: `context_not_found`→404, `not_executable`→422, `store_unavailable`→503. No context/prose echoed back.

Because the table is absent, the route currently fails safe (`store_unavailable`/`context_not_found`) — it is production-ready but not live-accepted until `053` lands.

## 5. Ownership
Owner is the server-resolved `user.id` from the verified JWT — never a client field. `loadConfirmedContext` is owner-scoped; the Supabase store filters `.eq("user_id", userId)` and RLS (053) enforces owner-only reads. Tested: a different user gets `context_not_found` with no metadata leak.

## 6. Versioning
`buildDiscoveryJobInput` loads the exact selected version (or latest). Historical V1 execution yields V1 criteria after V2 exists (tested); a job records `{contextId, version}` lineage. V1/V2 immutability is guaranteed by the store (domain) + the 053 append-only trigger (DB).

## 7. Discovery Handoff
`lib/interpretation/confirmed-context-execution.ts`:
- `buildDiscoveryJobInput` → validated `{ onboardingData (server-derived), criteria (LeadSearchCriteria), icp, plan, contextRef }`.
- `runDiscoveryFromConfirmedContext` → runs the injected pipeline with `criteriaOverride + icpOverride`, so `runLeadLensPipeline` **skips prose ICP inference** and executes from the structured confirmed context. The real route injects `runLeadLensPipeline`; tests inject a mock (no providers).

## 8. Raw-Prose Boundary
The pipeline input carries no `rawInput` and no original sentence (tested). `OnboardingData` is derived from the confirmed context; geography is aligned so `assertGeographyContract` holds. Discovery operates from validated structure, not the textarea.

## 9. Golden Flows
Software/manufacturing **PASS**, Consulting **PASS**, Partnerships **PASS** — each: persist → authorized load → adapt → pipeline invoked with structured criteria (partnerships keep partner relationship, not forced to customer).

## 10. Blocked Flows
Investors (unsupported) → never persisted → `context_not_found`, pipeline never called. Vague/blocked → never persisted. Wrong owner → `context_not_found`. Invalid version → blocked. Unconfirmed/`needs_clarification` → not persisted (persistence is the confirmation gate). All verified; pipeline call count 0 in every blocked case.

## 11. Truth Boundary
Signal hypotheses → `buying_signals` canonical watch tokens (config), never observations. Hard exclusions → `excluded_industries`/`disqualification_criteria` (config), not counterevidence. Persisted context has no `externally_verified`/Fit/Timing/Decision/observed-Signal. USER_CONFIRMED ≠ EVIDENCE_VERIFIED holds end-to-end.

## 12. Failure Handling
Store unavailable → `store_unavailable` refusal, pipeline never called (no prose fallback). Missing context → `context_not_found`. Invalid version → blocked. Adapter failure → `not_executable`. All tested; discovery never proceeds on failure.

## 13. Account Memory Compatibility
`account_review_snapshots.context_version` (052, `text`) is compatible with the `{contextId, version}` lineage the execution seam carries. **No Account Memory code changed.** This sprint produces new proof that context-version lineage reaches execution, but **live Review1→Review2 Supabase acceptance remains a separate outstanding P1** — not claimed here.

## 14. Tests
New `scripts/fixtures/confirmed-context-execution.test.ts` — **21/21**. Regression (green): confirmed-context-persistence 31, execution-context-adapter 22, company-interpretation 33, interpret-discovery 30, interpret-service 33, landing-interpretation-integration 18, commercial-continuity 17, account-memory 27, account-opportunity-synthesis 40, deliverable-renderer 60. `tsc --noEmit` clean; `npm run build` clean (route `/api/customer/discovery` registered).

## 15. Production Verdict
**NOT OPERATIONAL** — for the specific claim *Confirmed Commercial Context → Production Discovery Handoff*. The full application path (route → store → adapter → pipeline) is implemented, type-safe, built, and unit-accepted, but the live persistence table does not yet exist. It becomes OPERATIONAL the moment migration `053` is applied (no further code required for the load→adapt→pipeline path).

## 16. Remaining P0/P1/P2
- **P0:** none.
- **P1:** apply migration `053` (founder); re-run the live acceptance probe; prove live Account Memory Review1→Review2 acceptance.
- **P2:** thread `{contextId, version}` onto the persisted job row (`batch_jobs`) so async `/api/process` runs also carry lineage (needs a small additive migration); build the customer confirmation UI that calls `POST /api/customer/discovery`; map `company_name` to a real seller identity.

## 17. Recommended Next Intelligence Move
1. Apply `053` → run one real authenticated E2E (mock provider boundary) → flip verdict to OPERATIONAL.
2. **Guarded LLM Stage A Production Hardening V1** (schema-constrained + one repair + rate limit + privacy-safe observability).
3. **Then** Automated Lead Hunter Intelligence V1. Account Memory live acceptance proceeds in parallel.
