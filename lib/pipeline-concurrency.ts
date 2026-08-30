// RUNTIME SCALE SAFETY V1 — bounded, order-preserving concurrency for account research.
//
// A minimal worker pool: at most `concurrency` tasks in flight at once, results returned in
// the ORIGINAL index order (completion order never affects ordering/ranking). No unbounded
// Promise.all fan-out. `fn` is expected to be failure-isolated by the caller (return a value,
// never throw) so one task cannot reject the whole batch.

let lastMaxInFlight = 0;
/** Test-only: peak concurrency actually reached during the last boundedOrderedMap call. */
export const peakInFlight = (): number => lastMaxInFlight;

export async function boundedOrderedMap<T>(
  count: number,
  concurrency: number,
  fn: (index: number) => Promise<T>,
): Promise<T[]> {
  const results = new Array<T>(count);
  const workers = Math.max(1, Math.min(concurrency, count || 1));
  let next = 0;
  let inFlight = 0;
  lastMaxInFlight = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= count) return;
      inFlight++; lastMaxInFlight = Math.max(lastMaxInFlight, inFlight);
      try { results[i] = await fn(i); } finally { inFlight--; }
    }
  };
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}
