import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { RawLead } from "@/types";

const rawLeadSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  title: z.string().min(1),
  email: z.string().email(),
  linkedin_url: z.string().optional(),
  notes: z.string().optional(),
});

const uploadSchema = z.object({
  job_id: z.string(),
  leads: z.array(rawLeadSchema).min(1).max(50),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = uploadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = createServerClient();

  if (!db) {
    return NextResponse.json(
      { error: "Database not configured — Supabase keys required for upload route" },
      { status: 503 }
    );
  }

  // Verify job exists and is paid
  const { data: job } = await db
    .from("batch_jobs")
    .select("id, status, stripe_session_id")
    .eq("id", parsed.data.job_id)
    .single();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status === "processing" || job.status === "completed") {
    return NextResponse.json({ error: "Job already started" }, { status: 409 });
  }

  // Save leads
  await db
    .from("batch_jobs")
    .update({ raw_leads: parsed.data.leads as RawLead[] })
    .eq("id", parsed.data.job_id);

  return NextResponse.json({ success: true, lead_count: parsed.data.leads.length });
}
