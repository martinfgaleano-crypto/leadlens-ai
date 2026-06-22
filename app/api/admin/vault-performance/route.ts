import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

async function db() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createServerClient } = await import("@/lib/supabase/server");
  return createServerClient();
}

// GET /api/admin/vault-performance
// Returns aggregated vault reuse stats + paginated search list.
// Query params: page, per_page, status

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const client = await db();
  if (!client) return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page")     ?? "1",  10));
  const perPage  = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10)));
  const status   = searchParams.get("status") ?? "";

  // ── Stats: pull all completed searches that have vault data ─────────────────

  let statsQ = client
    .from("lead_searches")
    .select("vault_leads_used, apollo_leads_used, vault_hit_rate, requested_lead_count")
    .eq("status", "completed")
    .not("vault_leads_used", "is", null)
    .not("apollo_leads_used", "is", null);

  const { data: statsRows } = await statsQ;

  type StatsRow = {
    vault_leads_used:   number;
    apollo_leads_used:  number;
    vault_hit_rate:     number;
    requested_lead_count: number;
  };

  const rows = (statsRows ?? []) as StatsRow[];

  const totalSearches    = rows.length;
  const vaultSearches    = rows.filter(r => r.vault_leads_used > 0).length;
  const totalVaultLeads  = rows.reduce((s, r) => s + (r.vault_leads_used  ?? 0), 0);
  const totalApolloLeads = rows.reduce((s, r) => s + (r.apollo_leads_used ?? 0), 0);
  const avgHitRate       = totalSearches > 0
    ? Math.round((rows.reduce((s, r) => s + (r.vault_hit_rate ?? 0), 0) / totalSearches) * 100) / 100
    : 0;

  // ── Paginated list ───────────────────────────────────────────────────────────

  let listQ = client
    .from("lead_searches")
    .select(
      "id, name, status, requested_lead_count, vault_leads_used, apollo_leads_used, vault_hit_rate, created_at, updated_at, profiles(email)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (status) {
    listQ = listQ.eq("status", status);
  }

  const { data: listData, count } = await listQ;

  type SearchRow = {
    id: string; name: string; status: string;
    requested_lead_count: number;
    vault_leads_used: number; apollo_leads_used: number; vault_hit_rate: number;
    created_at: string; updated_at: string;
    profiles: { email: string | null } | { email: string | null }[] | null;
  };

  const searches = ((listData ?? []) as unknown as SearchRow[]).map(r => ({
    ...r,
    user_email: Array.isArray(r.profiles)
      ? (r.profiles[0]?.email ?? null)
      : (r.profiles?.email ?? null),
    profiles: undefined,
  }));

  return NextResponse.json({
    stats: {
      total_searches:     totalSearches,
      vault_searches:     vaultSearches,
      total_vault_leads:  totalVaultLeads,
      total_apollo_leads: totalApolloLeads,
      avg_hit_rate:       avgHitRate,
    },
    searches,
    total:    count ?? 0,
    page,
    per_page: perPage,
  });
}
