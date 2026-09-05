import { resolveProduct, type ProductCode } from "@/lib/products/catalog";
import { isSubscriptionPlanCode, type SubscriptionPlanCode, type BillingInterval } from "@/lib/entitlements/plan-config";

export const CUSTOMER_LOCALES = ["en", "es", "pt", "ja"] as const;
export type CustomerLocale = typeof CUSTOMER_LOCALES[number];
export type { BillingInterval };
export type CommercialPath = "one_time" | "ongoing";

/** What the customer chose. One-time carries a catalog product; a subscription carries a plan code
 *  AND a billing interval — both must survive auth (hard requirement: "MONITOR Annual" stays that). */
export type CommercialSelection =
  | { kind: "one_time"; productCode: ProductCode }
  | { kind: "subscription"; planCode: SubscriptionPlanCode; interval: BillingInterval };

export interface CommercialFlowState {
  selection: CommercialSelection;
  commercial_path: CommercialPath | null;
  source_cta: string | null;
  locale: CustomerLocale;
  return_to: string;
}

// Post-auth / continuation destinations the flow may route to; anything else → /dashboard. The
// client can never send the customer to an arbitrary origin or path.
const SAFE_DESTINATIONS = ["/dashboard", "/onboarding", "/success", "/checkout/continue", "/activate"];

export function safeCustomerReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  try {
    const parsed = new URL(value, "https://leadlens.invalid");
    if (parsed.origin !== "https://leadlens.invalid") return "/dashboard";
    if (!SAFE_DESTINATIONS.some(path => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`))) return "/dashboard";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch { return "/dashboard"; }
}

function normalizeInterval(value: string | null | undefined): BillingInterval | null {
  return value === "month" || value === "year" ? value : null;
}
function normalizePath(value: string | null | undefined): CommercialPath | null {
  return value === "one_time" || value === "ongoing" ? value : null;
}

/** Resolve the customer's selection from URL params. Subscriptions need plan_code + interval;
 *  one-time needs a resolvable catalog product. Returns null when neither is present/valid. */
export function parseCommercialSelection(params: URLSearchParams): CommercialSelection | null {
  const kind = params.get("kind");
  const planCode = params.get("plan_code");
  // Subscription: explicit kind or a valid subscription plan code present.
  if ((kind === "subscription" || isSubscriptionPlanCode(planCode)) && isSubscriptionPlanCode(planCode)) {
    const interval = normalizeInterval(params.get("billing_interval") ?? params.get("interval"));
    if (!interval) return null; // subscriptions must carry an interval
    return { kind: "subscription", planCode, interval };
  }
  const product = resolveProduct(params.get("product_code") ?? params.get("plan"));
  if (product && product.billing_type === "one_time") return { kind: "one_time", productCode: product.product_code };
  return null;
}

export function parseCommercialFlowState(params: URLSearchParams): CommercialFlowState | null {
  const selection = parseCommercialSelection(params);
  if (!selection) return null;
  const rawLocale = params.get("locale");
  const locale = CUSTOMER_LOCALES.includes(rawLocale as CustomerLocale) ? (rawLocale as CustomerLocale) : "en";
  return {
    selection,
    commercial_path: normalizePath(params.get("commercial_path") ?? params.get("path")),
    source_cta: params.get("source_cta")?.trim().slice(0, 80) || null,
    locale,
    return_to: safeCustomerReturnPath(params.get("return_to")),
  };
}

/** Serialize selection (+ context) back into a query string carried across every stage. */
export function commercialFlowQuery(state: CommercialFlowState | null): string {
  if (!state) return "";
  const q = new URLSearchParams({ locale: state.locale, return_to: state.return_to });
  if (state.selection.kind === "subscription") {
    q.set("kind", "subscription");
    q.set("plan_code", state.selection.planCode);
    q.set("billing_interval", state.selection.interval);
  } else {
    q.set("kind", "one_time");
    q.set("product_code", state.selection.productCode);
  }
  if (state.commercial_path) q.set("commercial_path", state.commercial_path);
  if (state.source_cta) q.set("source_cta", state.source_cta);
  return `?${q.toString()}`;
}

/** Best-effort durable record of intent (telemetry/backup). The URL flow state is the authority
 *  within the session; the DB intents endpoint currently records one-time product intent only, so
 *  subscription intent is carried by the URL + funnel telemetry (no schema change). Never blocks. */
export async function persistCommercialIntent(accessToken: string, state: CommercialFlowState | null): Promise<boolean> {
  if (!state || state.selection.kind !== "one_time") return true;
  try {
    const res = await fetch("/api/commercial-intents", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ product_code: state.selection.productCode }),
    });
    return res.ok;
  } catch { return false; }
}
