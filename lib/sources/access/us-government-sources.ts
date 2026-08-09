// USA structured public sources. These are deliberately not generic web-search
// providers: source provenance and retrieval mechanism remain distinct.
import { canonicalizeUrl } from "./provider-contract";
import { redactSecrets } from "./providers";
import { recordProviderCall } from "@/lib/ops/usage-ledger";

export type StructuredSourceState = "not_configured" | "configured_runtime_visible" | "configured_operational" | "auth_failed" | "quota_exhausted" | "rate_limited" | "provider_error" | "diagnostic_not_run";
export interface StructuredSourceResponse<T> { ok: boolean; source: string; provider: string; retrieved_at: string; records: T[]; latency_ms: number; cost_usd: number | null; error: string | null; }
export interface SamOrganization { legal_name: string; uei: string | null; cage_code: string | null; registration_status: string | null; address: { city: string | null; state: string | null; country: string | null }; naics: string[]; source_url: string; evidence_basis: "sam_public_entity_registration"; }
export interface SecCompanyData { cik: string; legal_name: string | null; sic: string | null; state_of_incorporation: string | null; recent_filings: Array<{ accession_number: string; form: string; filed_at: string; primary_document: string | null }>; source_url: string; evidence_basis: "sec_edgar_submissions"; }

function response<T>(provider:string, source:string, started:number, records:T[], error:string|null):StructuredSourceResponse<T>{
  const latency=Date.now()-started; try{recordProviderCall(provider,!error,latency,error);}catch{}
  return {ok:!error,source,provider,retrieved_at:new Date().toISOString(),records,latency_ms:latency,cost_usd:null,error};
}
async function statusError(res:Response){
  if(res.status===401||res.status===403)return "auth_failed";
  if(res.status===429)return "rate_limited";
  let detail="";
  try{
    const body=await res.json() as {message?:unknown;detail?:unknown};
    detail=[body.message,body.detail].filter((value):value is string=>typeof value==="string").join(": ");
  }catch{}
  return redactSecrets(`HTTP ${res.status}${detail?`: ${detail}`:""}`).slice(0,300);
}

/** Public organizational entity lookup. Personal contacts are never mapped. */
export async function searchSamEntities(input:{legalBusinessName?:string;uei?:string;registrationStatus?:"A"|"E";limit?:number}):Promise<StructuredSourceResponse<SamOrganization>>{
  const started=Date.now(), key=process.env.DATA_GOV_API_KEY;
  if(!key)return response("sam_gov_direct","sam.gov",started,[],"DATA_GOV_API_KEY missing");
  if(!input.legalBusinessName&&!input.uei)return response("sam_gov_direct","sam.gov",started,[],"legalBusinessName or uei required");
  const params=new URLSearchParams({includeSections:"entityRegistration,coreData,assertions"});
  params.set("api_key",key); // required by the public v3 API; URL is never logged/persisted
  if(input.legalBusinessName)params.set("legalBusinessName",input.legalBusinessName);
  if(input.uei)params.set("ueiSAM",input.uei);
  if(input.registrationStatus)params.set("registrationStatus",input.registrationStatus);
  try{
    const res=await fetch(`https://api.sam.gov/entity-information/v3/entities?${params}`,{headers:{accept:"application/json"},signal:AbortSignal.timeout(15_000)});
    if(!res.ok)return response("sam_gov_direct","sam.gov",started,[],await statusError(res));
    const data=await res.json() as {entityData?:Array<Record<string,unknown>>};
    const records=(data.entityData??[]).slice(0,Math.min(input.limit??10,10)).map(raw=>{
      const reg=(raw.entityRegistration??{}) as Record<string,unknown>, core=(raw.coreData??{}) as Record<string,unknown>;
      const addr=(core.physicalAddress??reg.physicalAddress??{}) as Record<string,unknown>;
      const assertions=(raw.assertions??{}) as Record<string,unknown>, goods=(assertions.goodsAndServices??{}) as Record<string,unknown>;
      const naicsRaw=(goods.naicsList??[]) as Array<Record<string,unknown>>;
      return {legal_name:String(reg.legalBusinessName??""),uei:reg.ueiSAM?String(reg.ueiSAM):null,cage_code:reg.cageCode?String(reg.cageCode):null,registration_status:reg.registrationStatus?String(reg.registrationStatus):null,address:{city:addr.city?String(addr.city):null,state:addr.stateOrProvinceCode?String(addr.stateOrProvinceCode):null,country:addr.countryCode?String(addr.countryCode):null},naics:naicsRaw.map(x=>String(x.naicsCode??"")).filter(Boolean),source_url:"https://sam.gov/content/entity-registration",evidence_basis:"sam_public_entity_registration" as const};
    }).filter(x=>x.legal_name);
    return response("sam_gov_direct","sam.gov",started,records,null);
  }catch(e){return response("sam_gov_direct","sam.gov",started,[],redactSecrets(e instanceof Error?e.message:"request failed"));}
}

export function normalizeCik(cik:string|number):string|null{const v=String(cik).replace(/\D/g,"");return v&&v.length<=10?v.padStart(10,"0"):null;}
/** SEC public-company evidence; not a universal US-company discovery source. */
export async function getSecCompanySubmissions(cik:string|number):Promise<StructuredSourceResponse<SecCompanyData>>{
  const started=Date.now(), normalized=normalizeCik(cik), contact=process.env.SEC_EDGAR_CONTACT;
  if(!normalized)return response("sec_edgar_direct","sec.gov",started,[],"invalid CIK");
  if(!contact)return response("sec_edgar_direct","sec.gov",started,[],"SEC_EDGAR_CONTACT missing");
  try{
    const url=`https://data.sec.gov/submissions/CIK${normalized}.json`;
    const res=await fetch(url,{headers:{"User-Agent":`LeadLens research application ${contact}`,"Accept-Encoding":"gzip, deflate",accept:"application/json"},signal:AbortSignal.timeout(15_000)});
    if(!res.ok)return response("sec_edgar_direct","sec.gov",started,[],await statusError(res));
    const d=await res.json() as {name?:string;sic?:string;stateOfIncorporation?:string;filings?:{recent?:{accessionNumber?:string[];form?:string[];filingDate?:string[];primaryDocument?:string[]}}};
    const f=d.filings?.recent, forms=f?.form??[];
    return response("sec_edgar_direct","sec.gov",started,[{cik:normalized,legal_name:d.name??null,sic:d.sic??null,state_of_incorporation:d.stateOfIncorporation??null,recent_filings:forms.slice(0,40).map((form,i)=>({accession_number:f?.accessionNumber?.[i]??"",form,filed_at:f?.filingDate?.[i]??"",primary_document:f?.primaryDocument?.[i]??null})),source_url:canonicalizeUrl(url),evidence_basis:"sec_edgar_submissions"}],null);
  }catch(e){return response("sec_edgar_direct","sec.gov",started,[],redactSecrets(e instanceof Error?e.message:"request failed"));}
}
