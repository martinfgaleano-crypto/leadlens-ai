import { evaluateDiscoveryValue } from "@/lib/discovery/company-first-discovery";
import { enumerationQueries, inferEnumeratedCountry, inferEnumeratedDomain, prioritizeUniverse, rejectEnumeratedName, type UniverseCompany } from "@/lib/discovery/company-universe";
import { matchVerticalPack } from "@/lib/discovery/vertical-packs";
import type { ICP, LeadSearchCriteria } from "@/types";
import { buildAccountThesis } from "@/lib/discovery/account-thesis";
import { assessChannelAccess } from "@/lib/discovery/channel-access";
import { evaluateUniverseQuality } from "@/lib/discovery/universe-quality";
import { inferAccountCommercialRole } from "@/lib/discovery/account-role";

let passed = 0;
const test = (name: string, condition: boolean) => { if (!condition) throw new Error(`FAIL: ${name}`); passed++; console.log(`PASS: ${name}`); };
const base = { name: "x", domain: null, country: "Colombia", region: "latin_america", sector: "wellness", discovery_source: "test", confidence: "verified", fit_reason: "test" } as const;
test("obvious account + generic opening has low discovery value", evaluateDiscoveryValue({ ...base, name: "Carulla", visibility_tier: "obvious" }, "Carulla abre una nueva tienda").level === "low");
test("obvious account needs a non-obvious category angle", evaluateDiscoveryValue({ ...base, name: "Carulla", visibility_tier: "obvious" }, "Carulla incorporó una nueva categoría de bebidas funcionales").level === "medium");
test("emerging specialist has high discovery value", evaluateDiscoveryValue({ ...base, name: "BioPlaza", visibility_tier: "emerging" }, "BioPlaza abre un nuevo canal de distribución").level === "high");
const icp = { target_industries: ["retail wellness"], target_titles: [], company_size_range: "mid", pain_points: [], disqualifiers: [], ideal_signals: [] } as ICP;
const criteria = { target_geography: ["Colombia"], target_industries: icp.target_industries, offer_summary: "bebidas herbales de bienestar", value_proposition: "bienestar natural" } as LeadSearchCriteria;
const pack = matchVerticalPack(icp, criteria);
test("Colombia pack prioritizes non-obvious seeds", pack?.seed_companies.slice(0, 5).every(seed => seed.visibility_tier !== "obvious") === true);
test("Colombia pack keeps obvious accounts only as later benchmarks", (pack?.seed_companies.findIndex(seed => seed.visibility_tier === "obvious") ?? -1) >= 10);
const u = (name: string, origin: "vertical_seed" | "dynamic_enumeration", visibility?: "emerging" | "established" | "obvious", domain: string | null = null): UniverseCompany => ({ name, domain, country: "Colombia", country_confidence: origin === "vertical_seed" ? "verified_pack" : "high", country_evidence: "test", region: "latin_america", sector: "wellness", discovery_source: "test", confidence: domain ? "verified" : "plausible", fit_reason: "test", universe_origin: origin, visibility_tier: visibility });
const portfolio = prioritizeUniverse([
  u("Seed A", "vertical_seed", "emerging", "a.co"), u("Seed B", "vertical_seed", "established", "b.co"),
  u("Dynamic A", "dynamic_enumeration"), u("Dynamic B", "dynamic_enumeration"),
  u("Obvious A", "vertical_seed", "obvious", "o.co"),
], 4);
test("universo reserva capacidad para descubrimiento dinámico", portfolio.filter(c => c.universe_origin === "dynamic_enumeration").length >= 1);
test("cuentas obvias sólo entran como backfill", !portfolio.some(c => c.visibility_tier === "obvious"));
test("universo conserva mezcla de conocimiento y exploración", portfolio.some(c => c.universe_origin === "vertical_seed") && portfolio.some(c => c.universe_origin === "dynamic_enumeration"));
test("clasificador separa hospitality de fabricante", inferAccountCommercialRole("cadena hotelera con spa y alimentos y bebidas").role === "hospitality_operator" && inferAccountCommercialRole("laboratorio fabricante de suplementos").role === "brand_owner");
test("reclutamiento de distribuidores es seller network", inferAccountCommercialRole("sé nuestro distribuidor y distribuye nuestros productos").role === "seller_network");
const wellnessQueries = enumerationQueries(icp, "Colombia", { version: "needs-map-v1", buyer_problem: "surtido wellness", operational_triggers: [], observable_signals: [], expected_need: "bebidas funcionales", target_company_profile: "retail hoteles spa", disqualifiers: [], relevant_signal_families: ["expansion"], possible_commercial_action: "validar" }, true);
test("enumeración wellness parte de categoría + región y cubre buyers/hospitality", wellnessQueries[0]?.includes("empresas compran venden distribuyen") === true && wellnessQueries[0]?.includes("Colombia") === true && wellnessQueries.some(q => q.includes("Bogotá Medellín Cali")) && wellnessQueries.some(q => q.includes("hoteles boutique")) && wellnessQueries.length === 5);
const rolePortfolio = prioritizeUniverse([
  { ...u("Canal A", "vertical_seed", "emerging", "canal-a.co"), account_role: "buyer_channel" },
  { ...u("Canal B", "vertical_seed", "emerging", "canal-b.co"), account_role: "buyer_channel" },
  { ...u("Hotel Regional", "vertical_seed", "established", "hotel.co"), account_role: "hospitality_operator" },
  { ...u("Resort Regional", "vertical_seed", "established", "resort.co"), account_role: "hospitality_operator" },
  { ...u("Dinámica", "dynamic_enumeration", undefined, "dinamica.co"), account_role: "unknown" },
], 5);
test("portafolio protege hospitality frente a monocultivo de distribuidores", rolePortfolio.filter(c => c.account_role === "hospitality_operator").length === 2);
const thesis = buildAccountThesis({ company: "Canal X", offer: "bebidas funcionales", needs: { version: "needs-map-v1", buyer_problem: "surtido", operational_triggers: [], observable_signals: [], expected_need: "bebidas", target_company_profile: "retail", disqualifiers: [], relevant_signal_families: ["partnership"], possible_commercial_action: "validar" }, title: "Canal X", signalDate: null, channelAccess: assessChannelAccess("Distribuimos marcas nacionales e internacionales", true), discoveryOrigin: "dynamic_enumeration" });
test("tesis separa hecho de límite de evidencia", thesis.observed_fact.includes("declara") && thesis.evidence_limit.includes("no intención de compra"));
test("tesis siempre produce una pregunta falsable", thesis.validation_question.startsWith("¿") && thesis.validation_question.endsWith("?"));
test("tesis identifica valor del descubrimiento dinámico", thesis.replicability_edge.includes("fuera del prior"));
const inferred = inferEnumeratedDomain("Vida Natural", [
  { title: "Vida Natural | productos saludables", snippet: "Sitio oficial", url: "https://vidanatural.co/nosotros" },
  { title: "Directorio: Vida Natural", snippet: "Listado", url: "https://directorioempresas.co/vida-natural" },
]);
test("procedencia dinámica infiere dominio sólo por coincidencia corporativa", inferred.domain === "vidanatural.co");
test("directorio nunca se convierte en dominio corporativo", inferEnumeratedDomain("Vida Natural", [{ title: "Vida Natural", snippet: "empresa", url: "https://directorio.com/vida-natural" }]).domain === null);
test("procedencia conserva fuente aunque dominio no sea verificable", inferEnumeratedDomain("Marca X", [{ title: "Expositores incluyen Marca X", snippet: "feria", url: "https://asociacion.org/expositores" }]).source?.includes("asociacion.org") === true);
const diverseQuality = evaluateUniverseQuality(portfolio);
test("calidad del universo mide proporción dinámica", diverseQuality.dynamic_ratio === 0.5);
test("universo mixto sin obvios pasa diversidad", diverseQuality.status === "diverse");
test("universo estático se marca débil", evaluateUniverseQuality([u("A", "vertical_seed"), u("B", "vertical_seed"), u("C", "vertical_seed"), u("D", "vertical_seed"), u("E", "vertical_seed")]).status === "weak");
test("frase comercial genérica no entra como empresa", rejectEnumeratedName("Productos Naturales") === "generic_commercial_phrase");
test("fragmento de navegación no entra como empresa", rejectEnumeratedName("ÉNES SOMOS") === "navigation_fragment");
test("marca distintiva sí puede entrar", rejectEnumeratedName("Bionaturales") === null);
test("token natural no apropia dominio de otra empresa", inferEnumeratedDomain("Natural Light", [{ title: "Natural + Mente", snippet: "productos naturales", url: "https://naturalmente.com.co" }]).domain === null);
test("ciudad no convierte directorio de hoteles en dominio corporativo", inferEnumeratedDomain("W Bogota", [{ title: "W Bogota hotel spa", snippet: "Hotel en Bogotá", url: "https://bogota.spahotels.guru/es" }]).domain === null);
test("palabra naturista no apropia dominio de otra tienda", inferEnumeratedDomain("Tienda Naturista Neem", [{ title: "Tienda Naturista Neem", snippet: "Tienda naturista", url: "https://tiendanaturistacolombia.com" }]).domain === null);
test("búsqueda regional no inventa país sin evidencia", inferEnumeratedCountry("Marca X", [{ title: "Marca X", snippet: "Productos naturales", url: "https://marcax.com" }], "Colombia").country === null);
test("empresa y Colombia en la misma fuente confirman país", inferEnumeratedCountry("Marca X", [{ title: "Marca X Colombia", snippet: "Operamos en Bogotá", url: "https://marcax.com" }], "Colombia").confidence === "high");
test("dominio .co asociado confirma país con confianza media", inferEnumeratedCountry("Marca X", [{ title: "Marca X", snippet: "Tienda oficial", url: "https://marcax.co" }], "Colombia").confidence === "medium");
test("gate del universo exige país demostrado", evaluateUniverseQuality([u("A", "vertical_seed"), u("B", "vertical_seed"), u("C", "vertical_seed"), { ...u("D", "dynamic_enumeration"), country: null, country_confidence: "unknown" }, { ...u("E", "dynamic_enumeration"), country: null, country_confidence: "unknown" }]).blockers.includes("low_country_evidence_coverage"));
const sellerUniverse = [
  { ...u("Fabricante A", "vertical_seed", "emerging", "fa.co"), account_role: "brand_owner" as const },
  { ...u("Red B", "vertical_seed", "emerging", "rb.co"), account_role: "seller_network" as const },
  { ...u("Fabricante C", "vertical_seed", "emerging", "fc.co"), account_role: "brand_owner" as const },
  { ...u("Canal D", "dynamic_enumeration", "emerging", "cd.co"), account_role: "buyer_channel" as const },
  { ...u("Canal E", "dynamic_enumeration", "emerging", "ce.co"), account_role: "buyer_channel" as const },
];
test("universo dominado por vendedores se bloquea", evaluateUniverseQuality(sellerUniverse).status === "weak" && evaluateUniverseQuality(sellerUniverse).blockers.includes("low_buyer_side_coverage"));
const buyerUniverse = sellerUniverse.map((company, i) => ({ ...company, account_role: (i < 3 ? "buyer_channel" : "hospitality_operator") as "buyer_channel" | "hospitality_operator" }));
test("universo comprador diverso expone métricas de rol", evaluateUniverseQuality(buyerUniverse).buyer_side_ratio === 1 && evaluateUniverseQuality(buyerUniverse).buyer_role_diversity === 2);
console.log(`\n${passed}/33 discovery-value assertions passed.`);
