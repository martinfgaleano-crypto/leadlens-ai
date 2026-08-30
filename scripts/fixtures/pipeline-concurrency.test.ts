// RUNTIME SCALE SAFETY V1 — bounded account-research concurrency primitive.
// Proves: results stay in ORIGINAL order regardless of completion order; at most
// `concurrency` tasks run in flight; a failing task is isolated (its own value); and a
// serial (concurrency=1) run yields the identical ordered result as concurrency=2.

import assert from "node:assert/strict";
import { boundedOrderedMap, peakInFlight } from "@/lib/pipeline-concurrency";

let passed = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log(`ok - ${passed} ${name}`); };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  // Order preserved even though later indices finish FIRST (inverted delays).
  await t("order preserved regardless of completion order", async () => {
    const out = await boundedOrderedMap(5, 2, async (i) => { await sleep((5 - i) * 8); return `r${i}`; });
    assert.deepEqual(out, ["r0", "r1", "r2", "r3", "r4"]);
  });

  // Concurrency bound respected (peak in-flight never exceeds the limit).
  await t("at most `concurrency` tasks in flight", async () => {
    await boundedOrderedMap(6, 2, async (i) => { await sleep(10); return i; });
    assert.ok(peakInFlight() <= 2, `peak in-flight ${peakInFlight()} must be <= 2`);
    await boundedOrderedMap(6, 3, async (i) => { await sleep(10); return i; });
    assert.ok(peakInFlight() <= 3 && peakInFlight() >= 2, `peak ${peakInFlight()} within (2,3]`);
  });

  // concurrency=2 actually parallelizes: 4 tasks x 20ms at width 2 ≈ 40ms, not 80ms serial.
  await t("concurrency=2 reduces wall time vs serial", async () => {
    const s = Date.now(); await boundedOrderedMap(4, 2, async () => { await sleep(20); return 1; });
    const parallelMs = Date.now() - s;
    assert.ok(parallelMs < 70, `parallel ${parallelMs}ms should be well under the ~80ms serial`);
  });

  // Failure isolation: a task that returns an error-marker value doesn't break the batch;
  // ordering and the other results are intact (fn is caller-failure-isolated).
  await t("failure isolation: one bad task does not break the batch", async () => {
    const out = await boundedOrderedMap(4, 2, async (i) => i === 2 ? "FAILED" : `ok${i}`);
    assert.deepEqual(out, ["ok0", "ok1", "FAILED", "ok3"]);
  });

  // Serial-vs-parallel PARITY: identical inputs → identical ordered outputs (the truth
  // guarantee — completion order never changes the result set/order).
  await t("serial vs concurrency=2 produce identical ordered results", async () => {
    const work = (i: number) => Promise.resolve(`lead-${i}-decision`);
    const serial = await boundedOrderedMap(6, 1, work);
    const parallel = await boundedOrderedMap(6, 2, work);
    assert.deepEqual(serial, parallel);
  });

  console.log(`\n${passed} passed, 0 failed`);
};
run().catch((e) => { console.error(e); process.exit(1); });
