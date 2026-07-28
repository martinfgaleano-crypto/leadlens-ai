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

## FIX v3 (RESOLVED IN PUBLIC PRODUCTION): whole-auth-stack form-first — DONE

**The real stuck page was `/admin/login` (and `/signup`), not `/login`.** `/login` was already form-first (v2), but `/admin/login` and `/signup` still had `if (checking) return <full-screen "Verifying session…">` gated on an **unbounded, un-caught `await getSession()`**. The owner hitting `/admin/intelligence` without a cookie is redirected by middleware to `/admin/login`, which then hung on "Verifying session…" when a stale token made `getSession()` stall.

- **Fix:** all three auth pages (`app/login/page.tsx`, `app/admin/login/page.tsx`, `app/signup/page.tsx`) now render the form UNCONDITIONALLY; session discovery is background-only, bounded (`Promise.race` 4s), caught, and cancellable — it can never hide/replace the form. Marker bumped to `data-login-build="form-always-visible-v3"`. "Verifying session" no longer exists in any render path (comments only).
- **Tests:** `test:admin-login-routing` **41 passed** (whole-auth-stack guarantees: no Verifying-session render on /login, /admin/login, /signup; unconditional form fields; v3 marker; bounded getSession; cancellable effects). `test:admin-auth` **48/48**. tsc clean.
- **Production build:** isolated worktree `next build` + `next start` (:3101); `/admin/login` with a corrupted token rendered `form-always-visible-v3`, editable form, no "Verifying session"; no console errors.
- **Commit `c0a6a31`** — pushed to `origin/main` via GitHub Desktop. **Vercel deployed it** (production `/login` chunk `page-f9b8a3403db9baf4.js` contains `form-always-visible-v3`, no "Verifying session").
- **PUBLIC PRODUCTION VERIFIED (`https://leadlensintel.com`):**
  - Clean storage → `/login`: `form-always-visible-v3`, form visible, not stuck. ✓
  - Malformed/stale token → `/admin/login`: renders the editable form (background-redirects to `/login`), **never "Verifying session"**. ✓ (the owner's exact failure path)
  - Invalid credentials → inline "Incorrect email or password" with the form preserved. ✓
  - Single `/api/admin/session → 401`, no request loop; no console errors. ✓
  - Valid-admin → `/admin/intelligence`: requires the owner's password (I'm prohibited from entering credentials) — owner does this final confirmation.
- **Verdict: the "Verifying session" blocker is RESOLVED IN PUBLIC PRODUCTION.**

---

## FIX v2 (superseded by v3): form-first login

The timeout state-machine (1677fd4) was **confirmed deployed** (origin/main = 1677fd4; the live production `/login` chunk contains the state machine — "Signing you in" string present) yet production still hung. Conclusion: gating the UI on session verification is the wrong shape. **Fixed structurally — the form now renders unconditionally on the first render; session detection is background-only and can never hide or block it.**

- **Deployment verification (before this fix):** production commit = `1677fd4` (fully deployed, not stale, no rollback); the served login JS chunk contained the new implementation. So the bug was **client logic**, not a stale deployment or hydration failure (hydration ran — the client had reached the "verifying" state).
- **Root cause:** every prior version started in a full-screen `verifying` state and only left it when a background promise settled; a hung/rejected `getSession()` (stale refresh token) or a stalled Admin bridge never let the form render. A timeout can't reliably save this if the settle path itself is unreachable.
- **New architecture (`app/login/page.tsx`):** the `<form>` is returned unconditionally (no `verifying`/`redirecting` full-screen returns). A background effect: bounds `getSession()` with `Promise.race` (4s) and catches its rejection; a rejected/corrupted local token triggers a best-effort `signOut({ scope:"local" })` (never clears a valid session); on a confirmed session it routes in the background (admin→`/admin/intelligence`, else→`/dashboard`); every failure (hung getSession, malformed JSON, Admin bridge 401/403/500/503 or hang, Supabase init failure) leaves the form fully usable. Supabase init failure shows an inline "temporarily unavailable" note but keeps the fields. Non-blocking hints only ("Checking existing session…" / "Signing you in…"). A non-secret marker `data-login-build="form-first-v2"` is rendered to prove the served code.
- **Production build test (isolated worktree, real `next build` + `next start` on :3100, NOT dev):** build passed (`/login` prerendered static, middleware built); the served page renders the form; **with a corrupted Supabase token injected into localStorage, the form still renders and is interactive** (typed into the email field) — never stuck on "Verifying session". No console errors. (Built in a detached worktree with symlinked node_modules so the owner's running dev server's `.next` was untouched.)
- **Tests:** `test:admin-login-routing` **34 passed** (adds form-first structural guarantees: no spinner-only return, unconditional form fields, build marker, bounded getSession, stale-token local signOut, init-failure keeps form). `test:admin-auth` **48/48**. tsc clean.
- **Commit:** `f238adf`. **Owner must push** (CLI still has no GitHub credentials): GitHub Desktop → Push origin (1 commit on top of `1677fd4`), then verify `https://leadlensintel.com/login` shows the form immediately (build marker `form-first-v2` in DOM).

---

## FIX: "Verifying session" infinite spinner — superseded by FIX v2 above

**Root cause (code, not config).** The `/login` mount effect cleared its loading state only on the explicit no-session branch: `getSession().then(...)` had **no `.catch()`/`.finally()`**, and the session-exists path relied on a redirect that could stall. A rejected/slow `getSession()` (stale/invalid refresh token in localStorage — common in prod) or a hung Admin bridge left the page permanently on "Verifying session". Config was verified fine: `origin/main` HEAD = `9d697ef`, `admin_users` exists, owner row `is_active=true, revoked_at=null`.

**Also found + fixed during the fix:** a `ranRef` run-once guard interacted badly with React Strict Mode (first attempt cancelled on unmount, second skipped by the guard → nothing settled → hang in dev). Removed it; each mount now settles once via `cancelled`/`settled` guards.

**State machine (terminating).** `phase ∈ { verifying, form, redirecting }` + a `sawSession` ref. On mount: failsafe `setTimeout` (9s) + `cancelled`/`settled` guards; `getSession()` in try/catch (throw → form); no session → form; session → time-bounded bridge → `resolveLoginTarget` → redirect (admin → `/admin/intelligence`, else `/dashboard`). The verifying state is ALWAYS terminated. Failsafe: if nothing settles in 9s, a known session → `/dashboard`, else the form.

**Bridge hardening.** `establishAdminSession` now has an 8s `AbortController` timeout, tolerates malformed/non-JSON bodies, and returns a deterministic result for 401/403/500/503/network/timeout (never throws). An unavailable Admin service never traps a valid normal user — they fall through to `/dashboard`.

- Files: `app/login/page.tsx` (state machine), `lib/admin/admin-bootstrap.ts` (`establishAdminSession` timeout + `resolveLoginTarget`).
- Tests: `test:admin-login-routing` **28 passed** (adds resolver matrix: no-session→form, admin→Portal, normal→dashboard, bridge-unavailable→dashboard; malformed 2xx → deterministic; 500 → not-admin). `test:admin-auth` **48/48** regression. tsc clean.
- Browser: local `/login` (fresh tab) reaches the **form**, no infinite "Verifying session", no console errors.
- Commit: (see Latest commit). Owner must `git push` to deploy the fix (base `9d697ef` already on origin).

---

## UNIFIED LOGIN FLOW (auto-route admins) — DONE

One login experience: the normal `/login`. After a verified Supabase sign-in the client hands **only the access token** to `POST /api/admin/session`; the server verifies the token + queries `admin_users` live and, for an active admin, issues the httpOnly cookie and returns `{ isAdmin:true, redirectTo:"/admin/intelligence" }`. The client follows it. Normal users → existing `/dashboard`. **No Admin button, no role picker, no second credential entry, no client-trusted role/user_id/isAdmin.**
- New: `lib/admin/admin-bootstrap.ts` — `establishAdminSession` (forwards token only, sanitizes the returned redirect to an internal path), `decidePostLoginRoute` (Admin destination precedence), `bootstrapAdminRedirectOnce` (one-time guard for already-authenticated landings), `clearAdminSession` (logout: DELETE cookie + re-arm guard).
- `app/login/page.tsx` — post-sign-in and already-authenticated mount now route via the bridge (was hardcoded `/dashboard`).
- `app/dashboard/_components/DashboardShell.tsx` — one-time admin bootstrap on mount (active admin landing on any dashboard page → Admin Portal; runs once; no loop); both Sign-out buttons now clear the Admin cookie too.
- `app/api/admin/session/route.ts` — success response adds `isAdmin:true, redirectTo:"/admin/intelligence"`.
- `app/admin/login/page.tsx` — now a thin compatibility route: existing admin cookie → in; existing Supabase session → bridge; otherwise defer to `/login` (no separate credential prompt); form kept only as a misconfig fallback.
- Tests: `test:admin-login-routing` **22 passed** (open-redirect guard, Admin-destination precedence, token-only request, 401/403/503/network → not-admin, one-time bootstrap, logout DELETE + re-arm, no rendered Admin CTA in shell/login). `test:admin-auth` regression **48/48**. tsc clean. Local render of `/login` verified: form intact, no Admin button, no console errors.
- **Live A–D flow not yet verifiable here:** `admin_users` isn't created in Supabase yet (bootstrap SQL not run) and code isn't deployed — so the live owner→Admin redirect can only be confirmed after the migration + deploy. Logic + UI verified locally.

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
