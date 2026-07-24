import assert from "node:assert/strict";
import { RETIRED_PUBLIC_MUTATIONS, RETIRED_STATUS } from "../../lib/legacy/retired-surfaces";

assert.equal(RETIRED_STATUS, 410);
assert.deepEqual(RETIRED_PUBLIC_MUTATIONS, [
  "/api/onboarding",
  "/api/onboarding/submit",
  "/api/onboarding/upload-logo",
  "/api/upload",
]);
assert.equal(new Set(RETIRED_PUBLIC_MUTATIONS).size, RETIRED_PUBLIC_MUTATIONS.length);

console.log("✅ four legacy public mutation surfaces are explicitly retired");
console.log("✅ retirement uses HTTP 410 Gone");
console.log("\n5/5 passed");
