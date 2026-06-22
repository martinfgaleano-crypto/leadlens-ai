import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

// ─── Internal: service-role Supabase client ───────────────────────────────────

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// ─── GET /api/admin/searches ──────────────────────────────────────────────────
// Returns all lead_searches enriched with customer email (from profiles)
// and ICP name (from icps). Uses service role — bypasses RLS entirely.

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) {
    return NextResponse.json(
      { error: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }

  const url    = req.nextUrl;
  const status = url.searchParams.get("status") ?? undefined;
  const limit  = Math.min(Number(url.searchParams.get("limit")  ?? "100"), 500);
  const offset = Number(url.searchParams.get("offset") ?? "0");

  // Fetch searches
  let query = client
    .from("lead_searches")
    .select("id, user_id, icp_id, name, status, requested_lead_count, created_at, updated_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq("status", status);

  const { data: searches, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!searches || searches.length === 0) {
    return NextResponse.json({ searches: [] });
  }

  // Batch-fetch profiles (customer emails) and ICPs — single query each
  const userIds = Array.from(new Set(searches.map((s) => s.user_id as string)));
  const icpIds  = Array.from(new Set(searches.map((s) => s.icp_id as string | null).filter(Boolean))) as string[];

  const [profilesRes, icpsRes] = await Promise.all([
    client.from("profiles").select("id, email").in("id", userIds),
    icpIds.length > 0
      ? client.from("icps").select("id, name").in("id", icpIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profileMap = Object.fromEntries(
    (profilesRes.data ?? []).map((p) => [p.id as string, p.email as string | null])
  );
  const icpMap = Object.fromEntries(
    (icpsRes.data ?? []).map((i) => [i.id as string, i.name as string])
  );

  const enriched = searches.map((s) => ({
    ...s,
    customer_email: profileMap[s.user_id as string] ?? "—",
    icp_name:       s.icp_id ? (icpMap[s.icp_id as string] ?? "Deleted ICP") : null,
  }));

  return NextResponse.json({ searches: enriched });
}
