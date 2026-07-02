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

console.log(`\nManual steps (mutating — not automated here):
  - Trigger run as owner; expect 200 + is_baseline correct.
  - Trigger again while processing; expect 409.
  - Trigger with free-plan/zero-credit user; expect 403 with upgrade copy.
  - Submit identical feedback twice; expect already_saved on second call.
  - Verify feedback row has search_id when the report carries it.
  - POST /api/process without searchId; expect snapshot.search_id null.
  - DEMO_MODE=true: pipeline reads no memory/snapshots; /api/report open.
Full checklist: docs/strategy/BETA_SMOKE_QA.md\n`);

const failed = results.filter(r => r.pass === false).length;
const skipped = results.filter(r => r.pass === null).length;
console.log(`Result: ${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped.`);
process.exit(failed > 0 ? 1 : 0);
