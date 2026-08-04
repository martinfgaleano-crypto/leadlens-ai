import {readFile} from "node:fs/promises";
import path from "node:path";
import {NextRequest,NextResponse} from "next/server";
import {requireAdmin} from "@/lib/auth/require-admin";
import {canonicalPilotId} from "@/lib/intelligence/pilot-workspace";

const ARTIFACTS={
  "Amor-de-Gea-LeadLens-Pilot-1-Final-Report.pdf":"application/pdf",
  "Amor-de-Gea-Account-Action-Briefs-Pilot-1.pdf":"application/pdf",
  "Amor-de-Gea-LeadLens-Pilot-1-Feedback.pdf":"application/pdf",
  "Amor-de-Gea-LeadLens-Pilot-1-Feedback.docx":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;
export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function GET(req:NextRequest,{params}:{params:{pilotId:string;filename:string}}){
  const denied=requireAdmin(req);if(denied)return denied;
  if(!canonicalPilotId(params.pilotId))return NextResponse.json({error:"Pilot not found"},{status:404});
  const filename=params.filename;
  if(filename.includes("/")||filename.includes("\\")||!(filename in ARTIFACTS))return NextResponse.json({error:"Artifact not found"},{status:404});
  try{
    const file=await readFile(path.join(process.cwd(),"public","pilot-deliverables",filename));
    return new NextResponse(file,{headers:{"Content-Type":ARTIFACTS[filename as keyof typeof ARTIFACTS],"Content-Disposition":`attachment; filename="${filename}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(error){
    console.error("[pilot-artifact] unavailable",{pilotId:params.pilotId,filename,errorClass:error instanceof Error?error.name:"Unknown"});
    return NextResponse.json({error:"Not available in this deployment"},{status:404});
  }
}
