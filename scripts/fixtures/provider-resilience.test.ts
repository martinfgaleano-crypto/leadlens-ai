// Provider resilience: per-provider pacing + bounded retry honoring Retry-After,
// with a virtual clock (no real time, no network). Also asserts the 433 → rate_limited
// classification and that non-retryable statuses (402/401/432) return immediately.
import { createResilientFetch, backoffMs, MIN_INTERVAL_MS, RETRYABLE_STATUS } from "../../lib/sources/access/resilience";
import { classifyProviderError } from "../../lib/ops/provider-health";

let passed = 0, failed = 0;
const t = (name: string, cond: boolean) => { if (cond) { passed++; console.log("✅ " + name); } else { failed++; console.log("❌ " + name); } };

// Virtual clock: now() reads a mutable counter; sleep advances it. Deterministic.
function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => { t += ms; }, set: (v: number) => { t = v; } };
}
function res(status: number, headers: Record<string, string> = {}): Response {
  return new Response(status === 200 ? "{}" : "err", { status, headers });
}

async function main() {
  // 1. Pacing: two consecutive calls to the SAME provider are spaced ≥ minInterval.
  {
    const c = clock();
    const startTimes: number[] = [];
    const fetchImpl = (async () => { startTimes.push(c.now()); return res(200); }) as unknown as typeof fetch;
    const rf = createResilientFetch({ fetchImpl, sleep: c.sleep, now: c.now });
    await rf("brave", "https://x", {});
    await rf("brave", "https://x", {});
    t("brave second call paced ≥ MIN_INTERVAL_MS after first", startTimes.length === 2 && (startTimes[1] - startTimes[0]) >= MIN_INTERVAL_MS.brave);
  }

  // 2. Different providers are NOT paced against each other.
  {
    const c = clock();
    const starts: Record<string, number> = {};
    const fetchImpl = (async (url: string) => { starts[url] = c.now(); return res(200); }) as unknown as typeof fetch;
    const rf = createResilientFetch({ fetchImpl, sleep: c.sleep, now: c.now });
    await Promise.all([rf("brave", "b", {}), rf("firecrawl", "f", {})]);
    t("distinct providers not serialized against each other", starts["b"] === 0 && starts["f"] === 0);
  }

  // 3. Retry on 429 honoring Retry-After, then success → returns the 200.
  {
    const c = clock();
    let n = 0; const waits: number[] = []; let last = 0;
    const fetchImpl = (async () => { waits.push(c.now() - last); last = c.now(); n++; return n < 2 ? res(429, { "retry-after": "2" }) : res(200); }) as unknown as typeof fetch;
    const rf = createResilientFetch({ fetchImpl, sleep: c.sleep, now: c.now });
    const r = await rf("tavily", "https://x", {}, { maxAttempts: 3 });
    t("429 retried then 200 returned", r.status === 200 && n === 2);
    t("Retry-After: 2 honored as 2000ms before retry", waits[1] >= 2000);
  }

  // 4. 433 is retryable; 402/401/432 are NOT (return immediately, single fetch).
  {
    t("RETRYABLE includes 429 and 433", RETRYABLE_STATUS.has(429) && RETRYABLE_STATUS.has(433));
    t("RETRYABLE excludes 402/401/432", !RETRYABLE_STATUS.has(402) && !RETRYABLE_STATUS.has(401) && !RETRYABLE_STATUS.has(432));
    const c = clock();
    let n = 0;
    const fetchImpl = (async () => { n++; return res(402); }) as unknown as typeof fetch;
    const rf = createResilientFetch({ fetchImpl, sleep: c.sleep, now: c.now });
    const r = await rf("serper", "https://x", {}, { maxAttempts: 3 });
    t("402 (unfunded) returns immediately without retry", r.status === 402 && n === 1);
  }

  // 5. Exhausts retries → returns the last non-ok response (never throws for HTTP).
  {
    const c = clock();
    let n = 0;
    const fetchImpl = (async () => { n++; return res(429, { "retry-after": "1" }); }) as unknown as typeof fetch;
    const rf = createResilientFetch({ fetchImpl, sleep: c.sleep, now: c.now });
    const r = await rf("brave", "https://x", {}, { maxAttempts: 3 });
    t("persistent 429 returns last 429 after maxAttempts", r.status === 429 && n === 3);
  }

  // 6. backoffMs: numeric Retry-After, HTTP-date, cap, and exponential fallback.
  {
    t("backoffMs numeric Retry-After seconds→ms", backoffMs("3", 0) === 3000);
    t("backoffMs caps at 4000ms", backoffMs("999", 0) === 4000);
    t("backoffMs exponential fallback grows", backoffMs(null, 0) === 500 && backoffMs(null, 1) === 1000 && backoffMs(null, 2) === 2000);
  }

  // 7. classifyProviderError maps 433 → rate_limited (was 'unknown').
  {
    t("classifyProviderError('HTTP 433') === rate_limited", classifyProviderError("HTTP 433") === "rate_limited");
    t("classifyProviderError('HTTP 429') === rate_limited", classifyProviderError("HTTP 429") === "rate_limited");
    t("classifyProviderError('not enough credits') === exhausted", classifyProviderError("400: not enough credits") === "exhausted");
    t("classifyProviderError('HTTP 432') === exhausted", classifyProviderError("HTTP 432") === "exhausted");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
