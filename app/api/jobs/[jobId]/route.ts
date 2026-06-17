import { NextRequest, NextResponse } from "next/server";
import { getJob, updateJob } from "@/lib/storage/job-store";
import { z } from "zod";

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const job = await getJob(params.jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json(job);
}

const patchSchema = z.object({
  status: z.enum(["pending", "processing", "completed", "error"]).optional(),
  stripe_session_id: z.string().optional(),
  completed_at: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await updateJob(params.jobId, parsed.data);
  if (!updated) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  return NextResponse.json(updated);
}
