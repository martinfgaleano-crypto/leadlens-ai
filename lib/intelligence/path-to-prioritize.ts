// ─── Path to Prioritize (path-to-prioritize-v1) ─────────────────────────────
//
// For an account that is NOT currently PRIORITIZE, derive the specific, legitimate
// missing evidence or conditions that would move it over the Prioritize bar — and,
// crucially, whether any realistic path exists at all. This is NOT "how to force an
// account into Prioritize": it enumerates the decision-critical gaps between the
// current, honestly-decided case and the Prioritize bar, drawn only from the case's
// own real signals. If structural fit is the ceiling (or no plausible commercial
// mechanism exists), there is NO realistic path and we say so. Nothing is fabricated.
//
// Generic and deterministic; carries no customer-specific knowledge. Mirrors the
// real Prioritize bar enforced by `caseDecision` (opportunity verdict + verified
// current access/mechanism + no open decision-critical question + no material
// counterevidence), so the conditions it lists are exactly the gaps to that bar.

import type { DecisionState, Strength } from "@/lib/deliverable/deliverable-view-model";

export const PATH_TO_PRIORITIZE_VERSION = "path-to-prioritize-v1";

export interface PathToPrioritizeInput {
  decision: DecisionState;
  fit: Strength | null;
  timing: Strength | null;
  evidence: Strength | null;
  /** Open decision-critical questions (from the canonical case). Each caps at Validate. */
  openDecisionCritical: string[];
  hasMaterialCounter: boolean;
  /** A current, usable commercial mechanism (active buying/onboarding/sourcing route) is verified. */
  commercialMechanismVerified: boolean;
  /** Commercial ACCESS (the route into the buying process) is verified. */
  commercialAccessVerified: boolean;
  /** Evidence is independently corroborated (≥2 distinct origin sources). */
  independentlyCorroborated: boolean;
}

export interface PathToPrioritize {
  /** Whether a realistic, evidence-legitimate path to Prioritize exists. */
  reachable: boolean;
  /** The decision-critical conditions that would flip the decision (customer-facing). Empty when unreachable or already prioritized. */
  conditions: string[];
  /** One-line explanation of the path, or of why none exists. */
  rationale: string;
}

const isModerateOrBetter = (s: Strength | null): boolean => s === "Strong" || s === "Moderate";

/**
 * Derive the Path to Prioritize for a single account. Pure; never fabricates.
 * `reachable: false` is a first-class, honest outcome (structural fit is the
 * ceiling, or no plausible commercial mechanism) — not a failure to compute.
 */
export function derivePathToPrioritize(input: PathToPrioritizeInput, opts: { es?: boolean } = {}): PathToPrioritize {
  const es = opts.es ?? false;
  const L = (esS: string, enS: string) => (es ? esS : enS);

  if (input.decision === "prioritize") {
    return { reachable: true, conditions: [], rationale: L("La cuenta ya está priorizada con la evidencia actual.", "The account is already prioritized on current evidence.") };
  }

  // Structural-fit ceiling: a weak/unknown fit cannot be research-resolved into a
  // Prioritize — that is a property of the account, not a missing data point.
  if (!isModerateOrBetter(input.fit)) {
    return {
      reachable: false,
      conditions: [],
      rationale: L(
        "No hay un camino realista a Priorizar: el encaje estructural con el objetivo del cliente es débil o no está establecido — eso no se resuelve con más investigación.",
        "No realistic path to Prioritize: structural fit with the customer's objective is weak or unestablished — this is not resolvable with more research.",
      ),
    };
  }

  // Enumerate the decision-critical gaps to the Prioritize bar, most-blocking first.
  const conditions: string[] = [];
  if (input.hasMaterialCounter) {
    conditions.push(L("resolver la contraevidencia material antes de priorizar", "resolve the material counterevidence before prioritizing"));
  }
  for (const q of input.openDecisionCritical.slice(0, 2)) {
    conditions.push(L(`confirmar: ${q}`, `confirm: ${q}`));
  }
  if (!input.commercialMechanismVerified) {
    conditions.push(L("verificar un mecanismo comercial actual (una ruta de compra/alta/abastecimiento activa)", "verify a current commercial mechanism (an active buying / onboarding / sourcing route)"));
  }
  if (!input.commercialAccessVerified) {
    conditions.push(L("verificar el acceso comercial (la ruta hacia el proceso de compra)", "verify commercial access (the route into the buying process)"));
  }
  if (input.timing !== "Strong") {
    conditions.push(L("una señal de demanda o abastecimiento actual y fechada (no actividad genérica de la empresa)", "a dated, current demand or sourcing signal (not generic company activity)"));
  }
  if (input.evidence === "Limited" || !input.independentlyCorroborated) {
    conditions.push(L("corroboración independiente (≥2 fuentes de origen distintas)", "independent corroboration (≥2 distinct-origin sources)"));
  }

  // Fit is adequate and at least one decision-critical gap is nameable → reachable.
  if (conditions.length === 0) {
    // Fit adequate, no gaps enumerated, yet not prioritized: a conservative/fallback
    // decision. Name the generic bar rather than invent a specific condition.
    return {
      reachable: true,
      conditions: [L("confirmar una oportunidad comercial actual con evidencia (no solo encaje)", "confirm a current, evidenced commercial opportunity (not fit alone)")],
      rationale: L("El encaje es adecuado; falta evidencia de oportunidad actual para cruzar el umbral.", "Fit is adequate; current-opportunity evidence is what remains to cross the bar."),
    };
  }

  return {
    reachable: true,
    conditions: conditions.slice(0, 4),
    rationale: L(
      "El encaje respalda el interés; estas condiciones decisión-críticas, de confirmarse con evidencia, justificarían priorizar.",
      "Fit supports interest; these decision-critical conditions, if confirmed with evidence, would justify prioritizing.",
    ),
  };
}
