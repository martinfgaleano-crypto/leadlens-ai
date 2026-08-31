import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const initializer = readFileSync("lib/intelligence/initialize-account-memory.ts", "utf8");
const customerBrief = readFileSync("app/results/[jobId]/brief/actions.ts", "utf8");

let passed = 0;
function test(name: string, fn: () => void) {
  fn(); passed += 1; console.log(`ok - ${name}`);
}

test("productive worker scopes Memory by confirmed commercial context", () => {
  assert.match(initializer, /clientKey:\s*`context:\$\{input\.contextRef\.contextId\}`/);
  assert.doesNotMatch(initializer, /clientKey:\s*input\.runId/);
});

test("customer brief resolves the same confirmed-context scope", () => {
  assert.match(customerBrief, /contextId\s*\?\s*`context:\$\{contextId\}`/);
});

test("context version remains semantic metadata, not the lineage key", () => {
  assert.match(customerBrief, /`\$\{contextId\}:v\$\{intelligenceMeta\?\.contextRef\?\.version/);
});

test("owner-linked productive reports require authenticated ownership", () => {
  assert.match(customerBrief, /if \(searchId \|\| snapshot\.user_id\)/);
  assert.match(customerBrief, /snapshot\.user_id \?\? null/);
});

console.log(`\n${passed} passed, 0 failed`);
