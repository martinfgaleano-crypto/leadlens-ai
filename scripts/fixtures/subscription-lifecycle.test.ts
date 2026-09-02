// Billing Core V1 — subscription lifecycle normalization, idempotency, out-of-order safety,
// access derivation, and billing→entitlement sync. Deterministic (no provider/network).

import {
  normalizeSubscriptionStatus, subscriptionGrantsAccess, applySubscriptionEvent, subscriptionAccess,
  type SubscriptionRecord, type ProviderSubscriptionEvent,
} from "../../lib/billing/subscription-lifecycle";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

const NOW = Date.UTC(2026, 8, 1, 12, 0, 0);
const iso = (deltaMs: number) => new Date(NOW + deltaMs).toISOString();

// ── normalization ──
t("active→active", normalizeSubscriptionStatus("active") === "active");
t("on_trial→trialing", normalizeSubscriptionStatus("on_trial") === "trialing");
t("past_due→past_due", normalizeSubscriptionStatus("past_due") === "past_due");
t("unpaid→past_due", normalizeSubscriptionStatus("unpaid") === "past_due");
t("cancelled→canceled", normalizeSubscriptionStatus("cancelled") === "canceled");
t("expired→expired", normalizeSubscriptionStatus("expired") === "expired");
t("unknown→expired (fail safe)", normalizeSubscriptionStatus("weird_state") === "expired");

// ── access derivation ──
const base: SubscriptionRecord = {
  user_id: "u", payment_provider: "lemon_squeezy", provider_customer_id: "c", provider_subscription_id: "s1",
  plan_code: "premium_launch_v0", billing_interval: "month", status: "active",
  current_period_start: iso(-10 * 86400e3), current_period_end: iso(20 * 86400e3),
  cancel_at_period_end: false, ended_at: null, last_event_id: "e1", last_event_at: iso(-1000),
};
t("active grants access", subscriptionGrantsAccess(base, NOW));
t("trialing grants access", subscriptionGrantsAccess({ ...base, status: "trialing" }, NOW));
t("past_due grants access (policy seam, no invented cutoff)", subscriptionGrantsAccess({ ...base, status: "past_due" }, NOW));
t("canceled but period not ended → access", subscriptionGrantsAccess({ ...base, status: "canceled" }, NOW));
t("canceled and period ended → no access", !subscriptionGrantsAccess({ ...base, status: "canceled", current_period_end: iso(-1) }, NOW));
t("expired → no access", !subscriptionGrantsAccess({ ...base, status: "expired" }, NOW));
t("ended_at in past → no access even if active", !subscriptionGrantsAccess({ ...base, ended_at: iso(-1) }, NOW));
t("subscriptionAccess returns plan+interval when active", subscriptionAccess(base, NOW)?.planCode === "premium_launch_v0");
t("subscriptionAccess null when expired", subscriptionAccess({ ...base, status: "expired" }, NOW) === null);

// ── event folding: idempotency + out-of-order ──
const ev = (o: Partial<ProviderSubscriptionEvent>): ProviderSubscriptionEvent => ({
  eventId: "evt_1", eventAt: iso(0), userId: "u", provider: "lemon_squeezy", providerCustomerId: "c",
  providerSubscriptionId: "s1", planCode: "premium_launch_v0", billingInterval: "month",
  providerStatus: "active", currentPeriodStart: iso(-1), currentPeriodEnd: iso(30 * 86400e3),
  cancelAtPeriodEnd: false, endedAt: null, ...o,
});

const created = applySubscriptionEvent(null, ev({ eventId: "evt_create", eventAt: iso(0) }));
t("first event applies (subscription created)", created.action === "apply" && created.action === "apply" && created.next.status === "active");
const stored = created.action === "apply" ? created.next : base;

// duplicate event id → skip (idempotent)
const dup = applySubscriptionEvent(stored, ev({ eventId: stored.last_event_id!, eventAt: iso(5000) }));
t("duplicate event id → skip", dup.action === "skip" && dup.reason === "duplicate_event");

// stale (older) event → skip (out-of-order safe)
const stale = applySubscriptionEvent(stored, ev({ eventId: "evt_old", eventAt: iso(-60_000) }));
t("older event → skip (stale)", stale.action === "skip" && stale.reason === "stale_event");

// newer event → applies (renewal advances period)
const renew = applySubscriptionEvent(stored, ev({ eventId: "evt_renew", eventAt: iso(10_000), currentPeriodEnd: iso(60 * 86400e3) }));
t("newer renewal event applies + advances period", renew.action === "apply" && renew.action === "apply" && renew.next.current_period_end === iso(60 * 86400e3));

// cancellation at period end
const cancel = applySubscriptionEvent(stored, ev({ eventId: "evt_cancel", eventAt: iso(20_000), providerStatus: "cancelled", cancelAtPeriodEnd: true }));
t("cancel event → canceled + cancel_at_period_end", cancel.action === "apply" && cancel.action === "apply" && cancel.next.status === "canceled" && cancel.next.cancel_at_period_end);

// failed payment → past_due normalized
const pastDue = applySubscriptionEvent(stored, ev({ eventId: "evt_pd", eventAt: iso(30_000), providerStatus: "past_due" }));
t("failed payment → past_due", pastDue.action === "apply" && pastDue.action === "apply" && pastDue.next.status === "past_due");

// plan change → new plan_code carried
const upgrade = applySubscriptionEvent(stored, ev({ eventId: "evt_up", eventAt: iso(40_000), planCode: "intelligence_launch_v0", billingInterval: "year" }));
t("plan change → plan_code + interval change", upgrade.action === "apply" && upgrade.action === "apply" && upgrade.next.plan_code === "intelligence_launch_v0" && upgrade.next.billing_interval === "year");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
