import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { InMemoryMarketMemoryRepository, memoryDecision, normalizeUrl, toMarketRows } from "../../lib/intelligence/market-memory-store";
import type { MarketResearchUniverseV1 } from "../../lib/intelligence/market-research-universe";

async function main() {
  const universe = JSON.parse(readFileSync("output/pilot2/2026-09-30-market-universe-v2/market-research-universe.json", "utf8")) as MarketResearchUniverseV1;
  const scope = { tenant_user_id: "tenant-a", client_id: "client-a", objective_fingerprint: "amor-us", category_context: "premium non-alcoholic beverage" };
  const rows = toMarketRows(universe, scope, { "https://www.naturalgrocers.com/vendors": { content_sha256: "abc", extractor: "basic_html" } });
  assert.equal(rows.sources.length, universe.market_sources.length); assert.equal(rows.snapshot.objective_fingerprint, "amor-us");
  const repo = new InMemoryMarketMemoryRepository(); await repo.persist(rows.snapshot, rows.sources); await repo.persist(rows.snapshot, rows.sources);
  assert.equal(repo.snapshots.length, 1); assert.equal(repo.sources.length, universe.market_sources.length);
  assert.equal((await repo.loadLatest(scope))?.fingerprint, rows.snapshot.fingerprint);
  assert.equal(await repo.loadLatest({ ...scope, tenant_user_id: "tenant-b" }), null);
  assert.equal((await repo.loadSource(scope, "https://www.naturalgrocers.com/vendors?utm_source=x#top"))?.content_sha256, "abc");
  assert.equal(memoryDecision(rows.snapshot, new Date(universe.generated_at)), "REUSE");
  assert.equal(memoryDecision({ ...rows.snapshot, freshness_until: "2020-01-01T00:00:00Z" }, new Date("2026-01-01")), "REFRESH");
  assert.equal(memoryDecision(null), "RESEARCH_AGAIN");
  assert.equal(normalizeUrl("https://example.com/a?utm_source=x&q=1#x"), "https://example.com/a?q=1");
  console.log("market-memory-store: 10/10 passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
