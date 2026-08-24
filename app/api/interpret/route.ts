import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, requestClientKey } from "@/lib/security/rate-limit";
import { interpretCompany, MAX_INPUT_CHARS } from "@/lib/interpretation/interpret-service";
import { toPublicInterpretation } from "@/lib/interpretation/public-projection";

export const runtime = "nodejs";

const schema = z.object({
  input: z.string().min(1).max(MAX_INPUT_CHARS),
  clarification: z.string().max(MAX_INPUT_CHARS).optional(),
  locale: z.enum(["en", "es", "pt", "ja"]).default("en"),
}).strict();

// V1 abuse protection (§20): per-instance, per-client window. Distributed store
// required before high-volume self-serve (serverless instances don't share memory).
const LIMIT = 6;
const WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const clientKey = requestClientKey(req.headers);
  const rl = checkRateLimit(`interpret:${clientKey}`, LIMIT, WINDOW_MS);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many interpretation attempts. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid interpretation request." }, { status: 400 });
  }

  const { input, clarification, locale } = parsed.data;
  const combined = clarification?.trim() ? `${input}. ${clarification.trim()}` : input;

  try {
    const result = await interpretCompany(combined, { locale });
    const projection = toPublicInterpretation(result);

    // Privacy-safe observability (§18/§21): NO raw prose. Class/latency/flags only.
    console.info("[interpret]", JSON.stringify({
      mode: result.meta.mode,
      objectiveClass: result.meta.objectiveClass,
      status: projection.status,
      clarification: result.meta.clarificationRequired,
      repaired: result.meta.repaired,
      fallback: result.meta.fallbackUsed,
      redacted: result.meta.inputRedacted,
      truncated: result.meta.inputTruncated,
      latencyMs: result.meta.latencyMs,
      locale,
    }));

    return NextResponse.json({ interpretation: projection });
  } catch {
    // Never expose provider/stack detail.
    return NextResponse.json({ error: "Interpretation is temporarily unavailable." }, { status: 503 });
  }
}
