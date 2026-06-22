import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { addCredits } from "@/lib/credits/add-credits";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// POST /api/admin/credits/grant
// Manually grant credits to a customer.
// Body: { user_id: string, amount: number, description: string }

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  let body: { user_id?: string; amount?: number; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { user_id, amount, description } = body;

  if (!user_id || typeof user_id !== "string") {
    return NextResponse.json({ error: "user_id is required." }, { status: 400 });
  }
  if (!amount || typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount)) {
    return NextResponse.json({ error: "amount must be a positive integer." }, { status: 400 });
  }
  if (!description || typeof description !== "string" || !description.trim()) {
    return NextResponse.json({ error: "description is required." }, { status: 400 });
  }

  // Verify the user exists
  const { data: profile } = await client
    .from("profiles")
    .select("id, email")
    .eq("id", user_id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  const result = await addCredits(client, user_id, amount, description.trim(), "manual");

  return NextResponse.json({
    success:       true,
    user_id,
    granted:       amount,
    credit_balance: result.credit_balance,
  });
}
