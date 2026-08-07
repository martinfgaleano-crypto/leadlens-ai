import assert from "node:assert/strict";
import {
  COLOMBIA_PRIORITY_CLUSTERS, COLOMBIA_SOURCE_ATLAS, COLOMBIA_BENCHMARK_QUEUE,
  SOURCE_RESEARCH_QUEUE_V2, ENTITY_RELATIONSHIP_TYPES, COMMERCIAL_DECISION_SCOPES,
  buildCountryCoverage, routeCoverage, businessModelCoverage, coverageGapsV2,
  coverageForContext, calculateSaturation, diversityYield, concentrationFlags,
  sourceResearchProtocol, COUNTRY_BOOTSTRAP_WORKFLOW, internationalReadiness,
  providerDiagnostic, v22Audit, buildSourcePlan, buildLiveBenchmark, runBenchmark,
  appendSnapshot, emptySourceMemory, type DiscoveryContext,
} from "../../lib/discovery/source-intelligence";

const checks:string[]=[]; const ok=(name:string,fn:()=>void)=>{fn();checks.push(name)};
ok("20 priority clusters",()=>assert.equal(COLOMBIA_PRIORITY_CLUSTERS.length,20));
ok("multi-label clusters",()=>assert(COLOMBIA_PRIORITY_CLUSTERS.every(c=>c.labels.length>=1)&&COLOMBIA_PRIORITY_CLUSTERS.some(c=>c.labels.length>1)));
ok("multiple subindustries",()=>assert(COLOMBIA_PRIORITY_CLUSTERS.every(c=>c.subindustries.length>=2)));
ok("multi business models",()=>assert(COLOMBIA_PRIORITY_CLUSTERS.every(c=>c.business_models.length>=2)));
ok("context routes",()=>assert(COLOMBIA_PRIORITY_CLUSTERS.every(c=>c.routes.length>=2)));
ok("subindustry expansion is routing relevant",()=>assert(COLOMBIA_PRIORITY_CLUSTERS.find(c=>c.id==="manufacturing")?.subindustries.includes("packaging")));
const coverage=buildCountryCoverage();
ok("country coverage",()=>assert.equal(coverage.length,20));
ok("breadth depth separate",()=>assert(coverage.every(c=>c.breadth&&c.depth)));
ok("defined denominator",()=>assert(coverage.every(c=>c.denominator_note.includes("20"))));
ok("atlas entries",()=>assert(COLOMBIA_SOURCE_ATLAS.length>=18));
ok("atlas contextual",()=>assert(COLOMBIA_SOURCE_ATLAS.every(s=>s.clusters.length>0)));
ok("geographic coverage",()=>assert(COLOMBIA_SOURCE_ATLAS.every(s=>s.geography.length>0)));
ok("regional support",()=>assert(COLOMBIA_SOURCE_ATLAS.some(s=>s.geography.includes("Antioquia"))));
ok("accessibility",()=>assert(COLOMBIA_SOURCE_ATLAS.every(s=>s.accessibility.length>0)));
ok("confidence honest",()=>assert.equal(COLOMBIA_SOURCE_ATLAS.filter(s=>s.confidence==="historically_effective").length,0));
ok("research queue",()=>assert.equal(SOURCE_RESEARCH_QUEUE_V2.length,10));
ok("benchmark queue",()=>assert.equal(COLOMBIA_BENCHMARK_QUEUE.length,10));
ok("hospitality cell one retained",()=>assert.equal(COLOMBIA_BENCHMARK_QUEUE[0].id,"discovery-v2-colombia-hospitality-live-001"));
ok("not hospitality specific",()=>assert(COLOMBIA_BENCHMARK_QUEUE.slice(1).every(c=>!c.industry_labels.includes("hospitality"))));
ok("relationships general",()=>assert.deepEqual(ENTITY_RELATIONSHIP_TYPES,["parent_of","subsidiary_of","brand_of","property_of","branch_of","franchise_of","operates","owned_by","related_but_distinct"]));
ok("commercial scopes",()=>assert(COMMERCIAL_DECISION_SCOPES.includes("corporate")&&COMMERCIAL_DECISION_SCOPES.includes("local")&&COMMERCIAL_DECISION_SCOPES.includes("unknown")));
ok("route coverage",()=>assert(routeCoverage().some(x=>x.route==="procurement"&&x.specialized_sources>0)));
ok("business model coverage",()=>assert(businessModelCoverage().some(x=>x.business_model==="manufacturer"&&x.specialized_sources>0)));
const hospitality:DiscoveryContext={country:"CO",industry_labels:["hospitality"],business_models:["hotel_operator"],routes:["hospitality_guest_experience"],mechanisms:["guest_amenity"]};
const hp=buildSourcePlan(hospitality);
ok("router consumes coverage",()=>assert.equal(hp.primary_cluster,"hospitality"));
const blind:DiscoveryContext={country:"CO",industry_labels:["events"],business_models:["service_provider"],routes:["co_branding"],mechanisms:["seasonal_campaign"]};
const bp=buildSourcePlan(blind);
ok("insufficient source coverage",()=>assert.equal(bp.routing_state,"INSUFFICIENT_SOURCE_COVERAGE"));
ok("fallback routing",()=>assert(bp.fallback_source_ids.includes("search_engine")));
ok("adjacent transfer explicit",()=>assert(Array.isArray(bp.adjacent_transfer_clusters)));
ok("coverage function",()=>assert.equal(coverageForContext(["technology"],["saas_vendor"],["saas_purchase"]).primary_cluster,"technology"));
const mem=appendSnapshot(emptySourceMemory("co_cotelco"),{source_id:"co_cotelco",cycle_id:"hospitality",captured_at:"2026-01-01",country:"CO",candidates_discovered:1,valid_entities:1,correct_business_models:1,context_compatible:1,evidence_sufficient:1,opportunity_plausible:1,portfolio_accounts:1,novelty_yield:1,false_positives:0,duplicates:0,extraction_failures:0,access_failures:0,avg_cost:null,avg_latency_ms:null,client_selected_rate:null,contact_rate:null,order_rate:null,outcome_state:"awaiting_real_outcomes"});
ok("source memory context isolation",()=>assert.equal(mem.snapshots[0].cycle_id,"hospitality"));
const rows=Array.from({length:20},(_,i)=>({resolved:true,qualified:i<8,novel:i<6,duplicate:i>=18}));
ok("saturation checkpoints",()=>assert.deepEqual(calculateSaturation(rows).map(x=>x.processed),[10,20]));
ok("diversity yield",()=>assert.equal(diversityYield([{geography:"a",parent:"p",business_model:"m",subindustry:"s",mechanism:"x"},{geography:"b",parent:"p",business_model:"m",subindustry:"t",mechanism:"x"}]).geographic,1));
ok("concentration flag",()=>assert.equal(concentrationFlags(["Bogotá","Bogotá","Bogotá","Cali"],"city").length,1));
ok("coverage gaps actionable",()=>assert(coverageGapsV2().every(g=>g.next_action)));
ok("source research protocol",()=>assert.equal(sourceResearchProtocol().length,10));
ok("country bootstrap",()=>assert.equal(COUNTRY_BOOTSTRAP_WORKFLOW.length,10));
ok("international portable",()=>assert.equal(internationalReadiness().next_country,"MX"));
const diag=providerDiagnostic({BRAVE_SEARCH_API_KEY:"secret-value"});
ok("provider diagnostic safe",()=>assert(!JSON.stringify(diag).includes("secret-value")));
ok("source provider separation",()=>assert(COLOMBIA_SOURCE_ATLAS.every(s=>!(s as unknown as {provider_id?:string}).provider_id)));
const live=buildLiveBenchmark(); const fixture=runBenchmark();
ok("fixture preserved",()=>assert.equal(fixture.data_basis,"deterministic_fixture"));
ok("live preserved",()=>assert.equal(live.id,"discovery-v2-colombia-hospitality-live-001"));
ok("Cotelco benchmarked only",()=>assert.equal(COLOMBIA_SOURCE_ATLAS.find(s=>s.id==="co_cotelco")?.confidence,"benchmarked"));
ok("live facts preserved",()=>assert.equal(live.entities_company_level.length,4));
ok("no provider calls",()=>assert.equal(v22Audit().provider_calls,0));
ok("budget enforced",()=>{const a=v22Audit();assert(a.provider_calls<=a.limits.provider_calls&&a.source_access_validations<=a.limits.source_access_validations&&a.deep_source_inspections<=a.limits.deep_source_inspections)});
ok("no outreach or people enrichment data",()=>assert(!JSON.stringify({coverage,atlas:COLOMBIA_SOURCE_ATLAS}).match(/person_email|outreach_message|phone_number/)));
ok("no pilot mutation surface",()=>assert(!JSON.stringify(COLOMBIA_SOURCE_ATLAS).includes("amor_de_gea")));
console.log(`Discovery Engine V2.2 coverage: ${checks.length} focused checks passed.`);
