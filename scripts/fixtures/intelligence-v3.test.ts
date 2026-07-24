// Unit tests: commercial-fit, entity-role, sentiment/direction, rubric v2.
// Exact cases from the intelligence-quality sprint prompt.
// Run: npm run test:intelligence-v3

import { assessCommercialFit, disqualifierMatches, requiredOperationTerms } from "@/lib/discovery/commercial-fit";
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
t("familia de necesidades no rescata oferta sin relación explícita", noOp.hard_blockers.includes("product_unrelated_to_event"));
const categoryBacked = assessCommercialFit({ needs: fleetNeeds, company: "CanalX", sector: "retail", content: "canalx opera distribución nacional en colombia", event_keyword: "distribución", disqualifiers: [], product_terms: ["bebida funcional"], required_operation_terms: ["distribución"], channel_category_alignment: "confirmed", geography_confirmed: true });
t("evidencia de categoría confirmada sustenta relación de producto", !categoryBacked.hard_blockers.includes("product_unrelated_to_event"));
const noGeo = assessCommercialFit({ needs: fleetNeeds, company: "CanalY", sector: "retail", content: "canaly opera flota y rutas", event_keyword: "flota", disqualifiers: [], product_terms: ["flota"], required_operation_terms: ["flota"], geography_confirmed: false });
t("fit no concede puntos geográficos sin evidencia", noGeo.hard_blockers.includes("geography_not_evidenced_for_fit") && noGeo.breakdown.geography === 0);
const disq = assessCommercialFit({ needs: fleetNeeds, company: "Competidor", sector: "software", content: "competidor es una empresa de software de logística".toLowerCase(), event_keyword: null, disqualifiers: ["software de logística"], product_terms: ["flota"], required_operation_terms: requiredOperationTerms(fleetNeeds) });
t("disqualifier del ICP → hard blocker", disq.hard_blockers.some((h) => h.startsWith("icp_disqualifier")));
t("score no compensa hard blocker (score alto pero bloqueado)", outsourced.hard_blockers.length > 0);
t("compound disqualifier does not fire on one generic word", !disqualifierMatches("sprouts opened a food store in florida", "food and beverage fully controlled by an unrelated third party"));
t("compound disqualifier fires on substantive evidence", disqualifierMatches("the food and beverage program is controlled by a third party operator", "food and beverage fully controlled by an unrelated third party"));
const wellnessNeeds = { target_company_profile: "US wellness retailers, spas and resorts", expected_need: "functional beverages", relevant_signal_families: ["new_facility", "expansion"] } as unknown as NeedsMap;
t("wellness new-facility requires channel terms, not warehouse terms", requiredOperationTerms(wellnessNeeds).includes("store") && !requiredOperationTerms(wellnessNeeds).includes("bodega"));

// ── Entity role: adquirente vs adquirida vs incidental ──
t("adquirente (aparece antes de 'adquirió')", assessEntityRole("Bergé", "Bergé adquirió el 100% de Transportes Vigía").role === "acquirer");
t("adquirida (aparece después)", assessEntityRole("Transportes Vigía", "Bergé adquirió el 100% de Transportes Vigía").role === "acquired_company");
t("asset_owner (abrió su planta)", assessEntityRole("Postobón", "Postobón inauguró su nueva planta de producción en Malambo").role === "asset_owner");
t("contratista (recibió contrato)", assessEntityRole("Coordinadora", "La ANI adjudicó el contrato a Coordinadora").is_account === true);
t("mención incidental → no cuenta", assessEntityRole("Cementos Argos", "El evento contó con presencia de Cementos Argos entre los asistentes").is_account === false);
t("sujeto de cambio (invirtió)", assessEntityRole("Bavaria", "Bavaria invirtió 115.000 millones en su red de tiendas").role === "subject_of_change");
t("English store opening → asset_owner", assessEntityRole("Sprouts Farmers Market", "Sprouts Farmers Market Opens New Store in Daytona Beach, Florida").role === "asset_owner");
t("English partnership → partner", assessEntityRole("Canyon Ranch", "Canyon Ranch announced a wellness partnership with a botanical beverage brand").role === "partner");
t("English incidental mention remains rejected", assessEntityRole("Sprouts Farmers Market", "Analysts discussed retail expansion and later compared margins at Sprouts Farmers Market").is_account === false);
t("apertura en presente → asset_owner", assessEntityRole("Olímpica", "Olímpica abre una nueva tienda en Chía").role === "asset_owner");

// ── Sentiment / direction (ICP decide) ──
t("insolvencia → block (hard)", classifyDirection("La empresa entró en proceso de insolvencia bajo la ley 1116").policy === "block");
t("liquidación de inventario retail no simula quiebra", classifyDirection("Productos en liquidación de temporada").policy !== "block");
t("liquidación judicial de la empresa sí bloquea", classifyDirection("Comenzó la liquidación judicial de la empresa").policy === "block");
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

// ── Vertical packs (vertical-packs-v1): fallback determinístico + moat ──
import { matchVerticalPack, packNeedsMap, VERTICAL_PACKS } from "@/lib/discovery/vertical-packs";
{
  const icpF = { target_industries: ["transporte de carga y logística"], target_titles: [], company_size_range: "m", pain_points: [], disqualifiers: [], ideal_signals: [] } as any;
  const crF = { offer_summary: "software de gestión de flotas", value_proposition: "visibilidad de flota", target_geography: ["Colombia"], output_language: "es" } as any;
  const p = matchVerticalPack(icpF, crF);
  t("ICP flotas matchea pack fleet_software", p?.id === "fleet_software");
  const nm = p ? packNeedsMap(p, icpF, crF) : null;
  t("pack needs-map trae familias causales reales", !!nm && nm.relevant_signal_families.includes("fleet_growth"));
  t("pack needs-map trae señales observables ES", !!nm && nm.observable_signals.some((s) => s.includes("flota")));
  const icpL = { target_industries: ["operadores logísticos y retail con centros de distribución"], target_titles: [], company_size_range: "m", pain_points: [], disqualifiers: [], ideal_signals: [] } as any;
  t("ICP logística matchea logistics_automation", matchVerticalPack(icpL, { offer_summary: "automatización de bodegas", value_proposition: "", target_geography: ["Colombia"], output_language: "es" } as any)?.id === "logistics_automation");
  t("ICP sin match → null", matchVerticalPack({ target_industries: ["clínicas dentales"], target_titles: [], company_size_range: "m", pain_points: [], disqualifiers: [], ideal_signals: [] } as any, { offer_summary: "agendas médicas", value_proposition: "", target_geography: ["Colombia"], output_language: "es" } as any) === null);
  t("todos los packs tienen ≥12 seeds reales", VERTICAL_PACKS.every((pk) => pk.seed_companies.length >= 12));
  t("ningún seed es nombre ambiguo de 1 token genérico", VERTICAL_PACKS.every((pk) => pk.seed_companies.every((s) => !/^(inter|mercado|carga|estas)$/i.test(s.name))));
}

console.log(`
${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

// ── Rol por atribución de instalación (caso real CEDI Falabella, run provider-limited 2026-07-22) ──
t("'CEDI Falabella' → asset_owner", assessEntityRole("Falabella de Colombia", "Proyecto: pavimento industrial para el CEDI Falabella en Cota, Cundinamarca").role === "asset_owner");
t("'planta de Postobón' → asset_owner", assessEntityRole("Postobón", "Ampliación de la planta de Postobón en Malambo").role === "asset_owner");
t("atribución NO rescata otras empresas (Claro sponsor sigue incidental)", assessEntityRole("Inter Rapidísimo", "Claro, de Carlos Slim, es el nuevo patrocinador de la Selección Colombia").is_account === false);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
