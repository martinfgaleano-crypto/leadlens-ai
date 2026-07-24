import assert from "node:assert/strict";
import { authorizeSearchProcessing } from "../../lib/auth/authorize-processing";

async function main() {
  const originalInternal = process.env.INTERNAL_RUN_SECRET;
  const originalAdmin = process.env.ADMIN_SECRET_TOKEN;
  process.env.INTERNAL_RUN_SECRET = "internal-test-secret";
  process.env.ADMIN_SECRET_TOKEN = "admin-test-secret";

function clientFor(tokens: Record<string, string>) {
  return {
    auth: {
      async getUser(token: string) {
        const id = tokens[token];
        return { data: { user: id ? { id } : null } };
      },
    },
  };
}

  const client = clientFor({ "owner-jwt": "user-1", "other-jwt": "user-2" });

async function check(name: string, fn: () => Promise<void>) {
  await fn();
  console.log(`✅ ${name}`);
}

  await check("missing credentials → 401", async () => {
  const result = await authorizeSearchProcessing(new Headers(), client, "user-1");
  assert.deepEqual(result, { ok: false, status: 401, error: "Unauthorized" });
});

  await check("invalid bearer → 401", async () => {
  const result = await authorizeSearchProcessing(new Headers({ authorization: "Bearer invalid" }), client, "user-1");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 401);
});

  await check("owner JWT → allowed", async () => {
  const result = await authorizeSearchProcessing(new Headers({ authorization: "Bearer owner-jwt" }), client, "user-1");
  assert.deepEqual(result, { ok: true, actor: "owner", userId: "user-1" });
});

  await check("other customer JWT → opaque 404", async () => {
  const result = await authorizeSearchProcessing(new Headers({ authorization: "Bearer other-jwt" }), client, "user-1");
  assert.deepEqual(result, { ok: false, status: 404, error: "Search not found" });
});

  await check("internal secret → allowed", async () => {
  const result = await authorizeSearchProcessing(new Headers({ authorization: "Bearer internal-test-secret" }), client, "user-1");
  assert.deepEqual(result, { ok: true, actor: "internal" });
});

  await check("admin token → allowed", async () => {
  const result = await authorizeSearchProcessing(new Headers({ "x-admin-token": "admin-test-secret" }), client, "user-1");
  assert.deepEqual(result, { ok: true, actor: "admin" });
});

  delete process.env.INTERNAL_RUN_SECRET;
  delete process.env.ADMIN_SECRET_TOKEN;

  await check("missing server secrets never creates a bypass", async () => {
  const result = await authorizeSearchProcessing(new Headers({ authorization: "Bearer internal-test-secret" }), client, "user-1");
  assert.equal(result.ok, false);
});

  if (originalInternal === undefined) delete process.env.INTERNAL_RUN_SECRET;
  else process.env.INTERNAL_RUN_SECRET = originalInternal;
  if (originalAdmin === undefined) delete process.env.ADMIN_SECRET_TOKEN;
  else process.env.ADMIN_SECRET_TOKEN = originalAdmin;

  console.log("\n7/7 passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
