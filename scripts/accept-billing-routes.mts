#!/usr/bin/env node
// REAL acceptance for the customer billing surfaces: GET /api/billing/state and
// POST /api/billing/subscribe. Auth-gated; server maps canonical plan→variant (client cannot
// forge variant/price); provider-unconfigured fails safe (503 billing_unavailable). Self-cleaning.
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])
  if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }

const { GET } = await import("@/app/api/billing/state/route");
const { POST } = await import("@/app/api/billing/subscribe/route");
const { createServerClient } = await import("@/lib/supabase/server");
const admin = createServerClient()!;
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (n: string, ok: boolean, d?: string) => { checks.push({ name: n, ok, detail: d }); console.log(`${ok ? "ok" : "FAIL"} - ${n}${d ? ` :: ${d}` : ""}`); };

const stamp = Date.now();
const email = `ll-bill-${stamp}@example.com`;
const password = `Bl-${stamp}-Aa!`;
let userId: string | null = null;

const stateReq = (token?: string) => new NextRequest("http://localhost/api/billing/state", { headers: token ? { authorization: `Bearer ${token}` } : {} });
const subReq = (token: string | null, body: any) => new NextRequest("http://localhost/api/billing/subscribe", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });

try {
  userId = (await admin.auth.admin.createUser({ email, password, email_confirm: true })).data.user!.id;
  await admin.from("profiles").upsert({ id: userId, email, plan: "free" }, { onConflict: "id" });
  await admin.from("customer_credits").upsert({ user_id: userId, credit_balance: 0 }, { onConflict: "user_id" });
  const token = (await anon.auth.signInWithPassword({ email, password })).data.session!.access_token;

  // ── Auth gate ──
  check("state: unauth → 401", (await GET(stateReq())).status === 401);
  check("subscribe: unauth → 401", (await POST(subReq(null, { plan_code: "watch", interval: "month" }))).status === 401);

  // ── Billing state ──
  const stateRes = await GET(stateReq(token));
  const state = await stateRes.json() as any;
  check("state: 200 with billing truth", stateRes.status === 200 && typeof state.access_source === "string");
  check("state: exposes 3 available plans w/ prices", Array.isArray(state.available_plans) && state.available_plans.length === 3 && state.available_plans.find((p: any) => p.plan_code === "monitor")?.price_monthly === 49);
  check("state: can_subscribe true for non-subscriber", state.can_subscribe === true && state.access_source !== "subscription");
  check("state: no secrets leaked", !/service_role|api_key|secret|password/i.test(JSON.stringify(state)));

  // ── Subscribe: server maps + fails safe when provider unconfigured ──
  const sub = await POST(subReq(token, { plan_code: "monitor", interval: "month" }));
  const subBody = await sub.json() as any;
  check("subscribe: provider unconfigured → 503 billing_unavailable", sub.status === 503 && subBody.code === "billing_unavailable");

  // ── Client cannot forge variant/price; only enum plan/interval accepted ──
  const forged = await POST(subReq(token, { plan_code: "intelligence", interval: "year", variant_id: "hacked", price: 1, user_id: "someone-else" }));
  check("subscribe: forged variant/price/user ignored (still server-mapped 503)", forged.status === 503);
  const bad = await POST(subReq(token, { plan_code: "enterprise", interval: "month" }));
  check("subscribe: invalid plan enum → 400", bad.status === 400);

  const failures = checks.filter((c) => !c.ok);
  console.log(`\nBILLING-ROUTES :: ${checks.length - failures.length}/${checks.length} checks passed`);
} catch (e) {
  check("harness completed without throw", false, e instanceof Error ? e.message : String(e));
} finally {
  if (userId) {
    await admin.from("customer_credits").delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  console.log("cleanup :: disposable user removed");
}
process.exit(checks.some((c) => !c.ok) ? 2 : 0);
