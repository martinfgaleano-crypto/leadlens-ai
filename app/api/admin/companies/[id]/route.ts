import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { findSimilarCompanies } from "@/lib/company/similar-companies";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authErr = requireAdmin(req);
  if (authErr) return authErr;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  // ── Fetch company profile ──────────────────────────────────────────────────
  const { data: company, error } = await client
    .from("company_profiles")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  // ── Top contacts from vault_leads ──────────────────────────────────────────
  const { data: topContacts } = await client
    .from("vault_leads")
    .select("id, contact_name, title, normalized_title, seniority, email, country, opportunity_score, buyer_fit, temperature, linkedin_url")
    .eq("normalized_company", company.normalized_company)
    .order("opportunity_score", { ascending: false })
    .limit(8);

  // ── Recent searches via lead_results ──────────────────────────────────────
  // Find lead_results rows for this company, grab unique search_ids, join searches
  const { data: leadRows } = await client
    .from("lead_results")
    .select("search_id")
    .eq("normalized_company", company.normalized_company)
    .limit(50);

  const searchIds = Array.from(new Set((leadRows ?? []).map((r: { search_id: string }) => r.search_id))).slice(0, 10);
  let recentSearches: { id: string; name: string; created_at: string; status: string }[] = [];

  if (searchIds.length > 0) {
    const { data: searches } = await client
      .from("lead_searches")
      .select("id, name, created_at, status")
      .in("id", searchIds)
      .order("created_at", { ascending: false });
    recentSearches = searches ?? [];
  }

  // ── Similar companies ──────────────────────────────────────────────────────
  const similar = await findSimilarCompanies(client, {
    id:       company.id as string,
    industry: company.industry as string | null,
    domain:   company.domain   as string | null,
  });

  return NextResponse.json({ company, top_contacts: topContacts ?? [], recent_searches: recentSearches, similar });
}
