import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// ── GET /api/admin/vault ─────────────────────────────────────────────────────
// Paginated, filtered vault lead list.

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const q           = searchParams.get("q")?.trim()           ?? "";
  const country     = searchParams.get("country")?.trim()     ?? "";
  const industry    = searchParams.get("industry")?.trim()    ?? "";
  const temperature = searchParams.get("temperature")?.trim() ?? "";
  const page        = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage     = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10)));
  const from        = (page - 1) * perPage;
  const to          = from + perPage - 1;

  let query = client
    .from("vault_leads")
    .select(
      "id, company_name, normalized_company, contact_name, title, normalized_title, email, country, industry, source, times_seen, lead_score, opportunity_score, temperature, buyer_fit, seniority, created_at, last_seen",
      { count: "exact" },
    );

  if (q) {
    query = query.or(
      `company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%,normalized_company.ilike.%${q}%`,
    );
  }
  if (country)     query = query.eq("country", country);
  if (industry)    query = query.eq("industry", industry);
  if (temperature) query = query.eq("temperature", temperature);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    leads:       data ?? [],
    total:       count ?? 0,
    page,
    per_page:    perPage,
    total_pages: Math.ceil((count ?? 0) / perPage),
  });
}
