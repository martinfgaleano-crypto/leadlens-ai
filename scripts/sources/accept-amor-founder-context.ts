import {loadEnvConfig} from "@next/env";
import {NextRequest} from "next/server";
import {POST} from "@/app/api/admin/intelligence/pilots/[pilotId]/operations/route";
import {buildPilotWorkspace} from "@/lib/intelligence/pilot-workspace";

loadEnvConfig(process.cwd());
const AUTHORIZED_CANDIDATE="intake_fb4bc38a8e0af0343c9f8f1e";

async function main(){
  const token=process.env.ADMIN_SECRET_TOKEN;if(!token)throw new Error("admin_secret_unavailable");
  const workspace=buildPilotWorkspace();
  const {createServerClient}=await import("@/lib/supabase/server");const db=createServerClient();if(!db)throw new Error("database_unavailable");
  const candidate=await db.from("intelligence_client_intakes").select("id,status,intake_json").eq("id",AUTHORIZED_CANDIDATE).eq("client_id",workspace.pilot.client_id).maybeSingle();
  if(candidate.error||!candidate.data)throw new Error("authorized_candidate_not_found");
  if(candidate.data.status!=="submitted"||candidate.data.intake_json?.pilot_id!==workspace.pilot.pilot_id)throw new Error("authorized_candidate_inconsistent");
  const answers=Array.isArray(candidate.data.intake_json?.answers)?candidate.data.intake_json.answers:[];
  const ids=answers.map((answer:any)=>answer.question_id);
  if(ids.length!==17||new Set(ids).size!==17)throw new Error("authorized_candidate_question_mismatch");
  const before=await db.from("intelligence_client_context_versions").select("id,status,source_intake_id,version_number,context_json,effective_at").eq("client_id",workspace.pilot.client_id);
  if(before.error)throw new Error(`context_lookup_failed:${before.error.message}`);
  if((before.data??[]).some(row=>row.source_intake_id!==AUTHORIZED_CANDIDATE))throw new Error("unexpected_prior_context_version");
  const existing=(before.data??[]).find(row=>row.source_intake_id===AUTHORIZED_CANDIDATE);
  if(existing){const context=existing.context_json as any;if(existing.status!=="accepted"||context?.accepted_answers?.length!==17||context?.explicit_limitations?.length!==15||context?.deterministic_recalculation?.provider_calls!==0||context?.ranking_impact!=="off"||context?.customer_safe_promoted!==false)throw new Error("accepted_context_integrity_failed");console.log(JSON.stringify({result:"already_accepted_and_verified",context_version_id:existing.id,version_number:existing.version_number,effective_at:existing.effective_at,source_intake_id:existing.source_intake_id,accepted_answers:context.accepted_answers.length,limitations:context.explicit_limitations.length,provenance_layers:Object.keys(context.provenance_layers??{}),provider_calls:0,ranking_impact:"off",customer_safe_promoted:false,total_client_context_versions:(before.data??[]).length},null,2));return;}
  const req=new NextRequest("http://localhost:3000/api/admin/intelligence/pilots/amor-de-gea/operations",{method:"POST",headers:{"content-type":"application/json","x-admin-token":token},body:JSON.stringify({action:"accept_context",intake_id:AUTHORIZED_CANDIDATE,accepted_question_ids:ids,rejected_question_ids:[]})});
  const response=await POST(req,{params:{pilotId:"amor-de-gea"}});const payload=await response.json();
  if(!response.ok)throw new Error(`accept_context_failed:${response.status}:${JSON.stringify(payload)}`);
  console.log(JSON.stringify(payload,null,2));
}
main().catch(error=>{console.error(JSON.stringify({error:error instanceof Error?error.message:String(error),candidate_id:AUTHORIZED_CANDIDATE}));process.exit(1)});
