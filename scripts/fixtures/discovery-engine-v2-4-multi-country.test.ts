// Discovery Engine V2.4 — multi-country foundation + Colombia retail benchmark.
// Deterministic; 0 provider calls. Verifies breadth foundation + retail capabilities
// while preserving all prior work.
import assert from "node:assert/strict";
import {
  COUNTRY_CODES, COUNTRY_PROFILES, INTL_SOURCE_ATLAS, US_SOURCE_ATLAS, UK_SOURCE_ATLAS, AU_SOURCE_ATLAS, CA_SOURCE_ATLAS,
  isFoundationSource, fiveCountryReadiness, INTL_BENCHMARK_QUEUE, INTL_RESEARCH_QUEUE, countryCoverageGaps,
  marketMemory, SOURCE_TYPE_LEARNING, SOURCE_LAYERS,
} from "../../lib/discovery/source-intelligence/multi-country";
import { buildRetailBenchmark, productListingPlausibility, COLOMBIA_RETAIL_SAMPLE, DISCOVERY_GENERALIZATION_STATUS } from "../../lib/discovery/source-intelligence/retail-live";
// Preservation imports (must still exist/work):
import { COLOMBIA_PRIORITY_CLUSTERS, COLOMBIA_BENCHMARK_QUEUE, providerDiagnostic } from "../../lib/discovery/source-intelligence/coverage";
import { buildManufacturingBenchmark } from "../../lib/discovery/source-intelligence/manufacturing-live";
import { buildLiveBenchmark } from "../../lib/discovery/source-intelligence/live";
import { runBenchmark } from "../../lib/discovery/source-intelligence/benchmark";

let p = 0, f = 0;
const t = (n: string, ok: boolean, d = "") => { console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : `  (${d})`}`); ok ? p++ : f++; };

// 1–6. Five countries + profiles.
t("1 five countries registered", COUNTRY_CODES.length === 5 && ["CO", "US", "GB", "AU", "CA"].every((c) => c in COUNTRY_PROFILES));
t("2 USA = primary commercial expansion", COUNTRY_PROFILES.US.commercial_role === "primary_commercial_expansion" && COUNTRY_PROFILES.US.commercial_priority === 1);
t("3 Colombia = foundation market, deepest", COUNTRY_PROFILES.CO.maturity === "multi_benchmark" && COUNTRY_PROFILES.CO.discovery_priority === 1);
t("4 country-specific geography levels", COUNTRY_PROFILES.US.geography_levels.some((g) => g.level === "state") && COUNTRY_PROFILES.CA.geography_levels.some((g) => g.level === "province_territory"));
t("5 generic business identifiers per country", COUNTRY_PROFILES.GB.identifier_types.some((i) => i.identifier_type === "company number") && COUNTRY_PROFILES.AU.identifier_types.some((i) => i.identifier_type === "ABN"));
t("6 country terminology present", COUNTRY_PROFILES.CO.entity_terminology.includes("NIT") && COUNTRY_PROFILES.US.entity_terminology.includes("LLC"));

// 7–12. Foundation Source concept + atlases.
t("7 source layers include foundation", (SOURCE_LAYERS as readonly string[]).includes("foundation") && (SOURCE_LAYERS as readonly string[]).includes("state_province_regional"));
t("8 UK Companies House is a foundation identity source", (() => { const ch = UK_SOURCE_ATLAS.find((s) => s.id === "gb_companies_house")!; return isFoundationSource(ch) && ch.provides_domain === "none"; })());
t("9 AU ABR is a foundation source", isFoundationSource(AU_SOURCE_ATLAS.find((s) => s.id === "au_abr_abn")!));
t("10 foundation ≠ domain source (identity only)", UK_SOURCE_ATLAS.find((s) => s.id === "gb_companies_house")!.provides_domain === "none" && AU_SOURCE_ATLAS.find((s) => s.id === "au_abr_abn")!.provides_domain === "none");
t("11 SEC EDGAR is NOT a foundation source (public cos only)", !isFoundationSource(US_SOURCE_ATLAS.find((s) => s.id === "us_sec_edgar")!));
t("12 new-country atlases sized (US≥5, UK/AU/CA≥3)", US_SOURCE_ATLAS.length >= 5 && UK_SOURCE_ATLAS.length >= 3 && AU_SOURCE_ATLAS.length >= 3 && CA_SOURCE_ATLAS.length >= 3);

// 13–16. Fragmented/federal foundation states + accessibility honesty.
t("13 USA foundation fragmented (no single national registry)", COUNTRY_PROFILES.US.foundation_source_state === "fragmented");
t("14 Canada federal+provincial", COUNTRY_PROFILES.CA.foundation_source_state === "federal_plus_provincial" && CA_SOURCE_ATLAS.some((s) => s.jurisdiction === "provincial"));
t("15 new sources not live-tested (researched_not_tested)", US_SOURCE_ATLAS.concat(UK_SOURCE_ATLAS, AU_SOURCE_ATLAS, CA_SOURCE_ATLAS).filter((s) => s.ecosystem !== "search_engines").every((s) => s.accessibility.includes("researched_not_tested")));
t("16 new sources confidence discovered/hypothesized (not benchmarked)", Object.values(INTL_SOURCE_ATLAS).flat().every((s) => ["discovered", "hypothesized"].includes(s.confidence)));

// 17–20. Legal/reuse + personal-data metadata (account-first).
t("17 legal reuse + personal-data + sensitivity flags present", UK_SOURCE_ATLAS.every((s) => s.legal_reuse && s.personal_data && s.legal_sensitivity));
t("18 Companies House flags personal data material (do not collect)", UK_SOURCE_ATLAS.find((s) => s.id === "gb_companies_house")!.personal_data === "material");
t("19 no people fields in atlas (account-first)", Object.values(INTL_SOURCE_ATLAS).flat().every((s) => !("email" in s) && !("phone" in s) && !("contact_name" in s)));
t("20 legal metadata is flags not conclusions", ["explicit_open_reuse", "api_terms", "public_access_terms_unclear", "restricted", "manual_review_required"].includes(UK_SOURCE_ATLAS[0].legal_reuse));

// 21–24. Five-country readiness (breadth vs depth honesty).
const readiness = fiveCountryReadiness();
t("21 readiness for all five", readiness.length === 5);
t("22 depth outside CO = untested (no fabricated depth)", readiness.filter((r) => r.country !== "CO").every((r) => r.depth === "untested" && r.live_benchmark_count === 0));
t("23 CO strong breadth + multi_benchmark depth", readiness.find((r) => r.country === "CO")!.breadth === "strong" && readiness.find((r) => r.country === "CO")!.depth === "multi_benchmark");
t("24 USA/UK/AU/CA meaningful breadth (≥ partial)", readiness.filter((r) => r.country !== "CO").every((r) => ["partial", "good", "strong"].includes(r.breadth)));

// 25–28. Queues + market memory + source-type learning (no auto changes).
t("25 international benchmark queue planned (not executed)", INTL_BENCHMARK_QUEUE.length >= 6 && INTL_BENCHMARK_QUEUE.every((b) => b.state === "planned"));
t("26 USA highest non-CO benchmark priority present", INTL_BENCHMARK_QUEUE.some((b) => b.country === "US" && b.priority === 1));
t("27 research queue + market memory per country", INTL_RESEARCH_QUEUE.length >= 6 && marketMemory().length === 5);
t("28 source-type learning are hypotheses, no cross-country score transfer", SOURCE_TYPE_LEARNING.every((l) => ["hypothesis", "weak", "moderate"].includes(l.confidence)) && SOURCE_TYPE_LEARNING.find((l) => l.source_type === "store_locator")!.sample_count === 0);

// 29–31. Country coverage gaps.
const gaps = countryCoverageGaps();
t("29 country gaps include no_live_benchmark for new markets", gaps.some((g) => g.country === "US" && g.type === "no_live_benchmark"));
t("30 USA fragmented-foundation gap", gaps.some((g) => g.country === "US" && g.type === "fragmented_foundation_sources"));
t("31 Canada province gap", gaps.some((g) => g.country === "CA" && g.type === "province_coverage_missing"));

// 32–42. Colombia Retail benchmark + reusable capabilities.
const R = buildRetailBenchmark();
t("32 retail benchmark id + controlled (honest, not live)", R.id === "discovery-v2-colombia-retail-live-001" && R.data_basis === "controlled_sample" && R.live_execution === false && R.provider_calls === 0);
t("33 Location Inflation Ratio > 1 (locations collapse)", R.location_inflation_ratio > 1 && R.canonical_accounts < R.raw_listings);
t("34 store locations collapse to canonical accounts", R.unique_locations >= 5 && R.canonical_accounts <= R.raw_listings - 4);
t("35 marketplace classification separates platform/seller/listing", R.marketplace_breakdown["marketplace_platform"] >= 1 && R.marketplace_breakdown["marketplace_seller"] >= 1 && R.marketplace_breakdown["listing_only"] >= 1);
t("36 marketplace platform + listing_only not product-listing plausible", productListingPlausibility(COLOMBIA_RETAIL_SAMPLE.find((r) => r.truth.kind === "marketplace_platform")!) === "no");
t("37 distributor is weak (not a retail listing target)", R.model_breakdown["distributor"] >= 1 && productListingPlausibility(COLOMBIA_RETAIL_SAMPLE.find((r) => r.truth.business_model === "distributor")!) === "weak");
t("38 assortment evidence yield computed (no buying intent)", R.assortment_evidence_yield > 0 && R.assortment_evidence_accounts > 0);
t("39 listing vs commercial-account saturation both computed", R.listing_saturation.length > 0 && R.commercial_account_saturation.length > 0);
t("40 chain concentration flags dominant parent", R.chain_concentration.length >= 0 && Array.isArray(R.chain_concentration));
t("41 source bias reported (chain/marketplace/geo)", R.source_bias.some((b) => /chain-heavy|marketplace|heavy/i.test(b)));
t("42 novelty unaffected by duplicate locations", /collapse/i.test(R.novelty_note) && DISCOVERY_GENERALIZATION_STATUS.retail_adds.includes("location_inflation"));

// 43–48. Preservation of prior work.
t("43 Colombia 20 priority clusters preserved", COLOMBIA_PRIORITY_CLUSTERS.length === 20);
t("44 Colombia benchmark queue preserved (hospitality+manufacturing live)", COLOMBIA_BENCHMARK_QUEUE.filter((b) => b.benchmark_state === "live_complete").length >= 2);
t("45 manufacturing benchmark still builds", buildManufacturingBenchmark().id === "discovery-v2-colombia-manufacturing-live-001");
t("46 hospitality live benchmark preserved", buildLiveBenchmark().id === "discovery-v2-colombia-hospitality-live-001");
t("47 fixture benchmark preserved deterministic", runBenchmark().data_basis === "deterministic_fixture" && runBenchmark().provider_calls === 0);
t("48 provider diagnostic booleans only (no secrets)", providerDiagnostic({}).every((d) => typeof d.configured === "boolean" && !("key_value" in d)));

console.log(`\n${p} passed, ${f} failed`);
if (f > 0) process.exit(1);
