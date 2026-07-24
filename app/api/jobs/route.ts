import { NextRequest, NextResponse } from "next/server";
import { createJob, listRecentJobs } from "@/lib/storage/job-store";
import { z } from "zod";
import type { PlanType, OnboardingData } from "@/types";
import { requireAdmin } from "@/lib/auth/require-admin";

const createSchema = z.object({
  plan: z.enum(["sample", "starter", "standard", "pro"]),
  onboarding: z.object({
    company_name: z.string().min(1),
    company_description: z.string().min(1),
    offer_description: z.string().min(1),
    value_proposition: z.string().min(1),
    target_customer_description: z.string().min(1),
    average_ticket: z.string().optional(),
    tone: z.enum(["direct", "consultative", "casual"]),
    contact_email: z.string().email(),
    output_language: z.enum(["en", "es", "pt", "ja"]).optional(),
    target_market_region: z.enum(["north_america", "latin_america", "europe", "asia", "global"]).optional(),
    target_countries: z.array(z.string().min(2).max(60)).min(1).optional(),
  }),
  customer_email: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { plan, onboarding, customer_email } = parsed.data;
  const job = await createJob({
    plan: plan as PlanType,
    onboarding: onboarding as OnboardingData,
    customer_email: customer_email ?? onboarding.contact_email,
  });

  return NextResponse.json(job, { status: 201 });
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const jobs = await listRecentJobs(20);
  return NextResponse.json({ jobs, count: jobs.length });
}
