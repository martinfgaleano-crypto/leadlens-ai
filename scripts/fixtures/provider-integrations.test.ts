import assert from "node:assert/strict";
import { exaProvider, getProvider, redactSecrets } from "../../lib/sources/access/providers";
import { getSecCompanySubmissions, normalizeCik, searchSamEntities } from "../../lib/sources/access/us-government-sources";
import { contextualUsProviders, DISCOVERY_PROVIDER_ROUTES, PROVIDER_DEFS } from "../../lib/ops/provider-health";
import { newCallBudget, providerEnvDiagnostic, PROVIDER_KEYS } from "../../lib/discovery/source-intelligence/provider-env";
import { PROVIDER_BENCHMARK_READINESS } from "../../lib/discovery/source-intelligence/provider-benchmark-readiness";

let passed=0,failed=0; const t=async(name:string,fn:()=>unknown|Promise<unknown>)=>{try{await fn();console.log(`✅ ${name}`);passed++;}catch(e){console.error(`❌ ${name}`,e);failed++;}};
const original={exa:process.env.EXA_API_KEY,data:process.env.DATA_GOV_API_KEY,sec:process.env.SEC_EDGAR_CONTACT,fetch:global.fetch};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});

async function main(){

await t("1 Exa missing key is unavailable",async()=>{delete process.env.EXA_API_KEY;assert.equal((await exaProvider.health()).credentials_present,false)});
await t("2 Exa configured is runtime visible",async()=>{process.env.EXA_API_KEY="secret-test";assert.equal((await exaProvider.health()).status,"available")});
await t("3 secret redaction",()=>assert(!redactSecrets("api_key=secret&token=secret2 authorization: Bearer").includes("secret")));
await t("4-8 Exa defaults company/auto/highlights, never people/deep",async()=>{let body:any;global.fetch=async(_u,i)=>{body=JSON.parse(String(i?.body));return json({results:[]})};await exaProvider.search({query:"manufacturers"});assert.equal(body.category,"company");assert.equal(body.type,"auto");assert.deepEqual(body.contents,{highlights:true});assert.notEqual(body.category,"people");assert.notEqual(body.type,"deep")});
await t("9 invalid Exa company filters guarded",async()=>{let calls=0;global.fetch=async()=>{calls++;return json({})};const r=await exaProvider.search({query:"x",exclude_domains:["x.com"]});assert.equal(r.ok,false);assert.equal(calls,0)});
await t("10-11 Exa normalized and URL-deduped",async()=>{global.fetch=async()=>json({results:[{id:"1",url:"https://A.com/x?utm_source=z",title:"A",highlights:["one"]},{id:"2",url:"https://a.com/x",title:"dup"}]});const r=await exaProvider.search({query:"x"});assert.equal(r.results.length,1);assert.equal(r.results[0].provider,"exa");assert.equal(r.results[0].snippet,"one")});
await t("12 Exa failure graceful",async()=>{global.fetch=async()=>json({error:"bad"},500);assert.equal((await exaProvider.search({query:"x"})).ok,false)});
await t("13 budget enforced",()=>{const b=newCallBudget(1);assert(b.record({provider:"exa",purpose:"x",benchmark:"x",success:true,failure_reason:null,estimated_cost:null}));assert(!b.record({provider:"exa",purpose:"x",benchmark:"x",success:true,failure_reason:null,estimated_cost:null}))});
await t("14 Exa cost null when absent",async()=>{global.fetch=async()=>json({results:[]});assert.equal((await exaProvider.search({query:"x"})).cost_estimate_usd,null)});
await t("15 SAM missing key safe",async()=>{delete process.env.DATA_GOV_API_KEY;assert.match((await searchSamEntities({uei:"X"})).error??"",/missing/)});
await t("16-18 SAM configured, key only transmitted, structured role",async()=>{process.env.DATA_GOV_API_KEY="sam-secret";let url="";global.fetch=async(u)=>{url=String(u);return json({entityData:[]})};assert((await searchSamEntities({uei:"X"})).ok);assert(url.includes("api_key="));assert(url.includes("ueiSAM=X"));assert(!url.includes("samRegistered="));assert(PROVIDER_DEFS.find(x=>x.id==="sam_gov")?.role.includes("structured"))});
await t("19-20 SAM maps organization but ignores contacts",async()=>{global.fetch=async()=>json({entityData:[{entityRegistration:{legalBusinessName:"ACME LLC",ueiSAM:"U1",cageCode:"C1",registrationStatus:"Active",personalEmail:"private@example.com"},coreData:{physicalAddress:{city:"Miami",stateOrProvinceCode:"FL",countryCode:"USA"},businessContact:{firstName:"Private"}},assertions:{goodsAndServices:{naicsList:[{naicsCode:"325620"}]}}}]});const r=await searchSamEntities({uei:"U1"});assert.equal(r.records[0].legal_name,"ACME LLC");assert(!JSON.stringify(r.records).includes("private@example.com"));assert(!JSON.stringify(r.records).includes("Private"))});
await t("21 SAM evidence basis is not intent",async()=>{const r=await searchSamEntities({uei:"U1"});assert.equal(r.records[0].evidence_basis,"sam_public_entity_registration");assert(!("buying_intent" in r.records[0]))});
await t("22 SAM identifier normalized",async()=>{const r=await searchSamEntities({uei:"U1"});assert.equal(r.records[0].uei,"U1")});
await t("23 SAM failure nonfatal",async()=>{global.fetch=async()=>json({},500);assert.equal((await searchSamEntities({uei:"U"})).ok,false)});
await t("24 SEC requires no API key",()=>assert(!PROVIDER_KEYS.some(x=>String(x.id)==="sec_edgar")));
await t("25 SEC role limited",()=>assert.match(PROVIDER_DEFS.find(x=>x.id==="sec_edgar")?.role??"",/Public-company/));
await t("26 CIK handling",()=>{assert.equal(normalizeCik("320193"),"0000320193");assert.equal(normalizeCik("invalid"),null)});
await t("27 filing metadata normalized",async()=>{process.env.SEC_EDGAR_CONTACT="ops@example.com";global.fetch=async()=>json({name:"Apple Inc.",sic:"3571",stateOfIncorporation:"CA",filings:{recent:{accessionNumber:["a"],form:["10-K"],filingDate:["2026-01-01"],primaryDocument:["x.htm"]}}});const r=await getSecCompanySubmissions("320193");assert.equal(r.records[0].recent_filings[0].form,"10-K")});
await t("28 SEC unavailable nonfatal",async()=>{global.fetch=async()=>json({},503);assert.equal((await getSecCompanySubmissions("320193")).ok,false)});
await t("29 SEC not universal coverage",()=>assert.match(PROVIDER_DEFS.find(x=>x.id==="sec_edgar")?.impact??"",/not treated as universal/));
await t("30-36 routing and fallbacks",()=>{assert(!DISCOVERY_PROVIDER_ROUTES.CO.base.includes("exa" as never));assert(DISCOVERY_PROVIDER_ROUTES.CO.escalation.includes("exa"));assert(!DISCOVERY_PROVIDER_ROUTES.US.base.includes("sam_gov" as never));assert(!DISCOVERY_PROVIDER_ROUTES.US.base.includes("sec_edgar" as never));assert.deepEqual(contextualUsProviders(),[]);assert.deepEqual(contextualUsProviders({commercial_route:"government_procurement"}),["sam_gov"]);assert.deepEqual(contextualUsProviders({account_is_public_company:true,evidence_needs:["sec_filings"]}),["sec_edgar"]);assert(DISCOVERY_PROVIDER_ROUTES.US.escalation.includes("exa"));assert(getProvider("exa"));assert.equal(DISCOVERY_PROVIDER_ROUTES.CO.extraction[0],"firecrawl");assert(PROVIDER_DEFS.every(x=>typeof x.fallback==="string"));});
await t("37 source/provider provenance distinct",async()=>{process.env.SEC_EDGAR_CONTACT="ops@example.com";global.fetch=async()=>json({name:"A",filings:{recent:{form:[]}}});const r=await getSecCompanySubmissions("1");assert.equal(r.source,"sec.gov");assert.equal(r.provider,"sec_edgar_direct")});
await t("38 diagnostics contain booleans, not values",()=>{const d=providerEnvDiagnostic(process.cwd());assert(!JSON.stringify(d).includes("secret-test"));assert(d.providers.some(x=>x.provider==="exa"));assert(d.providers.some(x=>x.provider==="sam_gov"))});
await t("39 benchmark ready but not executed",()=>{assert.equal(PROVIDER_BENCHMARK_READINESS.execute_now,false);assert.equal(PROVIDER_BENCHMARK_READINESS.next_cell,"USA Manufacturing")});

global.fetch=original.fetch;
if(original.exa===undefined)delete process.env.EXA_API_KEY;else process.env.EXA_API_KEY=original.exa;
if(original.data===undefined)delete process.env.DATA_GOV_API_KEY;else process.env.DATA_GOV_API_KEY=original.data;
if(original.sec===undefined)delete process.env.SEC_EDGAR_CONTACT;else process.env.SEC_EDGAR_CONTACT=original.sec;
console.log(`\n${passed} passed, ${failed} failed`);if(failed)process.exit(1);
}
main().catch(error=>{console.error(error);process.exit(1)});
