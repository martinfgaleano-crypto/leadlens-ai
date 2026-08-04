import type {AMOR_PILOT1_FINAL} from "./amor-de-gea-pilot1-finalization";

export type Pilot1ArtifactId="pilot1-final-report"|"pilot1-action-briefs"|"pilot1-feedback-pdf"|"pilot1-feedback-docx";
export type PilotDeliveryState="founder_review_required"|"ready_for_delivery"|"delivered"|"feedback_pending"|"feedback_received"|"closed";
export type FeedbackDocumentState="draft"|"ready_for_delivery"|"delivered"|"partially_completed"|"completed"|"founder_reviewed"|"incorporated";

export const AMOR_PILOT1_DELIVERABLES={
  "pilot1-final-report":{filename:"Amor-de-Gea-LeadLens-Pilot-1-Final-Report.pdf",label:"REPORTE FINAL PARA CLIENTE - 10 CUENTAS",type:"final_customer_report",mime:"application/pdf",version:"V3R3 / 2.0",pages:25,size:53956,sha256:"ef9bf81e5867da2c5ac02b0309e2851ed6f61a2b2bdf3c103b6e12eb2f0c47fe",generatedDate:"2026-08-03",preview:true},
  "pilot1-action-briefs":{filename:"Amor-de-Gea-Account-Action-Briefs-Pilot-1.pdf",label:"Account Action Briefs - 4 cuentas",type:"customer_action_briefs",mime:"application/pdf",version:"2.0",pages:9,size:20402,sha256:"8c397f94349355b7b7f03ea897d1fa019add3508bbb3d7d48b708e6080f41ab7",generatedDate:"2026-08-03",preview:true},
  "pilot1-feedback-pdf":{filename:"Amor-de-Gea-LeadLens-Pilot-1-Feedback.pdf",label:"Retroalimentacion - PDF",type:"customer_feedback",mime:"application/pdf",version:"2.0",pages:13,size:15730,sha256:"51998bd0a96417a9deff4f33e08bef4cd049653f52e021816a1b34c3ee530851",generatedDate:"2026-08-03",preview:true},
  "pilot1-feedback-docx":{filename:"Amor-de-Gea-LeadLens-Pilot-1-Feedback.docx",label:"Retroalimentacion - DOCX editable",type:"customer_feedback",mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",version:"2.0",pages:null,size:39698,sha256:"925c4f5e0fef62aa20a4f11d9e5489c9b2b7c9ed64cb350c68225fd767ebf70f",generatedDate:"2026-08-03",preview:false},
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
