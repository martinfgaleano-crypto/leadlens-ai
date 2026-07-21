// Unit tests: commercial-fit, entity-role, sentiment/direction, rubric v2.
// Exact cases from the intelligence-quality sprint prompt.
// Run: npm run test:intelligence-v3

import { assessCommercialFit, requiredOperationTerms } from "@/lib/discovery/commercial-fit";
import { assessEntityRole } from "@/lib/discovery/entity-role";
import { classifyDirection } from "@/lib/discovery/sentiment";
import { scoreOpportunityV2 } from "@/lib/discovery/quality-rubric";
import { companyNameInText } from "@/lib/discovery/company-first-discovery";
import type { NeedsMap } from "@/lib/discovery/needs-map";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };

// Minimal needs maps for the two verticals in the prompt.
const fleetNeeds: NeedsMap = {
  client_product: "Software de gestión de flotas",
  target_company_profile: "Empresas de transporte · distribución · logística con flota propia",
  relevant_signal_families: ["fleet_growth"],
  causal_chains: [],
} as unknown as NeedsMap;
const wmsNeeds: NeedsMap = {
  client_product: "Automatización de bodegas / WMS",
  target_company_profile: "Retailers · fabricantes · distribuidores con operación logística",
  relevant_signal_families: ["new_facility"],
  causal_chains: [],
} as unknown as NeedsMap;

// ── requiredOperationTerms ──
t("fleet_growth exige flota/vehículos", requiredOperationTerms(fleetNeeds).includes("flota"));
t("new_facility exige bodega/CD", requiredOperationTerms(wmsNeeds).includes("bodega"));

// ── Commercial fit: flota propia vs tercerizada (caso #1 del prompt) ──
const owned = assessCommercialFit({ needs: fleetNeeds, company: "Coltanques", sector: "transporte", content: "coltanques amplió su flota propia con 120 camiones para distribución nacional en colombia".toLowerCase(), event_keyword: "flota", disqualifiers: [], product_terms: ["flota", "rutas", "mantenimiento"], required_operation_terms: requiredOperationTerms(fleetNeeds) });
t("flota propia → operational_fit true", owned.operational_fit && owned.hard_blockers.length === 0, JSON.stringify(owned.hard_blockers));
const outsourced = assessCommercialFit({ needs: fleetNeeds, company: "RetailX", sector: "retail", content: "retailx entrega sus productos mediante un operador logístico externo; el transporte está tercerizado".toLowerCase(), event_keyword: "transporte", disqualifiers: [], product_terms: ["flota", "rutas"], required_operation_terms: requiredOperationTerms(fleetNeeds) });
t("flota tercerizada → hard blocker operation_outsourced", outsourced.hard_blockers.includes("operation_outsourced") && !outsourced.operational_fit);
const noOp = assessCommercialFit({ needs: fleetNeeds, company: "BancoX", sector: "financiero", content: "bancox abrió una nueva oficina de atención al cliente en bogotá".toLowerCase(), event_keyword: null, disqualifiers: [], product_terms: ["flota"], required_operation_terms: requiredOperationTerms(fleetNeeds) });
t("sin operación relevante → hard blocker no_relevant_operation_evidenced", noOp.hard_blockers.includes("no_relevant_operation_evidenced"));
const disq = assessCommercialFit({ needs: fleetNeeds, company: "Competidor", sector: "software", content: "competidor es una empresa de software de logística".toLowerCase(), event_keyword: null, disqualifiers: ["software de logística"], product_terms: ["flota"], required_operation_terms: requiredOperationTerms(fleetNeeds) });
t("disqualifier del ICP → hard blocker", disq.hard_blockers.some((h) => h.startsWith("icp_disqualifier")));
t("score no compensa hard blocker (score alto pero bloqueado)", outsourced.hard_blockers.length > 0);

// ── Entity role: adquirente vs adquirida vs incidental ──
t("adquirente (aparece antes de 'adquirió')", assessEntityRole("Bergé", "Bergé adquirió el 100% de Transportes Vigía").role === "acquirer");
t("adquirida (aparece después)", assessEntityRole("Transportes Vigía", "Bergé adquirió el 100% de Transportes Vigía").role === "acquired_company");
t("asset_owner (abrió su planta)", assessEntityRole("Postobón", "Postobón inauguró su nueva planta de producción en Malambo").role === "asset_owner");
t("contratista (recibió contrato)", assessEntityRole("Coordinadora", "La ANI adjudicó el contrato a Coordinadora").is_account === true);
t("mención incidental → no cuenta", assessEntityRole("Cementos Argos", "El evento contó con presencia de Cementos Argos entre los asistentes").is_account === false);
t("sujeto de cambio (invirtió)", assessEntityRole("Bavaria", "Bavaria invirtió 115.000 millones en su red de tiendas").role === "subject_of_change");

// ── Sentiment / direction (ICP decide) ──
t("insolvencia → block (hard)", classifyDirection("La empresa entró en proceso de insolvencia bajo la ley 1116").policy === "block");
t("aplaza pagos → risk/monitor", classifyDirection("Consorcio Express aplazó los pagos a sus proveedores").policy === "monitor");
t("regulación + producto de cumplimiento → proceed", classifyDirection("Nueva regulación exige reportes de emisiones", { productSolvesCompliance: true }).policy === "proceed");
t("regulación sin producto de cumplimiento → monitor", classifyDirection("Nueva regulación exige reportes de emisiones").policy === "monitor");
t("incidente + producto de monitoreo → proceed", classifyDirection("La planta sufrió una falla operativa que detuvo la producción", { productSolvesMonitoring: true }).policy === "proceed");
t("inversión positiva → proceed", classifyDirection("Bavaria invirtió 115.000 millones en expansión").policy === "proceed");

// ── Rubric v2 ──
const strong = scoreOpportunityV2({ corporate_identity_confidence: 90, icp_fit_score: 88, operational_fit: true, signal_association_ok: true, materiality: "high", corroboration: "high", causal_thesis_specific: true, days_old: 20, has_next_step: true, hard_blockers: [] });
t("caso fuerte → prioritaria", strong.verdict === "prioritaria", `score ${strong.score}`);
const noOpFit = scoreOpportunityV2({ corporate_identity_confidence: 90, icp_fit_score: 88, operational_fit: false, signal_association_ok: true, materiality: "high", corroboration: "high", causal_thesis_specific: true, days_old: 20, has_next_step: true, hard_blockers: [] });
t("sin operational_fit → rechazar (hard domina)", noOpFit.verdict === "rechazar");
const blocked = scoreOpportunityV2({ corporate_identity_confidence: 95, icp_fit_score: 95, operational_fit: true, signal_association_ok: true, materiality: "high", corroboration: "high", causal_thesis_specific: true, days_old: 5, has_next_step: true, hard_blockers: ["product_unrelated_to_event"] });
t("hard blocker → rechazar aunque score alto", blocked.verdict === "rechazar");
const mid = scoreOpportunityV2({ corporate_identity_confidence: 70, icp_fit_score: 65, operational_fit: true, signal_association_ok: true, materiality: "medium", corroboration: "medium", causal_thesis_specific: true, days_old: 40, has_next_step: true, hard_blockers: [] });
t("caso medio → investigar/monitorear (no prioritaria)", mid.verdict === "investigar" || mid.verdict === "monitorear", `${mid.verdict} ${mid.score}`);
t("materiality low → rechazar", scoreOpportunityV2({ corporate_identity_confidence: 80, icp_fit_score: 80, operational_fit: true, signal_association_ok: true, materiality: "low", corroboration: "high", causal_thesis_specific: true, days_old: 10, has_next_step: true, hard_blockers: [] }).verdict === "rechazar");

// ── Word-boundary association (caso real: "Inter" emitido sobre nota de Nu bank) ──
t("'Inter' NO matchea dentro de 'internacional'", !companyNameInText("Inter", "el banco brasileño nu apalanca su expansión internacional en eeuu"));
t("'Inter Rapidísimo' sí matchea su nombre completo", companyNameInText("Inter Rapidísimo", "la empresa Inter Rapidísimo amplió su flota en Bogotá"));
t("'Mercado' NO matchea el sustantivo común pegado", !companyNameInText("Mercado", "el mercadolibre de productos creció"));
t("'Rappi' matchea como palabra completa", companyNameInText("Rappi", "Rappi anunció su expansión en Colombia"));
t("entity-role: 'Inter' no es acquirer en nota de Nu (sin token exacto)", assessEntityRole("Inter", "El banco brasileño Nu adquirió una fintech para su expansión internacional en EEUU").is_account === false);
t("entity-role: token exacto sí funciona con boundary", assessEntityRole("Inter Rapidísimo", "Inter Rapidísimo invirtió en 200 vehículos nuevos").is_account === true);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
