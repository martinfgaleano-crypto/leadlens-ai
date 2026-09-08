# LeadLens — Lemon Squeezy One-Time Acceptance Runbook V1

Purpose: take the **one-time purchase** journey from CODE-PROVEN to REAL-LEMON-PROVEN on Preview,
with the smallest possible human step. Prepared during the activation/billing hardening pass.

Frozen catalog (do NOT change): Preview $7 / 2 · Brief $25 / 6 · Intelligence $59 / 12 · Premium $129 / 18.
Server-authoritative throughout — the browser never sets variant, price, user, or grant.

## 0. What is already proven (no human needed)
- Preview funnel routes serve 200; OTP-first signup active (not magic-link).
- `POST <preview>/api/lemon-webhook` with no signature → **400** (publicly reachable, signature enforced,
  and `LEMONSQUEEZY_WEBHOOK_SECRET` is set on Preview).
- Checkout is server-authoritative: `POST /api/billing/checkout-one-time` derives the user via
  `db.auth.getUser(token)`, validates `product_code` (z.enum of the 4 one-time products), and
  `createOneTimeCheckout` binds `custom_data = { user_id, product_code }` + a server-owned variant.
- Fulfillment is idempotent + authority-bound (unit-tested, `one-time-fulfillment.test.ts` 32/32):
  trusted `custom_data.user_id`, server variant→product map, credits from the frozen catalog,
  at-most-once grant across duplicate/replay/concurrent webhooks (UNIQUE `orders.external_order_id`).
- `/success` confirms real fulfillment against `/api/billing/state` (bounded ~12.5s poll) and shows an
  honest "Payment received — finishing setup" pending state; browser return alone never grants.

## 1. Preconditions the founder must confirm (Vercel Preview env)
These are secrets — set in Vercel (Preview scope), never in the repo. Confirm presence (not values):
- `LEMONSQUEEZY_API_KEY` — **must be a TEST-mode key** for acceptance (see §2).
- `LEMONSQUEEZY_STORE_ID`
- `LEMONSQUEEZY_WEBHOOK_SECRET` (already present on Preview — proven by the 400 above)
- One-time variant IDs: `LEMONSQUEEZY_VARIANT_SAMPLE` (Preview/$7·2), `_STARTER` (Brief/$25·6),
  `_STANDARD` (Intelligence/$59·12), `_PRO` (Premium/$129·18) — the numeric variant IDs from the Lemon
  dashboard. An unset/unmapped variant fails safe (checkout 503; webhook records `unmapped_variant`, no grant).
- `NEXT_PUBLIC_APP_URL` — should be the Preview origin so the Lemon `redirect_url` returns to Preview `/success`.

## 2. Determine TEST vs LIVE mode (do NOT guess; do NOT create a real charge)
- Lemon Squeezy dashboard → toggle **Test mode**; a test-mode store has its own variant IDs and a
  test API key. The `LEMONSQUEEZY_API_KEY` on Preview decides which store the checkout hits.
- **Acceptance must run in Lemon Test mode** so payment uses a test card and no real money moves.
- If Preview's `LEMONSQUEEZY_API_KEY` / variant IDs are LIVE, either (a) swap Preview to test-mode
  values, or (b) accept on a dedicated test deployment. Do not proceed with a live key.

## 3. Point the Lemon webhook at Preview
- Lemon dashboard → Settings → Webhooks → add/point a webhook to:
  `https://leadlens-ai-git-activati-e04adc-martinfgaleano-cryptos-projects.vercel.app/api/lemon-webhook`
- Signing secret = the same value as `LEMONSQUEEZY_WEBHOOK_SECRET` on Preview.
- Subscribe at least to **`order_created`** (one-time). (Subscription events are handled additively but
  are out of scope for one-time acceptance.)
- Keep Vercel Deployment Protection **disabled** on this Preview (already done) so Lemon can reach it.

## 4. The acceptance run (ONE human action)
Prereq: OTP acceptance passed, so there is a real authenticated session in the browser on Preview.
1. From `/checkout/continue` (reached after OTP for the selected Preview $7 product) click
   **"Continue to secure checkout"** → server creates the Lemon checkout and redirects to Lemon.
2. **HUMAN ACTION (the only one):** complete the Lemon **test** checkout using Lemon's supported test card
   (e.g. `4242 4242 4242 4242`, any future expiry, any CVC), then let it redirect back.
3. Tell Claude "paid" / the success page appeared.

## 5. What Claude verifies after payment (autonomous)
- Redirect lands on Preview `/success?kind=one_time&product_code=preview_launch_v0`.
- `/success` transitions **confirming → ready** (or shows honest **pending** then ready after the webhook).
- Server truth via `/api/billing/state` (bearer): `credits_remaining > 0` or `access_source in {one_time,internal}`.
- Webhook evidence (Preview logs / Lemon dashboard deliveries): `order_created` received, signature valid,
  canonical path `granted`, `credits = 2`, correct `user_id`.
- Idempotency: a duplicate/replayed delivery does **not** double-grant (already unit-proven; confirm in logs).
- Workspace continuity: `/activate` (one-time CTA) reachable; refresh keeps session + access.

## 6. Acceptance gate (all must hold)
CHECKOUT created server-side · CUSTOMER associated via custom_data.user_id · RETURN to /success ·
WEBHOOK delivered + signature valid · VARIANT→product authoritative (server) · GRANT = 2 credits (frozen) ·
DUPLICATE webhook → no duplicate grant · WORKSPACE reachable · REFRESH-safe.
→ then: **LEMON ONE-TIME — PREVIEW ACCEPTED (test mode)**. Real production acceptance is a separate,
later step against production env + a production (live) run the founder authorizes explicitly.

## 7. Failure triage (classify precisely, don't guess)
- Checkout 503 `billing_unavailable` → provider/variant not configured on Preview (§1).
- Checkout 502 `checkout_failed` → provider error (Lemon `errors[].detail` in server logs; e.g. test/live
  variant mismatch, wrong-mode key) — no secrets are logged.
- Webhook 400 → missing/blank signature header. 401 → invalid signature (secret mismatch between Lemon and Preview).
- Webhook `rejected: unmapped_variant` → variant IDs on Preview don't match the store's variants.
- Webhook `rejected: missing_tenant` → order lacked trusted `custom_data.user_id` (not created via our checkout).
- `/success` stuck pending → webhook not delivered/reachable, or grant failed (check `/api/billing/state` + logs).
