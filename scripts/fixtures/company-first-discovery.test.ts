// Unit tests for the company-first discovery deterministic core:
// needs-map fallback shape + Opportunity Test fail-closed behavior.
// Run: npm run test:company-first

import { opportunityTest, type OpportunityInput } from "@/lib/discovery/opportunity-test";
import { buildNeedsMap } from "@/lib/discovery/needs-map";
import { accountRoleEligibleForOffer, buildCompanyQueries, calculateDiscoveryCost, chooseBetterCandidate, companyUrlKey, eventResultEligibleForExtraction, eventVerbPresent, isDefensibleCandidate, knownDomainIdentityConfidence, prioritizeDiscoveryPortfolio, shouldContinueCompanySearch } from "@/lib/discovery/company-first-discovery";
import { assessCatalogChannel, assessChannelAccess, buildChannelAccessQuery, channelAccessRelevant, channelAccessSearchHint, channelPageContentUsable, prioritizeChannelProofUrls } from "@/lib/discovery/channel-access";
import type { ICP, LeadSearchCriteria } from "@/types";
import { replayChannelHypotheses } from "@/lib/discovery/trace-replay";
import { applyObservedChannelDirection, evaluateChannelEvidence } from "@/lib/discovery/channel-evidence-contract";
import { adversarialReview } from "@/lib/discovery/adversarial-review";

let passed = 0, failed = 0;
const t = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : `  (${detail})`}`); ok ? passed++ : failed++; };
const daysIso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);

const good: OpportunityInput = {
  company: "Coordinadora", company_from_universe: true,
  signal_summary: "Coordinadora inauguró un nuevo centro de distribución en Bogotá",
  signal_type: "new_facility", signal_date: daysIso(20), date_confidence: "high",
  source_url: "https://www.coordinadora.com/sala-prensa/nuevo-cedi", source_type: "company_website",
  company_in_content: true, grounded: true, matches_needs_family: true, geography_confirmed: true, region_required: true,
};

// Happy path
t("empresa correcta + evento reciente + relación → opportunity", opportunityTest(good).status === "opportunity");

// Hard blockers → reject
t("publisher/place como empresa → reject", opportunityTest({ ...good, company: "Colombia" }).status === "reject");
t("señal no asociada a la empresa → reject", opportunityTest({ ...good, company_in_content: false }).status === "reject");
t("sin fuente → reject", opportunityTest({ ...good, source_url: null }).status === "reject");
t("sin evento → reject", opportunityTest({ ...good, signal_summary: null }).status === "reject");
t("claim no fundado → reject", opportunityTest({ ...good, grounded: false }).status === "reject");
t("sin fecha válida → reject", opportunityTest({ ...good, signal_date: null, date_confidence: "none" }).status === "reject");
t("señal > 180 días → reject", opportunityTest({ ...good, signal_date: daysIso(200) }).status === "reject");
t("sin relación comercial → reject", opportunityTest({ ...good, matches_needs_family: false }).status === "reject");
t("reject nombra hard blockers", opportunityTest({ ...good, company: "Bogotá" }).hard_blockers.length > 0);

// Soft flags → monitor / investigate (never opportunity)
t("señal 100 días → monitor (no opportunity)", opportunityTest({ ...good, signal_date: daysIso(100) }).status === "monitor");
t("fecha baja confianza → monitor", opportunityTest({ ...good, date_confidence: "low" }).status === "monitor");
t("empresa fuera del universo → investigate", opportunityTest({ ...good, company_from_universe: false }).status === "investigate");

// LLM never rescues a hard blocker (pure function: identity always re-checked)
t("nombre de medio con fecha perfecta → sigue reject", opportunityTest({ ...good, company: "Revista Turbo" }).status === "reject");

// New hard gates (page-type, materiality, homonym/geography)
t("página de referencia (wikipedia) → reject", opportunityTest({ ...good, source_url: "https://es.wikipedia.org/wiki/Coordinadora" }).status === "reject");
t("sin verbo de evento (solo nombre) → reject", opportunityTest({ ...good, matches_needs_family: false }).status === "reject");
t("homónimo extranjero (geo no confirmada) → reject", opportunityTest({ ...good, geography_confirmed: false }).status === "reject");
t("geo no requerida (EN) ignora el check", opportunityTest({ ...good, geography_confirmed: false, region_required: false }).status === "opportunity");
t("canal oficial sin fecha → investigate, no opportunity", opportunityTest({ ...good, signal_date: null, date_confidence: "none", matches_needs_family: false, channel_access_verified: true }).status === "investigate");
t("fecha histórica no invalida capacidad evergreen extraída en vivo", opportunityTest({ ...good, signal_date: "2018-01-25", matches_needs_family: false, channel_access_verified: true }).status === "investigate");

const buyerChannel = assessChannelAccess("Distribuimos marcas nacionales e internacionales. Conoce nuestro portal de proveedores.", true);
t("canal multimarca oficial califica", buyerChannel.qualifies && buyerChannel.status === "external_brand_channel");
t("canal multimarca nunca se presenta como compra", buyerChannel.reason.toLowerCase().includes("validar"));
t("sé nuestro distribuidor es dirección inversa", !assessChannelAccess("Sé nuestro distribuidor y distribuye nuestros productos", true).qualifies);
t("evidencia fuera del dominio oficial no califica", !assessChannelAccess("Portafolio de marcas nacionales", false).qualifies);
t("distribuidor autorizado oficial califica como canal externo", assessChannelAccess("Fitt Global - Distribuidor Autorizado", true).qualifies);
t("identidad previamente verificada evita falso ambiguous", opportunityTest({ ...good, company: "Alimentos Sostenibles", corporate_identity_verified: true }).hard_blockers.every(b => !b.startsWith("identity_")));
t("capacidad de canal aplica a productos/retail", channelAccessRelevant("functional beverage brand seeking retail distribution"));
t("portal de proveedores no se activa para SaaS genérico", !channelAccessRelevant("software de gestión de flotas y telemetría"));
t("consulta de acceso se localiza en inglés", buildChannelAccessQuery("example.com", "en").includes("vendor onboarding"));
t("consulta retail conserva amplitud compatible entre proveedores", buildChannelAccessQuery("example.co", "es").includes("proveedores marcas") && !buildChannelAccessQuery("example.co", "es").includes(" OR "));
t("shell SPA 404 no cuenta como página comercial viva", !channelPageContentUsable('<div data-loc="client/src/pages/NotFound.tsx:14"><h1>404</h1><h2>Page not found</h2></div>'));
t("catálogo oficial real sí cuenta como página viva", channelPageContentUsable("Catálogo oficial de productos naturales con múltiples marcas disponibles en Colombia y opciones de compra para clientes."));
t("hospitality usa procurement y F&B, no distribuidor autorizado", buildChannelAccessQuery("hotel.co", "es", "hospitality_operator").includes("abastecimiento") && !buildChannelAccessQuery("hotel.co", "es", "hospitality_operator").includes("distribuidor autorizado"));
t("authorized distributor en dominio oficial califica", assessChannelAccess("We are an authorized distributor of leading brands", true).qualifies);
t("become our distributor mantiene dirección inversa", !assessChannelAccess("Become our distributor and distribute our products", true).qualifies);
t("nuestras marcas por sí solo no demuestra apertura externa", !assessChannelAccess("Conoce nuestras marcas y productos", true).qualifies);
t("dirección comercial conflictiva exige evidencia adicional", !assessChannelAccess("Sé nuestro distribuidor. También somos distribuidor autorizado.", true).qualifies);
t("distribuidor oficial de categoría califica como capacidad, no intención", assessChannelAccess("Somos distribuidora de suplementos y productos naturales", true).qualifies);
t("contacto para distribuidores mantiene dirección vendedora", !assessChannelAccess("Contacto para distribuidores y ventas de nuestros productos", true).qualifies);
const catalog = assessCatalogChannel({ company: "Supernat", domain: "supermercadonaturista.com", results: [
  { title: "Comprar Productos Homeopáticos Labfarve", url: "https://supermercadonaturista.com/13_labfarve" },
  { title: "Tienda de Productos Jaquin De Francia", url: "https://supermercadonaturista.com/9_jaquin" },
  { title: "Comprar Productos Biopronat Online", url: "https://supermercadonaturista.com/22_biopronat" },
] });
t("catálogo oficial con varias marcas prueba canal multimarca", catalog.qualifies && catalog.confidence === "high");
const taxonomyCatalog = assessCatalogChannel({ company: "Moli Natural", domain: "molinatural.com", results: [
  { title: "Prame Archivos - Moli Natural", url: "https://molinatural.com/marca/prame" },
  { title: "Millenium Natural Systems Archivos - Moli Natural", url: "https://molinatural.com/marca/millenium-natural-systems" },
] });
t("taxonomías oficiales de marcas recuperan catálogo dinámico", taxonomyCatalog.qualifies && taxonomyCatalog.evidence_urls?.length === 2);
const replay = replayChannelHypotheses([
  { company: "Fitt Global", round: 1, query_kind: "channel_access", query: "site:fittglobal.com proveedores marcas", results: [{ title: "Fitt Global | Distribuidora de suplementos y productos naturales", url: "https://fittglobal.com/empresa", provider: "test" }] },
  { company: "Supernat", round: 1, query_kind: "channel_access", query: "site:supermercadonaturista.com proveedores marcas", results: [
    { title: "Comprar Productos Labfarve", url: "https://supermercadonaturista.com/13_labfarve", provider: "test" },
    { title: "Tienda de Productos Biopronat", url: "https://supermercadonaturista.com/22_biopronat", provider: "test" },
  ] },
]);
t("replay offline recupera capacidad y catálogo sin emitir producción", replay.length === 2 && replay.every(x => x.status === "requires_live_revalidation"));
const rejectedReplayIdentity = replayChannelHypotheses([{
  company: "Natural", round: 1, query_kind: "channel_access", query: "site:naturalmente.com.co distribuidor suplementos",
  results: [{ title: "Distribuidor de suplementos naturales", url: "https://naturalmente.com.co/", provider: "test" }],
}]);
t("replay no resucita identidades genéricas de trazas antiguas", rejectedReplayIdentity.length === 0);
const supplierProof = evaluateChannelEvidence({ assessment: assessChannelAccess("Portal de registro de proveedores de bebidas y nuevas marcas", true), offerContext: "bebida funcional natural", extractedOfficialPage: true });
t("intake de proveedores compatible obtiene evidencia fuerte", supplierProof.eligible && supplierProof.grade === "strong" && supplierProof.score_cap === 90);
const portfolioProof = evaluateChannelEvidence({ assessment: catalog, offerContext: "bebida funcional natural", extractedOfficialPage: true });
t("catálogo multimarca es moderado y no intención de compra", portfolioProof.grade === "moderate" && portfolioProof.limitations.includes("portfolio_proves_channel_operation_not_supplier_openness"));
const capabilityProof = evaluateChannelEvidence({ assessment: assessChannelAccess("Somos distribuidora de suplementos y productos naturales", true), offerContext: "bebida funcional natural", extractedOfficialPage: true });
t("capacidad general de distribución queda preliminar", capabilityProof.grade === "preliminary" && capabilityProof.score_cap === 72);
t("dirección vendedora previa bloquea capacidad genérica posterior", !applyObservedChannelDirection(capabilityProof, true).eligible && applyObservedChannelDirection(capabilityProof, true).blockers.some(b => b.includes("seller_direction")));
t("dirección vendedora no borra catálogo externo verificable", applyObservedChannelDirection(portfolioProof, true).eligible);
const metadataOnly = evaluateChannelEvidence({ assessment: catalog, offerContext: "bebida funcional natural", extractedOfficialPage: false });
t("snippets sin extracción oficial no califican", !metadataOnly.eligible && metadataOnly.blockers.includes("no_live_official_page_extracted"));
const proofFirst = prioritizeChannelProofUrls([
  { canonical_url: "https://x.co/noticia" }, { canonical_url: "https://x.co/marca-a" }, { canonical_url: "https://x.co/inicio" },
], ["https://x.co/marca-a"]);
t("evidencia de catálogo recibe el slot de extracción", proofFirst[0]?.canonical_url === "https://x.co/marca-a");
t("hipótesis preliminar obliga segunda ronda incluso en preview", shouldContinueCompanySearch({ cand: { id: "p", company: "P", source: "public_signal", confidence_score: 0.72, opportunity_kind: "channel_fit", channel_evidence_grade: "preliminary" }, score: 72 }, "preview"));
t("evidencia moderada permite cerrar preview", !shouldContinueCompanySearch({ cand: { id: "m", company: "M", source: "public_signal", confidence_score: 0.82, opportunity_kind: "channel_fit", channel_evidence_grade: "moderate" }, score: 82 }, "preview"));
const portfolio = prioritizeDiscoveryPortfolio([
  { id: "p", company: "Preliminar", source: "public_signal", confidence_score: 0.9, opportunity_kind: "channel_fit", channel_evidence_grade: "preliminary" },
  { id: "d", company: "Defendible", source: "public_signal", confidence_score: 0.7, opportunity_kind: "channel_fit", channel_evidence_grade: "moderate" },
], 1);
t("monitor con score alto no desplaza oportunidad defendible", portfolio[0]?.company === "Defendible" && isDefensibleCandidate(portfolio[0]));
const replaced = chooseBetterCandidate(
  { cand: { id: "p", company: "Preliminar", source: "public_signal", confidence_score: 0.9, opportunity_kind: "channel_fit", channel_evidence_grade: "preliminary" }, score: 72 },
  { cand: { id: "e", company: "Evento", source: "public_signal", confidence_score: 0.68, opportunity_kind: "timing_signal" }, score: 68 },
);
t("evento defendible reemplaza hipótesis preliminar aunque tenga menor score", replaced.cand.company === "Evento");
t("misma URL se deduplica por empresa y puede evaluarse para otra cuenta", companyUrlKey("Empresa A", "https://news.co/x") !== companyUrlKey("Empresa B", "https://news.co/x") && companyUrlKey("Empresa A", "https://news.co/x") === companyUrlKey("empresa a", "https://news.co/x"));
t("marca curada con dominio no homónimo conserva identidad suficiente", knownDomainIdentityConfidence({ lexical_score: 25, origin: "vertical_seed", official_page_observes_name: false }) === 70);
t("nombre observado en página oficial fortalece marca–dominio sin exceder cap", knownDomainIdentityConfidence({ lexical_score: 25, origin: "vertical_seed", official_page_observes_name: true }) === 82);
t("dominio dinámico sin nombre observado no recibe confianza gratis", knownDomainIdentityConfidence({ lexical_score: 25, origin: "dynamic_enumeration", official_page_observes_name: false }) === 25);
const curatedBrandReview = adversarialReview({ company: "Supernat", identity_confidence: 70, domain: "supermercadonaturista.com", organization_eligible: true, entity_role_is_account: true, signal_association_ok: true, materiality: "medium", operational_fit: true, commercial_fit_score: 100, causal_thesis_specific: true, corroboration: "low", days_old: null, has_next_step: true, counterevidence: null, generator_verdict: "monitorear" });
t("marca curada no es rechazada sólo por dominio no homónimo", curatedBrandReview.verdict !== "reject");
t("resultado de evento de otra empresa no consume extracción", !eventResultEligibleForExtraction("Fitt Global", "event", "Prochampions abre nueva tienda en Bogotá", "Expansión del retail deportivo"));
t("empresa asociada en snippet sí permite validar el evento", eventResultEligibleForExtraction("Fitt Global", "event", "Nueva apertura en Bogotá", "Fitt Global anunció la expansión"));
t("página de canal sigue elegible antes de extracción", eventResultEligibleForExtraction("Fitt Global", "channel_access", "Distribuidora de suplementos", null));
t("oferta física no gasta búsqueda en fabricante o seller network", !accountRoleEligibleForOffer("brand_owner", true) && !accountRoleEligibleForOffer("seller_network", true));
t("buyer channel y hospitality permanecen elegibles", accountRoleEligibleForOffer("buyer_channel", true) && accountRoleEligibleForOffer("hospitality_operator", true));
t("ranking prefiere portal de proveedores sobre producto", channelAccessSearchHint("Portal de proveedores", "https://x.co/proveedores") > channelAccessSearchHint("Bebida natural", "https://x.co/products/bebida"));

// Needs map fallback shape (no LLM)
(async () => {
  const icp: ICP = { target_industries: ["logística"], target_titles: [], company_size_range: "50-500", pain_points: [], disqualifiers: ["entidades públicas"], ideal_signals: ["nueva bodega", "crecimiento de flota"] };
  const criteria = { target_industries: ["logística"], target_geography: ["Colombia"], target_company_size: ["50-500"], buying_signals: ["nueva bodega", "crecimiento de flota"], disqualification_criteria: ["entidades públicas"], offer_summary: "software de flotas", value_proposition: "reduce costos", output_language: "es", target_market_region: "latin_america" } as unknown as LeadSearchCriteria;
  const orig = process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_API_KEY;
  const map = await buildNeedsMap(icp, criteria);
  if (orig) process.env.ANTHROPIC_API_KEY = orig;
  t("needs map: versión presente", map.version === "needs-map-v1");
  t("needs map: familias no vacías", map.relevant_signal_families.length > 0);
  // Sin LLM, el vertical pack (logistics_automation) provee las señales — vienen
  // como frases exactas de búsqueda ('"nueva bodega"'). Contención, no igualdad.
  t("needs map: señales observables desde ICP", map.observable_signals.some((s) => s.includes("nueva bodega")));
  const wellnessNeeds = { ...map, buyer_problem: "expandir bebidas funcionales en retail", expected_need: "nuevos canales wellness", target_company_profile: "retail de productos naturales" };
  const accessFirst = buildCompanyQueries("Canal X", "canalx.co", map, true, 1, false, true);
  const eventRescue = buildCompanyQueries("Canal X", "canalx.co", map, true, 1, true, true);
  const hotelAccess = buildCompanyQueries("Hotel X", "hotelx.co", wellnessNeeds, true, 1, false, true, "hospitality_operator");
  const hotelEvent = buildCompanyQueries("Hotel X", "hotelx.co", wellnessNeeds, true, 1, true, true, "hospitality_operator");
  t("producto/canal busca acceso comercial primero", accessFirst[0].startsWith("site:canalx.co"));
  const thisYear = new Date().getFullYear();
  t("segunda ronda usa señal causal específica, no anuncio genérico", !eventRescue[0].startsWith("site:") && !eventRescue[0].includes("anuncio comunicado"));
  t("ventana de año cubre eventos recientes que cruzan calendario", eventRescue[0].includes(String(thisYear)) && eventRescue[0].includes(String(thisYear - 1)));
  t("validador reconoce la misma señal wellness que busca", eventVerbPresent("Canal X abrió una nueva tienda en Bogotá", wellnessNeeds, true));
  t("palabra estática de retail no se convierte en evento", !eventVerbPresent("Canal X es una tienda de retail", wellnessNeeds, true));
  t("hotel busca procurement en primera ronda", hotelAccess[0].includes("abastecimiento"));
  t("hotel rescata apertura hotelera, no nueva tienda", hotelEvent[0].includes("apertura de hotel") && !hotelEvent[0].includes("nueva tienda"));
  t("validador reconoce apertura hotelera buscada", eventVerbPresent("Hotel X anunció la apertura de hotel en Cartagena", wellnessNeeds, true));
  t("cost model: 24 queries + 18 extractions + 5 enumeration = $0.212", calculateDiscoveryCost(24, 18, 5) === 0.212);

  console.log(`\n${passed}/${passed + failed} passed`);
  process.exit(failed ? 1 : 0);
})();
