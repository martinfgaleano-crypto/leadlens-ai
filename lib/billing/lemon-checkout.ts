// ─── Lemon Squeezy subscription checkout (server-side, provider-hosted) ────────
//
// The customer chooses only a canonical (plan_code, interval); the SERVER maps that to the
// configured Lemon variant and attaches the trusted LeadLens owner id in custom_data — which
// Lemon echoes back on every subscription webhook, so ownership is provenance-bound end to end.
// No card data touches LeadLens (provider-hosted checkout). Client never supplies variant, price,
// or user id. Fails safe + diagnostic when provider config is absent (no silent wrong-variant).

/* eslint-disable @typescript-eslint/no-explicit-any */
import { canonicalPlanToVariant, oneTimeLegacyPlanToVariant } from "@/lib/billing/provider-plan-map";
import { resolveProduct } from "@/lib/products/catalog";
import type { SubscriptionPlanCode, BillingInterval } from "@/lib/entitlements/plan-config";

export interface CheckoutInput { userId: string; email: string; planCode: SubscriptionPlanCode; interval: BillingInterval }
export interface OneTimeCheckoutInput { userId: string; email: string; productCode: string }
export interface CheckoutResult { configured: boolean; url?: string; reason?: string }

/** Shared provider-hosted checkout POST. Callers verify provider config + variant first, so this
 *  only issues the request. `custom` is echoed back on every webhook so ownership is provenance-bound
 *  end to end (never derived from payload email). No card data touches LeadLens. */
async function postLemonCheckout(variant: string, email: string, custom: Record<string, string>, apiKey: string, storeId: string, env: NodeJS.ProcessEnv): Promise<CheckoutResult> {
  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/=+$/, "");
  const requestBody = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: { email, custom },
        checkout_options: { redirect_url: `${appUrl}/billing/success` },
      },
      relationships: {
        store: { data: { type: "stores", id: String(storeId) } },
        variant: { data: { type: "variants", id: String(variant) } },
      },
    },
  };
  try {
    const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: { "Content-Type": "application/vnd.api+json", Accept: "application/vnd.api+json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
    });
    if (!res.ok) return { configured: true, reason: `provider_error_${res.status}` };
    const json: any = await res.json();
    const url = json?.data?.attributes?.url;
    return url ? { configured: true, url } : { configured: true, reason: "no_url" };
  } catch {
    return { configured: true, reason: "provider_unreachable" };
  }
}

export async function createSubscriptionCheckout(input: CheckoutInput, env: NodeJS.ProcessEnv = process.env): Promise<CheckoutResult> {
  const apiKey = env.LEMONSQUEEZY_API_KEY?.trim();
  const storeId = env.LEMONSQUEEZY_STORE_ID?.trim();
  if (!apiKey || !storeId) return { configured: false, reason: "provider_not_configured" };
  const variant = canonicalPlanToVariant(input.planCode, input.interval, env);
  if (!variant) return { configured: false, reason: "variant_not_configured" };
  return postLemonCheckout(variant, input.email, { user_id: input.userId }, apiKey, storeId, env);
}

/** Canonical customer ONE-TIME checkout on Lemon (frozen §9 — one-time must use Lemon, not Stripe/mock).
 *  Client supplies only a product code; the SERVER resolves it to the catalog product, maps its legacy
 *  plan slug to the configured Lemon one-time variant, and binds the trusted owner id + product code in
 *  custom_data. Fails safe + diagnostic when the product is invalid or provider config is absent. */
export async function createOneTimeCheckout(input: OneTimeCheckoutInput, env: NodeJS.ProcessEnv = process.env): Promise<CheckoutResult> {
  const product = resolveProduct(input.productCode);
  if (!product || product.billing_type !== "one_time") return { configured: false, reason: "invalid_product" };
  const apiKey = env.LEMONSQUEEZY_API_KEY?.trim();
  const storeId = env.LEMONSQUEEZY_STORE_ID?.trim();
  if (!apiKey || !storeId) return { configured: false, reason: "provider_not_configured" };
  const variant = oneTimeLegacyPlanToVariant(product.legacy_plan, env);
  if (!variant) return { configured: false, reason: "variant_not_configured" };
  return postLemonCheckout(variant, input.email, { user_id: input.userId, product_code: product.product_code }, apiKey, storeId, env);
}
