# LeadLens — Activation & Operability V1 (current truth)

Status: **code-complete and green on `main`**; the only remaining blockers are external
(Lemon production config, Vercel deployment-protection on the webhook, one real test purchase).
This document is **current truth**, not chronology.

Product/pricing/credits are **frozen** (do not change): one-time Preview $7 / Brief $25 /
Portfolio $59 / Premium $129 → 2 / 6 / 12 / 18 companies; subscriptions Watch 3-cap/3-credit,
Monitor 20/30, Intelligence 60/100.

---

## 1. Customer journey (one-time)

```
Landing (/)  →  /pricing OR hero CTA  →  /get-started?commercial_path=one_time
  →  /signup (OTP-first, passwordless)  →  email 6-digit code
  →  /verify (code entered IN-APP → supabase.auth.verifyOtp → session)
  →  /checkout/continue (product continuity; server maps variant)
  →  Lemon Squeezy checkout (hosted)  →  payment success
  →  Lemon webhook → POST /api/lemon-webhook (HMAC-verified, idempotent grant)
  →  /success (confirms fulfillment via /api/billing/state)
  →  /activate (describe → interpret → confirm → run → /results)
  →  consumption charged only per materialized valid Intelligence account
```

**Source of truth per step**
| Step | Route / owner | State / authority |
|---|---|---|
| Product selection | `/pricing`, `lib/commercial/plan-catalog.ts` | frozen `lib/products/catalog` (price + `opportunity_target`) |
| Checkout | `POST /api/billing/checkout-one-time` | server maps `product_code → variant`; trusted `user_id` in `custom_data` |
| Verify | `app/verify/page.tsx` | Supabase `verifyOtp({email, token, type:"email"})` |
| Fulfillment | `POST /api/lemon-webhook` → `fulfillCanonicalOrder` (`lib/billing/one-time-fulfillment.ts`) | `planOneTimeFulfillment` variant→product→credits; `orders.external_order_id` UNIQUE |
| Entitlement | `lib/entitlements/entitlements-v1.ts` (`resolveEntitlements`) | server-authoritative |
| Consumption | `lib/billing/account-metering.ts` (`claimAccountIntelligenceCredit`) | one credit per **materialized valid** account (failures excluded) |

## 2. One-time grant authority (server-side, idempotent)

- The **variant→product map is the sole authority** for what is granted. A client-declared
  `product_code` is only a defense-in-depth cross-check and **can never widen** the grant.
- Grant is attributed to the **trusted tenant** (`meta.custom_data.user_id`), never to the
  payload email. A canonical-looking order with no trusted `user_id` → `rejected` (no email grant).
- **Idempotent**: `orders.external_order_id` is UNIQUE; a second delivery of the same order →
  `duplicate`, no re-grant. Proven by `one-time-fulfillment.test.ts` (32/32).

Matrix (proven in code):

| Product | Price | Variant→grant | Companies (`opportunity_target`) |
|---|---|---|---|
| Preview | $7 | preview_launch_v0 | 2 |
| Brief | $25 | brief_launch_v0 | 6 |
| Portfolio | $59 | intelligence_launch_v0 | 12 |
| Premium | $129 | premium_launch_v0 | 18 |

## 3. Webhook (`app/api/lemon-webhook/route.ts`)

- **Signature**: HMAC-SHA256 over the raw body, compared with `crypto.timingSafeEqual`.
  Missing `X-Signature` → **400**; bad signature → **401**; secret unset in prod → reject.
- **Order events** (`order_*`): canonical one-time path when `custom_data.user_id` present →
  `fulfillCanonicalOrder`. `rejected` → **200** (stop useless retries) + structured log;
  `persist_failed` → **500** (ask Lemon to retry); `granted` → `createNotification`.
- **Subscription events**: `handleSubscriptionEvent` (owner resolved from trusted provenance,
  not payload email). Client-side rejections → **200**; transient persist failure → **500**.
- **Non-order/unknown events** → **200** ignored + logged.
- **Structured logs**: `received event=…`, `Invalid signature — rejecting`, `canonical one-time
  rejected: <reason>`, `subscription <event> → <action>`. No secrets/tokens logged.

## 4. OTP / email verification (code-first)

- **Primary flow = 6-digit numeric code, entered in-app** (`app/verify/page.tsx`), not a magic
  link. `inputMode="numeric"`, `autoComplete="one-time-code"`, paste-to-fill.
- `verifyOtp` establishes the session, then `persistCommercialIntent` resumes checkout with the
  exact selection. Resend has a cooldown; invalid/expired codes surface a friendly message.
- Email template: `docs/supabase-otp-email-template.html` (Confirm-signup `{{ .Token }}`), sent
  via the configured SMTP sender. A magic link is a mentioned fallback only, never the primary UX.

## 5. Failed-generation safety (launch gate — PASS)

Consumption is **charge-at-materialization**: `account-metering` charges one credit per account
that **durably materialized valid Intelligence** (`analysis_key = runId`); **failures are
excluded** and the charge is idempotent + allowance-bounded. A technical failure therefore does
**not** consume paid scope. Stalled runs are auto-recovered (`lib/intelligence/run-recovery.ts`,
gen-CAS reclaim). Net: a customer never loses paid companies to a system failure.

## 6. Entitlements / credits / caps

Server-authoritative in `lib/entitlements/entitlements-v1.ts` + `plan-config.ts`; enforced at the
run path via `consumeRunSlotAtomic` (CAS) and, for recurring, `account-metering.monitorUsageGate`
+ `claimAccountIntelligenceCredit`. One-time uses **grants** (credits added once per order); the
subscription **credit/cap** model is kept distinct. Green: `entitlements-v1` (30),
`billing-plan-mapping` (29), `subscription-lifecycle` (25), `subscription-webhook` (14),
`monitor-recurring-usage` (12), `monitor-activation` (24).

## 7. Recovery playbook (launch incidents)

| Symptom | Diagnose | System behavior | Manual step (only if needed) |
|---|---|---|---|
| **A. Paid, no grant** | `orders` row for `external_order_id`? notification present? | Lemon retries a non-2xx; a delayed webhook self-heals on redelivery | If the order never arrived, confirm Vercel deployment-protection isn't 401-ing the webhook; re-send the event from Lemon |
| **B. Duplicate webhook** | two deliveries, same `external_order_id` | UNIQUE(external_order_id) → second = `duplicate`, no re-grant | none |
| **C. OTP not received** | check SMTP send log; user can **Resend** after cooldown | resend issues a fresh code | verify SMTP sender/domain reputation |
| **D. Wrong entitlement** | `resolveEntitlements(userId)` vs product | grant is variant-authoritative; client cannot widen | admin credit correction only |
| **E. Generation failure** | run status; materialized accounts | credit **not** consumed on failure; run-recovery reclaims stalls | none (retry is safe) |
| **F. Stale subscription status** | `subscriptions` row vs Lemon | webhook normalizes on next event | re-send subscription event from Lemon |

## 8. Operator visibility

- Did they pay / which product / grant applied? → `orders` (by `external_order_id`) + the
  `grant` credit transaction + the `preview/brief/portfolio/premium` notification.
- Entitlement now? → `resolveEntitlements(userId)`.
- Activation / generation? → run + results state.
- Admin lookup: `GET /api/admin/customer-lookup` (admin-only).

## 9. Security posture (PASS)

HMAC signature (constant-time) + server-side variant authority (no client price/product
escalation) + trusted-tenant attribution + tenant isolation (owner/client scoped) + rate-limited
OTP resend + no secret logging. Legacy `app/api/checkout` (Stripe) and `app/api/demo` are
**dormant/gated** — do not reactivate.

## 10. Founder action still required (external only)

1. In **Lemon (production/live mode)**: create/approve the store, then set
   `LEMONSQUEEZY_VARIANT_*` (Preview/Brief/Portfolio/Premium) and `LEMONSQUEEZY_WEBHOOK_SECRET`
   in Vercel **Production** env.
2. Point the **Lemon production webhook** at `https://leadlensintel.com/api/lemon-webhook`.
3. In **Vercel**: ensure Deployment Protection does not 401 the `/api/lemon-webhook` route
   (allow the external POST).
4. **One real $7 Preview purchase** end-to-end (enter the OTP from your real inbox; expect grant
   **+2**), then confirm the webhook delivered (Lemon dashboard) and `/success` shows fulfilled.

Everything up to those external steps is code-proven and green.

## 11. Live-external test checklist (for the founder)

- [ ] Preview $7 → OTP entered in-app → `/success` fulfilled → `/activate` reachable → grant +2.
- [ ] Portfolio $59 → grant +12.
- [ ] (If subscriptions launch-visible) one plan → credits + monitor cap correct at renewal.
- [ ] Re-send the same order webhook → **no** second grant (idempotency).
