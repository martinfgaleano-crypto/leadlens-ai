import type { NeedsMap } from "./needs-map";
import type { ChannelAccessAssessment } from "./channel-access";

export interface AccountThesis {
  observed_fact: string;
  client_relevance: string;
  evidence_limit: string;
  validation_question: string;
  replicability_edge: string;
}

/** Builds a falsifiable, client-specific thesis from already-verified facts.
 * It adds no facts and makes uncertainty explicit; this is the decision layer
 * between a web result and a useful commercial recommendation. */
export function buildAccountThesis(input: {
  company: string;
  offer: string;
  needs: NeedsMap;
  title: string;
  signalDate: string | null;
  channelAccess: ChannelAccessAssessment;
  discoveryOrigin?: "vertical_seed" | "dynamic_enumeration";
}): AccountThesis {
  const offer = input.offer.trim() || "la oferta del cliente";
  if (input.channelAccess.qualifies) {
    return {
      observed_fact: `${input.company} declara en su dominio corporativo una operación de canal externo: ${input.channelAccess.matched.join(", ")}.`,
      client_relevance: `Ese mecanismo podría permitir evaluar ${offer} dentro de su portafolio o proceso de proveedores.`,
      evidence_limit: "La evidencia confirma capacidad/apertura de canal, no intención de compra, presupuesto, aceptación de categoría ni timing.",
      validation_question: `¿${input.company} acepta actualmente proveedores externos de esta categoría y quién controla su evaluación comercial?`,
      replicability_edge: input.discoveryOrigin === "dynamic_enumeration"
        ? "Cuenta descubierta fuera del prior curado y conectada con una ruta comercial verificable."
        : "Cuenta sectorial conectada con una ruta comercial concreta, no seleccionada sólo por notoriedad.",
    };
  }
  return {
    observed_fact: `${input.company} aparece como sujeto de “${input.title}”${input.signalDate ? ` con fecha ${input.signalDate}` : ""}.`,
    client_relevance: `El cambio coincide con ${input.needs.relevant_signal_families.join(", ")} y puede aumentar la relevancia de ${offer}.`,
    evidence_limit: "El evento y el fit no demuestran por sí solos intención de compra, presupuesto ni acceso al decisor.",
    validation_question: `¿El cambio observado creó una necesidad activa que ${offer} puede resolver y qué persona controla esa decisión?`,
    replicability_edge: input.discoveryOrigin === "dynamic_enumeration"
      ? "Cuenta descubierta dinámicamente y conectada causalmente con un evento verificable."
      : "Evento verificable evaluado contra operación, causalidad y contravidencia, no sólo coincidencia de palabras.",
  };
}
