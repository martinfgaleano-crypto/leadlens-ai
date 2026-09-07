// ─── Canonical one-time order fulfillment (current-product, NOT legacy lead-gen) ──────────────
//
// Frozen ONE-TIME FULFILLMENT decision (2026-09-04): a NEW canonical Lemon one-time order fulfills
// the CURRENT Account Opportunity Intelligence product — it grants exactly the catalog's
// `opportunity_target` current-product credits (Preview 2 / Brief 6 / Intelligence 12 / Premium 18)
// to the TRUSTED tenant (meta.custom_data.user_id), idempotently. It must NEVER create lead_searches,
// invoke runLeadLensPipeline, generate outreach, use Stripe, or grant legacy PLAN_CREDITS (5/25/50/100).
//
// Two parts, mirroring the codebase's pure-policy + thin-owner pattern:
//   planOneTimeFulfillment()  — PURE decision (no DB/network): trusted-tenant + server-owned
//     variant→product authority + credit amount. Rejects safely; never grants on email alone.
//   fulfillCanonicalOrder()   — thin owner over injected deps: order-level idempotency (orders
//     .external_order_id is UNIQUE) then a single credit grant. No legacy side effects exist here.

import { resolveProduct } from "@/lib/products/catalog";
import { variantToOneTimeLegacyPlan } from "@/lib/billing/provider-plan-map";

export type FulfillmentReason =
  | "not_canonical"      // no trusted user_id and no product_code → caller uses legacy path
  | "missing_tenant"     // canonical-looking order but no trusted user_id → fail safe (NO email grant)
  | "unmapped_variant"   // variant not configured as a one-time product
  | "invalid_product"    // resolved product is not a one-time product
  | "product_mismatch";  // client-declared product_code disagrees with server variant authority

export interface OneTimeFulfillmentPlan {
  ok: boolean;
  userId?: string;
  productCode?: string;
  credits?: number;
  reason?: FulfillmentReason;
}

/** PURE fulfillment decision for a Lemon one-time order. No DB/network. A "canonical" order is one
 *  our own checkout created — it carries the trusted meta.custom_data.user_id. The SERVER-OWNED
 *  variant→product map is the sole authority for WHAT is granted; a client-declared product_code is
 *  only accepted as a defense-in-depth cross-check and can never widen the grant. */
export function planOneTimeFulfillment(input: {
  custom: Record<string, unknown> | undefined | null;
  variantId: string | number | undefined | null;
  env?: NodeJS.ProcessEnv;
}): OneTimeFulfillmentPlan {
  const custom = (input.custom ?? {}) as Record<string, unknown>;
  const userId = typeof custom.user_id === "string" ? custom.user_id.trim() : "";
  const declared = typeof custom.product_code === "string" ? custom.product_code.trim() : "";

  // Neither trusted tenant nor product marker → not one of our canonical orders. Caller decides
  // (legacy/historical path); we NEVER fall back to email-based granting here.
  if (!userId && !declared) return { ok: false, reason: "not_canonical" };
  // Canonical-looking but no trusted tenant → fail safe. Email is not tenant authority (§3/§10).
  if (!userId) return { ok: false, reason: "missing_tenant" };

  // Server-owned authority: variant → one-time product.
  const slug = variantToOneTimeLegacyPlan(input.variantId, input.env);
  if (!slug) return { ok: false, reason: "unmapped_variant" };
  const product = resolveProduct(slug);
  if (!product || product.billing_type !== "one_time") return { ok: false, reason: "invalid_product" };

  // Defense in depth: if the client declared a product_code it MUST resolve to the same product.
  if (declared && resolveProduct(declared)?.product_code !== product.product_code) {
    return { ok: false, reason: "product_mismatch" };
  }

  return { ok: true, userId, productCode: product.product_code, credits: product.entitlements.opportunity_target };
}

export interface OneTimeOrderRecord {
  external_order_id: string | null;
  provider_event_id: string;
  plan: string;            // legacy plan slug, for the order record only (not the grant unit)
  amount_cents: number;
  currency: string;
  customer_email: string;  // billing/contact metadata ONLY — never the grant authority
  raw_payload: unknown;
}

export interface OneTimeFulfillmentDeps {
  /** Existing order with this external id, or null. UNIQUE(external_order_id) closes the race. */
  getOrderByExternalId: (externalId: string) => Promise<{ id: string } | null>;
  createOrder: (record: OneTimeOrderRecord) => Promise<{ id: string } | null>;
  /** Grants `amount` current-product credits to `userId` and records the transaction. */
  addCredits: (userId: string, amount: number, description: string) => Promise<{ credit_balance: number }>;
}

export interface FulfillmentOutcome {
  status: "granted" | "duplicate" | "rejected" | "persist_failed";
  credits?: number;
  userId?: string;
  productCode?: string;
  reason?: FulfillmentReason;
}

/** Thin owner: idempotent, single-grant fulfillment of a canonical one-time order. There is no
 *  lead_searches / pipeline / outreach / Stripe path reachable from here — by construction. */
export async function fulfillCanonicalOrder(
  deps: OneTimeFulfillmentDeps,
  args: { plan: OneTimeFulfillmentPlan; lsOrderId: string; record: OneTimeOrderRecord },
): Promise<FulfillmentOutcome> {
  const { plan, lsOrderId, record } = args;
  if (!plan.ok) return { status: "rejected", reason: plan.reason };

  // Idempotency: an order already stored for this provider id → already fulfilled, no re-grant.
  if (lsOrderId) {
    const existing = await deps.getOrderByExternalId(lsOrderId);
    if (existing) return { status: "duplicate", userId: plan.userId, productCode: plan.productCode };
  }

  const order = await deps.createOrder(record);
  if (!order) return { status: "persist_failed" };

  await deps.addCredits(plan.userId!, plan.credits!, `one-time ${plan.productCode} — order ${lsOrderId}`);
  return { status: "granted", credits: plan.credits, userId: plan.userId, productCode: plan.productCode };
}
