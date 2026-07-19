// ─── Event materiality (materiality-v1) ──────────────────────────────────────
// Not every recent, true signal is a commercial opportunity. Classifies the
// event by how much it actually changes the company's operations — the thing a
// serious B2B seller cares about. Deterministic keyword rules over the
// title/content; only high/medium advances, and medium demands stronger fit +
// corroboration downstream.

export const MATERIALITY_VERSION = "materiality-v1";
export type Materiality = "high" | "medium" | "low";

const HIGH = /\b(nueva planta|nueva f[aá]brica|nueva bodega|nuevo centro de distribuci[oó]n|centro log[ií]stico|inaugur[oó]|expansi[oó]n regional|adquiri[oó]|adquisici[oó]n|compr[oó] (a|la|el)|nuevo contrato|adjudic[oó]|gan[oó] (el|un|la) (contrato|licitaci[oó]n)|amplí[oa] (su )?capacidad|nueva operaci[oó]n|entra (a|al) (mercado|pa[ií]s)|ingres[oó] (a|al)|incorpor[oó] (\d+ )?veh[ií]culos|ampl[ií][oó] (su )?flota|crecimiento de (su )?flota|nueva flota|invierte|inversi[oó]n de|nueva ruta|nuevas rutas|new plant|new facility|new warehouse|new distribution center|acquired|acquisition|awarded (a )?contract|expanded (its )?(capacity|fleet|operations)|invests|new operation|enters (the )?(market|country))\b/i;
const MEDIUM = /\b(alianza|acuerdo|partnership|firm[oó]|lanz[oó]|lanzamiento|piloto|prueba|actualiz[oó]|moderniz[oó]|contrat[oó] (personal|equipo|gerente)|hir(ed|ing)|launch(ed)?|pilot|upgrade|renov[oó]|implementa)\b/i;
const LOW = /\b(premio|galard[oó]n|reconocimiento|entrevista|opini[oó]n|columna|feria|expo|stand|patrocin|campa[ñn]a|celebra|anivers|ranking|informe|estudio|tendencia|award|interview|webinar|sponsor|campaign|anniversary|trends?|report|profile|perfil|aplicaci[oó]n|app store|s[ií]guenos|redes sociales|tiktok|instagram)\b/i;

export function classifyMateriality(titleAndContent: string): { level: Materiality; matched: string | null } {
  const hay = titleAndContent.toLowerCase();
  const h = hay.match(HIGH); if (h) return { level: "high", matched: h[0] };
  // A low-materiality marker vetoes a medium one (a "feria" mention wins over "lanzó").
  const l = hay.match(LOW);
  const m = hay.match(MEDIUM);
  if (m && !l) return { level: "medium", matched: m[0] };
  return { level: "low", matched: l ? l[0] : null };
}
