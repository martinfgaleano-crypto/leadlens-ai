import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServerClient } from "@/lib/supabase/server";
import { deriveCompanyType, type VaultCompanyRow } from "@/lib/admin/vault-view";

// Canonical Vault company detail: identity + observation state + associated material events +
// associated sources. Global public facts only — NO customer-relative Fit/Timing/Decision.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const db = createServerClient();
  if (!db) return NextResponse.json({ error: "Persistence unavailable" }, { status: 503 });

  const { data: company, error } = await db.from("vault_companies")
    .select("id,name,domain,website_url,industry,region,country,source_status,first_seen_at,last_seen_at,observation_count")
    .eq("id", params.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: signals } = await db.from("vault_signals")
    .select("id,source_id,signal_type,signal_summary,signal_date,created_at")
    .eq("company_id", params.id).order("signal_date", { ascending: false }).limit(100);
  const sigs = (signals ?? []) as Array<{ id: string; source_id: string | null; signal_type: string; signal_summary: string | null; signal_date: string | null; created_at: string }>;

  const sourceIds = Array.from(new Set(sigs.map((s) => s.source_id).filter(Boolean) as string[]));
  const { data: sources } = sourceIds.length
    ? await db.from("vault_sources").select("id,source_url,source_type,published_at,retrieved_at").in("id", sourceIds)
    : { data: [] as never[] };

  return NextResponse.json({
    company: { ...(company as VaultCompanyRow & { website_url: string | null }), companyType: deriveCompanyType(company as VaultCompanyRow) },
    events: sigs.map((s) => ({ id: s.id, type: s.signal_type, claim: s.signal_summary, date: s.signal_date, observedAt: s.created_at, hasSource: Boolean(s.source_id) })),
    sources: (sources ?? []).map((s: { id: string; source_url: string | null; source_type: string; published_at: string | null; retrieved_at: string | null }) => ({ id: s.id, url: s.source_url, type: s.source_type, publishedAt: s.published_at, retrievedAt: s.retrieved_at })),
  });
}
