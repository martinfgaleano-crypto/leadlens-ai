// One-Time Credit Enforcement V1 — Model B (1 credit per valid company evaluation delivered).
// Deterministic acceptance of the canonical consumption contract against a fake Supabase that
// enforces the REAL constraints the production tables enforce:
//   • customer_credits.credit_balance CHECK (>= 0)      → oversell is impossible at the row.
//   • account_intelligence_charges UNIQUE(user, analysis_key, account_key) → insert-once idempotency.
// It exercises the ACTUAL production functions (claimOneTimeCredit, remainingAllowanceForRun,
// chargeMaterializedAccounts, intelligenceRunGate) — not mocks of them.

import { claimOneTimeCredit } from "../../lib/billing/usage-ledger";
import { remainingAllowanceForRun, chargeMaterializedAccounts } from "../../lib/billing/account-metering";
import { intelligenceRunGate, type EffectiveEntitlement } from "../../lib/entitlements/entitlements-v1";

let passed = 0, failed = 0;
const t = (n: string, ok: boolean) => { (ok ? passed++ : failed++); if (!ok) console.error(`FAIL: ${n}`); };

// ── Fake Supabase (the two commercial invariants above are enforced, nothing else) ──
type Row = Record<string, any>;
class Query {
  private mode: "read" | "insert" | "update" | "upsert" | null = null;
  private cols = "*"; private countHead = false; private single = false;
  private lim: number | null = null; private filters: Array<[string, any]> = [];
  private payload: Row | null = null; private patch: Row | null = null;
  private onConflict: string[] | null = null; private ignoreDup = false;
  constructor(private db: FakeDb, private table: string) {}
  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    if (this.mode === null) { this.mode = "read"; this.cols = cols; if (opts?.head) this.countHead = true; return this; }
    return this; // returning-clause after insert/update/upsert
  }
  insert(payload: Row) { this.mode = "insert"; this.payload = payload; return this; }
  update(patch: Row) { this.mode = "update"; this.patch = patch; return this; }
  upsert(payload: Row, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.mode = "upsert"; this.payload = payload;
    this.onConflict = opts?.onConflict ? opts.onConflict.split(",") : null; this.ignoreDup = !!opts?.ignoreDuplicates; return this;
  }
  eq(col: string, val: any) { this.filters.push([col, val]); return this; }
  order() { return this; }
  limit(n: number) { this.lim = n; return Promise.resolve(this._exec()); }
  maybeSingle() { this.single = true; return Promise.resolve(this._exec()); }
  then(onF: (v: any) => any, onR?: (e: any) => any) { try { return Promise.resolve(onF(this._exec())); } catch (e) { return onR ? Promise.resolve(onR(e)) : Promise.reject(e); } }
  private match(r: Row) { return this.filters.every(([c, v]) => r[c] === v); }
  private _exec(): any {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    if (this.mode === "insert") {
      const p = this.payload as Row;
      if (this.table === "account_intelligence_charges") {
        // Fault injection for ledger-failure tests: a forced throw (network) or non-dup error.
        const inject = this.db.injectChargeInsert; if (inject) { this.db.injectChargeInsert = null;
          if (inject === "throw") throw new Error("network"); return { data: null, error: { code: inject } }; }
        const dup = rows.some((r) => r.user_id === p.user_id && r.analysis_key === p.analysis_key && r.account_key === p.account_key);
        if (dup) return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      rows.push({ ...p }); return { data: [{ ...p }], error: null };
    }
    if (this.mode === "upsert") {
      const p = this.payload as Row; const keys = this.onConflict ?? [];
      const exists = rows.find((r) => keys.every((k) => r[k] === p[k]));
      if (exists) { if (!this.ignoreDup) Object.assign(exists, p); return { data: [exists], error: null }; }
      rows.push({ ...p }); return { data: [{ ...p }], error: null };
    }
    if (this.mode === "update") {
      const patch = this.patch as Row; const hit = rows.filter((r) => this.match(r));
      for (const r of hit) {
        // customer_credits CHECK (credit_balance >= 0): a violating update is rejected (no row changes).
        if (this.table === "customer_credits" && patch.credit_balance != null && Number(patch.credit_balance) < 0) return { data: [], error: { code: "23514" } };
        Object.assign(r, patch);
      }
      return { data: hit.map((r) => ({ ...r })), error: null };
    }
    // read
    const hit = rows.filter((r) => this.match(r));
    if (this.countHead) return { count: hit.length, data: null, error: null };
    if (this.single) return { data: hit[0] ? { ...hit[0] } : null, error: null };
    const out = this.lim != null ? hit.slice(0, this.lim) : hit;
    return { data: out.map((r) => ({ ...r })), error: null };
  }
}
class FakeDb {
  injectChargeInsert: string | null = null; // "throw" | "23505" | other error code — consumed once
  tables: Record<string, Row[]> = { customer_credits: [], account_intelligence_charges: [], credit_transactions: [], subscription_usage_periods: [], customer_subscriptions: [] };
  from(table: string) { return new Query(this, table); }
  grant(userId: string, amount: number) { this.tables.customer_credits.push({ user_id: userId, credit_balance: amount, lifetime_credits: amount }); }
  balance(userId: string) { const r = this.tables.customer_credits.find((x) => x.user_id === userId); return r ? Number(r.credit_balance) : 0; }
  charges(userId: string) { return this.tables.account_intelligence_charges.filter((x) => x.user_id === userId); }
  consumeTxns(userId: string) { return this.tables.credit_transactions.filter((x) => x.user_id === userId && x.type === "consume"); }
}

const oneTime = (userId: string, credits: number): EffectiveEntitlement => ({
  userId, planCode: "sample", tier: "preview", accessSource: "one_time",
  capabilities: { can_run_intelligence: true, can_create_monitor: true, can_run_monitor: true },
  limits: { max_runs_per_period: null, max_active_monitors: 0, cadence_min_days: null },
  usage: { credits_remaining: credits, metering: "one_time" }, blocked_reason: null,
});

async function run() {
  // ── A. claimOneTimeCredit — first two valid evaluations consume exactly one credit each ──
  { const db = new FakeDb(); db.grant("u1", 2);
    const r1 = await claimOneTimeCredit(db as any, { userId: "u1", accountKey: "acme", analysisKey: "run1", runId: "run1" });
    t("A1 first evaluation charged", r1.charged === true && db.balance("u1") === 1);
    const r2 = await claimOneTimeCredit(db as any, { userId: "u1", accountKey: "globex", analysisKey: "run1", runId: "run1" });
    t("A2 second evaluation charged → balance 0", r2.charged === true && db.balance("u1") === 0);
    t("A3 two consume transactions recorded", db.consumeTxns("u1").length === 2);
    // ── Third evaluation at balance 0 → exhausted, never negative, no charge row ──
    const r3 = await claimOneTimeCredit(db as any, { userId: "u1", accountKey: "initech", analysisKey: "run1", runId: "run1" });
    t("A4 third evaluation exhausted (no charge)", r3.charged === false && r3.reason === "exhausted");
    t("A5 balance stays 0 (never negative)", db.balance("u1") === 0 && db.charges("u1").length === 2);
  }

  // ── B. Idempotency — retry of the SAME logical evaluation is a 0-cost no-op ──
  { const db = new FakeDb(); db.grant("u2", 2);
    await claimOneTimeCredit(db as any, { userId: "u2", accountKey: "acme", analysisKey: "run1", runId: "run1" });
    const dup = await claimOneTimeCredit(db as any, { userId: "u2", accountKey: "acme", analysisKey: "run1", runId: "run1" });
    t("B1 duplicate → alreadyCharged, no extra debit", dup.alreadyCharged === true && db.balance("u2") === 1 && db.charges("u2").length === 1);
    // A NEW logical analysis (new runId) of the same account charges again (legitimate re-purchase).
    const re = await claimOneTimeCredit(db as any, { userId: "u2", accountKey: "acme", analysisKey: "run2", runId: "run2" });
    t("B2 new analysis_key of same account charges again", re.charged === true && db.balance("u2") === 0);
  }

  // ── C. chargeMaterializedAccounts (one_time) — per-company charge, allowance-bounded ──
  { const db = new FakeDb(); db.grant("u3", 2);
    const r = await chargeMaterializedAccounts(db as any, oneTime("u3", 2), { runId: "run1" }, ["a", "b", "c"]);
    t("C1 two charged, one exhausted (budget-bounded)", r.metered && r.charged.length === 2 && r.exhausted.length === 1);
    t("C2 balance 0, exactly two charge rows", db.balance("u3") === 0 && db.charges("u3").length === 2);
    // Replay the same run+accounts (recovery/duplicate completion) → all alreadyCharged, no debit.
    const replay = await chargeMaterializedAccounts(db as any, oneTime("u3", 0), { runId: "run1" }, ["a", "b", "c"]);
    t("C3 replay → no extra debit, balance unchanged", replay.already.length === 2 && db.balance("u3") === 0 && db.charges("u3").length === 2);
  }

  // ── D. remainingAllowanceForRun (one_time) — cap = balance (+ own prior charges for recovery) ──
  { const db = new FakeDb(); db.grant("u4", 2);
    const cap0 = await remainingAllowanceForRun(db as any, oneTime("u4", 2), Date.now());
    t("D1 uncharged run cap = balance (2)", cap0 === 2);
    await chargeMaterializedAccounts(db as any, oneTime("u4", 2), { runId: "run1" }, ["a"]);      // spend 1 (balance 1)
    const capRecover = await remainingAllowanceForRun(db as any, oneTime("u4", 1), Date.now(), "run1");
    t("D2 recovery re-run reads balance + own prior charges (1+1=2)", capRecover === 2);
    const capOther = await remainingAllowanceForRun(db as any, oneTime("u4", 1), Date.now(), "run2");
    t("D3 a DIFFERENT run sees only the live balance (1)", capOther === 1);
  }

  // ── E. Concurrency — one credit, two distinct companies → at most one crosses ──
  { const db = new FakeDb(); db.grant("u5", 1);
    const [x, y] = await Promise.all([
      claimOneTimeCredit(db as any, { userId: "u5", accountKey: "a", analysisKey: "run1", runId: "run1" }),
      claimOneTimeCredit(db as any, { userId: "u5", accountKey: "b", analysisKey: "run1", runId: "run1" }),
    ]);
    const charged = [x, y].filter((r) => r.charged).length;
    t("E1 exactly one concurrent claim charged (no oversell)", charged === 1);
    t("E2 balance 0, never negative, one charge row", db.balance("u5") === 0 && db.charges("u5").length === 1);
  }

  // ── F. Concurrency — duplicate same company → exactly one net debit (loser refunds) ──
  { const db = new FakeDb(); db.grant("u6", 2);
    const [x, y] = await Promise.all([
      claimOneTimeCredit(db as any, { userId: "u6", accountKey: "a", analysisKey: "run1", runId: "run1" }),
      claimOneTimeCredit(db as any, { userId: "u6", accountKey: "a", analysisKey: "run1", runId: "run1" }),
    ]);
    t("F1 exactly one net charge for the same evaluation", db.charges("u6").length === 1);
    t("F2 exactly one credit net consumed (balance 1)", db.balance("u6") === 1 && [x, y].filter((r) => r.charged).length === 1);
  }

  // ── G. Failed generation — a failed account is simply never passed in → no charge ──
  { const db = new FakeDb(); db.grant("u7", 1);
    const r = await chargeMaterializedAccounts(db as any, oneTime("u7", 1), { runId: "run1" }, ["ok"]); // "failed" account excluded upstream
    t("G1 only the materialized account charged", r.charged.length === 1 && db.balance("u7") === 0);
    // Later a genuine retry that materializes a NEW account under a NEW run charges exactly once.
    db.grant("u7b", 1);
    const r2 = await chargeMaterializedAccounts(db as any, oneTime("u7b", 1), { runId: "run9" }, ["ok2"]);
    t("G2 post-failure retry charges exactly once", r2.charged.length === 1 && db.balance("u7b") === 0);
  }

  // ── J. Concurrent RUNS (distinct runIds) share one credit → exactly one authorizes delivery ──
  // This is the set the spine's delivery-gate consumes: the loser authorizes zero accounts and the
  // spine drops them, so two simultaneous runs never deliver more than the customer owns.
  { const db = new FakeDb(); db.grant("u9", 1);
    const [ra, rb] = await Promise.all([
      chargeMaterializedAccounts(db as any, oneTime("u9", 1), { runId: "runA" }, ["x"]),
      chargeMaterializedAccounts(db as any, oneTime("u9", 1), { runId: "runB" }, ["y"]),
    ]);
    const authA = [...ra.charged, ...ra.already].length, authB = [...rb.charged, ...rb.already].length;
    t("J1 exactly one concurrent run authorized a delivery", (authA === 1) !== (authB === 1));
    t("J2 the losing run authorized zero accounts (delivers nothing)", authA === 0 || authB === 0);
    t("J3 one credit spent, one charge row, never negative", db.balance("u9") === 0 && db.charges("u9").length === 1);
  }

  // ── H. Run gate — one-time exhaustion blocks NEW billable work; positive balance allows ──
  { t("H1 one_time 0 credits → 402 usage_limit_reached", intelligenceRunGate(oneTime("g1", 0))?.code === "usage_limit_reached");
    t("H2 one_time 2 credits → allowed", intelligenceRunGate(oneTime("g2", 2)) === null);
    // Beta is a SEPARATE metered source — the one-time branch must not touch it.
    const beta: EffectiveEntitlement = { ...oneTime("g3", 0), accessSource: "beta", tier: null, planCode: "free",
      limits: { max_runs_per_period: 10, max_active_monitors: 5, cadence_min_days: 14 }, usage: { credits_remaining: 10, metering: "ledger" } };
    t("H3 beta with allowance → allowed (not blocked by one-time branch)", intelligenceRunGate(beta) === null);
    const betaExhausted = { ...beta, usage: { credits_remaining: 0, metering: "ledger" as const } };
    t("H4 beta exhausted → blocked by its own period limit", intelligenceRunGate(betaExhausted)?.code === "usage_limit_reached");
    const internal: EffectiveEntitlement = { ...oneTime("g4", 0), accessSource: "internal", usage: { credits_remaining: 0, metering: "unlimited" } };
    t("H5 internal → never blocked", intelligenceRunGate(internal) === null);
  }

  // ── L. Ledger-failure safety (pre-merge safety gate) — NEVER authorize without a durable charge ──
  { // Non-duplicate insert error → UNAVAILABLE (not authorized), credit RELEASED, no charge row.
    const db = new FakeDb(); db.grant("uL1", 2); db.injectChargeInsert = "08006"; // connection error code
    const r = await claimOneTimeCredit(db as any, { userId: "uL1", accountKey: "a", analysisKey: "run1", runId: "run1" });
    t("L1 non-dup insert error → unavailable, NOT alreadyCharged", r.charged === false && r.alreadyCharged !== true && r.reason === "unavailable");
    t("L1 credit released (balance restored), no charge row", db.balance("uL1") === 2 && db.charges("uL1").length === 0);
  }
  { // Insert THROWS after the reserving decrement → released, unavailable, no stranded credit.
    const db = new FakeDb(); db.grant("uL2", 2); db.injectChargeInsert = "throw";
    const r = await claimOneTimeCredit(db as any, { userId: "uL2", accountKey: "a", analysisKey: "run1", runId: "run1" });
    t("L2 insert throw → unavailable, credit not stranded", r.reason === "unavailable" && db.balance("uL2") === 2 && db.charges("uL2").length === 0);
  }
  { // A genuine UNIQUE(23505) violation (concurrent same evaluation) → alreadyCharged (authorized).
    const db = new FakeDb(); db.grant("uL3", 2);
    db.tables.account_intelligence_charges.push({ user_id: "uL3", analysis_key: "run1", account_key: "a", period_start: "x" }); // a concurrent claim already recorded it
    const r = await claimOneTimeCredit(db as any, { userId: "uL3", accountKey: "a", analysisKey: "run1", runId: "run1" });
    t("L3 true duplicate → alreadyCharged (authorized, no new debit)", r.alreadyCharged === true && db.balance("uL3") === 2 && db.charges("uL3").length === 1);
  }
  { // chargeMaterializedAccounts surfaces `unavailable` so the caller can fail-closed + recoverable.
    const db = new FakeDb(); db.grant("uL4", 2); db.injectChargeInsert = "08006";
    const r = await chargeMaterializedAccounts(db as any, oneTime("uL4", 2), { runId: "run1" }, ["a"]);
    t("L4 ledger error → account reported UNAVAILABLE (not charged, not exhausted)", r.unavailable.length === 1 && r.charged.length === 0 && r.exhausted.length === 0);
    t("L4 no unpaid authorization: charged∪already is empty", [...r.charged, ...r.already].length === 0 && db.balance("uL4") === 2);
  }

  // ── K. Tier-agnostic enforcement — Brief 6 / Portfolio 12 / Premium 18 (§16/§45) ──
  // The same seam enforces every one-time allowance from the server-resolved grant: exactly `grant`
  // charged when `grant` materialize; the allowance cannot be exceeded; balance reconciles to 0.
  for (const { tier, grant } of [{ tier: "brief", grant: 6 }, { tier: "portfolio", grant: 12 }, { tier: "premium", grant: 18 }]) {
    const db = new FakeDb(); const u = `u_${tier}`; db.grant(u, grant);
    // Offer more materialized accounts than the allowance → charge exactly `grant`, rest exhausted.
    const accts = Array.from({ length: grant + 2 }, (_, i) => `${tier}_a${i}`);
    const r = await chargeMaterializedAccounts(db as any, oneTime(u, grant), { runId: `run_${tier}` }, accts);
    t(`K ${tier}: exactly ${grant} charged, 2 exhausted (allowance not exceeded)`, r.charged.length === grant && r.exhausted.length === 2);
    t(`K ${tier}: balance 0, ${grant} charge rows`, db.balance(u) === 0 && db.charges(u).length === grant);
    t(`K ${tier}: exhausted customer blocked from a new run`, intelligenceRunGate(oneTime(u, 0))?.code === "usage_limit_reached");
  }

  // ── I. Subscription non-regression — the one-time bucket (customer_credits) is NOT touched ──
  { const db = new FakeDb(); db.grant("u8", 5); // customer holds one-time credits AND a subscription
    const sub: EffectiveEntitlement = { userId: "u8", planCode: "monitor", tier: null, accessSource: "subscription",
      capabilities: { can_run_intelligence: true, can_create_monitor: true, can_run_monitor: true },
      limits: { max_runs_per_period: 30, max_active_monitors: 20, cadence_min_days: 14 },
      usage: { credits_remaining: 30, metering: "ledger" }, blocked_reason: null };
    const cap = await remainingAllowanceForRun(db as any, sub, Date.now(), "runS");
    await chargeMaterializedAccounts(db as any, sub, { runId: "runS" }, ["a", "b"]);
    t("I1 subscription run does NOT draw down one-time credits", db.balance("u8") === 5);
    t("I2 subscription cap is period-derived, not the credit balance", cap !== 5);
    // Internal is uncapped even with credits present (proves one-time balance not used for internal).
    const capInt = await remainingAllowanceForRun(db as any, { ...sub, accessSource: "internal", planCode: "internal" }, Date.now(), "runI");
    t("I3 internal → uncapped (null)", capInt === null);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
run().catch((e) => { console.error(e); process.exit(1); });
