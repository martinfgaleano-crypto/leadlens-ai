import {createHash} from "crypto";
import {loadEnvConfig} from "@next/env";
import {buildFounderAcceptanceCandidate} from "@/lib/intelligence/amor-de-gea-real-context-review";
import {buildPilotWorkspace,PILOT_WORKSPACE_VERSION} from "@/lib/intelligence/pilot-workspace";

loadEnvConfig(process.cwd());
const write=process.argv.includes("--write");

async function main(){
  const workspace=buildPilotWorkspace();
  const candidate=buildFounderAcceptanceCandidate(workspace.questions);
  const digest=createHash("sha256").update(JSON.stringify(candidate)).digest("hex").slice(0,24);
  const id=`intake_${digest}`;
  const {createServerClient}=await import("@/lib/supabase/server");
  const db=createServerClient();if(!db)throw new Error("database_unavailable");
  const existing=await db.from("intelligence_client_intakes").select("id,status,intake_json").eq("id",id).eq("client_id",workspace.pilot.client_id).maybeSingle();
  if(existing.error)throw new Error(`candidate_lookup_failed:${existing.error.message}`);
  const contexts=await db.from("intelligence_client_context_versions").select("id,status").eq("client_id",workspace.pilot.client_id);
  if(contexts.error)throw new Error(`context_lookup_failed:${contexts.error.message}`);
  const plan={mode:write?"write":"dry_run",pilot_id:workspace.pilot.pilot_id,intake_id:id,answers:candidate.answers.length,founder_decisions:candidate.founder_decisions.length,system_interpretations:candidate.system_interpretations.length,open_validations:candidate.open_validations.length,existing_candidate:!!existing.data,accepted_context_versions:contexts.data?.length??0,context_accepted:false,theses_recalculated:false,ranking_impact:"off",provider_calls:0,customer_safe_promoted:false,writes:0};
  if(candidate.answers.length!==17||candidate.accepted_context_created||candidate.theses_recalculated||candidate.provider_calls!==0)throw new Error("candidate_invariant_failed");
  if(!write){console.log(JSON.stringify(plan,null,2));return;}
  if(!existing.data){const {error}=await db.from("intelligence_client_intakes").insert({id,tenant_user_id:null,client_id:workspace.pilot.client_id,context_version:workspace.pilot.active_context_version??"baseline:block11",status:"submitted",intake_json:{...candidate,reviewer_state:"unreviewed",submission_does_not_activate_context:true,acceptance_requires_separate_admin_action:true},fixture_mode:false,supersedes_id:null,methodology_version:PILOT_WORKSPACE_VERSION,idempotency_key:`${workspace.pilot.pilot_id}:founder-candidate:${digest}`});if(error)throw new Error(`candidate_insert_failed:${error.message}`);}
  console.log(JSON.stringify({...plan,writes:existing.data?0:1,result:existing.data?"idempotent_noop":"candidate_created"},null,2));
}
main().catch(error=>{console.error(JSON.stringify({error:error instanceof Error?error.message:String(error),writes:0,context_accepted:false}));process.exit(1)});
