#!/usr/bin/env node
// REAL acceptance: signed Lemon subscription events → real /api/lemon-webhook route → real
// Supabase customer_subscriptions → canonical entitlement resolver → product access.
// Self-cleaning. No real Lemon account needed: payloads are provider-shaped and HMAC-signed
// with a test secret injected in-process, exercising the exact production verify+parse+persist
// path. Usage-ledger metering (migration 062) is not applied live → resolver reports full
// allowance (pending_ledger); subscription ACCESS is what this proves end-to-end.
import { NextRequest } from "next/server";
import crypto from "crypto";
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"])
  if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }

// Inject test billing config BEFORE importing the route (read at request time).
const SECRET = "test_ls_secret_" + Date.now();
process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET;
process.env.LEMONSQUEEZY_VARIANT_MONITOR_MONTH = "9001";
process.env.LEMONSQUEEZY_VARIANT_INTELLIGENCE_YEAR = "9002";

const { POST } = await import("@/app/api/lemon-webhook/route");
const { createServerClient } = await import("@/lib/supabase/server");
const { resolveEntitlements } = await import("@/lib/entitlements/entitlements-v1");
const db = createServerClient()!;

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (n: string, ok: boolean, d?: string) => { checks.push({ name: n, ok, detail: d }); console.log(`${ok ? "ok" : "FAIL"} - ${n}${d ? ` :: ${d}` : ""}`); };

const sign = (raw: string, secret = SECRET) => crypto.createHmac("sha256", secret).update(raw).digest("hex");
const post = (body: any, opts: { sig?: string | null } = {}) => {
  const raw = JSON.stringify(body);
  const headers: Record<string, string> = { "content-type": "application/json" };
  const sig = opts.sig === undefined ? sign(raw) : opts.sig;
  if (sig !== null) headers["x-signature"] = sig;
  return POST(new NextRequest("http://localhost/api/lemon-webhook", { method: "POST", body: raw, headers }));
};

const stamp = Date.now();
const subId = `subacc-${stamp}`;
const emailA = `ll-subA-${stamp}@example.com`;
const emailB = `ll-subB-${stamp}@example.com`;
let userA: string | null = null, userB: string | null = null;

const subPayload = (o: { status?: string; variant?: number; userId?: string; email?: string; updatedAt?: string; endsAt?: string | null; cancelled?: boolean; sub?: string } = {}) => ({
  meta: { event_name: o.cancelled ? "subscription_updated" : "subscription_created", custom_data: { user_id: o.userId ?? userA } },
  data: {
    id: o.sub ?? subId, type: "subscriptions",
    attributes: {
      variant_id: o.variant ?? 9001, status: o.status ?? "active", customer_id: 5000,
      user_email: o.email ?? emailA,
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: o.updatedAt ?? new Date(stamp).toISOString(),
      renews_at: "2026-12-01T00:00:00.000Z", ends_at: o.endsAt ?? null, cancelled: o.cancelled ?? false,
    },
  },
});

try {
  userA = (await db.auth.admin.createUser({ email: emailA, password: `Sb-${stamp}-Aa!`, email_confirm: true })).data.user!.id;
  userB = (await db.auth.admin.createUser({ email: emailB, password: `Sb-${stamp}-Bb!`, email_confirm: true })).data.user!.id;
  await db.from("profiles").upsert([{ id: userA, email: emailA, plan: "free" }, { id: userB, email: emailB, plan: "free" }], { onConflict: "id" });
  // Zero any signup credits so B resolves cleanly (not one_time).
  await db.from("customer_credits").upsert([{ user_id: userA, credit_balance: 0 }, { user_id: userB, credit_balance: 0 }], { onConflict: "user_id" });

  // ── Signature guards ──
  const missing = await post(subPayload(), { sig: null });
  check("missing signature → 400", missing.status === 400, `HTTP ${missing.status}`);
  const invalid = await post(subPayload(), { sig: "a".repeat(64) });
  check("invalid signature → 401", invalid.status === 401, `HTTP ${invalid.status}`);

  // ── W1: valid subscription_created → applied ──
  const created = await post(subPayload());
  const cbody = await created.json() as any;
  check("valid created → 200 applied monitor/month", created.status === 200 && cbody.subscription?.action === "applied" && cbody.subscription?.planCode === "monitor", JSON.stringify(cbody.subscription));

  const { data: rowA } = await db.from("customer_subscriptions").select("*").eq("user_id", userA).eq("provider_subscription_id", subId).maybeSingle();
  check("normalized row persisted for owner A (status active, plan monitor)", !!rowA && rowA.status === "active" && rowA.plan_code === "monitor" && rowA.billing_interval === "month");

  // ── Entitlement resolution: subscription access + canonical MONITOR limits ──
  const eA = await resolveEntitlements(db, userA);
  check("resolver: accessSource subscription + plan monitor", eA.accessSource === "subscription" && eA.planCode === "monitor");
  check("resolver: MONITOR limits 30/15 + can_run_intelligence + monitor", eA.limits.max_runs_per_period === 30 && eA.limits.max_active_monitors === 15 && eA.capabilities.can_run_intelligence && eA.capabilities.can_run_monitor);
  const { intelligenceRunGate } = await import("@/lib/entitlements/entitlements-v1");
  check("resolver: run gate allows active subscriber", intelligenceRunGate(eA) === null);

  // ── Idempotency: duplicate delivery ──
  const dup = await post(subPayload());
  const dbody = await dup.json() as any;
  check("duplicate delivery → skipped duplicate_event", dbody.subscription?.action === "skipped" && dbody.subscription?.reason === "duplicate_event");
  const { count: rowCount } = await db.from("customer_subscriptions").select("*", { count: "exact", head: true }).eq("provider_subscription_id", subId);
  check("still exactly one subscription row", rowCount === 1, `count=${rowCount}`);

  // ── Out-of-order: older event cannot regress ──
  const stale = await post(subPayload({ status: "expired", updatedAt: "2020-01-01T00:00:00.000Z" }));
  const sbody = await stale.json() as any;
  check("older event → skipped stale_event", sbody.subscription?.action === "skipped" && sbody.subscription?.reason === "stale_event");
  const eA2 = await resolveEntitlements(db, userA);
  check("stale ignored: still subscription access", eA2.accessSource === "subscription");

  // ── Unmapped variant → refused, no accidental grant (new sub id) ──
  const unmapped = await post(subPayload({ sub: `${subId}-x`, variant: 424242, updatedAt: new Date(stamp + 10).toISOString() }));
  const ubody = await unmapped.json() as any;
  check("unmapped variant → rejected (no grant)", ubody.subscription?.action === "rejected" && ubody.subscription?.reason === "unmapped_variant");
  const { data: noRow } = await db.from("customer_subscriptions").select("id").eq("provider_subscription_id", `${subId}-x`).maybeSingle();
  check("unmapped variant persisted no row", !noRow);

  // ── Cross-customer safety: owner from trusted custom_data, not payload email ──
  const eB = await resolveEntitlements(db, userB);
  check("tenant isolation: B has no subscription access", eB.accessSource !== "subscription");

  // ── Cancel-at-period-end: canceled but period future → access retained ──
  const cancel = await post(subPayload({ status: "cancelled", cancelled: true, endsAt: "2026-12-01T00:00:00.000Z", updatedAt: new Date(stamp + 20000).toISOString() }));
  const cxbody = await cancel.json() as any;
  check("cancel event applied → canceled", cxbody.subscription?.action === "applied" && cxbody.subscription?.status === "canceled");
  const eA3 = await resolveEntitlements(db, userA);
  check("canceled within period → still subscription access", eA3.accessSource === "subscription");

  const failures = checks.filter((c) => !c.ok);
  console.log(`\nSUBSCRIPTION-BILLING :: ${checks.length - failures.length}/${checks.length} checks passed`);
} catch (e) {
  check("harness completed without throw", false, e instanceof Error ? e.message : String(e));
} finally {
  for (const uid of [userA, userB]) if (uid) {
    await db.from("customer_subscriptions").delete().eq("user_id", uid);
    await db.from("customer_credits").delete().eq("user_id", uid);
    await db.from("profiles").delete().eq("id", uid);
    await db.auth.admin.deleteUser(uid).catch(() => {});
  }
  console.log("cleanup :: disposable users removed");
}
process.exit(checks.some((c) => !c.ok) ? 2 : 0);
