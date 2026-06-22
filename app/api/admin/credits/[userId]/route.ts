import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getCreditBalance } from "@/lib/credits/get-credit-balance";
import { getCreditHistory } from "@/lib/credits/get-credit-history";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// GET /api/admin/credits/[userId]
// Returns a customer's profile, credit balance, and full transaction history.

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { userId } = params;

  const [profileRes, balance, history] = await Promise.all([
    client.from("profiles").select("id, email, full_name, plan, created_at").eq("id", userId).single(),
    getCreditBalance(client, userId),
    getCreditHistory(client, userId, 50),
  ]);

  if (profileRes.error || !profileRes.data) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  }

  return NextResponse.json({
    profile:     profileRes.data,
    balance:     balance ?? { credit_balance: 0, lifetime_credits: 0 },
    history,
  });
}
