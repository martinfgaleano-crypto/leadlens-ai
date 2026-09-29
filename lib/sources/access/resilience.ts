// ─── Search-provider resilience: pacing + bounded retry ───────────────────────
// Generic, provider-agnostic. The search adapters (providers.ts) did a single raw
// fetch with no spacing and no retry, so a free-tier provider's burst rate limit
// (Brave ≈1 rps → HTTP 429; Tavily HTTP 433) surfaced as a hard `ok:false` on the
// first call and tripped a PERMANENT per-run cooldown upstream — collapsing
// discovery to zero even though the provider was merely throttling.
//
// This wrapper (a) paces calls per provider to a safe minimum interval, and
// (b) retries a bounded number of times on retryable statuses (429/433/5xx) and
// transport errors, honoring Retry-After. Non-retryable statuses (401/402/403/
// 432/400 = auth / quota / plan-limit) return immediately so genuinely dead
// providers are NOT hammered and the upstream cooldown still fires correctly.
// It never fabricates a result and never changes what a provider returns on ok.
//
// Deterministic-testable: inject fetchImpl / sleep / now via createResilientFetch.

export interface ResilienceDeps {
  fetchImpl: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export interface ResilientFetchOptions {
  timeoutMs?: number;
  maxAttempts?: number; // total attempts including the first (default 3)
}

// Retryable HTTP statuses: transient rate limits + server errors. 433 is Tavily's
// "rate limit exceeded" (distinct from 432 "plan limit", which is NOT retryable).
export const RETRYABLE_STATUS = new Set([429, 433, 500, 502, 503, 504]);

// Per-provider minimum spacing between the START of consecutive calls. Brave's
// free tier is ≈1 request/second, so it needs the widest guard; the others are
// paced lightly to avoid self-inflicted bursts without slowing healthy runs.
export const MIN_INTERVAL_MS: Record<string, number> = {
  brave: 1100,
  tavily: 300,
  serper: 250,
  firecrawl: 800,
  exa: 300,
};
export const DEFAULT_MIN_INTERVAL_MS = 250;
const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_BACKOFF_MS = 4000;

/** Backoff for the NEXT attempt. Honors a numeric or HTTP-date Retry-After,
 *  else exponential (0.5s, 1s, 2s …) capped at MAX_BACKOFF_MS. Pure. */
export function backoffMs(retryAfter: string | null | undefined, attempt: number, nowMs = Date.now()): number {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs >= 0) return Math.min(secs * 1000, MAX_BACKOFF_MS);
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.min(Math.max(0, at - nowMs), MAX_BACKOFF_MS);
  }
  return Math.min(500 * 2 ** attempt, MAX_BACKOFF_MS);
}

export function createResilientFetch(deps?: Partial<ResilienceDeps>) {
  const fetchImpl = deps?.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const sleep = deps?.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps?.now ?? (() => Date.now());

  // Per-provider promise chain: serializes slot acquisition AND enforces spacing,
  // so even concurrent callers of the same provider are paced (never bursting).
  const chain = new Map<string, Promise<void>>();
  const nextAllowedStart = new Map<string, number>();

  async function pace(providerId: string): Promise<void> {
    const minInterval = MIN_INTERVAL_MS[providerId] ?? DEFAULT_MIN_INTERVAL_MS;
    const prev = chain.get(providerId) ?? Promise.resolve();
    const next = prev.then(async () => {
      const earliest = nextAllowedStart.get(providerId) ?? 0;
      const wait = earliest - now();
      if (wait > 0) await sleep(wait);
      nextAllowedStart.set(providerId, now() + minInterval);
    });
    chain.set(providerId, next.catch(() => {}));
    await next;
  }

  async function resilientFetch(
    providerId: string,
    url: string,
    init: RequestInit,
    opts?: ResilientFetchOptions,
  ): Promise<Response> {
    const timeoutMs = opts?.timeoutMs ?? 15_000;
    const maxAttempts = Math.max(1, opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    let last: Response | null = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await pace(providerId);
      let res: Response;
      try {
        res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      } catch (err) {
        // Transport / timeout / abort: bounded retry, then rethrow so the caller
        // maps it to its own error response (never a fabricated success).
        if (attempt < maxAttempts - 1) { await sleep(backoffMs(null, attempt, now())); continue; }
        throw err;
      }
      if (res.ok || !RETRYABLE_STATUS.has(res.status)) return res;
      last = res;
      if (attempt < maxAttempts - 1) {
        await sleep(backoffMs(res.headers.get("retry-after"), attempt, now()));
        continue;
      }
    }
    return last as Response;
  }

  return resilientFetch;
}

/** Shared singleton used by the real provider adapters. */
export const resilientFetch = createResilientFetch();
