// Multi-source lead search orchestrator.
// Coordinates execution across active providers, tracks source_runs,
// and returns aggregate statistics. Apollo is the only active provider today.
//
// Architecture note: this orchestrator is NOT used by the current
// app/api/process/search/[id]/route.ts — that route calls Apollo directly
// for backward compatibility. The orchestrator is the future entry point
// when multi-source searches are enabled.
//
// Server-side only.

import type { SourceSearchParams, StandardLead } from "./source-provider";
import { getSourceProvider }  from "./source-registry";
import { allocateTargets }    from "./allocation";
import { startSourceRun, completeSourceRun } from "./source-run-tracker";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrchestratorInput {
  searchId:       string;
  requestedCount: number;
  params:         SourceSearchParams;
  /** Source names to run. Only active providers will produce results. */
  activeSources:  string[];
  /** Optional per-source weight overrides (falls back to defaults). */
  weights?:       Record<string, number>;
}

export interface SourceBreakdown {
  source:        string;
  allocated:     number;
  results:       number;
  durationMs:    number;
  status:        "completed" | "failed" | "skipped";
  error?:        string;
}

export interface OrchestratorOutput {
  leads:           StandardLead[];
  totalResults:    number;
  sourceBreakdown: SourceBreakdown[];
  durationMs:      number;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Executes a lead search across all requested active sources.
 *
 * Guarantees:
 * - A failure in one source never prevents others from running.
 * - source_run rows are created and updated for every source attempted.
 * - Results from all sources are merged and returned together.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeSourceSearch(
  client: any,
  input:  OrchestratorInput,
): Promise<OrchestratorOutput> {
  const orchestratorStart = Date.now();

  const allocation = allocateTargets(input.requestedCount, input.activeSources, input.weights);
  const breakdown:   SourceBreakdown[] = [];
  const allLeads:    StandardLead[]    = [];

  for (const sourceName of input.activeSources) {
    const provider = getSourceProvider(sourceName);

    // ── Inactive or unknown providers are skipped ──────────────────────────
    if (!provider || !provider.active) {
      breakdown.push({
        source:     sourceName,
        allocated:  allocation[sourceName] ?? 0,
        results:    0,
        durationMs: 0,
        status:     "skipped",
      });
      continue;
    }

    const sourceStart = Date.now();
    const runId = await startSourceRun(client, input.searchId, sourceName);

    try {
      const sourceParams: SourceSearchParams = {
        ...input.params,
        limit: allocation[sourceName] ?? input.requestedCount,
      };

      const leads = await provider.search(sourceParams);
      const durationMs = Date.now() - sourceStart;

      await completeSourceRun(client, runId, "completed", durationMs, leads.length);

      allLeads.push(...leads);
      breakdown.push({
        source:     sourceName,
        allocated:  allocation[sourceName] ?? input.requestedCount,
        results:    leads.length,
        durationMs,
        status:     "completed",
      });

      // ── Future Google Maps provider ──────────────────────────────────────
      // When google_maps provider is active, leads come here automatically.
      // No additional wiring needed — register in source-registry.ts.

      // ── Future LinkedIn provider ─────────────────────────────────────────
      // When linkedin provider is active, leads come here automatically.
      // Implement linkedin-provider.ts search() method and mark active: true.

      // ── Future Directory provider ────────────────────────────────────────
      // When directories provider is active, leads come here automatically.
      // Implement directory-provider.ts search() method and mark active: true.

    } catch (err: unknown) {
      const durationMs = Date.now() - sourceStart;
      const errorMsg   = err instanceof Error ? err.message : String(err);

      await completeSourceRun(client, runId, "failed", durationMs, 0, errorMsg);

      breakdown.push({
        source:     sourceName,
        allocated:  allocation[sourceName] ?? input.requestedCount,
        results:    0,
        durationMs,
        status:     "failed",
        error:      errorMsg,
      });
      // Continue to next source — one failure must not block others
    }
  }

  return {
    leads:           allLeads,
    totalResults:    allLeads.length,
    sourceBreakdown: breakdown,
    durationMs:      Date.now() - orchestratorStart,
  };
}
