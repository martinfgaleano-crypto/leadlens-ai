import type {AMOR_PILOT1_FINAL} from "./amor-de-gea-pilot1-finalization";

export type Pilot1ArtifactId="pilot1-final-report"|"pilot1-action-briefs"|"pilot1-feedback-pdf"|"pilot1-feedback-docx";
export type PilotDeliveryState="founder_review_required"|"ready_for_delivery"|"delivered"|"feedback_pending"|"feedback_received"|"closed";
export type FeedbackDocumentState="draft"|"ready_for_delivery"|"delivered"|"partially_completed"|"completed"|"founder_reviewed"|"incorporated";

export const AMOR_PILOT1_DELIVERABLES={
  "pilot1-final-report":{filename:"Amor-de-Gea-LeadLens-Pilot-1-Final-Report.pdf",label:"REPORTE FINAL PARA CLIENTE - 10 CUENTAS",type:"final_customer_report",mime:"application/pdf",version:"V3R3 / 1.0",pages:23,size:33744,sha256:"5af16350c6dce577f7f46af8965417f8831261d9641b780a46f6920ae2d521cc",generatedDate:"2026-08-03",preview:true},
  "pilot1-action-briefs":{filename:"Amor-de-Gea-Account-Action-Briefs-Pilot-1.pdf",label:"Account Action Briefs - 4 cuentas",type:"customer_action_briefs",mime:"application/pdf",version:"1.0",pages:8,size:14055,sha256:"9904f1f4f660fc3b3095c3c8c98781f99df25fb704e5215ba3e366866ab3184f",generatedDate:"2026-08-03",preview:true},
  "pilot1-feedback-pdf":{filename:"Amor-de-Gea-LeadLens-Pilot-1-Feedback.pdf",label:"Retroalimentacion - PDF",type:"customer_feedback",mime:"application/pdf",version:"1.0",pages:14,size:13965,sha256:"24c06c394f92d72b552d8e794c3256d529b370c7caf96c7ed7428879efe23deb",generatedDate:"2026-08-03",preview:true},
  "pilot1-feedback-docx":{filename:"Amor-de-Gea-LeadLens-Pilot-1-Feedback.docx",label:"Retroalimentacion - DOCX editable",type:"customer_feedback",mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",version:"1.0",pages:null,size:39588,sha256:"8686eea333b7beab21702456a7b96a82eb88ad179198ebe72034969c11e0e7fd",generatedDate:"2026-08-03",preview:false},
} as const satisfies Record<Pilot1ArtifactId,{filename:string;label:string;type:string;mime:string;version:string;pages:number|null;size:number;sha256:string;generatedDate:string;preview:boolean}>;

export const AMOR_PILOT1_DELIVERY_MANIFEST=(Object.entries(AMOR_PILOT1_DELIVERABLES) as [Pilot1ArtifactId,(typeof AMOR_PILOT1_DELIVERABLES)[Pilot1ArtifactId]][]).map(([artifactId,artifact])=>({
  client:"Amor de Gea",pilot:"Pilot 1",artifactId,...artifact,reviewStatus:"founder_review_required" as const,deliveryStatus:"not_delivered" as const,
}));

export const AMOR_PILOT1_HISTORICAL_ARTIFACTS=[{
  artifactId:"amor-de-gea-internal-pilot-brief-v3",filename:"leadlens-amor-de-gea-informe-interno-[fecha].pdf",type:"internal_historical_brief",audience:"internal",portfolioVersion:"pre-V3R3",accountCount:6,pageCount:16,status:"deprecated",customerSafe:false,currentlyLinked:true,purpose:"Informe interno previo para auditoria historica.",supersededBy:"pilot1-final-report",warning:"OBSOLETO - NO ENVIAR",downloadRoute:"/api/admin/intelligence/pilots/amor-de-gea/pdf",mime:"application/pdf",
}] as const;

export function resolvePilot1Artifact(id:string){return id in AMOR_PILOT1_DELIVERABLES?AMOR_PILOT1_DELIVERABLES[id as Pilot1ArtifactId]:null;}
export function pilot1ArtifactIdForFilename(filename:string):Pilot1ArtifactId|null{
  const found=(Object.entries(AMOR_PILOT1_DELIVERABLES) as [Pilot1ArtifactId,(typeof AMOR_PILOT1_DELIVERABLES)[Pilot1ArtifactId]][]).find(([,artifact])=>artifact.filename===filename);
  return found?.[0]??null;
}

export const AMOR_PILOT1_DELIVERY_STATES={pilot:"founder_review_required" as PilotDeliveryState,feedbackDocument:"ready_for_delivery" as FeedbackDocumentState};
export type Pilot1Portfolio=typeof AMOR_PILOT1_FINAL;
