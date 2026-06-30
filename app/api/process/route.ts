import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runLeadLensPipeline } from "@/lib/pipeline";
import { saveSnapshot } from "@/lib/storage/snapshot-store";

/**
 * POST /api/process
 * Runs the full pipeline (DEMO or production depending on DEMO_MODE).
 * Persists the report to snapshot_reports (best-effort — never blocks response).
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

    const { plan, onboarding } = parsed.data;

    // Generate a stable job_id before the run so it's baked into the report
    const jobId = parsed.data.jobId ?? `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const report = await runLeadLensPipeline({
      onboardingData: onboarding,
      plan,
      jobId,
    });

    // Persist snapshot — best-effort, never blocks response
    saveSnapshot(jobId, plan, report).catch(() => {});

    return NextResponse.json({ success: true, job_id: jobId, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/process]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
