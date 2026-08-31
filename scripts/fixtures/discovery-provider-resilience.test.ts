// DISCOVERY PROVIDER RESILIENCE (§15/§16/§18) — a failed/rate-limited primary must not
// starve healthy fallback providers of the shared enumeration budget, so single-provider
// failure never falsely collapses Discovery to zero. Uses controlled provider doubles.

import assert from "node:assert/strict";
import { buildCompanyUniverse } from "@/lib/discovery/company-universe";
import type { SearchProvider } from "@/lib/sources/access/provider-contract";
import type { ICP, LeadSearchCriteria } from "@/types";

// extractCompanyNames may call the LLM; force the offline deterministic fallback path.
delete process.env.ANTHROPIC_API_KEY;

let passed = 0;
const t = async (name: string, fn: () => Promise<void>) => { await fn(); passed++; console.log(`ok - ${passed} ${name}`); };

const item = (title: string, url: string) => ({ url, canonical_url: url, title, snippet: `${title} operates manufacturing plants in the United States.`, published_date: null, retrieved_at: new Date().toISOString(), source_type: "directory", provider: "double", rank: 1, locale: "en" });
const RESULTS = [item("Acme Manufacturing Corporation", "https://acmemfg.example/about"), item("Globex Industrial Inc", "https://globex.example"), item("Initech Foods Company", "https://initech.example"), item("Umbrella Equipment LLC", "https://umbrella.example"), item("Stark Electronics Corp", "https://stark.example"), item("Wayne Automotive Group", "https://wayne.example")];

const provider = (behavior: "ok" | "fail", calls?: { n: number }): SearchProvider => ({
  id: "double" as never,
  search: (async () => { if (calls) calls.n++; return behavior === "fail" ? { ok: false, results: [], error: "rate_limited" } : { ok: true, results: RESULTS }; }) as never,
}) as never;

const icp: ICP = { target_industries: ["Manufacturing (general)", "Automotive", "Food and beverage"], target_titles: [], company_size_range: "", pain_points: [], disqualifiers: [], ideal_signals: [], exclusions_explicit: [] } as never;
const criteria: LeadSearchCriteria = { target_industries: icp.target_industries, target_company_size: [], target_job_titles: [], target_geography: ["United States"], excluded_industries: [], buying_signals: [], disqualification_criteria: [], offer_summary: "", value_proposition: "", tone: "consultative", plan: "sample", lead_count: 15 } as never;
const needs = { version: "v1", buyer_problem: "", operational_triggers: [], observable_signals: [], expected_need: "" } as never;

const run = async () => {
  // §15 — healthy primary: Brave supplies results; fallback NOT fanned out.
  await t("15 healthy primary: fallback not called (normal path stays single-provider)", async () => {
    const bn = { n: 0 }, tn = { n: 0 };
    const u = await buildCompanyUniverse(icp, criteria, needs, { providersOverride: { braveProvider: provider("ok", bn), tavilyProvider: provider("ok", tn), serperProvider: provider("ok") } });
    assert.ok(u.stats.providers_available.includes("brave"));
    assert.equal(tn.n, 0, "tavily must not be called when brave already supplies results");
    assert.ok(u.companies.length > 0, "grounded names must survive until bounded identity/geography resolution");
    assert.ok(u.companies.every((company) => company.country === "United States"), "target geography is explicit evidence, not query intent");
    assert.ok(u.companies.every((company) => Boolean(company.domain)), "dynamic accounts require resolved corporate domains");
  });

  // §16 — Brave rate-limited, Tavily healthy: recovery, budget NOT starved (CORE FIX).
  await t("16 rate-limited primary: healthy fallback rescues on every query (not starved)", async () => {
    const bn = { n: 0 }, tn = { n: 0 };
    const u = await buildCompanyUniverse(icp, criteria, needs, { providersOverride: { braveProvider: provider("fail", bn), tavilyProvider: provider("ok", tn), serperProvider: provider("ok") } });
    assert.ok(u.stats.providers_failed.includes("brave"), "brave recorded as failed");
    assert.ok(u.stats.providers_available.includes("tavily"), "tavily rescued");
    assert.ok(tn.n >= 1, "tavily was actually called despite brave failing");
    assert.ok(u.stats.route_metrics.some((r) => r.result_pages > 0), "pages recovered from fallback");
  });

  // §18 — all providers fail: honest zero, no fabricated candidates, no market-absence claim.
  await t("18 all providers fail: honest zero (no fabricated accounts)", async () => {
    const u = await buildCompanyUniverse(icp, criteria, needs, { providersOverride: { braveProvider: provider("fail"), tavilyProvider: provider("fail"), serperProvider: provider("fail") } });
    assert.equal(u.stats.providers_available.length, 0);
    assert.ok(u.stats.providers_failed.length >= 1);
    assert.equal(u.companies.length, 0, "no companies fabricated when every provider fails");
  });

  await t("19 foreign identity remains rejected after deferred geography resolution", async () => {
    const foreign: SearchProvider = {
      id: "double" as never,
      search: (async () => ({ ok: true, results: [{ ...item("Omni Pac Limited", "https://omnipac.co.uk/about"), snippet: "Omni Pac Limited operates manufacturing plants and is headquartered in London, United Kingdom." }] })) as never,
    } as never;
    const u = await buildCompanyUniverse(icp, criteria, needs, { providersOverride: { braveProvider: foreign, tavilyProvider: foreign, serperProvider: foreign } });
    assert.equal(u.companies.length, 0);
    assert.ok((u.stats.rejected.dynamic_geography_unverified ?? 0) >= 1);
  });

  console.log(`\n${passed} passed, 0 failed`);
};
run().catch((e) => { console.error(e); process.exit(1); });
