import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getSaasJobById,
  updateSaasJob,
  listJobEvents,
  getReportByJobId,
} from "@/lib/storage/saas-store";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const job = await getSaasJobById(params.id);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const [events, report] = await Promise.all([
    listJobEvents(params.id),
    getReportByJobId(params.id),
  ]);

  // Return report metadata only (not full JSON) to keep response manageable
  const reportMeta = report
    ? { id: report.id, plan: report.plan, lead_count: report.lead_count, status: report.status, created_at: report.created_at }
    : null;

  return NextResponse.json({ job, events, report: reportMeta });
}

const patchSchema = z.object({
  status:         z.enum(["pending","awaiting_intake","intake_received","queued","processing","completed","error","delivered"]).optional(),
  admin_approved: z.boolean().optional(),
  error_message:  z.string().optional(),
  delivered_at:   z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await updateSaasJob(params.id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Job not found or update failed" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
