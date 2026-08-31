#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { loadCliEnv } from "../../lib/discovery/source-intelligence/provider-env";
import { runEventFirstDiscovery } from "../../lib/lead-hunter/event-first-discovery";
import type { DiscoveryPlan } from "../../lib/lead-hunter/candidate-universe";

loadCliEnv(process.cwd());

const base = (id: string, organizationTypes: string[], industries: string[], geography: string, signals: string[]): DiscoveryPlan => ({
  contextRef: { contextId: id, version: 1 }, objectiveType: "sales_opportunities", targetRelationship: "buyer",
  organizationTypes, industries, geographies: [geography], routes: [], exclusions: ["publisher", "government authority", "consultancy"], namedAccountSeeds: [],
  watchSignalFamilies: signals as DiscoveryPlan["watchSignalFamilies"],
  budget: { maxRoutes: 4, maxProviderCalls: 18, maxCandidatesPerRoute: 12, maxExtractions: 8, maxRetries: 0, timeoutMs: 60_000 }, planGaps: [],
});

const allContexts = [
  base("us_manufacturing", ["manufacturer"], ["food and beverage manufacturing"], "United States", ["new_facility", "capacity", "investment"]),
  base("us_logistics", ["logistics operator", "distributor"], ["logistics and distribution"], "United States", ["new_facility", "contract_award", "capacity"]),
  base("us_operations_saas", ["software company"], ["B2B operational software"], "United States", ["expansion", "new_market", "partnership"]),
  base("co_manufacturing", ["fabricante"], ["manufactura de alimentos y bebidas"], "Colombia", ["new_facility", "capacity", "investment"]),
  base("co_logistics", ["operador logistico", "distribuidor"], ["logistica y distribucion"], "Colombia", ["new_facility", "contract_award", "capacity"]),
];
const requested = new Set(process.argv.slice(2));
const contexts = requested.size ? allContexts.filter(plan => requested.has(plan.contextRef.contextId)) : allContexts;

async function main() {
  const { tavilyProvider, braveProvider, serperProvider } = await import("../../lib/sources/access/providers");
  const started = Date.now();
  const rows = [];
  for (const plan of contexts) {
    const t0 = Date.now();
    const result = await runEventFirstDiscovery(plan, [tavilyProvider, braveProvider, serperProvider], { maxQueries: 4, maxIdentityQueries: 3 });
    rows.push({ context: plan.contextRef.contextId, geography: plan.geographies[0], duration_ms: Date.now() - t0, ...result });
    console.log(JSON.stringify({ context: plan.contextRef.contextId, duration_ms: Date.now() - t0, metrics: result.metrics, companies: result.orgs.map(x => ({ name: x.name, domain: x.domain, country: x.country, source_url: x.sourceUrl })) }));
  }
  const artifact = { version: "event-first-recall-benchmark-v1", generated_at: new Date().toISOString(), duration_ms: Date.now() - started, contexts: rows };
  mkdirSync("ml/data/acceptance", { recursive: true });
  const path = `ml/data/acceptance/event-first-recall-${Date.now()}.json`;
  writeFileSync(path, JSON.stringify(artifact, null, 2));
  console.log(JSON.stringify({ path, duration_ms: artifact.duration_ms }));
}

main().catch((error) => { console.error(error); process.exit(1); });
