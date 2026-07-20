// ─── Event vs metric classification (event-vs-metric-v1) ─────────────────────
// A statistic ("movilizó 17 millones de pasajeros", "creció 20%") is NOT a
// commercial trigger by itself — only a verifiable corporate CHANGE is. This
// separates state/historical/performance metrics from corporate events,
// operational changes and strategic decisions. Only the latter three can seed
// an opportunity; a metric may add context but never triggers one.

export const EVENT_VS_METRIC_VERSION = "event-vs-metric-v1";

export type SignalKind =
  | "corporate_event" | "operational_change" | "strategic_decision"
  | "state_metric" | "historical_metric" | "performance_result" | "none";

// A real corporate change: an action verb tied to a new asset / contract /
// entity / market. These CAN trigger an opportunity.
const CHANGE = /(?:adquiri[oó]|compr[oó] (\d+ )?(veh[ií]culos|camiones|buses|una empresa|activos)|inaugur[oó]|abri[oó] (una|un|su)|construy[oó]|firm[oó] (un|el) contrato|adjudic[oó]|gan[oó] (el|un) contrato|invirti[oó] (US\$?|COP|\$)?\s?[\d.,]+|anunci[oó] (una|la) inversi[oó]n|amplí[oó] su (capacidad|flota) (con|mediante|tras) (nuevos?|la (compra|adquisici[oó]n))|entr[oó] a[l]? (nuevo )?mercado|ingres[oó] a[l]? mercado|implement[oó] (un|una)|moderniz[oó] (su|la)|inici[oó] (su|una) (expansi[oó]n|operaci[oó]n)|asumi[oó] el (100|control)|cambio de control|acquired|purchased \d+|opened a new|awarded (a|the) contract|invested (US\$?|COP)?\s?[\d.,]+|entered the market)/i;

// Bare statistics / results / historical figures. These do NOT trigger.
const METRIC = /(?:moviliz[oó] (m[aá]s de )?[\d.,]+ (millones? de )?(pasajeros|toneladas|usuarios|clientes)|transport[oó] [\d.,]+|factur[oó] (US\$?|COP|\$)?\s?[\d.,]+|alcanz[oó] [\d.,]+ (usuarios|clientes)|tiene (m[aá]s de )?[\d.,]+ (veh[ií]culos|sedes|empleados|puntos)|cerr[oó] el a[ñn]o con|creci[oó] [\d.,]+ ?%|report[oó] (utilidades|ingresos|resultados)|resultados (del|financieros)|movilized|transported [\d.,]+|reported (revenue|earnings|results)|grew [\d.,]+ ?%)/i;

const HISTORICAL = /(?:desde (hace|el a[ñn]o) [\d]{4}|fundada en|con [\d]+ a[ñn]os de|aniversario|hist[oó]ric[ao]|trayectoria|anniversary|founded in|years of history)/i;

export function classifySignalKind(titleAndContent: string): { kind: SignalKind; matched: string | null; can_trigger: boolean } {
  const hay = titleAndContent.toLowerCase();
  // A real change wins even if a metric is quoted alongside it (the metric
  // becomes supporting context, e.g. "abrió una planta que aumenta 20% la capacidad").
  const c = hay.match(CHANGE);
  if (c) {
    // Sub-classify from the full text (the matched fragment alone can be ambiguous).
    const kind: SignalKind = /(?:adquiri[oó]|adquisici[oó]n|compr[oó] una empresa|asumi[oó] el (?:100|control)|cambio de control|fusi[oó]n|acquired|merger)/i.test(hay) ? "strategic_decision"
      : /(?:inaugur[oó]|abri[oó] (?:una|un|su)|construy[oó]|amplí[oó]|moderniz[oó]|implement[oó]|inici[oó]|opened a new|entered the market|entr[oó] a)/i.test(hay) ? "operational_change"
      : "corporate_event";
    return { kind, matched: c[0], can_trigger: true };
  }
  const h = hay.match(HISTORICAL);
  if (h) return { kind: "historical_metric", matched: h[0], can_trigger: false };
  const m = hay.match(METRIC);
  if (m) return { kind: /creci[oó]|factur[oó]|report[oó]|revenue|earnings|grew/i.test(m[0]) ? "performance_result" : "state_metric", matched: m[0], can_trigger: false };
  return { kind: "none", matched: null, can_trigger: false };
}
