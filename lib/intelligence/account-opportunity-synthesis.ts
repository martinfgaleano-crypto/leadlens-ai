export const ACCOUNT_OPPORTUNITY_VERSION = "account-opportunity-synthesis-v1";
export type ContextQuality = "complete"|"usable"|"partial"|"insufficient"|"conflicting"|"stale"|"not_available";
export type FitState = "strong"|"moderate"|"weak"|"conflicting"|"insufficient_evidence"|"not_applicable";
export type Decision = "act_now"|"investigate_now"|"prioritize"|"monitor"|"low_priority"|"exclude";
export type TimingState = "supported_current_timing"|"emerging_timing"|"no_current_timing"|"stale_timing"|"contradicted_timing"|"not_measured";
export type ProvenanceState = "explicit"|"inferred";
export interface ContextField<T=unknown>{value:T;provenance:string[];confidence:number;state:ProvenanceState;updated_at:string}
export interface ClientContext {
  context_id:string;client_id:string;tenant_id:string|null;client_name:ContextField<string|null>;verified_domain:ContextField<string|null>;
  geography:ContextField<string[]>;business_model:ContextField<string|null>;company_stage:ContextField<string|null>;
  offer_categories:ContextField<string[]>;value_proposition:ContextField<string|null>;positioning:ContextField<string|null>;
  target_segments:ContextField<string[]>;excluded_segments:ContextField<string[]>;priority_channels:ContextField<string[]>;
  objective:ContextField<string|null>;constraints:ContextField<string[]>;unknown_fields:string[];
  quality:ContextQuality;quality_reasons:string[];methodology_version:string;
}
const hash=(v:string)=>{let h=2166136261;for(let i=0;i<v.length;i++){h^=v.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)};
const field=<T>(value:T,source:string,updated_at:string,confidence=1,state:ProvenanceState="explicit"):ContextField<T>=>({value,provenance:[source],confidence,state,updated_at});
export function buildClientContext(input:{client_id:string;tenant_id?:string|null;captured_at:string;client_name?:string|null;verified_domain?:string|null;geography?:string[];offering?:string|null;objective?:string|null;segments?:string[];excluded?:string[];constraints?:string[];source:string}):ClientContext{
  const unknown=["business_model","company_stage","price_positioning","minimum_order","fulfillment_constraints","certifications","product_formats","customization_capacity","distribution_capability","production_capacity","account_size_constraints","current_partnerships","preferred_deal_type","sales_cycle_tolerance","margins","white_label_capacity","delivery_radius"];
  const known=[input.offering,input.geography?.length,input.segments?.length,input.objective].filter(Boolean).length;
  const quality:ContextQuality=known===4?"usable":known>=2?"partial":"insufficient";
  return {
    context_id:`ctx_${hash(`${input.client_id}:${input.captured_at}:${input.offering}`)}`,client_id:input.client_id,tenant_id:input.tenant_id??null,
    client_name:field(input.client_name??null,input.source,input.captured_at,input.client_name?.trim()?1:0),
    verified_domain:field(input.verified_domain??null,input.source,input.captured_at,input.verified_domain?.trim()?1:0),
    geography:field(input.geography??[],input.source,input.captured_at),business_model:field(null,input.source,input.captured_at,0),
    company_stage:field(null,input.source,input.captured_at,0),offer_categories:field(input.offering?[input.offering]:[],input.source,input.captured_at),
    value_proposition:field(input.offering??null,input.source,input.captured_at,.9),positioning:field(null,input.source,input.captured_at,0),
    target_segments:field(input.segments??[],input.source,input.captured_at),excluded_segments:field(input.excluded??[],input.source,input.captured_at),
    priority_channels:field(input.segments??[],input.source,input.captured_at,.85),objective:field(input.objective??null,input.source,input.captured_at),
    constraints:field(input.constraints??[],input.source,input.captured_at),unknown_fields:unknown,quality,
    quality_reasons:[`${known}/4 minimum reasoning groups are explicit.`,`${unknown.length} operational or commercial fields remain unknown.`],
    methodology_version:ACCOUNT_OPPORTUNITY_VERSION,
  };
}
export interface FitDimension{dimension:string;state:FitState;evidence:string[];client_fields:string[];account_fields:string[];confidence:number;limitations:string[];disqualifiers:string[];next_verification:string}
export interface AccessPath{type:string;account_relevance:string;client_feasibility:FitState;likely_internal_owner:{role:string;state:"evidenced"|"sector_informed_inference"|"hypothesis"|"unknown"};required_evidence:string[];entry_barrier:"low"|"medium"|"high"|"unknown";complexity:"low"|"medium"|"high"|"unknown";sales_cycle:"short"|"medium"|"long"|"unknown";key_risk:string;next_step:string;confidence:number;direct_access_proven:false}
export interface UseCase{use_case_id:string;statement:string;client_offer:string;account_need:string;evidence:string[];inferences:string[];assumptions:string[];commercial_value:string;operational_requirements:string[];likely_owner:string;timing_state:TimingState;confidence:number;disqualifying_evidence:string[];next_validation_action:string}
export interface BuyingPath{need_owner:{role:string;state:"sector_informed_inference"|"unknown"};category_owner:{role:string;state:"sector_informed_inference"|"unknown"};operational_user:{role:string;state:"sector_informed_inference"|"unknown"};economic_buyer:{role:string;state:"hypothesis"|"unknown"};procurement_role:{role:string;state:"hypothesis"|"unknown"};blocker:string;approval_sequence:string[];evidence_required:string[];pilot:string;complexity:string;confidence:number}
export interface Gate{gate:string;state:"pass"|"fail"|"partial"|"not_measured";confidence:number;evidence:string[];failure_reason:string|null;next_action:string}
export interface ResearchQuestion{question:string;why:string;decision_affected:Decision[];verification:string;effort:"low"|"medium"|"high";priority:"high"|"medium"|"low"}
export interface OpportunityThesis{
  thesis_id:string;account_id:string;account_name:string;domain:string;segment:string;geography:string;identity_confidence:number;
  context_id:string;context_quality:ContextQuality;fit:FitDimension[];use_cases:UseCase[];access_paths:AccessPath[];buying_path:BuyingPath;
  opportunity_statement:string;why_this_account:string[];why_now:{state:TimingState;statement:string;evidence:string[]};
  why_not_now:string[];entry_strategy:{approach:string;message_angle:string;value_proposition:string;proof_required:string[];motion:string;next_action:string};
  counterevidence:{negative_evidence:string[];alternative_explanation:string;classification:"plausible_alternative_explanation"|"evidenced_counterevidence"|"unresolved_risk";confidence_impact:number};
  gates:Gate[];decision:Decision;monitoring_trigger:{statement:string;evidence_needed:string;review_horizon_days:number};
  questions:ResearchQuestion[];confidence:{identity:number;structural:number;client_fit:number;use_case:number;accessibility:number;buying_path:number;evidence:number;timing:number;strategy:number;overall:number;limiting_factor:string};
  limitations:string[];internal_only:true;review_state:"unreviewed";ranking_impact:"off";report_impact:"off";methodology_version:string;
}
const SEGMENT:{[k:string]:{use:string;owner:string;path:string;role:string}}={
  retail:{use:"assortment of botanical wellness beverages",owner:"retail buying / category management",path:"category-buyer outreach",role:"category management"},
  distribution:{use:"portfolio expansion with a Colombian botanical beverage category",owner:"distribution management",path:"distributor introduction",role:"distribution management"},
  hospitality:{use:"guest wellness beverage or spa amenity pilot",owner:"food and beverage / guest experience",path:"hospitality or operations outreach",role:"food and beverage"},
  wellness:{use:"complementary botanical beverage for wellness routines",owner:"wellness operations",path:"partnership proposal",role:"wellness operations"},
};
export function synthesizeOpportunity(input:{context:ClientContext;account:{id:string;name:string;domain:string;segment:string;country:string;structural_score:number;identity_confidence:number;decision:Decision;claim_refs:string[];current_signal_refs:string[];trigger:{statement:string;evidence_needed:string;review_horizon_days:number}}}):OpportunityThesis|null{
  if(!["usable","complete","partial"].includes(input.context.quality)||input.account.identity_confidence<.8)return null;
  const s=SEGMENT[input.account.segment]??SEGMENT.retail;const excluded=input.context.excluded_segments.value.includes(input.account.segment);
  const geo=input.context.geography.value.includes(input.account.country);const segment=input.context.target_segments.value.includes(input.account.segment);
  const dims:FitDimension[]=[
    ["offer_category_fit",segment?"strong":"weak",["Explicit botanical infusion offer and verified account segment."],["offer_categories"],["segment"],segment?.82:.35],
    ["segment_fit",segment?"strong":"conflicting",[segment?"Segment is explicitly prioritized.":"Segment is not prioritized."],["target_segments"],["segment"],segment?.95:.25],
    ["geography_fit",geo?"strong":"conflicting",[geo?"Colombia is explicit target geography.":"Geography mismatch."],["geography"],["country"],geo?.98:.1],
    ["channel_fit",segment?"moderate":"weak",["Account segment is a plausible channel; channel operating model is unverified."],["priority_channels"],["segment"],.62],
    ["account_scale_fit","insufficient_evidence",[],["account_size_constraints"],[],.1],
    ["commercial_accessibility_fit","moderate",["A role-category route is plausible; direct access is not proven."],["objective"],["domain","segment"],.55],
    ["operational_feasibility","insufficient_evidence",[],["fulfillment_constraints","distribution_capability","certifications"],[],.1],
    ["brand_positioning_fit","moderate",["Wellness category alignment is plausible; account price architecture is unverified."],["offer_categories"],["segment"],.55],
    ["strategic_fit",segment&&geo?"strong":"weak",["Target geography and segment are explicit."],["objective","target_segments"],["country","segment"],.8],
    ["economic_potential_fit","insufficient_evidence",[],["price_positioning","margins"],[],.1],
    ["client_capacity_fit","insufficient_evidence",[],["production_capacity","distribution_capability"],[],.1],
    ["relationship_path_plausibility","moderate",["Sector role category can be tested without assuming a contact."],["objective"],["segment","domain"],.5],
  ].map(([dimension,state,evidence,client_fields,account_fields,confidence])=>({dimension:dimension as string,state:state as FitState,evidence:evidence as string[],client_fields:client_fields as string[],account_fields:account_fields as string[],confidence:confidence as number,limitations:["No verified buying intent or procurement path."],disqualifiers:excluded?["Client excluded this segment."]:[],next_verification:"Verify account procurement model and client operational feasibility."}));
  const timing:TimingState=input.account.current_signal_refs.length?"supported_current_timing":"no_current_timing";
  const uc:UseCase={use_case_id:`uc_${hash(`${input.account.id}:${s.use}`)}`,statement:`Evaluate ${s.use} for ${input.account.name}.`,client_offer:input.context.offer_categories.value[0]??"Unknown offer",account_need:"Plausible category/channel use; demand is not evidenced.",evidence:[...input.account.claim_refs],inferences:[`Sector-informed fit for ${input.account.segment}.`],assumptions:["Account assortment/procurement openness is unverified."],commercial_value:"Test account-specific category relevance without claiming demand.",operational_requirements:["Verify formats, certifications, minimum order, fulfillment and margin viability."],likely_owner:s.owner,timing_state:timing,confidence:.61,disqualifying_evidence:[],next_validation_action:"Inspect current assortment and verify procurement route."};
  const access:AccessPath={type:s.path,account_relevance:`Plausible for ${input.account.segment}.`,client_feasibility:"insufficient_evidence",likely_internal_owner:{role:s.role,state:"sector_informed_inference"},required_evidence:["Procurement ownership","Supplier onboarding path","Client fulfillment feasibility"],entry_barrier:"unknown",complexity:"unknown",sales_cycle:"unknown",key_risk:"Website presence does not establish direct commercial access.",next_step:"Verify role category and whether purchasing is direct, centralized or distributor-led.",confidence:.48,direct_access_proven:false};
  const bp:BuyingPath={need_owner:{role:s.role,state:"sector_informed_inference"},category_owner:{role:s.owner,state:"sector_informed_inference"},operational_user:{role:s.role,state:"sector_informed_inference"},economic_buyer:{role:"general management or budget owner",state:"hypothesis"},procurement_role:{role:"procurement",state:"hypothesis"},blocker:"Unknown supplier onboarding, economics and operational feasibility.",approval_sequence:["Category relevance validation","Sample/pilot evaluation","Commercial negotiation","Procurement approval","Operational implementation"],evidence_required:["Current assortment","Required certifications","Volume and margin constraints","Fulfillment requirements"],pilot:"A bounded sample or assortment validation only if client capacity and account interest are verified.",complexity:"unknown",confidence:.42};
  const whyNot=["No current dated commercial signal has been identified.","No evidence of active sourcing, expansion or category-change window.","Client capacity, pricing, certifications, minimum order and distribution feasibility are unknown.","Procurement path and direct accessibility are unverified."];
  const fitPass=segment&&geo&&!excluded;const decision:Decision=excluded?"exclude":fitPass?(input.account.decision==="monitor"?"monitor":"prioritize"):"low_priority";
  const gates:Gate[]=[
    ["client_context",input.context.quality==="usable"?"pass":"partial",.75,["Explicit offer, geography, objective and segments."],null,"Collect operational and economic client constraints."],
    ["account_identity","pass",input.account.identity_confidence,[input.account.domain],null,"Maintain identity verification."],
    ["structural_fit",input.account.structural_score>=60?"pass":"fail",input.account.structural_score/100,input.account.claim_refs,null,"Verify account structure."],
    ["client_fit",fitPass?"pass":"fail",.72,["Explicit geography and segment."],fitPass?null:"Client segment/geography mismatch.","Resolve mismatch."],
    ["accessibility","partial",.48,[], "Route category is plausible but access is not verified.","Verify procurement route."],
    ["use_case","pass",uc.confidence,uc.evidence,null,uc.next_validation_action],
    ["evidence","partial",.45,input.account.claim_refs,"Central commercial assumptions remain unverified.","Answer decision-changing questions."],
    ["timing",timing==="supported_current_timing"?"pass":"fail",timing==="supported_current_timing"?.75:0,input.account.current_signal_refs,timing==="no_current_timing"?"No current signal.":null,"Monitor explicit trigger."],
    ["counterevidence","pass",.7,[] ,null,"Test alternative explanation."],
    ["action",decision==="prioritize"||decision==="monitor"?"pass":"partial",.65,[],null,"Keep action bounded to research/monitoring."],
  ].map(([gate,state,confidence,evidence,failure_reason,next_action])=>({gate:gate as string,state:state as Gate["state"],confidence:confidence as number,evidence:evidence as string[],failure_reason:failure_reason as string|null,next_action:next_action as string}));
  const strategy=Math.min(.65,uc.confidence,access.confidence);
  return {
    thesis_id:`thesis_${hash(`${input.context.context_id}:${input.account.id}:${ACCOUNT_OPPORTUNITY_VERSION}`)}`,account_id:input.account.id,account_name:input.account.name,domain:input.account.domain,segment:input.account.segment,geography:input.account.country,identity_confidence:input.account.identity_confidence,context_id:input.context.context_id,context_quality:input.context.quality,fit:dims,use_cases:[uc],access_paths:[access],buying_path:bp,
    opportunity_statement:`${input.account.name} is a structurally relevant ${input.account.segment} account for testing ${s.use}; this is a fit thesis, not evidence of demand or buying intent.`,
    why_this_account:[`Verified Colombian ${input.account.segment} account.`,`Segment is explicit in the client's target context.`,`A bounded ${s.path} route can be investigated.`],
    why_now:{state:timing,statement:timing==="no_current_timing"?"No current dated commercial signal has been identified.":"A current dated signal requires human review.",evidence:input.account.current_signal_refs},
    why_not_now:whyNot,entry_strategy:{approach:"Research before outreach",message_angle:`Validate whether ${s.use} is relevant to the account.`,value_proposition:"A botanical wellness beverage category hypothesis tailored to the account segment.",proof_required:["Product formats and certifications","Fulfillment capacity","Commercial terms","Account category openness"],motion:"bounded validation then sample/pilot only if both sides qualify",next_action:"Answer the highest-priority research question before proposing contact."},
    counterevidence:{negative_evidence:[],alternative_explanation:"The account may fit the segment while using exclusive suppliers, centralized procurement or an assortment incompatible with the client.",classification:"plausible_alternative_explanation",confidence_impact:.15},
    gates,decision,monitoring_trigger:input.account.trigger,
    questions:[
      {question:`Does ${input.account.name} currently carry or use a comparable botanical infusion category?`,why:"Determines whether the use case is real rather than category similarity.",decision_affected:["prioritize","monitor","low_priority"],verification:"Review verified assortment/operations or obtain account confirmation.",effort:"low",priority:"high"},
      {question:"Is purchasing direct, centralized, location-specific or distributor-led?",why:"Determines the viable access path and decision owner.",decision_affected:["investigate_now","prioritize","monitor"],verification:"Official supplier information or bounded account inquiry.",effort:"medium",priority:"high"},
      {question:"Can the client meet required certifications, volumes, delivery and commercial terms?",why:"Tests operational feasibility before outreach.",decision_affected:["prioritize","low_priority","exclude"],verification:"Obtain explicit client operational context.",effort:"medium",priority:"high"},
    ],
    confidence:{identity:input.account.identity_confidence,structural:input.account.structural_score/100,client_fit:.72,use_case:uc.confidence,accessibility:access.confidence,buying_path:bp.confidence,evidence:.45,timing:timing==="no_current_timing"?0:.75,strategy,overall:Math.min(strategy,.45),limiting_factor:timing==="no_current_timing"?"timing":"evidence"},
    limitations:[...input.context.unknown_fields.map(x=>`Missing client context: ${x}.`),"No outcome validation.","No buying intent evidence."],internal_only:true,review_state:"unreviewed",ranking_impact:"off",report_impact:"off",methodology_version:ACCOUNT_OPPORTUNITY_VERSION,
  };
}
export interface PortfolioSynthesis{portfolio_id:string;roles:Array<{account_id:string;role:string;explanation:string}>;sequence:Array<{step:number;account_id:string;rationale:string;expected_learning:string;required_preparation:string[];dependency:string|null;risk:string;next_action:string;success_criterion:string}>;concentration:Record<string,number>;generalized_patterns:[];internal_only:true;ranking_impact:"off";methodology_version:string}
export function synthesizePortfolio(theses:OpportunityThesis[]):PortfolioSynthesis{
  const sorted=[...theses].sort((a,b)=>b.confidence.overall-a.confidence.overall||b.confidence.accessibility-a.confidence.accessibility||a.account_name.localeCompare(b.account_name));
  const concentration=theses.reduce<Record<string,number>>((m,t)=>(m[t.segment]=(m[t.segment]??0)+1,m),{});
  const roles=sorted.map((t,i)=>({account_id:t.account_id,role:t.decision==="monitor"?"monitor_account":t.segment==="distribution"?"channel_account":i===0?"accessible_entry_account":"strategic_account",explanation:t.decision==="monitor"?"Relevant but retained behind an explicit trigger.":t.segment==="distribution"?"Tests channel reach and distributor economics.":i===0?"Highest bounded thesis confidence; suitable for first validation, not automatic outreach.":"Relevant account whose thesis depends on learning from earlier validation."}));
  const sequence=sorted.map((t,i)=>({step:i+1,account_id:t.account_id,rationale:i===0?"Validate the clearest bounded account thesis first.":"Use earlier learning to reduce uncertainty.",expected_learning:"Category relevance, procurement route and client feasibility.",required_preparation:["Client operational constraints","Account procurement-path evidence"],dependency:i?sorted[i-1].account_id:null,risk:"No current timing or verified buying intent.",next_action:"Answer decision-changing questions.",success_criterion:"Use case and access path are verified or rejected without inferring demand."}));
  return {portfolio_id:`portfolio_${hash(theses.map(t=>t.thesis_id).sort().join(":"))}`,roles,sequence,concentration,generalized_patterns:[],internal_only:true,ranking_impact:"off",methodology_version:ACCOUNT_OPPORTUNITY_VERSION};
}
export function commercialStrategyOutput(input:{type:string;account_id:string|null;context_id:string;refs:string[]}){
  return {...input,output_id:`commercial_${hash(`${input.type}:${input.account_id}:${input.refs.join(",")}`)}`,internal_only:true as const,review_state:"unreviewed" as const,ranking_impact:"off" as const,report_impact:"off" as const,methodology_version:ACCOUNT_OPPORTUNITY_VERSION};
}
