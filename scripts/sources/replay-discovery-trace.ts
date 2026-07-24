import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { replayChannelHypotheses, type SearchTraceRow } from "@/lib/discovery/trace-replay";

const path = process.argv[2];
if (!path) throw new Error("Usage: replay-discovery-trace <discovery.json>");
const input = JSON.parse(readFileSync(resolve(path), "utf8")) as { metrics?: { search_trace?: SearchTraceRow[] } };
const trace = input.metrics?.search_trace ?? [];
const hypotheses = replayChannelHypotheses(trace);
console.log(JSON.stringify({
  mode: "offline_trace_replay",
  disclaimer: "Hypotheses only. A production candidate still requires live extraction, identity, geography, fit and adversarial validation.",
  trace_queries: trace.length,
  hypotheses: hypotheses.length,
  results: hypotheses,
}, null, 2));
