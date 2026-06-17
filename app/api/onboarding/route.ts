import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createJob } from "@/lib/storage/job-store";
import type { PlanType, OnboardingData } from "@/types";

const onboardingSchema = z.object({
  plan: z.enum(["starter", "standard", "pro"]).default("starter"),
  company_name: z.string().min(1),
  company_description: z.string().min(5),
  offer_description: z.string().min(5),
  value_proposition: z.string().min(5),
  target_customer_description: z.string().min(5),
  average_ticket: z.string().optional(),
  tone: z.enum(["direct", "consultative", "casual"]),
  contact_email: z.string().email(),
  output_language: z.enum(["en", "es", "pt", "ja"]).optional(),
  target_market_region: z.enum(["north_america", "latin_america", "europe", "asia", "global"]).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { plan, ...onboardingFields } = parsed.data;
  const onboarding = onboardingFields as OnboardingData;

  const job = await createJob({
    plan: plan as PlanType,
    onboarding,
    customer_email: onboarding.contact_email,
  });

  return NextResponse.json({ job_id: job.id, status: job.status });
}
