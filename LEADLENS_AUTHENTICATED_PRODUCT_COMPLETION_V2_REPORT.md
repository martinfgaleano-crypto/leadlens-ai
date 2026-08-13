# LeadLens — Authenticated Product Completion + Commercial Readiness V2

Date: 2026-08-13

Initial HEAD: `b8489e6e492bfae1db3ad01863f6a612b560f074`

Branch: `main`

Production: `https://leadlensintel.com` (not deployed by this sprint)

## Executive result

This sprint closes the highest-risk authenticated-product continuity gaps without activating billing, running Discovery, calling providers, or changing either Amor de Gea pilot. A selected canonical product can now survive signup/login, become a minimal authenticated Commercial Intent, and remain owner-scoped. Password recovery now has a complete Supabase PKCE exchange and update flow. The dashboard has a deterministic customer read model and a single evidence-based next action. Target countries are normalized as the authoritative geography input and region is derived.

The implementation is deployable after migration `049_commercial_intents.sql` is applied. Commercial Intent is deliberately not an order, payment, entitlement, or checkout record.

## Baseline and preservation

- Preserved commits: `6444322`, `b6db03f`, `b8489e6`.
- Landing redesign/product-proof structure was not visually redesigned.
- Real Account Brief contract and `/dev-brief-preview` behavior were not changed.
- Existing internal credit/usage ledgers were not deleted or redefined.
- Pre-existing runtime files `.leadlens/source-intelligence.json` and `.leadlens/usage.json` were not included in sprint changes.
- Pre-existing untracked audit documents were not modified.
- Provider calls: **0**.
- Discovery benchmarks: **0**.
- Billing activation: **none**.
- Pilot changes: **none**.

## Implemented

### Authentication and plan continuity

- Canonical plan parsing uses the server product catalog; unknown values fail closed.
- Legacy plan names resolve only through the existing compatibility mapping.
- Login/signup links preserve `product_code`, `source_cta`, `locale`, and an allowlisted `return_to`.
- External, protocol-relative, backslash, and unapproved redirect destinations fall back to `/dashboard`.
- Signup confirmation links preserve validated commercial flow context.
- Auth failures retain professional, customer-safe language.

### Password recovery

- `/forgot-password` sends a generic, non-enumerating recovery response.
- `/auth/callback?type=recovery` forwards the PKCE code to the browser client instead of discarding a server-only session.
- `/reset-password` exchanges the code, removes it from browser history, validates the active session, enforces minimum length and matching confirmation, updates the password, then signs out.
- Invalid/expired links stop safely and request a new recovery link.

### Commercial Intent foundation

- New authenticated API: `/api/commercial-intents`.
- Bearer JWT is verified with Supabase before read/write.
- Product is resolved again on the server; browser amounts and entitlements are never accepted.
- Owner UUID is mandatory and derived from the verified JWT.
- Per-user rate limiting is applied.
- Migration 049 adds append-friendly lifecycle states, owner indexes, and RLS policies.
- Explicitly absent: amount paid, payment status, activated entitlement, billing success claims.

### Geography and commercial context

Normalized fields:

1. company description;
2. offer;
3. buyer;
4. problem solved;
5. `target_countries`;
6. commercial goal.

`target_countries` is authoritative, deduplicated and normalized. `target_market_region` is not treated as a second source of truth; region is derived from countries and can be `multi_region`.

### Dashboard read model

The normalized model returns only one of:

- setup required;
- researching;
- Account Brief ready;
- monitoring.

It derives one next action from real onboarding/monitor/report state. It never relabels the newest row as a “latest opportunity” and never invents a completed brief.

### Lifecycle analytics foundation

Added canonical event names for commercial intent, account creation, verification, login, recovery, reset, first dashboard view, and first usable opportunity delivered. `first_usable_opportunity_delivered` is server-only so a public browser cannot fabricate the activation milestone.

## Security and ownership audit

- Commercial Intent GET/POST requires a verified Supabase user.
- Rows are scoped to `user_id`; RLS owner policies exist for select/insert/update.
- Product codes fail closed against the canonical versioned catalog.
- Return paths are same-origin allowlisted.
- Recovery messages do not reveal whether an email exists.
- Recovery code is removed from the visible URL after exchange.
- No secret or `.env.local` change was made.
- No public checkout or billing route was activated.

## Localization and terminology

- Commercial flow supports explicit locale states `en`, `es`, `pt`, `ja` and preserves the chosen locale through auth.
- Backend field names remain unchanged.
- Existing authenticated first mention remains `ICP (Ideal Customer Profile)` in English.
- Full authenticated copy translation remains a separate controlled localization sprint; this work does not claim completed ES/PT/JA UI translation.

## QA and verification

- `npm run build`: **PASS**.
- Next.js compile: **PASS**.
- TypeScript validation inside production build: **PASS**.
- Static generation: **139/139 pages PASS**.
- New routes generated: forgot password, reset password, commercial intents.
- `git diff --check`: **PASS**.
- Focused deterministic test fixture added with 17 assertions for product continuity, redirects, geography, dashboard view, recovery, ownership and RLS.
- Local fixture runner: **BLOCKED BY TEST INFRASTRUCTURE** — the repo has no local `tsx` binary and `npx` waited indefinitely for package retrieval. No false PASS is reported.
- Browser QA: local server started, but the in-app browser could not navigate to the sandboxed localhost target. No false responsive/authenticated browser PASS is reported.
- Authenticated seeded-account QA: not run. The configured database may be production-backed and no safe disposable non-production account contract exists; no bypass or production test user was created.

## Build defect found and fixed

The first build found one genuine TypeScript target incompatibility in the new region derivation (`Set` spread under the project target). It was replaced with `Array.from`; the subsequent full production build passed.

## Files changed by this sprint

- `app/api/commercial-intents/route.ts`
- `app/api/events/route.ts`
- `app/auth/callback/route.ts`
- `app/dashboard/page.tsx`
- `app/forgot-password/page.tsx`
- `app/login/page.tsx`
- `app/reset-password/page.tsx`
- `app/signup/page.tsx`
- `lib/commercial/commercial-context.ts`
- `lib/commercial/customer-flow.ts`
- `lib/dashboard/customer-dashboard-view.ts`
- `scripts/fixtures/authenticated-product-completion.test.ts`
- `supabase/migrations/049_commercial_intents.sql`
- `package.json`
- this report

## Deployment contract

Before deploying:

1. Apply migration `049_commercial_intents.sql` once in Supabase.
2. Restore/confirm a deterministic local test runner (`tsx` as a dev dependency or an approved cached runner) and execute `npm run test:authenticated-product`.
3. Push the focused code commit.
4. Deploy Production.
5. Validate one real disposable test account through plan → signup/login → dashboard → recovery → reset.
6. Validate responsive views at 1280, 768, 430, 390, 375 and 360 after deployment.

No new environment variable is required. No payment provider, provider benchmark, or Discovery execution is required.

## Remaining blockers and exact next sprint

The principal remaining commercial blocker is not another landing redesign. It is a controlled production-like authenticated QA cycle after migration 049, followed by a real onboarding write path that persists the six-field commercial context and links it to Commercial Intent. Billing remains intentionally closed. The next sprint should:

1. apply 049;
2. establish a disposable non-production QA account contract;
3. run full authenticated and responsive browser QA;
4. connect normalized commercial context to the owned onboarding persistence path;
5. instrument server-emitted first usable opportunity delivery;
6. fix only evidence-backed defects;
7. stop before billing activation.

## Stop confirmation

Stopped before deployment, migration application, billing activation, provider use, Discovery execution, Pilot 2, outreach, or changes to Amor de Gea Pilot 1.
