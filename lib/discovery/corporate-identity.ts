// ─── Corporate identity resolution (corporate-identity-v1) ───────────────────
// The #1 residual from the previous sprint: homonyms (CO "Bavaria" vs German
// Bavaria, "Essentia" CO vs US hospital). Resolves a candidate company's real
// corporate domain + operating country from a bounded official-site search,
// then scores corporate_identity_confidence. A signal is only attributed to the
// company when the source/content matches that resolved identity — otherwise it
// is a homonym and is rejected. Compliant: search over public pages only.

export const CORPORATE_IDENTITY_VERSION = "corporate-identity-v1";

export interface CorporateIdentity {
  name: string;
  domain: string | null;          // resolved corporate domain (e.g. servientrega.com)
  country: string | null;
  confidence: number;             // 0-100 corporate_identity_confidence
  aliases: string[];
  resolved_from: string | null;   // the URL the domain came from
  reasons: string[];
}

// Hosts that are never a company's own corporate site.
const NON_CORPORATE_HOST = /(wikipedia|fandom|play\.google|apps\.apple|tracxn|crunchbase|trustpilot|glassdoor|linkedin|facebook|instagram|youtube|tiktok|twitter|x\.com|larepublica|portafolio|dinero|semana|eltiempo|elespectador|bnamericas|forbes|bloomberg|reuters|noticias|prensa|revista|diario|paginasamarillas|directorio|gov|gob)/i;

function hostOf(url: string): string | null {
  try { return new URL(url).host.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}
function slug(s: string): string { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, ""); }

/** Name↔domain match score: how much the corporate host reflects the company
 *  name (handles "Servientrega" → servientrega.com, "Grupo Éxito" → grupoexito). */
export function nameDomainMatch(name: string, host: string): number {
  const n = slug(name), hcore = slug(host.split(".")[0]);
  if (!n || !hcore) return 0;
  if (hcore === n) return 100;
  if (hcore.includes(n) || n.includes(hcore)) return 80;
  // token overlap for multi-word names
  const tokens = name.toLowerCase().split(/\s+/).map(slug).filter((t) => t.length >= 4);
  if (tokens.some((t) => hcore.includes(t))) return 60;
  return 0;
}

/** Resolve the corporate identity from bounded search. One official-site query;
 *  picks the best name-matching non-media host, prefers .co for CO runs. */
export async function resolveCorporateIdentity(
  name: string, country: string | null, spanish: boolean,
): Promise<CorporateIdentity> {
  const base: CorporateIdentity = { name, domain: null, country, confidence: 0, aliases: [], resolved_from: null, reasons: [] };
  try {
    const { braveProvider, serperProvider } = await import("@/lib/sources/access/providers");
    const q = spanish ? `"${name}" sitio oficial ${country ?? "Colombia"}` : `"${name}" official website ${country ?? ""}`;
    const opts = { language: spanish ? "es" : "en", region: (spanish ? "co" : "us") as string, max_results: 8, query_type: "official_domain" as const };
    // Use Brave AND Serper: identity resolution must not silently fail when one
    // provider is unavailable (e.g. no Brave key) — that would zero every
    // confidence and make the homonym guard reject real accounts.
    const [brave, serper] = await Promise.all([
      braveProvider.search({ query: q, ...opts }).catch(() => ({ results: [] })),
      serperProvider.search({ query: q, ...opts }).catch(() => ({ results: [] })),
    ]);
    let best: { host: string; url: string; score: number } | null = null;
    for (const r of [...brave.results, ...serper.results]) {
      const host = hostOf(r.canonical_url); if (!host || NON_CORPORATE_HOST.test(host)) continue;
      let score = nameDomainMatch(name, host);
      if (score === 0) continue;
      if (spanish && /\.co(\/|$|\.)/i.test(host)) score += 10; // CO domain bonus
      if (!best || score > best.score) best = { host, url: r.canonical_url, score };
    }
    if (best) {
      base.domain = best.host;
      base.resolved_from = best.url;
      base.confidence = Math.min(100, best.score);
      base.reasons.push(`Dominio ${best.host} coincide con el nombre (score ${best.score}).`);
      if (spanish && /\.co(\/|$|\.)/i.test(best.host)) { base.reasons.push("Dominio .co — presencia colombiana."); }
    } else {
      base.reasons.push("No se resolvió un dominio corporativo propio — identidad no confirmada.");
    }
  } catch {
    base.reasons.push("Resolución de dominio no disponible.");
  }
  return base;
}

/** Does a found signal actually belong to THIS corporate identity? Guards
 *  against foreign homonyms: the signal's source host or content must reference
 *  the resolved corporate domain OR the operating country. */
export function signalMatchesIdentity(id: CorporateIdentity, sourceUrl: string | null, contentLower: string, spanish: boolean): { ok: boolean; reason: string } {
  const host = sourceUrl ? hostOf(sourceUrl) : null;
  if (id.domain && host && (host === id.domain || host.endsWith("." + id.domain))) return { ok: true, reason: "Fuente es el dominio corporativo propio." };
  if (id.domain && contentLower.includes(id.domain.toLowerCase())) {
    return { ok: true, reason: "El contenido referencia el dominio corporativo completo." };
  }
  // Country/geography confirmation (already computed upstream) is the fallback.
  if (spanish && /\bcolombia\b|\bbogot[aá]\b|\bmedell[ií]n\b|\bcali\b|\bbarranquilla\b|\bcartagena\b|colombian[ao]/i.test(contentLower)) {
    return { ok: id.confidence >= 60 ? true : false, reason: id.confidence >= 60 ? "País confirmado + identidad corporativa razonable." : "País confirmado pero identidad corporativa débil (posible homónimo)." };
  }
  return { ok: false, reason: "No se pudo confirmar que la señal pertenezca a esta identidad corporativa (posible homónimo)." };
}
