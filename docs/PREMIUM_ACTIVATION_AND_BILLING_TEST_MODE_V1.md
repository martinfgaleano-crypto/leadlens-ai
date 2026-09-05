# LeadLens — Premium Activation + Billing Test-Mode V1 (internal)

Operating reference for the commercial activation funnel and Lemon **Test Mode** acceptance. Contains
**no secrets**. Branch: `billing-lemon-test-preview` (PR #1 → `main`, keep **unmerged**). Production/`main`
untouched.

## 1. Activation funnel (customer journey)
```
Landing ("Get Started")
 → /get-started        choose: one-time intelligence | ongoing intelligence   (no account wall)
 → /pricing            public; ongoing (WATCH/MONITOR/INTELLIGENCE, mo/yr toggle) primary,
                       one-time (Preview/Brief/Intelligence—One-time/Premium) secondary
 → /signup             work email → passwordless (OTP-first; magic link today)
 → /verify             link-primary copy; 6-digit code is a secondary/future path
 → email link → /auth/continue   client-side session establishment (see §3)
 → /checkout/continue  auth-gated recap + optional skippable company context → canonical checkout
 → Lemon (test) checkout
 → /success            confirms real fulfillment via /api/billing/state before claiming "ready"
 → first product action (/activate for one-time; monitored-accounts setup for subscription)
```
Public/indexable: `/`, `/get-started`, `/pricing`. Noindex: `/signup`, `/verify`, `/auth/continue`,
`/checkout/continue`, `/success` (per-route `layout.tsx`).

## 2. Commercial intent model
`lib/commercial/customer-flow.ts` — a selection union carried in the URL query across every stage:
- one-time: `kind=one_time&product_code=<catalog code>`
- subscription: `kind=subscription&plan_code=<watch|monitor|intelligence>&billing_interval=<month|year>`
`return_to` is allow-listed (`safeCustomerReturnPath`) — no open redirects. Server is authoritative:
the browser sends only product/plan(+interval); the server maps to the Lemon variant. One-time intent is
also recorded server-side (`/api/commercial-intents`) as a best-effort backup.

## 3. Auth modes (real Supabase behavior)
- Browser client uses the **implicit flow** (default). The email link returns the session in the URL
  **fragment** (`#access_token=…`), which only a **client** page can read — so `emailRedirectTo` lands on
  `/auth/continue` (NOT the server `/auth/callback`).
- `/auth/continue`: `getSession()` (already-authed / detected fragment) → `exchangeCodeForSession` fallback
  for a PKCE `?code` → brief poll for async detection → detects `#error=` for fast recovery. On success:
  ensure profile + persist intent + resume `/checkout/continue` with the exact selection; on failure: a real
  recovery UI. **Never logs tokens or fragments.**
- Existing users: password `/login` retained; resumes the same selection into `/checkout/continue`.
- **Future (public launch):** numeric 6-digit OTP via `{{ .Token }}` once **custom SMTP** is configured
  (see §7). The 6-digit UI already exists as a secondary path.

## 4. Billing (canonical)
- Checkout: `POST /api/billing/checkout-one-time` (product_code) · `POST /api/billing/subscribe`
  (plan_code+interval). Auth required; trusted server `user_id` bound into Lemon `custom_data`.
- Webhook: `POST /api/lemon-webhook` — HMAC verified; canonical one-time fulfillment grants the
  **current-product** capacity to the trusted tenant (Preview **+2**, Brief **+6**, Intelligence—One-time
  **+12**, Premium **+18**); idempotent via `UNIQUE(orders.external_order_id)`; never touches legacy
  lead_searches / Stripe / PLAN_CREDITS. Subscription events normalize into `customer_subscriptions`.
- Entitlements (frozen, single-bucket): caps **3/20/60**, monthly credits **3/30/100**; annual bills yearly
  but usage resets monthly (not pooled).
- No anonymous checkout · no raw client variant · no Stripe · no DEMO_MODE · no LS_URLS direct-pay.

## 5. Webhook observability (secret-safe, already emitted)
Server logs answer: event received (`event=<name> ls_order_id=<id>`), signature valid/invalid (400/401),
canonical one-time outcome (`status=granted|duplicate|rejected user=<uuid> product=<code> credits=<n>`),
subscription outcome (`subscription <event> → <action>`), duplicate (`status=duplicate`). Never logs the
signing secret, Vercel bypass secret, API keys, access tokens, or full payloads. Grep `[lemon-webhook]`.

## 6. Test-mode acceptance protocol (run after founder does ONE real purchase)
Preview has Deployment Protection; the Lemon **test** webhook URL carries the Vercel automation-bypass
query param (secret not stored in repo). To accept:
1. Sign in on the Preview as a disposable test user; note credit balance (app or `GET /api/billing/state`).
2. Buy **Preview $7** via `/checkout/continue` → Lemon test card `4242 4242 4242 4242`.
3. Expect: signed webhook accepted → canonical fulfillment → **balance +2** for that tenant only.
Expected one-time grants: Preview **+2** · Brief **+6** · Intelligence—One-time **+12** · Premium **+18**.
Subscriptions: WATCH/MONITOR/INTELLIGENCE monthly & annual → `customer_subscriptions` normalized
(active, correct interval); usage bucket monthly (3/30/100); caps 3/20/60; annual not pooled. Idempotency:
a replayed webhook grants nothing extra. Deterministic proof of the fulfillment logic:
`scripts/fixtures/one-time-fulfillment.test.ts` (18/18) — NOT a substitute for a real provider event.

## 7. Email delivery — pre-public-launch spec (do NOT configure now)
Founder configures before public launch:
- **Custom SMTP** in Supabase (Auth → SMTP): a real sending domain with **SPF + DKIM + DMARC**.
- **Branded template**: From `LeadLens <no-reply@your-domain>`, subject e.g. "Your LeadLens verification
  code"; premium minimal body.
- Add **`{{ .Token }}`** to the confirmation/magic-link template → enables the numeric 6-digit OTP as the
  primary launch experience (the code UI already exists).
- Ensure the Preview/Prod origins are in Supabase Auth → URL Configuration → **Redirect URLs**.
- Mind Supabase auth email **rate limits** (default sender is throttled to a few/hour — test with a real
  inbox and check spam).

## 8. Billing truth states
`LEMON MERCHANT: APPROVED` · `CURRENT BILLING: TEST-CONFIGURED — PROVIDER ACCEPTANCE REMAINING`.
Do not claim `TEST-ACCEPTED` until one real Lemon test event completes end-to-end (a real +2 observed);
never `PRODUCTION-WIRED` / `LIVE ACCEPTANCE-PROVEN` on this branch.

## 9. Launch blockers & tech-debt register
**P0 (before public launch):**
- Custom SMTP + branded auth email + numeric OTP (`{{ .Token }}`).
- Real Lemon **test-mode** acceptance (one +2), then production Live-Mode wiring + live acceptance.
- Legal operator/data-controller identity (HQ) + subscription legal copy on purchase surfaces.
- Restore the production recovery-cron cadence when merging: the preview branch set
  `/api/internal/intelligence-runs/recover` to daily for Vercel **Hobby**; production (Pro) should keep
  `*/15` — do not carry the daily value to `main`.
**P1 (soon after launch):** Customer billing portal (Lemon-hosted Manage-Billing) for self-serve
cancel/manage; webhook-delay UX polish; funnel analytics dashboard.
**P2 (later):** post-OTP auth cleanup; dead legacy demo/outreach copy cleanup; regional pricing.

## 10. Safety invariants (this branch)
No push to `main`, no PR merge, no Production deploy, no live charges, no secret config, no SMTP setup,
no pricing/metering/entitlement change. Preview uses **Test** Lemon variants only.
