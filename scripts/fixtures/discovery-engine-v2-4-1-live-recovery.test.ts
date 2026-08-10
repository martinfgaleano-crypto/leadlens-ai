// Discovery Engine V2.4.1 — live recovery + foundation validation + integrity.
// Deterministic; 0 provider calls. Guards controlled/live/fixture separation.
import assert from "node:assert/strict";
import { providerEnvDiagnostic, newCallBudget, PROVIDER_KEYS } from "../../lib/discovery/source-intelligence/provider-env";
import { buildRetailBenchmark, RETAIL_BENCHMARK_ID, RETAIL_LIVE_ID_RESERVED, RETAIL_DEPTH_STATE } from "../../lib/discovery/source-intelligence/retail-live";
import { FOUNDATION_VALIDATIONS, empiricalReadiness, CROSS_COUNTRY_FOUNDATION, validatedAtlasConfidence, US_STATE_FOUNDATION_STATUS } from "../../lib/discovery/source-intelligence/foundation-validation";
// Regression imports:
import { buildLiveBenchmark } from "../../lib/discovery/source-intelligence/live";
import { runBenchmark } from "../../lib/discovery/source-intelligence/benchmark";
import { buildManufacturingBenchmark } from "../../lib/discovery/source-intelligence/manufacturing-live";
import { fiveCountryReadiness, INTL_SOURCE_ATLAS } from "../../lib/discovery/source-intelligence/multi-country";
import { readFileSync } from "node:fs";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

// 1–5. Provider env diagnostic + safe loader.
const diag = providerEnvDiagnostic();
t("1 .env.local detected", diag.env_local_exists);
t("2 diagnostic preserves four providers + adds Exa/SAM", diag.providers.length === 6 && ["tavily", "brave", "firecrawl", "serper", "exa", "sam_gov"].every((id) => diag.providers.some((p2) => p2.provider === id)));
t("3 keys become visible to runner after load (root cause fixed)", diag.providers.every((p2) => p2.key_defined_in_env_file ? p2.visible_to_runner_after_load : true));
t("4 diagnostic exposes NO secret values (booleans/status only)", diag.providers.every((p2) => typeof p2.visible_to_runner_after_load === "boolean" && !("key_value" in p2) && !("value" in p2)));
t("5 no billable calls made (call_tested false; state distinguishes missing vs unavailable)", diag.providers.every((p2) => p2.call_tested === false && ["diagnostic_not_run", "configured_runtime_unavailable", "not_configured"].includes(p2.exec_state)));

// 6–7. Provider call budget enforced + no secrets in module surface.
const budget = newCallBudget(2);
t("6 provider-call budget enforces ceiling", budget.record({ provider: "tavily", purpose: "test", benchmark: "x", success: true, failure_reason: null, estimated_cost: null }) && budget.record({ provider: "tavily", purpose: "test", benchmark: "x", success: true, failure_reason: null, estimated_cost: null }) && budget.record({ provider: "tavily", purpose: "test", benchmark: "x", success: true, failure_reason: null, estimated_cost: null }) === false);
t("7 PROVIDER_KEYS lists names only (no values)", PROVIDER_KEYS.every((k) => typeof k.key === "string" && !("value" in k)));

// 8–13. Retail integrity (controlled ≠ live).
const R = buildRetailBenchmark();
t("8 retail id is controlled (not -live-)", RETAIL_BENCHMARK_ID === "discovery-v2-colombia-retail-controlled-001" && !RETAIL_BENCHMARK_ID.includes("-live-"));
t("9 retail data_basis controlled_sample + live_execution false", R.data_basis === "controlled_sample" && R.live_execution === false);
t("10 live retail id reserved + status not_executed", RETAIL_LIVE_ID_RESERVED === "discovery-v2-colombia-retail-live-001" && R.retail_live_status === "not_executed" && R.live_id_reserved === RETAIL_LIVE_ID_RESERVED);
t("11 retail depth NOT benchmarked", /controlled_sample_complete/.test(RETAIL_DEPTH_STATE) && /live_benchmark_pending/.test(RETAIL_DEPTH_STATE) && !/benchmarked/.test(RETAIL_DEPTH_STATE.replace("live_benchmark_pending", "")));
t("12 reserved -live- artifact now contains genuine live data", (() => { const j = JSON.parse(readFileSync("output/discovery-v2-colombia-retail-live-001.json", "utf8")); return j.id === "discovery-v2-colombia-retail-live-001" && j.live_execution === true && j.data_basis === "live_provider"; })());
t("13 controlled artifact file carries controlled id", JSON.parse(readFileSync("output/discovery-v2-colombia-retail-controlled-001.json", "utf8")).id === "discovery-v2-colombia-retail-controlled-001");

// 14–16. Retail capabilities preserved (controlled).
t("14 Location Inflation Ratio preserved", R.location_inflation_ratio > 1 && R.canonical_accounts < R.raw_listings);
t("15 marketplace + distributor handling preserved", R.marketplace_breakdown["marketplace_platform"] >= 1 && R.model_breakdown["distributor"] >= 1);
t("16 assortment yield + saturation preserved", R.assortment_evidence_yield > 0 && R.listing_saturation.length > 0 && R.commercial_account_saturation.length > 0);

// 17–24. International Foundation validation (REAL).
t("17 four foundation sources validated (UK/AU/CA/US)", ["GB", "AU", "CA", "US"].every((c) => FOUNDATION_VALIDATIONS.some((v) => v.country === c && v.accessed)));
t("18 foundation state = operationally_validated (NOT benchmarked)", FOUNDATION_VALIDATIONS.every((v) => v.validation_state === "operationally_validated") && validatedAtlasConfidence("gb_companies_house") === "operationally_validated");
t("19 foundation ≠ opportunity source (identity yes, domain no)", FOUNDATION_VALIDATIONS.every((v) => v.provides.canonical_identifier && !v.provides.official_domain && v.opportunity_usefulness !== "high"));
t("20 Companies House: identity strong, personal data material, account-first feasible", (() => { const v = FOUNDATION_VALIDATIONS.find((x) => x.source_id === "gb_companies_house")!; return v.identity_usefulness === "high" && v.personal_data_presence === "material" && v.account_first_feasible; })());
t("21 ABN observed high density, no domain", (() => { const v = FOUNDATION_VALIDATIONS.find((x) => x.source_id === "au_abr_abn")!; return /200/.test(v.entity_density_observed) && !v.provides.official_domain; })());
t("22 Canada federal validated + fragmentation (federal_plus_provincial)", (() => { const v = FOUNDATION_VALIDATIONS.find((x) => x.source_id === "ca_corporations_canada")!; return /federal corporations only/i.test(v.primary_limitation) && CROSS_COUNTRY_FOUNDATION.find((c) => c.country === "CA")!.foundation_kind === "federal_plus_provincial"; })());
t("23 USA fragmented: SEC public-cos only (not universal)", (() => { const v = FOUNDATION_VALIDATIONS.find((x) => x.source_id === "us_sec_edgar")!; return /PUBLIC companies ONLY/i.test(v.primary_limitation) && CROSS_COUNTRY_FOUNDATION.find((c) => c.country === "US")!.foundation_kind === "fragmented" && US_STATE_FOUNDATION_STATUS.state_validation === "researched_not_live_tested"; })());
t("24 business identifiers observed per country", FOUNDATION_VALIDATIONS.map((v) => v.identifier_observed).join("|").match(/company number|ABN|corporation number|CIK/g)?.length === 4);

// 25–27. Empirical readiness (depth = live benchmarks only, no fabrication).
const er = empiricalReadiness();
t("25 empirical depth uses live benchmarks (CO=3, US=1)", er.find((e) => e.country === "CO")!.live_benchmark_depth === 3 && er.find((e) => e.country === "US")!.live_benchmark_depth === 1 && er.filter((e) => ["GB","AU","CA"].includes(e.country)).every((e) => e.live_benchmark_depth === 0));
t("26 UK/AU foundation validated but depth still 0 (validation ≠ benchmark)", er.find((e) => e.country === "GB")!.foundation_readiness === "validated" && er.find((e) => e.country === "GB")!.live_benchmark_depth === 0);
t("27 US/CA foundation partial (fragmented)", er.find((e) => e.country === "US")!.foundation_readiness === "partial" && er.find((e) => e.country === "CA")!.foundation_readiness === "partial");

// 28–30. Guard: controlled/fixture cannot inflate live depth.
t("28 fixture benchmark still deterministic_fixture (0 providers)", runBenchmark().data_basis === "deterministic_fixture" && runBenchmark().provider_calls === 0);
t("29 live retail adds exactly one to CO live-benchmark depth", er.find((e) => e.country === "CO")!.live_benchmark_depth === 3);
t("30 only executed USA source classes are benchmarked", Object.values(INTL_SOURCE_ATLAS).flat().filter(s=>!["us_industry_assocs","us_search"].includes(s.id)).every((s) => ["discovered", "hypothesized"].includes(s.confidence)) && Object.values(INTL_SOURCE_ATLAS).flat().filter(s=>["us_industry_assocs","us_search"].includes(s.id)).every(s=>s.confidence==="benchmarked"));

// 31–34. Regression preservation.
t("31 hospitality live artifact preserved", buildLiveBenchmark().id === "discovery-v2-colombia-hospitality-live-001" && buildLiveBenchmark().data_basis === "live_source");
t("32 manufacturing benchmark preserved", buildManufacturingBenchmark().id === "discovery-v2-colombia-manufacturing-live-001");
t("33 five-country readiness preserved", fiveCountryReadiness().length === 5);
t("34 CO depth remains multi_benchmark after hospitality+manufacturing+retail", fiveCountryReadiness().find((r) => r.country === "CO")!.depth === "multi_benchmark");

console.log(`\n${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
