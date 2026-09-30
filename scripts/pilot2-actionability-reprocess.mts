#!/usr/bin/env node
/** Provider-free reprocessing of a persisted Track-A validation artifact after a
 * deterministic Case/provenance fix. Never performs discovery or research. */
import { readFileSync, writeFileSync } from "node:fs";
const { canonicalCaseForLead } = await import("@/lib/intelligence/productive-spine");
const path = process.env.PILOT2_TRACK_A_OUTPUT ?? "output/pilot2/2026-09-30-actionability-v1/track-a-validation.json";
const artifact = JSON.parse(readFileSync(path, "utf8"));
artifact.cases = (artifact.processed_leads ?? []).map((lead: any) => canonicalCaseForLead(lead)).filter(Boolean);
artifact.reprocessed_at = new Date().toISOString();
artifact.reprocess_reason = "Bind current actionability to actionability_source_url rather than mutable event research source_url.";
writeFileSync(path, JSON.stringify(artifact, null, 2));
console.log(JSON.stringify({ path, decisions: artifact.cases.reduce((out: any, c: any) => { out[c.decision] = (out[c.decision] ?? 0) + 1; return out; }, {}) }));
