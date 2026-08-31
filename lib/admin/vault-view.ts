// CANONICAL VAULT UI — pure view/aggregation layer (no I/O, fully testable).
// Derives a bounded company_type from existing metadata (no migration, Unknown when unclear),
// and aggregates the canonical Vault tables into summary / composition / growth / a filtered,
// sorted, paginated inventory. Company type is kept SEPARATE from industry.

export interface VaultCompanyRow {
  id: string; name: string; domain: string | null; industry: string | null;
  region: string | null; country: string | null; source_status: string | null;
  first_seen_at: string | null; last_seen_at: string | null; observation_count: number | null;
}
export interface VaultCompanyView extends VaultCompanyRow {
  companyType: string; eventCount: number; sourceCount: number;
}

export const VAULT_COMPANY_TYPES = [
  "Manufacturer", "Distributor", "Consultancy", "Professional Services", "Agency",
  "Software / SaaS", "Technology", "Healthcare", "Financial Services", "Retail",
  "Logistics", "Construction", "Energy", "Public Sector", "Nonprofit", "Other", "Unknown",
] as const;

/** Deterministic bounded company_type from name + industry. Unknown when no confident match
 *  (never fabricated). Reads the ORGANIZATION kind, not the industry vertical. */
export function deriveCompanyType(c: { name?: string | null; industry?: string | null }): string {
  const hay = `${c.name ?? ""} ${c.industry ?? ""}`.toLowerCase();
  if (/\b(consult|advisor|advisory)\b|consulting/.test(hay)) return "Consultancy";
  if (/\bagenc/.test(hay)) return "Agency";
  if (/manufactur|\bplant\b|production|factory|foundry|mills?\b|processing/.test(hay)) return "Manufacturer";
  if (/distribut|wholesal/.test(hay)) return "Distributor";
  if (/logistic|freight|3pl|warehous|supply chain|shipping|trucking/.test(hay)) return "Logistics";
  if (/software|\bsaas\b|\bapp\b|platform|cloud|semiconductor/.test(hay)) return "Software / SaaS";
  if (/health|hospital|pharma|medical|clinic|biotech|life science/.test(hay)) return "Healthcare";
  if (/\bbank|financ|insur|capital|invest|fintech|lending/.test(hay)) return "Financial Services";
  if (/retail|ecommerce|e-commerce|grocery|supermarket|\bstore/.test(hay)) return "Retail";
  if (/construct|building materials|engineering & construction/.test(hay)) return "Construction";
  if (/energy|oil|gas|utility|utilities|power|renewable|solar/.test(hay)) return "Energy";
  if (/government|public sector|ministry|municipal|federal agency/.test(hay)) return "Public Sector";
  if (/nonprofit|non-profit|\bngo\b|foundation\b/.test(hay)) return "Nonprofit";
  if (/professional services|staffing|law firm|accounting/.test(hay)) return "Professional Services";
  if (/technology|\btech\b|electronics|hardware|robotics|automation/.test(hay)) return "Technology";
  return "Unknown";
}

const ms = (d: string | null | undefined): number => (d ? new Date(d).getTime() : NaN);

/** Build per-company views with derived type + event/source counts. signalsByCompany maps
 *  company_id → { events, sourceIds } aggregated upstream (no N+1). */
export function buildCompanyViews(
  companies: VaultCompanyRow[],
  agg: Map<string, { events: number; sourceIds: Set<string> }>,
): VaultCompanyView[] {
  return companies.map((c) => ({
    ...c,
    companyType: deriveCompanyType(c),
    eventCount: agg.get(c.id)?.events ?? 0,
    sourceCount: agg.get(c.id)?.sourceIds.size ?? 0,
  }));
}

export interface VaultSummary {
  companies: number; events: number; sources: number; countries: number; companyTypes: number;
  newCompanies24h: number; reobserved24h: number; newCompanies7d: number; reobserved7d: number;
  byCountry: Array<{ key: string; count: number }>;
  byType: Array<{ key: string; count: number }>;
}

/** Aggregate summary + composition + growth over ALL company views (small table; done once). */
export function summarize(views: VaultCompanyView[], eventsTotal: number, sourcesTotal: number, now = Date.now()): VaultSummary {
  const H = 3600_000, d1 = 24 * H, d7 = 7 * d1;
  const inWin = (t: number, win: number) => Number.isFinite(t) && now - t <= win;
  // NEW = first_seen in window; REOBSERVED = last_seen in window AND strictly after first_seen.
  const isNew = (c: VaultCompanyView, win: number) => inWin(ms(c.first_seen_at), win);
  const isReobs = (c: VaultCompanyView, win: number) => inWin(ms(c.last_seen_at), win) && ms(c.last_seen_at) > ms(c.first_seen_at);
  const tally = (sel: (c: VaultCompanyView) => string | null) => {
    const m = new Map<string, number>();
    for (const c of views) { const k = (sel(c) || "Unknown").trim() || "Unknown"; m.set(k, (m.get(k) ?? 0) + 1); }
    return Array.from(m.entries()).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  };
  const byCountry = tally((c) => c.country);
  const byType = tally((c) => c.companyType);
  return {
    companies: views.length, events: eventsTotal, sources: sourcesTotal,
    countries: byCountry.filter((c) => c.key !== "Unknown").length,
    companyTypes: byType.filter((t) => t.key !== "Unknown").length,
    newCompanies24h: views.filter((c) => isNew(c, d1)).length,
    reobserved24h: views.filter((c) => isReobs(c, d1)).length,
    newCompanies7d: views.filter((c) => isNew(c, d7)).length,
    reobserved7d: views.filter((c) => isReobs(c, d7)).length,
    byCountry, byType,
  };
}

export interface InventoryQuery { q?: string; country?: string; companyType?: string; page?: number; pageSize?: number; }
export interface InventoryPage { items: VaultCompanyView[]; total: number; page: number; pageSize: number; pages: number; }

/** Filter (search name/domain, country, type) → sort (last_seen desc) → paginate. Pure. */
export function inventory(views: VaultCompanyView[], query: InventoryQuery): InventoryPage {
  const q = (query.q ?? "").trim().toLowerCase();
  let rows = views;
  if (q) rows = rows.filter((c) => c.name.toLowerCase().includes(q) || (c.domain ?? "").toLowerCase().includes(q));
  if (query.country) rows = rows.filter((c) => (c.country || "Unknown") === query.country);
  if (query.companyType) rows = rows.filter((c) => c.companyType === query.companyType);
  rows = [...rows].sort((a, b) => (ms(b.last_seen_at) || 0) - (ms(a.last_seen_at) || 0));
  const total = rows.length;
  const pageSize = Math.min(Math.max(query.pageSize ?? 50, 1), 200);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(query.page ?? 1, 1), pages);
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, pages };
}
