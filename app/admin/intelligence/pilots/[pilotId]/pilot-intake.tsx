"use client";

import { useMemo, useState } from "react";
import { adminFetch } from "@/lib/admin/admin-client";
import styles from "./workspace.module.css";

type Answer = {
  value: string;
  status: "unanswered" | "answered" | "unknown" | "not_applicable" | "conflicting";
  source: "client_direct" | "client_document" | "admin_entry" | "inferred";
  note: string;
  evidence_url: string;
};

const QUESTION_ES: Record<string, string> = {
  account_size_constraints: "¿Qué tamaño de cuenta o rango de pedido resulta comercialmente viable hoy?",
  certifications: "¿Qué registros, certificaciones y documentos de cumplimiento pueden demostrarse?",
  delivery_radius: "¿Qué ciudades, departamentos o zonas nacionales pueden atenderse de forma confiable?",
  distribution_capability: "¿Con qué cobertura y métodos de entrega puede Amor de Gea cumplir pedidos B2B?",
  fulfillment_constraints: "¿Qué restricciones de inventario, despacho o transporte aplican a pedidos B2B?",
  margins: "¿Qué margen bruto o margen para distribuidor debe cumplir una oportunidad?",
  minimum_order: "¿Cuál es el pedido mínimo, en unidades o valor, para una cuenta B2B?",
  price_positioning: "¿Cuál es el rango mayorista verificable y el posicionamiento de precio?",
  product_formats: "¿Qué formatos y presentaciones están disponibles actualmente para venta B2B?",
  production_capacity: "¿Qué volumen mensual máximo puede abastecerse de forma confiable a una cuenta?",
  business_model: "¿Qué modelo de negocio B2B soporta Amor de Gea actualmente?",
  current_partnerships: "¿Qué distribuidores, aliados o referencias B2B actuales pueden facilitar el acceso?",
  customization_capacity: "¿Qué personalización de producto o empaque está disponible hoy?",
  preferred_deal_type: "¿Qué modalidad se prefiere: mayorista directo, distribuidor, piloto, gifting o alianza?",
  sales_cycle_tolerance: "¿Qué duración de ciclo comercial es aceptable antes de descartar una cuenta?",
  white_label_capacity: "¿La producción de marca blanca está disponible, condicionada o no disponible?",
  company_stage: "¿Qué etapa describe mejor a Amor de Gea hoy?",
};

const CATEGORY_ES: Record<string, string> = {
  offer: "Oferta B2B",
  operational: "Capacidad y operación",
  economic: "Precios y mínimos",
  compliance: "Cumplimiento y certificaciones",
  commercial: "Estrategia comercial",
  strategic: "Estrategia y etapa",
};

const TOP_FIELDS = ["product_formats", "minimum_order", "price_positioning", "delivery_radius", "production_capacity"];

function blankAnswer(): Answer {
  return { value: "", status: "unanswered", source: "admin_entry", note: "", evidence_url: "" };
}

function QuestionEditor({
  question,
  answer,
  selected,
  onChange,
  onSelect,
}: {
  question: any;
  answer: Answer;
  selected: boolean;
  onChange: (answer: Answer) => void;
  onSelect: (selected: boolean) => void;
}) {
  return <article className={styles.question}>
    <div className={styles.questionLead}>
      <span>{CATEGORY_ES[question.category] ?? question.category}</span>
      <h4>{QUESTION_ES[question.field] ?? question.text}</h4>
      <p>Desbloquea {question.affected_accounts.length} cuentas y puede modificar {question.affected_theses.length} tesis.</p>
    </div>
    <div className={styles.answerGrid}>
      <label>Estado
        <select value={answer.status} onChange={event => onChange({ ...answer, status: event.target.value as Answer["status"] })}>
          <option value="unanswered">Necesita confirmación</option>
          <option value="answered">Respondido</option>
          <option value="unknown">Desconocido</option>
          <option value="not_applicable">No aplica</option>
          <option value="conflicting">Información en conflicto</option>
        </select>
      </label>
      <label>Respuesta
        <textarea
          value={answer.value}
          placeholder={question.answer_format === "range" ? "Indica un rango verificable" : "Escribe una respuesta concreta"}
          onChange={event => onChange({ ...answer, value: event.target.value })}
        />
      </label>
      <label>Origen
        <select value={answer.source} onChange={event => onChange({ ...answer, source: event.target.value as Answer["source"] })}>
          <option value="client_direct">Confirmado por el cliente</option>
          <option value="client_document">Respaldado por documento</option>
          <option value="admin_entry">Registrado por Admin</option>
          <option value="inferred">Propuesto por LeadLens</option>
        </select>
      </label>
      <label>Enlace de evidencia
        <input value={answer.evidence_url} placeholder="https://…" onChange={event => onChange({ ...answer, evidence_url: event.target.value })} />
      </label>
      <label className={styles.fullField}>Nota de origen
        <input value={answer.note} placeholder="Quién lo confirmó y bajo qué contexto" onChange={event => onChange({ ...answer, note: event.target.value })} />
      </label>
      {answer.status !== "unanswered" && <label className={styles.reviewSelect}>
        <input type="checkbox" checked={selected} onChange={event => onSelect(event.target.checked)} />
        Seleccionar para revisión cuando el intake sea enviado
      </label>}
    </div>
  </article>;
}

export default function PilotIntake({ pilotId, questions }: { pilotId: string; questions: any[] }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [intakeId, setIntakeId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const top = useMemo(() => TOP_FIELDS.map(field => questions.find(question => question.field === field)).filter(Boolean), [questions]);
  const remaining = useMemo(() => questions.filter(question => !TOP_FIELDS.includes(question.field)), [questions]);
  const answered = Object.values(answers).filter(answer => answer.status !== "unanswered").length;

  function update(questionId: string, answer: Answer) {
    setAnswers(current => ({ ...current, [questionId]: answer }));
  }

  async function save(status: "draft" | "submitted") {
    setMessage(status === "draft" ? "Guardando borrador…" : "Enviando para revisión…");
    const response = await adminFetch(`/api/admin/intelligence/pilots/${pilotId}/intake`, {
      method: "POST",
      body: JSON.stringify({
        status,
        answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, ...answer })),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(result.error ?? "No fue posible guardar.");
    setIntakeId(status === "submitted" ? result.intake_id : null);
    setMessage(status === "draft" ? "Borrador guardado. Ningún dato fue activado." : "Intake enviado. Requiere revisión humana antes de activar contexto.");
  }

  async function acceptSelected() {
    if (!intakeId || selected.length === 0) return;
    setMessage("Creando versión de contexto revisada…");
    const response = await adminFetch(`/api/admin/intelligence/pilots/${pilotId}/operations`, {
      method: "POST",
      body: JSON.stringify({
        action: "accept_context",
        intake_id: intakeId,
        accepted_question_ids: selected,
        rejected_question_ids: [],
      }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok
      ? `Contexto aceptado parcialmente. Versión ${result.version_number}; ${result.deterministic_recalculation?.affected_thesis_ids?.length ?? 0} tesis afectadas.`
      : result.error ?? "No fue posible aceptar el contexto.");
  }

  return <div>
    <div className={styles.readinessIntro}>
      <div><strong>{answered}/17</strong><span>respuestas registradas</span></div>
      <p>Estas confirmaciones convierten hipótesis estructurales en evaluaciones comerciales. Guardar no activa nada; toda aceptación requiere revisión.</p>
    </div>
    <h3 className={styles.subheading}>Las 5 respuestas que más cambiarían el análisis</h3>
    <div className={styles.questionStack}>
      {top.map(question => <QuestionEditor
        key={question.question_id}
        question={question}
        answer={answers[question.question_id] ?? blankAnswer()}
        selected={selected.includes(question.question_id)}
        onChange={answer => update(question.question_id, answer)}
        onSelect={checked => setSelected(current => checked ? Array.from(new Set([...current, question.question_id])) : current.filter(id => id !== question.question_id))}
      />)}
    </div>
    <details className={styles.remainingQuestions}>
      <summary>Ver las 12 preguntas restantes</summary>
      <div className={styles.questionStack}>
        {remaining.map(question => <QuestionEditor
          key={question.question_id}
          question={question}
          answer={answers[question.question_id] ?? blankAnswer()}
          selected={selected.includes(question.question_id)}
          onChange={answer => update(question.question_id, answer)}
          onSelect={checked => setSelected(current => checked ? Array.from(new Set([...current, question.question_id])) : current.filter(id => id !== question.question_id))}
        />)}
      </div>
    </details>
    <div className={styles.formActions}>
      <button className={styles.secondaryButton} onClick={() => save("draft")}>Guardar borrador</button>
      <button className={styles.primaryButton} onClick={() => save("submitted")}>Enviar para revisión</button>
      <button className={styles.ghostButton} onClick={() => { setAnswers({}); setSelected([]); setIntakeId(null); setMessage("Borrador local limpiado."); }}>Limpiar cambios locales</button>
      {intakeId && selected.length > 0 && <button className={styles.primaryButton} onClick={acceptSelected}>Aceptar {selected.length} respuestas seleccionadas</button>}
    </div>
    {message && <p className={styles.formMessage} role="status">{message}</p>}
  </div>;
}
