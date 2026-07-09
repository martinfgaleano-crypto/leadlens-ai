// ─── Lead Hunter engine v0 ────────────────────────────────────────────────────
// Turns a run's source inputs into stored candidates. manual_sources only in
// v0 — no network fetches, no scraping. Every candidate passes the policy
// engine; blocked sources are counted, never stored as promotable candidates.

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { LeadHunterRunSummary } from "./lead-hunter-types";
import {
  computeCandidateConfidence,
  computeEvidenceQuality,
  computeFreshnessStatus,
  normalizeSignalType,
  validateLeadHunterSource,
} from "./lead-hunter-policy";
import { manualProvider } from "./providers/manual-provider";
import { MAX_CANDIDATES_HARD_CAP } from "./providers/base";
import {
  completeLeadHunterRun,
  createLeadHunterCandidate,
  failLeadHunterRun,
  getLeadHunterBriefById,
  getLeadHunterRunById,
  listLeadHunterSourceInputs,
  updateLeadHunterRunStatus,
} from "@/lib/storage/lead-hunter-store";

export interface GenerateResult {
  ok: boolean;
  reason?: string;
  summary?: LeadHunterRunSummary;
}

/** Process a run's manual source inputs into pending_review candidates. */
export async function generateCandidatesForRun(runId: string): Promise<GenerateResult> {
  const run = await getLeadHunterRunById(runId);
  if (!run) return { ok: false, reason: "Run not found." };
  if (run.status === "processing") return { ok: false, reason: "Run is already processing." };
  if (run.provider_mode !== "manual_sources") {
    return { ok: false, reason: "Only manual_sources mode is enabled in v0 — automated discovery requires a reviewed provider." };
  }

  const brief = run.brief_id ? await getLeadHunterBriefById(run.brief_id) : null;
  const sources = await listLeadHunterSourceInputs(runId);
  if (sources.length === 0) {
    return { ok: false, reason: "No source inputs yet — add at least one source URL with context first." };
  }

  await updateLeadHunterRunStatus(runId, "processing");
  console.log(`[lead-hunter] generate_started run=${runId} sources=${sources.length}`);

  const maxCandidates = Math.min(brief?.max_candidates ?? 25, MAX_CANDIDATES_HARD_CAP);
  const summary: LeadHunterRunSummary = {
    sources_processed: 0,
    candidates_created: 0,
    blocked_sources: 0,
    needs_review: 0,
    provider_mode: "manual_sources",
    notes: [],
  };

  try {
    for (const source of sources) {
      if (summary.candidates_created >= maxCandidates) {
        summary.notes?.push(`Candidate cap (${maxCandidates}) reached — remaining sources skipped.`);
        break;
      }
      summary.sources_processed++;

      // Policy gate per source.
      const validation = validateLeadHunterSource(source);
      if (validation.safety_status === "blocked") {
        summary.blocked_sources++;
        summary.notes?.push(`Blocked: ${source.source_url} — ${validation.reason}`);
        continue;
      }

      const findings = await manualProvider.extractCandidatesFromSource(source, brief);
      if (findings.length === 0) {
        summary.notes?.push(`No company parsed from ${source.source_url} — use "Company — evidence" format in the pasted context.`);
        continue;
      }

      for (const finding of findings) {
        if (summary.candidates_created >= maxCandidates) break;

        const signalType = finding.signal_type ? normalizeSignalType(finding.signal_type) : null;
        const freshness = computeFreshnessStatus(finding.signal_date);
        const evidenceQuality = computeEvidenceQuality({
          evidence_snippet: finding.evidence_snippet,
          signal_date: finding.signal_date,
          source_category: finding.source.source_category,
        });
        const confidence = computeCandidateConfidence({
          evidence_snippet: finding.evidence_snippet,
          signal_date: finding.signal_date,
          source_category: finding.source.source_category,
          signal_type: signalType,
        });

        const created = await createLeadHunterCandidate({
          run_id: runId,
          brief_id: run.brief_id,
          company_name: finding.company_name,
          domain: finding.domain ?? null,
          website_url: finding.website_url ?? null,
          region: finding.region ?? null,
          country: finding.country ?? null,
          industry: finding.industry ?? null,
          signal_type: signalType,
          signal_summary: finding.signal_summary ?? null,
          signal_date: finding.signal_date ?? null,
          source_url: finding.source.source_url,
          source_title: finding.source.source_title ?? null,
          source_category: finding.source.source_category,
          evidence_snippet: finding.evidence_snippet ?? null,
          evidence_quality: evidenceQuality,
          freshness_status: freshness,
          confidence_score: confidence,
          fit_rationale: brief?.icp_notes ? `Matched against brief "${brief.name}"` : null,
          suggested_action: confidence >= 70 ? "review_and_prioritize" : "review",
          usage_rights_status: finding.source.usage_rights_status ?? source.usage_rights_status ?? "unverified",
          safety_status: validation.safety_status,
        });

        if (created) {
          summary.candidates_created++;
          if (validation.safety_status === "needs_review") summary.needs_review++;
        }
      }
    }

    await completeLeadHunterRun(runId, summary as unknown as Record<string, unknown>, summary.candidates_created);
    console.log(`[lead-hunter] generate_completed run=${runId} candidates=${summary.candidates_created} blocked=${summary.blocked_sources}`);
    return { ok: true, summary };
  } catch (err) {
    const reason = err instanceof Error ? err.message.slice(0, 200) : "Generation error";
    console.error(`[lead-hunter] generate_failed run=${runId}:`, reason);
    await failLeadHunterRun(runId, reason);
    return { ok: false, reason };
  }
}
