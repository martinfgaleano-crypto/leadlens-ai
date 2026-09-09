// Canonical one-time fulfillment — grant authority + idempotency + event-ordering contracts.
// Covers the billing trust boundary the webhook depends on (app/api/lemon-webhook canonical path):
//   • planOneTimeFulfillment: server-owned variant→product authority; trusted-tenant fail-safe;
//     product_code cross-check can never widen a grant; credits ALWAYS from the frozen catalog.
//   • fulfillCanonicalOrder: at-most-once grant across duplicate/replay/concurrent webhook delivery.
// Deterministic; no network/DB (in-memory deps). Mirrors the frozen one-time catalog:
//   Preview $7/2 (sample) · Brief $25/6 (starter) · Intelligence $59/12 (standard) · Premium $129/18 (pro).

import { planOneTimeFulfillment, fulfillCanonicalOrder, type OneTimeFulfillmentDeps } from "../../lib/billing/one-time-fulfillment";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

// Server-owned variant→one-time-product config (as the webhook reads from env).
const ENV = {
  LEMONSQUEEZY_VARIANT_SAMPLE: "v_sample_2",
  LEMONSQUEEZY_VARIANT_STARTER: "v_starter_6",
  LEMONSQUEEZY_VARIANT_STANDARD: "v_standard_12",
  LEMONSQUEEZY_VARIANT_PRO: "v_pro_18",
} as unknown as NodeJS.ProcessEnv;

const USER = "user-abc-123";

// ── 1. Frozen catalog authority: each mapped variant grants exactly the catalog opportunity_target ──
const EXPECT: Array<[string, string, string, number]> = [
  ["v_sample_2", "preview_launch_v0", "Preview", 2],
  ["v_starter_6", "brief_launch_v0", "Brief", 5],
  ["v_standard_12", "intelligence_launch_v0", "Intelligence", 12],
  ["v_pro_18", "premium_launch_v0", "Premium", 18],
];
for (const [variant, productCode, label, credits] of EXPECT) {
  const p = planOneTimeFulfillment({ custom: { user_id: USER }, variantId: variant, env: ENV });
  t(`${label}: ok`, p.ok === true);
  t(`${label}: product=${productCode}`, p.productCode === productCode);
  t(`${label}: credits=${credits} (frozen opportunity_target)`, p.credits === credits);
  t(`${label}: tenant is the trusted user_id`, p.userId === USER);
}

// ── 2. Trust boundary / security (Phase K) ──
// No trusted tenant AND no product marker → not one of our orders (caller uses legacy path).
t("not_canonical when no user_id and no product_code", planOneTimeFulfillment({ custom: {}, variantId: "v_sample_2", env: ENV }).reason === "not_canonical");
// Canonical-looking (product_code present) but NO trusted tenant → fail safe, never email-grant.
t("missing_tenant when product_code present but user_id absent", planOneTimeFulfillment({ custom: { product_code: "preview_launch_v0" }, variantId: "v_sample_2", env: ENV }).reason === "missing_tenant");
// Unmapped/unknown variant → fail safe (no arbitrary grant).
t("unmapped_variant for unknown variant id", planOneTimeFulfillment({ custom: { user_id: USER }, variantId: "v_unknown_999", env: ENV }).reason === "unmapped_variant");
t("unmapped_variant for empty variant id", planOneTimeFulfillment({ custom: { user_id: USER }, variantId: "", env: ENV }).reason === "unmapped_variant");
// Client-declared product_code that DISAGREES with the server variant authority → rejected (cannot widen).
const mismatch = planOneTimeFulfillment({ custom: { user_id: USER, product_code: "premium_launch_v0" }, variantId: "v_sample_2", env: ENV });
t("product_mismatch: declared Premium but variant is Preview → rejected", mismatch.reason === "product_mismatch" && mismatch.ok === false);
// Declared product_code that AGREES → accepted (defense-in-depth cross-check passes), still catalog credits.
const agree = planOneTimeFulfillment({ custom: { user_id: USER, product_code: "preview_launch_v0" }, variantId: "v_sample_2", env: ENV });
t("declared==server variant → ok with catalog credits (2)", agree.ok === true && agree.credits === 2 && agree.productCode === "preview_launch_v0");
// A larger declared product cannot escalate quantity beyond the paid variant.
t("client cannot escalate credits via product_code", mismatch.credits === undefined);

// ── 3. Idempotency + event ordering (Phase E) — in-memory deps ──
async function main() {
function makeDeps() {
  const orders = new Map<string, { id: string }>();
  const grants: Array<{ userId: string; amount: number }> = [];
  let orderSeq = 0;
  const deps: OneTimeFulfillmentDeps = {
    getOrderByExternalId: async (id) => orders.get(id) ?? null,
    createOrder: async (rec) => {
      const key = rec.external_order_id ?? "";
      if (key && orders.has(key)) return null; // UNIQUE(external_order_id) violation → loser
      const row = { id: `order-${++orderSeq}` };
      if (key) orders.set(key, row);
      return row;
    },
    addCredits: async (userId, amount) => { grants.push({ userId, amount }); return { credit_balance: grants.filter(g => g.userId === userId).reduce((s, g) => s + g.amount, 0) }; },
  };
  return { deps, orders, grants };
}
const plan = planOneTimeFulfillment({ custom: { user_id: USER }, variantId: "v_standard_12", env: ENV }); // Intelligence, 12
const record = { external_order_id: "ls-order-777", provider_event_id: "wh-1", plan: "standard", amount_cents: 5900, currency: "USD", customer_email: "buyer@example.com", raw_payload: {} };

// CASE: fresh order → granted exactly once, credits = 12.
{
  const { deps, grants } = makeDeps();
  const o = await fulfillCanonicalOrder(deps, { plan, lsOrderId: "ls-order-777", record });
  t("fresh order → granted", o.status === "granted" && o.credits === 12 && o.userId === USER);
  t("fresh order → exactly one credit grant of 12", grants.length === 1 && grants[0].amount === 12);
}
// CASE 4/5/13/14: duplicate / replay / already-fulfilled → duplicate, NO re-grant.
{
  const { deps, grants } = makeDeps();
  await fulfillCanonicalOrder(deps, { plan, lsOrderId: "ls-order-777", record });        // first
  const dup = await fulfillCanonicalOrder(deps, { plan, lsOrderId: "ls-order-777", record }); // replay
  t("duplicate delivery → status duplicate", dup.status === "duplicate");
  t("duplicate delivery → NO second grant (at-most-once)", grants.length === 1);
  // Many replays stay at one grant.
  for (let i = 0; i < 5; i++) await fulfillCanonicalOrder(deps, { plan, lsOrderId: "ls-order-777", record });
  t("5 extra replays → still exactly one grant", grants.length === 1);
}
// CASE (concurrent): both pass the existence check, createOrder UNIQUE lets only one win → loser persist_failed, no double grant.
{
  const { deps, grants, orders } = makeDeps();
  // Simulate the winner having created the order between the loser's existence-check and createOrder.
  orders.set("ls-order-777", { id: "order-winner" });          // winner already persisted
  const loser = await fulfillCanonicalOrder({ ...deps, getOrderByExternalId: async () => null }, { plan, lsOrderId: "ls-order-777", record }); // loser saw null, then createOrder conflicts
  t("concurrent loser → persist_failed (retryable), NO grant", loser.status === "persist_failed" && grants.length === 0);
}
// CASE 10/11: rejected plans never grant.
{
  const { deps, grants } = makeDeps();
  const unmapped = await fulfillCanonicalOrder(deps, { plan: planOneTimeFulfillment({ custom: { user_id: USER }, variantId: "v_x", env: ENV }), lsOrderId: "ls-9", record });
  t("unmapped variant → rejected, no grant", unmapped.status === "rejected" && unmapped.reason === "unmapped_variant" && grants.length === 0);
  const noTenant = await fulfillCanonicalOrder(deps, { plan: planOneTimeFulfillment({ custom: { product_code: "preview_launch_v0" }, variantId: "v_sample_2", env: ENV }), lsOrderId: "ls-10", record });
  t("missing tenant → rejected, no grant", noTenant.status === "rejected" && noTenant.reason === "missing_tenant" && grants.length === 0);
}
// CASE: distinct orders for the same user each grant once (no cross-order dedup collision).
{
  const { deps, grants } = makeDeps();
  await fulfillCanonicalOrder(deps, { plan, lsOrderId: "ls-A", record: { ...record, external_order_id: "ls-A" } });
  await fulfillCanonicalOrder(deps, { plan, lsOrderId: "ls-B", record: { ...record, external_order_id: "ls-B" } });
  t("two distinct orders → two grants", grants.length === 2 && grants.every(g => g.amount === 12));
}
}

main().then(() => {
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}).catch((e) => { console.error(e); process.exit(1); });
