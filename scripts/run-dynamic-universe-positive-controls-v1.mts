#!/usr/bin/env node
import { spawn } from "node:child_process";

// Positive-control MARKETS, never winning-account seeds. Productive Lead Hunter
// must enumerate every organization from public sources autonomously.
const contexts = [
  { id: "pc_industrial_food_manufacturing_1", vertical: "industrial_manufacturing_automation", text: "We sell industrial automation integration and plant operations software to mid-market and enterprise food and beverage manufacturers in the United States. We target manufacturers operating their own production plants. Relevant changes include a new plant, production-line expansion, capacity investment, or operational technology modernization. Exclude retailers, distributors without manufacturing, consultants, software vendors, government, publishers, and fully outsourced manufacturing." },
  { id: "pc_industrial_packaging_manufacturing_2", vertical: "industrial_manufacturing_automation", text: "We sell industrial automation integration and plant operations software to mid-market and enterprise packaging manufacturers in the United States. We target companies operating their own manufacturing plants. Relevant changes include new facilities, production capacity expansion, equipment modernization, or operational technology investment. Exclude packaging distributors without plants, retailers, consultants, software vendors, government, publishers, and outsourced manufacturing." },
  { id: "pc_industrial_equipment_manufacturing_3", vertical: "industrial_manufacturing_automation", text: "We sell industrial automation integration and plant operations software to mid-market and enterprise industrial equipment manufacturers in the United States. We target companies controlling their own factories and production operations. Relevant changes include a new factory, expanded production, capacity investment, or plant technology modernization. Exclude equipment distributors without manufacturing, retailers, consultants, software vendors, government, publishers, and outsourced production." },
  { id: "pc_warehouse_industrial_distribution_1", vertical: "warehouse_automation", text: "We sell warehouse automation, WMS integration, and inventory orchestration to mid-market and enterprise industrial distributors in the United States. We target distributors operating their own warehouses or distribution centers. Relevant changes include a new facility, capacity expansion, acquisition integration, or warehouse automation investment. Exclude brokers without facilities, manufacturers without distribution operations, retailers, consultants, software vendors, government, publishers, and fully outsourced logistics." },
  { id: "pc_warehouse_food_distribution_2", vertical: "warehouse_automation", text: "We sell warehouse automation, WMS integration, and inventory orchestration to mid-market and enterprise food and beverage manufacturers and distributors in the United States. We target companies directly operating warehouses or distribution centers. Relevant changes include a new distribution center, capacity expansion, cold-chain investment, or warehouse automation. Exclude retailers without distribution operations, brokers, consultants, software vendors, government, publishers, and fully outsourced logistics." },
  { id: "pc_warehouse_consumer_goods_3", vertical: "warehouse_automation", text: "We sell warehouse automation, WMS integration, and inventory orchestration to mid-market and enterprise consumer-goods manufacturers and distributors in the United States. We target companies controlling their own warehousing and fulfillment operations. Relevant changes include a new distribution center, capacity expansion, acquisition integration, or automation investment. Exclude retailers without owned logistics, consultants, software vendors, government, publishers, and fully outsourced fulfillment." },
];

const requested = process.argv.slice(2);
const selected = requested.length ? contexts.filter(x => requested.includes(x.id) || requested.includes(x.vertical)) : contexts;
if (!selected.length) throw new Error(`unknown_positive_control:${requested.join(",")}`);

for (const [index, context] of selected.entries()) {
  console.log(`\nPOSITIVE CONTROL ${index + 1}/${selected.length} :: ${context.id} :: ${context.vertical}`);
  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn("npm", ["run", "accept:customer-intelligence-e2e"], {
      cwd: process.cwd(), stdio: "inherit",
      env: { ...process.env, LEADLENS_ACCEPTANCE_CONTEXT: context.text, LEADLENS_ACCEPTANCE_LOCALE: "en", LEADLENS_SOAK_ID: context.id, LEADLENS_SOAK_PHASE: context.vertical },
    });
    child.once("error", reject);
    child.once("exit", value => resolve(value ?? 1));
  });
  if (code !== 0) console.error(`POSITIVE CONTROL FAILED :: ${context.id} :: exit ${code}`);
}
