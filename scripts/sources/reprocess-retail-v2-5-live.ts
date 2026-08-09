import { readFile, writeFile } from "node:fs/promises";
import { buildRetailLiveArtifact, RETAIL_LIVE_BENCHMARK_ID, type RetailLiveCandidate, type RetailProviderCall, type RetailCohort } from "@/lib/discovery/source-intelligence/retail-live-execution";
type Stored={captured_at:string;calls:RetailProviderCall[];candidates:RetailLiveCandidate[];execution:Record<string,unknown>};
async function main(){
 const path=`artifacts/discovery/${RETAIL_LIVE_BENCHMARK_ID}.json`; const old=JSON.parse(await readFile(path,"utf8")) as Stored;
 const groups=new Map<string,RetailLiveCandidate[]>(); for(const c of old.candidates){const k=`${c.provider}|${c.source_id}|${c.cohort}`;groups.set(k,[...(groups.get(k)??[]),c]);}
 const observations=Array.from(groups.entries()).map(([key,rows])=>{const [provider,source_id,cohort]=key.split("|");return {provider,source_id,cohort:cohort as RetailCohort,query:"preserved_live_observations",purpose:"deterministic_reclassification",response:{ok:true,latency_ms:0,cost_estimate_usd:null,error:null,results:rows.map((c:RetailLiveCandidate,i:number)=>({url:c.url,canonical_url:c.url,title:c.raw_name,snippet:c.assortment_evidence,published_date:null,retrieved_at:old.captured_at,source_type:null,provider,rank:i+1,locale:"es"}))}};});
 const artifact=buildRetailLiveArtifact(observations,old.calls,old.captured_at); const body=JSON.stringify({...artifact,execution:{...old.execution,reprocessed_at:new Date().toISOString(),reprocess_basis:"preserved live results; zero additional provider calls"}},null,2)+"\n";
 await writeFile(path,body,"utf8");await writeFile(`output/${RETAIL_LIVE_BENCHMARK_ID}.json`,body,"utf8");
 console.log(JSON.stringify({id:artifact.id,additional_calls:0,raw:artifact.metrics.raw_results,unique:artifact.metrics.unique_results,canonical:artifact.metrics.canonical_accounts,retail_compatible:artifact.metrics.retail_compatible,precision:artifact.metrics.retailer_precision,digital:artifact.metrics.digital_resolution_rate},null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:"retail_reprocess_failed");process.exit(1)});
