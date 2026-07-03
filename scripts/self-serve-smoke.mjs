#!/usr/bin/env node
/**
 * LeadLens Self-Serve Smoke QA helper (read-only).
 *
 * Probes auth/ownership behavior of self-serve endpoints WITHOUT mutating any
 * data — it never triggers runs, never writes feedback. Mutation steps are
 * printed as manual instructions (see docs/strategy/BETA_SMOKE_QA.md).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 \
 *   OWNER_TOKEN=<supabase JWT of the search owner> \
 *   OTHER_TOKEN=<supabase JWT of a different user> \
 *   ADMIN_TOKEN=<x-admin-token> \
 *   SEARCH_ID=<lead_searches.id owned by OWNER_TOKEN> \
 *   JOB_ID=<completed monitor job_id for SEARCH_ID> \
 *   node scripts/self-serve-smoke.mjs
 *
 * Any variable may be omitted; dependent checks are skipped and reported.
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const { OWNER_TOKEN, OTHER_TOKEN, ADMIN_TOKEN, SEARCH_ID, JOB_ID } = process.env;

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass === null ? "SKIP" : pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function probe(path, { token, adminToken } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (adminToken) headers["x-admin-token"] = adminToken;
  try {
    const res = await fetch(`${BASE}${path}`, { headers });
    return { status: res.status, body: await res.json().catch(() => null) };
  } catch (err) {
    return { status: -1, body: null, error: String(err) };
  }
}

console.log(`\nLeadLens self-serve smoke QA (read-only) — ${BASE}\n`);

// 1. Auth required on customer endpoints
{
  const r = await probe("/api/monitor/overview");
  record("overview requires auth", r.status === 401, `got ${r.status}`);
}
{
  const r = await probe(`/api/monitor/${SEARCH_ID ?? "00000000-0000-0000-0000-000000000000"}/runs`);
  record("runs requires auth", r.status === 401, `got ${r.status}`);
}

// 2. Monitor list loads for owner
if (OWNER_TOKEN) {
  const r = await probe("/api/monitor/overview", { token: OWNER_TOKEN });
  record("overview loads for owner", r.status === 200 && Array.isArray(r.body?.monitors), `got ${r.status}`);
} else record("overview loads for owner", null, "OWNER_TOKEN not set");

// 3. Ownership enforced on runs
if (SEARCH_ID && OTHER_TOKEN) {
  const r = await probe(`/api/monitor/${SEARCH_ID}/runs`, { token: OTHER_TOKEN });
  record("foreign user cannot read runs", r.status === 404, `got ${r.status} (want 404)`);
} else record("foreign user cannot read runs", null, "SEARCH_ID/OTHER_TOKEN not set");

if (SEARCH_ID && OWNER_TOKEN) {
  const r = await probe(`/api/monitor/${SEARCH_ID}/runs`, { token: OWNER_TOKEN });
  record("owner reads runs", r.status === 200, `got ${r.status}`);
  if (r.status === 200) {
    record("runs response scoped to requested search", r.body?.search_id === SEARCH_ID,
      `echo=${r.body?.search_id}`);
  }
} else record("owner reads runs", null, "SEARCH_ID/OWNER_TOKEN not set");

// 4. Report auth matrix
if (JOB_ID) {
  const anon = await probe(`/api/report?job_id=${JOB_ID}`);
  record("report anon -> 401", anon.status === 401, `got ${anon.status}`);
  if (OWNER_TOKEN) {
    const own = await probe(`/api/report?job_id=${JOB_ID}`, { token: OWNER_TOKEN });
    record("report owner -> 200", own.status === 200, `got ${own.status}`);
    if (own.status === 200) {
      record("report carries search_id (new runs)", own.body?.report?.search_id === SEARCH_ID,
        own.body?.report?.search_id ? `report.search_id=${own.body.report.search_id}` : "absent (legacy run?)");
      const leaked = JSON.stringify(own.body?.report?.ranked_opportunities ?? []).match(/linkedin\.com\/in\//);
      record("no personal linkedin in ranked data", !leaked, leaked ? "found personal linkedin URL" : "");
    }
  } else record("report owner -> 200", null, "OWNER_TOKEN not set");
  if (OTHER_TOKEN) {
    const other = await probe(`/api/report?job_id=${JOB_ID}`, { token: OTHER_TOKEN });
    record("report non-owner -> 404", other.status === 404, `got ${other.status}`);
  } else record("report non-owner -> 404", null, "OTHER_TOKEN not set");
  if (ADMIN_TOKEN) {
    const adm = await probe(`/api/report?job_id=${JOB_ID}`, { adminToken: ADMIN_TOKEN });
    record("report admin -> 200", adm.status === 200, `got ${adm.status}`);
  } else record("report admin -> 200", null, "ADMIN_TOKEN not set");
} else record("report auth matrix", null, "JOB_ID not set");

// 5. Customer run endpoint exists (probed with GET -> expect 405, no mutation)
{
  const res = await fetch(`${BASE}/api/monitor/${SEARCH_ID ?? "00000000-0000-0000-0000-000000000000"}/run`).catch(() => null);
  record("customer run route exists (405 on GET)", res?.status === 405, `got ${res?.status}`);
}

// 6. Internal processor security (async v0). POSTing a bogus jobId without a
//    secret must be rejected BEFORE any job lookup — 401 (secret configured)
//    or 403 (production without secret). In dev without secrets it returns
//    404 (allowed through, job not found) — flagged as dev-only.
{
  const res = await fetch(`${BASE}/api/internal/monitor-runs/smoke_probe_nonexistent/process`, { method: "POST" }).catch(() => null);
  const st = res?.status;
  if (st === 401 || st === 403) {
    record("internal processor rejects missing secret", true, `got ${st}`);
  } else if (st === 404) {
    record("internal processor rejects missing secret", true, "got 404 — dev mode without secret (job lookup ran); MUST be 401/403 in production");
  } else {
    record("internal processor rejects missing secret", false, `got ${st}`);
  }
}
{
  const res = await fetch(`${BASE}/api/internal/monitor-runs/smoke_probe_nonexistent/process`, {
    method: "POST",
    headers: { "x-internal-secret": "definitely-wrong-secret" },
  }).catch(() => null);
  const st = res?.status;
  record("internal processor rejects wrong secret", st === 401 || st === 403 || st === 404,
    st === 404 ? "got 404 — dev mode without secret; MUST be 401 in production" : `got ${st}`);
}

// 7. Drainer security + dry_run (production architecture). Read-only:
//    dry_run classifies without mutating anything.
{
  const res = await fetch(`${BASE}/api/internal/monitor-runs/drain?dry_run=true`, { method: "POST" }).catch(() => null);
  const st = res?.status;
  if (st === 401 || st === 403) {
    record("drainer rejects missing secret", true, `got ${st}`);
  } else if (st === 200) {
    record("drainer rejects missing secret", true, "got 200 — dev mode without secrets; MUST be 401/403 in production");
  } else {
    record("drainer rejects missing secret", false, `got ${st}`);
  }
}
{
  const res = await fetch(`${BASE}/api/internal/monitor-runs/drain?dry_run=true`, {
    method: "POST",
    headers: { "x-internal-secret": "definitely-wrong-secret" },
  }).catch(() => null);
  const st = res?.status;
  record("drainer rejects wrong secret", st === 401 || st === 403 || st === 200,
    st === 200 ? "got 200 — dev mode without secrets; MUST be 401 in production" : `got ${st}`);
}
if (ADMIN_TOKEN) {
  const res = await fetch(`${BASE}/api/internal/monitor-runs/drain?dry_run=true&limit=5`, {
    method: "POST",
    headers: { "x-admin-token": ADMIN_TOKEN },
  }).catch(() => null);
  const body = res ? await res.json().catch(() => null) : null;
  const ok = res?.status === 200 && body?.dry_run === true && typeof body?.scanned === "number";
  record("drainer dry_run returns summary (admin token)", ok,
    ok ? `scanned=${body.scanned} retriggered=${body.retriggered} superseded=${body.superseded}` : `got ${res?.status}`);
} else record("drainer dry_run returns summary (admin token)", null, "ADMIN_TOKEN not set");

// 8. Env health (admin-only; presence booleans, never values)
if (ADMIN_TOKEN) {
  const res = await fetch(`${BASE}/api/admin/system-health`, {
    headers: { "x-admin-token": ADMIN_TOKEN },
  }).catch(() => null);
  const body = res ? await res.json().catch(() => null) : null;
  const eh = body?.env_health;
  record("env health reports readiness", res?.status === 200 && eh && typeof eh.production_safe === "boolean",
    eh ? `production_safe=${eh.production_safe} missing=[${(eh.missing_for_production ?? []).join(",")}]` : `got ${res?.status}`);
} else record("env health reports readiness", null, "ADMIN_TOKEN not set");

console.log(`\nManual steps (mutating — not automated here):
  - Trigger run as owner; expect 202 + status "processing" + is_baseline correct.
  - Poll runs endpoint; expect the job to reach "completed" (async processor).
  - Trigger again while processing; expect 409.
  - Insert a stale processing row (created_at > 15 min ago); expect new run 200
    and admin retry (POST /api/admin/monitor-runs/<jobId>/retry) to reprocess it.
  - Trigger with free-plan/zero-credit user; expect 403 with upgrade copy.
  - Submit identical feedback twice; expect already_saved on second call.
  - Verify feedback row has search_id when the report carries it.
  - POST /api/process without searchId; expect snapshot.search_id null.
  - DEMO_MODE=true: pipeline reads no memory/snapshots; /api/report open.
Full checklist: docs/strategy/BETA_SMOKE_QA.md\n`);

const failed = results.filter(r => r.pass === false).length;
const skipped = results.filter(r => r.pass === null).length;
console.log(`Result: ${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped.`);

if (!OWNER_TOKEN && !OTHER_TOKEN && !ADMIN_TOKEN) {
  console.log(`\nWARNING: no tokens provided — only anonymous-auth checks ran.
This does NOT validate ownership or the report auth matrix. Set OWNER_TOKEN,
OTHER_TOKEN, ADMIN_TOKEN, SEARCH_ID and JOB_ID for meaningful coverage.`);
}

process.exit(failed > 0 ? 1 : 0);
