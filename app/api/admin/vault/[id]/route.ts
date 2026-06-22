import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { findSimilarVaultLeads } from "@/lib/vault/find-similar-leads";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// ── GET /api/admin/vault/[id] ────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { data: lead, error } = await client
    .from("vault_leads")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !lead) return NextResponse.json({ error: "Vault lead not found." }, { status: 404 });

  // ── Search history: find lead_results rows that match this vault lead ───────

  let searchHistory: Array<{ search_id: string; search_name: string; created_at: string }> = [];

  // Build OR condition to match by email or normalized_company+contact_name
  const emailMatch   = lead.email         ? `email.eq.${lead.email}` : null;
  const companyMatch = (lead.normalized_company && lead.contact_name)
    ? null  // handled separately below
    : null;

  if (emailMatch) {
    const { data: resultRows } = await client
      .from("lead_results")
      .select("search_id, created_at")
      .eq("email", lead.email as string)
      .order("created_at", { ascending: false })
      .limit(20);

    if (resultRows && resultRows.length > 0) {
      const searchIds = Array.from(new Set((resultRows as { search_id: string }[]).map(r => r.search_id)));
      const { data: searches } = await client
        .from("lead_searches")
        .select("id, name, created_at")
        .in("id", searchIds);

      const searchMap = new Map(
        ((searches ?? []) as { id: string; name: string; created_at: string }[]).map(s => [s.id, s])
      );
      searchHistory = searchIds
        .map(sid => {
          const s = searchMap.get(sid);
          return s ? { search_id: s.id, search_name: s.name, created_at: s.created_at } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }
  } else if (lead.normalized_company && lead.contact_name) {
    const { data: resultRows } = await client
      .from("lead_results")
      .select("search_id, created_at")
      .eq("normalized_company", lead.normalized_company as string)
      .eq("contact_name", lead.contact_name as string)
      .order("created_at", { ascending: false })
      .limit(20);

    if (resultRows && resultRows.length > 0) {
      const searchIds = Array.from(new Set((resultRows as { search_id: string }[]).map(r => r.search_id)));
      const { data: searches } = await client
        .from("lead_searches")
        .select("id, name, created_at")
        .in("id", searchIds);

      const searchMap = new Map(
        ((searches ?? []) as { id: string; name: string; created_at: string }[]).map(s => [s.id, s])
      );
      searchHistory = searchIds
        .map(sid => {
          const s = searchMap.get(sid);
          return s ? { search_id: s.id, search_name: s.name, created_at: s.created_at } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
    }
  }

  // ── Similar leads ─────────────────────────────────────────────────────────

  const similar = await findSimilarVaultLeads(client, {
    id:       lead.id as string,
    domain:   lead.domain   as string | null,
    country:  lead.country  as string | null,
    seniority: lead.seniority as string | null,
  });

  return NextResponse.json({ lead, search_history: searchHistory, similar });
}
