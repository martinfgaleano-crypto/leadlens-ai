// ─── Lemon Squeezy subscription events → normalized subscription + entitlement ─
//
// The subscription boundary for the existing lemon-webhook. Preserves the mature one-time
// order flow (untouched); this handles ONLY subscription_* events. Security-critical:
//   - Owner is resolved from TRUSTED provenance — meta.custom_data.user_id we attach at
//     checkout, or the persisted owner of the existing subscription row — NEVER an arbitrary
//     email in the payload. So one customer's event can never mutate another's subscription.
//   - Variant → canonical plan is a config-boundary map; an unmapped variant is refused (no
//     accidental grant).
//   - Idempotent + out-of-order safe via applySubscriptionEvent (event identity + timestamp).

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  applySubscriptionEvent, type ProviderSubscriptionEvent, type SubscriptionRecord,
} from "@/lib/billing/subscription-lifecycle";
import { variantToCanonicalPlan } from "@/lib/billing/provider-plan-map";
import { subscriptionPlanConfig } from "@/lib/entitlements/plan-config";
import { currentUsagePeriod, seedUsagePeriod } from "@/lib/billing/usage-ledger";

export type SubscriptionEventOutcome =
  | { handled: true; action: "applied"; userId: string; planCode: string; billingInterval: string; status: string; subscriptionId: string }
  | { handled: true; action: "skipped"; reason: string; subscriptionId: string }
  | { handled: true; action: "rejected"; status: number; reason: string }
  | { handled: false };

export function isSubscriptionEvent(eventName: string): boolean {
  return typeof eventName === "string" && eventName.startsWith("subscription_");
}

const PROVIDER = "lemon_squeezy";

/** Load the existing normalized row for a provider subscription id (best-effort). */
async function loadExisting(db: any, subscriptionId: string): Promise<SubscriptionRecord | null> {
  try {
    const { data } = await db.from("customer_subscriptions")
      .select("*").eq("payment_provider", PROVIDER).eq("provider_subscription_id", subscriptionId).limit(1);
    return (data && data[0]) ? (data[0] as SubscriptionRecord) : null;
  } catch { return null; }
}

/** Handle one Lemon subscription_* webhook payload. `payload` is the parsed (already signature-
 *  verified) body. Returns a structured outcome; the caller maps it to an HTTP response. */
export async function handleSubscriptionEvent(db: any, payload: Record<string, unknown>, env: NodeJS.ProcessEnv = process.env): Promise<SubscriptionEventOutcome> {
  const meta = (payload.meta ?? {}) as Record<string, unknown>;
  const data = (payload.data ?? {}) as Record<string, unknown>;
  const attrs = (data.attributes ?? {}) as Record<string, unknown>;
  const eventName = String(meta.event_name ?? "");
  if (!isSubscriptionEvent(eventName)) return { handled: false };

  const subscriptionId = String(data.id ?? "");
  if (!subscriptionId) return { handled: true, action: "rejected", status: 400, reason: "missing_subscription_id" };

  // ── Resolve owner from trusted provenance only ─────────────────────────────
  const customData = (meta.custom_data ?? {}) as Record<string, unknown>;
  let userId = String(customData.user_id ?? "").trim();
  const existing = await loadExisting(db, subscriptionId);
  if (!userId && existing) userId = existing.user_id;
  if (!userId) return { handled: true, action: "rejected", status: 400, reason: "customer_mapping_missing" };

  // ── Map variant → canonical plan (config boundary; unmapped = refuse, no grant) ──
  const variantId = attrs.variant_id;
  const canonical = variantToCanonicalPlan(variantId as any, env);
  if (!canonical) return { handled: true, action: "rejected", status: 422, reason: "unmapped_variant" };
  if (!subscriptionPlanConfig(canonical.planCode)) return { handled: true, action: "rejected", status: 422, reason: "unknown_plan" };

  // ── Build the provider event (normalize provider fields into canonical inputs) ──
  const updatedAt = String(attrs.updated_at ?? "") || new Date().toISOString();
  const createdAt = String(attrs.created_at ?? "") || updatedAt;
  const periodEnd = (attrs.ends_at as string) || (attrs.renews_at as string) || null;
  const event: ProviderSubscriptionEvent = {
    eventId: `${eventName}:${subscriptionId}:${updatedAt}`,
    eventAt: updatedAt,
    userId,
    provider: PROVIDER,
    providerCustomerId: attrs.customer_id != null ? String(attrs.customer_id) : null,
    providerSubscriptionId: subscriptionId,
    planCode: canonical.planCode,
    billingInterval: canonical.billingInterval,
    providerStatus: String(attrs.status ?? ""),
    currentPeriodStart: createdAt,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: Boolean(attrs.cancelled),
    endedAt: (attrs.ends_at as string) || null,
  };

  const decision = applySubscriptionEvent(existing, event);
  if (decision.action === "skip") {
    return { handled: true, action: "skipped", reason: decision.reason, subscriptionId };
  }

  // ── Persist normalized subscription (upsert on provider + subscription id) ──
  const next = decision.next;
  try {
    await db.from("customer_subscriptions").upsert(
      { ...next, updated_at: new Date().toISOString() },
      { onConflict: "payment_provider,provider_subscription_id" },
    );
  } catch (e) {
    return { handled: true, action: "rejected", status: 500, reason: "persist_failed" };
  }

  // ── Seed the current usage period (idempotent; no-op until migration 062 is applied) ──
  const cfg = subscriptionPlanConfig(canonical.planCode)!;
  const period = currentUsagePeriod(next.current_period_start ?? createdAt, cfg.credits_per_period);
  await seedUsagePeriod(db, userId, canonical.planCode, period);

  return {
    handled: true, action: "applied",
    userId, planCode: canonical.planCode, billingInterval: canonical.billingInterval,
    status: next.status, subscriptionId,
  };
}
