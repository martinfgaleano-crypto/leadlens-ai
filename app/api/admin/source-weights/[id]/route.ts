import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// PATCH /api/admin/source-weights/[id]
// Updates active, weight, and/or priority for a source weight row.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  let body: { active?: boolean; weight?: number; priority?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.active === "boolean") {
    patch.active = body.active;
  }
  if (typeof body.weight === "number") {
    if (body.weight < 0 || body.weight > 10) {
      return NextResponse.json({ error: "weight must be between 0 and 10." }, { status: 400 });
    }
    patch.weight = body.weight;
  }
  if (typeof body.priority === "number") {
    if (!Number.isInteger(body.priority)) {
      return NextResponse.json({ error: "priority must be an integer." }, { status: 400 });
    }
    patch.priority = body.priority;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { data, error } = await client
    .from("source_weights")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "Source weight not found." }, { status: 404 });

  return NextResponse.json({ weight: data });
}
