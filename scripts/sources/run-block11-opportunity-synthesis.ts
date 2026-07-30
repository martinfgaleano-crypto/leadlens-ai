import {mkdirSync,readFileSync,readdirSync,writeFileSync} from "fs";
import {join} from "path";
import {buildClientContext,commercialStrategyOutput,synthesizeOpportunity,synthesizePortfolio} from "@/lib/intelligence/account-opportunity-synthesis";
const root=process.cwd(),rqDir=join(root,"ml/data/research-quality"),erDir=join(root,"ml/data/entity-resolution");
const rqName=readdirSync(rqDir).filter(x=>/^amor-de-gea-block7-.*\.json$/.test(x)).sort().at(-1)!;
const erName=readdirSync(erDir).filter(x=>/^amor-de-gea-block10-.*\.json$/.test(x)).sort().at(-1)!;
const rq=JSON.parse(readFileSync(join(rqDir,rqName),"utf8")),er=JSON.parse(readFileSync(join(erDir,erName),"utf8"));
const c=rq.client_context;
const context=buildClientContext({client_id:c.client_id,tenant_id:null,captured_at:c.captured_at,client_name:"Amor de Gea",geography:[c.region],offering:c.offering,objective:c.objective,segments:c.priority_segments,excluded:c.excluded_segments,constraints:c.explicit_constraints,source:`ml/data/research-quality/${rqName}#client_context`});
const theses=rq.accounts.map((a:any)=>{
  const identity=er.accounts.find((e:any)=>e.domain===a.domain);
  const trig=a.qualification.monitoring_triggers[0];
  return synthesizeOpportunity({context,account:{id:a.profile.profile_id,name:a.account,domain:a.domain,segment:a.profile.segment,country:a.profile.country,structural_score:a.profile.structural_score,identity_confidence:identity?.identity_profile?.identity_confidence??0,decision:a.qualification.state,claim_refs:a.claims.map((x:any)=>x.claim_id),current_signal_refs:[],trigger:{statement:trig?.why_it_matters??"Monitor decision-changing account evidence.",evidence_needed:trig?.evidence_needed??"Dated attributable event.",review_horizon_days:trig?.review_horizon_days??90}}});
}).filter(Boolean);
const portfolio=synthesizePortfolio(theses);
const outputs=theses.flatMap((t:any)=>[
  commercialStrategyOutput({type:"account_opportunity_thesis",account_id:t.account_id,context_id:context.context_id,refs:[t.thesis_id]}),
  commercialStrategyOutput({type:"commercial_use_case",account_id:t.account_id,context_id:context.context_id,refs:t.use_cases.map((x:any)=>x.use_case_id)}),
  commercialStrategyOutput({type:"commercial_access_path",account_id:t.account_id,context_id:context.context_id,refs:[t.thesis_id]}),
  commercialStrategyOutput({type:"buying_path_hypothesis",account_id:t.account_id,context_id:context.context_id,refs:[t.thesis_id]}),
  commercialStrategyOutput({type:"why_now_assessment",account_id:t.account_id,context_id:context.context_id,refs:[t.thesis_id]}),
  commercialStrategyOutput({type:"why_not_now_assessment",account_id:t.account_id,context_id:context.context_id,refs:[t.thesis_id]}),
  commercialStrategyOutput({type:"commercial_research_question",account_id:t.account_id,context_id:context.context_id,refs:t.questions.map((_:any,i:number)=>`${t.thesis_id}:q${i}`)}),
]);
const summary={accounts:rq.accounts.length,context_quality:context.quality,context_unknown_fields:context.unknown_fields.length,theses:theses.length,use_cases:theses.reduce((n:number,t:any)=>n+t.use_cases.length,0),access_paths:theses.reduce((n:number,t:any)=>n+t.access_paths.length,0),buying_paths:theses.length,usable_client_fit:theses.filter((t:any)=>t.gates.find((g:any)=>g.gate==="client_fit")?.state==="pass").length,strong_use_case_clarity:0,plausible_access_paths:theses.length,blocked_by_context:0,blocked_by_timing:theses.filter((t:any)=>t.why_now.state==="no_current_timing").length,blocked_by_evidence:theses.filter((t:any)=>t.gates.find((g:any)=>g.gate==="evidence")?.state!=="pass").length,decisions:theses.reduce((m:any,t:any)=>(m[t.decision]=(m[t.decision]??0)+1,m),{}),review_state:"unreviewed",customer_safe_outputs:0};
const artifact={methodology_version:"account-opportunity-synthesis-v1",generated_at:new Date().toISOString(),sources:{research_quality:rqName,entity_resolution:erName},reuse_readiness:{client_context:"migration 042 intelligence_client_contexts",dossiers:"migration 042 intelligence_dossiers",validation:"migration 041 lifecycle",entity_profiles:"migration 044 records",new_semantics:"migration 045 generated, not applied"},summary,client_context:context,theses,portfolio,outputs,internal_only:true,ranking_impact:"off",report_impact:"off"};
const outDir=join(root,"ml/data/opportunity-synthesis");mkdirSync(outDir,{recursive:true});const out=join(outDir,`amor-de-gea-block11-${artifact.generated_at.replace(/[:.]/g,"-")}.json`);writeFileSync(out,JSON.stringify(artifact,null,2));console.log(JSON.stringify({out,summary,portfolio_roles:portfolio.roles},null,2));
