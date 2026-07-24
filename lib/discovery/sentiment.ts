// ─── Event direction / sentiment (sentiment-v1) ──────────────────────────────
// Replaces the blanket "reject any negative news" veto. Direction matters, and
// whether a negative event is an opportunity or a disqualifier DEPENDS on the
// product: distress usually kills B2B fit (no budget), but regulatory pressure
// or an operational incident can CREATE demand for a compliance/monitoring
// product. Deterministic classification; the ICP decides the consequence.

export const SENTIMENT_VERSION = "sentiment-v1";

export type EventDirection =
  | "positive_growth" | "neutral_change" | "risk_event"
  | "distress" | "operational_disruption" | "regulatory_pressure" | "unclear";

export interface DirectionResult {
  direction: EventDirection;
  matched: string | null;
  /** Advance policy given the product: block, monitor, or proceed. */
  policy: "proceed" | "monitor" | "block";
  reason: string;
}

const POSITIVE = /\b(invirti[oó]|invierte|inaugur[oó]|abri[oó]|amplí[oó]|adquiri[oó]|expansi[oó]n|crecimiento|nuevo contrato|adjudic[oó]|moderniz[oó]|implement[oó]|nueva (planta|bodega|sede|ruta|flota))\b/i;
// Bare "liquidación" is common retail language for clearance merchandise. It
// is corporate distress only with an insolvency/legal subject or process.
const DISTRESS = /\b(insolvencia|quiebra|liquidaci[oó]n (?:judicial|obligatoria|de (?:la )?(?:empresa|sociedad|compa[ñn][ií]a))|proceso de liquidaci[oó]n|ley 1116|reorganizaci[oó]n empresarial|cesaci[oó]n de pagos|default|impago|embargo)\b/i;
const RISK = /\b(aplaz[oó] (los )?pagos|mora|deuda|p[eé]rdidas|recorte|despidos|crisis|demanda judicial)\b/i;
const REGULATORY = /\b(nueva regulaci[oó]n|normativa|decreto|resoluci[oó]n \d+|cumplimiento (normativo|regulatorio)|sanci[oó]n|superintendencia orden|exigencia legal)\b/i;
const DISRUPTION = /\b(incidente|falla operativa|accidente|interrupci[oó]n del servicio|ciberataque|colapso operativo|derrame|siniestro)\b/i;

export function classifyDirection(titleAndContent: string, opts: { productSolvesCompliance?: boolean; productSolvesMonitoring?: boolean } = {}): DirectionResult {
  const hay = titleAndContent.toLowerCase();
  const d = hay.match(DISTRESS); if (d) return { direction: "distress", matched: d[0], policy: "block", reason: "Insolvencia/quiebra — sin capacidad de compra; hard blocker." };
  const reg = hay.match(REGULATORY);
  if (reg) return { direction: "regulatory_pressure", matched: reg[0], policy: opts.productSolvesCompliance ? "proceed" : "monitor", reason: opts.productSolvesCompliance ? "Presión regulatoria puede crear demanda del producto de cumplimiento." : "Presión regulatoria — monitorear salvo que el producto resuelva cumplimiento." };
  const dis = hay.match(DISRUPTION);
  if (dis) return { direction: "operational_disruption", matched: dis[0], policy: opts.productSolvesMonitoring ? "proceed" : "monitor", reason: opts.productSolvesMonitoring ? "Incidente operativo puede crear necesidad de monitoreo/visibilidad." : "Disrupción operativa — monitorear." };
  const r = hay.match(RISK); if (r) return { direction: "risk_event", matched: r[0], policy: "monitor", reason: "Señal de riesgo financiero — monitorear, no priorizar." };
  const p = hay.match(POSITIVE); if (p) return { direction: "positive_growth", matched: p[0], policy: "proceed", reason: "Evento positivo de crecimiento/inversión." };
  return { direction: "unclear", matched: null, policy: "monitor", reason: "Dirección poco clara — monitorear." };
}
