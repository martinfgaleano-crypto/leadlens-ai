import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  createCustomerIntake,
  getOrderById,
  getSaasJobByOrderId,
  updateOrderStatus,
  updateSaasJob,
  addJobEvent,
} from "@/lib/storage/saas-store";
import type { OnboardingData } from "@/types";

const intakeSchema = z.object({
  order_id:                    z.string().uuid(),
  customer_email:              z.string().email(),
  // OnboardingData core fields
  company_name:                z.string().min(1),
  company_description:         z.string().min(1),
  offer_description:           z.string().min(1),
  value_proposition:           z.string().min(1),
  target_customer_description: z.string().min(1),
  average_ticket:              z.string().optional(),
  tone:                        z.enum(["direct", "consultative", "casual"]).default("direct"),
  output_language:             z.enum(["en", "es", "pt", "ja"]).default("en"),
  target_market_region:        z.enum(["north_america", "latin_america", "europe", "asia", "global"]).optional(),
  // Extended intake-only fields
  website:                     z.string().optional(),
  target_industry:             z.string().optional(),
  target_geography:            z.string().optional(),
  target_company_size:         z.string().optional(),
  buyer_titles:                z.array(z.string()).optional(),
  exclusions:                  z.string().optional(),
  existing_customer_examples:  z.string().optional(),
  notes:                       z.string().optional(),
  clarity_score:               z.number().int().min(1).max(10).optional(),
});

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = intakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  // Verify order exists
  const order = await getOrderById(d.order_id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Build OnboardingData
  const onboardingData: OnboardingData = {
    company_name:                d.company_name,
    company_description:         d.company_description,
    offer_description:           d.offer_description,
    value_proposition:           d.value_proposition,
    target_customer_description: d.target_customer_description,
    average_ticket:              d.average_ticket,
    tone:                        d.tone,
    contact_email:               d.customer_email,
    output_language:             d.output_language,
    target_market_region:        d.target_market_region,
  };

  // Create intake
  const intake = await createCustomerIntake({
    order_id:                   d.order_id,
    customer_email:             d.customer_email,
    onboarding_data:            onboardingData,
    website:                    d.website,
    target_company_size:        d.target_company_size,
    buyer_titles:               d.buyer_titles,
    exclusions:                 d.exclusions,
    existing_customer_examples: d.existing_customer_examples,
    notes:                      d.notes,
  });

  if (!intake) {
    return NextResponse.json({ error: "Failed to create intake" }, { status: 500 });
  }

  // Update order intake_status
  await updateOrderStatus(d.order_id, { intake_status: "received" });

  // Update related job if exists
  const job = await getSaasJobByOrderId(d.order_id);
  if (job) {
    await updateSaasJob(job.id, {
      intake_id: intake.id,
      status:    "intake_received",
    });
    await addJobEvent({
      job_id:     job.id,
      order_id:   d.order_id,
      event_type: "intake_received",
      message:    `Intake submitted for ${d.company_name}`,
    });
  }

  return NextResponse.json({ intake, job_id: job?.id ?? null }, { status: 201 });
}
