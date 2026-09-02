// ─── Lemon Squeezy subscription checkout (server-side, provider-hosted) ────────
//
// The customer chooses only a canonical (plan_code, interval); the SERVER maps that to the
// configured Lemon variant and attaches the trusted LeadLens owner id in custom_data — which
// Lemon echoes back on every subscription webhook, so ownership is provenance-bound end to end.
// No card data touches LeadLens (provider-hosted checkout). Client never supplies variant, price,
// or user id. Fails safe + diagnostic when provider config is absent (no silent wrong-variant).

/* eslint-disable @typescript-eslint/no-explicit-any */
import { canonicalPlanToVariant } from "@/lib/billing/provider-plan-map";
import type { SubscriptionPlanCode, BillingInterval } from "@/lib/entitlements/plan-config";

export interface CheckoutInput { userId: string; email: string; planCode: SubscriptionPlanCode; interval: BillingInterval }
export interface CheckoutResult { configured: boolean; url?: string; reason?: string }

export async function createSubscriptionCheckout(input: CheckoutInput, env: NodeJS.ProcessEnv = process.env): Promise<CheckoutResult> {
  const apiKey = env.LEMONSQUEEZY_API_KEY?.trim();
  const storeId = env.LEMONSQUEEZY_STORE_ID?.trim();
  const variant = canonicalPlanToVariant(input.planCode, input.interval, env);
  if (!apiKey || !storeId) return { configured: false, reason: "provider_not_configured" };
  if (!variant) return { configured: false, reason: "variant_not_configured" };

  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/=+$/, "");
  const requestBody = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: { email: input.email, custom: { user_id: input.userId } },
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
