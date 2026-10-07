// ─── Delivery terminal state (delivery-terminal-state-v1) ────────────────────
//
// A minimal, generalizable, customer-safe description of HOW a delivery turned out,
// so that a legitimately small or zero-actionable result reads as an honest research
// conclusion rather than a broken product. Pure/deterministic. It does NOT invent
// refund/commercial policy and does NOT force any decision — it only describes, in
// customer language, the selected population against tier capacity and the decision
// distribution, and distinguishes a VALUABLE ABSTENTION (research ran, nothing cleared
// the bar) from RESEARCH THIN (too little evidence to decide).

export const DELIVERY_TERMINAL_STATE_VERSION = "delivery-terminal-state-v1";

export type TerminalKind = "full" | "underfilled" | "no_actionable" | "no_actionable_underfilled";
export type AbstentionKind = "valuable_abstention" | "research_thin" | null;

export interface TerminalStateInput {
  selected: number;
  capacity: number | null;        // tier account capacity (null = uncapped)
  counts: { prioritize: number; validate: number; monitor: number; hold: number };
  /** Evidence coverage of the selected set (for abstention-vs-thin). */
  sourcedCount: number;
  evidenceDenominator: number;
}

export interface TerminalState {
  kind: TerminalKind;
  underfilled: boolean;
  noActionable: boolean;
  abstention: AbstentionKind;
  /** One short customer-facing paragraph, or "" when the delivery is full + actionable. */
  note: string;
}

/** Pure terminal-state descriptor. `es` localizes the customer note. */
export function deriveTerminalState(input: TerminalStateInput, opts: { es?: boolean } = {}): TerminalState {
  const es = opts.es ?? false;
  const L = (esS: string, enS: string) => (es ? esS : enS);
  const { selected, capacity, counts } = input;

  const underfilled = capacity != null && selected > 0 && selected < capacity;
  const noActionable = selected > 0 && counts.prioritize === 0;
  const coverage = input.evidenceDenominator > 0 ? input.sourcedCount / input.evidenceDenominator : 0;
  // Abstention is "valuable" when research actually reached most selected accounts;
  // "thin" when evidence coverage is too sparse to call it a market conclusion.
  const abstention: AbstentionKind = noActionable ? (coverage >= 0.5 ? "valuable_abstention" : "research_thin") : null;

  const kind: TerminalKind = noActionable && underfilled ? "no_actionable_underfilled"
    : noActionable ? "no_actionable"
    : underfilled ? "underfilled"
    : "full";

  const parts: string[] = [];
  if (underfilled) {
    parts.push(L(
      `Se evaluaron y calificaron ${selected} cuenta${selected === 1 ? "" : "s"} de las hasta ${capacity} que admite este producto; no se rellenó el resto con cuentas sin evidencia suficiente.`,
      `${selected} account${selected === 1 ? "" : "s"} were evaluated and qualified of the up-to-${capacity} this product allows; the remainder was not padded with accounts lacking sufficient evidence.`,
    ));
  }
  if (noActionable) {
    parts.push(abstention === "valuable_abstention"
      ? L(
          "Ninguna cuenta alcanzó el umbral de priorización con la evidencia pública disponible. Esto es una conclusión de investigación, no una falla: las cuentas más fuertes están marcadas para validar, y cada una indica qué evidencia cambiaría la decisión.",
          "No account reached the prioritize bar on the available public evidence. This is a research conclusion, not a failure: the strongest accounts are marked to validate, and each states what evidence would change the decision.",
        )
      : L(
          "La evidencia pública disponible fue insuficiente para calificar una oportunidad accionable con confianza. Las cuentas se presentan con sus incógnitas abiertas y lo que habría que confirmar.",
          "The available public evidence was insufficient to confidently qualify an actionable opportunity. Accounts are presented with their open unknowns and what would need to be confirmed.",
        ));
  }
  return { kind, underfilled, noActionable, abstention, note: parts.join(" ") };
}
