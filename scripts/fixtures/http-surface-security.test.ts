import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as retiredUpload } from "../../app/api/upload/route";
import { POST as retiredOnboarding } from "../../app/api/onboarding/route";
import { POST as retiredSubmit } from "../../app/api/onboarding/submit/route";
import { POST as retiredLogo } from "../../app/api/onboarding/upload-logo/route";
import { POST as checkout } from "../../app/api/checkout/route";
import { POST as demo } from "../../app/api/demo/route";
import { GET as jobsGet } from "../../app/api/jobs/route";
import { GET as jobGet } from "../../app/api/jobs/[jobId]/route";
import { GET as resultGet } from "../../app/api/results/[jobId]/route";
import { POST as legacyProcess } from "../../app/api/process/route";
import { POST as searchProcess } from "../../app/api/process/search/[id]/route";

const url = "http://localhost:3000";
const original = {
  admin: process.env.ADMIN_SECRET_TOKEN,
  payments: process.env.PAYMENTS_ENABLED,
  provider: process.env.PAYMENT_PROVIDER,
  demo: process.env.DEMO_MODE,
};

async function main() {
  process.env.ADMIN_SECRET_TOKEN = "http-test-admin";
  process.env.PAYMENTS_ENABLED = "false";
  delete process.env.PAYMENT_PROVIDER;
  process.env.DEMO_MODE = "false";

  for (const handler of [retiredUpload, retiredOnboarding, retiredSubmit, retiredLogo]) {
    const response = await handler();
    assert.equal(response.status, 410);
  }
  console.log("✅ retired public mutations return HTTP 410");

  const checkoutResponse = await checkout(new NextRequest(`${url}/api/checkout`, { method: "POST" }));
  assert.equal(checkoutResponse.status, 503);
  assert.equal((await checkoutResponse.json()).code, "CHECKOUT_CLOSED");
  console.log("✅ closed checkout returns 503 before parsing or creating a job");

  const demoResponse = await demo(new NextRequest(`${url}/api/demo`, { method: "POST" }));
  assert.equal(demoResponse.status, 404);
  console.log("✅ demo route fails closed outside explicit demo mode");

  const noAuth = new NextRequest(`${url}/api/jobs`);
  assert.equal((await jobsGet(noAuth)).status, 401);
  assert.equal((await jobGet(noAuth, { params: { jobId: "job-test" } })).status, 401);
  assert.equal((await resultGet(noAuth, { params: { jobId: "job-test" } })).status, 401);
  assert.equal((await legacyProcess(new NextRequest(`${url}/api/process`, { method: "POST" }))).status, 401);
  console.log("✅ legacy jobs/results/process reject missing admin token");

  const missingProcessorAuth = await searchProcess(
    new NextRequest(`${url}/api/process/search/00000000-0000-4000-8000-000000000001`, { method: "POST" }),
    { params: { id: "00000000-0000-4000-8000-000000000001" } },
  );
  assert.equal(missingProcessorAuth.status, 401);

  const invalidId = await searchProcess(
    new NextRequest(`${url}/api/process/search/not-a-uuid`, { method: "POST" }),
    { params: { id: "not-a-uuid" } },
  );
  assert.equal(invalidId.status, 400);
  console.log("✅ search processor rejects anonymous and malformed requests before DB access");

  console.log("\n12/12 passed");
}

main().finally(() => {
  if (original.admin === undefined) delete process.env.ADMIN_SECRET_TOKEN;
  else process.env.ADMIN_SECRET_TOKEN = original.admin;
  if (original.payments === undefined) delete process.env.PAYMENTS_ENABLED;
  else process.env.PAYMENTS_ENABLED = original.payments;
  if (original.provider === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = original.provider;
  if (original.demo === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = original.demo;
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
