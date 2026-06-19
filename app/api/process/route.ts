import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runLeadLensPipeline } from "@/lib/pipeline";

/**
 * POST /api/process
 * Runs the full pipeline (DEMO or production depending on DEMO_MODE).
 */

const bodySchema = z.object({
  plan: z.enum(["sample", "starter", "standard", "pro"]).default("starter"),
  onboarding: z.object({
    company_name: z.string().min(1),
    company_description: z.string().min(1),
    offer_description: z.string().min(1),
    value_proposition: z.string().min(1),
    target_customer_description: z.string().min(1),
    average_ticket: z.string().optional(),
    tone: z.enum(["direct", "consultative", "casual"]).default("direct"),
    contact_email: z.string().email(),
    output_language: z.enum(["en", "es", "pt", "ja"]).optional(),
    target_market_region: z.enum(["north_america", "latin_america", "europe", "asia", "global"]).optional(),
  }),
  jobId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { plan, onboarding, jobId } = parsed.data;

    const report = await runLeadLensPipeline({
      onboardingData: onboarding,
      plan,
      jobId,
    });

    return NextResponse.json({ success: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/process]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
