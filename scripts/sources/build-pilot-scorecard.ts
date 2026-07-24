import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import Papa from "papaparse";
import { buildPilotScorecard, type AdjudicationRow, type PilotFeedback } from "@/lib/quality/pilot-scorecard";
import type { LeadLensReport } from "@/types";

const requested = process.argv[2];
if (!requested) {
  console.error("Usage: npm run pilot:scorecard -- <pilot-artifact-directory>");
  process.exit(2);
}

const dir = resolve(requested);
const adjudicationPath = join(dir, "adjudication.csv");
if (!existsSync(adjudicationPath)) {
  console.error(`Missing required artifact: ${adjudicationPath}`);
  process.exit(2);
}

function readJson<T>(name: string): T | null {
  const path = join(dir, name);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const parsed = Papa.parse<AdjudicationRow>(readFileSync(adjudicationPath, "utf8"), { header: true, skipEmptyLines: true });
if (parsed.errors.length > 0) {
  console.error(`Invalid adjudication.csv: ${parsed.errors[0].message}`);
  process.exit(2);
}

const report = readJson<LeadLensReport>("report.json");
const feedback = readJson<PilotFeedback>("feedback.json");
const scorecard = buildPilotScorecard({ report, adjudication: parsed.data, feedback });
const output = join(dir, "scorecard.json");
writeFileSync(output, `${JSON.stringify(scorecard, null, 2)}\n`);
console.log(JSON.stringify({ output, status: scorecard.status, blockers: scorecard.blockers, human_quality: scorecard.human_quality }, null, 2));

if (scorecard.status === "failed") process.exitCode = 3;
else if (scorecard.status === "insufficient_data") process.exitCode = 4;
