#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "../lib/load-env.mjs";
import { createServerClient } from "../../lib/supabase/server";
import { SupabaseMarketMemoryRepository, toMarketRows } from "../../lib/intelligence/market-memory-store";
import type { MarketResearchUniverseV1 } from "../../lib/intelligence/market-research-universe";
for (const [key, value] of Object.entries(loadEnv())) if (typeof value === "string") process.env[key] = value;

async function main() {
  const path = process.env.PILOT2_MARKET_UNIVERSE ?? "output/pilot2/2026-09-30-market-universe-v2/market-research-universe.json";
  const universe = JSON.parse(readFileSync(path, "utf8")) as MarketResearchUniverseV1;
  const attemptsPath = path.replace("market-research-universe.json", "commercial-depth-research.json");
  const attempts = JSON.parse(readFileSync(attemptsPath, "utf8")) as { telemetry?: Array<{ url?: string; provenance?: Record<string, unknown> | null }> };
  const provenance = Object.fromEntries((attempts.telemetry ?? []).filter((row) => row.url && row.provenance).map((row) => [row.url!, row.provenance!]));
  const scope = { tenant_user_id: process.env.PILOT2_TENANT_USER_ID ?? null, client_id: process.env.PILOT2_CLIENT_ID ?? null, objective_fingerprint: "amor-de-gea:pilot2:us-national:premium-botanical-wellness-beverage", category_context: "Premium botanical wellness beverage commercial routes in the United States" };
  const rows = toMarketRows(universe, scope, provenance);
  const db = createServerClient();
  const result = { attempted_at: new Date().toISOString(), migration_required: "066_market_intelligence_memory.sql", configured: Boolean(db), persisted: false, snapshot_fingerprint: rows.snapshot.fingerprint, sources: rows.sources.length, error: null as string | null };
  if (db) try { await new SupabaseMarketMemoryRepository(db).persist(rows.snapshot, rows.sources); result.persisted = true; } catch (error) { result.error = error instanceof Error ? error.message : String(error); }
  writeFileSync(path.replace("market-research-universe.json", "market-memory-persistence.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!result.persisted) process.exitCode = 2;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
