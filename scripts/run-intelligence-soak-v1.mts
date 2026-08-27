#!/usr/bin/env node
import { spawn } from "node:child_process";

const contexts = [
  { id: "us_manufacturing_automation", phase: "A", locale: "en", text: "We sell industrial automation integration and plant operations software to mid-market and enterprise manufacturers in the United States. We target companies operating their own plants that recently opened, expanded, modernized, or invested in production capacity. Exclude government agencies, publishers, consultants, pure software companies, and fully outsourced manufacturing operations." },
  { id: "us_logistics_wms", phase: "A", locale: "en", text: "We sell warehouse automation, WMS integration, and inventory orchestration to mid-market and enterprise manufacturers and distributors in the United States. We target companies operating their own warehouses or distribution centers with recent openings, capacity expansions, automation, or material logistics investments. Exclude government, publishers, consultants, pure software companies, and fully outsourced warehouse operations." },
  { id: "us_enterprise_operations", phase: "A", locale: "en", text: "We sell enterprise operations planning and systems integration software to large United States manufacturers and distributors. We target companies with recent acquisitions, new plants, regional expansion, capacity growth, or operational technology modernization. Exclude financial institutions, government, publishers, consultancies, software vendors, and changes with no operating impact." },
  { id: "co_logistics_automation", phase: "A", locale: "es", text: "Vendemos automatización de bodegas, integración WMS y orquestación de inventarios a fabricantes y distribuidores medianos y grandes en Colombia. Buscamos empresas que operen directamente centros de distribución, bodegas o plantas y que hayan abierto, ampliado, automatizado o invertido recientemente en infraestructura logística. Excluir entidades públicas, medios, consultoras, empresas de software puro y operaciones totalmente tercerizadas." },
  { id: "us_sparse_professional_services", phase: "A", locale: "en", text: "We sell specialized operations consulting to small United States professional-services firms only when they publicly announce a material new operating location, acquisition, or service-delivery transformation. Exclude generic hiring, awards, thought leadership, directories, publishers, government, and undated company descriptions." },
  { id: "us_industrial_distribution", phase: "D", locale: "en", text: "We sell inventory planning and warehouse process integration to mid-market industrial distributors in the United States. We target companies operating their own distribution facilities with a recent new warehouse, acquisition integration, capacity expansion, or automation investment. Exclude brokers without facilities, publishers, government, consultants, and fully outsourced logistics." },
  { id: "us_fleet_operations", phase: "D", locale: "en", text: "We sell fleet maintenance, route planning, and telematics software to large United States distributors and field-service operators with owned or controlled vehicle fleets. We target recent fleet purchases, route expansion, acquisitions, new service territories, or operations modernization. Exclude public authorities, vehicle manufacturers without field fleets, publishers, software companies, and fully outsourced transport." },
  { id: "us_channel_partnerships", phase: "D", locale: "en", text: "We sell partner operations and inventory integration software to United States manufacturers expanding through distributors and channel partners. We target material new distribution agreements, market-entry partnerships, acquisitions, or regional channel expansion that changes fulfillment operations. Exclude marketing-only alliances, event sponsorships, publishers, consultants, government, and undated partner pages." },
  { id: "co_fleet_operations", phase: "D", locale: "es", text: "Vendemos software de mantenimiento, rutas y telemetría a empresas colombianas medianas y grandes con flota propia o control operacional directo. Buscamos compras de vehículos, nuevas rutas, contratos materiales, expansión regional o modernización reciente. Excluir autoridades, sistemas públicos sin cuenta comercial, medios, fabricantes sin operación de flota y transporte totalmente tercerizado." },
  { id: "us_sparse_negative_control", phase: "D", locale: "en", text: "We sell operations planning and workflow integration software to small independent accounting firms in the United States. We only target firms that recently announced a material acquisition, merger, new operating location, or service-delivery transformation. Exclude generic hiring, awards, thought leadership, directories, publishers, government, and undated company descriptions." },
];

const requestedPhase = (process.argv[2] ?? "ALL").toUpperCase();
const requestedId = process.argv[3] ?? null;
const selected = contexts.filter(c => (requestedPhase === "ALL" || c.phase === requestedPhase) && (!requestedId || c.id === requestedId));
if (!selected.length) throw new Error(`unknown_soak_phase:${requestedPhase}`);

for (const [index, context] of selected.entries()) {
  console.log(`\nSOAK ${index + 1}/${selected.length} :: ${context.id} :: phase ${context.phase}`);
  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn("npm", ["run", "accept:customer-intelligence-e2e"], {
      cwd: process.cwd(), stdio: "inherit",
      env: { ...process.env, LEADLENS_ACCEPTANCE_CONTEXT: context.text, LEADLENS_ACCEPTANCE_LOCALE: context.locale, LEADLENS_SOAK_ID: context.id, LEADLENS_SOAK_PHASE: context.phase },
    });
    child.once("error", reject);
    child.once("exit", value => resolve(value ?? 1));
  });
  if (code !== 0) console.error(`SOAK FAILED :: ${context.id} :: exit ${code}`);
}
