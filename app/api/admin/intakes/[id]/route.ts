import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { updateCustomerIntake } from "@/lib/storage/saas-store";

const patchSchema = z.object({
  clarity_score: z.number().int().min(1).max(10).optional(),
  notes:         z.string().optional(),
  status:        z.enum(["pending", "processing", "ready", "error"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await updateCustomerIntake(params.id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Intake not found or update failed" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
