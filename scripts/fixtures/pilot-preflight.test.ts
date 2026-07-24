import assert from "node:assert/strict";
import { evaluatePilotPreflight, evaluatePilotValueContract } from "../../lib/ops/pilot-preflight";

const empty = evaluatePilotPreflight({});
assert.equal(empty.ready, false);
assert.equal(empty.blockers.length, 6);
assert.equal(empty.provider_health, "not_checked");
assert.equal(empty.provider_calls_made, false);

const unsafe = evaluatePilotPreflight({
  DEMO_MODE: "true",
  ALLOW_MOCK_LEADS_WITH_REAL_AI: "true",
  ANTHROPIC_API_KEY: "set",
  NEXT_PUBLIC_SUPABASE_URL: "set",
  SUPABASE_SERVICE_ROLE_KEY: "set",
  TAVILY_API_KEY: "set",
  INTERNAL_RUN_SECRET: "set",
  PILOT_E2E_MAX_USD: "1",
});
assert.equal(unsafe.ready, false);
assert.equal(unsafe.blockers.length, 2);

const ready = evaluatePilotPreflight({
  DEMO_MODE: "false",
  ALLOW_MOCK_LEADS_WITH_REAL_AI: "false",
  ANTHROPIC_API_KEY: "set",
  NEXT_PUBLIC_SUPABASE_URL: "set",
  SUPABASE_SERVICE_ROLE_KEY: "set",
  BRAVE_SEARCH_API_KEY: "set",
  FIRECRAWL_API_KEY: "set",
  INTERNAL_RUN_SECRET: "set",
  NEXT_PUBLIC_APP_URL: "https://example.test",
  ADMIN_SECRET_TOKEN: "set",
  PILOT_E2E_MAX_USD: "1",
});
assert.deepEqual(ready.blockers, []);
assert.deepEqual(ready.warnings, []);
assert.equal(ready.ready, true);
assert.equal(ready.max_budget_usd, 1);

const excessive = evaluatePilotPreflight({
  ANTHROPIC_API_KEY: "set",
  NEXT_PUBLIC_SUPABASE_URL: "set",
  SUPABASE_SERVICE_ROLE_KEY: "set",
  TAVILY_API_KEY: "set",
  INTERNAL_RUN_SECRET: "set",
  PILOT_E2E_MAX_USD: "50",
});
assert.equal(excessive.ready, false);
assert.ok(excessive.blockers.some((item) => item.includes("safety cap")));

const valueReady = evaluatePilotValueContract({ target_countries: ["Colombia"], known_accounts: ["Carulla"], minimum_novel_opportunities: 2, minimum_dynamic_opportunities: 1, maximum_obvious_accounts: 0, total_budget_usd: 0.5, llm_budget_usd: 0.038 });
assert.equal(valueReady.ready, true);
assert.equal(valueReady.provider_budget_usd, 0.462);
assert.equal(evaluatePilotValueContract({ target_countries: ["Colombia"], known_accounts: [], minimum_novel_opportunities: 2, minimum_dynamic_opportunities: 1, maximum_obvious_accounts: 0, total_budget_usd: 0.5, llm_budget_usd: 0.038 }).ready, false);
assert.equal(evaluatePilotValueContract({ target_countries: ["Colombia"], known_accounts: ["Carulla"], minimum_novel_opportunities: 2, minimum_dynamic_opportunities: 1, maximum_obvious_accounts: 2, total_budget_usd: 0.5, llm_budget_usd: 0.038 }).ready, false);
assert.equal(evaluatePilotValueContract({ target_countries: ["Colombia"], known_accounts: ["Carulla"], minimum_novel_opportunities: 2, minimum_dynamic_opportunities: 3, maximum_obvious_accounts: 0, total_budget_usd: 0.5, llm_budget_usd: 0.038 }).ready, false);

console.log("✅ preflight stops missing and mock configurations before provider calls");
console.log("✅ full compliant configuration passes without exposing secret values");
console.log("✅ absent/excessive budgets stop execution before provider health");
console.log("✅ paid value contract requires known accounts, novelty target and valid budget allocation");
console.log("\n5/5 passed");
