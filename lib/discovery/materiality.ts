// ─── Event materiality (materiality-v1) ──────────────────────────────────────
// Not every recent, true signal is a commercial opportunity. Classifies the
// event by how much it actually changes the company's operations — the thing a
// serious B2B seller cares about. Deterministic keyword rules over the
// title/content; only high/medium advances, and medium demands stronger fit +
// corroboration downstream.

export const MATERIALITY_VERSION = "materiality-v1";
export type Materiality = "high" | "medium" | "low";

const HIGH = /\b(nueva planta|nueva f[aá]brica|nueva bodega|nueva tienda|abre (una )?nueva|abrir[aá] \d+ nuevas?|apertura de (una|un) nuev[ao]|nuevo centro de distribuci[oó]n|centro log[ií]stico|inaugur[oó]|inaugurat|expansi[oó]n regional|adquiri[oó]|adquisici[oó]n|compr[oó] (a|la|el)|nuevo contrato|adjudic[oó]|gan[oó] (el|un|la) (contrato|licitaci[oó]n)|amplí[oa] (su )?(capacidad|surtido)|nueva categor[ií]a|programa de bienestar|nueva operaci[oó]n|entra (a|al) (mercado|pa[ií]s)|ingres[oó] (a|al)|incorpor[oó] (\d+ )?veh[ií]culos|ampl[ií][oó] (su )?flota|crecimiento de (su )?flota|nueva flota|invierte|inversi[oó]n de|nueva ruta|nuevas rutas|new plant|new facility|new warehouse|new distribution center|acquired|acquisition|awarded (a )?contract|expanded (its )?(capacity|fleet|operations|footprint|production)|invests|new operation|enters (the )?(market|country)|open(?:ed|s|ing)? (?:a |its |the )?(?:new )?(?:plant|facility|factory|warehouse|distribution cent(?:er|re)|manufacturing (?:plant|facility)|production (?:plant|facility))|beg(?:an|un|ins) (?:its )?(?:production|operations|manufacturing)|start(?:ed|s|ing)? (?:its )?(?:production|operations)|commenc(?:ed|es|ing) (?:production|operations)|launch(?:ed|es|ing)? (?:its )?operations|commission(?:ed|s|ing)? (?:a |its |the )?(?:new )?(?:plant|facility|line)|entered (?:a )?(?:new )?market|expand(?:ed|s|ing)? into|established (?:a )?(?:new )?(?:presence|operations|plant|facility)|merger|merged with|took over|appointed (?:a )?(?:new )?distributor|named (?:a )?(?:new )?distributor|sign(?:ed|s|ing)? (?:a )?distribution agreement|enter(?:ed|s|ing)? (?:a |into a )?strategic (?:alliance|partnership)|strategic alliance|distribution agreement|channel partnership)\b/i;
const HIGH_VARIANTS = /\bopen(?:ed|s|ing)? (?:a |its |the )?(?:(?:largest|major|additional) )?(?:plant|facility|factory|warehouse|distribution cent(?:er|re)|manufacturing (?:plant|facility)|production (?:plant|facility))\b/i;
const HIGH_DESCRIPTIVE_OPEN = /\bopen(?:ed|s|ing)? (?:a |its |the )?(?:[a-z-]+ ){0,6}(?:plant|facility|factory|warehouse|distribution cent(?:er|re)|manufacturing (?:plant|facility)|production (?:plant|facility))\b/i;
const MEDIUM = /\b(alianza|acuerdo|partnership|firm[oó]|lanz[oó]|lanzamiento|piloto|prueba|actualiz[oó]|moderniz[oó]|contrat[oó] (personal|equipo|gerente)|hir(ed|ing)|launch(ed)?|pilot|upgrade|renov[oó]|implementa)\b/i;
const LOW = /\b(premio|galard[oó]n|reconocimiento|entrevista|opini[oó]n|columna|feria|expo|stand|patrocin|campa[ñn]a|celebra|anivers|ranking|informe|estudio|tendencia|award|interview|webinar|sponsor|campaign|anniversary|trends?|report|profile|perfil|aplicaci[oó]n|app store|s[ií]guenos|redes sociales|tiktok|instagram)\b/i;

// Negative events and pure PR are NOT commercial opportunities even if a
// growth word appears alongside — they veto to low materiality.
const NEGATIVE = /\b(aplaz[oó] (los )?pagos|incumpl|impag|mora|demand[oó]|demanda judicial|crisis|p[eé]rdidas|quiebra|liquidaci[oó]n|cierre de|despidos|recorte|sanci[oó]n|multa|investigaci[oó]n por|escándalo|paro|huelga|postpon(?:ed|es|ing)|delay(?:ed|s|ing)? (?:its |the )?(?:project|facility|plant|expansion|opening)|suspend(?:ed|s|ing)|halt(?:ed|s|ing)|shut(?: |-)?down|shut (?:down )?(?:its|the) (?:plant|facility|operation)|clos(?:ed|es|ing) (?:its|the) (?:plant|facility|operation|division)|divest(?:ed|s|ing)|exit(?:ed|s|ing)? (?:the )?market|withdrew from|withdraw(?:s|ing)? from|discontinu(?:ed|es|ing)|cancel(?:l?ed|s|l?ing))\b/i;
const PURE_PR = /\b(sostenibilidad|responsabilidad social|huella de carbono|voluntariado|donaci[oó]n|reconoc(e|ió) a sus|d[ií]a de|celebra(ci[oó]n)?|campa[ñn]a de marca)\b/i;

export function classifyMateriality(titleAndContent: string): { level: Materiality; matched: string | null } {
  const hay = titleAndContent.toLowerCase();
  const neg = hay.match(NEGATIVE); if (neg) return { level: "low", matched: `negativo: ${neg[0]}` };
  // Pure PR vetoes UNLESS a concrete high-materiality change is also present.
  const pr = hay.match(PURE_PR);
  const h = hay.match(HIGH) ?? hay.match(HIGH_VARIANTS) ?? hay.match(HIGH_DESCRIPTIVE_OPEN);
  if (pr && !h) return { level: "low", matched: `pr: ${pr[0]}` };
  if (h) return { level: "high", matched: h[0] };
  // A low-materiality marker vetoes a medium one (a "feria" mention wins over "lanzó").
  const l = hay.match(LOW);
  const m = hay.match(MEDIUM);
  if (m && !l) return { level: "medium", matched: m[0] };
  return { level: "low", matched: l ? l[0] : null };
}
