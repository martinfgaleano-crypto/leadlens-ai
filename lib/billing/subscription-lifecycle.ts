// Billing Core V1 — pure, provider-agnostic subscription lifecycle.
//
// Normalizes provider (Lemon Squeezy) subscription events into ONE internal canonical state
// (customer_subscriptions), and decides — idempotently and safe against out-of-order delivery —
// whether an incoming event should be applied. The entitlement resolver reads the normalized
// state; it never sees raw provider objects. No pricing is encoded here (plan_code + interval
// are carried through; numeric limits live in entitlements config, owned by Pricing).

export type CanonicalStatus = "active" | "trialing" | "past_due" | "canceled" | "expired";
export type BillingInterval = "month" | "year";

export interface SubscriptionRecord {
  user_id: string;
  payment_provider: string;
  provider_customer_id: string | null;
  provider_subscription_id: string;
  plan_code: string;
  billing_interval: BillingInterval;
  status: CanonicalStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  ended_at: string | null;
  last_event_id: string | null;
  last_event_at: string | null;
}

// Lemon Squeezy subscription status → canonical. Unknown provider states fail safe to "expired"
// (no silent access). "cancelled" stays access-bearing only until the period ends (see below).
const PROVIDER_STATUS: Record<string, CanonicalStatus> = {
  active: "active",
  on_trial: "trialing",
  trialing: "trialing",
  past_due: "past_due",
  unpaid: "past_due",
  cancelled: "canceled",
  canceled: "canceled",
  paused: "expired",
  expired: "expired",
};

export function normalizeSubscriptionStatus(providerStatus: string | null | undefined): CanonicalStatus {
  return PROVIDER_STATUS[(providerStatus ?? "").toLowerCase()] ?? "expired";
}

/** A subscription confers access while active/trialing, and while "canceled but not yet ended"
 *  (cancel_at_period_end honored). past_due is a policy seam — Pricing owns grace duration, so we
 *  keep access during past_due here rather than inventing a cutoff (billing state is represented;
 *  a future policy can revoke). expired/ended never confers access. */
export function subscriptionGrantsAccess(sub: Pick<SubscriptionRecord, "status" | "current_period_end" | "ended_at">, now = Date.now()): boolean {
  if (sub.ended_at && new Date(sub.ended_at).getTime() <= now) return false;
  switch (sub.status) {
    case "active":
    case "trialing":
    case "past_due":
      return true;
    case "canceled":
      // Access continues until the paid period actually ends.
      return sub.current_period_end ? new Date(sub.current_period_end).getTime() > now : false;
    case "expired":
    default:
      return false;
  }
}

export interface ProviderSubscriptionEvent {
  eventId: string;
  eventAt: string;                 // provider event timestamp (ISO)
  userId: string;
  provider: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string;
  planCode: string;
  billingInterval: BillingInterval;
  providerStatus: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  endedAt: string | null;
}

export type ApplyResult =
  | { action: "apply"; next: SubscriptionRecord }
  | { action: "skip"; reason: "duplicate_event" | "stale_event" };

/** Decide how to fold an incoming provider event into the stored record — idempotent (a replayed
 *  eventId is a no-op) and out-of-order safe (an event older than the last applied one is ignored).
 *  Pure: the caller persists `next` (upsert on provider_subscription_id). */
export function applySubscriptionEvent(existing: SubscriptionRecord | null, event: ProviderSubscriptionEvent): ApplyResult {
  if (existing) {
    if (existing.last_event_id && existing.last_event_id === event.eventId) return { action: "skip", reason: "duplicate_event" };
    if (existing.last_event_at && new Date(event.eventAt).getTime() < new Date(existing.last_event_at).getTime()) {
      return { action: "skip", reason: "stale_event" };
    }
  }
  return {
    action: "apply",
    next: {
      user_id: event.userId,
      payment_provider: event.provider,
      provider_customer_id: event.providerCustomerId,
      provider_subscription_id: event.providerSubscriptionId,
      plan_code: event.planCode,
      billing_interval: event.billingInterval,
      status: normalizeSubscriptionStatus(event.providerStatus),
      current_period_start: event.currentPeriodStart,
      current_period_end: event.currentPeriodEnd,
      cancel_at_period_end: event.cancelAtPeriodEnd,
      ended_at: event.endedAt,
      last_event_id: event.eventId,
      last_event_at: event.eventAt,
    },
  };
}

/** Billing → entitlement synchronization input: the access a subscription grants, for the resolver.
 *  Returns null when the subscription does not currently confer access. */
export function subscriptionAccess(sub: SubscriptionRecord | null, now = Date.now()): { planCode: string; billingInterval: BillingInterval } | null {
  if (!sub || !subscriptionGrantsAccess(sub, now)) return null;
  return { planCode: sub.plan_code, billingInterval: sub.billing_interval };
}
