// ─── Independent adversarial review (adversarial-review-v1) ──────────────────
// A second reviewer, separate from the pipeline that argued FOR the
// opportunity, that tries to REJECT it. It re-checks each dimension from the
// assembled record (not from the generator's intermediate state) and issues
// confirm / downgrade / monitor / reject. Disagreements with the generator's
// verdict are recorded — a single pass must never generate and approve itself.

import type { CounterevidenceResult } from "./counterevidence";

export const ADVERSARIAL_REVIEW_VERSION = "adversarial-review-v1";

export interface AdversarialInput {
  company: string;
  identity_confidence: number;        // 0-100
  domain: string | null;
  organization_eligible: boolean;
  entity_role_is_account: boolean;
  signal_association_ok: boolean;
  materiality: "high" | "medium" | "low" | "insufficient_information";
  operational_fit: boolean;
  commercial_fit_score: number;       // 0-100
  causal_thesis_specific: boolean;
  corroboration: "high" | "medium" | "low" | "insufficient";
  days_old: number | null;
  has_next_step: boolean;
  counterevidence: CounterevidenceResult | null;
  generator_verdict: "prioritaria" | "investigar" | "monitorear" | "rechazar";
}

export interface AdversarialResult {
  verdict: "confirm" | "downgrade" | "monitor" | "reject";
  objections: string[];               // every question the reviewer failed
  disagrees_with_generator: boolean;
  reason: string;
}

export function adversarialReview(i: AdversarialInput): AdversarialResult {
  const fatal: string[] = [];   // any of these → reject
  const serious: string[] = []; // 2+ → downgrade; with weak evidence → monitor

  // 1-4: identity, domain, organization, association.
  if (i.identity_confidence < 60) fatal.push("Identidad corporativa no confirmada (posible homónimo).");
  if (!i.domain) serious.push("Sin dominio corporativo resuelto.");
  if (!i.organization_eligible) fatal.push("La organización no es una cuenta comercial válida.");
  if (!i.entity_role_is_account) fatal.push("La empresa no es el sujeto del evento (mención incidental o rol equivocado).");
  if (!i.signal_association_ok) fatal.push("La señal no está asociada de forma verificable a esta empresa.");
  // 5-7: event, materiality, fit.
  if (i.materiality === "low" || i.materiality === "insufficient_information") fatal.push("Evento sin materialidad suficiente.");
  if (!i.operational_fit) fatal.push("Sin fit operacional evidenciado.");
  if (i.commercial_fit_score < 50) serious.push(`Fit comercial débil (${i.commercial_fit_score}/100).`);
  // 8-10: causality, evidence, counterevidence.
  if (!i.causal_thesis_specific) serious.push("Tesis no específica — falla la prueba de sustitución.");
  if (i.corroboration === "insufficient") fatal.push("Evidencia insuficiente (una sola fuente no independiente).");
  if (i.corroboration === "low") serious.push("Corroboración débil — exigir segunda fuente antes de priorizar.");
  if (i.counterevidence && i.counterevidence.thesis_risk === "high") serious.push("Counterevidence de alto riesgo sin resolver.");
  // 11-12: timing, action.
  if (i.days_old !== null && i.days_old > 150) serious.push("Timing al límite — la ventana comercial puede estar cerrada.");
  if (!i.has_next_step) serious.push("Sin siguiente paso accionable.");

  let verdict: AdversarialResult["verdict"];
  if (fatal.length > 0) verdict = "reject";
  else if (serious.length >= 3) verdict = "monitor";
  else if (serious.length >= 1) verdict = "downgrade";
  else verdict = "confirm";

  const genAdvance = i.generator_verdict === "prioritaria" || i.generator_verdict === "investigar";
  const revAdvance = verdict === "confirm" || verdict === "downgrade";
  const disagrees = genAdvance !== revAdvance;

  return {
    verdict,
    objections: [...fatal, ...serious],
    disagrees_with_generator: disagrees,
    reason: fatal.length ? `Rechazo adversarial: ${fatal[0]}`
      : serious.length ? `Observaciones (${serious.length}): ${serious.join(" ")}`
      : "Sin objeciones — un vendedor serio investigaría esta cuenta.",
  };
}
