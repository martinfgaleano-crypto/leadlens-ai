// RUNTIME SCALE SAFETY V1 — atomic run-execution lease (Phase 1/2/4).
// Proves the initial queued run cannot be double-claimed: the Supabase claim advances the
// nested stage OUT of "queued" under a contains(stage:queued) guard, so a second concurrent
// claim's conditional update matches 0 rows. Modeled with a fake db that evaluates the
// UPDATE's WHERE against the LIVE row at execute time (PostgREST/Postgres semantics).

import assert from "node:assert/strict";
import { SupabaseIntelligenceRunStore } from "@/lib/intelligence/productive-spine-store";

let passed = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log(`ok - ${passed} ${name}`); };

// Minimal fake of the supabase-js query builder over ONE snapshot_reports row. The UPDATE's
// filters are evaluated against the current row when .select() executes — so a conditional
// update that changed the guarded field excludes a later concurrent update (atomic CAS).
function fakeDb(initial: any) {
  const row = { ...initial };
  const deepContains = (obj: any, sub: any): boolean =>
    Object.entries(sub).every(([k, v]) => v && typeof v === "object" ? deepContains(obj?.[k] ?? {}, v) : obj?.[k] === v);
  return {
    row,
    from() {
      const flt: Array<(r: any) => boolean> = [];
      let mode: "select" | "update" = "select";
      let patch: any = null;
      const qb: any = {
        select() { // terminal for update; passthrough for load chains
          if (mode === "update") {
            const match = row.job_id != null && flt.every((f) => f(row));
            if (!match) return Promise.resolve({ data: [], error: null });
            Object.assign(row, patch);
            return Promise.resolve({ data: [{ job_id: row.job_id }], error: null });
          }
          return qb;
        },
        update(p: any) { mode = "update"; patch = p; return qb; },
        eq(col: string, val: any) { flt.push((r) => r[col] === val); return qb; },
        in(col: string, vals: any[]) { flt.push((r) => vals.includes(r[col])); return qb; },
        contains(col: string, sub: any) { flt.push((r) => deepContains(r[col], sub)); return qb; },
        maybeSingle() { const ok = flt.every((f) => f(row)); return Promise.resolve({ data: ok ? { ...row } : null, error: null }); },
      };
      return qb;
    },
  };
}

const queuedRow = (runId: string, userId: string) => ({
  job_id: runId, user_id: userId, plan: "sample", status: "processing", created_at: "2026-08-30T00:00:00Z",
  report_json: { _intelligence_run: { kind: "productive_intelligence_spine_v1", contextRef: { contextId: "c", version: 1 }, stage: "queued", attempt: 1, createdAt: "2026-08-30T00:00:00Z", updatedAt: "2026-08-30T00:00:00Z", deliveryLimit: 2, researchLimit: 5, researchAudit: [] } },
});

const run = async () => {
  // A — two concurrent claims on the SAME queued run: exactly one succeeds.
  await t("A initial double-claim: exactly one concurrent claim wins", async () => {
    const db = fakeDb(queuedRow("intel_a", "u1"));
    const store = new SupabaseIntelligenceRunStore(db as never);
    const [c1, c2] = await Promise.all([
      store.claim("intel_a", "u1", ["processing"], false),
      store.claim("intel_a", "u1", ["processing"], false),
    ]);
    assert.equal([c1, c2].filter(Boolean).length, 1, "exactly one claim must win");
    assert.equal(db.row.report_json._intelligence_run.stage, "lead_hunter", "winning claim advanced stage out of queued");
  });

  // B — a second claim after the first already claimed is rejected (stage no longer queued).
  await t("B active claim blocks a later duplicate claim", async () => {
    const db = fakeDb(queuedRow("intel_b", "u1"));
    const store = new SupabaseIntelligenceRunStore(db as never);
    assert.equal(await store.claim("intel_b", "u1", ["processing"], false), true);
    assert.equal(await store.claim("intel_b", "u1", ["processing"], false), false);
  });

  // D — a completed run cannot be claimed.
  await t("D completed run is not claimable", async () => {
    const row = queuedRow("intel_d", "u1"); row.status = "completed"; row.report_json._intelligence_run.stage = "report";
    const store = new SupabaseIntelligenceRunStore(fakeDb(row) as never);
    assert.equal(await store.claim("intel_d", "u1", ["processing"], false), false);
  });

  // E — a failed run is claimable exactly once (atomic CAS on top-level status).
  await t("E failed run: one retry claim wins, a concurrent duplicate loses", async () => {
    const row = queuedRow("intel_e", "u1"); row.status = "failed";
    const db = fakeDb(row); const store = new SupabaseIntelligenceRunStore(db as never);
    const [r1, r2] = await Promise.all([
      store.claim("intel_e", "u1", ["failed"], false),
      store.claim("intel_e", "u1", ["failed"], false),
    ]);
    assert.equal([r1, r2].filter(Boolean).length, 1, "exactly one failed-retry claim wins");
  });

  // G — wrong owner cannot claim.
  await t("G cross-tenant claim rejected", async () => {
    const store = new SupabaseIntelligenceRunStore(fakeDb(queuedRow("intel_g", "u1")) as never);
    assert.equal(await store.claim("intel_g", "attacker", ["processing"], false), false);
  });

  console.log(`\n${passed} passed, 0 failed`);
};
run().catch((e) => { console.error(e); process.exit(1); });
