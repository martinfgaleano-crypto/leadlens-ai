#!/usr/bin/env node
// Live Account Memory Review1→Review2 acceptance against the REAL Supabase store.
// Exercises the canonical SupabaseAccountMemoryRepo with SAFE, namespaced test
// data (a unique client_key, owner_user_id=null), then DELETES it — no customer
// history is touched. Reads .env.local without printing secrets.
//
// Exit 0 = accepted · 2 = a check failed · 3 = no DB configured.
// Run: npx tsx --tsconfig tsconfig.json scripts/accept-account-memory.mts
import { loadEnv, has } from "./lib/load-env.mjs";

const env = loadEnv();
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) if (env[k]) process.env[k] = env[k];
if (!has(env, "NEXT_PUBLIC_SUPABASE_URL") || !has(env, "SUPABASE_SERVICE_ROLE_KEY")) { console.log("SUPABASE_NOT_CONFIGURED"); process.exit(3); }

const { createServerClient } = await import("@/lib/supabase/server");
const { SupabaseAccountMemoryRepo, toRow, persistAndLoadMemory } = await import("@/lib/deliverable/account-memory-store");
const { diffAccountCase } = await import("@/lib/deliverable/account-memory");

const db = createServerClient();
if (!db) { console.log("NO_DB"); process.exit(3); }
const repo = new SupabaseAccountMemoryRepo(db);
const CK = `acc_accept_${Date.now()}`;
const scope = { ownerUserId: null, clientKey: CK };
const acct = "acct_alpha";
let failures = 0;
const check = (name, ok) => { if (!ok) failures++; console.log(`${ok ? "ok" : "FAIL"} - ${name}`); };

const snap = (reviewId, reviewedAt, o) => ({
  reviewId, reviewedAt, contextVersion: o.ctx ?? "ctx_v1", accountId: acct,
  decision: o.decision, fit: o.fit ?? "Moderate", timing: o.timing ?? "Limited", evidence: o.evidence ?? "Moderate",
  changeKeys: o.changeKeys ?? [], hasVerifiedChange: (o.changeKeys ?? []).length > 0,
  evidenceOrigins: o.origins ?? ["reuters.com"], independentSupport: !!o.indep, counterCount: 0, hasMaterialCounter: false,
  validationThemeKeys: o.themes ?? ["owner"], decisionCriticalThemeKeys: o.dc ?? ["owner"], hasRevisitTrigger: o.trigger ?? true,
});
const T0 = "2026-06-01T00:00:00.000Z", T1 = "2026-07-01T00:00:00.000Z", T2 = "2026-08-01T00:00:00.000Z";
const R0 = snap("job_T0", T0, { decision: "hold" });
const R1 = snap("job_T1", T1, { decision: "monitor" });
const R2 = snap("job_T2", T2, { decision: "prioritize", timing: "Strong", evidence: "Strong", changeKeys: ["expansion:2026-07-15"], origins: ["reuters.com", "bloomberg.com"], indep: true, dc: [] });

const count = async () => (await db.from("account_review_snapshots").select("review_id").eq("client_key", CK)).data?.length ?? 0;
const pred = async (m) => (await repo.loadPredecessors(scope, [acct], m))[acct] ?? null;

try {
  await repo.persist([toRow(R1, scope)]);
  check("R1 has no predecessor", (await pred({ reviewId: "job_T1", reviewedAt: T1 })) === null);
  check("R1 persists exactly one snapshot", (await count()) === 1);
  await repo.persist([toRow(R1, scope)]);
  check("R1 reload is idempotent (no duplicate)", (await count()) === 1);

  await repo.persist([toRow(R2, scope)]);
  const p2 = await pred({ reviewId: "job_T2", reviewedAt: T2 });
  check("R2 predecessor resolves to R1", p2?.reviewId === "job_T1" && p2?.decision === "monitor");
  const r1row = (await db.from("account_review_snapshots").select("snapshot").eq("client_key", CK).eq("review_id", "job_T1").maybeSingle()).data?.snapshot;
  check("R1 remains immutable after R2", r1row?.decision === "monitor");
  await repo.persist([toRow(R2, scope)]);
  check("R2 reload does not duplicate", (await count()) === 2);

  await repo.persist([toRow(R0, scope)]);
  check("out-of-order: R2 predecessor stays R1 (latest prior, not T0)", (await pred({ reviewId: "job_T2", reviewedAt: T2 }))?.reviewId === "job_T1");
  check("out-of-order: R1 predecessor is T0", (await pred({ reviewId: "job_T1", reviewedAt: T1 }))?.reviewId === "job_T0");

  const d = diffAccountCase(R1, R2);
  check("decision transition monitor→prioritize is material", d.decision.from === "monitor" && d.decision.to === "prioritize" && d.decision.changed && d.material);
  check("evidence newness is honest (only the new origin)", d.evidenceAdded.length === 1 && d.evidenceAdded[0] === "bloomberg.com");
  check("decision-critical validation resolved recorded", d.decisionCriticalResolved.includes("owner"));
  check("no context change when contextVersion unchanged", d.contextChanged === false);
  check("context change classified when version differs", diffAccountCase(R1, { ...R2, contextVersion: "ctx_v2" }).contextChanged === true);
  check("same-review re-ingest is not a change", diffAccountCase(R1, R1).isSameReview === true);

  check("client isolation: other client sees no predecessor", (await repo.loadPredecessors({ ownerUserId: null, clientKey: CK + "_other" }, [acct], { reviewId: "x", reviewedAt: T2 }))[acct] == null);

  let logged = false;
  const broken = { persist: async () => { throw new Error("down"); }, loadPredecessors: async () => { throw new Error("down"); } };
  const failClosed = await persistAndLoadMemory(broken, [], scope, { reviewId: "x", reviewedAt: T2, contextVersion: "c" }, () => { logged = true; });
  check("fail-closed: storage failure → null memory (current Case still renders) + logged", failClosed === null && logged);
} finally {
  const { error } = await db.from("account_review_snapshots").delete().eq("client_key", CK);
  console.log(error ? `CLEANUP_ERROR :: ${error.message}` : "cleanup :: test rows deleted");
}

console.log(failures === 0 ? "\nACCEPTANCE :: Account Memory Review1→Review2 is live and correct." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 2);
