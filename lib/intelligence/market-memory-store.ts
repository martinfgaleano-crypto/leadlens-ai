import { createHash } from "node:crypto";
import type { MarketResearchUniverseV1, MarketSource } from "./market-research-universe";

export const MARKET_MEMORY_VERSION = "market-memory-v1" as const;
export interface MarketMemoryScope { tenant_user_id: string | null; client_id: string | null; objective_fingerprint: string; category_context: string | null; }
export interface MarketSnapshotRow { universe_id: string; version: string; tenant_user_id: string | null; client_id: string | null; objective_fingerprint: string; geography: string[]; category_context: string | null; generated_at: string; freshness_until: string | null; fingerprint: string; snapshot: MarketResearchUniverseV1; }
export interface MarketSourceRow { tenant_user_id: string | null; client_id: string | null; universe_id: string; source_id: string; canonical_url: string; domain: string; source_type: string; relationship: string; route_ids: string[]; account_refs: string[]; published_at: string | null; retrieved_at: string; content_sha256: string | null; extraction_provenance: Record<string, unknown> | null; observation: MarketSource; }
export interface MarketMemoryRepository { persist(snapshot: MarketSnapshotRow, sources: MarketSourceRow[]): Promise<void>; loadLatest(scope: MarketMemoryScope): Promise<MarketSnapshotRow | null>; loadSource(scope: MarketMemoryScope, canonicalUrl: string): Promise<MarketSourceRow | null>; }

export function marketFingerprint(universe: MarketResearchUniverseV1): string {
  return createHash("sha256").update(JSON.stringify({ version: universe.version, objective: universe.objective, geography: universe.geography, routes: universe.route_research, mechanisms: universe.commercial_mechanisms, access: universe.access_paths, claims: universe.claims, sources: universe.market_sources })).digest("hex");
}
export function toMarketRows(universe: MarketResearchUniverseV1, scope: MarketMemoryScope, provenanceByUrl: Record<string, Record<string, unknown>> = {}): { snapshot: MarketSnapshotRow; sources: MarketSourceRow[] } {
  const fingerprint = marketFingerprint(universe);
  const freshnessUntil = new Date(new Date(universe.generated_at).getTime() + 30 * 86_400_000).toISOString();
  return {
    snapshot: { universe_id: universe.universe_id, version: universe.version, tenant_user_id: scope.tenant_user_id, client_id: scope.client_id, objective_fingerprint: scope.objective_fingerprint, geography: universe.geography, category_context: scope.category_context, generated_at: universe.generated_at, freshness_until: freshnessUntil, fingerprint, snapshot: universe },
    sources: universe.market_sources.map((source) => ({ tenant_user_id: scope.tenant_user_id, client_id: scope.client_id, universe_id: universe.universe_id, source_id: source.source_id, canonical_url: normalizeUrl(source.url), domain: source.domain, source_type: source.source_type, relationship: source.relationship, route_ids: source.route_ids, account_refs: source.account_refs, published_at: source.published_at, retrieved_at: source.retrieved_at, content_sha256: String(provenanceByUrl[source.url]?.content_sha256 ?? "") || null, extraction_provenance: provenanceByUrl[source.url] ?? null, observation: source })),
  };
}
export function normalizeUrl(raw: string): string { const url = new URL(raw); url.hash = ""; for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key); return url.toString(); }
export function memoryDecision(row: MarketSnapshotRow | null, now = new Date()): "RESEARCH_AGAIN" | "REFRESH" | "REUSE" {
  if (!row) return "RESEARCH_AGAIN";
  if (!row.freshness_until || new Date(row.freshness_until).getTime() <= now.getTime()) return "REFRESH";
  return "REUSE";
}

export class InMemoryMarketMemoryRepository implements MarketMemoryRepository {
  snapshots: MarketSnapshotRow[] = []; sources: MarketSourceRow[] = [];
  async persist(snapshot: MarketSnapshotRow, sources: MarketSourceRow[]) { if (!this.snapshots.some((r) => r.tenant_user_id === snapshot.tenant_user_id && r.client_id === snapshot.client_id && r.universe_id === snapshot.universe_id && r.fingerprint === snapshot.fingerprint)) this.snapshots.push(snapshot); for (const source of sources) if (!this.sources.some((r) => r.tenant_user_id === source.tenant_user_id && r.client_id === source.client_id && r.universe_id === source.universe_id && r.source_id === source.source_id && r.retrieved_at === source.retrieved_at)) this.sources.push(source); }
  async loadLatest(scope: MarketMemoryScope) { return this.snapshots.filter((r) => r.tenant_user_id === scope.tenant_user_id && r.client_id === scope.client_id && r.objective_fingerprint === scope.objective_fingerprint).sort((a, b) => b.generated_at.localeCompare(a.generated_at))[0] ?? null; }
  async loadSource(scope: MarketMemoryScope, canonicalUrl: string) { return this.sources.filter((r) => r.tenant_user_id === scope.tenant_user_id && r.client_id === scope.client_id && r.canonical_url === normalizeUrl(canonicalUrl)).sort((a, b) => b.retrieved_at.localeCompare(a.retrieved_at))[0] ?? null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class SupabaseMarketMemoryRepository implements MarketMemoryRepository { constructor(private db: any) {}
  async persist(snapshot: MarketSnapshotRow, sources: MarketSourceRow[]) { const s = await this.db.from("market_intelligence_snapshots").upsert(snapshot, { onConflict: "tenant_user_id,client_id,universe_id,fingerprint", ignoreDuplicates: true }); if (s.error) throw new Error(`market_memory_snapshot_failed:${s.error.message}`); if (sources.length) { const r = await this.db.from("market_source_observations").upsert(sources, { onConflict: "tenant_user_id,client_id,universe_id,source_id,retrieved_at", ignoreDuplicates: true }); if (r.error) throw new Error(`market_memory_sources_failed:${r.error.message}`); } }
  async loadLatest(scope: MarketMemoryScope) { let q = this.db.from("market_intelligence_snapshots").select("*").eq("objective_fingerprint", scope.objective_fingerprint).order("generated_at", { ascending: false }).limit(1); q = scope.tenant_user_id ? q.eq("tenant_user_id", scope.tenant_user_id) : q.is("tenant_user_id", null); q = scope.client_id ? q.eq("client_id", scope.client_id) : q.is("client_id", null); const { data, error } = await q.maybeSingle(); if (error) throw new Error(`market_memory_read_failed:${error.message}`); return data ?? null; }
  async loadSource(scope: MarketMemoryScope, canonicalUrl: string) { let q = this.db.from("market_source_observations").select("*").eq("canonical_url", normalizeUrl(canonicalUrl)).order("retrieved_at", { ascending: false }).limit(1); q = scope.tenant_user_id ? q.eq("tenant_user_id", scope.tenant_user_id) : q.is("tenant_user_id", null); q = scope.client_id ? q.eq("client_id", scope.client_id) : q.is("client_id", null); const { data, error } = await q.maybeSingle(); if (error) throw new Error(`market_source_read_failed:${error.message}`); return data ?? null; }
}
