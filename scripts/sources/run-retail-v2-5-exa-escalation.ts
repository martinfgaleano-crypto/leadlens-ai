import { loadEnvConfig } from "@next/env";
import { readFile, writeFile } from "node:fs/promises";
import { exaProvider } from "@/lib/sources/access/providers";
import { buildRetailLiveArtifact, RETAIL_LIVE_BENCHMARK_ID, RETAIL_LIVE_CALL_BUDGET, type RetailLiveCandidate, type RetailLiveObservation, type RetailProviderCall, type RetailCohort } from "@/lib/discovery/source-intelligence/retail-live-execution";
type Stored={captured_at:string;calls:RetailProviderCall[];candidates:RetailLiveCandidate[];execution:Record<string,unknown>};
loadEnvConfig(process.cwd());
async function main(){
 const path=`artifacts/discovery/${RETAIL_LIVE_BENCHMARK_ID}.json`;const old=JSON.parse(await readFile(path,"utf8")) as Stored;
 if(old.calls.some(x=>x.provider==="exa"))throw new Error("exa_escalation_already_executed");
 if(old.calls.length+2>RETAIL_LIVE_CALL_BUDGET)throw new Error("retail_live_hard_budget_reached");
 const groups=new Map<string,RetailLiveCandidate[]>();for(const c of old.candidates){const k=`${c.provider}|${c.source_id}|${c.cohort}`;groups.set(k,[...(groups.get(k)??[]),c]);}
 const observations:RetailLiveObservation[]=Array.from(groups.entries()).map(([key,rows])=>{const [provider,source_id,cohort]=key.split("|");return {provider,source_id,cohort:cohort as RetailCohort,query:"preserved_live_observations",purpose:"preserved_prior_cohort",response:{ok:true,latency_ms:0,cost_estimate_usd:null,error:null,results:rows.map((c:RetailLiveCandidate,i:number)=>({url:c.url,canonical_url:c.url,title:c.raw_name,snippet:c.assortment_evidence,published_date:null,retrieved_at:old.captured_at,source_type:null,provider,rank:i+1,locale:"es"}))}};});
 const calls=[...old.calls];
 for(const query of ["Colombian independent specialty retailers and multibrand ecommerce stores official websites","regional retail chains and specialty stores Colombia official websites"]){
  const r=await exaProvider.search({query,region:"co",language:"es",max_results:6,query_type:"industry_discovery",search_mode:"fast"});
  calls.push({provider:"exa",purpose:"coverage_gap_escalation",query,timestamp:new Date().toISOString(),success:r.ok,latency_ms:r.latency_ms,result_count:r.results.length,estimated_cost_usd:r.cost_estimate_usd,safe_error:r.error});
  observations.push({provider:"exa",source_id:"exa_semantic",cohort:"exa_escalation",query,purpose:"coverage_gap_escalation",response:r});
 }
 const artifact=buildRetailLiveArtifact(observations,calls,old.captured_at);const body=JSON.stringify({...artifact,execution:{...old.execution,exa_escalated_at:new Date().toISOString(),exa_reason:"post-classifier-audit compatible coverage and evidence quality gap",additional_exa_calls:2}},null,2)+"\n";
 await writeFile(path,body,"utf8");await writeFile(`output/${RETAIL_LIVE_BENCHMARK_ID}.json`,body,"utf8");
 console.log(JSON.stringify({id:artifact.id,total_calls:artifact.budget.actual_calls,exa_calls:2,exa_incremental:artifact.metrics.exa_incremental_accounts,raw:artifact.metrics.raw_results,unique:artifact.metrics.unique_results,retail_compatible:artifact.metrics.retail_compatible,precision:artifact.metrics.retailer_precision},null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:"retail_exa_escalation_failed");process.exit(1)});
