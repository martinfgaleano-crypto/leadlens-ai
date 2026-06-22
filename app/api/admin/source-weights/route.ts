import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// GET /api/admin/source-weights
// Returns all source weight configuration rows ordered by priority.

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data, error } = await client
    .from("source_weights")
    .select("*")
    .order("priority", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ weights: data ?? [] });
}
