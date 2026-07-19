// ─── Opportunity quality rubric + adversarial review (quality-rubric-v1) ──────
// A deterministic 0-100 rubric that a serious B2B seller's judgment approximates,
// PLUS an adversarial pass that is separate from thesis generation (the same
// step that argues FOR an opportunity must not be its only approver). Hard
// blockers always reject regardless of score.

import type { Materiality } from "./materiality";
import type { OppStatus } from "./opportunity-test";

export const QUALITY_RUBRIC_VERSION = "quality-rubric-v1";

export interface RubricInput {
  corporate_identity_confidence: number;   // 0-100
  fit_from_universe: boolean;               // came from verified universe
  materiality: Materiality;
  signal_association_ok: boolean;           // signal attributed to the right company
  corroboration: "high" | "medium" | "low" | "insufficient";
  causal_thesis_specific: boolean;          // needs-family event → concrete need
  days_old: number | null;
  has_next_step: boolean;
  hard_blockers: string[];                  // from Opportunity Test
}

export interface RubricResult {
  score: number;                            // 0-100
  breakdown: Record<string, number>;
  verdict: "prioritaria" | "investigar" | "monitorear" | "rechazar";
  adversarial_flags: string[];
}

export function scoreOpportunity(i: RubricInput): RubricResult {
  const b: Record<string, number> = {};
  b.identidad = Math.round((Math.min(100, i.corporate_identity_confidence) / 100) * 15);
  b.fit = i.fit_from_universe ? 15 : 6;
  b.materialidad = i.materiality === "high" ? 15 : i.materiality === "medium" ? 9 : 2;
  b.asociacion = i.signal_association_ok ? 15 : 0;
  b.evidencia = i.corroboration === "high" ? 15 : i.corroboration === "medium" ? 11 : i.corroboration === "low" ? 6 : 1;
  b.causalidad = i.causal_thesis_specific ? 15 : 4;
  b.timing = i.days_old === null ? 0 : i.days_old <= 60 ? 5 : i.days_old <= 90 ? 3 : 1;
  b.accionabilidad = i.has_next_step ? 5 : 1;
  const score = Object.values(b).reduce((s, v) => s + v, 0);

  // Adversarial checks — reasons a serious seller would push back.
  const adv: string[] = [];
  if (i.corporate_identity_confidence < 60) adv.push("Identidad corporativa poco confirmada — riesgo de homónimo.");
  if (!i.signal_association_ok) adv.push("La señal podría no pertenecer a esta empresa.");
  if (i.materiality === "low") adv.push("Evento de baja materialidad — probablemente no cambia una decisión de compra.");
  if (i.corroboration === "insufficient") adv.push("Corroboración insuficiente para una sola fuente.");
  if (!i.causal_thesis_specific) adv.push("La tesis no deriva una necesidad concreta del evento.");
  if (i.days_old !== null && i.days_old > 90) adv.push("Señal envejecida — la ventana puede haberse cerrado.");

  // Hard blockers always reject.
  let verdict: RubricResult["verdict"];
  if (i.hard_blockers.length > 0 || !i.signal_association_ok || i.materiality === "low") verdict = "rechazar";
  else if (score >= 85 && i.materiality === "high") verdict = "prioritaria";
  else if (score >= 75 || (score >= 85 && i.materiality === "medium")) verdict = "investigar";
  else if (score >= 60) verdict = "monitorear";
  else verdict = "rechazar";

  return { score, breakdown: b, verdict, adversarial_flags: adv };
}

/** Corroboration tier from independent, non-syndicated corroborating sources. */
export function corroborationTier(independentSources: number, hasPrimary: boolean, identityConfidence: number): RubricInput["corroboration"] {
  if (hasPrimary && independentSources >= 1) return "high";
  if (independentSources >= 1 && identityConfidence >= 60) return "medium";
  if (independentSources >= 1 || identityConfidence >= 60) return "low";
  return "insufficient";
}
