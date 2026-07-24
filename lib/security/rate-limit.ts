type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;

function pruneBuckets(now: number): void {
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
  // Bounded fallback for a burst of unique keys inside one window. Map keeps
  // insertion order, so oldest buckets are discarded first.
  while (buckets.size >= MAX_BUCKETS) {
    const oldest = buckets.keys().next().value as string | undefined;
    if (!oldest) break;
    buckets.delete(oldest);
  }
}

export type RateLimitResult =
  | { allowed: true; remaining: number; resetAt: number }
  | { allowed: false; remaining: 0; resetAt: number; retryAfterSeconds: number };

/**
 * Best-effort per-instance limiter for public low-volume launch surfaces.
 * It limits accidental/burst abuse now; a distributed store is required before
 * high-volume self-serve because serverless instances do not share memory.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS || (current && current.resetAt <= now)) {
      pruneBuckets(now);
    }
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt };
}

export function requestClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "unknown";
}

export function clearRateLimitsForTests(): void {
  buckets.clear();
}

export function rateLimitBucketCountForTests(): number {
  return buckets.size;
}
