import { loadEnvConfig } from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";
import { buildMarketLandscape } from "@/lib/reports/market-landscape";

loadEnvConfig(process.cwd());

const discoveryPath = process.argv[2];
const reportPath = process.argv[3];
if (!discoveryPath || !reportPath) {
  throw new Error("Usage: backfill-amor-market-landscape <discovery.json> <report.json>");
}

async function main() {
  const discovery = JSON.parse(readFileSync(discoveryPath, "utf8"));
  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  const knownAccounts = ["Grupo Éxito", "Carulla", "Olímpica", "Farmatodo Colombia", "Cruz Verde Colombia", "PriceSmart Colombia", "Makro Colombia"];
  report.market_landscape = buildMarketLandscape({
    discovery,
    report,
    knownAccounts,
    geography: ["Colombia"],
    categoryQuery: "Bebidas herbales naturales de bienestar para sueño, energía y cuidado digestivo",
  });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const { completeSnapshot } = await import("@/lib/storage/snapshot-store");
  const snapshotId = await completeSnapshot(report.job_id, report.plan ?? "sample", report);
  if (!snapshotId) throw new Error("Could not update the Admin Portal snapshot.");
  console.log(JSON.stringify({
    job_id: report.job_id,
    snapshot_id: snapshotId,
    considered: report.market_landscape.considered_count,
    investigated: report.market_landscape.investigated_count,
    selected: report.market_landscape.selected_count,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
