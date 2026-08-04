import type {AMOR_PILOT1_FINAL} from "./amor-de-gea-pilot1-finalization";

export type Pilot1ArtifactId="pilot1-final-report"|"pilot1-action-briefs"|"pilot1-feedback-pdf"|"pilot1-feedback-docx";
export type PilotDeliveryState="founder_review_required"|"ready_for_delivery"|"delivered"|"feedback_pending"|"feedback_received"|"closed";
export type FeedbackDocumentState="draft"|"ready_for_delivery"|"delivered"|"partially_completed"|"completed"|"founder_reviewed"|"incorporated";

export const AMOR_PILOT1_DELIVERABLES={
  "pilot1-final-report":{filename:"Amor-de-Gea-LeadLens-Pilot-1-Final-Report.pdf",label:"REPORTE FINAL PARA CLIENTE - 10 CUENTAS",type:"final_customer_report",mime:"application/pdf",version:"1.2",pages:18,size:46537,sha256:"c28f6074e39b23a3d43def720dc073b13510f98b86b3d06b8fad1ab38ce3da11",generatedDate:"2026-08-03",preview:true},
  "pilot1-action-briefs":{filename:"Amor-de-Gea-Account-Action-Briefs-Pilot-1.pdf",label:"Account Action Briefs - 4 cuentas",type:"customer_action_briefs",mime:"application/pdf",version:"1.2",pages:5,size:15502,sha256:"15b5f2eb04fcce7a9d0529ab015b7c8a01f71f65287b55d261dfb2ea3c6aa701",generatedDate:"2026-08-03",preview:true},
  "pilot1-feedback-pdf":{filename:"Amor-de-Gea-LeadLens-Pilot-1-Feedback.pdf",label:"Retroalimentacion - PDF",type:"customer_feedback",mime:"application/pdf",version:"1.2",pages:9,size:16573,sha256:"87a0c266ddcf116b31aac96dffe72775ac0f7478afc987ee3b26a3c921ae9c16",generatedDate:"2026-08-03",preview:true},
  "pilot1-feedback-docx":{filename:"Amor-de-Gea-LeadLens-Pilot-1-Feedback.docx",label:"Retroalimentacion - DOCX editable",type:"customer_feedback",mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",version:"1.2",pages:null,size:41134,sha256:"dae38592a0eee52a00fc7e5e80862c3bf49d97d023c9269279046a7cd88955d5",generatedDate:"2026-08-03",preview:false},
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
