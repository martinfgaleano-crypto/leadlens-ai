"use client";

import {useState} from "react";
import type {PilotWorkspace} from "@/lib/intelligence/pilot-workspace";
import {adminFetch} from "@/lib/admin/admin-client";
import styles from "./workspace.module.css";

const COMPLETION:Record<string,string>={answered:"Respondida",missing:"Faltante",ambiguous:"Ambigua",not_applicable:"No aplica",clarification_recommended:"Aclaración recomendada"};
const CLASSIFICATION:Record<string,string>={sufficient_to_continue:"Suficiente para continuar",pending_non_blocking:"Pendiente no bloqueante",conditioning:"Condiciona recomendación",route_specific_blocker:"Bloquea solo una ruta",customer_safe_blocker:"Bloquea uso customer-safe"};
const EVIDENCE:Record<string,string>={no_evidence:"Sin evidencia",client_statement:"Declaración del cliente",client_marketing_material:"Material comercial del cliente",client_document_supplied:"Documento declarado/suministrado",independently_verified:"Verificado independientemente"};

export default function PilotContextReview({review}:{review:PilotWorkspace["contextReview"]}) {
  const s=review.summary;
  const [candidateState,setCandidateState]=useState("");
  async function createCandidate(){setCandidateState("Creando candidato versionado…");const response=await adminFetch("/api/admin/intelligence/pilots/amor-de-gea/context-candidate",{method:"POST"});const result=await response.json().catch(()=>({}));setCandidateState(response.ok?`Candidato listo: ${result.intake_id}. Todavía no ha sido aceptado.`:result.error??"No fue posible crear el candidato.");}
  return <div className={styles.contextReview}>
    <div className={styles.previewBanner}>
      <div><span>{review.acceptance_readiness.label}</span><h3>Contexto resuelto con limitaciones explícitas</h3></div>
      <div><p>Las respuestas del cliente, decisiones del fundador e interpretaciones del sistema permanecen separadas. No existe contexto aceptado, recalculo de tesis, cambio de ranking ni promoción customer-safe.</p><button className={styles.acceptanceButton} onClick={createCandidate}>Crear candidato para aceptación</button>{candidateState&&<small role="status">{candidateState}</small>}</div>
    </div>
    <div className={styles.reviewMetrics}>
      <div><strong>{s.answered}</strong><span>respondidas sin reserva mayor</span></div>
      <div><strong>{s.clarification_recommended}</strong><span>requieren aclaración</span></div>
      <div><strong>{s.missing}</strong><span>faltantes</span></div>
      <div><strong>{s.usable_for_preliminary_intelligence}</strong><span>con contenido preliminar</span></div>
      <div><strong>{s.customer_safe_blockers}</strong><span>bloqueo customer-safe</span></div>
    </div>
    <p className={styles.sourceNote}>Fuente privada revisada: cuestionario de 9 páginas con anotaciones iOS FreeText · fingerprint <code>{review.source.fingerprint.slice(0,23)}…</code>. Tres imágenes se clasifican únicamente como material comercial del cliente.</p>

    <div className={styles.reviewAnswerList}>
      {review.answers.map((answer,index)=><details key={answer.question_id} className={styles.reviewAnswer} open={answer.completion!=="answered"}>
        <summary><span>{index+1}</span><strong>{answer.question}</strong><em data-state={answer.completion}>{COMPLETION[answer.completion]}</em></summary>
        <div className={styles.reviewAnswerBody}>
          <div><small>Respuesta original · página {answer.annotation_page??"—"}</small><blockquote>{answer.original_answer||"Sin respuesta en el archivo devuelto."}</blockquote></div>
          <div className={styles.reviewEvidence}>
            <p><strong>Clasificación:</strong> {CLASSIFICATION[answer.operational_classification]}</p>
            <p><strong>Evidencia:</strong> {EVIDENCE[answer.evidence_state]}</p>
            <p><strong>Rutas:</strong> {answer.affected_routes.join(", ")}</p>
            <p><strong>Impacto externo:</strong> {answer.customer_safe_impact}</p>
            {answer.clarification&&<p><strong>Aclaración:</strong> {answer.clarification}</p>}
            {review.founder_resolutions.filter(item=>item.question_id===answer.question_id).map(item=><div className={styles.resolutionBox} key={item.question_id}><small>{item.source.replaceAll("_"," ")}</small><p>{item.resolution}</p><p><strong>Límite:</strong> {item.limitation}</p><em>{item.candidate_action.replaceAll("_"," ")}</em></div>)}
          </div>
        </div>
      </details>)}
    </div>

    <section className={styles.impactPreview}>
      <header><span>PREVIEW — NO APLICADO</span><h3>Impacto probable sobre las seis cuentas</h3><p>Dirección cualitativa para revisión; no es ranking, intención de compra ni timing.</p></header>
      <div>{review.account_preview.map(item=><article key={item.account}>
        <div><h4>{item.account}</h4><em data-direction={item.direction}>{item.direction==="strengthen"?"Fortalece":item.direction==="weaken"?"Debilita":"Incierto"}</em></div>
        <p>{item.reason}</p>
        <small><strong>Contexto:</strong> {item.relevant_context.join(" · ")}</small>
        <small><strong>Dependencia ({item.dependency_scope}):</strong> {item.missing_dependency}</small>
      </article>)}</div>
    </section>

    <div className={styles.contextColumns}>
      <section><h3>Bloqueos globales</h3>{review.acceptance_readiness.global_blockers.length?<ol>{review.acceptance_readiness.global_blockers.map(x=><li key={x}>{x}</li>)}</ol>:<p>Ninguno. Las incógnitas restantes son validaciones posteriores, límites de ruta o límites customer-safe.</p>}</section>
      <section><h3>Puede validarse después</h3><ol>{review.clarification.later.map(x=><li key={x}>{x}</li>)}</ol></section>
    </div>

    <section className={styles.successContract}>
      <span>PILOT SUCCESS CONTRACT</span><h3>{review.success_contract.decision}</h3>
      <p>{review.success_contract.database_difference}</p>
      <div>{review.success_contract.value_dimensions.map(x=><strong key={x}>{x}</strong>)}</div>
      <div>{review.success_contract.founder_objectives.map(x=><strong key={x.id}>{x.label}</strong>)}</div>
      <details className={styles.clientExpectations}><summary>Ver expectativas expresadas por el cliente</summary>{review.success_contract.client_expectation_feedback.dimensions.map(x=><article key={x.id}><h4>{x.label}</h4><p>{x.expectation}</p><small>{x.boundary}</small></article>)}<h4>Preguntas de evaluación</h4><ul>{review.success_contract.client_expectation_feedback.evaluation_questions.map(x=><li key={x}>{x}</li>)}</ul></details>
      <small>No garantiza ventas. Si las primeras recomendaciones no producen resultados, LeadLens revisará acción, selección, buyer path, oferta, objeciones y recalibración antes de entregar más leads.</small>
    </section>
  </div>;
}
