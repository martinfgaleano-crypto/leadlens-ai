import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { addAdminNote, listAdminNotes } from "@/lib/storage/saas-store";

const noteSchema = z.object({
  order_id:   z.string().uuid().optional(),
  job_id:     z.string().uuid().optional(),
  note:       z.string().min(1).max(2000),
  created_by: z.string().optional(),
}).refine((d) => d.order_id || d.job_id, {
  message: "Either order_id or job_id is required",
});

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const note = await addAdminNote(parsed.data);
  if (!note) {
    return NextResponse.json({ error: "Failed to save note (Supabase not configured?)" }, { status: 503 });
  }

  return NextResponse.json(note, { status: 201 });
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const order_id = req.nextUrl.searchParams.get("order_id") ?? undefined;
  const job_id   = req.nextUrl.searchParams.get("job_id")   ?? undefined;

  if (!order_id && !job_id) {
    return NextResponse.json({ error: "Provide order_id or job_id query param" }, { status: 400 });
  }

  const notes = await listAdminNotes({ order_id, job_id });
  return NextResponse.json({ notes, count: notes.length });
}
