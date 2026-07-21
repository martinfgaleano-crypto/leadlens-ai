// ─── Formal counterevidence (counterevidence-v1) ─────────────────────────────
// For each finalist, scan the gathered evidence for reasons the thesis could
// be WRONG: existing provider, internal solution, outsourced operation, event
// finished/cancelled, financial risk, wrong unit. Counterevidence never
// auto-rejects — it adjusts confidence, priority and wording, and surfaces
// unresolved questions the client must validate. Absence of counterevidence is
// NOT certainty: unresolved_questions stay explicit. Deterministic.

export const COUNTEREVIDENCE_VERSION = "counterevidence-v1";

export interface CounterevidenceResult {
  supporting_evidence: string[];
  counterevidence: string[];
  alternative_explanation: string | null;
  unresolved_questions: string[];
  thesis_risk: "low" | "medium" | "high";
  /** Points to subtract from the rubric score (0..25). Never negative. */
  confidence_adjustment: number;
}

const MARKERS: Array<{ re: RegExp; note: string; penalty: number; alt?: string }> = [
  { re: /(ya (cuenta con|utiliza|opera con|implement[oó])|su (actual )?proveedor (de|tecnol[oó]gico)|renov[oó] (el )?contrato con)/i,
    note: "La empresa ya contaría con un proveedor o solución para esta necesidad.", penalty: 12,
    alt: "El evento consolida a un proveedor existente en lugar de abrir una compra nueva." },
  { re: /(desarroll[oó] internamente|soluci[oó]n propia|in.?house|equipo interno de tecnolog[ií]a)/i,
    note: "Indicios de solución interna — la necesidad podría resolverse in-house.", penalty: 10 },
  { re: /(terceriz|outsourc|operador (log[ií]stico )?externo|a cargo de un tercero)/i,
    note: "La operación relevante podría estar tercerizada (el tercero sería la cuenta).", penalty: 15,
    alt: "El cambio operativo lo ejecuta un tercero; la necesidad vive en el operador, no en la empresa." },
  { re: /(finaliz[oó] la implementaci[oó]n|ya implement[oó]|concluy[oó] (el|la) (proyecto|implementaci[oó]n)|entr[oó] en operaci[oó]n desde)/i,
    note: "La implementación podría estar terminada — la ventana comercial estaría cerrada.", penalty: 15 },
  { re: /(cancel[oó]|suspendi[oó]|aplaz[oó]|pospuso|desisti[oó] de)/i,
    note: "El evento podría estar cancelado, suspendido o aplazado.", penalty: 18,
    alt: "El anuncio original fue revertido o aplazado; el hecho puede no estar vigente." },
  { re: /(p[eé]rdidas|mora|deuda|recorte|despidos|crisis financiera|aplaz[oó] pagos)/i,
    note: "Señales de riesgo financiero — capacidad de compra dudosa.", penalty: 12 },
  { re: /(a trav[eé]s de su (filial|subsidiaria|matriz)|su casa matriz)/i,
    note: "La inversión podría corresponder a otra unidad corporativa (validar cuál entidad decide).", penalty: 8,
    alt: "El evento pertenece a la matriz/filial; la cuenta comercial podría ser otra entidad del grupo." },
];

export function assessCounterevidence(input: {
  content: string;                    // lower-cased evidence text
  event_summary: string | null;
  days_old: number | null;
  operational_fit: boolean;
  corroboration: "high" | "medium" | "low" | "insufficient";
}): CounterevidenceResult {
  const hay = input.content.toLowerCase();
  const counter: string[] = [];
  const support: string[] = [];
  let penalty = 0;
  let alt: string | null = null;

  for (const m of MARKERS) {
    if (m.re.test(hay)) { counter.push(m.note); penalty += m.penalty; if (!alt && m.alt) alt = m.alt; }
  }
  if (input.event_summary) support.push(`Evento citado en la fuente: ${input.event_summary.slice(0, 140)}`);
  if (input.operational_fit) support.push("La operación relevante está evidenciada en el contenido.");
  if (input.corroboration === "high") support.push("Corroboración alta (dominio corporativo + fuente independiente).");

  // Timing decay is counterevidence too (stale window), independent of markers.
  if (input.days_old !== null && input.days_old > 120) { counter.push("Señal con más de 120 días — la ventana puede estar cerrándose."); penalty += 6; }

  // Unresolved questions: what was NOT evidenced never becomes certainty.
  const unresolved: string[] = [];
  if (!/presupuesto|inversi[oó]n de|cop|\$|millones/i.test(hay)) unresolved.push("Magnitud/presupuesto del cambio no confirmado en la fuente.");
  if (!input.operational_fit) unresolved.push("Operación propia no evidenciada — validar antes de contactar.");
  if (input.corroboration === "low" || input.corroboration === "insufficient") unresolved.push("Falta segunda fuente independiente o fuente primaria.");
  unresolved.push("Confirmar quién controla la decisión de compra dentro del grupo.");

  const thesis_risk: CounterevidenceResult["thesis_risk"] = penalty >= 15 ? "high" : penalty >= 8 ? "medium" : "low";
  return {
    supporting_evidence: support,
    counterevidence: counter,
    alternative_explanation: alt,
    unresolved_questions: unresolved,
    thesis_risk,
    confidence_adjustment: Math.min(25, penalty),
  };
}

/** Deterministic verdict downgrade from counterevidence (never upgrades). */
export function applyCounterevidence(
  verdict: "prioritaria" | "investigar" | "monitorear" | "rechazar",
  score: number,
  ce: CounterevidenceResult,
): { verdict: "prioritaria" | "investigar" | "monitorear" | "rechazar"; score: number } {
  const adjusted = Math.max(0, score - ce.confidence_adjustment);
  let v = verdict;
  if (ce.thesis_risk === "high" && v === "prioritaria") v = "investigar";
  if (ce.thesis_risk === "high" && v === "investigar" && adjusted < 75) v = "monitorear";
  if (adjusted < 60 && v !== "rechazar") v = "monitorear"; // CE alone never hard-rejects
  return { verdict: v, score: adjusted };
}
