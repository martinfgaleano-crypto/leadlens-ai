import assert from "node:assert/strict";
import { demoAvailability } from "../../lib/demo/demo-policy";

assert.deepEqual(
  demoAvailability({ DEMO_MODE: "true" }),
  { allowed: true },
);
console.log("✅ explicit DEMO_MODE=true allows deterministic demo execution");

for (const value of [undefined, "false", "TRUE", "1", "yes"]) {
  const result = demoAvailability(value === undefined ? {} : { DEMO_MODE: value });
  assert.deepEqual(result, {
    allowed: false,
    status: 404,
    error: "Demo execution is unavailable.",
  });
}
console.log("✅ missing or ambiguous flags fail closed");
console.log("\n6/6 passed");
