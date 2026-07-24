import type { AccountCommercialRole } from "./account-role";

export type ChannelAccessStatus = "external_brand_channel" | "seller_recruitment" | "insufficient";

export interface ChannelAccessAssessment {
  status: ChannelAccessStatus;
  qualifies: boolean;
  confidence: "high" | "medium" | "low";
  matched: string[];
  reason: string;
  evidence_urls?: string[];
}

export type AccessLanguage = "es" | "en";

/** Channel access is useful for brands/products seeking retail, distribution,
 * hospitality or marketplace placement. A generic supplier portal is not an
 * opportunity for unrelated software/services, so the lane is opt-in by
 * commercial context rather than by customer name or vertical pack. */
export function channelAccessRelevant(context: string): boolean {
  const physicalOffer = /(?:producto f[ií]sico|physical product|marca|brand|bebida|beverage|alimento|food|cosm[eé]tic|beauty|consumer goods|consumo masivo|suplement|nutrac[eé]ut)/i.test(context);
  if (/(?:software|saas|plataforma|platform|telemetr|consultor[ií]a|consulting)/i.test(context) && !physicalOffer) return false;
  return physicalOffer || /(?:retail|wholesale|mayorista|marketplace|hotel|hospitality|spa|wellness|surtido|assortment|category management)/i.test(context);
}

export function buildChannelAccessQuery(domain: string, language: AccessLanguage, role?: AccountCommercialRole): string {
  if (role === "hospitality_operator") {
    return language === "es"
      ? `site:${domain} proveedores alimentos bebidas spa bienestar compras abastecimiento`
      : `site:${domain} suppliers food beverage spa wellness procurement purchasing`;
  }
  return language === "es"
    ? `site:${domain} proveedores marcas distribuidor autorizado portafolio comercializamos`
    : `site:${domain} suppliers brands authorized distributor vendor onboarding portfolio`;
}

/** Extractors can technically succeed while returning a SPA's 404 shell. Such
 * content is neither live commercial proof nor a valid corroboration page. */
export function channelPageContentUsable(content: string): boolean {
  const normalized = content.replace(/\s+/g, " ").slice(0, 30_000);
  if (normalized.trim().length < 80) return false;
  if (/NotFound\.(?:tsx|jsx|js)|data-loc=["'][^"']*NotFound/i.test(normalized)) return false;
  if (/(?:^|[>\s#])404(?:[<\s:—-]|$).{0,500}(?:page not found|not found|p[aá]gina no encontrada|no encontramos)/i.test(normalized)) return false;
  return true;
}

/** Cheap pre-extraction ranking hint. It cannot qualify a candidate; it only
 * spends the scarce extraction slot on a likely vendor/brand-access page
 * before product pages, legal pages or generic homepages. */
export function channelAccessSearchHint(title: string, url: string): number {
  const hay = `${title} ${url}`.toLowerCase();
  let score = 0;
  if (/(?:proveedor|supplier|vendor|brand submission|ser proveedor)/i.test(hay)) score += 4;
  if (/(?:marcas|brands|portafolio|portfolio|distribu|wholesale|mayorista|represent)/i.test(hay)) score += 3;
  if (/(?:alianzas|partnership|partners)/i.test(hay)) score += 2;
  if (/(?:producto|products?|shop|tienda|carrito|privacy|privacidad|t[eé]rminos|terms)/i.test(hay)) score -= 2;
  return score;
}

/** Keeps the provider ranking stable except when known catalog-proof URLs must
 * receive the bounded live-validation slot. */
export function prioritizeChannelProofUrls<T extends { canonical_url: string }>(results: T[], evidenceUrls: string[] = []): T[] {
  if (!evidenceUrls.length) return results;
  const proof = new Set(evidenceUrls);
  return results.map((result, index) => ({ result, index }))
    .sort((a, b) => Number(proof.has(b.result.canonical_url)) - Number(proof.has(a.result.canonical_url)) || a.index - b.index)
    .map(x => x.result);
}

const EXTERNAL_BRAND_PATTERNS: Array<[RegExp, string]> = [
  [/(?:somos |es )?(?:distribuidor(?:es)?|representante) autorizad[oa]s?(?: de| para)?/i, "distribuidor autorizado de terceros"],
  [/marcas? aliadas?(?:.{0,100}(?:portafolio|distribu|productos?))?/i, "marcas aliadas en canal"],
  [/distribu(?:imos|ye|ci[oó]n de).{0,80}marcas? (?:nacionales?|internacionales?|aliadas?|de terceros)/i, "distribuye marcas externas"],
  [/portafolio.{0,60}(?:de )?marcas/i, "portafolio multimarca"],
  [/(?:registro|inscripci[oó]n|portal).{0,40}proveedores/i, "proceso de proveedores"],
  [/(?:quieres|deseas|interesad[oa] en).{0,40}(?:ser|convertirte en) proveedor/i, "convocatoria a proveedores"],
  [/(?:incorporamos|buscamos|seleccionamos|trabajamos con).{0,70}(?:nuevas? )?marcas/i, "incorporación de marcas"],
  [/(?:representamos|comercializamos).{0,80}marcas/i, "representación multimarca"],
  [/(?:comercializamos|distribuimos).{0,80}productos? de (?:diferentes|diversas|otras) marcas/i, "comercializa productos de otras marcas"],
  [/(?:authorized|official) distributor(?: of| for)?/i, "authorized third-party distributor"],
  [/(?:vendor|supplier) (?:registration|onboarding|portal|application)/i, "vendor onboarding process"],
  [/(?:brand|supplier) submissions?/i, "accepts brand or supplier submissions"],
  [/(?:we distribute|we represent|our portfolio includes).{0,90}(?:brands?|products?)/i, "multi-brand distribution"],
  [/(?:somos |empresa )?(?:distribuidor(?:a|es)?|mayorista).{0,70}(?:suplementos?|productos? (?:naturales?|org[aá]nicos?|de bienestar)|alimentos?|bebidas?)/i, "capacidad declarada de distribución en la categoría"],
  [/(?:specialty |authorized )?(?:distributor|wholesaler).{0,70}(?:supplements?|natural products?|food|beverages?|wellness products?)/i, "declared category distribution capability"],
];

// Opposite commercial direction: the company wants third parties to resell its
// own products. This is not evidence that it can buy or list Amor de Gea.
const SELLER_RECRUITMENT_PATTERNS: Array<[RegExp, string]> = [
  [/(?:s[eé]|convi[eé]rtete en|quieres ser).{0,25}(?:nuestro )?distribuidor/i, "recluta distribuidores para su marca"],
  [/distribuye (?:nuestros|mis) productos/i, "ofrece sus propios productos para reventa"],
  [/(?:franquicia|abre tu punto).{0,50}(?:nuestra marca|con nosotros)/i, "programa de franquicia propio"],
  [/(?:become|join us as).{0,35}(?:our |a )?(?:distributor|franchisee|reseller)/i, "recruits resellers for its own offer"],
  [/distribute (?:our|my) products/i, "offers its own products for resale"],
  [/(?:contacto|programa|informaci[oó]n).{0,35}(?:para )?distribuidores/i, "recluta distribuidores para su oferta"],
];

/** Multi-brand catalog evidence from search results on the verified corporate
 * domain. This proves channel operation, not current supplier openness. */
export function assessCatalogChannel(input: { company: string; domain: string; results: Array<{ title: string | null; url: string }> }): ChannelAccessAssessment {
  const brands = new Map<string, string>();
  const companyNorm = input.company.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, "");
  for (const r of input.results) {
    let host = "";
    try { host = new URL(r.url).host.replace(/^www\./, ""); } catch { continue; }
    if (host !== input.domain && !host.endsWith(`.${input.domain}`)) continue;
    const title = r.title ?? "";
    const labeledMatch = title.match(/(?:comprar|tienda de|productos de|marca)\s+(?:productos?\s+)?([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9&.-]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9&.-]{2,}){0,2})/i);
    // WooCommerce and similar stores expose brand taxonomies as
    // /marca/<brand> or /brand/<brand>. Two distinct official taxonomy pages
    // are portable proof of a real multi-brand channel.
    let taxonomyBrand: string | null = null;
    try {
      const pathMatch = new URL(r.url).pathname.match(/\/(?:marca|brand|fabricante)\/([^/?#]+)/i);
      if (pathMatch?.[1]) taxonomyBrand = decodeURIComponent(pathMatch[1]).replace(/[-_]+/g, " ").trim();
    } catch { /* URL already validated above */ }
    const brand = (labeledMatch?.[1] ?? taxonomyBrand)?.trim();
    if (!brand) continue;
    const norm = brand.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, "");
    if (norm.length < 4 || companyNorm.includes(norm) || /^(online|colombia|naturales|saludables|vitaminas)$/.test(norm)) continue;
    brands.set(norm, r.url);
  }
  if (brands.size < 2) return { status: "insufficient", qualifies: false, confidence: "low", matched: [], reason: "No se observaron suficientes marcas externas distintas en el catálogo oficial." };
  return {
    status: "external_brand_channel", qualifies: true, confidence: brands.size >= 3 ? "high" : "medium",
    matched: [`catálogo oficial con ${brands.size} marcas externas distintas`], evidence_urls: Array.from(brands.values()).slice(0, 5),
    reason: "El dominio corporativo opera un catálogo multimarca verificable; esto prueba capacidad de canal, no apertura actual a nuevos proveedores.",
  };
}

/** Deterministic direction classifier for evergreen channel evidence.
 * It never infers purchase intent. A qualifying result only proves that the
 * account operates a channel open to external brands and merits validation. */
export function assessChannelAccess(text: string, officialDomain: boolean): ChannelAccessAssessment {
  const hay = text.replace(/\s+/g, " ").slice(0, 30_000);
  const seller = SELLER_RECRUITMENT_PATTERNS.filter(([re]) => re.test(hay)).map(([, label]) => label);
  const external = EXTERNAL_BRAND_PATTERNS.filter(([re]) => re.test(hay)).map(([, label]) => label);

  if (seller.length && !external.length) {
    return { status: "seller_recruitment", qualifies: false, confidence: "high", matched: seller, reason: "La dirección comercial es inversa: busca distribuidores para sus propios productos, no marcas externas." };
  }
  if (seller.length && external.length < 2) {
    return { status: "insufficient", qualifies: false, confidence: "low", matched: [...seller, ...external], reason: "La página mezcla dirección compradora y vendedora; una sola señal externa no basta para confirmar apertura a marcas de terceros." };
  }
  if (!officialDomain || !external.length) {
    return { status: "insufficient", qualifies: false, confidence: "low", matched: external, reason: !officialDomain ? "La evidencia no está en el dominio corporativo verificado." : "No hay evidencia explícita de apertura a marcas o proveedores externos." };
  }
  return {
    status: "external_brand_channel", qualifies: true,
    confidence: external.length >= 2 ? "high" : "medium",
    matched: external,
    reason: "El sitio corporativo demuestra un canal multimarca o un proceso para proveedores externos; validar categoría, requisitos y comprador antes de contactar.",
  };
}
