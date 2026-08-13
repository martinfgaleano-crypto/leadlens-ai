# LeadLens — Authenticated Journey QA + Onboarding Persistence V2

Date: 2026-08-13

## Repository and environment

- Initial HEAD: `48e55c224a8ac2ef8acc74565691f8cd5c83f1a9`.
- Initial origin/main: `c136f95f12763144f1829f39a7eb5bdb9f47441f`.
- Branch: `main`.
- Local development and Production use the same Supabase project.
- No separate local, preview, staging or test Supabase project was found.
- Service-role credentials are available locally and remained server-only.
- Unrelated runtime files and two untracked landing audit reports were preserved.

## Migration 049

Migration 049 is closed, immutable and was not modified in this V2 sprint. Founder verification established the 13 expected columns, RLS, owner-select policy, absence of browser mutation policies, index and updated-at trigger. A read-only zero-row query also confirmed the deployed table/columns.

## Production QA account strategy and cleanup

Because production is the only auth environment and ordinary signup is intended product behavior, a bounded two-user production test was performed. User A and User B were random, ordinary, confirmed, non-admin and carried only a `qa_disposable` marker. Passwords/tokens were generated at runtime and never printed, stored or committed.

Two bounded executions were used: the first revealed PostgREST's expected zero-row/no-error behavior for RLS-filtered update/delete; the corrected execution verified affected rows rather than relying on the error object. Both executions deleted both auth users in `finally`. Cascade cleanup of Commercial Intents was verified. Production QA records remaining: **0**.

## Real Commercial Intent and RLS results

- User A authenticated with a real Supabase session.
- Production `/api/commercial-intents` returned HTTP 201.
- Stored product was canonical `intelligence_launch_v0`.
- Owner came from User A's verified JWT.
- Direct browser-role INSERT: denied.
- Direct browser-role UPDATE to `converted`: zero rows affected; original status remained `captured`.
- Direct browser-role DELETE: zero rows affected; row remained present.
- User B SELECT of User A's intent: zero visible rows.
- Cleanup after auth-user deletion: intent absent.

This proves the production migration/API ownership boundary for the currently deployed code. Invalid products, locale and return URLs also remain covered by deterministic tests; arbitrary entitlement is never created by an intent.

## Plan/auth and redirect continuity

Static and deterministic tests prove all four canonical plans survive query-based auth state, legacy aliases resolve through the canonical catalog, unknown products fail closed, and external/protocol-relative/malformed return paths fall back to `/dashboard`. A full visual plan → auth journey was not repeated because the onboarding code at HEAD is not deployed.

## Onboarding architecture and persistence

The repository now contains additive migration 050, authenticated onboarding API and a six-field UI. It reuses `onboarding_requests`; no parallel onboarding model was created. Owner is derived from JWT. Commercial Intent linkage is constrained to the same owner. Customer browser mutation of administrative onboarding fields is absent. Core fields are company, offer, target customer, target countries, commercial objective and delivery email.

`target_countries` is required, normalized, deduplicated, multi-country capable and authoritative. Legacy region is not accepted by the new API and cannot override countries. Existing pipeline geography contracts already prefer exact countries.

Production persistence cannot be truthfully claimed until migration 050 is applied and commit `48e55c2` plus this follow-up are deployed.

## Commercial Intent lifecycle

Current real production state supports `captured`. New server code supports `captured → onboarding_completed` after a real owned onboarding row is created. `checkout_started` and `converted` remain unused while billing is closed. Direct browser transition was proven denied.

## Dashboard, monitor and Account Brief

Dashboard view model uses owned onboarding/monitor/report inputs. It labels the strongest truthful object as latest Account Brief, not “Latest Opportunity.” What Changed stays partial unless a real previous snapshot exists. Monitor cadence remains explicitly manual. No fake monitor, report or customer intelligence was inserted into production.

Real dashboard/monitor/Brief browser QA remains blocked by deployment order. Existing route-level ownership, report delivery and guarded development Brief tests pass, but this is not substituted for real-session visual QA.

## Password reset and session behavior

PKCE request/callback/exchange/update/sign-out implementation and invalid/missing-code behavior pass static/build tests. Real email delivery, link reuse and post-reset login require an account held long enough to receive email; this was intentionally not attempted before deploying the current code. Form-first behavior remains covered by 58 passing auth-routing assertions.

## Locale

EN/ES/PT/JA commercial-flow locale survives validated query state, intent and reset/onboarding contracts. The authenticated product is not claimed as fully translated. HTML `lang` remains P2 pending route-level locale architecture.

## First usable opportunity and analytics

Migration 051 adds the server-only idempotent lifecycle ledger. Predicate:

1. completed user-owned report;
2. delivery readiness is not blocked;
3. at least one account is `act_now`, `validate_first` or `monitor` (legacy fallback: fit score ≥4);
4. unique `(user, event, object type, job)` prevents repeats.

Empty/blocked reports do not emit. Payload contains identifiers, product/locale and coarse count only. Migration 051 is not yet applied.

## Routes, entitlement, support and Premium

- Retired success routes no longer claim payment or legacy lead delivery.
- Future billing seam remains plan → auth → intent → checkout → entitlement → onboarding → job.
- Intent never activates paid entitlement; the server catalog remains canonical.
- Obsolete personal/stale support addresses disappeared with retired success content.
- Premium unsupported automation remains flagged off/partial.
- Commercial Accessibility and Decision Scope remain partial intelligence enhancements, not billing blockers.

## Responsive and accessibility

Real authenticated 1280/768/430/390/375/360 QA is not complete because the current UI is not deployed. New onboarding is a single responsive column with full-width controls. Labels, hint association, native required validation and aria-live errors are present. Auth forms retain labels/autocomplete. Authenticated visual freeze remains **PROVISIONAL**.

## Test runner and verification

`tsx@4.20.3` is now a lockfile-backed dev dependency; no ad-hoc test download is required.

- Authenticated product: 30/30 pass.
- Commercial continuity: 17/17 pass.
- Product catalog: 27/27 pass.
- Geography: 5/5 pass.
- Payment gate: 5/5 pass.
- Admin login routing: 58/58 pass.
- Report delivery: 15/15 pass.
- Premium report contract: 23/23 pass.
- TypeScript: pass.
- Production build: pass, 141/141 routes.
- Provider calls: 0.
- Billing: closed.
- Discovery: not run.
- Pilot changes: none.

## Priority and gates

P0:

1. apply migration 050;
2. apply migration 051;
3. push/deploy application commits;
4. complete real-session auth/onboarding/reset/dashboard/monitor/Brief QA at six widths.

P1: portfolio/Brief lifecycle events, grounded What Changed dashboard read path, final authenticated terminology cleanup.

P2: full authenticated localization/HTML lang and visual polish after functional freeze.

Authenticated visual system freeze: **PROVISIONAL**.

Ready for billing sandbox: **NO**. Exact blocker: onboarding/lifecycle migrations and current application code are not deployed, so the full real authenticated customer lifecycle has not been proven.

## Deployment and rollback

Order: keep 049 untouched → apply 050 → apply 051 → push/deploy `48e55c2` and this QA follow-up → create one temporary ordinary QA account → run full browser/reset QA → delete QA user and verify cascades.

Rollback application code by reverting commits. Do not drop additive tables/columns automatically; they can remain unused. Any destructive schema rollback requires data export and explicit founder approval.

Stop: no billing, checkout, providers, Discovery, customer records, pilots or landing/Brief redesign were performed.
