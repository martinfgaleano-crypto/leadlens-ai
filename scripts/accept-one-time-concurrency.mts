#!/usr/bin/env node
/**
 * One-Time Credit Enforcement — LIVE concurrency proof against REAL Supabase atomicity (§24).
 * Exercises the actual Postgres optimistic-CAS decrement (customer_credits.credit_balance, CHECK>=0)
 * and the account_intelligence_charges UNIQUE constraint under genuinely concurrent claims — not a
 * sequential mock. No providers, no pipeline (fast, ~$0). Disposable + self-cleaning.
 */
import { loadEnv, has } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [k, v] of Object.entries(env)) if (typeof v === "string") process.env[k] = v;
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (!has(env, key)) { console.error(`BLOCKED: ${key} missing`); process.exit(3); }

const { createServerClient } = await import("@/lib/supabase/server");
const { claimOneTimeCredit } = await import("@/lib/billing/usage-ledger");
const { chargeMaterializedAccounts } = await import("@/lib/billing/account-metering");
const db = createServerClient();
const stamp = Date.now();
const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
const check = (n: string, ok: boolean, d?: string) => { checks.push({ name: n, ok, detail: d }); console.log(`${ok ? "ok" : "FAIL"} - ${n}${d ? ` :: ${d}` : ""}`); };
const balanceOf = async (u: string) => { const { data } = await db.from("customer_credits").select("credit_balance").eq("user_id", u).maybeSingle(); return data ? Number(data.credit_balance) : 0; };
const chargesOf = async (u: string) => (await db.from("account_intelligence_charges").select("id").eq("user_id", u)).data ?? [];
const oneTime = (userId: string, credits: number) => ({ userId, planCode: "sample", tier: "preview", accessSource: "one_time" as const,
  capabilities: { can_run_intelligence: true, can_create_monitor: true, can_run_monitor: true },
  limits: { max_runs_per_period: null, max_active_monitors: 0, cadence_min_days: null },
  usage: { credits_remaining: credits, metering: "one_time" as const }, blocked_reason: null });

const users: string[] = [];
async function mkUser() {
  const created = await db.auth.admin.createUser({ email: `ll-conc-${stamp}-${users.length}@example.com`, password: `C-${stamp}-Aa!`, email_confirm: true });
  const uid = created.data.user!.id; users.push(uid);
  await db.from("profiles").insert({ id: uid, email: `ll-conc-${stamp}-${users.length}@example.com`, plan: "sample" }).then(() => {}, () => {});
  return uid;
}

try {
  // ── A. Distinct accounts, same run, 1 credit, N concurrent claims → exactly one charges ──
  { const u = await mkUser();
    await db.from("customer_credits").update({ credit_balance: 1, lifetime_credits: 1 }).eq("user_id", u);
    const N = 6;
    const results = await Promise.all(Array.from({ length: N }, (_, i) => claimOneTimeCredit(db, { userId: u, accountKey: `acct_${i}`, analysisKey: "runA", runId: "runA" })));
    const charged = results.filter((r) => r.charged).length;
    check("A concurrent distinct-account claims → exactly one charged", charged === 1, `charged=${charged}/${N}`);
    check("A real-DB balance 0, one charge row, never negative", (await balanceOf(u)) === 0 && (await chargesOf(u)).length === 1);
  }

  // ── B. Same account duplicate concurrent claims (balance 3) → exactly one net debit ──
  { const u = await mkUser();
    await db.from("customer_credits").update({ credit_balance: 3, lifetime_credits: 3 }).eq("user_id", u);
    const results = await Promise.all(Array.from({ length: 5 }, () => claimOneTimeCredit(db, { userId: u, accountKey: "same", analysisKey: "runB", runId: "runB" })));
    check("B duplicate same evaluation → exactly one net charge row", (await chargesOf(u)).length === 1);
    check("B exactly one credit consumed (balance 2), never oversell", (await balanceOf(u)) === 2 && results.filter((r) => r.charged).length === 1);
  }

  // ── C. Concurrent distinct RUNS share one credit → exactly one authorizes delivery ──
  { const u = await mkUser();
    await db.from("customer_credits").update({ credit_balance: 1, lifetime_credits: 1 }).eq("user_id", u);
    const [ra, rb] = await Promise.all([
      chargeMaterializedAccounts(db, oneTime(u, 1), { runId: "runC1" }, ["x"]),
      chargeMaterializedAccounts(db, oneTime(u, 1), { runId: "runC2" }, ["y"]),
    ]);
    const authA = [...ra.charged, ...ra.already].length, authB = [...rb.charged, ...rb.already].length;
    check("C exactly one concurrent run authorized a delivery", (authA === 1) !== (authB === 1), `authA=${authA} authB=${authB}`);
    check("C the other authorized zero (spine drops → no free delivery)", authA === 0 || authB === 0);
    check("C one credit spent, one charge row, never negative", (await balanceOf(u)) === 0 && (await chargesOf(u)).length === 1);
  }

  // ── D. Two credits, three concurrent distinct runs → at most two authorized ──
  { const u = await mkUser();
    await db.from("customer_credits").update({ credit_balance: 2, lifetime_credits: 2 }).eq("user_id", u);
    const rs = await Promise.all(["r1", "r2", "r3"].map((rid) => chargeMaterializedAccounts(db, oneTime(u, 2), { runId: rid }, [`a_${rid}`])));
    const authorizedRuns = rs.filter((r) => [...r.charged, ...r.already].length === 1).length;
    check("D three runs / two credits → at most two authorized", authorizedRuns === 2, `authorized=${authorizedRuns}`);
    check("D two credits spent, two charge rows, never negative", (await balanceOf(u)) === 0 && (await chargesOf(u)).length === 2);
  }

  // ── E. Tenant isolation — one customer's concurrent claims never touch another ──
  { const u1 = await mkUser(), u2 = await mkUser();
    await db.from("customer_credits").update({ credit_balance: 1, lifetime_credits: 1 }).eq("user_id", u1);
    await db.from("customer_credits").update({ credit_balance: 1, lifetime_credits: 1 }).eq("user_id", u2);
    await Promise.all([
      claimOneTimeCredit(db, { userId: u1, accountKey: "z", analysisKey: "rz", runId: "rz" }),
      claimOneTimeCredit(db, { userId: u2, accountKey: "z", analysisKey: "rz", runId: "rz" }),
    ]);
    check("E each tenant charged independently (no cross-tenant debit)", (await balanceOf(u1)) === 0 && (await balanceOf(u2)) === 0 && (await chargesOf(u1)).length === 1 && (await chargesOf(u2)).length === 1);
  }
} finally {
  for (const id of users) {
    await db.from("account_intelligence_charges").delete().eq("user_id", id);
    await db.from("credit_transactions").delete().eq("user_id", id);
    await db.from("customer_credits").delete().eq("user_id", id);
    await db.auth.admin.deleteUser(id).catch(() => undefined);
  }
  console.log("cleanup :: disposable users removed");
}

const failures = checks.filter((c) => !c.ok);
console.log(`\nCONCURRENCY ACCEPTANCE :: ${checks.length - failures.length}/${checks.length} checks passed`);
process.exit(failures.length ? 2 : 0);
