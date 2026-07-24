import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runLeadLensPipeline } from "@/lib/pipeline";
import { demoAvailability } from "@/lib/demo/demo-policy";
import { checkRateLimit, requestClientKey } from "@/lib/security/rate-limit";

/**
 * POST /api/demo
 * Alias for /api/process that always works in DEMO_MODE.
 * No Stripe, Supabase, or Anthropic required.
 */

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

const bodySchema = z.object({
  plan: z.enum(["sample", "starter", "standard", "pro"]).default("starter"),
  onboarding: z.object({
    company_name: text(1, 120),
    company_description: text(1, 800),
    offer_description: text(1, 800),
    value_proposition: text(1, 800),
    target_customer_description: text(1, 800),
    average_ticket: z.string().trim().max(120).optional(),
    tone: z.enum(["direct", "consultative", "casual"]).default("direct"),
    contact_email: z.string().trim().email().max(254),
    output_language: z.enum(["en", "es", "pt", "ja"]).optional(),
    target_market_region: z.enum(["north_america", "latin_america", "europe", "asia", "global"]).optional(),
  }).strict(),
}).strict();

export async function POST(req: NextRequest) {
  const availability = demoAvailability();
  if (!availability.allowed) {
    return NextResponse.json({ error: availability.error }, { status: availability.status });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 12_000) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }

  const rate = checkRateLimit(`demo:${requestClientKey(req.headers)}`, 3, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many demo requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const jobId = `demo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const report = await runLeadLensPipeline({
      onboardingData: parsed.data.onboarding,
      plan: parsed.data.plan,
      jobId,
    });

    return NextResponse.json({
      success: true,
      demo: true,
      data_origin: "demo",
      job_id: jobId,
      report,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/demo]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
