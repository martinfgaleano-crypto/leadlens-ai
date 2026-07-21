// Unit tests: organization-type, event-vs-metric, thesis-specificity.
// Run: npm run test:intelligence-v2

import { classifyOrganization } from "@/lib/discovery/organization-type";
import { classifySignalKind } from "@/lib/discovery/event-vs-metric";
import { thesisSpecificityTest } from "@/lib/discovery/thesis-specificity";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };

// ── Organization type (exact prompt cases) ──
t("Metro de Medellín → no elegible (operador público)", !classifyOrganization({ name: "Metro de Medellín" }).eligible_for_icp);
t("TransMilenio → no elegible (sistema de transporte)", !classifyOrganization({ name: "TransMilenio" }).eligible_for_icp);
t("Opain → elegible (concesionario privado)", classifyOrganization({ name: "Opain" }).eligible_for_icp);
t("Ecopetrol → elegible (comercial con participación estatal)", classifyOrganization({ name: "Ecopetrol" }).eligible_for_icp);
t("Alcaldía de Bogotá → no elegible", !classifyOrganization({ name: "Alcaldía de Bogotá" }).eligible_for_icp);
t("Ministerio de Transporte → no elegible", !classifyOrganization({ name: "Ministerio de Transporte" }).eligible_for_icp);
t("Odinsa (concesionario) → elegible", classifyOrganization({ name: "Odinsa" }).eligible_for_icp);
t("EPM (empresa mixta comercial) → elegible", classifyOrganization({ name: "EPM" }).eligible_for_icp);
t("Cámara de Comercio de Bogotá → no elegible (gremio)", !classifyOrganization({ name: "Cámara de Comercio de Bogotá" }).eligible_for_icp);
t("Coordinadora (privada) → elegible", classifyOrganization({ name: "Coordinadora" }).eligible_for_icp);
t("dominio .gov → no elegible", !classifyOrganization({ name: "Agencia X", domain: "agencia.gov.co" }).eligible_for_icp);
t("clasifica commercial_entity y relación", classifyOrganization({ name: "Ecopetrol" }).public_sector_relationship === "state_owned");

// ── Event vs metric (exact prompt cases) ──
t("movilizó 17M pasajeros → NO evento", !classifySignalKind("Avianca movilizó más de 17 millones de pasajeros").can_trigger);
t("compró 120 vehículos → evento material", classifySignalKind("La empresa compró 120 vehículos nuevos").can_trigger);
t("creció 20% → insuficiente sin causa", !classifySignalKind("La empresa creció 20% en el último año").can_trigger);
t("nueva planta que aumenta capacidad → evento", classifySignalKind("Abrió una nueva planta que aumenta la capacidad").can_trigger);
t("lidera ranking → NO evento", !classifySignalKind("La empresa lidera el ranking del sector").can_trigger);
t("ganó contrato de 5 años → evento material", classifySignalKind("Ganó un contrato de cinco años con el operador").can_trigger);
t("adquisición → strategic_decision", classifySignalKind("Bergé adquirió el 100% de Transportes Vigía").kind === "strategic_decision");
t("aniversario → historical_metric", classifySignalKind("La compañía celebró su aniversario número 50").kind === "historical_metric");
t("recibió reconocimiento → marketing_claim (no trigger)", classifySignalKind("La empresa recibió un reconocimiento a la sostenibilidad").kind === "marketing_claim" && !classifySignalKind("La empresa recibió un reconocimiento a la sostenibilidad").can_trigger);
t("participó en feria → marketing_claim", classifySignalKind("La compañía participó en la feria logística de Bogotá").kind === "marketing_claim");
t("análisis del sector → editorial_content", classifySignalKind("5 claves para mejorar la logística según expertos del sector").kind === "editorial_content");
t("perfil de empresa → reference_information", classifySignalKind("Quiénes somos: perfil de la empresa y su información corporativa").kind === "reference_information");

// ── Thesis specificity (substitution test) ──
const generic = thesisSpecificityTest({ thesis: "Esta expansión podría requerir mejores soluciones tecnológicas.", company: "TCC", event_keyword: "nueva bodega", product_terms: ["WMS", "inventario"] });
t("tesis genérica → no específica", !generic.specific && generic.flags.length > 0);
const specific = thesisSpecificityTest({ thesis: "La apertura de una nueva bodega en Bogotá aumenta la complejidad de inventario; para un proveedor de WMS hay que validar si centralizan el stock antes de contactar e investigar el stack.", company: "TCC", event_keyword: "nueva bodega", product_terms: ["WMS", "inventario"] });
t("tesis específica → específica", specific.specific, `score ${specific.score}`);
t("detecta lenguaje genérico", thesisSpecificityTest({ thesis: "Representa una oportunidad porque está creciendo.", company: "X", event_keyword: "inversión", product_terms: ["software"] }).flags.some((f) => f.includes("genérico")));
t("detecta falta de acción", !thesisSpecificityTest({ thesis: "Compró una nueva bodega que aumenta su WMS necesidad.", company: "X", event_keyword: "nueva bodega", product_terms: ["WMS"] }).has_action);

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed ? 1 : 0);
