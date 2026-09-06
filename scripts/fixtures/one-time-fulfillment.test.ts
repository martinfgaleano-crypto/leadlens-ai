// Canonical current-product one-time fulfillment (frozen 2026-09-04). Deterministic; no network/DB.
// Proves: exact grants 2/6/12/18, trusted-tenant only (no email grant), server variant authority,
// idempotency, tenant isolation, stacking, and NO legacy lead-gen path (structurally unreachable).

import { planOneTimeFulfillment, fulfillCanonicalOrder, type OneTimeFulfillmentDeps, type OneTimeOrderRecord } from "../../lib/billing/one-time-fulfillment";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

const env = {
  LEMONSQUEEZY_VARIANT_SAMPLE: "v2",    // Preview  → 2
  LEMONSQUEEZY_VARIANT_STARTER: "v6",   // Brief    → 6
  LEMONSQUEEZY_VARIANT_STANDARD: "v12", // Intel    → 12
  LEMONSQUEEZY_VARIANT_PRO: "v18",      // Premium  → 18
} as any;

// ── PURE planner: exact canonical grants (A–D) ──
const pv = planOneTimeFulfillment({ custom: { user_id: "U" }, variantId: "v2", env });
t("A. Preview → 2 credits, product preview_launch_v0", pv.ok && pv.credits === 2 && pv.productCode === "preview_launch_v0" && pv.userId === "U");
t("B. Brief → 6 credits", planOneTimeFulfillment({ custom: { user_id: "U" }, variantId: "v6", env }).credits === 6);
t("C. Intelligence one-time → 12 credits", planOneTimeFulfillment({ custom: { user_id: "U" }, variantId: "v12", env }).credits === 12);
t("D. Premium → 18 credits", planOneTimeFulfillment({ custom: { user_id: "U" }, variantId: "v18", env }).credits === 18);

// ── Never grant on legacy 5/25/50/100 (semantic separation) ──
t("grants are 2/6/12/18, never legacy 5/25/50/100", ![5, 25, 50, 100].includes(pv.credits as number));

// ── Fail-safe rejections (I, J + variant authority) ──
t("J. missing tenant (no user_id) → missing_tenant, no grant", planOneTimeFulfillment({ custom: { product_code: "preview_launch_v0" }, variantId: "v2", env }).reason === "missing_tenant");
t("not canonical (empty custom) → not_canonical", planOneTimeFulfillment({ custom: {}, variantId: "v2", env }).reason === "not_canonical");
t("I. declared product_code disagrees with variant → product_mismatch", planOneTimeFulfillment({ custom: { user_id: "U", product_code: "premium_launch_v0" }, variantId: "v2", env }).reason === "product_mismatch");
t("declared product_code agreeing with variant → ok", planOneTimeFulfillment({ custom: { user_id: "U", product_code: "preview_launch_v0" }, variantId: "v2", env }).ok === true);
t("unmapped variant → unmapped_variant (no accidental grant)", planOneTimeFulfillment({ custom: { user_id: "U" }, variantId: "zzz", env }).reason === "unmapped_variant");
t("variant authority ignores client product_code to WIDEN grant (v2 stays 2 even if premium declared)", planOneTimeFulfillment({ custom: { user_id: "U", product_code: "premium_launch_v0" }, variantId: "v2", env }).credits === undefined);

// ── Thin owner with injected fakes (E, F, G, H, K, L) ──
function makeDeps() {
  const calls: { createOrder: OneTimeOrderRecord[]; addCredits: Array<{ userId: string; amount: number }> } = { createOrder: [], addCredits: [] };
  const orders = new Set<string>();
  const balances: Record<string, number> = {};
  const deps: OneTimeFulfillmentDeps = {
    getOrderByExternalId: async (id) => (orders.has(id) ? { id } : null),
    createOrder: async (rec) => { calls.createOrder.push(rec); if (rec.external_order_id) orders.add(rec.external_order_id); return { id: `ord_${rec.external_order_id}` }; },
    addCredits: async (userId, amount) => { calls.addCredits.push({ userId, amount }); balances[userId] = (balances[userId] ?? 0) + amount; return { credit_balance: balances[userId] }; },
  };
  return { deps, calls, balances, seed: (id: string) => orders.add(id) };
}
const rec = (id: string, plan = "sample"): OneTimeOrderRecord => ({ external_order_id: id, provider_event_id: `evt_${id}`, plan, amount_cents: 700, currency: "USD", customer_email: "buyer@x.co", raw_payload: {} });

async function main() {
  // Granted path invokes EXACTLY createOrder + addCredits — no lead_searches/pipeline dep exists (F, G).
  {
    const { deps, calls } = makeDeps();
    const out = await fulfillCanonicalOrder(deps, { plan: planOneTimeFulfillment({ custom: { user_id: "A" }, variantId: "v6", env }), lsOrderId: "o1", record: rec("o1", "starter") });
    t("granted: status granted, 6 credits", out.status === "granted" && out.credits === 6);
    t("F/G. granted path calls only createOrder(1)+addCredits(1); no legacy side effects reachable", calls.createOrder.length === 1 && calls.addCredits.length === 1);
    t("H. grant bound to trusted tenant A only", calls.addCredits[0].userId === "A" && calls.addCredits[0].amount === 6);
  }
  // E. Duplicate order → no re-grant.
  {
    const { deps, calls, seed } = makeDeps();
    seed("odup");
    const out = await fulfillCanonicalOrder(deps, { plan: planOneTimeFulfillment({ custom: { user_id: "A" }, variantId: "v2", env }), lsOrderId: "odup", record: rec("odup") });
    t("E. duplicate order → status duplicate, addCredits NOT called", out.status === "duplicate" && calls.addCredits.length === 0 && calls.createOrder.length === 0);
  }
  // K. Repeat legitimate purchases stack.
  {
    const { deps, calls, balances } = makeDeps();
    await fulfillCanonicalOrder(deps, { plan: planOneTimeFulfillment({ custom: { user_id: "A" }, variantId: "v2", env }), lsOrderId: "k1", record: rec("k1") });
    await fulfillCanonicalOrder(deps, { plan: planOneTimeFulfillment({ custom: { user_id: "A" }, variantId: "v6", env }), lsOrderId: "k2", record: rec("k2", "starter") });
    t("K. two purchases stack to 2+6=8 for tenant A", balances["A"] === 8 && calls.addCredits.length === 2);
  }
  // H (isolation) + L (subscriber coexistence): fulfillment only grants credits; it cannot touch
  // subscription state (no such dep), so a subscriber's one-time buy just adds a balance.
  {
    const { deps, balances } = makeDeps();
    await fulfillCanonicalOrder(deps, { plan: planOneTimeFulfillment({ custom: { user_id: "A" }, variantId: "v12", env }), lsOrderId: "l1", record: rec("l1", "standard") });
    t("L. one-time grant adds balance without any subscription mutation (no such dep)", balances["A"] === 12 && Object.keys(balances).length === 1);
  }
  // Rejected plan → no persistence, no grant.
  {
    const { deps, calls } = makeDeps();
    const out = await fulfillCanonicalOrder(deps, { plan: planOneTimeFulfillment({ custom: {}, variantId: "v2", env }), lsOrderId: "r1", record: rec("r1") });
    t("rejected plan → status rejected, no createOrder/addCredits", out.status === "rejected" && calls.createOrder.length === 0 && calls.addCredits.length === 0);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
main();
