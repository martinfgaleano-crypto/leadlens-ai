#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadEnv } from "../lib/load-env.mjs";
import { extractWithFallback } from "../../lib/sources/access/extractors";
import { buildMarketResearchCharts, summarizeCoverage, validateMarketResearchUniverse, type MarketResearchUniverseV1 } from "../../lib/intelligence/market-research-universe";
for (const [key, value] of Object.entries(loadEnv())) if (typeof value === "string") process.env[key] = value;

const path = process.env.PILOT2_MARKET_UNIVERSE ?? "output/pilot2/2026-09-30-market-universe-v2/market-research-universe.json";
const universe = JSON.parse(readFileSync(path, "utf8")) as MarketResearchUniverseV1;
const targets = [
  { account: "Natural Grocers", route: "natural_specialty_grocery", sourceId: "src:1", type: "new_item_submission", pattern: /new item submissions?|submit(?:ting)? (?:a |your )?product|vendor/i },
  { account: "KeHE Distributors", route: "natural_products_distribution", sourceId: "src:33", type: "brand_supplier_submission", pattern: /submit your products?|supplier|become a supplier|brand submission/i },
  { account: "Gourmet International", route: "specialty_food_beverage_import", sourceId: "src:39", type: "supplier_or_brand_onboarding", pattern: /become (?:a )?(?:supplier|vendor)|submit (?:a |your )?(?:brand|product)|supplier (?:application|registration|inquiry)/i },
  { account: "Savor Imports", route: "specialty_food_beverage_import", sourceId: "src:40", type: "supplier_or_brand_onboarding", pattern: /become (?:a )?(?:supplier|vendor)|submit (?:a |your )?(?:brand|product)|supplier (?:application|registration|inquiry)/i },
];
const attempts: Array<Record<string, unknown>> = [];

async function main() {
  for (const target of process.env.PILOT2_SKIP_EXTRACTION === "1" ? [] : targets) {
    const source = universe.market_sources.find((s) => s.source_id === target.sourceId);
    if (!source) { attempts.push({ ...target, status: "source_missing" }); continue; }
    const result = await extractWithFallback(source.url);
    const matched = Boolean(result.ok && result.content && target.pattern.test(result.content));
    attempts.push({ account: target.account, route: target.route, url: source.url, extractor: result.extractor, ok: result.ok, matched, error: result.error, failure: result.failure, latency_ms: result.latency_ms, extraction_attempts: result.attempts, provenance: result.provenance, content_sha256: result.content ? createHash("sha256").update(result.content).digest("hex") : null });
    if (!matched) continue;
    const mechanismId = `mechanism:${target.route}:${target.account.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    universe.commercial_mechanisms.push({ mechanism_id: mechanismId, mechanism_type: target.type, lifecycle: "VERIFIED", description: `Official ${target.account} page exposes a product/supplier submission mechanism.`, official_url: source.url, source_ids: [source.source_id], verified_at: new Date().toISOString(), relevance: "Observable route to submit an external product or brand for commercial evaluation; not evidence of acceptance or buying intent.", account_ref: `entity:${source.domain}`, route_id: target.route, limitations: ["Portal availability does not establish category fit, buyer interest, economics or approval."], required_customer_inputs: universe.customer_dependencies.filter((d) => d.route_ids.includes(target.route)).map((d) => d.dependency_id), coverage_state: "VERIFIED" });
    universe.access_paths.push({ access_id: `access:${mechanismId}`, mechanism_id: mechanismId, path_type: "official_product_or_supplier_page", url: source.url, coverage_state: "VERIFIED", source_ids: [source.source_id], limitations: ["Public access path only; submission requirements and current intake status may change."] });
    const route = universe.route_research.find((r) => r.route_id === target.route);
    if (route) route.mechanism_research = "VERIFIED";
  }
  universe.provenance.fresh_extraction_count += attempts.filter((a) => a.ok).length;
  universe.coverage = summarizeCoverage(universe);
  universe.charts = buildMarketResearchCharts(universe);
  const errors = validateMarketResearchUniverse(universe);
  writeFileSync(path, JSON.stringify(universe, null, 2));
  writeFileSync(path.replace("market-research-universe.json", "commercial-access-attempts.json"), JSON.stringify({ generated_at: new Date().toISOString(), attempts, validation_errors: errors }, null, 2));
  console.log(JSON.stringify({ attempted: attempts.length, extracted: attempts.filter((a) => a.ok).length, verified: universe.commercial_mechanisms.filter((m) => m.lifecycle === "VERIFIED").length, validation_errors: errors }, null, 2));
  if (errors.length) process.exitCode = 2;
}
main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
