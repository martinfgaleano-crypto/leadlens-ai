import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import { braveProvider, exaProvider, tavilyProvider } from "@/lib/sources/access/providers";
import type { SearchProvider } from "@/lib/sources/access/provider-contract";
import { buildRetailLiveArtifact, RETAIL_LIVE_BENCHMARK_ID, RETAIL_LIVE_CALL_BUDGET, type RetailCohort, type RetailLiveObservation, type RetailProviderCall } from "@/lib/discovery/source-intelligence/retail-live-execution";

loadEnvConfig(process.cwd());
const observations:RetailLiveObservation[]=[]; const calls:RetailProviderCall[]=[]; const capturedAt=new Date().toISOString();
async function run(provider:SearchProvider, source_id:string, cohort:RetailCohort, purpose:string, query:string, max=6){
 if(calls.length>=RETAIL_LIVE_CALL_BUDGET)throw new Error("retail_live_hard_budget_reached");
 const r=await provider.search({query,region:"co",language:"es",max_results:max,query_type:cohort==="specialized_structured_first"?"industry_discovery":"regional_discovery",search_mode:provider.id==="exa"?"fast":"standard"});
 calls.push({provider:provider.id,purpose,query,timestamp:new Date().toISOString(),success:r.ok,latency_ms:r.latency_ms,result_count:r.results.length,estimated_cost_usd:r.cost_estimate_usd,safe_error:r.error});
 observations.push({provider:provider.id,source_id,cohort,query,purpose,response:r});
}
async function main(){
 const plan:[SearchProvider,string,RetailCohort,string,string,number][]=[
  [braveProvider,"co_fenalco","specialized_structured_first","association_member_discovery",'site:fenalco.com.co (afiliados OR asociados OR directorio) tiendas comercio Colombia',6],
  [tavilyProvider,"co_fenalco","specialized_structured_first","association_member_discovery",'Fenalco afiliados tiendas comercio minorista Colombia empresas',6],
  [braveProvider,"co_mall_directories","specialized_structured_first","tenant_directory_discovery",'Colombia centro comercial directorio de tiendas marcas locales',6],
  [tavilyProvider,"co_ecommerce_ecosystems","specialized_structured_first","ecommerce_ecosystem_discovery",'Colombia tiendas online multimarca comercio electrónico directorio',6],
  [braveProvider,"search_engine","search_first","independent_retail_discovery",'tiendas multimarca independientes Colombia catálogo marcas',6],
  [tavilyProvider,"search_engine","search_first","specialty_retail_discovery",'retailers especializados Colombia tienda online productos marcas',6],
  [braveProvider,"search_engine","search_first","regional_retail_discovery",'cadenas regionales tiendas Colombia Medellín Cali Barranquilla Bucaramanga',6],
  [tavilyProvider,"search_engine","search_first","independent_ecommerce_discovery",'tiendas colombianas ecommerce multimarca independientes Bogotá Medellín Cali',6],
  [braveProvider,"hybrid_resolution","hybrid","official_domain_resolution",'Colombia tiendas especializadas multimarca sitio oficial catálogo productos',6],
  [tavilyProvider,"hybrid_resolution","hybrid","assortment_validation",'site:.co tienda "nuestras marcas" catálogo Colombia',6],
 ];
 for(const p of plan)await run(...p);
 const pre=buildRetailLiveArtifact(observations,calls,capturedAt);
 if(pre.metrics.retail_compatible<15||pre.metrics.digital_resolution_rate<0.5){
  await run(exaProvider,"exa_semantic","exa_escalation","coverage_gap_escalation","Colombian independent specialty retailers and multibrand ecommerce stores",6);
  await run(exaProvider,"exa_semantic","exa_escalation","regional_gap_escalation","regional retail chains and specialty stores in Colombia",6);
 }
 const artifact=buildRetailLiveArtifact(observations,calls,capturedAt);
 await mkdir("artifacts/discovery",{recursive:true}); await mkdir("output",{recursive:true});
 const body=JSON.stringify({...artifact,execution:{access_method:"public provider APIs",provider_config_fingerprint:"credentials_present_only",sample_method:"bounded contextual queries; provider rank order",no_people_data:true}},null,2)+"\n";
 await writeFile(`artifacts/discovery/${RETAIL_LIVE_BENCHMARK_ID}.json`,body,"utf8"); await writeFile(`output/${RETAIL_LIVE_BENCHMARK_ID}.json`,body,"utf8");
 console.log(JSON.stringify({id:artifact.id,calls:artifact.budget.actual_calls,within_budget:artifact.budget.within_budget,raw:artifact.metrics.raw_results,canonical:artifact.metrics.canonical_accounts,retail_compatible:artifact.metrics.retail_compatible,precision:artifact.metrics.retailer_precision,digital_resolution:artifact.metrics.digital_resolution_rate,exa_incremental:artifact.metrics.exa_incremental_accounts,stop_reason:artifact.stop_reason},null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:"retail_live_failed");process.exit(1)});
