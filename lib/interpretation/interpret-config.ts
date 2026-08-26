// ─── Stage A production limits (single source of truth) ───────────────────────
//
// Centralized so cost/latency/abuse controls are not scattered across the service
// and the route (§28). These are operational safety limits, NOT pricing/entitlement.

/** Max characters of business prose accepted. Beyond this the request is refused
 *  with `input_too_large` (never silently truncated at the endpoint). */
export const MAX_INPUT_CHARS = 600;

/** Interactive timeout for a single Stage A model call. Shorter than the generic
 *  60s agent timeout — Stage A must feel responsive and degrade to a deterministic
 *  fallback rather than hang. */
export const MODEL_TIMEOUT_MS = 20_000;

/** Hard ceiling on LOGICAL model calls per interpretation: 1 primary + 1 semantic
 *  repair. (Each logical call may still transport-retry inside the provider wrapper;
 *  that is bounded infra resilience, not extra interpretation attempts.) */
export const MAX_MODEL_CALLS = 2;

/** Clarification turn policy (§14): normally at most 2 sequential clarifications;
 *  a genuine contradiction may take one more (3) to resolve. Past the ceiling the
 *  service stops asking new questions instead of looping. */
export const MAX_CLARIFICATION_TURNS = 2;
export const CONTRADICTION_TURN_CEILING = 3;

/** Rate limits (§27/§28). Anonymous is stricter than authenticated. Per rolling
 *  window, per client (anon) or per user (auth). */
export const ANON_RATE = { limit: 5, windowMs: 60_000 } as const;
export const AUTH_RATE = { limit: 20, windowMs: 60_000 } as const;

/** Machine-readable Stage A outcomes returned to callers (§37). */
export type InterpretOutcome =
  | "success"
  | "needs_clarification"
  | "unsupported_objective"
  | "rate_limited"
  | "input_too_large"
  | "model_unavailable";
