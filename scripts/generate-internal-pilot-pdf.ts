import { mkdirSync, writeFileSync } from "fs";
import { buildPilotWorkspace } from "@/lib/intelligence/pilot-workspace";
import { buildInternalPilotPdf } from "@/lib/reports/internal-pilot-pdf";

const output = process.argv[2] ?? "output/pdf/leadlens-amor-de-gea-pilot-internal.pdf";
mkdirSync(output.split("/").slice(0, -1).join("/"), { recursive: true });
writeFileSync(output, buildInternalPilotPdf(buildPilotWorkspace()));
console.log(output);
