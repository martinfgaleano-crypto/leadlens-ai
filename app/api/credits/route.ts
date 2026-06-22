import { NextRequest, NextResponse } from "next/server";
import { getCreditBalance } from "@/lib/credits/get-credit-balance";
import { getCreditHistory } from "@/lib/credits/get-credit-history";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// GET /api/credits
// Returns the authenticated customer's credit balance and recent transactions.
// Auth: Bearer <supabase JWT> in Authorization header.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: { user }, error: authErr } = await client.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
  }

  const [balance, transactions] = await Promise.all([
    getCreditBalance(client, user.id),
    getCreditHistory(client, user.id, 10),
  ]);

  return NextResponse.json({
    credit_balance:      balance?.credit_balance   ?? 0,
    lifetime_credits:    balance?.lifetime_credits  ?? 0,
    recent_transactions: transactions,
  });
}
