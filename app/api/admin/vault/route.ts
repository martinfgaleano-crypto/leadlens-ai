import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServerClient } from "@/lib/supabase/server";
import { buildCompanyViews, summarize, inventory, type VaultCompanyRow } from "@/lib/admin/vault-view";

// Canonical LeadLens Vault admin API. Reads the canonical global tables (vault_companies /
// vault_signals / vault_sources) and returns server-aggregated summary + composition + growth
// + a filtered, sorted, paginated company inventory. No contacts/emails/temperature/leads.
// No customer-relative fields. Admin-only.
export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable" }, { status: 503 });

  // The canonical company table is small (hundreds), so we aggregate once in memory rather
  // than issue GROUP BY / per-row queries (no N+1). Only bounded projections leave the server.
  const [companiesRes, signalsRes, sourcesCount] = await Promise.all([
    db.from("vault_companies").select("id,name,domain,industry,region,country,source_status,first_seen_at,last_seen_at,observation_count"),
    db.from("vault_signals").select("company_id,source_id"),
    db.from("vault_sources").select("id", { count: "exact" }).limit(1),
  ]);
  if (companiesRes.error) return NextResponse.json({ error: companiesRes.error.message }, { status: 500 });

  const companies = (companiesRes.data ?? []) as VaultCompanyRow[];
  const agg = new Map<string, { events: number; sourceIds: Set<string> }>();
  for (const s of (signalsRes.data ?? []) as Array<{ company_id: string | null; source_id: string | null }>) {
    if (!s.company_id) continue;
    const e = agg.get(s.company_id) ?? { events: 0, sourceIds: new Set<string>() };
    e.events += 1;
    if (s.source_id) e.sourceIds.add(s.source_id);
    agg.set(s.company_id, e);
  }
  const views = buildCompanyViews(companies, agg);
  const eventsTotal = (signalsRes.data ?? []).length;
  const sourcesTotal = sourcesCount.count ?? 0;
  const summary = summarize(views, eventsTotal, sourcesTotal);

  const sp = req.nextUrl.searchParams;
  const page = inventory(views, {
    q: sp.get("q") ?? undefined,
    country: sp.get("country") ?? undefined,
    companyType: sp.get("type") ?? undefined,
    page: sp.get("page") ? Number(sp.get("page")) : 1,
    pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 50,
  });
  return NextResponse.json({ summary, inventory: page, generatedAt: new Date().toISOString() });
}
