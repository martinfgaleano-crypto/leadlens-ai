"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin/admin-client";
import styles from "./workspace.module.css";

const DECISIONS = [
  ["approved_internal", "Aprobar para uso interno"],
  ["corrected", "Solicitar corrección"],
  ["context_requested", "Solicitar contexto"],
  ["evidence_requested", "Solicitar más evidencia"],
  ["rejected", "Rechazar encaje"],
] as const;

export default function PilotReviewOperations({ pilotId, thesis }: { pilotId: string; thesis: any }) {
  const [decision, setDecision] = useState<(typeof DECISIONS)[number][0]>("context_requested");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  async function submit() {
    setMessage("Guardando revisión…");
    const response = await adminFetch(`/api/admin/intelligence/pilots/${pilotId}/operations`, {
      method: "POST",
      body: JSON.stringify({
        action: "review_thesis",
        thesis_id: thesis.thesis_id,
        decision,
        correction_note: note,
      }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(response.ok
      ? "Revisión registrada. La tesis original permanece intacta y el resultado continúa siendo interno."
      : result.error ?? "No fue posible guardar la revisión.");
  }

  return <div className={styles.reviewForm}>
    <div>
      <label>Decisión de revisión
        <select value={decision} onChange={event => setDecision(event.target.value as typeof decision)}>
          {DECISIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Comentario del revisor
        <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Explica la corrección, supuesto o evidencia requerida." />
      </label>
    </div>
    <aside>
      <strong>Reglas de seguridad</strong>
      <p>Aprobar internamente no convierte la tesis en contenido seguro para cliente. La revisión conserva historia, evidencia y limitaciones.</p>
      <button className={styles.primaryButton} onClick={submit}>Registrar revisión</button>
    </aside>
    {message && <p className={styles.formMessage} role="status">{message}</p>}
  </div>;
}
