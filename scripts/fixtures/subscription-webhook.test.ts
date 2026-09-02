// Billing → Entitlement Live V1 — subscription webhook handler matrix.
// Deterministic (fake db). Signature/HMAC + real route + real persistence are proven live in
// accept-subscription-billing.mts. Env (variant IDs) is injected explicitly.

import { handleSubscriptionEvent, isSubscriptionEvent } from "../../lib/billing/subscription-webhook";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

const ENV = {
  LEMONSQUEEZY_VARIANT_WATCH_MONTH: "111",
  LEMONSQUEEZY_VARIANT_MONITOR_MONTH: "221",
  LEMONSQUEEZY_VARIANT_INTELLIGENCE_YEAR: "332",
} as any;

function fakeDb() {
  const subs = new Map<string, any>();
  const periods: any[] = [];
  const api: any = { _subs: subs, _periods: periods };
  api.from = (name: string) => {
    if (name === "customer_subscriptions") {
      const f: Record<string, any> = {};
      const b: any = {
        select: () => b,
        eq: (c: string, v: any) => { f[c] = v; return b; },
        limit: () => b,
        upsert: async (row: any) => { subs.set(row.provider_subscription_id, { ...row }); return { error: null }; },
        then: (res: any) => { const row = subs.get(f["provider_subscription_id"]); return res({ data: row ? [row] : [] }); },
      };
      return b;
    }
    if (name === "subscription_usage_periods") {
      return { upsert: async (row: any) => { periods.push(row); return { error: null }; } };
    }
    return { select: () => ({ eq: () => ({ limit: () => ({ then: (r: any) => r({ data: [] }) }) }) }) };
  };
  return api;
}

const payload = (o: {
  event?: string; sub?: string; variant?: string | number; status?: string; userId?: string | null;
  email?: string; updatedAt?: string; createdAt?: string; renewsAt?: string | null; endsAt?: string | null; cancelled?: boolean;
}) => ({
  meta: { event_name: o.event ?? "subscription_created", custom_data: o.userId === null ? {} : { user_id: o.userId ?? "user-A" } },
  data: {
    id: o.sub ?? "sub-1", type: "subscriptions",
    attributes: {
      variant_id: o.variant ?? 221, status: o.status ?? "active", customer_id: 900,
      user_email: o.email ?? "a@example.com",
      created_at: o.createdAt ?? "2026-09-01T00:00:00.000Z",
      updated_at: o.updatedAt ?? "2026-09-01T00:00:00.000Z",
      renews_at: o.renewsAt === undefined ? "2026-10-01T00:00:00.000Z" : o.renewsAt,
      ends_at: o.endsAt ?? null, cancelled: o.cancelled ?? false,
    },
  },
});

async function run() {
  t("isSubscriptionEvent discriminates", isSubscriptionEvent("subscription_created") && !isSubscriptionEvent("order_created"));

  // WEBHOOK 1 — valid subscription_created → applied with canonical plan.
  let db = fakeDb();
  let r: any = await handleSubscriptionEvent(db, payload({}), ENV);
  t("W1 created → applied monitor/month for owner", r.action === "applied" && r.planCode === "monitor" && r.billingInterval === "month" && r.userId === "user-A" && r.status === "active");
  t("W1 persisted one normalized row", db._subs.size === 1 && db._subs.get("sub-1").plan_code === "monitor");

  // WEBHOOK 4 — duplicate event (same id+updated_at) → skip.
  r = await handleSubscriptionEvent(db, payload({}), ENV);
  t("W4 duplicate → skipped duplicate_event", r.action === "skipped" && r.reason === "duplicate_event");

  // WEBHOOK 5 — out-of-order: older updated_at than stored → skip stale.
  r = await handleSubscriptionEvent(db, payload({ status: "cancelled", updatedAt: "2026-08-01T00:00:00.000Z" }), ENV);
  t("W5 older event → skipped stale_event", r.action === "skipped" && r.reason === "stale_event");
  t("W5 stored state unchanged (still active)", db._subs.get("sub-1").status === "active");

  // Newer event applies (cancel at period end).
  r = await handleSubscriptionEvent(db, payload({ status: "cancelled", cancelled: true, endsAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-09-15T00:00:00.000Z" }), ENV);
  t("newer cancel → applied canceled + cancel_at_period_end + ended_at", r.action === "applied" && db._subs.get("sub-1").status === "canceled" && db._subs.get("sub-1").cancel_at_period_end === true && db._subs.get("sub-1").ended_at === "2026-10-01T00:00:00.000Z");

  // WEBHOOK 6 — non-subscription event → not handled here (one-time flow owns it).
  r = await handleSubscriptionEvent(db, { meta: { event_name: "order_created" }, data: { id: "o1", attributes: {} } } as any, ENV);
  t("W6 order event → handled:false (delegated to one-time flow)", r.handled === false);

  // WEBHOOK 7 — unmapped variant → refused, no grant.
  db = fakeDb();
  r = await handleSubscriptionEvent(db, payload({ variant: 999999 }), ENV);
  t("W7 unmapped variant → rejected unmapped_variant, no row", r.action === "rejected" && r.reason === "unmapped_variant" && db._subs.size === 0);

  // WEBHOOK 8 — malformed: missing subscription id.
  r = await handleSubscriptionEvent(db, { meta: { event_name: "subscription_created", custom_data: { user_id: "u" } }, data: { attributes: { variant_id: 221 } } } as any, ENV);
  t("W8 missing subscription id → rejected", r.action === "rejected" && r.reason === "missing_subscription_id");

  // WEBHOOK 9 — customer mapping missing (no custom_data.user_id, no existing row).
  r = await handleSubscriptionEvent(db, payload({ userId: null, sub: "sub-new" }), ENV);
  t("W9 no owner provenance → rejected customer_mapping_missing", r.action === "rejected" && r.reason === "customer_mapping_missing");

  // WEBHOOK 10 — customer A event cannot mutate B: owner comes from trusted custom_data, not email.
  db = fakeDb();
  await handleSubscriptionEvent(db, payload({ sub: "sub-A", userId: "user-A", email: "victim-B@example.com" }), ENV);
  t("W10 owner = trusted custom_data.user_id, ignores payload email", db._subs.get("sub-A").user_id === "user-A");

  // Fallback: event without custom_data but an existing row → uses persisted owner.
  const r2: any = await handleSubscriptionEvent(db, payload({ sub: "sub-A", userId: null, status: "active", updatedAt: "2026-09-20T00:00:00.000Z" }), ENV);
  t("fallback owner from existing row when custom_data absent", r2.action === "applied" && r2.userId === "user-A");

  // Usage period seeded on apply (idempotent seed call made).
  t("usage period seed attempted on apply", db._periods.length >= 1 && db._periods[0].plan_code === "monitor");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
run().catch((e) => { console.error(e); process.exit(1); });
