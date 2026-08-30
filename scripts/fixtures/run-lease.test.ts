// RUNTIME SCALE SAFETY V1 — atomic run lease + execution-generation fencing.
// Proves: (1) the initial queued run cannot be double-claimed; (2) stale reclaim is an
// atomic generation bump; (3) a stale (superseded) executor's authoritative writes are
// fenced out (no-op) so it cannot overwrite a newer attempt. Modeled with a fake db that
// evaluates each UPDATE's WHERE against the LIVE row at execute time (Postgres CAS semantics),
// including the top-level execution_generation column (migration 058).

import assert from "node:assert/strict";
import { SupabaseIntelligenceRunStore, type IntelligenceRunRecord } from "@/lib/intelligence/productive-spine-store";

let passed = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log(`ok - ${passed} ${name}`); };

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
        select() {
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

const rowFor = (runId: string, userId: string, over: any = {}) => ({
  job_id: runId, user_id: userId, plan: "sample", status: "processing", created_at: "2026-08-30T00:00:00Z",
  execution_generation: 0,
  report_json: { _intelligence_run: { kind: "productive_intelligence_spine_v1", contextRef: { contextId: "c", version: 1 }, stage: "queued", attempt: 1, createdAt: "2026-08-30T00:00:00Z", updatedAt: "2026-08-30T00:00:00Z", deliveryLimit: 2, researchLimit: 5, researchAudit: [] } },
  ...over,
});

const run = async () => {
  // A — two concurrent claims on the SAME queued run: exactly one wins (generation CAS).
  await t("A initial double-claim: exactly one concurrent claim wins", async () => {
    const db = fakeDb(rowFor("intel_a", "u1"));
    const store = new SupabaseIntelligenceRunStore(db as never);
    const [g1, g2] = await Promise.all([
      store.claim("intel_a", "u1", ["processing"], false),
      store.claim("intel_a", "u1", ["processing"], false),
    ]);
    assert.equal([g1, g2].filter((g) => g !== null).length, 1, "exactly one claim returns a generation");
    assert.equal(db.row.execution_generation, 1, "winning claim advanced generation to 1");
    assert.equal(db.row.report_json._intelligence_run.stage, "lead_hunter", "stage advanced out of queued");
  });

  // B — a later duplicate claim is rejected (generation already advanced).
  await t("B active claim blocks a later duplicate claim", async () => {
    const db = fakeDb(rowFor("intel_b", "u1"));
    const store = new SupabaseIntelligenceRunStore(db as never);
    assert.equal(await store.claim("intel_b", "u1", ["processing"], false), 1);
    assert.equal(await store.claim("intel_b", "u1", ["processing"], false), null);
  });

  // D — a completed run cannot be claimed.
  await t("D completed run is not claimable", async () => {
    const store = new SupabaseIntelligenceRunStore(fakeDb(rowFor("intel_d", "u1", { status: "completed" })) as never);
    assert.equal(await store.claim("intel_d", "u1", ["processing"], false), null);
  });

  // E — a failed run: exactly one concurrent retry claim wins (generation CAS).
  await t("E failed run: one retry claim wins", async () => {
    const db = fakeDb(rowFor("intel_e", "u1", { status: "failed" }));
    const store = new SupabaseIntelligenceRunStore(db as never);
    const [r1, r2] = await Promise.all([
      store.claim("intel_e", "u1", ["failed"], false),
      store.claim("intel_e", "u1", ["failed"], false),
    ]);
    assert.equal([r1, r2].filter((g) => g !== null).length, 1);
  });

  // G — wrong owner cannot claim.
  await t("G cross-tenant claim rejected", async () => {
    const store = new SupabaseIntelligenceRunStore(fakeDb(rowFor("intel_g", "u1")) as never);
    assert.equal(await store.claim("intel_g", "attacker", ["processing"], false), null);
  });

  // STALE RECLAIM — two concurrent stale reclaimers: exactly one advances the generation.
  await t("stale reclaim is atomic: exactly one concurrent reclaimer wins", async () => {
    const db = fakeDb(rowFor("intel_s", "u1", { status: "processing", execution_generation: 3, report_json: { _intelligence_run: { ...rowFor("x","x").report_json._intelligence_run, stage: "research" } } }));
    const store = new SupabaseIntelligenceRunStore(db as never);
    const [a, b] = await Promise.all([
      store.claim("intel_s", "u1", ["processing"], true),
      store.claim("intel_s", "u1", ["processing"], true),
    ]);
    assert.equal([a, b].filter((g) => g !== null).length, 1, "exactly one stale reclaimer wins");
    assert.equal(db.row.execution_generation, 4);
  });

  // LATE WRITER (mandatory) — gen 1 claims, gen 2 reclaims, gen 1 resumes and its fenced
  // save is a no-op; gen 2's save succeeds; final generation is 2.
  await t("late-writer: superseded executor's save is fenced (no-op), current executor's save wins", async () => {
    const db = fakeDb(rowFor("intel_lw", "u1"));
    const store = new SupabaseIntelligenceRunStore(db as never);
    const gen1 = await store.claim("intel_lw", "u1", ["processing"], false); // -> 1
    assert.equal(gen1, 1);
    const recGen1 = (await store.load("intel_lw", "u1"))!;              // executionGeneration = 1
    const gen2 = await store.claim("intel_lw", "u1", ["processing"], true); // stale reclaim -> 2
    assert.equal(gen2, 2);
    const recGen2 = (await store.load("intel_lw", "u1"))!;              // executionGeneration = 2
    // gen 1 (stale) tries to save -> fenced, returns false, row unchanged by it.
    const staleWrite = await store.save({ ...recGen1, status: "failed", failureCode: "boom" } as IntelligenceRunRecord);
    assert.equal(staleWrite, false, "stale executor save must be a no-op");
    // gen 2 (current) saves successfully.
    const currentWrite = await store.save({ ...recGen2, status: "processing", stage: "research" } as IntelligenceRunRecord);
    assert.equal(currentWrite, true, "current executor save must succeed");
    assert.equal(db.row.status, "processing", "final state is the current attempt, not the stale failure");
    assert.equal(db.row.execution_generation, 2);
  });

  console.log(`\n${passed} passed, 0 failed`);
};
run().catch((e) => { console.error(e); process.exit(1); });
