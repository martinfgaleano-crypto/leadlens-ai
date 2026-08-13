# LeadLens — Full Authenticated Journey QA V1

Date: 2026-08-13

## Repository, migrations and deployment

- Initial HEAD: `22f2e858d562ce56aeaa302324c8d018dcc34504`.
- Origin at start: same commit; branch `main` was synchronized.
- Migrations 049, 050 and 051 were not changed or reapplied.
- Real bounded queries verified the 049 Commercial Intent shape, the 050 authenticated onboarding shape and the 051 lifecycle ledger shape.
- Production already served the committed onboarding UI and APIs from `22f2e85`.
- Push of the journey fixes failed because this environment has no GitHub HTTPS credentials. Production therefore does not yet contain the fixes recorded below.

## Objective defects found and fixed

1. A new auth user had no `profiles` row before visiting Dashboard. Because `onboarding_requests.user_id` references `profiles`, direct plan → auth → onboarding failed with HTTP 503. The onboarding API now creates the minimal owner profile server-side before persistence.
2. Normal login always selected `/dashboard` after the Admin bridge and discarded the validated customer `return_to`. Login now preserves the customer destination while retaining Admin precedence.
3. Onboarding retries could insert repeated rows. The API now atomically claims `captured → onboarding_started`, returns the already linked onboarding on sequential retry, and completes the intent only after persistence.
4. Migration 051 existed but Commercial Intent and onboarding transitions did not write its ledger. Both server APIs now emit idempotent, metadata-empty lifecycle rows. Ledger failure remains nonfatal and is logged without customer content.

## QA account and data boundary

- The same Supabase project backs local and Production; no non-production project exists.
- Two ordinary synthetic non-admin users were used for browser QA and two for each bounded API verification.
- No provider, Discovery, payment, entitlement or customer intelligence operation ran.
- Credentials were temporary, never committed and removed after use.
- Browser run created one intent, one onboarding and two lifecycle events. Final cleanup: zero QA users and zero associated Commercial Intents, onboarding rows or lifecycle events.

## Plan, Commercial Intent and RLS

- Intelligence plan, source CTA, Spanish locale and `/onboarding` destination survived real sign-in after the fix.
- Preview/higher-tier plan contracts, invalid products and safe-return rules pass deterministic coverage.
- Real Commercial Intent persisted with the authenticated owner, canonical product, catalog version, source CTA, locale, safe return path and `captured` status.
- Authenticated browser INSERT/UPDATE/DELETE remains denied. User B cannot read User A's intent or onboarding.
- Commercial Intent is not entitlement and no lifecycle step activates a paid product.

## Onboarding, persistence and geography

- The real six-field onboarding submitted successfully against the shared Supabase project.
- Minimal profile bootstrap, row owner, Commercial Intent linkage and final `onboarding_completed` transition were verified.
- Colombia + United States normalized deterministically, deduplicated and persisted as authoritative `target_countries`.
- Refresh/resume restored the saved country context.
- Sequential retry returned the existing onboarding and left exactly one row.
- Missing/invalid core data returned a customer-safe HTTP 400 response.

## Dashboard, monitor and Account Brief

- Real ordinary session reached Dashboard with no redirect loop.
- Refresh retained the session; a direct protected route worked.
- Core Dashboard showed Account/Opportunity/Monitor/Brief language and no visible Credits, Leads or Search-first CTA.
- New-user Dashboard did not fabricate an opportunity or What Changed data.
- Monitor route protection and empty shell were verified without running a monitor/provider.
- Account Brief visual rendering was checked through the guarded development preview; owner, non-owner and unauthenticated behavior remains covered by existing server tests. No synthetic production Brief was created.

## Logout and password recovery

- Logout removed the session and a subsequent direct Dashboard request returned to Login.
- Forgot Password accepted the QA address and returned a generic non-enumerating message.
- Invalid recovery code reached a safe handled error.
- PKCE exchange, password update, weak/invalid state and callback behavior remain covered by deterministic tests.
- Reset email receipt and successful one-time callback/password replacement require founder inbox access and remain manual.

## Locale, analytics and privacy

- EN/ES customer-flow contracts remain covered; PT/JA remain contract-tested.
- Real ES plan/login/onboarding continuity passed. Full authenticated translation is not claimed; document `lang` remains `en` and is P2.
- Real `commercial_intent_created` and `onboarding_completed` ledger rows were verified.
- Event uniqueness is enforced by `(user_id, event_name, object_type, object_id)`.
- Persisted metadata was empty and contained no email, business text, target-customer text, account intelligence or evidence.
- `first_usable_opportunity_delivered` remains server-only, delivery-gated and idempotent; it was not emitted because no job/report was created.

## Responsive and accessibility QA

- Login, Dashboard, onboarding, Forgot Password, Reset Password, Monitor and guarded Brief were exercised at 1280, 768, 430, 390, 375 and 360 pixels.
- Final checks showed no horizontal overflow or off-screen interactive controls at any required width after allowing the responsive shell to settle.
- Forms expose labels, autocomplete where applicable, required validation, associated hints and accessible error/status regions. Keyboard/source-link depth remains P1 manual QA after deployment.

## Verification

- Authenticated product: 36/36 pass.
- Commercial continuity: 17/17 pass.
- Payment gate: 5/5 pass.
- Admin login routing: 58/58 pass.
- Report delivery: 15/15 pass.
- Premium report contract: 23/23 pass.
- Focused total: 154/154 pass.
- TypeScript: pass.
- Production build: pass; 141/141 routes generated.
- External provider calls: 0.
- Discovery: not run.
- Billing: not activated.

## Gates and scorecard

| Dimension | Before | After local/shared-DB QA |
|---|---:|---:|
| Auth completeness | 7 | 9 |
| Commercial Intent | 8 | 10 |
| Plan continuity | 7 | 10 |
| Onboarding persistence | 4 | 10 |
| Geography integrity | 7 | 10 |
| Dashboard stability | 7 | 9 |
| Brief access | 8 | 8 |
| Session reliability | 6 | 9 |
| Password recovery | 6 | 8 |
| Lifecycle analytics | 5 | 9 |
| Mobile authenticated UX | 6 | 9 |
| Accessibility | 7 | 8 |
| Security / ownership | 9 | 10 |
| Customer lifecycle coherence | 6 | 9 |
| Commercial readiness | 5 | 8 |

P0: push/deploy the two local fix commits, then rerun the bounded production verifier. Full password-reset completion additionally needs the manual email link.

P1: final production keyboard/focus pass and real owner-bound Brief browser QA when a safe genuine deliverable exists.

P2 / Claude later: authenticated localization depth, route-level HTML language and non-blocking aesthetic polish.

Authenticated visual/functional freeze: **PROVISIONAL** because the fixes have not reached Production.

Ready for billing sandbox: **NO**. Minimum blocker: deploy and repeat the now-passing authenticated checks against the deployed code. No billing integration should begin before that confirmation.

## Deployment, rollback and exact next sprint

Deployment: push `main` → wait for Vercel Ready → run `node scripts/qa/verify-authenticated-journey-production.mjs` → perform founder reset-email callback → smoke Login/Dashboard/Onboarding at 390 and 1280 → confirm cleanup.

Rollback: revert the application commits only. Do not alter or roll back migrations 049–051.

Exact next Codex sprint: **Production Authenticated Journey Reverification + Billing Gate Closeout**, followed—only if green—by **LeadLens Billing Sandbox + Verified Entitlement V1**.

Stop confirmed: no billing, providers, Discovery, landing redesign, Account Brief redesign or pilot work was performed.
