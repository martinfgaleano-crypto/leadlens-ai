import type {PilotWorkspace} from "@/lib/intelligence/pilot-workspace";
import styles from "./workspace.module.css";

const COMPLETION:Record<string,string>={answered:"Respondida",missing:"Faltante",ambiguous:"Ambigua",not_applicable:"No aplica",clarification_recommended:"Aclaración recomendada"};
const CLASSIFICATION:Record<string,string>={sufficient_to_continue:"Suficiente para continuar",pending_non_blocking:"Pendiente no bloqueante",conditioning:"Condiciona recomendación",route_specific_blocker:"Bloquea solo una ruta",customer_safe_blocker:"Bloquea uso customer-safe"};
const EVIDENCE:Record<string,string>={no_evidence:"Sin evidencia",client_statement:"Declaración del cliente",client_marketing_material:"Material comercial del cliente",client_document_supplied:"Documento declarado/suministrado",independently_verified:"Verificado independientemente"};

export default function PilotContextReview({review}:{review:PilotWorkspace["contextReview"]}) {
  const s=review.summary;
  return <div className={styles.contextReview}>
    <div className={styles.previewBanner}>
      <div><span>PREVIEW — NO APLICADO</span><h3>Revisión del contexto real devuelto</h3></div>
      <p>Las respuestas están preservadas para revisión. No existe contexto aceptado, recalculo de tesis, cambio de ranking ni promoción customer-safe.</p>
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
      <section><h3>Aclarar antes de aceptar contexto</h3><ol>{review.clarification.before_acceptance.map(x=><li key={x}>{x}</li>)}</ol></section>
      <section><h3>Puede validarse después</h3><ol>{review.clarification.later.map(x=><li key={x}>{x}</li>)}</ol></section>
    </div>

    <section className={styles.successContract}>
      <span>PILOT SUCCESS CONTRACT</span><h3>{review.success_contract.decision}</h3>
      <p>{review.success_contract.database_difference}</p>
      <div>{review.success_contract.value_dimensions.map(x=><strong key={x}>{x}</strong>)}</div>
      <small>No garantiza ventas. Si las primeras recomendaciones no producen resultados, LeadLens revisará acción, selección, buyer path, oferta, objeciones y recalibración antes de entregar más leads.</small>
    </section>
  </div>;
}
