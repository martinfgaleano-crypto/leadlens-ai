import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

const leadSchema = z.object({
  company_name: z.string().min(1),
  website:      z.string().nullable().optional(),
  contact_name: z.string().nullable().optional(),
  title:        z.string().nullable().optional(),
  email:        z.string().nullable().optional(),
  linkedin_url: z.string().nullable().optional(),
  country:      z.string().nullable().optional(),
  source:       z.string().nullable().optional(),
  notes:        z.string().nullable().optional(),
});

// ─── GET /api/admin/searches/[id]/results ─────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data, error } = await client
    .from("lead_results")
    .select("*")
    .eq("search_id", params.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ results: data ?? [] });
}

// ─── POST /api/admin/searches/[id]/results ────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data, error } = await client
    .from("lead_results")
    .insert({ ...parsed.data, search_id: params.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
