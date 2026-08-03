import { loadEnvConfig } from "@next/env";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { dirname } from "path";
import { tavilyProvider } from "@/lib/sources/access/providers";
import type { SearchProvider } from "@/lib/sources/access/provider-contract";
loadEnvConfig(process.cwd());
export const RUN_ID="amor_phase4_6_evidence_repair_v1";
export const CHECKPOINT_PATH=`ml/data/opportunity-intelligence/${RUN_ID}.checkpoint.json`;
export const REPAIRS=[
 {account:"Hotel Spa La Colina",domain:"hotelspalacolina.com",query:"site:hotelspalacolina.com spa hotel tienda productos bienestar regalos experiencias"},
 {account:"Natural + Mente",domain:"naturalmente.com.co",query:"site:naturalmente.com.co tienda productos marcas extractos botánicos bienestar Colombia"},
 {account:"Tu Tienda Saludable",domain:"tutiendasaludable.com",query:"site:tutiendasaludable.com catálogo productos marcas extractos líquidos bienestar Colombia"},
] as const;
type State={run_id:string;state:"pending"|"processing"|"completed"|"failed";provider:"tavily";call_ceiling:3;actual_calls:number;exact_cost_usd:null;created_at:string;updated_at:string;operations:Array<{account:string;domain:string;query:string;status:"pending"|"processing"|"completed"|"failed";attempts:number;latency_ms:number|null;error:string|null;results:Array<{title:string|null;url:string;published_date:string|null;retrieved_at:string}>}>};
async function save(path:string,state:State){await mkdir(dirname(path),{recursive:true});const temp=`${path}.tmp`;await writeFile(temp,JSON.stringify(state,null,2)+"\n");await rename(temp,path)}
export async function runRepairs(provider:SearchProvider=tavilyProvider,path=CHECKPOINT_PATH,now=()=>new Date().toISOString()){let state:State;try{state=JSON.parse(await readFile(path,"utf8"))}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;const t=now();state={run_id:RUN_ID,state:"pending",provider:"tavily",call_ceiling:3,actual_calls:0,exact_cost_usd:null,created_at:t,updated_at:t,operations:REPAIRS.map(x=>({...x,status:"pending",attempts:0,latency_ms:null,error:null,results:[]}))};await save(path,state)}
 if(state.operations.length!==3||state.actual_calls>3)throw new Error("repair_integrity_failed");state.state="processing";state.updated_at=now();await save(path,state);
 for(const operation of state.operations){if(operation.status==="completed")continue;if(state.actual_calls>=3)throw new Error("repair_call_ceiling_reached");operation.status="processing";operation.attempts++;state.updated_at=now();await save(path,state);const response=await provider.search({query:operation.query,region:"co",language:"es",max_results:6,query_type:"official_domain"});state.actual_calls++;operation.latency_ms=response.latency_ms;operation.error=response.error;operation.results=response.results.filter(x=>{try{return new URL(x.canonical_url).hostname.replace(/^www\./,"")===operation.domain}catch{return false}}).map(x=>({title:x.title,url:x.canonical_url,published_date:x.published_date,retrieved_at:x.retrieved_at}));operation.status=response.ok?"completed":"failed";state.updated_at=now();await save(path,state);if(!response.ok){state.state="failed";await save(path,state);return state}}
 state.state="completed";state.updated_at=now();await save(path,state);return state}
async function main(){const health=await tavilyProvider.health();if(health.status!=="available")throw new Error(`tavily_unavailable:${health.reason}`);const state=await runRepairs();console.log(JSON.stringify({run_id:state.run_id,state:state.state,actual_calls:state.actual_calls,results:state.operations.map(x=>({account:x.account,count:x.results.length,error:x.error})),exact_cost_usd:null},null,2))}
if(process.argv[1]?.includes("run-amor-phase4-6-evidence-repair"))main().catch(error=>{console.error(error);process.exit(1)});
