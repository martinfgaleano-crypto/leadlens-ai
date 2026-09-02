#!/usr/bin/env node
// Disposable REAL acceptance for the admin customer-lookup ops surface (SaaS Operations V1).
import { NextRequest } from "next/server";
import { loadEnv, has } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_SECRET_TOKEN"])
  if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }
const { createServerClient } = await import("@/lib/supabase/server");
const { GET } = await import("@/app/api/admin/customer-lookup/route");
const db = createServerClient()!;
const stamp = Date.now();
const email = `ll-look-${stamp}@example.com`;
const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (n: string, ok: boolean, d?: string) => { checks.push({ name: n, ok, detail: d }); console.log(`${ok ? "ok" : "FAIL"} - ${n}${d ? ` :: ${d}` : ""}`); };
let userId: string | null = null;
const adminReq = (qs: string, withAdmin: boolean) => new NextRequest(`http://localhost/api/admin/customer-lookup?${qs}`, { headers: withAdmin ? { "x-admin-token": process.env.ADMIN_SECRET_TOKEN! } : {} });

try {
  userId = (await db.auth.admin.createUser({ email, password: `Lk-${stamp}-Aa!`, email_confirm: true })).data.user!.id;
  await db.from("profiles").upsert({ id: userId, email, plan: "starter" }, { onConflict: "id" });
  await db.from("customer_credits").upsert({ user_id: userId, credit_balance: 3, lifetime_credits: 3 }, { onConflict: "user_id" });

  const denied = await GET(adminReq(`user_id=${userId}`, false));
  check("non-admin request is denied", denied.status === 401 || denied.status === 403, `HTTP ${denied.status}`);

  const res = await GET(adminReq(`user_id=${userId}`, true));
  check("admin lookup returns 200", res.status === 200, `HTTP ${res.status}`);
  const body = await res.json() as any;
  check("resolves the requested customer only (tenant-scoped)", body.found && body.customer?.user_id === userId);
  check("entitlement view present (access source + capability)", Boolean(body.entitlement?.access_source) && typeof body.entitlement?.can_run_intelligence === "boolean");
  check("usage present", typeof body.usage?.credits_remaining === "number" && body.usage.credits_remaining === 3);
  check("intelligence + monitor + flags sections present", Array.isArray(body.intelligence?.recent_runs) && typeof body.monitor?.monitored_accounts === "number" && Array.isArray(body.flags));
  const raw = JSON.stringify(body);
  check("no secrets / provider payloads / service-role leaked", !/service_role|SUPABASE_SERVICE|x-signature|raw_payload|SECRET|password/i.test(raw));

  const missing = await GET(adminReq(`user_id=00000000-0000-0000-0000-000000000000`, true));
  check("unknown customer → found:false (safe)", missing.status === 200 && (await missing.json()).found === false);

  const failures = checks.filter((c) => !c.ok);
  console.log(`\nCUSTOMER-LOOKUP :: ${checks.length - failures.length}/${checks.length} checks passed`);
} catch (e) {
  check("harness completed without throw", false, e instanceof Error ? e.message : String(e));
} finally {
  if (userId) {
    await db.from("customer_credits").delete().eq("user_id", userId);
    await db.from("profiles").delete().eq("id", userId);
    await db.auth.admin.deleteUser(userId).catch(() => {});
  }
  console.log("cleanup :: disposable user removed");
}
process.exit(checks.some((c) => !c.ok) ? 2 : 0);
