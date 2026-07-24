export type AccountCommercialRole = "buyer_channel" | "hospitality_operator" | "end_user_operator" | "brand_owner" | "seller_network" | "service_provider" | "unknown";

export interface AccountRoleAssessment {
  role: AccountCommercialRole;
  confidence: "high" | "medium" | "low";
  evidence: string[];
}

/** Buyer-side role classifier used before signal spend. It classifies the
 * account's commercial function, not whether an opportunity already exists. */
export function inferAccountCommercialRole(text: string): AccountRoleAssessment {
  const hay = text.toLowerCase().replace(/\s+/g, " ");
  const hit = (re: RegExp) => re.test(hay);
  if (hit(/hotel|hoteler[ií]a|resort|hospitality|spa|alojamiento|club de bienestar/)) {
    return { role: "hospitality_operator", confidence: "high", evidence: ["opera hospitality, spa o alojamiento"] };
  }
  if (hit(/(?:s[eé]|convi[eé]rtete en|quieres ser).{0,30}(?:nuestro )?distribuidor|distribuye nuestros productos|red de distribuidores para nuestra marca/)) {
    return { role: "seller_network", confidence: "high", evidence: ["recluta distribuidores para oferta propia"] };
  }
  if (hit(/laboratorio|fabricante|manufactur|marca propia|producimos|productor de|elaboramos/)
    && !hit(/supermercado|retail|multimarca|marcas externas|marketplace/)) {
    return { role: "brand_owner", confidence: "medium", evidence: ["principalmente fabricante o propietario de marca"] };
  }
  if (hit(/supermercado|retail|cadena de tiendas|tienda naturista|mercado saludable|marketplace|farmacia|droguer[ií]a|mayorista|distribuci[oó]n|distribuidor/)) {
    return { role: "buyer_channel", confidence: "medium", evidence: ["opera canal retail, mayorista o de distribución"] };
  }
  if (hit(/consultor[ií]a|agencia|directorio|medio de comunicaci[oó]n|revista|software como servicio/)) {
    return { role: "service_provider", confidence: "medium", evidence: ["proveedor de servicios, medio o directorio"] };
  }
  if (hit(/opera|operador|planta|flota|centro de distribuci[oó]n|bodega/)) {
    return { role: "end_user_operator", confidence: "low", evidence: ["opera activos o procesos relevantes"] };
  }
  return { role: "unknown", confidence: "low", evidence: ["rol comprador no demostrado"] };
}

export function rolePriority(role: AccountCommercialRole | undefined): number {
  return role === "buyer_channel" || role === "hospitality_operator" ? 22
    : role === "end_user_operator" ? 16
      : role === "unknown" || !role ? 0
        : role === "brand_owner" ? -18
          : -30;
}
