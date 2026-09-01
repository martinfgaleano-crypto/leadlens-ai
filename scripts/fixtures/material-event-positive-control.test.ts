import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifySignalKind } from "@/lib/discovery/event-vs-metric";
import { classifyMateriality } from "@/lib/discovery/materiality";

/**
 * Diagnostic-only material-event corpus. These are real public announcements,
 * not production candidates, Evidence, Memory, Vault entries or forced Cases.
 * A record proves only that a material event exists at the bound source.
 */
const corpus = [
  {
    company: "Nestlé USA", domain: "nestleusa.com", country: "United States", event_type: "DISTRIBUTION_EXPANSION", event_date: "2026-06-10", geography: "Arvin, California",
    primary_source: "https://www.nestleusa.com/media/pressreleases/largest-distribution-center-arvin",
    claim: "Nestlé USA opened its largest distribution center in Arvin, California.", relevance: "A new distribution center changes warehouse and inventory operations.",
  },
  {
    company: "Conagra Brands", domain: "conagrabrands.com", country: "United States", event_type: "CAPACITY_EXPANSION", event_date: "2026-03-06", geography: "Fayetteville, Arkansas",
    primary_source: "https://www.conagrabrands.com/news-room/news-conagra-brands-to-expand-manufacturing-operations-in-fayetteville-arkansas",
    claim: "Conagra Brands announced plans to expand its Fayetteville manufacturing operations with a $220 million investment.", relevance: "A committed manufacturing expansion can create automation and integration scope.",
  },
  {
    company: "Quad", domain: "quad.com", country: "United States", event_type: "FACILITY_OPENING", event_date: "2026-07-16", geography: "Salt Lake City, Utah",
    primary_source: "https://www.quad.com/newsroom/quad-expands-packaging-operations",
    claim: "Quad is expanding its packaging operations with a new 100,000-square-foot facility in Salt Lake City.", relevance: "A new packaging facility changes equipment and production operations.",
  },
  {
    company: "voestalpine", domain: "voestalpine.com", country: "Austria", event_type: "FACILITY_EXPANSION", event_date: "2026-06-18", geography: "Donawitz, Austria",
    primary_source: "https://www.voestalpine.com/group/en/media/press-releases/2026-06-18-voestalpine-unveils-further-expansion-plans-for-greentec-steel-at-its-donawitz-location",
    claim: "voestalpine announced plans to expand its Donawitz production facility with a major investment.", relevance: "The facility expansion changes industrial production infrastructure.",
  },
  {
    company: "Hitachi Energy", domain: "hitachienergy.com", country: "United States", event_type: "CAPEX", event_date: "2026-06-29", geography: "South Boston, Virginia",
    primary_source: "https://www.hitachienergy.com/us/en/news-and-events/press-releases/2026/06/hitachi-energy-breaks-ground-on-the-nation-s-largest-facility-for-the-production-of-large-power-transformers-in-south-boston-virginia",
    claim: "Hitachi Energy broke ground on a major expansion of its South Boston transformer facility backed by a $457 million investment.", relevance: "A large industrial expansion can require integration, commissioning and automation.",
  },
  {
    company: "John Deere", domain: "deere.com", country: "United States", event_type: "FACILITY_OPENING", event_date: "2026-01-29", geography: "United States",
    primary_source: "https://www.deere.com/en-us/john-deere-news/two-new-us-facilities",
    claim: "John Deere announced plans to open two new United States facilities, a factory and a distribution center.", relevance: "New production and distribution facilities change operating capacity.",
  },
  {
    company: "UFP Industries", domain: "ufpi.com", country: "United States", event_type: "ACQUISITION", event_date: "2025-06-17", geography: "Twin Falls, Idaho",
    primary_source: "https://ufpi.com/ufp-factory-built-enhances-national-reach-with-addition-of-new-western-facilities/",
    claim: "UFP Factory Built acquired the Twin Falls facility to add regional service and capacity and expand its western footprint.", relevance: "An acquired operating facility changes network capacity and integration needs.",
  },
  {
    company: "Mondi", domain: "mondigroup.com", country: "United States", event_type: "FACILITY_OPENING", event_date: "2026-04-22", geography: "Pittsburgh, Pennsylvania",
    primary_source: "https://www.mondigroup.com/news-and-insight/2026/mondi-opens-new-paper-bags-plant-in-pittsburgh-pennsylvania-to-support-growing-ecommerce-and-industrial-customer-demand/",
    claim: "Mondi opened a new paper bags plant in Pittsburgh, Pennsylvania.", relevance: "A new packaging plant creates production and material-flow operations.",
  },
  {
    company: "DHL Supply Chain", domain: "dhl.com", country: "United States", event_type: "DISTRIBUTION_EXPANSION", event_date: "2026-08-20", geography: "United States and Canada",
    primary_source: "https://www.dhl.com/us-en/home/press/press-archive/2026/dhl-supply-chain-expands-service-logistics-capabilities-to-accelerate-data-center-infrastructure-parts-delivery.html",
    claim: "DHL Supply Chain expanded its service logistics network to more than 150 locations across the United States and Canada.", relevance: "A 150-location network creates inventory and orchestration complexity.",
  },
  {
    company: "SunOpta", domain: "sunopta.com", country: "United States", event_type: "CAPACITY_EXPANSION", event_date: "2026-06-01", geography: "Omak, Washington",
    primary_source: "https://www.sunopta.com/one-more-line-lots-more-snacks-sunopta-expands-production-in-omak/",
    claim: "SunOpta expanded its production capacity in Omak with a new fruit-snacks production line and a $25 million investment.", relevance: "A new production line changes plant capacity and operating flow.",
  },
  {
    company: "Amazon", domain: "aboutamazon.com", country: "United States", event_type: "FACILITY_OPENING", event_date: "2026-08-19", geography: "Austin, Texas",
    primary_source: "https://press.aboutamazon.com/2026/8/amazon-announces-new-manufacturing-facility-in-austin-texas",
    claim: "Amazon announced a new manufacturing facility in Austin, Texas as a multi-billion-dollar development.", relevance: "A robotics manufacturing facility creates equipment and factory integration scope.",
  },
  {
    company: "Amazon", domain: "aboutamazon.com", country: "United States", event_type: "MARKET_EXPANSION", event_date: "2026-05-04", geography: "United States",
    primary_source: "https://press.aboutamazon.com/2026/5/amazon-launches-amazon-supply-chain-services-opening-its-logistics-network-to-all-businesses",
    claim: "Amazon launched Supply Chain Services and opened its freight, distribution and fulfillment network to all businesses.", relevance: "A new commercial logistics operation changes service and network scope.",
  },
  {
    company: "Amazon", domain: "aboutamazon.com", country: "United States", event_type: "CAPEX", event_date: "2026-08-18", geography: "Louisiana",
    primary_source: "https://www.aboutamazon.com/news/company-news/amazon-data-center-louisiana-new-jobs",
    claim: "Amazon increased its planned Louisiana data-center investment to $18 billion with a third campus.", relevance: "A committed additional campus materially changes infrastructure scope.",
  },
  {
    company: "FedEx", domain: "fedex.com", country: "United States", event_type: "FACILITY_OPENING", event_date: "2026-03-05", geography: "Caguas, Puerto Rico",
    primary_source: "https://newsroom.fedex.com/newsroom/latin-america-english/fedex-opens-new-station-in-caguas-strengthening-its-network-in-puerto-rico",
    claim: "FedEx opened a new station in Caguas with 20 dedicated routes, expanding operational capacity.", relevance: "A new station and routes change fleet and logistics operations.",
  },
  {
    company: "Refinería de Cartagena", domain: "ecopetrol.com.co", country: "Colombia", event_type: "FACILITY_OPENING", event_date: "2026-04-09", geography: "Cartagena, Colombia",
    primary_source: "https://www.ecopetrol.com.co/wps/portal/Home/es/noticias/detalle/refineria-de-cartagena-puso-en-operacion-nueva-planta-para-solidificar-azufre/",
    claim: "La Refinería de Cartagena puso en operación una nueva planta con capacidad de 1.000 toneladas diarias.", relevance: "Una nueva unidad de proceso cambia producción, logística y control industrial.",
  },
  {
    company: "Ecopetrol", domain: "ecopetrol.com.co", country: "Colombia", event_type: "OPERATIONAL_INVESTMENT", event_date: "2026-02-12", geography: "Barrancabermeja, Colombia",
    primary_source: "https://www.ecopetrol.com.co/wps/portal/Home/es/noticias/detalle/ecopetrol-e-isa-desarrollaron-proyecto-para-mejorar-confiabilidad-operativa-de-la-refineria-de-barrancabermeja",
    claim: "Ecopetrol e ISA construyeron dos nuevas líneas eléctricas de 60 MW para ampliar la capacidad operativa de la refinería de Barrancabermeja.", relevance: "La nueva infraestructura reduce paradas y cambia la gestión energética industrial.",
  },
] as const;

let passed = 0;
function test(name: string, condition: boolean) {
  assert.equal(condition, true, name);
  passed += 1;
  console.log(`ok - ${name}`);
}

test("corpus contains 16 real company/event pairs", corpus.length === 16);
test("corpus spans United States and Colombia", corpus.some((x) => x.country === "United States") && corpus.filter((x) => x.country === "Colombia").length === 2);
test("every event binds an HTTPS primary source", corpus.every((x) => x.primary_source.startsWith("https://")));
test("every event has an explicit ISO event date", corpus.every((x) => /^20\d{2}-\d{2}-\d{2}$/.test(x.event_date)));
test("every event has geography and objective relevance", corpus.every((x) => x.geography.length > 3 && x.relevance.length > 20));
const signalResults = corpus.map((x) => {
  return { event: x, signal: classifySignalKind(x.claim), materiality: classifyMateriality(x.claim) };
});
const nonTriggering = signalResults.filter((x) => !x.signal.can_trigger).map((x) => x.event);
const nonMaterial = signalResults.filter((x) => x.materiality.level !== "high").map((x) => x.event);
if (nonTriggering.length) console.log(`non-triggering: ${nonTriggering.map((x) => x.company).join(", ")}`);
if (nonMaterial.length) console.log(`non-high: ${nonMaterial.map((x) => x.company).join(", ")}`);
test("every controlled claim is a triggerable change", nonTriggering.length === 0);
test("every controlled claim is materially high", nonMaterial.length === 0);
test("generic expansion aspiration remains non-triggering", !classifySignalKind("Acme announced expansion as a long-term ambition.").can_trigger);
test("marketing launch cannot imitate a logistics operation", !classifySignalKind("Acme launched a marketing campaign for supply chain leaders.").can_trigger);
test("station anniversary remains low materiality", classifyMateriality("FedEx celebrated the anniversary of its station with 20 routes.").level === "low");
test("current history page remains reference information", classifySignalKind("Our History: Acme opened a new facility in 1998 and today serves customers.").kind === "reference_information");

const productiveFiles = [
  "lib/lead-hunter/discovery-runner.ts",
  "lib/lead-hunter/event-first-discovery.ts",
  "lib/intelligence/account-deep-research.ts",
  "lib/intelligence/productive-spine.ts",
];
test("diagnostic corpus is isolated from productive discovery", productiveFiles.every((path) => !readFileSync(path, "utf8").includes("material-event-positive-control")));

console.log(`\n${passed}/12 material-event positive-control contracts passed`);
