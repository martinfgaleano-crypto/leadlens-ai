import type { SearchResultItem } from "@/lib/sources/access/provider-contract";
import type { SourcePerformanceSnapshot } from "./router";

export const RETAIL_LIVE_BENCHMARK_ID = "discovery-v2-colombia-retail-live-001";
export const RETAIL_LIVE_VERSION = "discovery-v2-5-retail-live-v1";
export const RETAIL_LIVE_CALL_BUDGET = 25;

export type RetailEntityClass = "retailer"|"chain"|"brand"|"store_location"|"franchise_operator"|"marketplace_platform"|"marketplace_seller"|"distributor"|"article"|"directory"|"other";
export type RetailCohort = "specialized_structured_first"|"search_first"|"hybrid"|"exa_escalation";
export interface RetailLiveObservation { provider:string; source_id:string; cohort:RetailCohort; query:string; purpose:string; response:{ok:boolean;latency_ms:number;cost_estimate_usd:number|null;error:string|null;results:SearchResultItem[]}; }
export interface RetailProviderCall { provider:string; purpose:string; query:string; timestamp:string; success:boolean; latency_ms:number; result_count:number; estimated_cost_usd:number|null; safe_error:string|null; }
export interface RetailLiveCandidate { raw_name:string; canonical_account:string|null; canonical_domain:string|null; url:string; provider:string; source_id:string; cohort:RetailCohort; entity_class:RetailEntityClass; real_business:boolean; retail_compatible:boolean; digital_presence:boolean; marketplace_contamination:boolean; geography:string; assortment_evidence:string|null; assortment_evidence_state:"observed_search_evidence"|"not_observed"; product_listing_plausibility:"structurally_plausible"|"weak"|"unsupported"; buying_intent:"not_inferred"; novelty:"genuinely_new"|"duplicate_identity"; confidence:"low"|"moderate"; evidence_basis:"live_provider"; }

const excludedHosts=/(facebook|instagram|linkedin|youtube|tiktok|wikipedia|tripadvisor|mercadolibre|amazon|rappi|linio|eltiempo|larepublica|portafolio|semana|fenalco|ccb\.org|ccmedellin|directorio|minube|bogotamiciudad|tecnoweb2|ajaw|dizolicol|fucsia|revistaexclama|planetacolombia|modadospuntocero|tiendanube|enviame|discrepante)/i;
const marketplaceHosts=/(mercadolibre|amazon|rappi|linio|marketplace)/i;
const articleText=/(noticias|artículo|ranking|mejores|guía|blog|revista|news|conozca|dónde comprar|lugares clave|imperdibles|que redefinen|principales para|creadas con)/i;
const directoryText=/(directorio|afiliados|miembros|empresas asociadas|centros comerciales en|listado de tiendas)/i;
const retailText=/(^|\s)(tienda|retail|boutique|supermercado|droguería|farmacia|multimarca|ecommerce|concept store|almacenes)(\s|$)/i;
const distributorText=/(distribuidor|mayorista|importador)/i;
const chainText=/(sucursales|sedes|nuestras tiendas|puntos de venta|cadena)/i;
const assortmentText=/(catálogo|productos|marcas|colecciones|categorías|comprar|tienda online|shop)/i;

function hostOf(url:string){try{return new URL(url).hostname.toLowerCase().replace(/^www\./,"");}catch{return null;}}
function rootDomain(host:string|null){if(!host)return null;const p=host.split(".");const colombian=/\.(com|org|net|edu|gov)\.co$/i.test(host);return p.length>(colombian?3:2)?p.slice(colombian?-3:-2).join("."):host;}
function label(title:string|null, host:string|null){const t=(title??"").split(/[|–—-]/)[0].trim();return t||host?.split(".")[0]||"Unknown";}
function geography(text:string){for(const x of ["Bogotá","Medellín","Cali","Barranquilla","Cartagena","Bucaramanga","Pereira","Manizales","Armenia"]){if(text.toLowerCase().includes(x.toLowerCase()))return x;}return "Colombia/unknown";}

export function classifyRetailResult(item:SearchResultItem):RetailEntityClass{
 const text=`${item.title??""} ${item.snippet??""} ${item.url}`; const host=hostOf(item.url);
 if(marketplaceHosts.test(host??""))return /vendedor|seller|tienda oficial/i.test(text)?"marketplace_seller":"marketplace_platform";
 if(articleText.test(text))return "article";
 if(directoryText.test(text))return "directory";
 if(distributorText.test(text)&&!retailText.test(text))return "distributor";
 if(chainText.test(text))return "chain";
 if(/franquicia|franchise/i.test(text))return "franchise_operator";
 if(retailText.test(text))return "retailer";
 return "other";
}

export function buildRetailLiveArtifact(observations:RetailLiveObservation[], calls:RetailProviderCall[], capturedAt:string){
 const seen=new Set<string>();
 const candidates:RetailLiveCandidate[]=observations.flatMap(o=>o.response.results.map(item=>{
   const host=hostOf(item.url), domain=rootDomain(host), entityClass=classifyRetailResult(item), text=`${item.title??""} ${item.snippet??""}`;
   const official=Boolean(domain&&!excludedHosts.test(domain)); const key=domain??item.canonical_url; const duplicate=seen.has(key); seen.add(key);
   const compatible=["retailer","chain","franchise_operator","marketplace_seller"].includes(entityClass);
   const assortment=official&&assortmentText.test(text)?text.slice(0,260):null;
   return {raw_name:label(item.title,host),canonical_account:official?label(item.title,host):null,canonical_domain:official?domain:null,url:item.canonical_url,provider:o.provider,source_id:o.source_id,cohort:o.cohort,entity_class:entityClass,real_business:compatible||entityClass==="distributor",retail_compatible:compatible,digital_presence:official,marketplace_contamination:entityClass.startsWith("marketplace"),geography:geography(text),assortment_evidence:assortment,assortment_evidence_state:assortment?"observed_search_evidence":"not_observed",product_listing_plausibility:compatible&&assortment?"structurally_plausible":compatible?"weak":"unsupported",buying_intent:"not_inferred",novelty:duplicate?"duplicate_identity":"genuinely_new",confidence:official&&compatible?"moderate":"low",evidence_basis:"live_provider"} as RetailLiveCandidate;
 }));
 const uniq=candidates.filter(x=>x.novelty==="genuinely_new"), compatible=uniq.filter(x=>x.retail_compatible), resolved=uniq.filter(x=>x.canonical_domain);
 const baseDomains=new Set(candidates.filter(x=>x.provider!=="exa"&&x.canonical_domain).map(x=>x.canonical_domain));
 const exaUnique=uniq.filter(x=>x.provider==="exa"&&x.retail_compatible&&x.canonical_domain&&!baseDomains.has(x.canonical_domain));
 const sat=[10,20,30,50,100].filter(n=>n<=candidates.length).map(n=>({processed:n,unique_accounts:new Set(candidates.slice(0,n).map(x=>x.canonical_domain??x.url)).size,useful_accounts:candidates.slice(0,n).filter(x=>x.retail_compatible&&x.novelty==="genuinely_new").length}));
 const byProvider=Object.fromEntries(Array.from(new Set(observations.map(x=>x.provider))).map(p=>{const rows=candidates.filter(x=>x.provider===p);return [p,{raw:rows.length,unique:new Set(rows.map(x=>x.canonical_domain??x.url)).size,retail_compatible:rows.filter(x=>x.retail_compatible).length,digital:rows.filter(x=>x.digital_presence).length,avg_latency_ms:Math.round(calls.filter(x=>x.provider===p).reduce((n,x)=>n+x.latency_ms,0)/Math.max(1,calls.filter(x=>x.provider===p).length))}]}));
 const cohortFunnels=Object.fromEntries((["specialized_structured_first","search_first","hybrid","exa_escalation"] as RetailCohort[]).map(cohort=>{const rows=candidates.filter(x=>x.cohort===cohort),uniqueRows=rows.filter(x=>x.novelty==="genuinely_new");return [cohort,{executed:rows.length>0,raw:rows.length,unique:uniqueRows.length,canonical:new Set(uniqueRows.filter(x=>x.canonical_domain).map(x=>x.canonical_domain)).size,compatible:uniqueRows.filter(x=>x.retail_compatible).length,evidence_sufficient:uniqueRows.filter(x=>x.retail_compatible&&x.assortment_evidence).length}]}));
 const geographyComposition=Object.fromEntries(Array.from(new Set(uniq.map(x=>x.geography))).map(g=>[g,uniq.filter(x=>x.geography===g).length]));
 const strongReview=uniq.filter(x=>x.retail_compatible&&x.digital_presence&&x.product_listing_plausibility==="structurally_plausible").slice(0,10);
 const borderlineReview=uniq.filter(x=>x.retail_compatible&&!strongReview.includes(x)).slice(0,10);
 const rejectedReview=uniq.filter(x=>!x.retail_compatible).slice(0,10);
 const snapshots:SourcePerformanceSnapshot[]=Array.from(new Set(observations.map(x=>x.source_id))).map(source_id=>{const rows=candidates.filter(x=>x.source_id===source_id), good=rows.filter(x=>x.retail_compatible);return {source_id,cycle_id:RETAIL_LIVE_BENCHMARK_ID,captured_at:capturedAt,country:"CO",candidates_discovered:rows.length,valid_entities:rows.filter(x=>x.real_business).length,correct_business_models:good.length,context_compatible:good.length,evidence_sufficient:good.filter(x=>x.assortment_evidence).length,opportunity_plausible:good.filter(x=>x.product_listing_plausibility!=="unsupported").length,portfolio_accounts:0,novelty_yield:good.length?good.filter(x=>x.novelty==="genuinely_new").length/good.length:null,false_positives:rows.filter(x=>!x.real_business).length,duplicates:rows.filter(x=>x.novelty==="duplicate_identity").length,extraction_failures:0,access_failures:observations.filter(x=>x.source_id===source_id&&!x.response.ok).length,avg_cost:null,avg_latency_ms:Math.round(observations.filter(x=>x.source_id===source_id).reduce((n,x)=>n+x.response.latency_ms,0)/Math.max(1,observations.filter(x=>x.source_id===source_id).length)),client_selected_rate:null,contact_rate:null,order_rate:null,outcome_state:"awaiting_real_outcomes"};});
 const exaExecuted=observations.some(x=>x.provider==="exa");
 return {id:RETAIL_LIVE_BENCHMARK_ID,version:RETAIL_LIVE_VERSION,live_execution:true,data_basis:"live_provider",captured_at:capturedAt,context:{country:"CO",cluster:"retail",route:"retail_listing",mechanism:"product_listing",client_specific:false},budget:{hard_max_provider_calls:RETAIL_LIVE_CALL_BUDGET,actual_calls:calls.length,within_budget:calls.length<=RETAIL_LIVE_CALL_BUDGET},calls,candidates,cohort_funnels:cohortFunnels,metrics:{raw_results:candidates.length,unique_results:uniq.length,canonical_accounts:new Set(resolved.map(x=>x.canonical_domain)).size,retail_compatible:compatible.length,retailer_precision:uniq.length?compatible.length/uniq.length:0,digital_resolution_rate:uniq.length?resolved.length/uniq.length:0,marketplace_contamination_rate:uniq.length?uniq.filter(x=>x.marketplace_contamination).length/uniq.length:0,assortment_evidence_yield:compatible.length?compatible.filter(x=>x.assortment_evidence).length/compatible.length:0,product_listing_plausible:compatible.filter(x=>x.product_listing_plausibility==="structurally_plausible").length,buying_intent_inferred:0,location_inflation_ratio:resolved.length?candidates.filter(x=>x.canonical_domain).length/new Set(resolved.map(x=>x.canonical_domain)).size:0,exa_executed:exaExecuted,exa_incremental_accounts:exaExecuted?exaUnique.length:null},observed_sample_composition:{geography:geographyComposition,entity_classes:Object.fromEntries(Array.from(new Set(uniq.map(x=>x.entity_class))).map(k=>[k,uniq.filter(x=>x.entity_class===k).length])),warning:"Observed sample only; not population percentages."},provider_performance:byProvider,saturation:sat,review_sample:{strong:strongReview,borderline:borderlineReview,rejected:rejectedReview,automated_decision_preserved:true},source_performance_snapshots:snapshots,warnings:["Observed search-result evidence is not buying intent.","Sample composition is not market representativeness.","No people data and no customer-specific scoring."],stop_reason:calls.length>=RETAIL_LIVE_CALL_BUDGET?"hard_budget_reached":"planned_queries_completed"};
}
