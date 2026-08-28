import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/intelligence/launch-readiness/route";
import { signAdminSession } from "@/lib/auth/admin-session";

async function run() {
  let passed = 0;
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = "test";
  env.ADMIN_SESSION_SECRET = "control-plane-ingestion-test-secret";
  const unauthenticated = await POST(new NextRequest("http://localhost/api/admin/intelligence/launch-readiness", { method: "POST", body: "{}", headers: { "content-type": "application/json" } }));
  assert.equal(unauthenticated.status, 401); passed++; console.log("ok - 1 ingestion rejects unauthenticated requests before persistence");
  const cookie = signAdminSession({ sub: "admin-test", role: "admin" }, env.ADMIN_SESSION_SECRET!);
  const invalid = await POST(new NextRequest("http://localhost/api/admin/intelligence/launch-readiness", { method: "POST", body: JSON.stringify({ use_bundled_evidence: false, readiness_score: 59 }), headers: { "content-type": "application/json", cookie: `ll_admin_session=${cookie}` } }));
  assert.equal(invalid.status, 400); passed++; console.log("ok - 2 authenticated direct score ingestion is rejected before DB access");
  const malformed = await POST(new NextRequest("http://localhost/api/admin/intelligence/launch-readiness", { method: "POST", body: "not-json", headers: { "content-type": "application/json", cookie: `ll_admin_session=${cookie}` } }));
  assert.equal(malformed.status, 400); passed++; console.log("ok - 3 malformed evidence fails closed");
  console.log(`\n${passed} passed, 0 failed`);
}
run().catch((error) => { console.error(error); process.exit(1); });
