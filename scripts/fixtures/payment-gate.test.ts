import assert from "node:assert/strict";
import { paymentGate } from "../../lib/payments/payment-gate";

assert.deepEqual(paymentGate({}), { enabled: false, reason: "payments_closed" });
assert.deepEqual(paymentGate({ STRIPE_SECRET_KEY: "leftover" }), { enabled: false, reason: "payments_closed" });
assert.deepEqual(paymentGate({ PAYMENTS_ENABLED: "true" }), { enabled: false, reason: "provider_not_selected" });
assert.deepEqual(
  paymentGate({ PAYMENTS_ENABLED: "true", PAYMENT_PROVIDER: "lemonsqueezy" }),
  { enabled: false, reason: "provider_not_selected" },
);
assert.deepEqual(
  paymentGate({ PAYMENTS_ENABLED: "true", PAYMENT_PROVIDER: "stripe" }),
  { enabled: true, provider: "stripe" },
);

console.log("✅ checkout stays closed when flags are absent or secrets are stale");
console.log("✅ unknown/unimplemented providers fail closed");
console.log("✅ activation requires explicit flag + implemented provider");
console.log("\n5/5 passed");
