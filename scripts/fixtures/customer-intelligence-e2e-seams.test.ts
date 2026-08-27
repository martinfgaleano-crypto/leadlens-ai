import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { intelligenceRunId } from "@/lib/intelligence/productive-spine";
import { candidateMatchesTargetGeography } from "@/lib/quality/geography-contract";

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log(`ok - ${name}`); };
const client = readFileSync("lib/interpretation/interpret-client.ts", "utf8");
const landing = readFileSync("app/demo-pipeline/page.tsx", "utf8");
const result = readFileSync("app/results/[jobId]/page.tsx", "utf8");
const runRoute = readFileSync("app/api/customer/intelligence-runs/route.ts", "utf8");
const workerRoute = readFileSync("app/api/internal/intelligence-runs/[runId]/process/route.ts", "utf8");
const monitorRoute = readFileSync("app/api/customer/monitor/route.ts", "utf8");
const discoveryRunner = readFileSync("lib/lead-hunter/discovery-runner.ts", "utf8");

test("Stage A browser request carries an authenticated session when present", () => assert.match(client, /Authorization: `Bearer \$\{accessToken\}`/));
test("customer confirmation seam posts only signed token and context reference", () => {
  assert.match(client, /api\/customer\/contexts\/confirm/);
  assert.doesNotMatch(client, /candidatesOverride|evidenceOverride|decisionOverride/);
});
test("run-start seam posts the persisted context reference", () => assert.match(client, /api\/customer\/intelligence-runs/));
test("existing interpretation action can confirm and start", () => assert.match(landing, /confirmAndStartIntelligence/));
test("productive result reload uses owner-scoped run endpoint", () => assert.match(result, /api\/customer\/intelligence-runs\/\$\{jobId\}/));
test("legacy result reload remains available", () => assert.match(result, /api\/report\?job_id=\$\{jobId\}/));
test("completed productive run initializes Account Memory in the background worker", () => assert.match(workerRoute, /initializeProductiveAccountMemory/));
test("result Monitor action delegates to canonical customer route", () => assert.match(result, /api\/customer\/monitor/));
test("Monitor trigger remains canonical", () => assert.match(monitorRoute, /executeCanonicalMonitor/));
test("same labels cannot collide across owners", () => {
  const base = { context: { contextId: "same", version: 1 }, idempotencyKey: "same" };
  assert.notEqual(intelligenceRunId({ ...base, userId: "owner-a" }), intelligenceRunId({ ...base, userId: "owner-b" }));
});
test("US aliases survive the productive geography gate", () => {
  const candidate = { company: "Acme", country: "USA", location: "USA" } as never;
  assert.equal(candidateMatchesTargetGeography(candidate, ["United States"]), true);
});
test("Lead Hunter adapter preserves discovered country into Research", () => assert.match(discoveryRunner, /country: a\.country \?\? undefined/));

console.log(`\n${passed} passed, 0 failed`);
