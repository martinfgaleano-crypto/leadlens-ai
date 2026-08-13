import { resolveProduct, type ProductCode } from "@/lib/products/catalog";

export const CUSTOMER_LOCALES = ["en", "es", "pt", "ja"] as const;
export type CustomerLocale = typeof CUSTOMER_LOCALES[number];

export interface CommercialFlowState {
  product_code: ProductCode;
  source_cta: string | null;
  locale: CustomerLocale;
  return_to: string;
}

const SAFE_DESTINATIONS = ["/dashboard", "/onboarding", "/success"];

export function safeCustomerReturnPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  try {
    const parsed = new URL(value, "https://leadlens.invalid");
    if (parsed.origin !== "https://leadlens.invalid") return "/dashboard";
    if (!SAFE_DESTINATIONS.some(path => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`))) {
      return "/dashboard";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/dashboard";
  }
}

export function parseCommercialFlowState(params: URLSearchParams): CommercialFlowState | null {
  const product = resolveProduct(params.get("product_code") ?? params.get("plan"));
  if (!product) return null;
  const rawLocale = params.get("locale");
  const locale = CUSTOMER_LOCALES.includes(rawLocale as CustomerLocale)
    ? rawLocale as CustomerLocale
    : "en";
  const source = params.get("source_cta")?.trim().slice(0, 80) || null;
  return {
    product_code: product.product_code,
    source_cta: source,
    locale,
    return_to: safeCustomerReturnPath(params.get("return_to")),
  };
}

export function commercialFlowQuery(state: CommercialFlowState | null): string {
  if (!state) return "";
  const query = new URLSearchParams({
    product_code: state.product_code,
    locale: state.locale,
    return_to: state.return_to,
  });
  if (state.source_cta) query.set("source_cta", state.source_cta);
  return `?${query.toString()}`;
}

export async function persistCommercialIntent(accessToken: string, state: CommercialFlowState | null): Promise<boolean> {
  if (!state) return true;
  const response = await fetch("/api/commercial-intents", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(state),
  });
  return response.ok;
}
