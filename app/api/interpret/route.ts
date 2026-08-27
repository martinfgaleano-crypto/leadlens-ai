import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, requestClientKey } from "@/lib/security/rate-limit";
import { interpretCompany } from "@/lib/interpretation/interpret-service";
import { toPublicInterpretation } from "@/lib/interpretation/public-projection";
import { MAX_INPUT_CHARS, ANON_RATE, AUTH_RATE, type InterpretOutcome } from "@/lib/interpretation/interpret-config";

export const runtime = "nodejs";

// Body caps are generous enough to detect oversize explicitly (input_too_large)
// rather than letting zod reject it as a generic "invalid" error.
const schema = z.object({
  input: z.string().min(1).max(4000),
  clarification: z.string().max(4000).optional(),
  locale: z.enum(["en", "es", "pt", "ja"]).default("en"),
  priorTurns: z.number().int().min(0).max(5).optional(),
}).strict();

/** Authenticated callers get a looser abuse limit than anonymous ones. Detection
 *  is cheap: only when an Authorization header is present do we verify it. */
async function resolveLimit(req: NextRequest): Promise<{ key: string; limit: number; windowMs: number; userId: string | null }> {
  const auth = req.headers.get("authorization");
  if (auth) {
    try {
      const { createServerClient } = await import("@/lib/supabase/server");
      const db = createServerClient();
      const token = auth.replace(/^Bearer\s+/i, "");
      const { data: { user } } = (await db?.auth.getUser(token)) ?? { data: { user: null } };
      if (user) return { key: `interpret:auth:${user.id}`, limit: AUTH_RATE.limit, windowMs: AUTH_RATE.windowMs, userId: user.id };
    } catch { /* fall through to anonymous */ }
  }
  return { key: `interpret:anon:${requestClientKey(req.headers)}`, limit: ANON_RATE.limit, windowMs: ANON_RATE.windowMs, userId: null };
}

function respond(outcome: InterpretOutcome, body: Record<string, unknown>, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ outcome, ...body }, { status, headers });
}

export async function POST(req: NextRequest) {
  const rate = await resolveLimit(req);
  const rl = checkRateLimit(rate.key, rate.limit, rate.windowMs);
  if (!rl.allowed) {
    return respond("rate_limited", { error: "Too many interpretation attempts. Please wait a moment." }, 429,
      { "Retry-After": String(rl.retryAfterSeconds) });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return respond("input_too_large", { error: "Invalid interpretation request." }, 400);
  }

  const { input, clarification, locale, priorTurns } = parsed.data;
  const combined = clarification?.trim() ? `${input}. ${clarification.trim()}` : input;

  // Explicit oversize refusal BEFORE any model spend (§18/§51): never silently
  // truncate at the endpoint — tell the caller to shorten.
  if (combined.length > MAX_INPUT_CHARS) {
    return respond("input_too_large", { error: `Please shorten your description to ${MAX_INPUT_CHARS} characters or fewer.`, limit: MAX_INPUT_CHARS }, 413);
  }

  try {
    const result = await interpretCompany(combined, { locale, priorTurns });
    const projection = toPublicInterpretation(result);

    const outcome: InterpretOutcome =
      projection.status === "unsupported_objective" ? "unsupported_objective" :
      projection.status === "needs_clarification" ? "needs_clarification" : "success";

    // Privacy-safe observability (§24): NO raw prose, NO model output. Class /
    // latency / flags / usage only.
    console.info("[interpret]", JSON.stringify({
      outcome,
      mode: result.meta.mode,
      objectiveClass: result.meta.objectiveClass,
      clarification: result.meta.clarificationRequired,
      clarificationExhausted: result.meta.clarificationExhausted,
      repaired: result.meta.repaired,
      fallback: result.meta.fallbackUsed,
      redacted: result.meta.inputRedacted,
      truncated: result.meta.inputTruncated,
      modelCalls: result.meta.modelCalls,
      timedOut: result.meta.timedOut,
      latencyMs: result.meta.latencyMs,
      locale,
    }));

    const confirmationToken = rate.userId && projection.status === "ready_for_confirmation"
      ? (await import("@/lib/interpretation/confirmation-token")).issueConfirmationToken(rate.userId, result.interpretation)
      : null;
    return respond(outcome, {
      interpretation: projection,
      ...(confirmationToken ? { confirmation_token: confirmationToken } : {}),
      // Non-sensitive operational signals the client may surface (degraded read,
      // exhausted clarification). Never provider internals or raw output.
      meta: {
        degraded: result.meta.fallbackUsed || result.meta.mode !== "llm",
        clarificationExhausted: result.meta.clarificationExhausted,
      },
    }, 200);
  } catch {
    // interpretCompany never throws in practice (it always falls back); this is a
    // final safety net. Never expose provider/stack detail.
    return respond("model_unavailable", { error: "Interpretation is temporarily unavailable." }, 503);
  }
}
