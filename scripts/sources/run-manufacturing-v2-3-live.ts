import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import { braveProvider, firecrawlProvider, tavilyProvider } from "@/lib/sources/access/providers";
import { buildManufacturingBenchmark, MANUFACTURING_BENCHMARK_ID, MANUFACTURING_SOURCE_SAMPLE, type DomainObservation, type ProviderCallAudit, type SearchObservation } from "@/lib/discovery/source-intelligence/manufacturing-live";

async function main(){
loadEnvConfig(process.cwd());
const timestamp="2026-08-07T22:30:00.000Z";
const queries=[
 "fabricantes alimentos bebidas Colombia empresa planta producción",
 "fabricantes empaques plásticos Colombia empresa planta",
 "fabricantes cosméticos aseo Colombia empresa planta",
 "fabricantes textiles confecciones Colombia empresa",
 "fabricantes metalmecánica maquinaria Colombia empresa planta",
];
const calls:ProviderCallAudit[]=[
 {provider:"tavily",purpose:"minimal_validation",source:null,candidate:null,benchmark:MANUFACTURING_BENCHMARK_ID,timestamp,success:true,latency_ms:1438,estimated_cost_usd:null,actual_cost_usd:null,safe_error:null,result_count:1},
 {provider:"brave",purpose:"minimal_validation",source:null,candidate:null,benchmark:MANUFACTURING_BENCHMARK_ID,timestamp,success:true,latency_ms:877,estimated_cost_usd:null,actual_cost_usd:null,safe_error:null,result_count:1},
 {provider:"serper",purpose:"minimal_validation",source:null,candidate:null,benchmark:MANUFACTURING_BENCHMARK_ID,timestamp,success:false,latency_ms:537,estimated_cost_usd:null,actual_cost_usd:null,safe_error:"HTTP 400: not enough credits",result_count:0},
 {provider:"firecrawl",purpose:"minimal_validation",source:null,candidate:null,benchmark:MANUFACTURING_BENCHMARK_ID,timestamp,success:true,latency_ms:1704,estimated_cost_usd:null,actual_cost_usd:null,safe_error:null,result_count:1},
];
const searches:SearchObservation[]=[];
for(let i=0;i<queries.length;i++){const query=queries[i];
 const provider=i%2===0?tavilyProvider:braveProvider;
 const r=await provider.search({query,language:"es",region:"co",max_results:5,query_type:"industry_discovery"});
 searches.push({provider:provider.id,query,results:r.results.map(x=>({title:x.title,url:x.canonical_url,snippet:x.snippet})),latency_ms:r.latency_ms,cost_estimate_usd:r.cost_estimate_usd,error:r.error});
 calls.push({provider:provider.id,purpose:"search_cohort",source:"search_engine",candidate:null,benchmark:MANUFACTURING_BENCHMARK_ID,timestamp,success:r.ok,latency_ms:r.latency_ms,estimated_cost_usd:r.cost_estimate_usd,actual_cost_usd:null,safe_error:r.error,result_count:r.results.length});
}
const domains:DomainObservation[]=[];
for(const c of MANUFACTURING_SOURCE_SAMPLE.filter(x=>x.decision==="accepted").slice(0,10)){
 const r=await firecrawlProvider.search({query:`${c.raw_entity} sitio web oficial Colombia`,language:"es",region:"co",max_results:1,query_type:"official_domain"});
 const hit=r.results[0]; const host=hit?new URL(hit.canonical_url).hostname.replace(/^www\./,""):null;
 const excluded=host&&/(facebook|instagram|linkedin|youtube|andi\.com|procolombia|einforma|emis|connectamericas)/.test(host);
 const identityTokens=`${c.canonical_account} ${c.commercial_brand??""}`.toLowerCase().split(/[^a-z0-9áéíóúñ]+/).filter(x=>x.length>=4&&!/[0-9]/.test(x));
 const identityMatch=Boolean(host&&identityTokens.some(x=>host.replace(/[^a-z0-9]/g,"").includes(x.replace(/[^a-z0-9]/g,""))));
 domains.push({candidate:c.canonical_account,provider:"firecrawl",domain:host&&!excluded&&identityMatch?host:null,confidence:host&&!excluded&&identityMatch?"probable":host&&!excluded?"conflicting":"none",latency_ms:r.latency_ms,cost_estimate_usd:r.cost_estimate_usd,error:r.error});
 calls.push({provider:"firecrawl",purpose:"domain_resolution",source:c.source,candidate:c.canonical_account,benchmark:MANUFACTURING_BENCHMARK_ID,timestamp,success:r.ok,latency_ms:r.latency_ms,estimated_cost_usd:r.cost_estimate_usd,actual_cost_usd:null,safe_error:r.error,result_count:r.results.length});
}
const artifact=buildManufacturingBenchmark(searches,domains,calls);
await mkdir("artifacts/discovery",{recursive:true});
const path=`artifacts/discovery/${MANUFACTURING_BENCHMARK_ID}.json`;
await writeFile(path,JSON.stringify({...artifact,search_observations:searches,domain_observations:domains},null,2)+"\n","utf8");
console.log(JSON.stringify({path,id:artifact.id,sample:artifact.candidates.length,provider_calls:calls.length,search_results:searches.reduce((n,x)=>n+x.results.length,0),domains_resolved:domains.filter(x=>x.domain).length,manufacturer_precision:artifact.manufacturer_precision,divergence:artifact.subindustry_divergence.state,stop_reason:artifact.stop_reason},null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:"manufacturing_benchmark_failed");process.exit(1)});
