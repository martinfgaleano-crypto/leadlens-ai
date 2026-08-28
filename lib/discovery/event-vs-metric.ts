// ─── Event vs metric classification (event-vs-metric-v1) ─────────────────────
// A statistic ("movilizó 17 millones de pasajeros", "creció 20%") is NOT a
// commercial trigger by itself — only a verifiable corporate CHANGE is. This
// separates state/historical/performance metrics from corporate events,
// operational changes and strategic decisions. Only the latter three can seed
// an opportunity; a metric may add context but never triggers one.

export const EVENT_VS_METRIC_VERSION = "event-vs-metric-v1";

export type SignalKind =
  | "corporate_event" | "operational_change" | "strategic_decision"
  | "state_metric" | "historical_metric" | "performance_result"
  | "marketing_claim" | "editorial_content" | "reference_information" | "none";

// A real corporate change: an action verb tied to a new asset / contract /
// entity / market. These CAN trigger an opportunity.
const CHANGE = /(?:adquiri[oó]|compr[oó] (\d+ )?(veh[ií]culos|camiones|buses|una empresa|activos)|inaugur[oó]|abri[oó] (una|un|su)|abre (una )?nueva|abrir(?:[aá]|) \d+ (?:nuevas? )?(?:tiendas?|sedes?)|apertura de (una|un) nuev[ao]|construy[oó]|firm[oó] (un|el) contrato|adjudic[oó]|gan[oó] (el|un) contrato|invirti[oó] (US\$?|COP|\$)?\s?[\d.,]+|anunci[oó] (una|la) inversi[oó]n|amplí[oó] su (capacidad|flota|surtido)|incorpor[oó] (una )?nueva categor[ií]a|lanz[oó] (un|una) (programa|l[ií]nea) de bienestar|entr[oó] a[l]? (nuevo )?mercado|ingres[oó] a[l]? mercado|implement[oó] (un|una)|moderniz[oó] (su|la)|inici[oó] (su|una) (expansi[oó]n|operaci[oó]n)|asumi[oó] el (100|control)|cambio de control|acquired|purchased \d+|opened a new|awarded (a|the) contract|invested (US\$?|COP)?\s?[\d.,]+|entered the market|inaugurat(?:ed|es)|open(?:ed|s) (?:a |its |the )?(?:(?:new|largest|major|additional) )?(?:plant|facility|factory|warehouse|distribution cent(?:er|re)|manufacturing (?:plant|facility))|beg(?:an|un) (?:its )?(?:production|operations|manufacturing)|start(?:ed) (?:its )?(?:production|operations)|commenc(?:ed) (?:production|operations)|launch(?:ed) (?:its )?operations|commission(?:ed) (?:a |its |the )?(?:new )?(?:plant|facility|line)|expand(?:ed) (?:its )?(?:capacity|footprint|production|operations)|(?:is|are) expanding (?:its |their )?(?:capacity|footprint|production|(?:[a-z-]+ ){0,2}operations)\s+(?:with|through) (?:a |an |the )?(?:new |additional )?(?:plant|facility|factory|warehouse|distribution cent(?:er|re)|manufacturing facility|production line)|expand(?:ed) into|entered (?:a )?(?:new )?market|established (?:a )?(?:new )?(?:presence|operations)|merged with|took over|appointed (?:a )?(?:new )?distributor|named (?:a )?(?:new )?distributor|sign(?:ed) (?:a )?distribution agreement|enter(?:ed) (?:a |into a )?strategic (?:alliance|partnership)|postponed|delayed (?:its |the )?(?:project|facility|plant|expansion|opening)|suspended|halted|shut down|closed (?:its|the) (?:plant|facility|operation|division)|divested|exited (?:the )?market|withdrew from|discontinued|cancell?ed)/i;
const CHANGE_DESCRIPTIVE_OPEN = /\bopen(?:ed|s|ing)? (?:a |its |the )?(?:[a-z-]+ ){0,6}(?:plant|facility|factory|warehouse|distribution cent(?:er|re)|manufacturing (?:plant|facility)|production (?:plant|facility))\b/i;
const CONCRETE_FACILITY_COMMITMENT = /\b(?:breaks?|broke) ground on (?:a |an |the )?(?:major |new |largest )?(?:expansion|plant|facility|factory|warehouse|distribution cent(?:er|re))\b|\bannounced plans to open\b[\s\S]{0,180}?\b(?:new |state-of-the-art |cutting-edge )?(?:facilit(?:y|ies)|plants?|factories|warehouses|distribution cent(?:er|re)s?)\b/i;
// A dated, official capital commitment is itself a strategic decision even
// when construction/capacity comes later. Generic hopes or unquantified plans
// remain non-triggering forecasts.
const COMMITTED_EXPANSION = /(?:\b(?:approximately |about |more than )?(?:us\$|\$)\s?[\d.,]+\s*(?:million|billion|m|bn)?\s+investment\s+will\s+(?:add|create|expand|increase)|\bwill invest\s+(?:approximately |about |more than )?(?:us\$|\$)\s?[\d.,]+|\bexpand(?:s|ing)\b[^.]{0,140}\bwith\s+(?:an? )?(?:us\$|\$)\s?[\d.,]+\s*(?:million|billion|m|bn)?\s+investment|\bannounced plans to expand\b[\s\S]{0,320}?\binvestment of (?:approximately |about |more than )?(?:us\$|\$)\s?[\d.,]+\s*(?:million|billion|m|bn)?)/i;

// Bare statistics / results / historical figures. These do NOT trigger.
const METRIC = /(?:moviliz[oó] (m[aá]s de )?[\d.,]+ (millones? de )?(pasajeros|toneladas|usuarios|clientes)|transport[oó] [\d.,]+|factur[oó] (US\$?|COP|\$)?\s?[\d.,]+|alcanz[oó] [\d.,]+ (usuarios|clientes)|tiene (m[aá]s de )?[\d.,]+ (veh[ií]culos|sedes|empleados|puntos)|cerr[oó] el a[ñn]o con|creci[oó] [\d.,]+ ?%|report[oó] (utilidades|ingresos|resultados)|resultados (del|financieros)|movilized|transported [\d.,]+|reported (revenue|earnings|results)|grew [\d.,]+ ?%)/i;

const HISTORICAL = /(?:desde (hace|el a[ñn]o) [\d]{4}|fundada en|con [\d]+ a[ñn]os de|aniversario|hist[oó]ric[ao]|trayectoria|anniversary|founded in|years of history)/i;

// Awards, recognition, sponsorships, event participation → promotional, never a trigger.
const MARKETING = /(?:recibi[oó] (un |el )?(reconocimiento|premio|galard[oó]n|certificaci[oó]n)|fue (reconocid|premiad|galardonad|distinguid)|gan[oó] (el |un )?premio|particip[oó] en (la |el )?(feria|congreso|evento|foro)|patrocin[oó]|se enorgullece|l[ií]der en (el mercado|su sector)|mejor empresa|ranking de las mejores|received (an )?award|recognized as|sponsored)/i;
// Opinion / analysis / editorial framing (not a corporate action by the company).
const EDITORIAL = /(?:seg[uú]n (?:expertos|analistas)|opini[oó]n|editorial|an[aá]lisis del sector|columna|tendencias (?:del|de la)|c[oó]mo (?:lograr|mejorar)|gu[ií]a (?:para|de)|\d+ (?:claves|consejos|tips|razones)|entrevista con|analysis|opinion piece)/i;
// Reference / directory / static descriptive pages (no dated event).
const REFERENCE = /(?:perfil de la empresa|acerca de nosotros|qui[eé]nes somos|informaci[oó]n corporativa|directorio empresarial|ficha t[eé]cnica|p[aá]gina oficial de|company profile|about us|corporate information)/i;
const GENERATED_REFERENCE = /(?:summarizes recurring themes.*(?:llm|ai)|responses generated by popular llms|insights are generated using ai|not been reviewed or approved by|may not reflect internal data or verified company information)/i;

export function classifySignalKind(titleAndContent: string): { kind: SignalKind; matched: string | null; can_trigger: boolean } {
  const hay = titleAndContent.toLowerCase();
  // Explicitly unverified AI/profile summaries are reference material even if
  // they repeat words such as "expansion". A copied event phrase cannot turn
  // the summary into primary Evidence or Timing (Pratt/Built In acceptance FP).
  const generated = hay.match(GENERATED_REFERENCE);
  if (generated) return { kind: "reference_information", matched: generated[0], can_trigger: false };
  // A real change wins even if a metric is quoted alongside it (the metric
  // becomes supporting context, e.g. "abrió una planta que aumenta 20% la capacidad").
  const committed = hay.match(COMMITTED_EXPANSION);
  const facilityCommitment = hay.match(CONCRETE_FACILITY_COMMITMENT);
  const c = hay.match(CHANGE) ?? hay.match(CHANGE_DESCRIPTIVE_OPEN) ?? committed ?? facilityCommitment;
  if (c) {
    // Sub-classify from the full text (the matched fragment alone can be ambiguous).
    const kind: SignalKind = committed || facilityCommitment || /(?:adquiri[oó]|adquisici[oó]n|compr[oó] una empresa|asumi[oó] el (?:100|control)|cambio de control|fusi[oó]n|acquired|merger)/i.test(hay) ? "strategic_decision"
      : /(?:inaugur[oó]|abri[oó] (?:una|un|su)|construy[oó]|amplí[oó]|moderniz[oó]|implement[oó]|inici[oó]|opened a new|entered the market|entr[oó] a)/i.test(hay) ? "operational_change"
      : "corporate_event";
    return { kind, matched: c[0], can_trigger: true };
  }
  const h = hay.match(HISTORICAL);
  if (h) return { kind: "historical_metric", matched: h[0], can_trigger: false };
  const m = hay.match(METRIC);
  if (m) return { kind: /creci[oó]|factur[oó]|report[oó]|revenue|earnings|grew/i.test(m[0]) ? "performance_result" : "state_metric", matched: m[0], can_trigger: false };
  const mk = hay.match(MARKETING);
  if (mk) return { kind: "marketing_claim", matched: mk[0], can_trigger: false };
  const ed = hay.match(EDITORIAL);
  if (ed) return { kind: "editorial_content", matched: ed[0], can_trigger: false };
  const rf = hay.match(REFERENCE);
  if (rf) return { kind: "reference_information", matched: rf[0], can_trigger: false };
  return { kind: "none", matched: null, can_trigger: false };
}
