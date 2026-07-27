// ─── Segment universe expansion (segment-universe-v1) ────────────────────────
// Live discover+verify executor for the staged Market-to-Account pipeline. Runs
// SEGMENT-specific universe queries (search only — no per-company signal search,
// so breadth is cheap), extracts company candidates from result titles/domains,
// resolves official domains, deduplicates (canonical domain + normalized name),
// classifies buyer segment, rejects directories/social/marketplaces, and assigns
// a status (verified / probable / unresolved / excluded). No recent signal is
// required to enter the universe; channel fit alone never implies buying intent.
// The search function is injected → deterministic tests + real providers live.

import { classifyBuyerSegment, buildSegmentQueries, type BuyerSegment, type SegmentDef, SEGMENTS } from "./market-to-account";

export const SEGMENT_UNIVERSE_VERSION = "segment-universe-v1";

export type CompanyStatus = "verified" | "probable" | "unresolved" | "excluded";
export type UniverseReasonCode =
  | "official_domain_verified" | "official_domain_probable" | "official_domain_unresolved"
  | "duplicate_domain" | "duplicate_name" | "directory_rejected" | "social_only_rejected"
  | "marketplace_rejected" | "seller_of_competing_products" | "irrelevant_rejected" | "included_in_universe"
  | "excluded_from_universe" | "identity_conflict" | "non_company_host";

export interface SearchHit { title: string | null; url: string; }
export type SearchFn = (query: string, segment: BuyerSegment) => Promise<SearchHit[]>;

export interface SegmentUniverseCompany {
  company: string; canonical_name: string; domain: string | null;
  segment: BuyerSegment; buyer_role: string; status: CompanyStatus;
  domain_confidence: "high" | "medium" | "low" | "none";
  classification_confidence: "high" | "medium" | "low";
  inclusion_reason: string; exclusion_reason: string | null;
  reason_codes: UniverseReasonCode[]; source_query: string; source_url: string | null;
  sector: string | null; visibility: "obvious" | "emerging" | "unknown";
}

export interface SegmentUniverseResult {
  companies: SegmentUniverseCompany[];               // verified + probable
  queries_by_segment: Record<string, string[]>;
  raw_candidate_count: number; deduped_company_count: number;
  verified_company_count: number; probable_company_count: number;
  unresolved_company_count: number; excluded_company_count: number;
  segment_distribution: Record<string, number>;
  cost_by_segment: Record<string, number>; duration_by_segment: Record<string, number>;
  provider_used: string[]; aborted_on_budget: boolean; cost_total: number;
}

// ── Junk / non-company hosts ──
const DIRECTORY = /(paginasamarillas|paginas-amarillas|cylex|einforma|guiatel|directorio|amarillas|yellow|listado|ranking|top-?\d|mejores-|computrabajo|indeed|glassdoor|guiacolombia|guia-|kolau|tiendeo|infoisinfo|opendi|hotfrog|\.gob\.|\.gov\.)/i;
const SOCIAL = /(facebook\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com\/|youtube\.com|linkedin\.com|pinterest\.|wa\.me|api\.whatsapp)/i;
const MARKETPLACE = /(mercadolibre|amazon\.|linio|falabella\.com\/|rappi\.|merqueo|ubereats|didi-?food|justo\.mx|tiendanube|\.myshopify)/i;
// Booking / travel / rental aggregators — never the hospitality account itself.
const AGGREGATOR = /(atrapalo|airbnb|booking\.com|tripadvisor|trivago|despegar|expedia|hoteles\.com|kayak|hostelworld|vrbo|traveler|pricetravel|almundo|civitatis)/i;
const ENCYCLOPEDIC = /(wikipedia\.org|\.fandom\.|crunchbase|tracxn)/i;

export function canonicalDomain(url: string): string | null {
  try { return new URL(url).host.replace(/^www\./, "").toLowerCase(); } catch { return null; }
}
export function normalizeName(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\b(s\.?a\.?s?|ltda|e\.?u\.?|inc|corp|group|grupo|colombia|s\.?a\.?)\b/gi, "")
    .replace(/[^a-z0-9]/g, "").trim();
}
/** Extract a plausible company name from a search hit title (strip trailing
 *  " - <tagline>", " | <site>", location suffixes). */
export function extractCompanyName(title: string | null): string | null {
  if (!title) return null;
  let t = title.replace(/^[¿¡"'«»\s]+/, "").split(/[|–—]|(?: - )/)[0].trim();
  if (/\b(estados unidos|united states|españa|m[eé]xico|argentina|chile|per[uú]|ecuador)\b/i.test(t)) return null; // foreign result
  t = t.replace(/\b(inicio|home|bienvenidos?|tienda oficial|sitio oficial|productos|catálogo)\b/gi, "").trim();
  if (t.length < 3 || t.length > 60) return null;
  if (/^\d+ /.test(t) || /\b(los|las|mejores|top)\b/i.test(t.slice(0, 12))) return null; // "10 mejores..."
  if (GENERIC_TITLE.test(t) || CATEGORY_IN_PLACE.test(t)) return null; // nav/category page, not a company
  // Drop trailing phone/contact noise: "Vitafitness S.A.S ... (57) 310..." → keep the head.
  t = t.replace(/\s*\(?\d[\d\s()+-]{6,}.*$/, "").replace(/[®™]/g, "").trim();
  if (t.length < 3) return null;
  return t;
}

function isJunk(url: string): { junk: boolean; code: UniverseReasonCode | null } {
  if (DIRECTORY.test(url)) return { junk: true, code: "directory_rejected" };
  if (AGGREGATOR.test(url)) return { junk: true, code: "directory_rejected" };
  if (MARKETPLACE.test(url)) return { junk: true, code: "marketplace_rejected" };
  if (ENCYCLOPEDIC.test(url)) return { junk: true, code: "irrelevant_rejected" };
  if (SOCIAL.test(url)) return { junk: true, code: "social_only_rejected" };
  return { junk: false, code: null };
}

// Generic page-title labels that are NOT company names (nav/section pages,
// category listings). Reject so we keep real corporate identities only.
const GENERIC_TITLE = /^(puntos? de venta|nuestr[oa]s? (tienda|sede|marca|hotel|producto)s?|d[oó]nde (nos )?(encuentr|est)|nosotros|explorar?|locales? comerciales?|los? mejores?|mejores?|todo sobre|gu[ií]a de|sedes?|contacto|ubicaci|listado|cat[aá]logo|inicio|home|bienvenid|productos?|servicios?|acerca|qui[eé]nes somos|informe|indicadores?|hospedajes?|turismo|tiendas?|supermercados?|hoteles?|spas?|restaurantes?|caf[eé]s?|distribuidores?)\b/i;
// "<category> en <place>" without a proper company noun → a category page.
const CATEGORY_IN_PLACE = /^(tiendas?|supermercados?|hoteles?|spas?|restaurantes?|caf[eé]s?|distribuidores?|mercados?|centros?)\b.{0,30}\ben\b/i;

// Hosts that are never a Colombian buyer's own site: dictionaries/translators,
// media/press, global OTAs & travel guides, global hotel chains, generic HR/PEO
// content. A title landing on these is an article/listing, not a company.
const NON_COMPANY_HOST = /^(collinsdictionary|online-translator|nglish|linguee|wordreference|viator|retreat\.guru|tripadvisor|waze|quiminet|paginasamarillas|semana|eltiempo|elespectador|revistadiners|dinero|larepublica|portafolio|7canibales|passporttheworld|mrandmrssmith|lookingforbooking|thearchipielagopress|myboutiquehotel|hilton|marriott|ihg|accor|wyndham|hyatt|conocimientoglobal|globalization-partners|rivermate|buk\.co|pluxee|magneto365|mascolombia|culligan|rso-sa|h2gconsulting|wellmedhorizons|mountainsofhope|retreat|kriteria)\b/i;

// A defensible company name is a short brand label — not a sentence, headline,
// list ("Los 10 mejores…"), question, translation, or truncated article title.
function looksLikeCompanyName(name: string): boolean {
  const t = name.trim();
  if (t.length < 2 || t.length > 48) return false;
  if (/\.\.\.$|…$/.test(t)) return false;                       // truncated headline
  if (/[?¿]/.test(t)) return false;                             // question title
  if (/\b(in english|translate|from spanish|driving directions)\b/i.test(t)) return false;
  if (/^\d/.test(t) || /\b\d{1,3}\+?\s+(best|mejores?|day|d[ií]as?)\b/i.test(t)) return false; // list/ranking
  if (/\b(para|con sus|que priorizan|c[oó]mo|sobre|cerrados|apuestan|historia de|ejemplos?|beneficios? (para|laborales)|tips?|gu[ií]a)\b/i.test(t)) return false; // sentence/article
  if (t.split(/\s+/).length > 6) return false;                  // too long to be a brand
  return true;
}

/** A search host that IS the company's own site → verified domain. */
function statusFor(domain: string | null, name: string | null): { status: CompanyStatus; conf: SegmentUniverseCompany["domain_confidence"]; code: UniverseReasonCode } {
  if (!name) return { status: "unresolved", conf: "none", code: "official_domain_unresolved" };
  if (!domain) return { status: "probable", conf: "none", code: "official_domain_probable" };
  if (NON_COMPANY_HOST.test(domain)) return { status: "excluded", conf: "none", code: "identity_conflict" };
  // Title is a headline/article/listing, not a company identity → cannot verify.
  if (!looksLikeCompanyName(name)) return { status: "probable", conf: "low", code: "official_domain_probable" };
  // Domain reflects the name → strong official-domain signal.
  const nd = normalizeName(name), host = domain.split(".")[0].replace(/[^a-z0-9]/g, "");
  if (host && (host === nd || host.includes(nd) || nd.includes(host))) return { status: "verified", conf: "high", code: "official_domain_verified" };
  return { status: "probable", conf: "medium", code: "official_domain_probable" };
}

export interface ExpandOptions {
  region?: string; maxQueriesPerSegment?: number; costPerQuery?: number; costCeilingUsd?: number; now?: () => number;
}

/** Run segment-by-segment universe discovery with budget discipline. */
export async function discoverSegmentUniverse(
  segments: SegmentDef[], search: SearchFn, opts: ExpandOptions = {},
): Promise<SegmentUniverseResult> {
  const region = opts.region ?? "Colombia";
  const maxQ = opts.maxQueriesPerSegment ?? 3;
  const costPerQuery = opts.costPerQuery ?? 0.002;
  const ceiling = opts.costCeilingUsd ?? 0.6;
  const now = opts.now ?? (() => Date.now());

  const queries_by_segment: Record<string, string[]> = {};
  const cost_by_segment: Record<string, number> = {};
  const duration_by_segment: Record<string, number> = {};
  const providerUsed = new Set<string>();
  const byDomain = new Map<string, SegmentUniverseCompany>();
  const byName = new Map<string, SegmentUniverseCompany>();
  const all: SegmentUniverseCompany[] = [];
  let raw = 0, cost = 0, aborted = false;

  for (const segDef of segments) {
    const qs = buildSegmentQueries(segDef.id, region).slice(0, maxQ);
    queries_by_segment[segDef.id] = qs;
    const t0 = now(); let segCost = 0;
    for (const q of qs) {
      if (cost + costPerQuery > ceiling) { aborted = true; break; }
      cost += costPerQuery; segCost += costPerQuery;
      const hits = await search(q, segDef.id).catch(() => [] as SearchHit[]);
      providerUsed.add("search");
      for (const h of hits) {
        raw++;
        const { junk, code } = isJunk(h.url);
        if (junk) { all.push(mkExcluded(h, segDef.id, q, code!)); continue; }
        const name = extractCompanyName(h.title);
        const domain = canonicalDomain(h.url);
        if (!name) continue;
        const st = statusFor(domain, name);
        const seg = classifyBuyerSegment(name, segDef.label);
        const nn = normalizeName(name);
        // Dedupe: canonical domain first, then normalized name.
        if (domain && byDomain.has(domain)) { byDomain.get(domain)!.reason_codes.push("duplicate_domain"); continue; }
        if (nn && byName.has(nn)) { byName.get(nn)!.reason_codes.push("duplicate_name"); continue; }
        const isExcluded = st.status === "excluded";
        const company: SegmentUniverseCompany = {
          company: name, canonical_name: nn, domain,
          segment: seg.primarySegment !== "unclassified" ? seg.primarySegment : segDef.id,
          buyer_role: seg.buyerType, status: st.status, domain_confidence: st.conf,
          classification_confidence: seg.roleConfidence,
          inclusion_reason: isExcluded ? "—" : `Encontrada por query de segmento «${segDef.label}»; ${st.code}.`,
          exclusion_reason: isExcluded ? "Host de referencia/medios/cadena global; no es sitio propio de un comprador colombiano." : null,
          reason_codes: isExcluded ? [st.code, "excluded_from_universe"] : [st.code, "included_in_universe"],
          source_query: q, source_url: h.url, sector: segDef.label, visibility: "emerging",
        };
        all.push(company);
        if (domain) byDomain.set(domain, company);
        if (nn) byName.set(nn, company);
      }
    }
    duration_by_segment[segDef.id] = now() - t0;
    cost_by_segment[segDef.id] = Number(segCost.toFixed(6));
    if (aborted) break;
  }

  const kept = all.filter((c) => c.status === "verified" || c.status === "probable");
  const segment_distribution: Record<string, number> = {};
  for (const c of kept) segment_distribution[c.segment] = (segment_distribution[c.segment] ?? 0) + 1;

  return {
    companies: kept, queries_by_segment,
    raw_candidate_count: raw, deduped_company_count: all.length,
    verified_company_count: all.filter((c) => c.status === "verified").length,
    probable_company_count: all.filter((c) => c.status === "probable").length,
    unresolved_company_count: all.filter((c) => c.status === "unresolved").length,
    excluded_company_count: all.filter((c) => c.status === "excluded").length,
    segment_distribution, cost_by_segment, duration_by_segment,
    provider_used: Array.from(providerUsed), aborted_on_budget: aborted, cost_total: Number(cost.toFixed(6)),
  };
}

function mkExcluded(h: SearchHit, seg: BuyerSegment, q: string, code: UniverseReasonCode): SegmentUniverseCompany {
  return {
    company: extractCompanyName(h.title) ?? h.url, canonical_name: "", domain: canonicalDomain(h.url),
    segment: seg, buyer_role: "—", status: "excluded", domain_confidence: "none", classification_confidence: "low",
    inclusion_reason: "—", exclusion_reason: code, reason_codes: [code], source_query: q, source_url: h.url,
    sector: null, visibility: "unknown",
  };
}

/** Convenience: derive segment defs, run over all SEGMENTS if none given. */
export function segmentsForRun(only?: BuyerSegment[]): SegmentDef[] {
  return only ? SEGMENTS.filter((s) => only.includes(s.id)) : SEGMENTS;
}
