import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// GET /api/admin/credits
// Returns all customer credit balances joined with their profile email.

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  // Fetch credits joined with profile email via FK (customer_credits.user_id -> profiles.id)
  const { data, error } = await client
    .from("customer_credits")
    .select("user_id, credit_balance, lifetime_credits, updated_at, profiles(email)")
    .order("credit_balance", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ customers: data ?? [] });
}
