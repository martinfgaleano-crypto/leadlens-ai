import {readFile} from "node:fs/promises";
import path from "node:path";
import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/auth/require-admin";
import {canonicalPilotId} from "@/lib/intelligence/pilot-workspace";
import {createHash} from "node:crypto";
import {pilot1ArtifactIdForFilename,resolvePilot1Artifact} from "@/lib/intelligence/amor-de-gea-pilot1-delivery";
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest,{params}:{params:{pilotId:string;filename:string}}){
  const denied=requireAdmin(req);if(denied)return denied;
  if(canonicalPilotId(params.pilotId)!=="amor-de-gea")return NextResponse.json({error:"Pilot not found"},{status:404});
  const requested=params.filename;
  if(requested.includes("/")||requested.includes("\\"))return NextResponse.json({error:"Artifact not found"},{status:404});
  const artifact=resolvePilot1Artifact(requested)??resolvePilot1Artifact(pilot1ArtifactIdForFilename(requested)??"");
  if(!artifact)return NextResponse.json({error:"Final customer artifact unavailable - regeneration required."},{status:404});
  try{
    const file=await readFile(path.join(process.cwd(),"public","pilot-deliverables",artifact.filename));
    if(createHash("sha256").update(file).digest("hex")!==artifact.sha256)throw new Error("ArtifactIntegrityError");
    const preview=req.nextUrl.searchParams.get("preview")==="1"&&artifact.preview;
    return new NextResponse(file,{headers:{"Content-Type":artifact.mime,"Content-Disposition":`${preview?"inline":"attachment"}; filename="${artifact.filename}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","X-LeadLens-Artifact-Integrity":"verified"}});
  }catch(error){
    console.error("[pilot-artifact] unavailable",{pilotId:params.pilotId,artifactId:requested,errorClass:error instanceof Error?error.name:"Unknown"});
    return NextResponse.json({error:"Final customer artifact unavailable - regeneration required."},{status:404});
  }
}
