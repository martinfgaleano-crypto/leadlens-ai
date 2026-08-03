import {createHash} from "crypto";
import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/auth/require-admin";
import {buildFounderAcceptanceCandidate} from "@/lib/intelligence/amor-de-gea-real-context-review";
import {buildPilotWorkspace,canonicalPilotId,PILOT_WORKSPACE_VERSION} from "@/lib/intelligence/pilot-workspace";

export async function POST(req:NextRequest,{params}:{params:{pilotId:string}}){
  const denied=requireAdmin(req);if(denied)return denied;
  const pilotId=canonicalPilotId(params.pilotId);if(!pilotId)return NextResponse.json({error:"pilot_not_found"},{status:404});
  const workspace=buildPilotWorkspace();
  const candidate=buildFounderAcceptanceCandidate(workspace.questions);
  const digest=createHash("sha256").update(JSON.stringify(candidate)).digest("hex").slice(0,24);
  const id=`intake_${digest}`;
  const {createServerClient}=await import("@/lib/supabase/server");
  const db=createServerClient();if(!db)return NextResponse.json({error:"database_unavailable",context_accepted:false},{status:503});
  const row={id,tenant_user_id:null,client_id:pilotId,context_version:workspace.pilot.active_context_version??"baseline:block11",status:"submitted",intake_json:{...candidate,reviewer_state:"unreviewed",submission_does_not_activate_context:true,acceptance_requires_separate_admin_action:true},fixture_mode:false,supersedes_id:null,methodology_version:PILOT_WORKSPACE_VERSION,idempotency_key:`${pilotId}:founder-candidate:${digest}`};
  const {error}=await db.from("intelligence_client_intakes").upsert(row,{onConflict:"tenant_user_id,client_id,idempotency_key",ignoreDuplicates:true});
  if(error)return NextResponse.json({error:"candidate_persistence_failed",message:error.message,context_accepted:false},{status:500});
  return NextResponse.json({ok:true,intake_id:id,state:candidate.state,answers:candidate.answers.length,founder_decisions:candidate.founder_decisions.length,open_validations:candidate.open_validations.length,context_accepted:false,acceptance_requires_separate_admin_action:true},{status:201});
}
