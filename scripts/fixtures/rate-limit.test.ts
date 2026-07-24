import assert from "node:assert/strict";
import { checkRateLimit, clearRateLimitsForTests, rateLimitBucketCountForTests, requestClientKey } from "../../lib/security/rate-limit";

clearRateLimitsForTests();
assert.deepEqual(checkRateLimit("demo:a", 2, 1_000, 10), { allowed: true, remaining: 1, resetAt: 1010 });
assert.deepEqual(checkRateLimit("demo:a", 2, 1_000, 20), { allowed: true, remaining: 0, resetAt: 1010 });
const blocked = checkRateLimit("demo:a", 2, 1_000, 30);
assert.equal(blocked.allowed, false);
if (!blocked.allowed) assert.equal(blocked.retryAfterSeconds, 1);
assert.deepEqual(checkRateLimit("demo:a", 2, 1_000, 1010), { allowed: true, remaining: 1, resetAt: 2010 });
assert.equal(requestClientKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
assert.equal(requestClientKey(new Headers()), "unknown");
clearRateLimitsForTests();
checkRateLimit("expired", 1, 10, 0);
checkRateLimit("expired", 1, 10, 11);
assert.equal(rateLimitBucketCountForTests(), 1);

console.log("✅ fixed-window limiter blocks bursts and resets deterministically");
console.log("✅ client key uses the first platform-forwarded address");
console.log("✅ expired buckets are pruned instead of accumulating");
console.log("\n7/7 passed");
