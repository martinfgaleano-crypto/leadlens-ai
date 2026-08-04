"use client";

import {useState} from "react";
import styles from "./workspace.module.css";
import {AMOR_PILOT1_AGENDA,AMOR_PILOT1_EMAIL,AMOR_PILOT1_FINAL,AMOR_PILOT1_FOUNDER_CHECKLIST} from "@/lib/intelligence/amor-de-gea-pilot1-finalization";
import {AMOR_PILOT1_DELIVERABLES,AMOR_PILOT1_DELIVERY_STATES,AMOR_PILOT1_HISTORICAL_ARTIFACTS,type Pilot1ArtifactId,type PilotDeliveryState} from "@/lib/intelligence/amor-de-gea-pilot1-delivery";

const artifactUrl=(id:Pilot1ArtifactId,preview=false)=>`/api/admin/intelligence/pilots/amor-de-gea/artifacts/${id}${preview?"?preview=1":""}`;
const PILOT_STATE_ES:Record<PilotDeliveryState,string>={founder_review_required:"Revision del fundador requerida",ready_for_delivery:"Listo para entregar",delivered:"Entregado",feedback_pending:"Retroalimentacion pendiente",feedback_received:"Retroalimentacion recibida",closed:"Cerrado"};

export default function Pilot1Finalization(){
  const p=AMOR_PILOT1_FINAL;
  const [checks,setChecks]=useState<Record<string,boolean>>({});
  const [pilotState,setPilotState]=useState<PilotDeliveryState>(AMOR_PILOT1_DELIVERY_STATES.pilot);
  const checkedCount=AMOR_PILOT1_FOUNDER_CHECKLIST.filter(item=>checks[item.id]).length;
  const ready=checkedCount===AMOR_PILOT1_FOUNDER_CHECKLIST.length;
  const toggle=(id:string)=>setChecks(current=>({...current,[id]:!current[id]}));
  const assets=Object.entries(AMOR_PILOT1_DELIVERABLES) as [Pilot1ArtifactId,(typeof AMOR_PILOT1_DELIVERABLES)[Pilot1ArtifactId]][];
  return <section className={styles.deliveryCenter} data-testid="pilot1-finalization">
    <header className={styles.deliveryHeader}>
      <div><span>PILOT 1 DELIVERY CENTER</span><h2>Paquete final de Amor de Gea</h2><p>Los cuatro archivos siguientes son los unicos aprobados para entrega. El informe principal corresponde al portafolio final V3R3 de diez cuentas.</p></div>
      <aside><small>Estado del piloto</small><strong>{PILOT_STATE_ES[pilotState]}</strong><span>Documento de feedback: listo para entregar</span></aside>
    </header>

    <div className={styles.deliveryMetrics} aria-label="Resumen del Piloto 1">
      <div><strong>10</strong><span>cuentas activas</span></div><div><strong>4</strong><span>primera validacion</span></div><div><strong>4</strong><span>archivos descargables</span></div><div><strong>0</strong><span>nuevas busquedas</span></div>
    </div>

    <section className={styles.customerPackage}>
      <div className={styles.deliverySectionTitle}><div><span>ENVIAR A AMOR DE GEA</span><h3>Paquete de entrega al cliente</h3></div><strong>4 archivos · customer-safe</strong></div>
      <div className={styles.artifactGrid}>{assets.map(([id,artifact])=><article className={id==="pilot1-final-report"?styles.primaryArtifact:undefined} key={id}>
        <div><span className={styles.safeBadge}>APTO PARA CLIENTE</span>{id==="pilot1-final-report"&&<span className={styles.finalBadge}>CANONICO</span>}</div>
        <h4>{artifact.label}</h4><p>{artifact.filename}</p>
        <dl><div><dt>Version</dt><dd>{artifact.version}</dd></div><div><dt>{artifact.pages?"Paginas":"Tamano"}</dt><dd>{artifact.pages??`${Math.ceil(artifact.size/1024)} KB`}</dd></div><div><dt>Generado</dt><dd>{artifact.generatedDate}</dd></div><div><dt>Revision</dt><dd>Pendiente fundador</dd></div></dl>
        <div className={styles.artifactActions}>{artifact.preview&&<a href={artifactUrl(id,true)} target="_blank" rel="noreferrer">Vista previa</a>}<a className={styles.downloadPrimary} href={artifactUrl(id)} download>Descargar</a></div>
      </article>)}</div>
    </section>

    <section className={styles.founderChecklist}>
      <div className={styles.deliverySectionTitle}><div><span>CONTROL DE ENTREGA</span><h3>Lista de revision del fundador · {checkedCount}/17</h3></div><strong>{ready?"COMPLETA":"ENTREGA BLOQUEADA"}</strong></div>
      <div className={styles.checkGrid}>{AMOR_PILOT1_FOUNDER_CHECKLIST.map(item=><label key={item.id}><input type="checkbox" checked={Boolean(checks[item.id])} onChange={()=>toggle(item.id)}/><span>{item.label}</span></label>)}</div>
      <div className={styles.deliveryActions}><button disabled={!ready||pilotState!=="founder_review_required"} onClick={()=>setPilotState("ready_for_delivery")}>Marcar listo para entregar</button><button disabled={pilotState!=="ready_for_delivery"} onClick={()=>setPilotState("delivered")}>Registrar entrega</button><button disabled={pilotState!=="delivered"&&pilotState!=="feedback_pending"} onClick={()=>setPilotState("feedback_received")}>Registrar retroalimentacion</button></div>
      <small>El estado del documento de feedback puede estar listo mientras el piloto sigue en revision. Ninguna accion envia archivos ni contacta al cliente automaticamente.</small>
    </section>

    <details className={styles.historicalArtifacts}><summary>Historial interno del piloto · NO ENVIAR</summary>{AMOR_PILOT1_HISTORICAL_ARTIFACTS.map(item=><article key={item.artifactId}><div><span>{item.warning}</span><strong>Internal only - do not send to client</strong></div><h4>Informe interno historico de seis cuentas</h4><p>{item.filename}</p><dl><div><dt>Tipo</dt><dd>{item.type}</dd></div><div><dt>Cuentas</dt><dd>{item.accountCount}</dd></div><div><dt>Paginas</dt><dd>{item.pageCount}</dd></div><div><dt>Reemplazado por</dt><dd>{item.supersededBy}</dd></div></dl><p>{item.purpose}</p><a href={item.downloadRoute}>Descargar solo para auditoria interna</a></article>)}</details>

    <details className={styles.deliveryDetails}><summary>Portafolio final y limites</summary>{Object.entries(p.portfolio).filter(([key])=>key!=="excluded").map(([key,value])=><p key={key}><strong>{key.replaceAll("_"," ")}:</strong> {value.join(" · ")}</p>)}<p><strong>No activos:</strong> {p.portfolio.excluded.join(" · ")}</p><p>{p.relationship_disclosure}</p><p>Pilot 2: <strong>{p.pilot2.state}</strong> · cero cuentas · sin autorizacion.</p></details>
    <details className={styles.deliveryDetails}><summary>Correo preparado · no enviado</summary><p><strong>{AMOR_PILOT1_EMAIL.subject}</strong></p><pre>{AMOR_PILOT1_EMAIL.body}</pre></details>
    <details className={styles.deliveryDetails}><summary>Agenda de presentacion · 30-45 min</summary><ol>{AMOR_PILOT1_AGENDA.map(item=><li key={item}>{item}</li>)}</ol></details>
  </section>;
}
