#!/usr/bin/env node
/**
 * Disposable REAL Entitlements V1 acceptance. Proves server-authoritative capability gating
 * on the primary Intelligence run route + race-safe atomic usage consumption, with zero
 * founder/admin/manual-DB action beyond disposable-user setup. No productive Intelligence is
 * executed (created runs are enqueued-only and deleted) → no provider cost.
 */
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { loadEnv, has } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"])
  if (!has(env, k)) { console.error(`BLOCKED: ${k} missing`); process.exit(3); }

const { createServerClient } = await import("@/lib/supabase/server");
const { POST: interpret } = await import("@/app/api/interpret/route");
const { POST: confirm } = await import("@/app/api/customer/contexts/confirm/route");
const { POST: startRun } = await import("@/app/api/customer/intelligence-runs/route");
const { resolveEntitlements, consumeRunSlotAtomic } = await import("@/lib/entitlements/entitlements-v1");

const db = createServerClient();
if (!db) { console.error("BLOCKED"); process.exit(3); }
const stamp = Date.now();
const email = `ll-ent-${stamp}@example.com`, password = `En-${stamp}-Aa!`, contextId = `ent_ctx_${stamp}`;
const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (n: string, ok: boolean, d?: string) => { checks.push({ name: n, ok, detail: d }); console.log(`${ok ? "ok" : "FAIL"} - ${n}${d ? ` :: ${d}` : ""}`); };
let userId: string | null = null, token = "";
const req = (u: string, tk: string, b?: unknown) => new NextRequest(`http://localhost${u}`, { method: b === undefined ? "GET" : "POST", headers: { ...(b === undefined ? {} : { "content-type": "application/json" }), Authorization: `Bearer ${tk}` }, ...(b === undefined ? {} : { body: JSON.stringify(b) }) });
const runsFor = async () => (await db.from("snapshot_reports").select("job_id").eq("user_id", userId!)).data ?? [];

try {
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  userId = created.data.user!.id;
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  token = (await anon.auth.signInWithPassword({ email, password })).data.session!.access_token;
  await db.from("profiles").upsert({ id: userId, email, plan: "free" }, { onConflict: "id" });
  // Zero any signup-granted credits so this asserts the PURE beta path (free + 0 credits).
  await db.from("customer_credits").upsert({ user_id: userId, credit_balance: 0, lifetime_credits: 0 }, { onConflict: "user_id" });

  // ── Resolver: default free customer with no credits = Limited Beta (open for intelligence) ──
  const e1 = await resolveEntitlements(db, userId!);
  check("resolver: free/0-credit customer → beta access, can_run_intelligence", e1.accessSource === "beta" && e1.capabilities.can_run_intelligence, `${e1.accessSource}`);

  // ── Live route gate: beta user ALLOWED (run created), then cleaned up ──
  const ib = await (await interpret(req("/api/interpret", token, { input: "We sell packaging equipment to US food manufacturers with owned plants that recently expanded.", locale: "en" }))).json() as { confirmation_token?: string };
  const cb = await (await confirm(req("/api/customer/contexts/confirm", token, { confirmation_token: ib.confirmation_token, context_id: contextId }))).json() as { context?: { version: number } };
  const allowedRes = await startRun(req("/api/customer/intelligence-runs", token, { context_id: contextId, version: cb.context!.version, plan: "sample" }));
  check("route gate: beta user ALLOWED to start a run", [200, 202].includes(allowedRes.status), `HTTP ${allowedRes.status}`);
  const afterAllowed = await runsFor();

  // ── Live route gate: BLOCKED user DENIED, no run created ──
  await db.from("profiles").update({ plan: "blocked" }).eq("id", userId!);
  const e2 = await resolveEntitlements(db, userId!);
  check("resolver: blocked plan → access none, cannot run", e2.accessSource === "none" && !e2.capabilities.can_run_intelligence);
  const deniedRes = await startRun(req("/api/customer/intelligence-runs", token, { context_id: contextId, version: cb.context!.version, plan: "sample", idempotency_key: `blocked_${stamp}` }));
  const deniedBody = await deniedRes.json() as { code?: string };
  check("route gate: blocked user DENIED (403 access_not_enabled)", deniedRes.status === 403 && deniedBody.code === "access_not_enabled", `HTTP ${deniedRes.status} ${deniedBody.code}`);
  const afterDenied = await runsFor();
  check("no partial run created after denial", afterDenied.length === afterAllowed.length, `before=${afterAllowed.length} after=${afterDenied.length}`);
  await db.from("profiles").update({ plan: "free" }).eq("id", userId!);

  // ── Atomic race-safe consumption on existing customer_credits (2 slots, 3 concurrent) ──
  await db.from("customer_credits").upsert({ user_id: userId, credit_balance: 2, lifetime_credits: 2 }, { onConflict: "user_id" });
  const results = await Promise.all([consumeRunSlotAtomic(db, userId!), consumeRunSlotAtomic(db, userId!), consumeRunSlotAtomic(db, userId!)]);
  const oks = results.filter((r) => r.ok).length;
  const finalBal = (await db.from("customer_credits").select("credit_balance").eq("user_id", userId!).maybeSingle()).data?.credit_balance;
  check("atomic consumption: exactly 2 of 3 concurrent final-slot requests succeed", oks === 2, `oks=${oks}`);
  check("atomic consumption: balance floored at 0 (no oversell)", finalBal === 0, `balance=${finalBal}`);
  const denied = await consumeRunSlotAtomic(db, userId!);
  check("atomic consumption: further consume denied (insufficient)", !denied.ok && denied.reason === "insufficient");

  // ── Tenant isolation: resolver is user-scoped ──
  const other = await db.auth.admin.createUser({ email: `ll-ent-b-${stamp}@example.com`, password, email_confirm: true });
  await db.from("profiles").upsert({ id: other.data.user!.id, email: `ll-ent-b-${stamp}@example.com`, plan: "starter" }, { onConflict: "id" });
  const eOther = await resolveEntitlements(db, other.data.user!.id);
  const eMine = await resolveEntitlements(db, userId!);
  check("tenant isolation: each user resolves their OWN plan", eOther.accessSource === "one_time" && eMine.planCode === "free");
  await db.from("profiles").delete().eq("id", other.data.user!.id);
  await db.auth.admin.deleteUser(other.data.user!.id).catch(() => {});

  const failures = checks.filter((c) => !c.ok);
  console.log(`\nENTITLEMENTS-V1 :: ${checks.length - failures.length}/${checks.length} checks passed`);
} catch (e) {
  check("harness completed without throw", false, e instanceof Error ? e.message : String(e));
} finally {
  if (userId) {
    await db.from("credit_transactions").delete().eq("user_id", userId);
    await db.from("customer_credits").delete().eq("user_id", userId);
    await db.from("snapshot_reports").delete().eq("user_id", userId);
    await db.from("confirmed_commercial_contexts").delete().eq("user_id", userId);
    await db.from("profiles").delete().eq("id", userId);
    await db.auth.admin.deleteUser(userId).catch(() => {});
  }
  console.log("cleanup :: disposable users removed");
}
process.exit(checks.some((c) => !c.ok) ? 2 : 0);
