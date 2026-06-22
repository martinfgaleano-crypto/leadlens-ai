import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

// ─── Internal: service-role Supabase client ───────────────────────────────────

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// ─── GET /api/admin/searches/[id] ────────────────────────────────────────────
// Returns one search enriched with customer profile email and linked ICP detail.

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 503 }
    );
  }

  const { data: search, error } = await client
    .from("lead_searches")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !search) {
    return NextResponse.json({ error: "Search not found" }, { status: 404 });
  }

  // Fetch profile and ICP in parallel
  const [profileRes, icpRes] = await Promise.all([
    client.from("profiles").select("id, email, plan, credits_remaining").eq("id", search.user_id).single(),
    search.icp_id
      ? client.from("icps").select("*").eq("id", search.icp_id).single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return NextResponse.json({
    search,
    profile: profileRes.data ?? null,
    icp:     icpRes.data     ?? null,
  });
}

// ─── PATCH /api/admin/searches/[id] ──────────────────────────────────────────
// Allows admin to update status and/or admin_notes.
// Uses service role — bypasses the "no UPDATE" RLS policy for authenticated users.

const patchSchema = z.object({
  status:      z.enum(["pending", "processing", "completed", "failed"]).optional(),
  admin_notes: z.string().nullable().optional(),
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

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const client = await db();
  if (!client) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  }

  const { data, error } = await client
    .from("lead_searches")
    .update(parsed.data)
    .eq("id", params.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Update failed or search not found" },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json(data);
}
