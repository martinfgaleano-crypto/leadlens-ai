import type { PilotWorkspace } from "./pilot-workspace";

export const PILOT_SECTIONS = [
  ["overview", "Resumen"],
  ["icp", "Perfil de cliente ideal"],
  ["accounts", "Cuentas recomendadas"],
  ["account", "Análisis por cuenta"],
  ["context", "Contexto"],
  ["evidence", "Evidencia y timing"],
  ["readiness", "Preparación del reporte"],
] as const;

export type PilotSection = (typeof PILOT_SECTIONS)[number][0];
export const isPilotSection = (value: string): value is PilotSection =>
  PILOT_SECTIONS.some(([section]) => section === value);

export const ICP = {
  summary: "El perfil provisional busca cuentas B2B en Colombia donde una oferta de infusiones botánicas premium pueda encajar en retail especializado, bienestar, hospitalidad o distribución. La prioridad favorece una ruta de categoría comprensible, complejidad comercial manejable y potencial de recompra; todavía requiere confirmar la oferta, economía, capacidad y cobertura de Amor de Gea.",
  dimensions: [
    ["Geografía", "Colombia; cobertura real de entrega pendiente de confirmación.", "hecho"],
    ["Segmentos", "Retail especializado, bienestar, hospitalidad y distribución.", "hecho"],
    ["Canal", "Compra para surtido, experiencia de huésped, bienestar o distribución.", "inferencia"],
    ["Tipo de cuenta", "Organizaciones B2B con identidad y presencia digital verificables.", "hecho"],
    ["Caso de uso", "Surtido recurrente, amenidad, experiencia o ampliación de portafolio.", "inferencia"],
    ["Escala", "Compatible con la capacidad productiva y los mínimos de Amor de Gea.", "pregunta"],
    ["Posicionamiento", "Afinidad con bienestar, naturalidad o propuesta premium.", "inferencia"],
    ["Operación", "Formatos, registros, despacho e inventario compatibles.", "pregunta"],
    ["Compras", "Ruta de categoría o alianza accesible y no desproporcionada.", "inferencia"],
    ["Valor estratégico", "Aprendizaje, recurrencia o alcance multicuenta.", "inferencia"],
  ] as const,
  positive: [
    "Orientación visible a salud, bienestar o consumo premium.",
    "Caso de uso relevante para bebida, infusión, hospitalidad o regalo.",
    "Ruta directa de categoría, alianza o distribución.",
    "Potencial de recompra o de aprendizaje comercial transferible.",
    "Presencia verificable en Colombia.",
  ],
  disqualifiers: [
    "Pedido mínimo u orden esperada incompatible — sin resolver.",
    "Cobertura fuera de la capacidad logística — sin resolver.",
    "Certificaciones o registros no disponibles — sin resolver.",
    "Margen de canal incompatible — sin resolver.",
    "Formato de producto inadecuado — sin resolver.",
    "Complejidad de compras superior a la capacidad actual — sin resolver.",
  ],
  provenance: {
    facts: ["Alcance geográfico Colombia.", "Seis identidades y dominios oficiales verificados.", "Cuatro segmentos presentes en la muestra controlada."],
    inferences: ["Afinidad de categoría y caso de uso.", "Ruta probable de comprador.", "Valor estratégico y secuencia de validación."],
    questions: ["Formatos B2B, precios y pedido mínimo.", "Cobertura, capacidad productiva y certificaciones.", "Modelo comercial, margen y tolerancia al ciclo de ventas."],
  },
};

export const ACCOUNT_UNIVERSE = {
  raw: 252,
  deduplicated: 164,
  verified: 21,
  probable: 29,
  excluded: 114,
  controlled: 6,
  deeplyResearched: 6,
  recommended: 4,
  monitored: 2,
  limitation: "Las seis cuentas son una muestra controlada para probar canales y aprender; no representan todo el mercado colombiano ni una shortlist definitiva.",
};

// Editorial validation sequence derived from the canonical portfolio roles:
// learn through the accessible entry account, test channel leverage, then
// approach strategic accounts with those learnings. This is not a score.
const ORDER = ["bioplaza", "distribuidora-dam", "natural-mas-mente", "tu-tienda-saludable", "hotel-spa-la-colina", "somos-consiente"];

function slug(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\+/g, "mas").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function recommendations(workspace: PilotWorkspace) {
  return [...workspace.accounts].sort((a: any, b: any) => {
    const ai = ORDER.indexOf(slug(a.account_name));
    const bi = ORDER.indexOf(slug(b.account_name));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  }).map((account: any, index) => {
    const role = workspace.portfolio?.roles?.find((item: any) => item.account_id === account.account_id);
    const immediate = account.decision === "prioritize";
    return {
      account,
      order: index + 1,
      state: immediate ? (role?.role === "strategic_account" ? "recommended_for_strategic_follow_up" : "recommended_for_validation") : "monitor_until_trigger",
      category: immediate ? (role?.role === "strategic_account" ? "Seguimiento estratégico" : "Validar ahora") : "Monitorear hasta un trigger",
      role: role?.role,
      rationale: role?.role === "accessible_entry_account"
        ? "Ruta de retail especializada clara y alto valor de aprendizaje para validar categoría primero."
        : role?.role === "channel_account"
          ? "Puede ampliar cobertura, pero exige confirmar márgenes, mínimos y capacidad de distribución."
          : role?.role === "strategic_account"
            ? "Buen encaje estructural; conviene abordarla después de aprender de una validación inicial."
            : "Afinidad plausible, pero sin señal temporal ni ruta comercial suficientemente directa.",
      strength: account.segment === "retail" ? "Encaje visible con surtido de bienestar." : account.segment === "distribution" ? "Potencial de multiplicación por canal." : "Caso de uso diferenciado.",
      blocker: "Sin economía, capacidad ni ventana comercial confirmadas.",
      action: immediate ? "Validar oferta, comprador y viabilidad antes de contacto." : "Monitorear expansión, surtido, alianza o búsqueda de proveedor.",
      fallback: "Mantener en observación y reasignar prioridad cuando aparezca evidencia nueva.",
      trigger: "Expansión, cambio de surtido, alianza o señal de proveedores verificable.",
      methodology_version: "amor-recommendation-contract-v1",
    };
  });
}
