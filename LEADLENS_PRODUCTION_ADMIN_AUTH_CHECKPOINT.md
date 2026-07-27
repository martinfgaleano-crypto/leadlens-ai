# Production Admin Authentication & Authorization — Checkpoint

## Status: code DONE + hardening DONE. Deployment attempted; blocked by absent credentials for GitHub/Vercel/Supabase-dashboard. Owner actions below.

---

## DEPLOYMENT RUN (attempted directly)

**Environment capability probe (all negative for the credentialed systems):**
- GitHub: no `gh` CLI, no `GITHUB_TOKEN`/`GH_TOKEN`, no `~/.ssh` keys, empty ssh-agent, no `github.com` keychain entry, SSH host-key unverified → **push not possible**.
- Vercel: no `vercel` CLI, no `VERCEL_TOKEN`, no connected Chrome session → **cannot set env vars or redeploy**.
- Supabase dashboard: no `supabase` CLI, no `psql`, no Postgres connection string, no management token, no connected Chrome session → **cannot run DDL (migration)**.
- Real Chrome (claude-in-chrome): **no connected browsers** → no authenticated dashboard sessions to drive.

**What I completed directly (verified):**
- ✅ Phase 1 — repo verified: branch `main`, HEAD `b325b57`, all three admin-auth commits present (`50089be`, `30c4170`, `b325b57`), 10 commits ahead of `origin/main`, clean fast-forward, no secrets/.env in the diff.
- ✅ `ADMIN_SESSION_SECRET` generated (48 random bytes, base64) and stored in gitignored `.env.local` — **value never printed**. Owner copies it into Vercel from that file.
- ✅ Supabase reached via the service-role key (REST/Auth-admin): confirmed **`admin_users` does NOT exist yet** (PGRST205) and identified the owner Auth account **`martinfgaleano@gmail.com` → UUID `e9c5fc31-6d9b-45eb-a110-1d6647c04f50`** (already exists + confirmed; no duplicate created).
- ✅ Staged a single copy-paste bootstrap: `scripts/bootstrap-admin-production.sql` = migration 040 (idempotent) + owner authorization upsert + verify SELECT.
- ✅ Code build-confidence: `tsc --noEmit` clean; `test:admin-auth` 48/48. (Full `next build` not run: a dev server is live on :3000 and building alongside it corrupts the webpack chunk registry — tsc + tests are the signal.)
- ✅ Security checks verifiable from code (Phase 8): prod rejects `leadlens_test_admin_123` (unit-tested); service-role key never imported into client; admin cookie `httpOnly`; external `next` rejected; `/admin` excluded from `sitemap.ts` and disallowed in `robots.ts` + middleware `noindex`; no secrets committed (`.env.local` gitignored).

**Blocked (owner-credentialed — cannot complete from here):** GitHub push (Phase 2), Vercel env + redeploy (Phase 3), Supabase migration DDL (Phase 4), and everything downstream that needs a live deploy/table (Phases 5 REST-insert, 6, 7, 8 live checks).

### Minimal owner actions (three systems, each one paste/click)
1. **GitHub push** — from a machine with GitHub access: `git push origin main` (fast-forward of 10 commits; no force, no history rewrite). Vercel auto-deploys the production branch.
2. **Vercel** — Project → Settings → Environment Variables → add `ADMIN_SESSION_SECRET` (Production; value is in local `.env.local`) → confirm `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL=https://leadlensintel.com` exist → Redeploy latest. Do **not** add `ADMIN_LOCAL_BYPASS`.
3. **Supabase** — SQL Editor → paste and run `scripts/bootstrap-admin-production.sql` (applies migration 040 + authorizes the owner UUID; the final SELECT should return one active row). Then Authentication → URL Configuration → Site URL = `https://leadlensintel.com` (no redirect URLs needed).

After those: verify at `https://leadlensintel.com/admin/login` (Tests A–F in Phase 7). I can run the production A–F verification in a later turn once the deploy + migration are live.

---

## HARDENING PASS (post-review) — DONE

### 1. Immediate Admin revocation (authoritative active-allowlist boundary)
`middleware.ts` is now the centralized server-side boundary for **both** pages (`/admin/*`) and APIs (`/api/admin/*`, except the login/bootstrap routes `session`/`auth-check`). On every protected request it: (1) HMAC-verifies the signed cookie (edge Web Crypto) → `user_id`; (2) queries `admin_users` **live** via Supabase REST with the service-role key (`checkActiveAdminViaRest`, edge `fetch`) for `is_active=true && revoked_at IS NULL`; (3) decides via `activeAdminDecision`. **Revocation is immediate — never waits for the 8h TTL.** On deny/fail-closed the cookie is cleared; **APIs → 403** (503 on lookup failure), **pages → `/admin/login?reason=unauthorized`**. DB/config failure fails closed. Signature-only `requireAdmin` remains in the API routes as defense-in-depth behind this boundary.

### 2. Restricted local-dev bypass
The bypass now requires **all** of: `NODE_ENV !== "production"` **AND** the request's trusted hostname (`req.nextUrl.hostname` / `hostnameFromUrl(req.url)` — never `x-forwarded-host`) is literally `localhost`/`127.0.0.1`/`::1` **AND** `ADMIN_LOCAL_BYPASS=true`. It can never activate on Vercel Preview, `*.vercel.app`, or `leadlensintel.com`/`www` (also: Vercel sets `NODE_ENV=production` on Preview, a second guard). Missing `ADMIN_SESSION_SECRET` fails closed on production, Preview, and any non-local host. `requireAdmin`'s former "no secret ⇒ open" dev path is now gated by the same `localBypassAllowed`.
- New files: `lib/auth/admin-access.ts` (edge-safe pure helpers + REST check). Modified: `middleware.ts`, `lib/auth/require-admin.ts`.
- **Local-dev note:** to use Admin on localhost without a real login, set `ADMIN_LOCAL_BYPASS=true` in `.env.local`.
- Verified: middleware stays Edge-compatible (no node:crypto; only `admin-cookie` constants + `admin-access` fetch/pure); service-role key stays server-only (passed in, never client); customer auth unchanged; prod shared-token rejection intact; no redirect loops (login excluded from matcher).
- Tests: `test:admin-auth` now **48 passed** (adds active-allowlist matrix: active→allow, is_active=false→deny, revoked_at→deny, deleted row→deny, bad signature→deny, lookup error→fail_closed; REST mock: active/revoked/empty/http-error/throw; local-bypass matrix: localhost+flag→allow, no-flag→deny, `*.vercel.app`/preview/apex/www→never, production→never, spoofed forwarded-host inert). tsc clean.

---

## 1. Existing auth architecture found
- **Sessions are localStorage-based** (`@supabase/supabase-js`, anon key). No `@supabase/ssr`, no cookies, no middleware. Customer login (`app/login/page.tsx`) uses `getSupabaseClient().auth.signInWithPassword` → localStorage session → `router.replace("/dashboard")`.
- **Admin auth was a SHARED SECRET**: `ADMIN_SECRET_TOKEN` compared to the `x-admin-token` header (`lib/auth/require-admin.ts`), token stored in browser localStorage (`leadlens_admin_token`). Not a user identity. In dev it was open when unset; in prod it 403'd when unset but any holder of the token was "admin".
- Admin data is fetched via `adminFetch` (injects `x-admin-token`); ~30 API routes call `requireAdmin`. Pages were client-rendered with no server page-guard.

## 2. Existing authorization architecture found
- **None role-based.** No `admin_users` / `profiles.role` / allowlist existed (migrations 001–039 checked). `robots.ts` already disallows `/admin`; `sitemap.ts` already excludes it.

## 3. Chosen Admin authorization model
**New `admin_users` allowlist** keyed to `auth.users(id)` + a **server-signed httpOnly admin-session cookie**. Flow:
`/admin/login` (Supabase email/password) → client gets the Supabase access token → `POST /api/admin/session` → server verifies the JWT (`auth.getUser`) **and** the `admin_users` allowlist (service-role, fail-closed) → issues signed cookie `ll_admin_session` (HMAC-SHA256 of `{sub,role,exp}` with `ADMIN_SESSION_SECRET`) → redirect `/admin/intelligence`. Every later request is authorized by verifying that cookie server-side.

## 4. Migrations added
- `supabase/migrations/040_admin_authorization.sql` — `admin_users(user_id PK→auth.users, role, is_active, created_at, updated_at, created_by, revoked_at)`; role check (`admin|super_admin`); **RLS ON with NO policies** (invisible to anon/authenticated; server service-role only); `updated_at` trigger; active-admin partial index; inline bootstrap SQL. Idempotent.

## 5. Login flow before vs after
- **Before:** enter the shared `ADMIN_SECRET_TOKEN` → stored in localStorage → sent as header.
- **After:** email + password → Supabase Auth → server allowlist check → signed httpOnly cookie → `/admin/intelligence`. Non-admins are signed back out with "This account is not authorized for Admin access." No disclosure of admin status pre-authentication.

## 6. Protected pages
`middleware.ts` guards `/admin` + all `/admin/*` **except `/admin/login`**: unauthenticated → `/admin/login?next=<path>` (next validated, admin-only); authorized `/admin` → `/admin/intelligence`; all `/admin/*` responses get `X-Robots-Tag: noindex, nofollow`. Cookie HMAC-verified at the edge with Web Crypto. **Dev bypass** when `NODE_ENV!=="production"` and `ADMIN_SESSION_SECRET` unset (keeps local dev usable; API layer still enforces).

## 7. Protected APIs
All `/api/admin/*` continue through `requireAdmin` (now cookie-based). `requireAdmin` hardened: primary = signed cookie (all envs); dev/test-only fallback = `x-admin-token===ADMIN_SECRET_TOKEN`; **production rejects the shared/test token entirely** and fails closed (503) if `ADMIN_SESSION_SECRET` is unset. New `POST/GET/DELETE /api/admin/session` (login bridge / check / logout).

## 8. Test-token removal / isolation
`leadlens_test_admin_123` (an `ADMIN_SECRET_TOKEN` value) can **never** authorize in production: `sharedSecretAllowed()` returns false when `NODE_ENV==="production"`, so the shared-secret branch is unreachable in prod (unit-tested). It remains usable only in local dev/test. It is not in any client bundle and not logged.

## 9. Environment variables
- Reused: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_APP_URL=https://leadlensintel.com`.
- **NEW required in production: `ADMIN_SESSION_SECRET`** (server-only; long random string; signs/verifies the admin cookie). Without it, all admin access fails closed.
- `ADMIN_SECRET_TOKEN` now dev/test-only.
- **NEW `ADMIN_LOCAL_BYPASS`** (dev-only, optional): `true` enables the local-dev bypass, and only on a literal localhost host. Never set it in Vercel/production.

## 10. Supabase configuration (owner to verify)
- **Authentication → URL Configuration → Site URL:** `https://leadlensintel.com`
- **Redirect URLs:** not required — this flow uses `signInWithPassword` (no email redirect/`auth/callback`). Only add redirect URLs if magic-link/OAuth is later enabled.

## 11. First Admin bootstrap steps (owner)
1. Supabase Dashboard → **Authentication → Users → Add user** → set email + password (confirm the user).
2. Copy that user's **UUID**.
3. SQL editor: `INSERT INTO admin_users (user_id, role, created_by) VALUES ('<UUID>','super_admin','<UUID>') ON CONFLICT (user_id) DO UPDATE SET is_active=true, revoked_at=NULL;`
4. Verify: `SELECT * FROM admin_users WHERE user_id='<UUID>';` (is_active=true, revoked_at null).
5. Sign in at `https://leadlensintel.com/admin/login`.
6. **Revoke later:** `UPDATE admin_users SET is_active=false, revoked_at=now() WHERE user_id='<UUID>';`

## 12. Files modified
- New: `supabase/migrations/040_admin_authorization.sql`, `lib/auth/admin-cookie.ts`, `lib/auth/admin-session.ts`, `lib/auth/admin-authorization.ts`, `app/api/admin/session/route.ts`, `middleware.ts`, `scripts/fixtures/admin-auth.test.ts`, this checkpoint.
- Modified: `lib/auth/require-admin.ts` (cookie + prod token rejection), `app/admin/login/page.tsx` (email/password), `lib/admin/admin-client.ts` (`adminLogout`), `package.json` (`test:admin-auth` + release:check).

## 13. Tests and results
`test:admin-auth` — **25 passed**: sign/verify roundtrip, wrong-secret/tamper/expiry rejection, open-redirect guard (internal ok; `//host`, `https://`, `/dashboard`, backslash, login-loop rejected), shared-secret prod policy, requireAdmin (valid cookie→authorized, normal user→401, **prod shared token→401**, prod no-session-secret→503 fail-closed, dev token→authorized, dev open), authorizeAdmin fail-closed on missing config/no token. Added to `release:check`.

## 14. Typecheck
`tsc --noEmit` clean.

## 15. Release-check
Not run (token discipline — deferred to owner/CI). Individual suites green.

## 16. Browser verification
Local: `/admin/login` renders the new email/password form ("Authorized administrators only", "Authenticated by Supabase. Authorized server-side.") — screenshot captured. **Full auth-flow + production-redirect verification is NOT possible from here** (requires the deployed env, `ADMIN_SESSION_SECRET`, applied migration 040, and a real Supabase admin user — all owner-provisioned). Not claimed as verified.

## 17. Production deployment status
Committed locally; **not pushed/deployed** (environment has no GitHub credentials — owner pushes). Not live until owner completes deploy + env + migration + bootstrap.

## 18. Exact URLs
- Admin login: `https://leadlensintel.com/admin/login`
- Admin Command Center: `https://leadlensintel.com/admin/intelligence`

## 19. Commit hash
`50089be`

## 20. Remaining limitations
- **Immediate revocation:** RESOLVED in the hardening pass — the middleware boundary queries `admin_users` live on every `/admin/*` and `/api/admin/*` request, so a revoked/inactive/deleted admin is denied on the next request regardless of the 8h cookie TTL. (Excluded bootstrap routes `/api/admin/session` and `/api/admin/auth-check` do their own `authorizeAdmin`/signature checks.) Trade-off: one Supabase REST lookup per protected admin request (fine for admin-console traffic).
- **Internal routes** that gate on `x-admin-token && requireAdmin` (e.g. monitor drain) rely on the dev token in dev and `INTERNAL_RUN_SECRET` for automation; the admin-UI button path uses the cookie. No production shared-token path remains.
- Migration 040 must be applied before the flow works in production.
- Customer auth (localStorage) is unchanged — not migrated to cookies (out of scope).

## 21. Updated checkpoint
This file.

## 22. Owner deployment steps (A–D)
- **A. Git/Vercel:** push the branch → Vercel auto-deploys. Set `ADMIN_SESSION_SECRET` (+ existing Supabase vars, `NEXT_PUBLIC_APP_URL`) in Vercel → all environments. Redeploy.
- **B. Supabase:** apply migration 040; create the Auth user; authorize via the bootstrap SQL; verify Site URL.
- **C. URLs:** `/admin/login` → `/admin/intelligence`.
- **D. Incognito verification:** unauthenticated `/admin/intelligence` → redirected to login; normal customer account → "not authorized"; admin account → Command Center.

## Latest commit
`30c4170` — Admin-auth hardening (immediate revocation + localhost-only bypass).
`50089be` — Production Admin auth (base).
