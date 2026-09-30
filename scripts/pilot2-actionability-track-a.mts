#!/usr/bin/env node
/** Bounded Pilot 2 Track A: deepen the strongest existing Validate accounts for
 * observable supplier access, an open commercial mechanism, and current timing.
 * Search results are evidence candidates only; this script never changes a Case. */
import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnv } from "./lib/load-env.mjs";
const env = loadEnv();
for (const [key, value] of Object.entries(env)) if (typeof value === "string") process.env[key] = value;
const { braveProvider } = await import("@/lib/sources/access/providers");

const accounts = [
  { company: "Sprouts Farmers Market", domain: "sprouts.com" },
  { company: "Natural Grocers", domain: "naturalgrocers.com" },
  { company: "Earth Fare", domain: "earthfare.com" },
];
const families = [
  { id: "supplier_access", phrase: "vendor supplier application submit product" },
  { id: "category_review", phrase: "new brands category review beverage buyer" },
  { id: "current_timing", phrase: "2026 new stores expansion opening" },
];
const output = process.env.PILOT2_ACTIONABILITY_OUTPUT ?? "output/pilot2/2026-09-30-actionability-v1/track-a-search.json";
const observations: unknown[] = [];
for (const account of accounts) for (const family of families) {
  const query = `site:${account.domain} ${account.company} ${family.phrase}`;
  const response = await braveProvider.search({ query, max_results: 5, freshness_days: family.id === "current_timing" ? 365 : undefined, query_type: "actionability_deepening", search_mode: "standard" });
  observations.push({ account, family: family.id, query, provider: response.provider, ok: response.ok, error: response.error, latency_ms: response.latency_ms, results: response.results });
}
mkdirSync(output.slice(0, output.lastIndexOf("/")), { recursive: true });
writeFileSync(output, JSON.stringify({ version: "pilot2-actionability-track-a-v1", created_at: new Date().toISOString(), accounts: accounts.length, queries: accounts.length * families.length, observations }, null, 2));
console.log(JSON.stringify({ output, accounts: accounts.length, queries: accounts.length * families.length, successful: observations.filter((x: any) => x.ok).length }));
