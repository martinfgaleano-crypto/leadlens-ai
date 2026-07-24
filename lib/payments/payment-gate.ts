export type PaymentGate =
  | { enabled: true; provider: "stripe" }
  | { enabled: false; reason: "payments_closed" | "provider_not_selected" };

/**
 * Self-serve payment is opt-in twice: an explicit launch flag and a selected
 * provider. Merely leaving an old secret in an environment can never reopen it.
 */
export function paymentGate(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PaymentGate {
  if (env.PAYMENTS_ENABLED !== "true") {
    return { enabled: false, reason: "payments_closed" };
  }
  // Stripe is retained as legacy implementation only. Adding another provider
  // requires an explicit typed branch and an E2E; unknown values fail closed.
  if (env.PAYMENT_PROVIDER !== "stripe") {
    return { enabled: false, reason: "provider_not_selected" };
  }
  return { enabled: true, provider: "stripe" };
}
