# LeadLens — Authenticated Journey Verification V1

Date: 2026-08-13

## 1–3. Baseline and environment

- Initial HEAD: `c136f95f12763144f1829f39a7eb5bdb9f47441f`.
- Initial `origin/main`: same as initial HEAD.
- Branch: `main`.
- Environment identity: `.env.local` targets the same remote Supabase project embedded by `https://leadlensintel.com`; therefore it is production, not local/preview.
- Preserved unrelated state: `.leadlens/source-intelligence.json`, `.leadlens/usage.json`, and two pre-existing untracked landing audit reports.

## 4–7. Migration 049 and RLS

Migration 049 is additive and creates `commercial_intents` with mandatory owner, canonical product constraint, attribution, locale, controlled lifecycle, future nullable linkages and timestamps. It cascades only when the owning auth user is intentionally deleted. Legacy users/jobs are unaffected.

Audit added the project-standard `set_updated_at()` trigger. Customer access is read-own only. Inserts and transitions are server-only after JWT verification, preventing client-forced status or ownership transfer. The service role bypass is explicit.

The founder applied 049 through Supabase SQL Editor. A real zero-row schema query verified the table and expected columns are present. No production records were inserted during verification. Full `pg_policies` catalog inspection is unavailable without a SQL/admin connection; the applied SQL and application behavior are deterministically tested.

## 8–10. QA account and real journey

No safe non-production Supabase exists. The only configured project is production. No test user was created automatically, no admin permission was granted, and no auth bypass was added. Real-session QA is deferred until migrations 050/051 and the code commit are deployed; testing the local implementation against a partially migrated production database would produce misleading failures.

## 11–14. Plan, redirects and Commercial Intent

- Canonical plan state survives login/signup through validated query state.
- Unknown product codes fail closed against the server catalog.
- CTA attribution and locale persist.
- Return paths allow only approved same-origin routes; external, protocol-relative, malformed and backslash paths fall back to `/dashboard`.
- After authentication the API derives `user_id` from the verified JWT and persists the canonical product.
- Commercial Intent refresh persistence is database-backed.
- Authenticated browser clients may read only their rows; writes/transitions are server-only.
- Supported transition currently implemented: `captured` → `onboarding_completed`. Checkout/converted states are not fabricated or activated.

## 15–17. Onboarding, normalization and geography

Migration 050 additively extends the existing `onboarding_requests` model instead of creating a duplicate. It adds Commercial Intent linkage, canonical product, commercial objective and locale. The ownership trigger prevents linking an onboarding row to another user's intent.

The authenticated `/onboarding` page has six core fields:

1. company/business identity;
2. offering;
3. target customer;
4. target countries;
5. commercial objective;
6. delivery email.

The server API verifies JWT, derives ownership, normalizes context, persists into the legacy-compatible schema, transitions the owned intent, then marks the owned profile complete. `target_countries` is required, normalized, deduplicated and authoritative. Region remains derived and cannot override exact countries.

Migration 050 has not yet been applied, so end-to-end production persistence remains blocked until founder action.

## 18–22. Dashboard, latest value, monitor and Brief

- Dashboard read model remains based on real onboarding, monitor and completed report state.
- It surfaces the latest real Account Brief, never an invented “latest opportunity.”
- What Changed remains partial and only appears where real prior snapshot/account-memory data exists.
- Monitor truthfully states manual cadence.
- Existing owner-gated Brief and legacy compatibility were preserved.
- No synthetic customer intelligence, providers or Discovery were used.
- Real-session production QA remains pending deployment.

## 23–26. Password, session, logout and locale

Password reset implementation preserves generic non-enumerating request behavior, browser PKCE exchange, code removal from history, active-session validation, password strength/match checks, update and sign-out. Static and build tests pass. Email delivery and a real reset/login cycle were not claimed because no disposable production QA account was created.

EN/ES/PT/JA locale values persist through commercial auth state, intent, reset query state and onboarding. This does not claim complete translated authenticated UI. Root HTML language remains unchanged because server locale routing does not yet exist.

## 27–28. First value and lifecycle analytics

Migration 051 creates an owner-scoped, server-write-only lifecycle ledger with a unique key on `(user_id, event_name, object_type, object_id)`. `first_usable_opportunity_delivered` is emitted only after a completed user-owned report has a non-blocked delivery state and at least one actionable/validatable/monitorable opportunity. Empty or blocked output does not emit. Upsert uniqueness makes it idempotent across retries.

Lifecycle coverage now includes plan selection vocabulary, Commercial Intent creation, auth completion, onboarding start/completion and the server-owned first usable opportunity milestone. No freeform context, email, report body or private evidence is placed in analytics payloads. Portfolio/Brief lifecycle expansion remains P1.

Migration 051 has not yet been applied.

## 29–32. Success routes, entitlement, ownership and negative controls

- Retired `/success` and `/start/success` can no longer claim payment, old lead delivery or a fake order; they redirect to the authenticated dashboard.
- `/start` now enters authenticated onboarding.
- Billing seam remains: plan → auth → intent → future checkout → entitlement → onboarding.
- Checkout remains closed and catalog-controlled server-side.
- New Intent, onboarding and lifecycle records all require explicit ownership.
- Static negative tests prove server-only mutation policies and same-owner intent/onboarding linkage. Live two-user RLS testing remains pending disposable accounts.

## 33. Dev preview safety

`/dev-brief-preview` remains production-404, synthetic, DB-free, provider-free and without auth bypass. No visual change was made.

## 34–39. Responsive QA

1280, 768, 430, 390, 375 and 360 real-session QA remain unverified because the code is not deployed and no non-production auth environment exists. The new onboarding layout uses a single bounded responsive column, full-width controls and no fixed content width beyond `maxWidth: 620`. This is an implementation review, not a substitute for the required visual freeze gate.

## 40–42. Accessibility, support and Premium

- New onboarding inputs have programmatic labels, required constraints and hint associations.
- Async errors use `role=alert`/`aria-live`.
- Heading hierarchy and link/button semantics are correct on touched pages.
- Corporate support cleanup removed the obsolete success surfaces containing personal/retired mailboxes by retiring those pages.
- Premium strategy, playbooks, reinforced evidence and watchlist remain flagged off/partial; no unsupported capability was activated.

## 43–46. Runner, tests, TypeScript and build

- Fixed test infrastructure by adding lockfile-backed `tsx@4.20.3` as a dev dependency.
- Authenticated product completion: 30/30 pass.
- Commercial continuity: 17/17 pass.
- Product catalog: 27/27 pass.
- Geography: 5/5 pass.
- Payment gate: 5/5 pass.
- Admin login routing: 58/58 pass.
- Report delivery gate: 15/15 pass.
- Premium report contract: 23/23 pass.
- TypeScript: pass.
- Production build: pass; 141/141 routes generated.

## 47–49. External calls, billing and Discovery

- Provider calls: 0.
- Supabase operations: schema-only read verification; no customer record writes.
- Billing activated: no.
- Discovery run: no.
- Pilot changes: none.

## 50–52. Files, commit and rollback

The sprint changes authentication lifecycle emission, onboarding API/UI, success-route retirement, first-value analytics, migrations 049–051, deterministic tests and test dependency lock.

Rollback order:

1. Revert the application commit; additive columns/tables may remain safely unused.
2. Do not automatically drop 049–051 because dropping would destroy captured intent/context/event data.
3. If a schema rollback is later approved, export rows first, remove triggers/policies, then remove only additive columns/tables after confirming no application dependency.

Migration 049 is already applied; code rollback does not require dropping it.

## 53–58. Gates and readiness scores

Authenticated visual freeze: **PROVISIONAL**. Real-session browser QA is mandatory for YES.

Score before → after:

| Area | Before | After |
|---|---:|---:|
| Auth completeness | 7 | 8 |
| Plan persistence | 8 | 9 |
| Commercial Intent | 6 | 8 |
| Password recovery | 7 | 8 |
| Onboarding persistence | 3 | 8 code-ready |
| Geography integrity | 7 | 9 code-ready |
| Dashboard continuity | 8 | 8 |
| Monitor continuity | 7 | 7 |
| Brief continuity | 8 | 8 |
| Ownership | 7 | 9 |
| RLS | 6 | 8 |
| Analytics lifecycle | 4 | 7 |
| Mobile authenticated UX | 4 | 5 unverified |
| Accessibility | 6 | 7 |
| Customer lifecycle coherence | 6 | 8 |
| Billing readiness | 4 | 6 |

Remaining P0:

1. apply migrations 050 and 051;
2. deploy the application commit;
3. provision/approve one isolated ordinary production QA customer;
4. complete real auth, reset, onboarding, dashboard, monitor and Brief browser QA including two-user negative ownership tests.

Remaining P1: complete portfolio/Brief analytics emission and real What Changed read model where data supports it.

Remaining P2: complete authenticated localization/HTML lang and visual QA polish after evidence.

Ready for billing sandbox: **NO**. Exact blocker: 050/051 are not applied and no deployed real authenticated journey has been completed.

## 59–62. Next sprint, founder actions, deploy and stop

Exact next sprint after this commit:

1. founder applies 050, then 051 in Supabase SQL Editor;
2. verify both schemas with zero-row queries;
3. push/deploy the application commit;
4. founder creates or approves one disposable `qa+...` ordinary customer account;
5. run the complete production authenticated journey at six widths;
6. delete the QA user and cascade its synthetic rows;
7. decide the billing sandbox gate again.

Safe deploy order: **049 already applied → apply 050 → apply 051 → deploy code → create QA account → smoke/ownership/reset QA**.

Stopped without billing, checkout, provider calls, Discovery, production customer mutations, Pilot 2 or Amor de Gea changes.
