# LeadLens — Confirmed Context Persistence + Live Discovery Handoff V1 — Report

**Date:** 2026-08-25 · **Scope:** make a user-confirmed commercial context a durable, versioned, owner-isolated input to real LeadLens discovery. No Lead Hunter, no Monitor, no landing, no pricing, no provider expansion, no live research.

## 1. Git / Preconditions
- Branch `main`; initial HEAD `dfb36c8` (previous adapter commit); `origin/main` at `c61534e` (7 unpushed commits, no divergence).
- `dfb36c8` **contained** in HEAD (verified `merge-base --is-ancestor`). No git contradiction. Proceeded.

## 2. Existing Context Persistence Audit
- `commercial_intents` (049): authenticated intent/checkout linkage, owner-isolated, RLS, server-only writes — **not** a structured-context store.
- `onboarding_requests` (050): holds **raw prose** fields (`what_you_sell`, `ideal_customer`, `commercial_objective`) — not the validated contract.
- No store for the validated `ConfirmedCommercialContextV1`. Canonical discovery entry = `publicSignalProvider.searchLeads(criteria)` → `runCompanyFirstDiscovery(icp, criteria)`; the canonical config object is **`LeadSearchCriteria`**.

## 3. Persistence Decision
**New store** (no existing one fits; reusing `onboarding_requests` would store prose as canonical state, which §9 forbids). Structured `ConfirmedCommercialContextV1` persisted as validated JSONB with denormalized lookup columns.

## 4. Schema / Migration
`supabase/migrations/053_confirmed_commercial_contexts.sql` (**created, NOT applied**):
- Columns: `user_id`→auth.users, `context_id` (logical group), `version` (≥1), `supersedes_version`, `client_id?`, `schema_version='1'`, `objective_type` (denormalized), `payload jsonb` (validated context), `provenance_summary`, `effective_from`, `confirmed_at`, `created_at`.
- `unique(user_id, context_id, version)`; latest-lookup index `(user_id, context_id, version desc)`.
- **Immutability**: `leadlens_prevent_context_mutation()` trigger raises on UPDATE/DELETE (blocks even the service role — append-only).
- **RLS**: owner-only `select`; no insert/update/delete policy for `authenticated` (server-only writes via service role). Does not touch historical migrations.

## 5. Confirmation Write Gate
`persistConfirmedContext(store, interp, {userId, contextId})` runs `confirmInterpretation` and persists **only** on success. Refuses (no row) for unsupported objective, open blocker, not-confirmable/ready, not execution-ready, or truth-boundary violation. Confirmation is the doorway; unconfirmed interpretations never become durable executable state.

## 6. Versioning / Immutability
Monotonic `version` per `contextId`; a genuine change appends `N+1` with `supersedesVersion=N`; historical versions never mutate. **Idempotency**: a re-confirm whose execution-relevant fingerprint equals the latest version returns the existing record (`created:false`) — no version churn on retry.

## 7. Owner Isolation
Every store read is `userId`-scoped; DB adds RLS + owner-mismatch protection. `loadConfirmedContext` never returns another user's rows (tested). Server authorizes; client-provided owner IDs are not trusted (service-role client + JWT verification pattern, matching 049/050).

## 8. Execution Adapter Wiring
`discovery-handoff.ts`:
- `confirmedContextToDiscoveryCriteria(ctx)` — pure map `ConfirmedCommercialContextV1` → canonical **`LeadSearchCriteria`**, built on `adaptConfirmedContext` (reuse, no second pipeline). Industries/geography/exclusions/offer/goal/region mapped; `watchSignalFamilies`→`buying_signals` (watch config); `require_real_discovery:true`.
- `prepareDiscoveryFromContext(store, userId, selector)` — server-side gate: load authorized (owner-scoped) persisted context → adapt → criteria + `{contextId, version}` lineage. Fails safe (`context_not_found`) — never falls back to prose.

## 9. Discovery Integration
The produced `LeadSearchCriteria` is exactly what `publicSignalProvider.searchLeads` / `runCompanyFirstDiscovery` consume. The real application path now reaches the canonical Discovery input from a confirmed, persisted context. **No provider call is made** (§23/§24) — the proof is reaching the canonical config boundary, exercised with an in-memory store standing in for Supabase.

## 10. Raw-Prose Boundary
`ConfirmedCommercialContextV1` carries no raw prose; the criteria are built solely from structured fields. Tested: criteria contain no `rawInput` and no original sentence; discovery is executable without any prose.

## 11. LLM Service Boundary Audit (§20)
`interpret-service.ts` imports only canonical contracts (`SignalFamily`, landing types), the deterministic extractor, and dynamically `callClaudeJSON`. **No** provider/discovery/supabase import; the "discovery" tokens are `discoveryRequired` (a target-definition state). It produces a **draft** `CompanyInterpretationV1`, deterministically assigns provenance (model can't emit `externally_verified`/Signal/invented accounts), and **never** calls `confirmInterpretation`/`adaptConfirmedContext`/`prepareDiscovery`/discovery. **No bypass exists; no fix required.** Guarded by two new source-level regression tests.

## 12. Golden E2E Fixtures
Software/manufacturing **PASS**, Consulting **PASS**, Partnerships **PASS** — each: fixture → confirm → persist → load → adapt → canonical `LeadSearchCriteria`, no evidence produced, correct target relationship (partner not forced to customer).

## 13. Blocked Inputs
Investors (unsupported), "help companies grow" (blocker), consulting-no-market (target blocker), and unconfirmed/`needs_clarification` all **refused before persistence** (store stays empty). Unknown context → `context_not_found`, no discovery.

## 14. Truth-Boundary Validation
User context never becomes fact/signal/timing/evidence: persisted context has no `externally_verified`, no Fit/Timing/Decision/observed-Signal fields; produced criteria carry no evidence/observation vocabulary; `buying_signals` are canonical watch tokens (hypotheses), and `not fintechs` maps to exclusion **configuration**, not counterevidence.

## 15. Account Memory Compatibility
`account_review_snapshots.context_version` (052) is a `text` lineage field. `prepareDiscoveryFromContext` returns `{contextId, version}` which maps into it (e.g. `ctx:2`), so a review under v1 vs v2 is classifiable as "context changed" vs "account changed". **No Account Memory code changed.** Live Supabase acceptance of Account Memory snapshots remains **unproven in-repo** — recorded as a P1 operational gate, not addressed here.

## 16. Tests
New `scripts/fixtures/confirmed-context-persistence.test.ts` — **31/31**. Regression (unchanged, green): execution-context-adapter 22, company-interpretation 33, interpret-discovery 30, interpret-service 33, landing-interpretation-integration 18, commercial-continuity 17, demo-safety 6, account-memory 27, account-memory-store 18, account-opportunity-synthesis 40, amor-phase4-6-portfolio 29, deliverable-renderer 60. `tsc --noEmit` clean; `npm run build` clean.

## 17. Production State
- Migration **created**: yes (`053`). Migration **applied**: **no** (this environment cannot apply production migrations).
- Live DB change required: **yes** — founder must apply `053_confirmed_commercial_contexts.sql` to Supabase before the persistence path is live.
- Until applied, `SupabaseConfirmedContextStore` has no table; domain logic is proven via the in-memory store. Nothing here claims operational production persistence.

## 18. Remaining P0/P1/P2
- **P0:** none.
- **P1:** apply migration `053`; wire `prepareDiscoveryFromContext` into a real authenticated API/job route (this sprint built the domain seam, not the HTTP route); prove live Account Memory acceptance.
- **P2:** map `client_id` to a real client identity; add `stakeholderHypotheses` → titles if discovery later wants them; persist the `context_version` string convention alongside job rows.

## 19. Recommended Next Intelligence Move
1. **Guarded LLM Stage A Production Hardening V1** (schema-constrained + one repair + rate limit + privacy-safe observability) — the boundary is now safe to make self-serve.
2. Wire the persistence + handoff into the real authenticated onboarding→job route (apply `053` first).
3. **Then** Automated Lead Hunter Intelligence V1 — only after intake→execution is operational end-to-end in production.
