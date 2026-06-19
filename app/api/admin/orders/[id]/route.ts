import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getOrderById,
  updateOrderStatus,
  getIntakeByOrderId,
  getSaasJobByOrderId,
  listJobEvents,
  listAdminNotes,
} from "@/lib/storage/saas-store";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const order = await getOrderById(params.id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Load related data in parallel
  const [intake, job, notes] = await Promise.all([
    getIntakeByOrderId(params.id),
    getSaasJobByOrderId(params.id),
    listAdminNotes({ order_id: params.id }),
  ]);

  const events = job ? await listJobEvents(job.id) : [];

  return NextResponse.json({ order, intake, job, events, notes });
}

const patchSchema = z.object({
  status:          z.enum(["paid", "refunded", "disputed", "cancelled"]).optional(),
  intake_status:   z.enum(["pending", "received", "complete"]).optional(),
  delivery_status: z.enum(["pending", "in_progress", "delivered", "failed"]).optional(),
  notes:           z.string().optional(),
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

  const updated = await updateOrderStatus(params.id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Order not found or update failed" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
